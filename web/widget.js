/*
 * OBS widgets, one per Browser Source so each can be moved and resized freely in OBS:
 *   widget.html?w=followers | subs | latest-follower | latest-sub | spotify | chat | counter&id=… | alerts
 * counter: a game counter (settings.lab.counters), &vs=<id> shows a second one next to it (wins – losses).
 * The look comes from settings.widgets.looks[widget] (every property: web/shared/widget-schema.js).
 * demo=1: sample data when there is nothing real yet.
 * preview=1 (panel previews, implies demo): data and draft looks come from the panel by postMessage instead of
 *   an event stream of its own (Chromium allows only 6 connections per host). big=1 centres it.
 * 'alerts' plays the alert sounds inside OBS when the alert output is "OBS", and shows each sound's GIF in any case
 *   (silently, timed on the sound, when the app plays the sound itself).
 * Every look can carry its own CSS (customCss), added after the widget's styles.
 */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const W = params.get('w') || 'followers';
  const KEY = { followers: 'followers', subs: 'subs', 'latest-follower': 'latestFollower', 'latest-sub': 'latestSub', spotify: 'spotify', chat: 'chat', counter: 'gameCounter' }[W] || null;
  const CID = params.get('id') || '', VS = params.get('vs') || '';
  const PREVIEW = params.get('preview') === '1' && window.parent !== window;
  // feed=1: inside a scene page (scene.html), which holds the only connection to the app and forwards the state.
  const FEED = params.get('feed') === '1' && window.parent !== window;
  const DEMO = params.get('demo') === '1' || PREVIEW;
  const S = WidgetSchema;
  const KIND = KEY ? S.KIND[KEY] : null;
  const t = I18N.t;
  const root = document.getElementById('root');
  const body = document.body;
  const BIG = params.get('big') === '1';
  if (BIG) body.classList.add('big');
  // Editor preview: shrink the widget to fit the preview box (zoom, so it doesn't fight the animations' transforms).
  function fitBig() {
    if (!BIG) return;
    root.style.zoom = 1;
    const r = root.getBoundingClientRect();
    const k = Math.min(1, (innerWidth - 40) / Math.max(1, r.width), (innerHeight - 40) / Math.max(1, r.height));
    root.style.zoom = k;
  }

  let state = { settings: null, stats: null, nowPlaying: null, twitchAccount: null };
  let chatW = null; // live chat widget (widget-chat.js)
  let look = null, lookKey = '', el = null, shown = null, lastSec = -1;
  let demo = {
    followers: 1234, subs: 42, latestFollower: { display: 'pixelcat' }, latestSub: { display: 'MamieGaming', kind: 'prime' },
    np: { status: 'running', playing: true, artist: 'Paper Puppets', title: 'Head Flap Boogie (Radio Edit)', album: 'Cut-Paper Nights', app: 'Spotify', pos: 62, dur: 214, posAt: Date.now(), cover: null },
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const loc = () => (I18N.lang === 'fr' ? 'fr-FR' : 'en-US');
  function fmt(n, how) {
    if (n == null) return '—';
    if (how === 'plain') return String(n);
    if (how === 'compact') return new Intl.NumberFormat(loc(), { notation: 'compact', maximumFractionDigits: 1 }).format(n);
    return Number(n).toLocaleString(loc());
  }
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  // Original glyphs, drawn for these widgets.
  const ICONS = {
    heart: 'M12 20.5C10.9 19.6 2.8 14 2.8 8.7 2.8 5.9 4.9 3.8 7.6 3.8c1.9 0 3.5 1 4.4 2.6.9-1.6 2.5-2.6 4.4-2.6 2.7 0 4.8 2.1 4.8 4.9 0 5.3-8.1 10.9-9.2 11.8z',
    star: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z',
    user: 'M12 12.5a4.8 4.8 0 1 0 0-9.6 4.8 4.8 0 0 0 0 9.6zm0 2c-4.6 0-8.5 2.4-8.5 5.6V21h17v-.9c0-3.2-3.9-5.6-8.5-5.6z',
    crown: 'M3 7.5l4.6 4 4.4-7 4.4 7 4.6-4L19.4 18H4.6zM4.6 19.5h14.8V21H4.6z',
    gift: 'M3.5 9h17v3.5h-17zM5 12.5h14V21H5zM11 9h2v12h-2zM12 9c-1-3-5.5-5-6-2.5C5.6 8.5 9 9 12 9zm0 0c1-3 5.5-5 6-2.5.4 2-3 2.5-6 2.5z',
    bolt: 'M13.5 2L4.5 13.5h6L9.5 22l9-11.5h-6z',
    music: 'M9 17.5V5.5l11-2v12a3 3 0 1 1-2-2.8V7.7L11 9v8.5a3 3 0 1 1-2-2.8z',
    fire: 'M12 22c-4.2 0-7-2.9-7-6.8 0-3.3 2.2-5.4 3.6-7.4.4 1.6 1.2 2.6 2.2 3.2C10.6 7.6 12 4.3 14.6 2c.2 3.4 4.4 6.6 4.4 12.2C19 18.9 16.2 22 12 22z',
    skull: 'M12 2.5c-5 0-8.5 3.4-8.5 8 0 2.8 1.3 4.8 3 6V20c0 .8.7 1.5 1.5 1.5h1v-2.2h1.5v2.2h3v-2.2H15v2.2h1c.8 0 1.5-.7 1.5-1.5v-3.5c1.7-1.2 3-3.2 3-6 0-4.6-3.5-8-8.5-8zM8.6 14.6a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zm6.8 0a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM12 15.2l1.2 2.2h-2.4z',
    trophy: 'M6.5 3h11v2H21v2.5c0 2.5-1.8 4.5-4.2 4.9-.9 1.6-2.4 2.7-4.1 3V18h3.3v3H8v-3h3.3v-2.6c-1.7-.3-3.2-1.4-4.1-3C4.8 12 3 10 3 7.5V5h3.5zM5 7v.5c0 1.2.7 2.3 1.7 2.8-.1-.5-.2-1-.2-1.6V7zm14 0h-1.5v1.7c0 .6-.1 1.1-.2 1.6 1-.5 1.7-1.6 1.7-2.8z',
  };
  function iconHtml(lk) {
    if (lk.icon === 'none') return '';
    if (lk.icon === 'custom') return `<span class="wg-ic"><span class="txt">${esc(lk.iconText)}</span></span>`;
    if (lk.icon === 'image') return lk.iconImage ? `<span class="wg-ic img"><img src="${esc(lk.iconImage)}" alt=""></span>` : '';
    return `<span class="wg-ic"><svg viewBox="0 0 24 24"><path d="${ICONS[lk.icon] || ''}"/></svg></span>`;
  }

  // ---------- Data ----------
  const real = () => (state.stats && state.stats.updatedAt ? state.stats : null);
  // Game counter of the link (?id=…, the first one otherwise) and the one shown next to it (&vs=…).
  function gameCounters() {
    const list = (state.settings && state.settings.lab && state.settings.lab.counters) || [];
    const find = (id) => list.find((x) => x.id === id || x.cmd === id);
    let c = find(CID) || (CID ? null : list[0]);
    if (!c && DEMO) c = { id: 'demo', name: t('Deaths'), value: demo.deaths || 12 };
    const v = VS ? find(VS) || (DEMO ? { name: t('Losses'), value: 5 } : null) : null;
    return { c, v };
  }
  function data() {
    const st = real() || (DEMO ? demo : {});
    if (KEY === 'gameCounter') { const { c, v } = gameCounters(); return { n: c ? c.value : null, name: c ? c.name : t('Unknown counter'), vs: v ? v.value : null, vsName: v ? v.name : '' }; }
    if (KIND === 'counter') return { n: KEY === 'followers' ? st.followers : st.subs };
    if (KIND === 'latest') {
      const x = KEY === 'latestFollower' ? st.latestFollower : st.latestSub;
      return { name: x ? x.display : null, kind: x ? x.kind : null, count: x ? x.count : 0, avatar: x && x.avatar ? x.avatar : null };
    }
    const np = state.nowPlaying && (state.nowPlaying.playing || !DEMO) ? state.nowPlaying : DEMO ? demo.np : null;
    if (!np) return { playing: false, title: '', artist: '', album: '', app: '', pos: 0, dur: 0, posAt: 0, cover: null, demo: false };
    return { playing: !!np.playing, title: np.title || '', artist: np.artist || '', album: np.album || '', app: np.app || '', pos: np.pos || 0, dur: np.dur || 0, posAt: np.posAt || 0, cover: np.cover || null, demo: np === demo.np };
  }
  const defaultLabel = (d) => (KEY === 'gameCounter' ? (d && d.name ? d.name + (d.vsName ? ' – ' + d.vsName : '') : t('Counter'))
    : { followers: t('Followers'), subs: t('Subs'), latestFollower: t('Latest follower'), latestSub: t('Latest sub'), spotify: t('Now playing') }[KEY]);

  // ---------- Build ----------
  function cssVars(lk) {
    const v = {
      '--font': `"${lk.font}"`, '--fw': lk.fontWeight, '--fs': lk.size + 'px', '--ls': lk.letterSpacing + 'px', '--lr': lk.labelScale / 100,
      '--tc': lk.textColor, '--sc': lk.subColor, '--ac': lk.accent, '--g2': lk.gradColor, '--ga': lk.gradAngle + 'deg',
      '--bgc': rgba(lk.bgColor, lk.bgOpacity / 100), '--bdc': rgba(lk.borderColor, lk.borderOpacity / 100), '--bw': lk.borderWidth + 'px',
      '--r': lk.radius + 'px', '--pad': lk.padding + 'px', '--gap': lk.gap + 'px', '--blur': lk.blur + 'px', '--icc': lk.iconColor, '--is': lk.iconSize / 100,
      '--spd': lk.speed, '--fst': lk.italic ? 'italic' : 'normal', '--csz': (lk.coverSize || 100) / 100, '--by': `"${t('by').replace(/"/g, '')} "`,
      '--bh': (lk.barHeight || 6) + 'px', '--avs': (lk.avatarSize || 100) / 100, '--es': (lk.emoteScale || 130) / 100,
    };
    if (lk.width) v['--w'] = lk.width + 'px';
    if (lk.bgImage) { v['--bgi'] = `url("${lk.bgImage.replace(/["\\]/g, '')}")`; v['--bgio'] = (lk.bgImageOpacity == null ? 100 : lk.bgImageOpacity) / 100; }
    const TS = { none: 'none', soft: '0 2px 6px rgba(0,0,0,.75), 0 0 2px rgba(0,0,0,.6)', strong: '0 3px 10px #000, 0 0 3px #000, 0 0 1px #000',
      outline: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 6px rgba(0,0,0,.5)', glow: `0 0 .12em ${lk.accent}, 0 0 .3em ${lk.accent}` };
    v['--ts'] = TS[lk.textShadow] || 'none';
    return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';');
  }
  function classes(lk) {
    return ['wg', 'k-' + KIND, 'l-' + lk.layout, 'f-' + lk.frame, 'sh-' + lk.shadow, lk.uppercase ? 'up' : '', lk.textGradient ? 'grad-text' : '',
      KIND === 'spotify' ? 'c-' + lk.cover : '', KIND === 'latest' ? 'av-' + lk.avatar : '', KIND === 'latest' && lk.avatarRing ? 'av-ring' : '',
      lk.idle === 'shine' ? 'idle-shine' : '', lk.bgImage ? 'has-bgi bgi-' + (lk.bgImageFit || 'cover') : '', KEY === 'gameCounter' ? 'k-game' : ''].filter(Boolean).join(' ');
  }
  // Custom CSS of the look, after the widget's own styles.
  function applyCss(lk) {
    let el = document.getElementById('customCss');
    const css = (lk && lk.customCss) || '';
    if (!css) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('style'); el.id = 'customCss'; document.head.appendChild(el); }
    if (el.textContent !== css) el.textContent = css;
  }
  function build(d) {
    const lk = look;
    applyCss(lk);
    const label = lk.showLabel && lk.layout !== 'minimal' ? `<span class="wg-label">${esc(lk.label || defaultLabel(d))}</span>` : '';
    let inner = '';
    if (KIND === 'counter') {
      const goal = lk.goal > 0;
      const goalText = goal && lk.goalStyle !== 'bar' ? `<span class="goal">/ ${esc(fmt(lk.goal, lk.numberFormat))}</span>` : '';
      const bar = goal && (lk.goalStyle !== 'text' || lk.layout === 'bar') ? '<div class="wg-bar"><i></i></div>' : '';
      const vs = KEY === 'gameCounter' && d.vs !== null && d.vs !== undefined ? '<span class="vs-sep">–</span><span class="num2"></span>' : '';
      inner = `${iconHtml(lk)}<div class="wg-body"><div class="wg-line">${label}<span class="wg-val">${lk.prefix ? `<span class="pre">${esc(lk.prefix)}</span>` : ''}<span class="num"></span>${vs}${lk.suffix ? `<span class="suf">${esc(lk.suffix)}</span>` : ''}${goalText}</span></div>${bar}</div>`;
    } else if (KIND === 'latest') {
      const name = '<span class="wg-name"><span class="nm mq"><span></span></span><span class="tagslot"></span></span>';
      inner = `${lk.avatar !== 'none' ? '<span class="wg-av"></span>' : ''}${iconHtml(lk)}<div class="wg-body"><div class="wg-line">${label}${name}</div></div>`;
    } else {
      const chrome = { window: '<i></i><i></i><i></i>' + esc(lk.label || defaultLabel()), terminal: '~$ now-playing', activity: esc(lk.label || t('Listening to music')) }[lk.layout] || '';
      const times = lk.showTime ? '<span class="cur"></span>' : '';
      const prog = lk.progress === 'bar' ? `<div class="np-prog">${times}<div class="np-bar"><i></i></div>${lk.showTime ? '<span class="tot"></span>' : ''}</div>`
        : lk.showTime ? '<div class="np-prog"><span class="cur"></span><span class="sep">/</span><span class="tot"></span></div>' : '';
      inner = `<div class="np-canvas"></div><div class="np-chrome">${chrome}</div>
        <div class="np-main"><div class="np-cover"></div><div class="np-text">${['window', 'activity'].includes(lk.layout) ? '' : label}
          <div class="np-title mq"><span></span></div>${lk.showArtist && lk.twoLines ? '<div class="np-artist mq"><span></span></div>' : ''}
          ${lk.showAlbum || lk.showApp ? '<div class="np-sub mq"><span></span></div>' : ''}${prog}</div>
          ${lk.equalizer ? '<div class="eq"><i></i><i></i><i></i><i></i></div>' : ''}${lk.icon !== 'none' ? iconHtml(lk) : ''}</div>
        ${lk.progress === 'line' ? '<div class="np-line"><i></i></div>' : ''}`;
    }
    body.className = (body.classList.contains('big') ? 'big ' : '') + 'a-' + lk.align;
    root.className = lk.idle && !['none', 'shine'].includes(lk.idle) ? 'idle-' + lk.idle : '';
    root.innerHTML = `<div class="${classes(lk)}${KIND === 'counter' && /wg-bar/.test(inner) ? ' has-bar' : ''}" style="${esc(cssVars(lk))}">${inner}</div>`;
    el = root.firstElementChild;
    shown = null;
    fill(d, false);
    enter();
  }
  function enter() {
    if (!el || look.entrance === 'none') return;
    el.classList.remove('enter'); void el.offsetWidth;
    el.classList.add('enter', 'in-' + look.entrance);
  }

  // ---------- Fill / update ----------
  function marquee(box) {
    if (!box) return;
    const span = box.firstElementChild, text = span.textContent;
    box.classList.remove('on');
    box.innerHTML = `<span>${esc(text)}</span>`;
    if (!look.marquee || box.scrollWidth <= box.clientWidth + 2) return;
    box.classList.add('on');
    box.innerHTML = `<span>${esc(text)}</span><span>${esc(text)}</span>`;
    box.style.setProperty('--mqd', Math.max(6, text.length * 0.32) * (100 / look.speed) + 's');
  }
  function animate(node, from, to) {
    const u = look.update;
    if (u === 'none' || !node) return;
    if (u === 'confetti') { confetti(); node.classList.remove('u-bump'); void node.offsetWidth; node.classList.add('u-bump'); return; }
    if (u === 'count' && KIND === 'counter' && typeof from === 'number' && typeof to === 'number') {
      const start = performance.now(), dur = 900 * (100 / look.speed);
      const step = (now) => {
        const k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 3);
        node.textContent = fmt(Math.round(from + (to - from) * e), look.numberFormat);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      return;
    }
    const cls = 'u-' + (u === 'count' ? 'flip' : u);
    node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls);
  }
  function confetti() {
    const colors = [look.accent, look.gradColor, look.iconColor, '#ffffff'];
    for (let i = 0; i < 18; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      const ang = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 70;
      c.style.cssText = `background:${colors[i % colors.length]};--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist - 20}px;--rot:${Math.random() * 720 - 360}deg`;
      el.appendChild(c);
      setTimeout(() => c.remove(), 1600 * (100 / look.speed));
    }
  }
  function setCover(url) {
    const box = el.querySelector('.np-cover'), canvas = el.querySelector('.np-canvas');
    if (!box) return;
    // crossorigin only for the app's own covers: a remote picture without CORS headers would not load at all.
    box.innerHTML = url ? `<img src="${esc(url)}" alt=""${url.startsWith('/') ? ' crossorigin="anonymous"' : ''}>` : '<span class="ph">♪</span>';
    const im = box.querySelector('img');
    if (im) im.addEventListener('error', () => { if (box.querySelector('img') === im) box.innerHTML = '<span class="ph">♪</span>'; }, { once: true });
    if (canvas) canvas.style.backgroundImage = url ? `url("${url.replace(/"/g, '')}")` : 'none';
    const img = box.querySelector('img');
    if (img && look.coverColors) img.addEventListener('load', () => accentFrom(img), { once: true });
    else if (!url || !look.coverColors) el.style.setProperty('--ac', look.accent);
  }
  // Average colour of the cover (if the image server allows reading it), used as the accent.
  function accentFrom(img) {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 12;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, 12, 12);
      const px = x.getImageData(0, 0, 12, 12).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < px.length; i += 4) {
        const mx = Math.max(px[i], px[i + 1], px[i + 2]), mn = Math.min(px[i], px[i + 1], px[i + 2]);
        if (mx < 40 || mx - mn < 25) continue; // skip dark and grey pixels: keep the colourful ones
        r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
      }
      if (n) el.style.setProperty('--ac', `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`);
    } catch (e) { /* image not readable (no CORS): keep the chosen accent */ }
  }
  function fill(d, changed) {
    if (!el) return;
    if (KIND === 'counter') {
      const num = el.querySelector('.num');
      const prev = shown ? shown.n : null;
      if (!changed || look.update !== 'count') num.textContent = fmt(d.n, look.numberFormat);
      if (changed) animate(num, prev, d.n);
      const num2 = el.querySelector('.num2');
      if (num2) { const p2 = shown ? shown.vs : null; num2.textContent = fmt(d.vs, look.numberFormat); if (shown && p2 !== d.vs) animate(num2, p2, d.vs); }
      const bar = el.querySelector('.wg-bar i');
      if (bar) bar.style.width = Math.min(100, ((d.n || 0) / look.goal) * 100) + '%';
    } else if (KIND === 'latest') {
      const box = el.querySelector('.nm');
      let name = d.name || '—';
      if (name.length > look.maxChars) name = name.slice(0, look.maxChars - 1) + '…';
      box.innerHTML = `<span>${esc(name)}</span>`;
      const av = el.querySelector('.wg-av');
      if (av && (!shown || shown.avatar !== d.avatar || shown.name !== d.name)) {
        // Twitch profile picture; the first letter on the accent colour until it arrives (or in the demo).
        av.innerHTML = d.avatar ? `<img src="${esc(d.avatar)}" alt="" referrerpolicy="no-referrer">` : `<b>${esc((d.name || '?').charAt(0).toUpperCase())}</b>`;
        const img = av.querySelector('img');
        if (img) img.addEventListener('error', () => { av.innerHTML = `<b>${esc((d.name || '?').charAt(0).toUpperCase())}</b>`; }, { once: true });
      }
      const kindTag = KEY === 'latestSub' && look.showKind && d.kind && d.kind !== 'sub' ? `<span class="tag">${esc(d.kind === 'gift' ? t('Gift') + (d.count > 1 ? ' ×' + d.count : '') : 'Prime')}</span>` : '';
      el.querySelector('.tagslot').innerHTML = kindTag;
      marquee(box);
      if (changed) animate(box, null, null);
    } else {
      el.classList.toggle('playing', d.playing);
      el.classList.toggle('one-line', !look.twoLines);
      const title = el.querySelector('.np-title');
      title.innerHTML = `<span>${esc(d.title ? (look.twoLines || !look.showArtist || !d.artist ? d.title : `${d.title} — ${d.artist}`) : t('Nothing playing'))}</span>`;
      const artist = el.querySelector('.np-artist');
      if (artist) artist.innerHTML = `<span>${esc(d.artist || '')}</span>`;
      const sub = el.querySelector('.np-sub');
      if (sub) {
        const parts = [look.showAlbum && d.album && d.album !== d.title ? d.album : '', look.showApp && d.app ? d.app : ''].filter(Boolean);
        sub.innerHTML = `<span>${esc(parts.join(' · '))}</span>`;
        sub.classList.toggle('empty', !parts.length);
      }
      el.classList.toggle('no-time', !(d.dur > 0));
      if (!shown || shown.cover !== d.cover) setCover(look.cover === 'none' && !look.coverColors ? null : d.cover);
      marquee(title); marquee(artist); marquee(sub);
      el.classList.toggle('hidden-np', !d.playing && look.hideWhenPaused && !DEMO);
      if (changed) animate(el.querySelector('.np-main'), null, null);
    }
    shown = d;
    lastSec = -1;
    tick();
    fitBig();
  }

  // Song position: the app sends where it was at posAt; the widget moves the bar and the time on its own.
  const mmss = (x) => { x = Math.max(0, Math.floor(x)); const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), sec = String(x % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`; };
  function tick() {
    if (KIND !== 'spotify' || !el || !shown || !(shown.dur > 0)) return;
    let pos = shown.pos + (shown.playing ? (Date.now() - shown.posAt) / 1000 : 0);
    pos = shown.demo ? pos % shown.dur : Math.min(shown.dur, pos);
    const k = Math.max(0, Math.min(1, pos / shown.dur));
    el.querySelectorAll('.np-bar i, .np-line i').forEach((i) => { i.style.transform = `scaleX(${k.toFixed(4)})`; });
    const sec = Math.floor(pos);
    if (sec === lastSec) return;
    lastSec = sec;
    const cur = el.querySelector('.np-prog .cur'), tot = el.querySelector('.np-prog .tot');
    if (cur) cur.textContent = mmss(pos);
    if (tot) tot.textContent = mmss(shown.dur);
  }
  if (KIND === 'spotify') setInterval(tick, 250);

  function render() {
    if (!state.settings || !KEY) return;
    const lk = state.settings.widgets && state.settings.widgets.looks && state.settings.widgets.looks[KEY];
    if (!lk) return;
    const k = JSON.stringify(lk) + I18N.lang;
    if (KIND === 'chat') {
      if (!chatW) chatW = WidgetChat.create({ root, esc, t, demo: DEMO });
      if (k !== lookKey) { lookKey = k; look = lk; applyCss(lk); body.className = (body.classList.contains('big') ? 'big ' : '') + 'a-' + lk.align; chatW.build(lk, cssVars(lk)); }
      chatW.setState(state);
      return;
    }
    const d = data();
    // A game counter renamed, or its partner added / removed: rebuild (the label and the layout change).
    const shape = KEY === 'gameCounter' ? JSON.stringify([d.name, d.vsName, d.vs === null]) : '';
    if (k !== lookKey || shape !== render.shape) { lookKey = k; render.shape = shape; look = lk; build(d); return; }
    const same = shown && JSON.stringify(shown) === JSON.stringify(d);
    if (!same) {
      const changed = !!shown && (KIND === 'counter' ? shown.n !== d.n : KIND === 'latest' ? shown.name !== d.name : shown.title !== d.title || shown.artist !== d.artist);
      fill(d, changed);
    }
  }

  // Panel "test" button: fake a change so the update animation can be seen.
  const NAMES = ['pixelcat', 'Bobby_42', 'MamieGaming', 'kiwi', 'ZeroCool', 'tartiflette', 'captain_obvious'];
  const SONGS = [['Paper Puppets', 'Head Flap Boogie', 'Cut-Paper Nights'], ['The Labo', 'Lab Coat Disco', 'Beakers'], ['Cut & Paste', 'Glue Stick Summer', 'Scissors'], ['Nora Vale', 'Neon Rain', 'Night Shift']];
  function test(kind) {
    if (KIND === 'chat') { if (chatW) chatW.test(); return; }
    if (kind === 'entrance') { enter(); return; }
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    if (KEY === 'gameCounter') { fill(Object.assign({}, data(), { n: ((shown && shown.n) || 0) + 1 }), true); return; }
    if (KIND === 'counter') { demo = Object.assign({}, demo, { [KEY]: (demo[KEY] || 0) + 1 + Math.floor(Math.random() * 5) }); if (real()) { fill(Object.assign({}, data(), { n: (shown.n || 0) + 1 }), true); return; } }
    else if (KIND === 'latest') demo = Object.assign({}, demo, { [KEY]: { display: pick(NAMES), kind: pick(['sub', 'prime', 'gift']), count: 5 } });
    else { const [artist, title, album] = pick(SONGS); demo = Object.assign({}, demo, { np: Object.assign({}, demo.np, { artist, title, album, pos: 0, posAt: Date.now(), dur: 150 + Math.floor(Math.random() * 120) }) }); }
    render();
  }

  // ---------- Alerts widget: the sound (output "OBS") and the GIF of the sound playing (any output) ----------
  const APP_HOST = params.get('host') === 'app';
  const mediaUrl = (f) => '/media/' + encodeURIComponent(f);
  // A GIF stays at least 3 s, even with a very short sound.
  let gifAt = 0, gifTimer = 0;
  const alerts = new AlertSound('', {
    onStart(sounds) {
      const gif = (sounds.find((x) => x.gif) || {}).gif;
      clearTimeout(gifTimer);
      root.innerHTML = gif ? `<img class="alert-gif" src="${esc(mediaUrl(gif))}" alt="">` : '';
      body.classList.toggle('alert-on', !!gif);
      gifAt = Date.now();
    },
    onEnd() {
      const img = root.querySelector('.alert-gif');
      if (!img) return;
      gifTimer = setTimeout(() => {
        img.classList.add('out');
        setTimeout(() => { if (root.contains(img)) { root.innerHTML = ''; body.classList.remove('alert-on'); } }, 400);
      }, Math.max(0, 3000 - (Date.now() - gifAt)));
    },
  });
  function renderAlerts() {
    if (W !== 'alerts' || root.querySelector('.alert-gif')) return;
    root.innerHTML = DEMO ? `<span class="placeholder">${esc(t('Alert GIFs show here; the sounds too when “Played by” is set to OBS.'))}</span>` : '';
  }
  // Played here with its sound when the output is this source, else silently (only to show the GIF for as long as the sound lasts).
  function onAlert(a) {
    if (W !== 'alerts' || !a || !Array.isArray(a.sounds)) return;
    const mine = (a.output === 'app') === APP_HOST;
    if (mine) alerts.play(a);
    else if (!APP_HOST && a.sounds.some((x) => x.gif)) alerts.play(a, true);
  }

  function applyState(next) {
    ['settings', 'stats', 'nowPlaying', 'twitchAccount'].forEach((k) => { if (k in next) state[k] = next[k]; });
    if (next.app && next.app.lang && I18N.setLang(next.app.lang)) lookKey = '';
    if (W === 'alerts') renderAlerts(); else render();
  }
  function connect() {
    const es = new EventSource('/api/events');
    es.addEventListener('state', (e) => applyState(JSON.parse(e.data)));
    es.addEventListener('alert-sound', (e) => { if (!DEMO) onAlert(JSON.parse(e.data)); });
  }
  addEventListener('resize', () => { fitBig(); if (el && look) { marquee(el.querySelector('.nm')); marquee(el.querySelector('.np-title')); marquee(el.querySelector('.np-artist')); marquee(el.querySelector('.np-sub')); } });
  if (PREVIEW || FEED) {
    addEventListener('message', (e) => {
      if (e.origin !== location.origin || !e.data) return;
      if (e.data.type === 'po-state') applyState(e.data.state);
      if (e.data.type === 'po-test') test(e.data.kind);
      if (e.data.type === 'po-alert' && FEED) onAlert(e.data.alert);
    });
    window.parent.postMessage({ type: 'po-widget-ready', w: W }, location.origin);
  } else connect();
})();
