/*
 * BabaDeck view: the grid of buttons of one page, with live state (OBS scene, mute, live, recording…).
 * Used by deck.html (floating window) and by the panel (BabaDeck page: click = run, right-click / ✏ = edit,
 * drag a button onto another slot = swap). DeckView.isOn / DeckView.stateIcon are also used by deck-hud.html.
 */
(function (global) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pretty = (acc) => String(acc || '').replace('CommandOrControl', 'Ctrl').replace(/num(\d)/g, 'Num $1').replace(/numadd/g, 'Num +').replace(/numsub/g, 'Num −');

  // Is the button "on"? Decided by its first action.
  function isOn(b, st) {
    const a = b && b.actions && b.actions[0];
    const obs = st.obs || {}, s = st.settings || {};
    if (!a) return false;
    switch (a.type) {
      case 'obs.scene': return obs.current === a.scene;
      case 'obs.mute': return !!(obs.muted || {})[a.input];
      case 'obs.stream': return !!obs.streaming;
      case 'obs.record': return !!obs.recording;
      case 'app.overlay': return !!(s.overlay && s.overlay.enabled);
      case 'app.muteChat': return !!(s.twitch && s.twitch.sound && s.twitch.sound.muted);
      default: return false;
    }
  }
  const ON_STYLE = { 'obs.mute': 'danger', 'obs.stream': 'live', 'obs.record': 'live', 'app.muteChat': 'danger' };
  // Icon that tells the state at a glance (muted mic, live…), else the button's own icon.
  function stateIcon(b, on) {
    const a = b.actions && b.actions[0];
    if (!a) return b.icon || '';
    if (a.type === 'obs.mute') return on ? '🔇' : '🎙';
    if (a.type === 'app.muteChat') return on ? '🔇' : '🔊';
    if (a.type === 'obs.stream') return on ? '🔴' : (b.icon || '⚫');
    if (a.type === 'obs.record') return on ? '⏺' : (b.icon || '⏹');
    return b.icon || '';
  }

  function DeckView(el, opts) {
    opts = opts || {};
    let page = 0, st = {}, key = '';
    function render(force) {
      const d = (st.settings && st.settings.deck) || { cols: 5, rows: 3, pages: [{ name: '', buttons: [] }] };
      if (page >= d.pages.length) page = 0;
      const p = d.pages[page];
      const cells = [];
      for (let i = 0; i < d.cols * d.rows; i++) {
        const b = p.buttons[i];
        const on = b && isOn(b, st);
        const a0 = b && b.actions[0];
        cells.push(b ? `<button class="dk-btn${on ? ' on dk-' + (ON_STYLE[a0.type] || 'active') : ''}${opts.selected === i ? ' sel' : ''}" data-i="${i}" style="--bc:${esc(b.color)};--fg:${esc(b.fg)}"${opts.editable ? ' draggable="true"' : ''}>
            <span class="dk-ic">${esc(stateIcon(b, on))}</span><span class="dk-lb">${esc(b.label || '')}</span>${b.hotkey ? `<span class="dk-hk">${esc(pretty(b.hotkey))}</span>` : ''}${opts.editable ? '<span class="dk-pen" title="✏">✏</span>' : ''}</button>`
          : `<button class="dk-btn empty${opts.selected === i ? ' sel' : ''}" data-i="${i}">${opts.editable ? '＋' : ''}</button>`);
      }
      const k = JSON.stringify([d.cols, d.rows, page, cells, d.pages.map((x) => x.name), opts.selected]);
      if (!force && k === key) return;
      key = k;
      el.innerHTML = `${d.pages.length > 1 || opts.editable ? `<div class="dk-pages">${d.pages.map((x, i) => `<button class="dk-page${i === page ? ' on' : ''}" data-page="${i}">${esc(x.name)}</button>`).join('')}${opts.pageTools || ''}</div>` : ''}
        <div class="dk-grid" style="grid-template-columns:repeat(${d.cols},1fr)">${cells.join('')}</div>`;
    }
    el.addEventListener('click', (e) => {
      const pg = e.target.closest('[data-page]');
      if (pg) { page = +pg.dataset.page; if (opts.onPage) opts.onPage(page); render(true); return; }
      const b = e.target.closest('.dk-btn');
      if (!b) return;
      const i = +b.dataset.i;
      if (e.target.closest('.dk-pen') && opts.onContext) { opts.onContext(page, i, b, e); return; }
      if (opts.onClick) opts.onClick(page, i, b);
    });
    el.addEventListener('contextmenu', (e) => {
      const b = e.target.closest('.dk-btn');
      if (!b || !opts.onContext) return;
      e.preventDefault();
      opts.onContext(page, +b.dataset.i, b, e);
    });
    // Drag a button onto another slot: the two swap.
    let from = -1;
    el.addEventListener('dragstart', (e) => { const b = e.target.closest('.dk-btn'); if (!b || !opts.onSwap) return; from = +b.dataset.i; e.dataTransfer.effectAllowed = 'move'; b.classList.add('dragging'); });
    el.addEventListener('dragend', () => { from = -1; el.querySelectorAll('.dragging, .drop').forEach((x) => x.classList.remove('dragging', 'drop')); });
    el.addEventListener('dragover', (e) => { const b = e.target.closest('.dk-btn'); if (from < 0 || !b) return; e.preventDefault(); el.querySelectorAll('.drop').forEach((x) => x !== b && x.classList.remove('drop')); b.classList.add('drop'); });
    el.addEventListener('drop', (e) => { const b = e.target.closest('.dk-btn'); if (from < 0 || !b) return; e.preventDefault(); const to = +b.dataset.i; if (to !== from) opts.onSwap(page, from, to); from = -1; });
    return {
      setState(next) { st = Object.assign({}, st, next); render(); },
      render,
      get page() { return page; }, set page(v) { page = v; render(true); },
      select(i) { opts.selected = i; render(true); },
    };
  }
  DeckView.isOn = isOn;
  DeckView.stateIcon = stateIcon;
  DeckView.ON_STYLE = ON_STYLE;
  DeckView.pretty = pretty;
  global.DeckView = DeckView;
})(window);
