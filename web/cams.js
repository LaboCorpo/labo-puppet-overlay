/*
 * Friends' cams (Widget Twitch): each friend gets a VDO.Ninja link that sends their camera; their video is shown here,
 * for OBS (free service, peer to peer; settings.savane, friends in settings.savane.friends):
 *  - cams.html?scene=1        every friend ticked "in the scene", laid out (grid, spotlight, free…) with the background
 *  - cams.html?cam=ID         one friend alone, with the shape and frame (&raw=1: the video only)
 *  - &preview=1               panel preview fed by postMessage: placeholders (&live=1: the real videos), &edit=1: drag/resize
 * Who speaks: each video frame reports its loudness (VDO.Ninja iframe API).
 */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const MODE = q.get('cam') ? 'cam' : 'scene';
  const PREVIEW = q.get('preview') === '1' && window.parent !== window;
  const LIVE = !PREVIEW || q.get('live') === '1';
  const EDIT = PREVIEW && q.get('edit') === '1';
  const CAM = q.get('cam') || '';
  const RAW = q.get('raw') === '1';
  const VDO = 'https://vdo.ninja/', VDO_ORIGIN = 'https://vdo.ninja';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const t = (s, v) => (window.I18N ? I18N.t(s, v) : s);
  const $ = (s) => document.querySelector(s);
  const stage = $('#stage'), tilesEl = $('#tiles');
  let st = {}, cfg = null, speaking = {}, lastKey = '';
  if (EDIT) document.body.classList.add('edit');

  // The view link of a friend's camera (the password must match the one in their link).
  const viewUrl = (id, audio) => `${VDO}?view=${encodeURIComponent(id)}${cfg.password ? '&password=' + encodeURIComponent(cfg.password) : ''}&cleanoutput&cover&transparent${audio ? '' : '&noaudio'}`;

  // ---------- Layout ----------
  function rects(n, W, H, c) {
    if (!n) return [];
    const top = c.title ? Math.round(H * 0.11) : 0;
    const x0 = c.padding, y0 = c.padding + top, w = W - 2 * c.padding, h = H - 2 * c.padding - top, g = c.gap;
    const AR = ['circle', 'hexagon', 'blob'].includes(c.shape) ? 1 : 16 / 9;
    const fit = (bw, bh) => (bw / bh > AR ? [bh * AR, bh] : [bw, bw / AR]);
    const out = [];
    const row = (items, x, y, bw, bh) => {
      const k = items.length, [tw, th] = fit((bw - (k - 1) * g) / k, bh), total = k * tw + (k - 1) * g;
      items.forEach((i, j) => { out[i] = { x: x + (bw - total) / 2 + j * (tw + g), y: y + (bh - th) / 2, w: tw, h: th }; });
    };
    const col = (items, x, y, bw, bh) => {
      const k = items.length, [tw, th] = fit(bw, (bh - (k - 1) * g) / k), total = k * th + (k - 1) * g;
      items.forEach((i, j) => { out[i] = { x: x + (bw - tw) / 2, y: y + (bh - total) / 2 + j * (th + g), w: tw, h: th }; });
    };
    const idx = [...Array(n).keys()];
    if (c.layout === 'podcast' || n === 1) { row(idx, x0, y0, w, h); return out; }
    if (c.layout === 'stack') { col(idx, x0, y0, w, h); return out; }
    if (c.layout === 'spotlight') { const bh = (h - g) * 0.74; row([0], x0, y0, w, bh); row(idx.slice(1), x0, y0 + bh + g, w, h - bh - g); return out; }
    if (c.layout === 'side') { const bw = (w - g) * 0.74; row([0], x0, y0, bw, h); col(idx.slice(1), x0 + bw + g, y0, w - bw - g, h); return out; }
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const [tw] = fit((w - (cols - 1) * g) / cols, (h - (rows - 1) * g) / rows);
      if (!best || tw > best.tw) best = { cols, rows, tw };
    }
    const { cols, rows } = best;
    const [, th] = fit((w - (cols - 1) * g) / cols, (h - (rows - 1) * g) / rows);
    const totalH = rows * th + (rows - 1) * g;
    for (let r = 0; r < rows; r++) row(idx.slice(r * cols, r * cols + cols), x0, y0 + (h - totalH) / 2 + r * (th + g), w, th);
    return out;
  }
  // Free layout: saved positions (ratios of the scene) win; cameras never placed take their grid spot.
  function placed(list, W, H, c) {
    const auto = rects(list.length, W, H, c);
    if (c.layout !== 'free') return auto.map((r) => Object.assign({ z: 1 }, r));
    const pos = c.positions || [];
    return list.map((p, i) => {
      const k = pos.findIndex((x) => x.id === p.id);
      if (k < 0) return Object.assign({ z: 1 }, auto[i]);
      const x = pos[k];
      return { x: x.x * W, y: x.y * H, w: x.w * W, h: x.h * H, z: 2 + k };
    });
  }

  // ---------- Rendering ----------
  function bgCss(c) {
    if (c.bg === 'none' || MODE === 'cam') return 'transparent';
    if (c.bg === 'color') return c.bgColor1;
    if (c.bg === 'image' && c.bgImage) return `center / cover no-repeat url("${c.bgImage}"), ${c.bgColor1}`;
    if (c.bg === 'radial') return `radial-gradient(circle at 50% 38%, ${c.bgColor1}, ${c.bgColor2} 75%)`;
    return `linear-gradient(${c.bgAngle}deg, ${c.bgColor1}, ${c.bgColor2}, ${c.bgColor1})`;
  }
  function people() {
    const fr = (cfg.friends || []).filter((f) => f.on || MODE === 'cam');
    if (PREVIEW && !fr.length) return ['Civibrr', 'trkzlive', 'Pixelcat'].map((n, i) => ({ id: 'demo' + i, name: n, demo: true }));
    return fr.map((f) => Object.assign({}, f, { demo: !LIVE }));
  }
  let K = 1, curList = [], curRects = [];
  function render() {
    if (!cfg) return;
    const c = cfg;
    const W = MODE === 'cam' ? innerWidth : c.width, H = MODE === 'cam' ? innerHeight : c.height;
    stage.style.width = W + 'px'; stage.style.height = H + 'px';
    fit(W, H);
    const bg = $('#bg');
    bg.style.background = bgCss(c);
    bg.style.backgroundSize = c.bg === 'gradient' ? '300% 300%' : '';
    bg.className = 'bg' + (c.bg === 'gradient' && c.bgAnimate ? ' anim' : '');
    bg.style.filter = c.bg === 'image' && c.bgBlur ? `blur(${c.bgBlur}px)` : '';
    $('#dim').style.opacity = c.bg === 'image' && MODE !== 'cam' ? c.bgDim / 100 : 0;
    const title = $('#title');
    title.textContent = MODE === 'cam' ? '' : c.title || '';
    title.style.color = c.titleColor;
    title.style.fontSize = Math.round(H * 0.055) + 'px';
    const logo = $('#logo');
    if (c.logo && MODE !== 'cam') {
      if (logo.getAttribute('src') !== c.logo) logo.src = c.logo;
      const m = Math.max(16, Math.round(c.padding / 2));
      Object.assign(logo.style, { display: 'block', width: c.logoSize + 'px', left: c.logoPos[1] === 'l' ? m + 'px' : '', right: c.logoPos[1] === 'r' ? m + 'px' : '', top: c.logoPos[0] === 't' ? m + 'px' : '', bottom: c.logoPos[0] === 'b' ? m + 'px' : '' });
    } else logo.style.display = 'none';

    let list = people();
    if (MODE === 'cam') { const f = list.find((p) => p.id === CAM); list = f ? [f] : [{ id: CAM, name: '' }]; }
    const bw = RAW ? 0 : c.border;
    const R = MODE === 'cam' ? [{ x: RAW ? 0 : bw + 8, y: RAW ? 0 : bw + 8, w: W - 2 * (RAW ? 0 : bw + 8), h: H - 2 * (RAW ? 0 : bw + 8), z: 1 }] : placed(list, W, H, c);
    curList = list; curRects = R;
    const key = JSON.stringify([list.map((p) => [p.id, p.demo]), c.password, c.audioInObs]);
    if (key !== lastKey) {
      lastKey = key;
      const keep = new Map([...tilesEl.children].map((el) => [el.dataset.k, el]));
      tilesEl.innerHTML = '';
      list.forEach((p) => {
        const k = p.id + (p.demo ? ':demo' : '');
        let el = keep.get(k);
        if (!el) {
          el = document.createElement('div');
          el.className = 'tile';
          el.dataset.id = p.id; el.dataset.k = k;
          const audio = c.audioInObs && !PREVIEW;
          el.innerHTML = (p.demo ? `<div class="vid demo"><span>${esc((p.name || '?').charAt(0))}</span></div>` : `<div class="vid"><iframe src="${esc(viewUrl(p.id, audio))}" allow="autoplay; fullscreen"></iframe></div>`)
            + '<div class="name"></div>' + (EDIT ? '<div class="grab"></div><div class="rs"></div>' : '');
        }
        tilesEl.appendChild(el);
      });
    }
    [...tilesEl.children].forEach((el, i) => {
      const r = R[i], p = list[i];
      if (!r || !p) return;
      if (!el.classList.contains('dragging')) Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', zIndex: r.z || 1 });
      for (const [k, v] of [['--bw', bw + 'px'], ['--bc', RAW ? 'transparent' : c.borderColor], ['--rad', c.radius + 'px'], ['--nbg', c.nameBg], ['--nfg', c.nameFg]]) el.style.setProperty(k, v);
      el.className = `tile s-${RAW ? 'rect' : c.shape}${c.glow && !RAW ? ' glow' : ''}${c.speaking && speaking[p.id] ? ' speaking' : ''}${el.classList.contains('dragging') ? ' dragging' : ''}`;
      const nm = el.querySelector('.name');
      nm.textContent = p.name || '';
      nm.style.display = c.names && !RAW && p.name ? '' : 'none';
      nm.style.fontSize = Math.max(14, Math.round(Math.min(r.w, r.h) * 0.075)) + 'px';
      const rs = el.querySelector('.rs');
      if (rs) rs.style.transform = `scale(${1 / K})`;
    });
    const empty = $('#empty');
    empty.style.display = list.length ? 'none' : '';
    empty.style.fontSize = Math.max(14, Math.round(H * 0.028)) + 'px';
    empty.textContent = PREVIEW ? t('Tick “in the scene” next to a friend to show their camera here.') : '';
  }
  // Scales the scene into the window (OBS source, or the panel preview), centred in the preview.
  function fit(W, H) {
    const aw = innerWidth, ah = innerHeight;
    const k = Math.min(aw / W, ah / H);
    K = k > 0 ? k : 1;
    const ox = PREVIEW ? Math.round((aw - W * K) / 2) : 0, oy = PREVIEW ? Math.round((ah - H * K) / 2) : 0;
    stage.style.transform = !PREVIEW && Math.abs(K - 1) < 0.001 ? '' : `translate(${ox}px, ${oy}px) scale(${K})`;
  }

  // ---------- Who speaks (VDO.Ninja iframe API: loudness of each video) ----------
  addEventListener('message', (e) => {
    if (e.origin !== VDO_ORIGIN || !e.data || typeof e.data !== 'object' || !cfg || !cfg.speaking) return;
    const d = e.data;
    if (!d.loudness || typeof d.loudness !== 'object') return;
    let ch = false;
    for (const [id, v] of Object.entries(d.loudness)) { const s = Number(v) > 6; if (speaking[id] !== s) { speaking[id] = s; ch = true; } }
    if (ch) render();
  });
  if (LIVE) setInterval(() => {
    if (!cfg || !cfg.speaking) return;
    for (const f of tilesEl.querySelectorAll('iframe')) {
      const n = Number(f.dataset.loud || 0);
      if (n < 3) { try { f.contentWindow.postMessage({ getLoudness: true }, VDO_ORIGIN); f.dataset.loud = n + 1; } catch (e) { /* loading */ } }
    }
  }, 5000);

  // ---------- Panel preview: drag & resize (saves the free layout) ----------
  let drag = null, saveTimer = 0;
  function save(patch) {
    save.at = Date.now();
    Object.assign(cfg, patch);
    render();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ savane: patch }) }).catch(() => {}), 200);
  }
  function snapTo(v, targets, th) { let best = null; for (const t0 of targets) if (Math.abs(v - t0) < th && (best === null || Math.abs(v - t0) < Math.abs(v - best))) best = t0; return best; }
  if (EDIT) {
    tilesEl.addEventListener('pointerdown', (e) => {
      const grab = e.target.closest('.grab, .rs');
      if (!grab) return;
      const el = grab.closest('.tile');
      if (cfg.layout !== 'free') cfg.positions = curList.map((p, i) => ({ id: p.id, x: curRects[i].x / cfg.width, y: curRects[i].y / cfg.height, w: curRects[i].w / cfg.width, h: curRects[i].h / cfg.height }));
      const r = { x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: parseFloat(el.style.width), h: parseFloat(el.style.height) };
      drag = { el, id: el.dataset.id, resize: grab.classList.contains('rs'), sx: e.clientX, sy: e.clientY, r, cur: Object.assign({}, r) };
      el.classList.add('dragging');
      grab.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    tilesEl.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const W = cfg.width, H = cfg.height, pad = cfg.padding, th = 12 / K;
      const dx = (e.clientX - drag.sx) / K, dy = (e.clientY - drag.sy) / K;
      const r = Object.assign({}, drag.r);
      const others = curList.map((p, i) => (p.id === drag.id ? null : curRects[i])).filter(Boolean);
      const xs = [0, pad, W / 2, W - pad, W].concat(...others.map((o) => [o.x, o.x + o.w])), ys = [0, pad, H / 2, H - pad, H].concat(...others.map((o) => [o.y, o.y + o.h]));
      let gx = null, gy = null;
      if (drag.resize) {
        r.w = Math.max(80, Math.min(W - r.x, drag.r.w + dx));
        r.h = e.shiftKey ? Math.max(60, Math.min(H - r.y, drag.r.h + dy)) : r.w * (drag.r.h / drag.r.w);
        if (!e.shiftKey && r.y + r.h > H) { r.h = H - r.y; r.w = r.h * (drag.r.w / drag.r.h); }
      } else {
        r.x = drag.r.x + dx; r.y = drag.r.y + dy;
        for (const [off, isX] of [[0, 1], [r.w / 2, 1], [r.w, 1], [0, 0], [r.h / 2, 0], [r.h, 0]]) {
          if (isX && gx === null) { const s = snapTo(r.x + off, xs, th); if (s !== null) { r.x = s - off; gx = s; } }
          if (!isX && gy === null) { const s = snapTo(r.y + off, ys, th); if (s !== null) { r.y = s - off; gy = s; } }
        }
        r.x = r.w >= W ? (W - r.w) / 2 : Math.max(0, Math.min(W - r.w, r.x));
        r.y = r.h >= H ? (H - r.h) / 2 : Math.max(0, Math.min(H - r.h, r.y));
      }
      drag.cur = r;
      Object.assign(drag.el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', zIndex: 900 });
      $('#gv').style.display = gx === null ? 'none' : 'block'; $('#gv').style.left = gx + 'px';
      $('#gh').style.display = gy === null ? 'none' : 'block'; $('#gh').style.top = gy + 'px';
    });
    const end = () => {
      if (!drag) return;
      const { el, id, cur } = drag;
      drag = null;
      el.classList.remove('dragging');
      $('#gv').style.display = 'none'; $('#gh').style.display = 'none';
      const pos = (cfg.positions || []).filter((x) => x.id !== id);
      pos.push({ id, x: cur.x / cfg.width, y: cur.y / cfg.height, w: cur.w / cfg.width, h: cur.h / cfg.height }); // the moved camera comes to the front
      save({ layout: 'free', positions: pos });
    };
    tilesEl.addEventListener('pointerup', end);
    tilesEl.addEventListener('pointercancel', end);
  }

  // ---------- State ----------
  function apply(next) {
    st = Object.assign({}, st, next);
    if (next.app && next.app.lang && window.I18N) I18N.setLang(next.app.lang);
    if (!st.settings) return;
    if (drag || Date.now() - (save.at || 0) < 600) return; // keep the camera under the mouse
    cfg = Object.assign({}, st.settings.savane);
    render();
  }
  addEventListener('resize', render);
  if (PREVIEW) {
    addEventListener('message', (e) => { if (e.origin === location.origin && e.data && e.data.type === 'po-state') apply(e.data.state); });
    window.parent.postMessage({ type: 'po-widget-ready', w: 'cams' }, location.origin);
  } else {
    const es = new EventSource('/api/events');
    es.addEventListener('state', (e) => apply(JSON.parse(e.data)));
  }
})();
