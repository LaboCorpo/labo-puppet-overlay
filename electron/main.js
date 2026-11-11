/*
 * Puppet Overlay — Electron main process.
 * - Transparent, click-through, always-on-top overlay window
 * - Tray icon + settings/status panel (hides instead of closing)
 * - Local server for OBS + Discord RPC voice tracking + optional avatar sync
 */
const { app, BrowserWindow, Tray, Menu, nativeImage, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { Store } = require('./store');
const { createServer } = require('./server');
const { DiscordVoiceRPC } = require('./discord-rpc');

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const WEB_DIR = path.join(__dirname, '..', 'web');
const ICON = path.join(__dirname, '..', 'build', 'icon.png');
let bundled = {};
try { bundled = JSON.parse(fs.readFileSync(path.join(__dirname, 'app-config.json'), 'utf8')); } catch (e) {}

let store, rpc, srv, tray, overlayWin, panelWin, creatorWin;
let quitting = false;
let port;

function base() { return `http://127.0.0.1:${port}`; }

// ---------- Discord ----------
function startDiscord() {
  if (rpc) { rpc.removeAllListeners(); rpc.stop(); }
  const d = store.settings.discord;
  rpc = new DiscordVoiceRPC({
    clientId: d.clientId, clientSecret: d.clientSecret, redirectUri: d.redirectUri,
    getToken: () => (store.data.token && store.data.token.clientId === d.clientId ? store.data.token : null),
    saveToken: (t) => { store.data.token = t ? Object.assign({ clientId: d.clientId }, t) : null; store.save(); },
  });
  const push = () => { srv.broadcast('state', srv.fullState()); updateTray(); };
  rpc.on('status', push);
  rpc.on('channel', push);
  rpc.on('speaking', (id, speaking) => srv.broadcast('speaking', { id, speaking }));
  rpc.on('error', (e) => console.error('[discord]', e.message));
  rpc.on('warn', (e) => console.warn('[discord]', e.message));
  rpc.start();
}

// ---------- Avatar sync (V2-ready, read-only) ----------
let syncTimer;
async function syncOnce() {
  const s = store.settings.sync;
  if (!s.url) return;
  try {
    const res = await fetch(s.url, { cache: 'no-store' });
    const j = await res.json();
    const list = Array.isArray(j) ? j : Array.isArray(j.avatars) ? j.avatars : Object.values(j.avatars || j);
    const out = {};
    for (const a of list) if (a && /^\d{15,22}$/.test(String(a.id))) out[a.id] = a;
    store.data.syncedAvatars = out; store.save();
    srv.broadcast('state', srv.fullState());
  } catch (e) { console.warn('[sync]', e.message); }
}
function scheduleSync() {
  clearInterval(syncTimer);
  if (!store.settings.sync.url) return;
  syncOnce();
  syncTimer = setInterval(syncOnce, Math.max(30, store.settings.sync.intervalSec || 120) * 1000);
}

// ---------- Windows ----------
function overlayScene() { return store.settings.twitch.showOnDesktop ? 'all' : 'discord'; }

function createOverlay() {
  const displays = screen.getAllDisplays();
  const disp = displays[store.settings.overlay.display] || screen.getPrimaryDisplay();
  const b = disp.workArea;
  overlayWin = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    transparent: true, frame: false, resizable: false, movable: false, focusable: false,
    skipTaskbar: true, hasShadow: false, alwaysOnTop: true, backgroundColor: '#00000000',
    webPreferences: { backgroundThrottling: false },
  });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setIgnoreMouseEvents(true);
  overlayWin.setVisibleOnAllWorkspaces(true);
  overlayWin.loadURL(`${base()}/overlay.html?scene=${overlayScene()}`);
  if (!store.settings.overlay.enabled) overlayWin.hide();
}

function rebuildOverlay() {
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.destroy();
  createOverlay();
}

function openPanel() {
  if (panelWin && !panelWin.isDestroyed()) { panelWin.show(); panelWin.focus(); return; }
  panelWin = new BrowserWindow({
    width: 1040, height: 760, minWidth: 760, minHeight: 560, title: 'Puppet Overlay',
    icon: ICON, autoHideMenuBar: true, backgroundColor: '#17151c',
  });
  panelWin.loadURL(`${base()}/panel.html`);
  panelWin.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(base())) { openCreator(url); return { action: 'deny' }; }
    shell.openExternal(url); return { action: 'deny' };
  });
  panelWin.on('close', (e) => { if (!quitting) { e.preventDefault(); panelWin.hide(); } });
}

function openCreator(url) {
  const target = url || `${base()}/creator.html`;
  if (creatorWin && !creatorWin.isDestroyed()) { creatorWin.loadURL(target); creatorWin.show(); creatorWin.focus(); return; }
  creatorWin = new BrowserWindow({ width: 1180, height: 800, title: 'Créateur d’avatar', icon: ICON, autoHideMenuBar: true, backgroundColor: '#17151c' });
  creatorWin.loadURL(target);
  creatorWin.webContents.setWindowOpenHandler(({ url: u }) => { shell.openExternal(u); return { action: 'deny' }; });
}

// ---------- Tray ----------
function updateTray() {
  if (!tray) return;
  const d = rpc ? rpc.snapshot() : { status: '—' };
  const ov = store.settings.overlay.enabled;
  tray.setToolTip(`Puppet Overlay — Discord : ${d.status}${d.channel ? ' · ' + d.channel.name : ''}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Discord : ${d.status}${d.channel ? ' · ' + d.channel.name : ''}`, enabled: false },
    { type: 'separator' },
    { label: 'Ouvrir le panneau', click: openPanel },
    { label: 'Créateur d’avatar', click: () => openCreator() },
    { label: ov ? 'Masquer l’overlay' : 'Afficher l’overlay', click: () => applySettings({ overlay: { enabled: !ov } }) },
    { label: 'Reconnecter Discord', click: () => rpc && rpc.restart() },
    { type: 'separator' },
    { label: 'Quitter', click: () => { quitting = true; app.quit(); } },
  ]));
}

function applySettings(patch) {
  const before = JSON.stringify(store.settings);
  const prev = JSON.parse(before);
  store.updateSettings(patch);
  const s = store.settings;
  if (JSON.stringify(prev.discord) !== JSON.stringify(s.discord)) startDiscord();
  if (prev.overlay.display !== s.overlay.display || prev.twitch.showOnDesktop !== s.twitch.showOnDesktop) rebuildOverlay();
  else if (overlayWin && !overlayWin.isDestroyed()) s.overlay.enabled ? overlayWin.showInactive() : overlayWin.hide();
  if (JSON.stringify(prev.sync) !== JSON.stringify(s.sync)) scheduleSync();
  srv.broadcast('state', srv.fullState());
  updateTray();
}

// ---------- Boot ----------
app.on('second-instance', openPanel);
app.on('window-all-closed', (e) => e.preventDefault && e.preventDefault()); // keep running in tray
app.on('before-quit', () => { quitting = true; if (rpc) rpc.stop(); });

app.whenReady().then(async () => {
  app.setAppUserModelId('com.puppetoverlay.app');
  store = new Store(app.getPath('userData'), bundled);
  srv = createServer({
    webDir: WEB_DIR, store,
    getDiscord: () => (rpc ? rpc.snapshot() : { status: 'démarrage', members: [] }),
    onSettings: applySettings,
    onReconnect: () => { store.data.token = null; store.save(); startDiscord(); },
    onOpenCreator: (id) => openCreator(`${base()}/creator.html${id ? '?id=' + encodeURIComponent(id) : ''}`),
  });
  port = store.settings.port || 47800;
  await new Promise((resolve) => {
    srv.server.once('error', () => { port += 1; srv.server.listen(port, '127.0.0.1', resolve); });
    srv.server.listen(port, '127.0.0.1', resolve);
  });

  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.on('click', openPanel);
  startDiscord();
  createOverlay();
  scheduleSync();
  updateTray();
  // First launch or missing config: show the panel straight away.
  if (!store.settings.discord.clientId || !app.getLoginItemSettings().wasOpenedAtLogin) openPanel();
  screen.on('display-removed', rebuildOverlay);
  screen.on('display-metrics-changed', rebuildOverlay);
});
