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
    const tabOn = store.settings.app.tabs.puppet !== false; // Puppet Overlay tab removed at setup: no desktop overlay
    if ((store.settings.overlay.enabled && tabOn) || placement) { if (!overlayWin.isVisible()) overlayWin.showInactive(); }
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

  // BabaDeck shortcut strip: an info-only, click-through bar showing the shortcuts and their state (muted mic…).
  // "Move" mode makes it draggable for a moment; its position is saved when it stops moving.
  let hudWin = null, hudPlacing = false, hudSave = null;
  function hudBounds() {
    const h = store.settings.deck.hud;
    const prim = screen.getPrimaryDisplay().workArea;
    let x = h.x < 0 ? Math.round(prim.x + (prim.width - h.w) / 2) : h.x;
    let y = h.x < 0 ? prim.y + Math.max(0, h.y) : h.y;
    // Lost on a display that is gone: back to the top of the main screen.
    const on = screen.getAllDisplays().some((d) => x + 40 > d.bounds.x && x < d.bounds.x + d.bounds.width && y + 20 > d.bounds.y && y < d.bounds.y + d.bounds.height);
    if (!on) { x = Math.round(prim.x + (prim.width - h.w) / 2); y = prim.y + 8; }
    return { x, y, width: h.w, height: h.h };
  }
  function syncDeckHud() {
    const h = store.settings.deck.hud;
    if (!h.enabled || store.settings.app.tabs.deck === false) {
      if (alive(hudWin)) hudWin.destroy();
      hudWin = null; hudPlacing = false;
      return;
    }
    if (!alive(hudWin)) {
      hudWin = new BrowserWindow(Object.assign(hudBounds(), {
        transparent: true, frame: false, resizable: false, movable: false, focusable: false, skipTaskbar: true, hasShadow: false,
        alwaysOnTop: true, backgroundColor: '#00000000', show: false, title: 'BabaDeck HUD', webPreferences: { backgroundThrottling: false },
      }));
      hudWin.setAlwaysOnTop(true, 'screen-saver');
      hudWin.setIgnoreMouseEvents(true);
      hudWin.setVisibleOnAllWorkspaces(true);
      hudWin.loadURL(`${ctx.base()}/deck-hud.html`);
      hudWin.once('ready-to-show', () => alive(hudWin) && hudWin.showInactive());
      hudWin.on('moved', () => {
        if (!hudPlacing || !alive(hudWin)) return;
        clearTimeout(hudSave);
        hudSave = setTimeout(() => { if (!alive(hudWin)) return; const b = hudWin.getBounds(); ctx.saveHud({ x: Math.max(0, b.x), y: b.y }); }, 300);
      });
      hudWin.webContents.on('render-process-gone', () => { hudWin = null; setTimeout(syncDeckHud, 1000); });
    } else if (!hudPlacing) {
      const b = hudBounds(), cur = hudWin.getBounds();
      if (b.x !== cur.x || b.y !== cur.y || b.width !== cur.width || b.height !== cur.height) hudWin.setBounds(b);
    } else {
      const cur = hudWin.getBounds();
      if (cur.width !== h.w || cur.height !== h.h) hudWin.setBounds({ x: cur.x, y: cur.y, width: h.w, height: h.h });
    }
  }
  function setHudPlacing(on) {
    hudPlacing = !!on && alive(hudWin);
    if (!alive(hudWin)) return;
    hudWin.setIgnoreMouseEvents(!hudPlacing);
    hudWin.setFocusable(hudPlacing);
    hudWin.setMovable(hudPlacing);
    if (hudPlacing) hudWin.focus();
    ctx.onChange();
  }

  return {
    openDeck, setDeckOnTop, syncDeckHud, setHudPlacing,
    get hudPlacing() { return hudPlacing; },
    createOverlay, rebuildOverlay, updateOverlayVisibility, setPlacement, openPanel, openCreator, hidePanelIfMinimized,
    get placement() { return placement; },
    get panel() { return alive(panelWin) ? panelWin : null; },
  };
}

module.exports = { createWindows };
