/*
 * Windows shell integration: tray icon and menu, taskbar (badge, thumbnail buttons, progress, title),
 * global hotkeys and the login item. Refreshes are coalesced and only touch the OS when something changed.
 */
const path = require('path');
const { app, Tray, Menu, nativeImage, globalShortcut } = require('electron');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const img = (name) => nativeImage.createFromPath(path.join(BUILD_DIR, name));
const prettyAccel = (a) => (a ? a.replace('CommandOrControl', 'Ctrl') : undefined);

/**
 * ctx: { store, t, windows, icon, discord() -> snapshot, update() -> updater state,
 *        actions: { openPanel, openCreator, toggleOverlay, togglePlacement, toggleChatMute, reconnect, replayFx, installUpdate, quit } }
 */
function createDesktop(ctx) {
  const { store, t, windows, actions } = ctx;
  let tray = null;
  let timer = null;
  let trayKey = '', taskbarKey = '', thumbKey = '';
  let hotkeyErrors = {};

  function createTray() {
    tray = new Tray(nativeImage.createFromPath(ctx.icon).resize({ width: 16, height: 16 }));
    tray.on('click', actions.openPanel);
    refreshNow();
  }

  function updateTray(d, up) {
    if (!tray) return;
    const ov = store.settings.overlay.enabled;
    const hk = store.settings.app.hotkeys;
    const placement = windows.placement;
    const offerUpdate = up && (up.status === 'ready' || up.status === 'available');
    const key = JSON.stringify([t('Quit'), d.status, d.channel && d.channel.name, ov, placement, hk, offerUpdate && up.status, offerUpdate && up.latest]);
    if (key === trayKey) return;
    trayKey = key;
    const dLine = t('Discord: {s}', { s: t(d.status) + (d.channel ? ' · ' + (d.channel.name || t('call')) : '') });
    tray.setToolTip(`Puppet Overlay ${app.getVersion()} — ${dLine}`);
    const items = [
      { label: dLine, enabled: false },
      { type: 'separator' },
      { label: t('Open panel'), click: actions.openPanel },
      { label: t('Avatar creator'), click: () => actions.openCreator() },
      { type: 'separator' },
      { label: t('Show overlay'), type: 'checkbox', checked: ov, accelerator: prettyAccel(hk.toggleOverlay), click: actions.toggleOverlay },
      { label: t(placement ? 'Finish placement' : 'Move puppets…'), accelerator: prettyAccel(hk.placement), click: actions.togglePlacement },
      { label: t('Reconnect Discord'), click: actions.reconnect },
    ];
    if (offerUpdate) items.push({ type: 'separator' }, { label: up.status === 'ready' ? t('Restart to update (v{v})', { v: up.latest }) : t('Download v{v}', { v: up.latest }), click: actions.installUpdate });
    items.push({ type: 'separator' }, { label: t('Quit'), click: actions.quit });
    tray.setContextMenu(Menu.buildFromTemplate(items));
  }

  function updateTaskbar(d, up) {
    const win = windows.panel;
    if (!win) return;
    const n = (d.members || []).length;
    const badge = d.channel ? 'live' : /error|refused/.test(d.status) ? 'error' : d.status === 'connected' ? null : 'idle';
    const progress = up && up.status === 'downloading' ? Math.max(0.02, (up.progress || 0) / 100) : -1;
    const title = d.channel ? `Puppet Overlay — ${d.channel.name || t('Call')} (${n})` : 'Puppet Overlay';
    const key = JSON.stringify([title, badge, badge && t(d.status), progress]);
    if (key !== taskbarKey) {
      taskbarKey = key;
      win.setTitle(title);
      if (process.platform === 'win32') {
        win.setOverlayIcon(badge ? img(`badge-${badge}.png`) : null, badge ? t(d.status) : '');
        win.setProgressBar(progress);
      }
    }
    if (process.platform !== 'win32') return;
    const placement = windows.placement;
    const tk = JSON.stringify([placement, t('Replay entrances')]);
    if (tk === thumbKey || !win.isVisible()) return;
    try {
      win.setThumbarButtons([
        { tooltip: t('Show / hide overlay'), icon: img('thumb-eye.png'), click: actions.toggleOverlay },
        { tooltip: t(placement ? 'Finish placement' : 'Move puppets…'), icon: img('thumb-move.png'), click: actions.togglePlacement },
        { tooltip: t('Replay entrances'), icon: img('thumb-fx.png'), click: actions.replayFx },
      ]);
      thumbKey = tk;
    } catch (e) { /* window not ready yet: retried on the next refresh */ }
  }

  function refreshNow() {
    clearTimeout(timer); timer = null;
    const d = ctx.discord();
    const up = ctx.update();
    updateTray(d, up);
    updateTaskbar(d, up);
  }
  // Discord can emit bursts of voice-state events: rebuild the OS menus at most every 150 ms.
  function refresh() { if (!timer) timer = setTimeout(refreshNow, 150); }
  // Thumbnail buttons are dropped by Windows when the window is hidden: force them on show.
  function onPanelShown() { thumbKey = ''; refresh(); }

  // ---------- Hotkeys ----------
  function registerHotkeys() {
    globalShortcut.unregisterAll();
    hotkeyErrors = {};
    const hk = store.settings.app.hotkeys;
    const map = { toggleOverlay: actions.toggleOverlay, placement: actions.togglePlacement, muteChat: actions.toggleChatMute };
    for (const [name, fn] of Object.entries(map)) {
      const acc = hk[name];
      if (!acc) continue;
      try { if (!globalShortcut.register(acc, fn)) hotkeyErrors[name] = 'Already used by another app'; } catch (e) { hotkeyErrors[name] = 'Invalid shortcut'; }
    }
  }

  function applyLoginItem() {
    if (!app.isPackaged) return;
    const exe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath; // portable runs from a temp copy
    app.setLoginItemSettings({ openAtLogin: store.settings.app.launchAtStartup, path: exe, args: ['--hidden'] });
  }

  return { createTray, refresh, onPanelShown, registerHotkeys, applyLoginItem, get hotkeyErrors() { return hotkeyErrors; } };
}

module.exports = { createDesktop };
