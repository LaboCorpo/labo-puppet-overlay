/*
 * La savane 🍌 — the Labo's video room, built on VDO.Ninja (free, peer-to-peer, open source):
 *  - savane.html?room=1   the room window: your camera/mic (own device picker, mic muted at start), the scene exactly as
 *                         OBS shows it (drag/resize the cameras, customise everything), and the OBS links
 *  - savane.html?scene=1  the scene for OBS (layout, shapes, background); &preview=1 = panel preview with placeholders
 *  - savane.html?cam=ID   one camera alone for OBS, with its shape and frame (&raw=1: the video only)
 * Who is in the room: the room window listens to VDO.Ninja's iframe events and reports the list to the app,
 * which shares it with the OBS pages. Settings: settings.savane.
 */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const MODE = q.get('room') ? 'room' : q.get('cam') ? 'cam' : 'scene';
  const PREVIEW = q.get('preview') === '1';
  const CAM = q.get('cam') || '';
  const RAW = q.get('raw') === '1';
  const VDO = 'https://vdo.ninja/', VDO_ORIGIN = 'https://vdo.ninja';
  const ORIGIN = location.origin.replace('127.0.0.1', 'localhost');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const t = (s, v) => (window.I18N ? I18N.t(s, v) : s);
  const $ = (s) => document.querySelector(s);
  const stage = $('#stage');
  const tilesEl = $('#tiles');
  let st = {}, cfg = null, presence = [], speaking = {}, lastKey = '';

  // ---------- Ids & links ----------
  const myName = () => SavaneId.nameOf(cfg, st.twitchAccount && st.twitchAccount.login) || 'guest';
  const myId = () => SavaneId.streamId(cfg.room, myName());
  const myIdSafe = () => { try { return cfg && cfg.room ? myId() : ''; } catch (e) { return ''; } };
  const common = () => `room=${encodeURIComponent(cfg.room)}${cfg.password ? '&password=' + encodeURIComponent(cfg.password) : ''}`;
  const viewUrl = (id, audio) => `${VDO}?${common()}&view=${encodeURIComponent(id)}&solo&cleanoutput&cover&transparent${audio ? '' : '&noaudio'}`;
  // A device chosen in our picker is passed by its name (VDO.Ninja matches any device whose name contains it; spaces as _).
  const dev = (v) => (v === '0' || v === '' || v == null ? (v === '0' ? '0' : '1') : encodeURIComponent(String(v).replace(/\s+/g, '_')));
  function pushUrl(o) {
    // &novideo&noaudio: this frame only sends; everyone else is shown (and heard) in the scene tiles.
    let u = `${VDO}?${common()}&push=${encodeURIComponent(myId())}&label=${encodeURIComponent(myName())}&mute&novideo&noaudio&webcam`;
    if (o && o.auto) u += `&autostart&videodevice=${dev(o.cam)}&audiodevice=${dev(o.mic)}&quality=${encodeURIComponent(o.q || '1')}`;
    return u;
  }
  const camLink = (id, raw) => `${ORIGIN}/savane.html?cam=${encodeURIComponent(id)}${raw ? '&raw=1' : ''}`;
  const sceneLink = () => `${ORIGIN}/savane.html?scene=1`;

  // ---------- Layout ----------
  function rects(n, W, H, c) {
    if (!n) return [];
    const top = c.title ? Math.round(H * 0.11) : 0;
    const x0 = c.padding, y0 = c.padding + top, w = W - 2 * c.padding, h = H - 2 * c.padding - top, g = c.gap;
    const AR = ['circle', 'hexagon', 'blob'].includes(c.shape) ? 1 : 16 / 9;
    const fit = (bw, bh) => (bw / bh > AR ? [bh * AR, bh] : [bw, bw / AR]);
    const out = [];
    const row = (items, x, y, bw, bh) => { // items laid in one row inside a box, centred
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
    // grid (also the starting point of "free" for cameras not placed yet): the column count that gives the biggest tiles
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const [tw] = fit((w - (cols - 1) * g) / cols, (h - (rows - 1) * g) / rows);
      if (!best || tw > best.tw) best = { cols, rows, tw };
    }
    const { cols, rows } = best;
    const rh = (h - (rows - 1) * g) / rows;
    const [, th] = fit((w - (cols - 1) * g) / cols, rh);
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
  const nameOf = (p) => (cfg.labels && cfg.labels[p.id]) || p.label || String(p.id).replace(/^L\w+?_/, '');
  function people() {
    if (PREVIEW && !presence.length) return ['Civibrr', 'trkzlive', 'Pixelcat', 'Mamie'].map((n, i) => ({ id: 'demo' + i, label: n, demo: true }));
    const hidden = new Set(cfg.hidden || []), order = cfg.order || [];
    const rank = (id) => { const i = order.indexOf(id); return i < 0 ? 1e3 : i; };
    // The panel preview shows the real people as placeholders: no video (and no sound) inside the panel.
    return presence.filter((p) => !hidden.has(p.id)).map((p, i) => Object.assign({ i }, p, PREVIEW ? { demo: true, label: nameOf(p) } : {})).sort((a, b) => rank(a.id) - rank(b.id) || a.i - b.i);
  }
  let K = 1; // stage scale (screen px per scene px)
  let curList = [], curRects = [];
  function render() {
    if (!cfg) return;
    const c = cfg;
    // One camera fills its browser source; the room and the scene keep the scene size (scaled to fit).
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
    if (MODE === 'cam') list = list.filter((p) => p.id === CAM).concat(list.find((p) => p.id === CAM) ? [] : [{ id: CAM, label: '' }]);
    const me = myIdSafe();
    const bw = RAW ? 0 : c.border;
    const R = MODE === 'cam' ? [{ x: RAW ? 0 : bw + 8, y: RAW ? 0 : bw + 8, w: W - 2 * (RAW ? 0 : bw + 8), h: H - 2 * (RAW ? 0 : bw + 8), z: 1 }] : placed(list, W, H, c);
    curList = list; curRects = R;
    const key = JSON.stringify([list.map((p) => p.id), MODE, c.room, c.password, c.audioInObs]);
    if (key !== lastKey) {
      lastKey = key;
      // Reuse the players that stay (a reload costs a reconnection).
      const keep = new Map([...tilesEl.children].map((el) => [el.dataset.id, el]));
      tilesEl.innerHTML = '';
      list.forEach((p) => {
        let el = keep.get(p.id);
        if (!el) {
          el = document.createElement('div');
          el.className = 'tile';
          el.dataset.id = p.id;
          const audio = MODE === 'room' ? p.id !== me : c.audioInObs && p.id !== me;
          el.innerHTML = (p.demo ? `<div class="vid demo"><span>${esc(p.label.charAt(0))}</span></div>` : `<div class="vid"><iframe src="${esc(viewUrl(p.id, audio))}" allow="autoplay; fullscreen"></iframe></div>`)
            + '<div class="name"></div>'
            + (MODE === 'room' ? `<div class="grab"></div><div class="rs"></div><div class="tools"><button class="e" data-t="main" title="${esc(t('Put first (the big one in Spotlight)'))}">⭐</button><button class="e" data-t="front" title="${esc(t('Bring to front'))}">⬆</button><button class="e" data-t="hide" title="${esc(t('Hide from the scene'))}">🙈</button><button data-t="obs" title="${esc(t('Copy this camera\'s OBS link'))}">📺</button></div>` : '');
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
      nm.textContent = nameOf(p);
      nm.style.display = c.names && !RAW && (p.label || MODE !== 'cam' || (c.labels && c.labels[p.id])) ? '' : 'none';
      nm.style.fontSize = Math.max(14, Math.round(Math.min(r.w, r.h) * 0.075)) + 'px';
      const tools = el.querySelector('.tools');
      if (tools) tools.style.transform = `scale(${1 / K})`; // tools keep their screen size whatever the zoom
      const rs = el.querySelector('.rs');
      if (rs) rs.style.transform = `scale(${1 / K})`;
    });
    const empty = $('#empty');
    empty.style.display = list.length ? 'none' : '';
    empty.style.fontSize = Math.max(14, Math.round(H * 0.028)) + 'px';
    empty.textContent = !c.room ? t('No room yet: create it in LaboHub → La savane.') : MODE === 'room' ? t('Nobody here yet: start your camera, then send the invitation to the crew!') : t('Nobody in La savane right now.');
    if (MODE === 'room') renderSide();
  }
  // Scales the scene into its box (the window for OBS, the middle area in the room window), centred.
  function fit(W, H) {
    const box = MODE === 'room' ? $('#view') : document.documentElement;
    const aw = box.clientWidth || innerWidth, ah = box.clientHeight || innerHeight;
    const pad = MODE === 'room' ? 16 : 0;
    const k = Math.min((aw - 2 * pad) / W, (ah - 2 * pad) / H);
    K = k > 0 ? k : 1;
    const ox = MODE === 'room' ? Math.round((aw - W * K) / 2) : 0, oy = MODE === 'room' ? Math.round((ah - H * K) / 2) : 0;
    stage.style.transform = MODE !== 'room' && Math.abs(K - 1) < 0.001 ? '' : `translate(${ox}px, ${oy}px) scale(${K})`;
  }

  // ---------- Settings writes from the room window (debounced; the app echoes the result back) ----------
  let pending = {}, saveTimer = 0;
  function save(patch) {
    Object.assign(cfg, patch);
    Object.assign(pending, patch);
    render();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 250);
  }
  function flush() {
    const p = pending; pending = {};
    if (!Object.keys(p).length) return;
    fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ savane: p }) }).catch(() => toast(t('Something went wrong')));
  }
  const action = (name, body) => fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ name }, body)) }).then((r) => r.json()).catch(() => ({}));
  function copy(text, msg) { navigator.clipboard.writeText(text).then(() => toast(msg || t('Copied')), () => toast(t('Could not copy'))); }

  // ---------- Room window: your camera ----------
  let pushFrame = null, roomKey = '', live = false, micOn = false, camOn = true;
  const seen = new Map(); // streamID -> label
  const DEV_KEY = 'savaneDevices';
  const devPrefs = () => { try { return JSON.parse(localStorage.getItem(DEV_KEY)) || {}; } catch (e) { return {}; } };
  function setupRoom() {
    const who = $('#roomBar .who');
    if (!cfg.room) { who.textContent = t('No room yet: create it in LaboHub → La savane.'); return; }
    // The id must be the same here, in OBS and in the panel: a guest without a name gets one saved once.
    if (!SavaneId.nameOf(cfg, st.twitchAccount && st.twitchAccount.login) && !pending.name) { save({ name: 'guest' + Math.floor(1000 + Math.random() * 9000) }); return; }
    const key = cfg.room + '|' + cfg.password + '|' + myName();
    if (key === roomKey) return;
    const restart = live;
    roomKey = key;
    seen.clear();
    who.textContent = `🍌 ${cfg.room} · ${myName()}`;
    if (restart) start(); else { stopPush(); if (devPrefs().auto) start(); }
    report();
  }
  function start(opts) {
    const p = Object.assign({ cam: $('#devCam').value, mic: $('#devMic').value, q: $('#devQ').value || '1' }, opts || {});
    if (p.cam === '0' && p.mic === '0' && !p.vdo) { toast(t('Pick a camera or a microphone')); return; }
    if (!p.vdo) try { localStorage.setItem(DEV_KEY, JSON.stringify(Object.assign(devPrefs(), { cam: p.cam, mic: p.mic, q: p.q }))); } catch (e) { /* private mode */ }
    camOn = p.cam !== '0'; micOn = false;
    const url = p.vdo ? pushUrl() : pushUrl({ auto: true, cam: camOn ? p.cam : '0', mic: p.mic, q: p.q });
    $('#me').innerHTML = `<iframe src="${esc(url)}" allow="camera; microphone; autoplay; display-capture; fullscreen"></iframe>`;
    pushFrame = $('#me iframe');
    live = true;
    document.body.classList.add('live');
    seen.set(myId(), myName());
    report();
    liveButtons();
  }
  function stopPush() {
    $('#me').innerHTML = `<div class="off">${esc(t('Not started: pick your camera and microphone above, then Start.'))}</div>`;
    pushFrame = null; live = false;
    document.body.classList.remove('live');
    seen.delete(myIdSafe());
  }
  function liveButtons() {
    $('#micBtn').textContent = micOn ? '🎙 ' + t('Microphone on') : '🔇 ' + t('Microphone muted');
    $('#micBtn').classList.toggle('on', micOn);
    $('#camBtn').textContent = camOn ? '📷 ' + t('Camera on') : '🚫 ' + t('Camera off');
    $('#camBtn').classList.toggle('on', camOn);
  }
  // Device list: names need the camera/microphone permission once (Electron grants it to the app's own pages).
  async function listDevices() {
    if (!navigator.mediaDevices) return;
    let list = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    if (!list.some((d) => d.label)) {
      for (const want of [{ audio: true, video: true }, { audio: true }, { video: true }]) {
        try { const s = await navigator.mediaDevices.getUserMedia(want); s.getTracks().forEach((x) => x.stop()); break; } catch (e) { /* try less */ }
      }
      list = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    }
    const pref = devPrefs();
    const fill = (sel, kind, saved) => {
      const devs = list.filter((d) => d.kind === kind && d.label && d.deviceId !== 'default' && d.deviceId !== 'communications');
      const names = [...new Set(devs.map((d) => d.label))];
      sel.innerHTML = `<option value="">${esc(t('Default'))}</option>` + names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('') + `<option value="0">${esc(t('None'))}</option>`;
      sel.value = saved != null && [...sel.options].some((o) => o.value === saved) ? saved : '';
    };
    fill($('#devCam'), 'videoinput', pref.cam);
    fill($('#devMic'), 'audioinput', pref.mic);
    $('#devQ').value = pref.q || '1';
    $('#devAuto').checked = !!pref.auto;
  }
  function report() {
    presence = [...seen].map(([id, label]) => ({ id, label, me: id === myIdSafe() }));
    action('savane-presence', { ids: presence });
    render();
  }
  let lastSpeak = '';
  function reportSpeaking() {
    const ids = Object.keys(speaking).filter((k) => speaking[k]).sort();
    const k = ids.join();
    if (k === lastSpeak) return;
    lastSpeak = k;
    action('savane-speaking', { ids });
  }
  addEventListener('message', (e) => {
    if (e.origin !== VDO_ORIGIN || !e.data || typeof e.data !== 'object') return;
    const d = e.data;
    if (MODE === 'room') {
      if (d.action === 'guest-connected' && d.streamID) { seen.set(String(d.streamID), (d.value && d.value.label) || ''); report(); }
      if ((d.action === 'push-connection' || d.action === 'view-connection') && d.value === false && d.streamID && d.streamID !== myIdSafe()) { seen.delete(String(d.streamID)); report(); }
      if (d.streamIDs && typeof d.streamIDs === 'object') {
        const ids = Array.isArray(d.streamIDs) ? d.streamIDs : Object.keys(d.streamIDs);
        let ch = false;
        for (const id of ids) if (typeof id === 'string' && !seen.has(id)) { seen.set(id, typeof d.streamIDs[id] === 'string' ? d.streamIDs[id] : ''); ch = true; }
        if (ch) report();
      }
    }
    if (d.loudness && typeof d.loudness === 'object') {
      let ch = false;
      for (const [id, v] of Object.entries(d.loudness)) { const s = Number(v) > 6; if (speaking[id] !== s) { speaking[id] = s; ch = true; } }
      if (ch) { render(); if (MODE === 'room') reportSpeaking(); }
    }
  });
  function frames() { return [pushFrame, ...[...tilesEl.querySelectorAll('iframe')]].filter(Boolean); }
  if (MODE === 'room') {
    setInterval(() => {
      for (const f of frames()) {
        try {
          if (f === pushFrame) f.contentWindow.postMessage({ getStreamIDs: true }, VDO_ORIGIN);
          // Loudness is a subscription: asked twice (the first one may arrive before VDO.Ninja is ready), then left running.
          const n = Number(f.dataset.loud || 0);
          if (n < 2) { f.contentWindow.postMessage({ getLoudness: true }, VDO_ORIGIN); f.dataset.loud = n + 1; }
        } catch (e) { /* loading */ }
      }
      if (cfg && cfg.room) report();
    }, 8000);
    addEventListener('beforeunload', () => { flush(); if (navigator.sendBeacon) navigator.sendBeacon('/api/action', new Blob([JSON.stringify({ name: 'savane-presence', ids: [] })], { type: 'application/json' })); });
    $('#toggleMe').onclick = () => { document.body.classList.toggle('drawer'); $('#toggleMe').classList.toggle('on', document.body.classList.contains('drawer')); render(); };
    $('#toggleEdit').onclick = () => { document.body.classList.toggle('edit'); $('#toggleEdit').classList.toggle('on', document.body.classList.contains('edit')); render(); };
    $('#toggleObs').onclick = () => { document.body.classList.toggle('pop'); $('#toggleObs').classList.toggle('on', document.body.classList.contains('pop')); renderObs(); };
    $('#copyInvite').onclick = () => copy(`🍌 La savane — LaboHub\n${t('Room')}: ${cfg.room}\n${t('Password')}: ${cfg.password || '—'}\nSAV1.${btoa(JSON.stringify({ r: cfg.room, p: cfg.password }))}`, t('Invitation copied'));
    $('#devStart').onclick = () => start();
    $('#devVdo').onclick = () => start({ vdo: true });
    $('#devStop').onclick = () => { stopPush(); report(); };
    $('#devAuto').onchange = (e) => { try { localStorage.setItem(DEV_KEY, JSON.stringify(Object.assign(devPrefs(), { auto: e.target.checked }))); } catch (x) { /* private mode */ } };
    $('#micBtn').onclick = () => {
      if (!pushFrame) return;
      micOn = !micOn;
      try { pushFrame.contentWindow.postMessage({ mic: micOn }, VDO_ORIGIN); } catch (e) { /* loading */ }
      liveButtons();
    };
    // Camera on/off: the sender restarts with or without video (reliable on every VDO.Ninja version); the mic starts muted again.
    $('#camBtn').onclick = () => { const p = devPrefs(); start({ cam: camOn ? '0' : (p.cam === '0' ? '' : p.cam || ''), mic: p.mic || '', q: p.q || '1' }); };
    if (navigator.mediaDevices) navigator.mediaDevices.addEventListener('devicechange', () => { if (!live) listDevices(); });
    listDevices();
    document.body.classList.add('drawer');
    $('#toggleMe').classList.add('on');
  }
  function toast(text) { const el = $('#toast'); if (!el) return; el.textContent = text; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2200); }

  // ---------- Room window: OBS links ----------
  function renderObs() {
    if (!document.body.classList.contains('pop') || !cfg) return;
    const me = myIdSafe();
    const all = presence.slice();
    if (me && !all.some((p) => p.id === me)) all.unshift({ id: me, label: myName(), me: true });
    const row = (label, url, size, ghost) => `<div class="row"><b>${esc(label)}</b><code>${esc(url)}</code><span class="muted">${esc(size)}</span><button class="small${ghost ? ' ghost' : ''}" data-copy="${esc(url)}">${esc(t('Copy'))}</button></div>`;
    $('#obsPop').innerHTML = `<h3 style="margin:12px;color:#ffc93c">📺 ${esc(t('OBS links'))}</h3>`
      + `<p style="margin:0 12px 8px;color:#ffffffaa;font-size:12px">${esc(t('In OBS: Sources → + → Browser, paste the link and set the size. Tick “Control audio via OBS” to mix the sound.'))}</p>`
      + row('🍌 ' + t('Whole room'), sceneLink(), `${cfg.width} × ${cfg.height}`)
      + all.map((p) => row((p.me ? '🎥 ' : '👤 ') + (p.me ? t('Me') : nameOf(p)), camLink(p.id), '1280 × 720', true) + row('↳ ' + t('video only (no frame)'), camLink(p.id, true), '1280 × 720', true)).join('')
      + (presence.length ? '' : `<p style="margin:6px 12px;color:#ffffff88;font-size:12px">${esc(t('The others appear here when they are in the room. Your link works as soon as your camera is started.'))}</p>`);
  }
  if (MODE === 'room') $('#obsPop').addEventListener('click', (e) => { const b = e.target.closest('[data-copy]'); if (b) copy(b.dataset.copy, t('Copied: add it as a Browser Source in OBS')); });

  // ---------- Room window: customise ----------
  const PRESETS = [
    ['Savanna', 'gradient', '#2b1a4a', '#f0a83a', 135], ['Night', 'gradient', '#0b1026', '#3a1c71', 160], ['Neon', 'gradient', '#12002e', '#ff2bd6', 120], ['Ocean', 'gradient', '#02324a', '#1fb6c9', 150],
    ['Forest', 'gradient', '#0f2a1d', '#6bbf59', 140], ['Peach', 'gradient', '#ff9a8b', '#ffd3a5', 120], ['Studio', 'radial', '#3a3a44', '#0d0d10', 0], ['Lava', 'radial', '#ff7a45', '#2a0a0a', 0],
  ];
  const SIZES = [['16:9 HD', 1920, 1080], ['16:9 720p', 1280, 720], ['9:16', 1080, 1920], ['1:1', 1080, 1080], ['4:3', 1440, 1080], ['21:9', 2560, 1080]];
  let sideKey = '';
  function renderSide() {
    if (!document.body.classList.contains('edit')) return;
    for (const el of document.querySelectorAll('[data-k]')) {
      if (el === document.activeElement) continue;
      const v = cfg[el.dataset.k];
      if (el.type === 'checkbox') el.checked = !!v; else if (String(el.value) !== String(v)) el.value = v;
    }
    const k = JSON.stringify([presence, cfg.hidden, cfg.order, cfg.labels, cfg.width, cfg.height, I18N && I18N.lang]);
    if (k === sideKey || $('#ppl').contains(document.activeElement)) return;
    sideKey = k;
    $('#presets').innerHTML = PRESETS.map(([n, ty, a, b, ang], i) => `<button data-preset="${i}" style="background:${ty === 'radial' ? `radial-gradient(circle, ${a}, ${b})` : `linear-gradient(${ang}deg, ${a}, ${b})`}">${esc(t(n))}</button>`).join('');
    $('#sizes').innerHTML = SIZES.map(([n, w, h]) => `<button class="ghost small${cfg.width === w && cfg.height === h ? ' on' : ''}" data-size="${w}x${h}">${esc(n)}</button>`).join('');
    const hidden = new Set(cfg.hidden || []);
    const all = presence.slice().sort((a, b) => { const o = cfg.order || []; const ra = o.indexOf(a.id), rb = o.indexOf(b.id); return (ra < 0 ? 1e3 : ra) - (rb < 0 ? 1e3 : rb); });
    $('#ppl').innerHTML = all.length ? all.map((p) => `<div class="p${hidden.has(p.id) ? ' off' : ''}" data-id="${esc(p.id)}"><input type="text" maxlength="24" data-label value="${esc((cfg.labels || {})[p.id] || '')}" placeholder="${esc(p.label || nameOf(p))}"><button class="ghost small" data-up title="${esc(t('Move up'))}">▲</button><button class="ghost small" data-eye title="${esc(t('Show / hide in the scene'))}">${hidden.has(p.id) ? '🙈' : '👁'}</button></div>`).join('')
      : `<p style="margin:0">${esc(t('Nobody in the room yet.'))}</p>`;
  }
  function bindSide() {
    for (const el of document.querySelectorAll('[data-k]')) {
      const ev = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'color' ? 'change' : 'input';
      el.addEventListener(ev, () => {
        const k = el.dataset.k;
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (el.type === 'range' || el.type === 'number') v = Number(v);
        save({ [k]: v });
      });
      if (el.type === 'color') el.addEventListener('input', () => { cfg[el.dataset.k] = el.value; render(); });
    }
    $('#presets').addEventListener('click', (e) => { const b = e.target.closest('[data-preset]'); if (!b) return; const [, bg, c1, c2, ang] = PRESETS[+b.dataset.preset]; save({ bg, bgColor1: c1, bgColor2: c2, bgAngle: ang || 135 }); });
    $('#sizes').addEventListener('click', (e) => { const b = e.target.closest('[data-size]'); if (!b) return; const [w, h] = b.dataset.size.split('x').map(Number); save({ width: w, height: h }); sideKey = ''; });
    $('#resetPos').onclick = () => { save({ positions: [], layout: cfg.layout === 'free' ? 'grid' : cfg.layout }); toast(t('Automatic layout')); };
    $('#noLogo').onclick = () => save({ logo: '' });
    const upload = (input, apply) => input.addEventListener('change', async () => {
      const f = input.files[0]; input.value = '';
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) { toast(t('Picture too big (8 MB max)')); return; }
      const r = await fetch('/api/backgrounds', { method: 'POST', body: f }).then((x) => x.json()).catch(() => null);
      if (!r || !r.ok) { toast(t((r && r.error) || 'Something went wrong')); return; }
      apply(r.url);
    });
    upload($('#upBg'), (url) => { save({ bgImage: url, bg: 'image' }); toast(t('Background added')); });
    upload($('#upLogo'), (url) => { save({ logo: url }); toast(t('Logo added')); });
    const ppl = $('#ppl');
    ppl.addEventListener('change', (e) => {
      const row = e.target.closest('[data-id]');
      if (row && e.target.matches('[data-label]')) save({ labels: Object.assign({}, cfg.labels, { [row.dataset.id]: e.target.value.trim() }) });
    });
    ppl.addEventListener('click', (e) => {
      const row = e.target.closest('[data-id]');
      if (!row) return;
      const id = row.dataset.id;
      if (e.target.closest('[data-eye]')) toggleHidden(id);
      if (e.target.closest('[data-up]')) moveUp(id);
    });
  }
  function orderedIds() { const o = (cfg.order || []).filter((id) => presence.some((p) => p.id === id)); for (const p of presence) if (!o.includes(p.id)) o.push(p.id); return o; }
  function moveUp(id) { const o = orderedIds(), i = o.indexOf(id); if (i > 0) { o.splice(i, 1); o.splice(i - 1, 0, id); save({ order: o }); sideKey = ''; } }
  function makeMain(id) { const o = orderedIds().filter((x) => x !== id); o.unshift(id); save({ order: o }); sideKey = ''; }
  function toggleHidden(id) { const h = new Set(cfg.hidden || []); if (h.has(id)) h.delete(id); else h.add(id); save({ hidden: [...h] }); sideKey = ''; }
  function bringFront(id) {
    ensureFree();
    const pos = cfg.positions.slice(), i = pos.findIndex((x) => x.id === id);
    if (i >= 0) pos.push(pos.splice(i, 1)[0]);
    else { const j = curList.findIndex((p) => p.id === id), r = curRects[j]; if (!r) return; pos.push({ id, x: r.x / cfg.width, y: r.y / cfg.height, w: r.w / cfg.width, h: r.h / cfg.height }); }
    save({ positions: pos });
  }
  // Moving a camera switches to the free layout, starting from where every camera is now.
  function ensureFree() {
    if (cfg.layout === 'free') { if (!cfg.positions) cfg.positions = []; return; }
    const W = cfg.width, H = cfg.height;
    const pos = curList.map((p, i) => ({ id: p.id, x: curRects[i].x / W, y: curRects[i].y / H, w: curRects[i].w / W, h: curRects[i].h / H }));
    save({ layout: 'free', positions: pos });
  }

  // ---------- Room window: drag & resize ----------
  let drag = null;
  function snapTo(v, targets, th) { let best = null; for (const t0 of targets) if (Math.abs(v - t0) < th && (best === null || Math.abs(v - t0) < Math.abs(v - best))) best = t0; return best; }
  if (MODE === 'room') {
    tilesEl.addEventListener('click', (e) => {
      const b = e.target.closest('.tools button');
      if (!b) return;
      const id = b.closest('.tile').dataset.id;
      const ty = b.dataset.t;
      if (ty === 'obs') copy(camLink(id), t('Copied: add it as a Browser Source in OBS'));
      if (ty === 'hide') toggleHidden(id);
      if (ty === 'main') makeMain(id);
      if (ty === 'front') bringFront(id);
    });
    tilesEl.addEventListener('pointerdown', (e) => {
      if (!document.body.classList.contains('edit')) return;
      const grab = e.target.closest('.grab, .rs');
      if (!grab) return;
      const el = grab.closest('.tile'), id = el.dataset.id;
      ensureFree();
      const r = { x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: parseFloat(el.style.width), h: parseFloat(el.style.height) };
      drag = { el, id, resize: grab.classList.contains('rs'), sx: e.clientX, sy: e.clientY, r, cur: Object.assign({}, r) };
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
        // Never bigger than what is left of the scene: the handle must stay reachable.
        r.w = Math.max(80, Math.min(W - r.x, drag.r.w + dx));
        r.h = e.shiftKey ? Math.max(60, Math.min(H - r.y, drag.r.h + dy)) : r.w * (drag.r.h / drag.r.w);
        if (!e.shiftKey && r.y + r.h > H) { r.h = H - r.y; r.w = r.h * (drag.r.w / drag.r.h); }
        if (e.shiftKey) { const sx = snapTo(r.x + r.w, xs, th); if (sx !== null) { r.w = sx - r.x; gx = sx; } const sy = snapTo(r.y + r.h, ys, th); if (sy !== null) { r.h = sy - r.y; gy = sy; } }
      } else {
        r.x = drag.r.x + dx; r.y = drag.r.y + dy;
        // Snap the left/centre/right edges (and top/middle/bottom) to the scene and the other cameras.
        for (const [off, isX] of [[0, 1], [r.w / 2, 1], [r.w, 1], [0, 0], [r.h / 2, 0], [r.h, 0]]) {
          if (isX && gx === null) { const s = snapTo(r.x + off, xs, th); if (s !== null) { r.x = s - off; gx = s; } }
          if (!isX && gy === null) { const s = snapTo(r.y + off, ys, th); if (s !== null) { r.y = s - off; gy = s; } }
        }
        // Keep the whole camera inside the scene (a camera dragged out would lose its handles).
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
      const W = cfg.width, H = cfg.height;
      const pos = (cfg.positions || []).filter((x) => x.id !== id);
      pos.push({ id, x: cur.x / W, y: cur.y / H, w: cur.w / W, h: cur.h / H }); // the moved camera comes to the front
      save({ layout: 'free', positions: pos });
    };
    tilesEl.addEventListener('pointerup', end);
    tilesEl.addEventListener('pointercancel', end);
    bindSide();
  }

  // ---------- State ----------
  function apply(next) {
    st = Object.assign({}, st, next);
    if (next.app && next.app.lang && window.I18N && I18N.setLang(next.app.lang)) { I18N.apply(document.body); sideKey = ''; if (MODE === 'room') { liveButtons(); listDevices(); } }
    if (!st.settings) return;
    cfg = Object.assign({}, st.settings.savane, pending); // keep local edits not saved yet
    if (MODE !== 'room' && st.savane) presence = st.savane.presence || [];
    if (MODE === 'room') setupRoom();
    render();
    renderObs();
  }
  addEventListener('resize', render);
  if (MODE === 'room' && window.ResizeObserver) new ResizeObserver(() => render()).observe($('#view'));
  if (PREVIEW && window.parent !== window) {
    addEventListener('message', (e) => { if (e.origin === location.origin && e.data && e.data.type === 'po-state') apply(e.data.state); });
    window.parent.postMessage({ type: 'po-widget-ready', w: 'savane' }, location.origin);
  } else {
    const es = new EventSource('/api/events');
    es.addEventListener('state', (e) => apply(JSON.parse(e.data)));
    if (MODE !== 'room') es.addEventListener('savane-speaking', (e) => { const d = JSON.parse(e.data); speaking = {}; for (const id of d.ids || []) speaking[id] = true; render(); });
  }
  document.body.classList.add('m-' + MODE);
  window.SavaneLayout = rects;
})();
