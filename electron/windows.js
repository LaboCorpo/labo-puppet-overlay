/*
 * App windows: the transparent overlay (+ placement mode), the settings panel and the avatar creator.
 * Every window loads pages from the local server; there is no preload and no Electron IPC.
 */
const { BrowserWindow, screen, shell } = require('electron');

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
      width: 1080, height: 780, minWidth: 820, minHeight: 600, title: 'LaboHub',
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
        const body = action === 'minimize' ? 'It stays in your taskbar and system tray. Right-click the tray icon to quit.' : 'It lives in the system tray. Right-click the icon to quit.';
        ctx.notify(t('LaboHub is still running'), t(body));
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

  // BabaDeck as a small window you can keep next to your game (always on top if chosen).
  let deckWin = null;
  function openDeck() {
    if (alive(deckWin)) { deckWin.show(); deckWin.focus(); return; }
    deckWin = new BrowserWindow({ width: 560, height: 380, minWidth: 260, minHeight: 180, title: 'BabaDeck', icon: ctx.icon, autoHideMenuBar: true, backgroundColor: '#120f17', alwaysOnTop: !!store.settings.deck.onTop, show: false });
    deckWin.loadURL(`${ctx.base()}/deck.html?window=1`);
    deckWin.once('ready-to-show', () => deckWin.show());
    deckWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  }
  function setDeckOnTop(on) { if (alive(deckWin)) deckWin.setAlwaysOnTop(!!on); }

  // La savane: the room window (camera + microphone through VDO.Ninja).
  let savaneWin = null;
  function openSavane() {
    if (alive(savaneWin)) { savaneWin.show(); savaneWin.focus(); return; }
    savaneWin = new BrowserWindow({ width: 1400, height: 860, minWidth: 760, minHeight: 420, title: 'La savane', icon: ctx.icon, autoHideMenuBar: true, backgroundColor: '#14110a', show: false });
    savaneWin.loadURL(`${ctx.base()}/savane.html?room=1`);
    savaneWin.once('ready-to-show', () => savaneWin.show());
    savaneWin.webContents.setWindowOpenHandler(({ url: u }) => { if (/^https:\/\//.test(u)) shell.openExternal(u); return { action: 'deny' }; });
    // VDO.Ninja asks "leave the page?" through beforeunload; Electron has no dialog for it, so the close was silently cancelled.
    savaneWin.webContents.on('will-prevent-unload', (e) => e.preventDefault());
  }

  return {
    openDeck, setDeckOnTop, openSavane,
    createOverlay, rebuildOverlay, updateOverlayVisibility, setPlacement, openPanel, openCreator, hidePanelIfMinimized,
    get placement() { return placement; },
    get panel() { return alive(panelWin) ? panelWin : null; },
  };
}

module.exports = { createWindows };
