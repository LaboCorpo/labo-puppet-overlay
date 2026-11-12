/*
 * Puppet Overlay — Electron main process.
 * - Transparent, click-through, always-on-top overlay window (+ placement mode)
 * - Tray icon + settings/status panel (hides instead of closing)
 * - Local server for OBS, Discord RPC voice tracking, Twitch chat, avatar sync, auto-update
 */
const { app, BrowserWindow, Tray, Menu, nativeImage, screen, shell, globalShortcut, Notification, dialog, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const { Store } = require('./store');
const { createServer } = require('./server');
const { DiscordVoiceRPC } = require('./discord-rpc');
const { TwitchChat } = require('./twitch');
const { Updater } = require('./updater');
const { createLogger } = require('./log');
const I18N = require('../web/shared/i18n.js');
const t = I18N.t;

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
// Overlay windows have no user gesture: let them play chat sounds anyway.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const WEB_DIR = path.join(__dirname, '..', 'web');
const ICON = path.join(__dirname, '..', 'build', 'icon.png');
const img = (name) => nativeImage.createFromPath(path.join(__dirname, '..', 'build', name));
const START_HIDDEN = process.argv.includes('--hidden');
let bundled = {};
try { bundled = JSON.parse(fs.readFileSync(path.join(__dirname, 'app-config.json'), 'utf8')); } catch (e) {}

let log, store, rpc, twitch, updater, srv, tray, overlayWin, panelWin, creatorWin;
let quitting = false;
let port;
let placement = false;
let startMinimized = false;
let selfSharing = false; // manual "I'm sharing my screen" (Discord's RPC may not report Go Live)
let hotkeyErrors = {};

function base() { return `http://127.0.0.1:${port}`; }
function syncLang() { I18N.setLang(I18N.resolve(store.settings.app.language, app.getLocale())); }

process.on('uncaughtException', (e) => { if (log) log.error('uncaught: ' + (e && e.stack || e)); });
process.on('unhandledRejection', (e) => { if (log) log.error('unhandled rejection: ' + (e && e.stack || e)); });

// ---------- State exposed to pages ----------
function appState() {
  return {
    discord: rpc ? rpc.snapshot() : { status: 'starting', members: [] },
    known: store.data.known,
    syncStatus,
    twitchStatus: twitch ? twitch.snapshot() : { status: 'off' },
    app: {
      version: app.getVersion(), placement, hotkeyErrors, lang: I18N.lang, selfSharing,
      update: updater ? updater.state : null,
      portable: !!process.env.PORTABLE_EXECUTABLE_FILE,
      displays: screen.getAllDisplays().map((d, i) => ({ index: i, label: `${i === 0 ? 'Primary — ' : ''}${d.size.width}×${d.size.height}`, primary: d.id === screen.getPrimaryDisplay().id })),
    },
  };
}
const push = () => { if (srv) srv.pushState(); updateTray(); updateTaskbar(); };

// ---------- Discord ----------
function startDiscord() {
  if (rpc) { rpc.removeAllListeners(); rpc.stop(); }
  const d = store.settings.discord;
  rpc = new DiscordVoiceRPC({
    clientId: d.clientId, clientSecret: d.clientSecret, redirectUri: d.redirectUri,
    getToken: () => (store.data.token && store.data.token.clientId === d.clientId ? store.data.token : null),
    saveToken: (t) => { store.data.token = t ? Object.assign({ clientId: d.clientId }, t) : null; store.save(); },
  });
  rpc.on('status', (s, detail) => { log.info(`[discord] ${s}${detail ? ' — ' + detail : ''}`); push(); });
  rpc.on('channel', () => { store.rememberMembers(rpc.snapshot().members || []); push(); });
  rpc.on('speaking', (id, speaking) => srv.broadcast('speaking', { id, speaking }));
  rpc.on('effect', (e) => { log.info('[discord] voice effect ' + JSON.stringify(e).slice(0, 200)); srv.broadcast('voice-effect', e); });
  rpc.on('error', (e) => log.error('[discord] ' + e.message));
  rpc.on('warn', (e) => log.warn('[discord] ' + e.message));
  rpc.start();
}

// ---------- Twitch ----------
function startTwitch() {
  twitch = new TwitchChat({
    getSettings: () => store.settings.twitch,
    setOverride: (login, patch) => { store.setViewer(login, patch); srv.broadcast('viewer', { login, override: store.getViewer(login) }); },
  });
  twitch.on('status', () => { log.info(`[twitch] ${twitch.status} ${twitch.detail || ''}`); push(); });
  twitch.on('chat', (m) => srv.broadcast('chat', m));
  twitch.on('event', (e) => srv.broadcast('twitch-event', e));
  twitch.sync();
}

// ---------- Avatar sync (read-only shared JSON) ----------
let syncTimer;
let syncStatus = { status: 'off' };
require('../web/shared/puppet.js'); // globalThis.Puppet for decoding shared codes
// Accepts a gist page URL (converted to its raw URL) or any direct raw URL.
function rawSyncUrl(url) {
  const m = String(url).trim().match(/^https:\/\/gist\.github\.com\/([^/]+)\/([0-9a-f]+)\/?$/i);
  return m ? `https://gist.githubusercontent.com/${m[1]}/${m[2]}/raw` : String(url).trim();
}
// File formats accepted: {"avatars":[...]}, a JSON array, a single .puppet file, or plain text with one PUP1 code per line.
function parseSyncFile(text) {
  const P = globalThis.Puppet;
  const out = [];
  try {
    const j = JSON.parse(text);
    const list = Array.isArray(j) ? j : Array.isArray(j.avatars) ? j.avatars : j.avatar ? [j.avatar] : Object.values(j.avatars || j);
    for (const it of list) out.push(it && it.avatar ? it.avatar : it);
  } catch (e) {
    for (const line of String(text).split(/\r?\n/)) {
      const code = (line.match(/PUP1\.[A-Za-z0-9_-]+/) || [])[0];
      if (code) try { out.push(P.decodeAny(code)); } catch (err) { /* skip bad line */ }
    }
  }
  return out.filter((a) => a && /^\d{15,22}$/.test(String(a.id))).map((a) => P.normalize(a));
}
async function syncOnce() {
  const s = store.settings.sync;
  if (!s.url) { syncStatus = { status: 'off' }; return; }
  try {
    const res = await fetch(rawSyncUrl(s.url) + (s.url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const list = parseSyncFile(await res.text());
    const out = {};
    for (const a of list) out[a.id] = a;
    store.data.syncedAvatars = out; store.save();
    syncStatus = { status: 'ok', count: list.length, at: Date.now() };
    push();
  } catch (e) { log.warn('[sync] ' + e.message); syncStatus = { status: 'error', error: e.message, at: Date.now() }; push(); }
}
function scheduleSync() {
  clearInterval(syncTimer);
  if (!store.settings.sync.url) return;
  syncOnce();
  syncTimer = setInterval(syncOnce, Math.max(30, store.settings.sync.intervalSec || 120) * 1000);
}

// ---------- Screen share preview (own screen only; Discord doesn't expose others' streams) ----------
function myId() { const d = rpc && rpc.snapshot(); return d && d.me ? d.me.id : null; }
function iAmSharing() {
  if (selfSharing) return true;
  const d = rpc && rpc.snapshot(); const me = myId();
  return !!(d && me && (d.members || []).some((m) => m.id === me && m.streaming));
}
let lastCapture = 0, capturing = false;
async function previewTick() {
  const o = store.settings.overlay;
  if (o.screenShare !== 'advanced' || !iAmSharing() || capturing) return;
  if (Date.now() - lastCapture < Math.max(1, o.previewInterval || 2) * 1000) return;
  capturing = true; lastCapture = Date.now();
  try {
    // Tiny thumbnail at a low rate keeps this cheap (~15-60 ms every couple of seconds).
    const srcs = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 192, height: 108 } });
    const src = srcs[o.previewDisplay || 0] || srcs[0];
    if (src) srv.broadcast('screen-preview', { id: myId() || 'self', img: 'data:image/jpeg;base64,' + src.thumbnail.toJPEG(55).toString('base64') });
  } catch (e) { log.warn('[preview] ' + e.message); }
  capturing = false;
}
function toggleSharing(on) { selfSharing = on == null ? !selfSharing : !!on; if (!selfSharing) srv.broadcast('screen-preview', { id: myId() || 'self', img: null }); push(); }

// ---------- Overlay window ----------
function overlayScene() { return store.settings.twitch.showOnDesktop ? 'all' : 'discord'; }

function createOverlay() {
  const displays = screen.getAllDisplays();
  const disp = displays[store.settings.overlay.display] || screen.getPrimaryDisplay();
  const b = disp.workArea;
  overlayWin = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    transparent: true, frame: false, resizable: false, movable: false, focusable: false,
    skipTaskbar: true, hasShadow: false, alwaysOnTop: true, backgroundColor: '#00000000', show: false,
    webPreferences: { backgroundThrottling: false },
  });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setIgnoreMouseEvents(true);
  overlayWin.setVisibleOnAllWorkspaces(true);
  overlayWin.loadURL(`${base()}/overlay.html?scene=${overlayScene()}&host=desktop`);
  overlayWin.once('ready-to-show', () => { if (store.settings.overlay.enabled || placement) overlayWin.showInactive(); });
  // Crash recovery: a dead renderer gets rebuilt instead of leaving an invisible overlay.
  overlayWin.webContents.on('render-process-gone', (e, d) => { log.error('[overlay] renderer gone: ' + d.reason); setTimeout(rebuildOverlay, 1000); });
  overlayWin.on('unresponsive', () => { log.warn('[overlay] unresponsive, reloading'); overlayWin.webContents.reload(); });
}

let rebuildTimer = null;
function rebuildOverlay() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.destroy();
    createOverlay();
    if (placement) setPlacement(true);
  }, 300);
}

function setPlacement(on) {
  placement = !!on;
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.setIgnoreMouseEvents(!placement);
    overlayWin.setFocusable(placement);
    if (placement) { overlayWin.showInactive(); overlayWin.focus(); }
    else if (!store.settings.overlay.enabled) overlayWin.hide();
  }
  push();
}

function toggleOverlay() { applySettings({ overlay: { enabled: !store.settings.overlay.enabled } }); }

// ---------- Panel / creator ----------
function openPanel() {
  if (panelWin && !panelWin.isDestroyed()) { if (panelWin.isMinimized()) panelWin.restore(); panelWin.show(); panelWin.focus(); return; }
  panelWin = new BrowserWindow({
    width: 1080, height: 780, minWidth: 820, minHeight: 600, title: 'Puppet Overlay',
    icon: ICON, autoHideMenuBar: true, backgroundColor: '#17151c', show: false,
  });
  panelWin.loadURL(`${base()}/panel.html`);
  panelWin.once('ready-to-show', () => {
    if (startMinimized) { startMinimized = false; panelWin.showInactive(); panelWin.minimize(); }
    else panelWin.show();
    updateTaskbar();
  });
  panelWin.on('show', updateTaskbar);
  panelWin.on('restore', updateTaskbar);
  panelWin.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(base())) { openCreator(url); return { action: 'deny' }; }
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  panelWin.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    // With the taskbar icon on, closing just minimizes so the app stays visible in the taskbar.
    if (store.settings.app.taskbarIcon) panelWin.minimize(); else panelWin.hide();
    if (!store.settings.app.firstRunDone) {
      store.updateSettings({ app: { firstRunDone: true } });
      if (Notification.isSupported()) new Notification({ title: t('Puppet Overlay is still running'), body: t(store.settings.app.taskbarIcon ? 'It stays in your taskbar and system tray. Right-click the tray icon to quit.' : 'It lives in the system tray. Right-click the icon to quit.'), icon: ICON }).show();
    }
  });
}

function openCreator(url) {
  const target = url || `${base()}/creator.html`;
  if (creatorWin && !creatorWin.isDestroyed()) { creatorWin.loadURL(target); creatorWin.show(); creatorWin.focus(); return; }
  creatorWin = new BrowserWindow({ width: 1200, height: 820, minWidth: 760, minHeight: 600, title: t('Avatar Creator'), icon: ICON, autoHideMenuBar: true, backgroundColor: '#17151c', show: false });
  creatorWin.loadURL(target);
  creatorWin.once('ready-to-show', () => creatorWin.show());
  creatorWin.webContents.setWindowOpenHandler(({ url: u }) => { if (/^https:\/\//.test(u)) shell.openExternal(u); return { action: 'deny' }; });
}

// ---------- Tray ----------
function updateTray() {
  if (!tray) return;
  const d = rpc ? rpc.snapshot() : { status: '—' };
  const ov = store.settings.overlay.enabled;
  const up = updater && updater.state;
  const hk = store.settings.app.hotkeys;
  const pretty = (a) => (a ? a.replace('CommandOrControl', 'Ctrl') : undefined);
  const dLine = t('Discord: {s}', { s: t(d.status) + (d.channel ? ' · ' + (d.channel.name || t('call')) : '') });
  tray.setToolTip(`Puppet Overlay ${app.getVersion()} — ${dLine}`);
  const items = [
    { label: dLine, enabled: false },
    { type: 'separator' },
    { label: t('Open panel'), click: openPanel },
    { label: t('Avatar creator'), click: () => openCreator() },
    { type: 'separator' },
    { label: t('Show overlay'), type: 'checkbox', checked: ov, accelerator: pretty(hk.toggleOverlay), click: toggleOverlay },
    { label: t(placement ? 'Finish placement' : 'Move puppets…'), accelerator: pretty(hk.placement), click: () => setPlacement(!placement) },
    { label: t("I'm sharing my screen"), type: 'checkbox', checked: selfSharing, accelerator: pretty(hk.shareScreen), click: () => toggleSharing() },
    { label: t('Reconnect Discord'), click: () => rpc && rpc.restart() },
  ];
  if (up && (up.status === 'ready' || up.status === 'available')) items.push({ type: 'separator' }, { label: up.status === 'ready' ? t('Restart to update (v{v})', { v: up.latest }) : t('Download v{v}', { v: up.latest }), click: () => updater.install() });
  items.push({ type: 'separator' }, { label: t('Quit'), click: () => { quitting = true; app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

// ---------- Taskbar (Windows): status badge, thumbnail buttons, update progress, title ----------
let lastBadge = null;
function updateTaskbar() {
  if (!panelWin || panelWin.isDestroyed()) return;
  const d = rpc ? rpc.snapshot() : { status: 'starting' };
  const n = (d.members || []).length;
  panelWin.setTitle(d.channel ? `Puppet Overlay — ${d.channel.name || t('Call')} (${n})` : 'Puppet Overlay');
  if (process.platform !== 'win32') return;
  const badge = d.channel ? 'live' : /error|refused/.test(d.status) ? 'error' : d.status === 'connected' ? null : 'idle';
  if (badge !== lastBadge) {
    lastBadge = badge;
    panelWin.setOverlayIcon(badge ? img(`badge-${badge}.png`) : null, badge ? t(d.status) : '');
  }
  const up = updater && updater.state;
  panelWin.setProgressBar(up && up.status === 'downloading' ? Math.max(0.02, (up.progress || 0) / 100) : -1);
  try {
    panelWin.setThumbarButtons([
      { tooltip: t('Show / hide overlay'), icon: img('thumb-eye.png'), click: toggleOverlay },
      { tooltip: t(placement ? 'Finish placement' : 'Move puppets…'), icon: img('thumb-move.png'), click: () => setPlacement(!placement) },
      { tooltip: t('Replay entrances'), icon: img('thumb-fx.png'), click: () => srv.broadcast('fx-test', {}) },
    ]);
  } catch (e) { /* window not shown yet */ }
}

// ---------- Hotkeys & startup ----------
function registerHotkeys() {
  globalShortcut.unregisterAll();
  hotkeyErrors = {};
  const hk = store.settings.app.hotkeys || {};
  const map = { toggleOverlay, placement: () => setPlacement(!placement), muteChat: () => applySettings({ twitch: { sound: { muted: !store.settings.twitch.sound.muted } } }), shareScreen: () => toggleSharing() };
  for (const [name, fn] of Object.entries(map)) {
    const acc = hk[name];
    if (!acc) continue;
    try { if (!globalShortcut.register(acc, fn)) hotkeyErrors[name] = 'Already used by another app'; }
    catch (e) { hotkeyErrors[name] = 'Invalid shortcut'; }
  }
  push();
}

function applyLoginItem() {
  if (!app.isPackaged) return;
  const exe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath; // portable runs from a temp copy
  app.setLoginItemSettings({ openAtLogin: !!store.settings.app.launchAtStartup, path: exe, args: ['--hidden'] });
}

// ---------- Settings ----------
function applySettings(patch) {
  const prev = JSON.parse(JSON.stringify(store.settings));
  store.updateSettings(patch);
  const s = store.settings;
  const changed = (k) => JSON.stringify(prev[k]) !== JSON.stringify(s[k]);
  if (changed('discord')) startDiscord();
  if (prev.overlay.display !== s.overlay.display || prev.twitch.showOnDesktop !== s.twitch.showOnDesktop) rebuildOverlay();
  else if (overlayWin && !overlayWin.isDestroyed()) (s.overlay.enabled || placement) ? overlayWin.showInactive() : overlayWin.hide();
  if (changed('sync')) scheduleSync();
  if (changed('twitch')) twitch.sync();
  if (JSON.stringify(prev.app.hotkeys) !== JSON.stringify(s.app.hotkeys)) registerHotkeys();
  if (prev.app.launchAtStartup !== s.app.launchAtStartup) applyLoginItem();
  if (prev.app.language !== s.app.language) syncLang();
  if (prev.app.taskbarIcon !== s.app.taskbarIcon && !s.app.taskbarIcon && panelWin && !panelWin.isDestroyed() && panelWin.isMinimized()) panelWin.hide();
  push();
}

async function onAction(name, b) {
  switch (name) {
    case 'reconnect': store.data.token = null; store.save(); startDiscord(); return;
    case 'open-creator': openCreator(`${base()}/creator.html${b.id ? '?id=' + encodeURIComponent(b.id) : ''}`); return;
    case 'placement': setPlacement(b.on); return;
    case 'update-check': await updater.check(); return;
    case 'update-install': updater.install(); return;
    case 'open-logs': shell.openPath(log.dir); return;
    case 'open-url': if (/^https:\/\//.test(b.url || '')) shell.openExternal(b.url); return;
    case 'twitch-test': twitch.simulate(b.kind); return;
    case 'fx-test': srv.broadcast('fx-test', {}); return;
    case 'sync-now': await syncOnce(); return;
    case 'toggle-sharing': toggleSharing(b.on); return;
    case 'test-voice-fx': {
      const d = rpc && rpc.snapshot(); const ms = (d && d.members) || [];
      const m = ms[Math.floor(Math.random() * ms.length)];
      const emojis = ['🎉', '😂', '🔥', '❤️', '👏', '💀'];
      srv.broadcast('voice-effect', { userId: m ? m.id : 'f1', emoji: { name: emojis[Math.floor(Math.random() * emojis.length)], id: null }, soundId: Math.random() < 0.4 ? 1 : null, test: true });
      return;
    }
    case 'forget-member': store.forgetMember(String(b.id || '')); push(); return;
    case 'clear-viewers': store.clearViewers(); srv.broadcast('viewers-reset', {}); push(); return;
    case 'export-config': {
      const r = await dialog.showSaveDialog(panelWin, { defaultPath: 'puppet-overlay-backup.json' });
      if (!r.canceled) fs.writeFileSync(r.filePath, JSON.stringify({ settings: Object.assign({}, store.settings, { discord: Object.assign({}, store.settings.discord, { clientSecret: '' }) }), avatars: store.data.avatars }, null, 2));
      return;
    }
    default: throw new Error('Unknown action');
  }
}

// ---------- Boot ----------
app.on('second-instance', openPanel);
app.on('window-all-closed', () => { /* keep running in the tray */ });
app.on('before-quit', () => { quitting = true; if (rpc) rpc.stop(); if (twitch) twitch.close(); if (store) store.flush(); });
app.on('will-quit', () => globalShortcut.unregisterAll());

app.whenReady().then(async () => {
  app.setAppUserModelId('com.puppetoverlay.app');
  log = createLogger(path.join(app.getPath('userData'), 'logs'));
  log.info(`Puppet Overlay ${app.getVersion()} starting${START_HIDDEN ? ' (hidden)' : ''}`);
  store = new Store(app.getPath('userData'), bundled);
  syncLang();
  srv = createServer({ webDir: WEB_DIR, store, getState: appState, onSettings: applySettings, onAction });

  // Port: try the configured one, then the next few.
  port = store.settings.port || 47800;
  await new Promise((resolve, reject) => {
    let tries = 0;
    srv.server.on('error', (e) => { if (e.code === 'EADDRINUSE' && tries++ < 10) { port += 1; srv.server.listen(port, '127.0.0.1'); } else reject(e); });
    srv.server.listen(port, '127.0.0.1', resolve);
  }).catch((e) => { dialog.showErrorBox('Puppet Overlay', 'Could not start the local server: ' + e.message); app.exit(1); });
  log.info('server on ' + base());

  updater = new Updater(log);
  updater.on('change', (st) => {
    push();
    if (st.status === 'ready' && Notification.isSupported()) new Notification({ title: t('Update ready'), body: t('Puppet Overlay {v} will install when you restart the app.', { v: st.latest }), icon: ICON }).show();
  });
  updater.start(4, () => store.settings.app.autoUpdate);

  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.on('click', openPanel);
  startDiscord();
  startTwitch();
  createOverlay();
  scheduleSync();
  setInterval(previewTick, 500);
  registerHotkeys();
  applyLoginItem();
  updateTray();
  if (!START_HIDDEN) openPanel();
  else if (store.settings.app.taskbarIcon) { startMinimized = true; openPanel(); } // hidden start still gets its taskbar button
  screen.on('display-removed', rebuildOverlay);
  screen.on('display-added', rebuildOverlay);
  screen.on('display-metrics-changed', rebuildOverlay);
});
