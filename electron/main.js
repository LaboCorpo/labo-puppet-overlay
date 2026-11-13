/*
 * Puppet Overlay — Electron main process.
 * Wires the local server, Discord RPC, Twitch chat, avatar sync, updater, windows and shell integration.
 */
const { app, screen, shell, Notification, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { Store } = require('./store');
const { createServer } = require('./server');
const { DiscordVoiceRPC } = require('./discord-rpc');
const { TwitchChat } = require('./twitch');
const { AvatarSync } = require('./sync');
const { Updater } = require('./updater');
const { createWindows } = require('./windows');
const { createDesktop } = require('./desktop');
const { cleanAvatarMap } = require('./avatars');
const { createLogger } = require('./log');
const I18N = require('../web/shared/i18n.js');

const t = I18N.t;

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
// Overlay windows have no user gesture: let them play chat sounds anyway.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const WEB_DIR = path.join(__dirname, '..', 'web');
const ICON = path.join(__dirname, '..', 'build', 'icon.png');
const START_HIDDEN = process.argv.includes('--hidden');

let log, store, srv, rpc, twitch, sync, updater, windows, desktop;
let port;
let quitting = false;

const base = () => `http://127.0.0.1:${port}`;
const syncLang = () => I18N.setLang(I18N.resolve(store.settings.app.language, app.getLocale()));

process.on('uncaughtException', (e) => { if (log) log.error('uncaught: ' + ((e && e.stack) || e)); });
process.on('unhandledRejection', (e) => { if (log) log.error('unhandled rejection: ' + ((e && e.stack) || e)); });

function readBundledConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'app-config.json'), 'utf8')); } catch (e) { return {}; }
}

// ---------- State exposed to pages ----------
function appState() {
  const primary = screen.getPrimaryDisplay().id;
  return {
    discord: rpc ? rpc.snapshot() : { status: 'starting', members: [] },
    known: store.data.known,
    syncStatus: sync ? sync.status : { status: 'off' },
    twitchStatus: twitch ? twitch.snapshot() : { status: 'off' },
    app: {
      version: app.getVersion(), placement: windows ? windows.placement : false, lang: I18N.lang,
      hotkeyErrors: desktop ? desktop.hotkeyErrors : {},
      update: updater ? updater.state : null,
      portable: !!process.env.PORTABLE_EXECUTABLE_FILE,
      displays: screen.getAllDisplays().map((d, i) => ({ index: i, label: `${d.id === primary ? 'Primary — ' : ''}${d.size.width}×${d.size.height}`, primary: d.id === primary })),
    },
  };
}
function push(opts) {
  if (srv) srv.pushState(opts);
  if (desktop) desktop.refresh();
}

// ---------- Discord ----------
function startDiscord() {
  if (rpc) { rpc.removeAllListeners(); rpc.stop(); }
  const d = store.settings.discord;
  rpc = new DiscordVoiceRPC({
    clientId: d.clientId, clientSecret: d.clientSecret, redirectUri: d.redirectUri,
    getToken: () => (store.data.token && store.data.token.clientId === d.clientId ? store.data.token : null),
    saveToken: (tok) => { store.data.token = tok ? Object.assign({ clientId: d.clientId }, tok) : null; store.save(); },
  });
  rpc.on('status', (s, detail) => { log.info(`[discord] ${s}${detail ? ' — ' + detail : ''}`); push(); });
  rpc.on('channel', () => { store.rememberMembers(rpc.snapshot().members); push(); });
  rpc.on('speaking', (id, speaking) => srv.broadcast('speaking', { id, speaking }));
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

// ---------- Settings & actions ----------
const toggleOverlay = () => applySettings({ overlay: { enabled: !store.settings.overlay.enabled } });
const togglePlacement = () => windows.setPlacement(!windows.placement);
const toggleChatMute = () => applySettings({ twitch: { sound: { muted: !store.settings.twitch.sound.muted } } });
const replayFx = () => srv.broadcast('fx-test', {});

function applySettings(patch) {
  const prev = store.settings;
  const s = store.updateSettings(patch);
  const changed = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
  if (changed(prev.discord, s.discord)) startDiscord();
  if (prev.overlay.display !== s.overlay.display || prev.twitch.showOnDesktop !== s.twitch.showOnDesktop) windows.rebuildOverlay();
  else windows.updateOverlayVisibility();
  if (changed(prev.sync, s.sync)) sync.schedule();
  if (changed(prev.twitch, s.twitch)) twitch.sync();
  if (changed(prev.app.hotkeys, s.app.hotkeys)) desktop.registerHotkeys();
  if (prev.app.launchAtStartup !== s.app.launchAtStartup) desktop.applyLoginItem();
  if (prev.app.language !== s.app.language) syncLang();
  if (prev.app.taskbarIcon && !s.app.taskbarIcon) windows.hidePanelIfMinimized();
  push();
}

async function exportConfig() {
  const r = await dialog.showSaveDialog(windows.panel, { defaultPath: 'puppet-overlay-backup.json' });
  if (r.canceled || !r.filePath) return;
  const settings = Object.assign({}, store.settings, { discord: Object.assign({}, store.settings.discord, { clientSecret: '' }) });
  await fs.promises.writeFile(r.filePath, JSON.stringify({ settings, avatars: store.data.avatars }, null, 2));
}

async function onAction(name, b) {
  switch (name) {
    case 'reconnect': store.data.token = null; store.save(); startDiscord(); return;
    case 'open-creator': windows.openCreator(`${base()}/creator.html${/^\d{15,22}$/.test(b.id || '') ? '?id=' + b.id : ''}`); return;
    case 'placement': windows.setPlacement(!!b.on); return;
    case 'update-check': await updater.check(); return;
    case 'update-install': updater.install(); return;
    case 'open-logs': shell.openPath(log.dir); return;
    case 'open-url': if (/^https:\/\/\S+$/.test(b.url || '')) shell.openExternal(b.url); return;
    case 'twitch-test': twitch.simulate(String(b.kind || 'chat')); return;
    case 'fx-test': replayFx(); return;
    case 'sync-now': await sync.now(); return;
    case 'forget-member': store.forgetMember(String(b.id || '')); push(); return;
    case 'clear-viewers': store.clearViewers(); srv.broadcast('viewers-reset', {}); push(); return;
    case 'export-config': await exportConfig(); return;
    default: throw new Error('Unknown action');
  }
}

// ---------- Boot ----------
function listen(first) {
  port = first;
  return new Promise((resolve, reject) => {
    let tries = 0;
    srv.server.on('error', (e) => {
      if (e.code === 'EADDRINUSE' && tries++ < 10) { port += 1; srv.server.listen(port, '127.0.0.1'); } else reject(e);
    });
    srv.server.once('listening', resolve);
    srv.server.listen(port, '127.0.0.1');
  });
}

app.on('second-instance', () => windows && windows.openPanel());
app.on('window-all-closed', () => { /* keep running in the tray */ });
app.on('before-quit', () => {
  quitting = true;
  if (rpc) rpc.stop();
  if (twitch) twitch.close();
  if (sync) sync.stop();
  if (srv) srv.close();
  if (store) store.flush();
});
app.on('will-quit', () => globalShortcut.unregisterAll());

app.whenReady().then(async () => {
  app.setAppUserModelId('com.puppetoverlay.app');
  log = createLogger(path.join(app.getPath('userData'), 'logs'));
  log.info(`Puppet Overlay ${app.getVersion()} starting${START_HIDDEN ? ' (hidden)' : ''}`);
  store = new Store(app.getPath('userData'), readBundledConfig(), log);
  store.data.avatars = cleanAvatarMap(store.data.avatars);
  store.data.syncedAvatars = cleanAvatarMap(store.data.syncedAvatars);
  syncLang();

  srv = createServer({ webDir: WEB_DIR, store, getState: appState, onSettings: applySettings, onAction, onAvatarsChanged: () => push({ avatars: true }) });
  try { await listen(store.settings.port); } catch (e) {
    dialog.showErrorBox('Puppet Overlay', 'Could not start the local server: ' + e.message);
    app.exit(1);
    return;
  }
  log.info('server on ' + base());

  updater = new Updater(log);
  updater.on('change', (st) => {
    push();
    if (st.status === 'ready' && Notification.isSupported()) new Notification({ title: t('Update ready'), body: t('Puppet Overlay {v} will install when you restart the app.', { v: st.latest }), icon: ICON }).show();
  });

  windows = createWindows({
    store, log, t, icon: ICON, base,
    isQuitting: () => quitting,
    onChange: push,
    onPanelShown: () => desktop.onPanelShown(),
  });
  desktop = createDesktop({
    store, t, windows, icon: ICON,
    discord: () => (rpc ? rpc.snapshot() : { status: 'starting', members: [] }),
    update: () => updater.state,
    actions: {
      openPanel: () => windows.openPanel(), openCreator: (u) => windows.openCreator(u),
      toggleOverlay, togglePlacement, toggleChatMute, replayFx,
      reconnect: () => rpc && rpc.restart(),
      installUpdate: () => updater.install(),
      quit: () => { quitting = true; app.quit(); },
    },
  });
  sync = new AvatarSync({
    getSettings: () => store.settings.sync,
    onAvatars: (map) => { store.setSyncedAvatars(map); push({ avatars: true }); },
    log,
  });
  sync.on('status', () => push());

  desktop.createTray();
  startDiscord();
  startTwitch();
  windows.createOverlay();
  sync.schedule();
  desktop.registerHotkeys();
  desktop.applyLoginItem();
  updater.start(4, () => store.settings.app.autoUpdate);
  if (!START_HIDDEN) windows.openPanel();
  else if (store.settings.app.taskbarIcon) windows.openPanel({ minimized: true }); // hidden start still gets its taskbar button
  for (const ev of ['display-removed', 'display-added', 'display-metrics-changed']) screen.on(ev, () => windows.rebuildOverlay());
  push();
});
