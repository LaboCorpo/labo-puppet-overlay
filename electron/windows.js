/*
 * App windows: the transparent overlay (+ placement mode), the settings panel and the avatar creator.
 * Every window loads pages from the local server; there is no preload and no Electron IPC.
 */
const { BrowserWindow, screen, shell, Notification } = require('electron');

/** ctx: { store, log, base(), icon, t, isQuitting(), onChange() } */
function createWindows(ctx) {
  const { store, log, t } = ctx;
  let overlayWin = null, panelWin = null, creatorWin = null;
  let placement = false;
  let startMinimized = false;
  let rebuildTimer = null;

  const alive = (w) => w && !w.isDestroyed();
  const overlayScene = () => (store.settings.twitch.showOnDesktop ? 'all' : 'discord');

  // ---------- Overlay ----------
  function createOverlay() {
    const disp = screen.getAllDisplays()[store.settings.overlay.display] || screen.getPrimaryDisplay();
    const b = disp.workArea;
    overlayWin = new BrowserWindow({
      x: b.x, y: b.y, width: b.width, height: b.height,
      transparent: true, frame: false, resizable: false, movable: false, focusable: false,
      skipTaskbar: true, hasShadow: false, alwaysOnTop: true, backgroundColor: '#00000000', show: false,
      // Not throttled: the overlay must keep animating while other apps have focus.
      webPreferences: { backgroundThrottling: false },
    });
    overlayWin.setAlwaysOnTop(true, 'screen-saver');
    // forward: the page still receives mouse moves while clicks pass through (hover fade).
    overlayWin.setIgnoreMouseEvents(true, { forward: true });
    overlayWin.setVisibleOnAllWorkspaces(true);
    overlayWin.loadURL(`${ctx.base()}/overlay.html?scene=${overlayScene()}&host=desktop`);
    overlayWin.once('ready-to-show', updateOverlayVisibility);
    // Crash recovery: a dead renderer is rebuilt instead of leaving an invisible overlay.
    overlayWin.webContents.on('render-process-gone', (e, d) => { log.error('[overlay] renderer gone: ' + d.reason); rebuildOverlay(1000); });
    overlayWin.on('unresponsive', () => { log.warn('[overlay] unresponsive, reloading'); if (alive(overlayWin)) overlayWin.webContents.reload(); });
    if (placement) applyPlacement();
  }

  function rebuildOverlay(delay) {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      if (alive(overlayWin)) overlayWin.destroy();
      createOverlay();
    }, typeof delay === 'number' ? delay : 300);
  }

  function updateOverlayVisibility() {
    if (!alive(overlayWin)) return;
    if (store.settings.overlay.enabled || placement) { if (!overlayWin.isVisible()) overlayWin.showInactive(); }
    else if (overlayWin.isVisible()) overlayWin.hide();
  }

  function applyPlacement() {
    if (!alive(overlayWin)) return;
    if (placement) overlayWin.setIgnoreMouseEvents(false); else overlayWin.setIgnoreMouseEvents(true, { forward: true });
    overlayWin.setFocusable(placement);
    updateOverlayVisibility();
    if (placement) overlayWin.focus();
  }

  function setPlacement(on) {
    placement = !!on;
    applyPlacement();
    ctx.onChange();
  }

  // ---------- Panel ----------
  function openPanel(opts) {
    if (alive(panelWin)) {
      if (panelWin.isMinimized()) panelWin.restore();
      panelWin.show(); panelWin.focus();
      return;
    }
    startMinimized = !!(opts && opts.minimized);
    panelWin = new BrowserWindow({
      width: 1080, height: 780, minWidth: 820, minHeight: 600, title: 'Puppet Overlay',
      icon: ctx.icon, autoHideMenuBar: true, backgroundColor: '#17151c', show: false,
    });
    panelWin.loadURL(`${ctx.base()}/panel.html`);
    panelWin.once('ready-to-show', () => {
      if (startMinimized) { startMinimized = false; panelWin.showInactive(); panelWin.minimize(); } else panelWin.show();
      ctx.onChange();
    });
    panelWin.on('show', ctx.onPanelShown);
    panelWin.on('restore', ctx.onPanelShown);
    panelWin.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith(ctx.base())) openCreator(url);
      else if (/^https:\/\//.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    panelWin.on('close', (e) => {
      if (ctx.isQuitting()) return;
      const action = store.settings.app.closeAction || 'minimize';
      // 'quit' closes everything (window close from the taskbar or the X button exits the app).
      if (action === 'quit') { ctx.quit(); return; }
      e.preventDefault();
      // 'minimize' keeps the app's button in the taskbar; 'tray' hides it, the tray icon remains.
      if (action === 'minimize') panelWin.minimize(); else panelWin.hide();
      if (!store.settings.app.firstRunDone) {
        store.updateSettings({ app: { firstRunDone: true } });
        if (Notification.isSupported()) {
          const body = action === 'minimize' ? 'It stays in your taskbar and system tray. Right-click the tray icon to quit.' : 'It lives in the system tray. Right-click the icon to quit.';
          new Notification({ title: t('Puppet Overlay is still running'), body: t(body), icon: ctx.icon }).show();
        }
      }
    });
  }

  // Taskbar icon turned off while minimized: hide instead, the tray icon remains.
  function hidePanelIfMinimized() { if (alive(panelWin) && panelWin.isMinimized()) panelWin.hide(); }

  // ---------- Creator ----------
  function openCreator(url) {
    const target = url || `${ctx.base()}/creator.html`;
    if (alive(creatorWin)) { creatorWin.loadURL(target); creatorWin.show(); creatorWin.focus(); return; }
    creatorWin = new BrowserWindow({ width: 1200, height: 820, minWidth: 760, minHeight: 600, title: t('Avatar Creator'), icon: ctx.icon, autoHideMenuBar: true, backgroundColor: '#17151c', show: false });
    creatorWin.loadURL(target);
    creatorWin.once('ready-to-show', () => creatorWin.show());
    creatorWin.webContents.setWindowOpenHandler(({ url: u }) => { if (/^https:\/\//.test(u)) shell.openExternal(u); return { action: 'deny' }; });
  }

  return {
    createOverlay, rebuildOverlay, updateOverlayVisibility, setPlacement, openPanel, openCreator, hidePanelIfMinimized,
    get placement() { return placement; },
    get panel() { return alive(panelWin) ? panelWin : null; },
  };
}

module.exports = { createWindows };
