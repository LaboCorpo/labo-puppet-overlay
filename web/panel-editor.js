/*
 * Widget editor: one page per widget (sidebar entries "w-<widget>" under Stream widgets), with a menu of
 * categories (themes, appearance, picture, colours, text, size, icon, animations, content) and a search box.
 * Every property comes from web/shared/widget-schema.js. Illustrated choices, a live preview, themes,
 * "apply to all", reset (widget or menu) and share codes.
 * Edits update a local draft and the preview at once; saving is debounced through Panel.save.
 */
(function () {
  'use strict';
  const { $, t, escapeHtml, toast } = Panel;
  const S = WidgetSchema;
  const box = $('#widgetEditor');
  if (!box) return;
  const W_PARAM = { followers: 'followers', subs: 'subs', latestFollower: 'latest-follower', latestSub: 'latest-sub', spotify: 'spotify', chat: 'chat' };
  let current = 'spotify'; // widget of the open page (tab "w-<widget>")
  let draft = null; // look being edited
  let lastEdit = 0, builtFor = '';
  let bg = 'checker';

  const names = () => ({ followers: t('Followers'), subs: t('Subs'), latestFollower: t('Latest follower'), latestSub: t('Latest sub'), spotify: t('Now playing (Spotify)'), chat: t('Live chat') });
  const groupNames = () => ({ presets: t('Themes'), appearance: t('Appearance'), colors: t('Colours'), text: t('Text'), box: t('Size & spacing'), icon: t('Icon'), anim: t('Animations'), content: t('Content') });
  // Labels of the choices (by property when the same word means different things).
  const valueLabel = (key, v) => {
    const byProp = {
      layout: { inline: t('Inline'), stacked: t('Stacked'), badge: t('Badge'), bar: t('Bar'), minimal: t('Minimal'), ticker: t('Ticker'), compact: t('Compact'), boxy: t('Boxy'), gallery: t('Gallery'), window: t('Window'), terminal: t('Terminal'), activity: t('Activity'), stack: t('Boxes'), bubbles: t('Bubbles'), plain: t('Plain text'), compact_c: t('One line') },
      frame: { none: t('None'), pill: t('Pill'), card: t('Card'), glass: t('Glass'), outline: t('Outline'), neon: t('Neon'), paper: t('Paper'), gradient: t('Gradient') },
      cover: { square: t('Square'), rounded: t('Rounded'), circle: t('Round'), vinyl: t('Vinyl'), canvas: t('Blurred background'), none: t('None') },
      align: { left: t('Left'), center: t('Center'), right: t('Right') },
      textShadow: { none: t('None'), soft: t('Soft'), strong: t('Strong'), outline: t('Outline'), glow: t('Glow') },
      shadow: { none: t('None'), soft: t('Soft'), strong: t('Strong'), glow: t('Glow') },
      icon: { none: t('None'), heart: t('Heart'), star: t('Star'), user: t('Person'), crown: t('Crown'), gift: t('Gift'), bolt: t('Lightning'), music: t('Note'), fire: t('Flame'), custom: t('Custom') },
      entrance: { none: t('None'), fade: t('Fade'), 'slide-up': t('Slide up'), 'slide-down': t('Slide down'), 'slide-left': t('From the right'), 'slide-right': t('From the left'), pop: t('Pop'), blur: t('Blur'), flip: t('Flip') },
      update: { none: t('None'), bump: t('Bump'), flip: t('Flip'), count: t('Count up'), glow: t('Glow'), shake: t('Shake'), confetti: t('Confetti') },
      idle: { none: t('None'), float: t('Float'), pulse: t('Pulse'), breathe: t('Breathe'), shine: t('Shine'), wobble: t('Wobble') },
      goalStyle: { both: t('Bar and text'), bar: t('Bar'), text: t('Text') },
      avatar: { circle: t('Round'), rounded: t('Rounded'), square: t('Square'), none: t('None') },
      progress: { bar: t('Bar with times'), line: t('Line along the bottom'), none: t('None') },
      numberFormat: { spaced: '1 234', plain: '1234', compact: '1,2 k' },
    };
    return (byProp[key] && byProp[key][v]) || v;
  };

  // ---------- Illustrations of the choices (64×40) ----------
  const L = 'var(--thumb-fg)', A = 'var(--accent)';
  const rect = (x, y, w, h, r, f, extra) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}" ${extra || ''}/>`;
  const THUMBS = {
    layout: {
      inline: rect(6, 14, 52, 12, 6, '#ffffff18') + rect(10, 17, 6, 6, 3, A) + rect(19, 18, 12, 4, 2, L, 'opacity=".55"') + rect(34, 16, 20, 8, 2, L),
      stacked: rect(6, 8, 52, 24, 6, '#ffffff18') + rect(12, 12, 18, 4, 2, L, 'opacity=".55"') + rect(12, 19, 34, 9, 2, L),
      badge: rect(6, 10, 52, 20, 10, '#ffffff18') + '<circle cx="18" cy="20" r="7" fill="' + A + '"/>' + rect(29, 14, 14, 4, 2, L, 'opacity=".55"') + rect(29, 21, 22, 6, 2, L),
      bar: rect(6, 8, 52, 24, 6, '#ffffff18') + rect(11, 12, 14, 4, 2, L, 'opacity=".55"') + rect(28, 11, 22, 7, 2, L) + rect(11, 23, 42, 4, 2, '#ffffff30') + rect(11, 23, 28, 4, 2, A),
      minimal: rect(14, 14, 36, 12, 3, L),
      ticker: rect(4, 14, 56, 12, 6, '#ffffff18') + rect(8, 18, 10, 4, 2, L, 'opacity=".55"') + rect(21, 18, 26, 4, 2, L) + '<path d="M51 17l4 3-4 3" fill="none" stroke="' + A + '" stroke-width="2"/>',
      compact: rect(4, 10, 56, 20, 10, '#ffffff18') + rect(8, 13, 14, 14, 3, A) + rect(25, 15, 24, 4, 2, L) + rect(25, 22, 16, 3, 1.5, L, 'opacity=".55"'),
      boxy: rect(4, 5, 56, 30, 5, '#ffffff18') + rect(8, 9, 22, 22, 3, A) + rect(34, 11, 20, 4, 2, L) + rect(34, 18, 14, 3, 1.5, L, 'opacity=".55"') + rect(34, 26, 3, 5, 1, A) + rect(39, 24, 3, 7, 1, A) + rect(44, 27, 3, 4, 1, A),
      gallery: rect(16, 2, 32, 36, 5, '#ffffff18') + rect(21, 5, 22, 20, 3, A) + rect(22, 28, 20, 3.5, 1.7, L) + rect(26, 33, 12, 2.5, 1.2, L, 'opacity=".55"'),
      minimal_s: rect(6, 16, 52, 8, 4, '#ffffff18') + rect(10, 18.5, 30, 3, 1.5, L) + rect(43, 18.5, 11, 3, 1.5, L, 'opacity=".5"'),
      window: rect(4, 5, 56, 30, 5, '#ffffff18') + '<circle cx="10" cy="10" r="1.8" fill="#ff5f57"/><circle cx="15" cy="10" r="1.8" fill="#febc2e"/><circle cx="20" cy="10" r="1.8" fill="#28c840"/>' + rect(8, 16, 14, 14, 3, A) + rect(26, 18, 24, 4, 2, L) + rect(26, 25, 16, 3, 1.5, L, 'opacity=".55"'),
      terminal: rect(4, 5, 56, 30, 3, '#0b120d', 'stroke="#39ff88" stroke-width="1.2"') + '<text x="9" y="15" font-size="7" font-family="Consolas,monospace" fill="#39ff88">~$</text>' + rect(9, 20, 32, 3.5, 1, '#39ff88') + rect(9, 27, 20, 3, 1, '#1fbf63'),
      stack: rect(6, 4, 40, 9, 3, '#ffffff22') + rect(9, 7, 8, 3, 1.5, A) + rect(19, 7, 22, 3, 1.5, L) + rect(6, 16, 50, 9, 3, '#ffffff22') + rect(9, 19, 10, 3, 1.5, '#2fd4a3') + rect(21, 19, 30, 3, 1.5, L) + rect(6, 28, 34, 9, 3, '#ffffff22') + rect(9, 31, 7, 3, 1.5, '#ff7a45') + rect(18, 31, 18, 3, 1.5, L),
      bubbles: rect(6, 8, 42, 11, 5, '#ffffff22') + rect(9, 4, 12, 5, 2.5, A) + rect(10, 12, 32, 3, 1.5, L) + rect(6, 25, 52, 11, 5, '#ffffff22') + rect(9, 21, 12, 5, 2.5, '#2fd4a3') + rect(10, 29, 40, 3, 1.5, L),
      plain: rect(6, 9, 8, 3, 1.5, A) + rect(16, 9, 34, 3, 1.5, L) + rect(6, 18, 10, 3, 1.5, '#2fd4a3') + rect(18, 18, 38, 3, 1.5, L) + rect(6, 27, 7, 3, 1.5, '#ff7a45') + rect(15, 27, 26, 3, 1.5, L),
      activity: rect(4, 5, 56, 30, 5, '#ffffff18') + rect(8, 9, 26, 3, 1.5, L, 'opacity=".5"') + rect(8, 15, 16, 16, 3, A) + rect(28, 18, 24, 4, 2, L) + rect(28, 25, 16, 3, 1.5, L, 'opacity=".55"'),
    },
    frame: {
      none: rect(8, 12, 48, 16, 4, 'none', 'stroke="#ffffff40" stroke-dasharray="3 3"') + rect(16, 18, 32, 4, 2, L),
      pill: rect(8, 12, 48, 16, 8, '#ffffff22') + rect(16, 18, 32, 4, 2, L),
      card: rect(8, 10, 48, 20, 4, '#ffffff22') + rect(8, 10, 4, 20, 2, A) + rect(17, 18, 32, 4, 2, L),
      glass: rect(8, 10, 48, 20, 6, '#ffffff14', 'stroke="#ffffff70"') + rect(10, 11, 44, 3, 1.5, '#ffffff35') + rect(16, 18, 32, 4, 2, L),
      outline: rect(8, 10, 48, 20, 5, 'none', 'stroke="' + A + '" stroke-width="2"') + rect(16, 18, 32, 4, 2, L),
      neon: rect(8, 10, 48, 20, 5, '#0006', 'stroke="' + A + '" stroke-width="2" style="filter:drop-shadow(0 0 3px ' + A + ')"') + rect(16, 18, 32, 4, 2, L),
      paper: `<g transform="rotate(-4 32 20)">${rect(11, 13, 46, 18, 3, '#000', 'opacity=".5"')}${rect(8, 10, 46, 18, 3, '#fff4e2', 'stroke="#1d1520" stroke-width="2.5"')}${rect(15, 17, 30, 4, 2, '#1d1520')}</g>`,
      gradient: `<defs><linearGradient id="tg" x1="0" x2="1"><stop offset="0" stop-color="${A}"/><stop offset="1" stop-color="#ff5fa2"/></linearGradient></defs>` + rect(8, 10, 48, 20, 8, 'url(#tg)') + rect(16, 18, 32, 4, 2, '#fff'),
    },
    cover: {
      square: rect(20, 8, 24, 24, 1, L),
      rounded: rect(20, 8, 24, 24, 6, L),
      circle: '<circle cx="32" cy="20" r="12" fill="' + L + '"/>',
      vinyl: '<circle cx="32" cy="20" r="13" fill="#111" stroke="#2a2a2a"/><circle cx="32" cy="20" r="9" fill="none" stroke="#2a2a2a"/><circle cx="32" cy="20" r="5.5" fill="' + A + '"/><circle cx="32" cy="20" r="1.2" fill="#111"/>',
      canvas: rect(10, 6, 44, 28, 5, A, 'opacity=".35"') + rect(22, 12, 16, 16, 3, L),
      none: rect(20, 8, 24, 24, 4, L, 'opacity=".9"') + '<path d="M25 13l14 14M39 13L25 27" stroke="#0d0b12" stroke-width="4" stroke-linecap="round"/>',
    },
  };
  THUMBS.avatar = {
    circle: '<circle cx="18" cy="20" r="9" fill="' + A + '"/>' + rect(31, 17, 24, 6, 3, L),
    rounded: rect(9, 11, 18, 18, 5, A) + rect(31, 17, 24, 6, 3, L),
    square: rect(9, 11, 18, 18, 1.5, A) + rect(31, 17, 24, 6, 3, L),
    none: rect(12, 17, 40, 6, 3, L),
  };
  function thumb(key, v) {
    const set = THUMBS[key] || {};
    const svg = (key === 'layout' && v === 'minimal' && S.KIND[current] === 'spotify' ? THUMBS.layout.minimal_s : key === 'layout' && v === 'compact' && S.KIND[current] === 'chat' ? THUMBS.layout.minimal_s : set[v]) || '';
    return `<svg viewBox="0 0 64 40" aria-hidden="true">${svg}</svg>`;
  }

  // ---------- Controls ----------
  function control(p) {
    const v = draft[p.key];
    const id = 'we-' + p.key;
    const lbl = escapeHtml(t(p.label));
    if (p.type === 'enum' && p.cards) {
      return `<div class="we-field wide"><div class="we-label">${lbl}</div><div class="we-cards">${S.valuesFor(p, current).map((x) => `
        <button class="we-card${x === v ? ' on' : ''}" data-k="${p.key}" data-v="${x}">${thumb(p.key, x)}<span>${escapeHtml(valueLabel(p.key, x))}</span></button>`).join('')}</div></div>`;
    }
    if (p.type === 'enum') {
      return `<div class="we-field${S.valuesFor(p, current).length > 5 ? ' wide' : ''}"><div class="we-label">${lbl}</div><div class="we-chips">${S.valuesFor(p, current).map((x) => `
        <button class="we-chip${x === v ? ' on' : ''}" data-k="${p.key}" data-v="${x}">${escapeHtml(valueLabel(p.key, x))}</button>`).join('')}</div></div>`;
    }
    if (p.type === 'color') {
      return `<label class="we-field we-color"><span class="we-label">${lbl}</span><span class="we-cin"><input type="color" data-k="${p.key}" value="${v}"><input class="hex" data-k="${p.key}" value="${v}" maxlength="7" spellcheck="false"></span></label>`;
    }
    if (p.type === 'num') {
      const big = p.max > 1000;
      return `<label class="we-field"><span class="we-label">${lbl} <output data-out="${p.key}">${fmtNum(p, v)}</output></span>
        ${big ? `<input type="number" data-k="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}">` : `<input type="range" data-k="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}">`}</label>`;
    }
    if (p.type === 'bool') {
      return `<label class="we-field we-bool"><input type="checkbox" class="switch" data-k="${p.key}"${v ? ' checked' : ''}><span>${lbl}</span></label>`;
    }
    if (p.type === 'font') {
      const known = S.FONTS.includes(v);
      return `<label class="we-field"><span class="we-label">${lbl}</span><span class="we-font"><select data-k="${p.key}" data-font>${S.FONTS.map((f) => `<option value="${escapeHtml(f)}" style="font-family:'${escapeHtml(f)}'"${f === v ? ' selected' : ''}>${escapeHtml(f)}</option>`).join('')}<option value="__other"${known ? '' : ' selected'}>${escapeHtml(t('Other font…'))}</option></select>
        <input data-k="${p.key}" data-fontcustom class="${known ? 'hidden' : ''}" value="${escapeHtml(known ? '' : v)}" placeholder="${escapeHtml(t('Font name installed on Windows'))}" spellcheck="false"></span></label>`;
    }
    return `<label class="we-field"><span class="we-label">${lbl}</span><input data-k="${p.key}" value="${escapeHtml(v)}" maxlength="${p.max}" placeholder="${p.key === 'label' ? escapeHtml(names()[current]) : ''}"></label>`;
  }
  const fmtNum = (p, v) => (p.key === 'width' && !v ? t('auto') : `${v}${p.unit || ''}`);

  function presetsHtml() {
    return `<div class="we-presets">${S.PRESETS.map((pr) => {
      const p = Object.assign({}, S.defaultLook(current), pr.props);
      const bgc = p.frame === 'gradient' ? `linear-gradient(${p.gradAngle}deg, ${p.accent}, ${p.gradColor})` : p.frame === 'none' ? 'transparent' : hexA(p.bgColor, p.bgOpacity / 100);
      const border = p.frame === 'neon' || p.frame === 'outline' ? `2px solid ${p.accent}` : p.frame === 'paper' ? '2px solid #1d1520' : p.frame === 'glass' ? '1px solid #ffffff60' : '1px solid transparent';
      const glow = p.frame === 'neon' ? `0 0 10px ${p.accent}` : p.frame === 'paper' ? '3px 3px 0 #0008' : 'none';
      return `<button class="we-preset" data-preset="${pr.id}"><span class="pv" style="background:${bgc};border:${border};box-shadow:${glow};color:${p.textColor};font-family:'${p.font}';border-radius:${Math.min(p.radius, 14)}px;${p.frame === 'paper' ? 'transform:rotate(-2deg);' : ''}">
        <i style="background:${p.accent}"></i>${escapeHtml(t(pr.name))}</span></button>`;
    }).join('')}</div>
    <div class="paste" style="margin-top:12px"><input id="weCode" placeholder="${escapeHtml(t('Paste a WID1.… style code from a friend'))}" spellcheck="false"><button class="small" data-act="import">${escapeHtml(t('Apply'))}</button></div>`;
  }
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  // ---------- Page: header, menu of categories, preview, the fields of one category ----------
  const ORIGIN = location.origin.replace('127.0.0.1', 'localhost');
  let cat = 'presets', query = '';
  const catName = (g) => (g === 'media' ? (S.KIND[current] === 'spotify' ? t('Album cover') : t('Profile picture')) : groupNames()[g]);
  const cats = () => { const props = S.propsFor(current); return S.GROUPS.map(([g]) => g).filter((g) => g === 'presets' || props.some((p) => p.group === g)); };

  function renderHead() {
    const head = $('#weHead');
    const url = `${ORIGIN}/widget.html?w=${W_PARAM[current]}`;
    head.innerHTML = `<div class="we-head">
      <button class="ghost small" data-goto="stream">← ${escapeHtml(t('All widgets'))}</button>
      <h1>${escapeHtml(names()[current])}</h1>
      <div class="we-url"><code>${escapeHtml(url)}</code><button class="small" data-copyurl="${escapeHtml(url)}">${escapeHtml(t('Copy the OBS link'))}</button></div>
    </div>`;
    $('#weSpotify').classList.toggle('hidden', current !== 'spotify');
    $('#weChat').classList.toggle('hidden', current !== 'chat');
    renderChatChans();
  }
  function build() {
    const st = Panel.state;
    draft = Object.assign({}, st.settings.widgets.looks[current]);
    builtFor = current + I18N.lang;
    if (!cats().includes(cat)) cat = 'presets';
    renderHead();
    box.innerHTML = `
      <div class="we-layout">
        <nav class="we-menu" id="weMenu"></nav>
        <div class="we-main">
          <div class="we-stage card">
            <div class="we-preview bg-${bg}"><iframe id="wePreview" src="widget.html?w=${W_PARAM[current]}&preview=1&big=1" title="preview"></iframe></div>
            <div class="we-tools">
              <span class="muted">${escapeHtml(t('Preview background:'))}</span>
              ${['checker', 'dark', 'light', 'game'].map((b) => `<button class="we-chip${b === bg ? ' on' : ''}" data-bg="${b}">${escapeHtml({ checker: t('Transparent'), dark: t('Dark'), light: t('Light'), game: t('Colourful') }[b])}</button>`).join('')}
              <span class="grow"></span>
              <button class="ghost small" data-test="update">⚡ ${escapeHtml(t('Test a change'))}</button>
              <button class="ghost small" data-test="entrance">↻ ${escapeHtml(t('Replay the entrance'))}</button>
            </div>
          </div>
          <div class="we-pane card" id="wePane"></div>
        </div>
      </div>`;
    renderMenu();
    renderPane(true);
  }
  function renderMenu() {
    const props = S.propsFor(current);
    const focused = document.activeElement && document.activeElement.id === 'weFind';
    $('#weMenu').innerHTML = `<input id="weFind" type="search" placeholder="${escapeHtml(t('Find a setting…'))}" value="${escapeHtml(query)}" spellcheck="false">
      ${cats().map((g) => {
        const n = g === 'presets' ? S.PRESETS.length : props.filter((p) => p.group === g).length;
        return `<button class="we-cat${g === cat && !query ? ' on' : ''}" data-cat="${g}"><svg class="ci"><use href="#wc-${g}"/></svg><span>${escapeHtml(catName(g))}</span><em>${n}</em></button>`;
      }).join('')}
      <div class="we-menu-foot">
        <button class="ghost small" data-act="all">${escapeHtml(t('Apply this style to all widgets'))}</button>
        <button class="ghost small" data-act="share">${escapeHtml(t('Copy style code'))}</button>
        <button class="ghost small danger-text" data-act="reset">${escapeHtml(t('Reset this widget'))}</button>
      </div>`;
    if (focused) { const f = $('#weFind'); f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
  }
  function renderPane(animate) {
    const pane = $('#wePane');
    if (!pane) return;
    const props = S.propsFor(current);
    let html;
    if (query) {
      const q = query.toLowerCase();
      const hits = props.filter((p) => t(p.label).toLowerCase().includes(q) || p.label.toLowerCase().includes(q) || catName(p.group).toLowerCase().includes(q));
      html = `<div class="we-pane-head"><h3>${escapeHtml(t('Search results'))}</h3><span class="muted">${hits.length}</span></div>` + (hits.length
        ? cats().filter((g) => hits.some((p) => p.group === g)).map((g) => `<div class="we-sub">${escapeHtml(catName(g))}</div><div class="we-grid">${hits.filter((p) => p.group === g).map(control).join('')}</div>`).join('')
        : `<p class="muted">${escapeHtml(t('No setting matches.'))}</p>`);
    } else if (cat === 'presets') {
      html = `<div class="we-pane-head"><h3>${escapeHtml(catName('presets'))}</h3></div><p class="muted">${escapeHtml(t('A theme changes colours, frame and text style; your texts, goals and layout stay.'))}</p>${presetsHtml()}`;
    } else {
      html = `<div class="we-pane-head"><h3>${escapeHtml(catName(cat))}</h3><button class="ghost small" data-act="reset-cat">↺ ${escapeHtml(t('Reset this menu'))}</button></div>
        <div class="we-grid">${props.filter((p) => p.group === cat).map(control).join('')}</div>`;
    }
    pane.innerHTML = html;
    if (animate) { pane.classList.remove('swap'); void pane.offsetWidth; pane.classList.add('swap'); }
  }

  // ---------- Live preview ----------
  function previewState() {
    const s = Panel.state;
    const settings = Object.assign({}, s.settings, { widgets: Object.assign({}, s.settings.widgets, { looks: Object.assign({}, s.settings.widgets.looks, { [current]: draft }) }) });
    return { settings, stats: s.stats, nowPlaying: s.nowPlaying, app: { lang: I18N.lang } };
  }
  function feed() {
    const f = $('#wePreview');
    if (f && f.contentWindow) f.contentWindow.postMessage({ type: 'po-state', state: previewState() }, location.origin);
  }
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'po-widget-ready') return;
    const f = $('#wePreview');
    if (f && e.source === f.contentWindow) feed();
  });

  // ---------- Editing ----------
  function set(key, value, rebuild) {
    const p = S.PROPS.find((x) => x.key === key);
    if (!p) return;
    draft[key] = value;
    lastEdit = Date.now();
    Panel.state.settings.widgets.looks[current] = Object.assign({}, draft); // the small previews follow too
    Panel.save(`widgets.looks.${current}.${key}`, value);
    if (rebuild) refreshControls();
    feed();
  }
  function setLook(look, msg) {
    draft = S.sanitizeLook(current, look, draft);
    lastEdit = Date.now();
    Panel.state.settings.widgets.looks[current] = Object.assign({}, draft);
    Panel.save(`widgets.looks.${current}`, Object.assign({}, draft));
    refreshControls();
    feed();
    if (msg) toast(t(msg));
  }
  // Redraws the fields of the open menu (the preview keeps running).
  function refreshControls() {
    const scroll = document.querySelector('main').scrollTop;
    renderPane(false);
    document.querySelector('main').scrollTop = scroll;
  }

  box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !box.contains(b)) return;
    if (b.dataset.cat) {
      cat = b.dataset.cat; query = '';
      renderMenu(); renderPane(true);
      const top = box.getBoundingClientRect().top; if (top < 0) document.querySelector('main').scrollBy({ top, behavior: 'smooth' });
      return;
    }
    if (b.dataset.copyurl) return;
    if (b.dataset.bg) { bg = b.dataset.bg; box.querySelector('.we-preview').className = 'we-preview bg-' + bg; box.querySelectorAll('[data-bg]').forEach((x) => x.classList.toggle('on', x === b)); return; }
    if (b.dataset.test) { const f = $('#wePreview'); if (f) f.contentWindow.postMessage({ type: 'po-test', kind: b.dataset.test }, location.origin); return; }
    if (b.dataset.k && b.dataset.v !== undefined) {
      const k = b.dataset.k;
      box.querySelectorAll(`[data-k="${k}"][data-v]`).forEach((x) => x.classList.toggle('on', x === b));
      set(k, b.dataset.v, k === 'layout' || k === 'icon');
      return;
    }
    if (b.dataset.preset) { setLook(S.applyPreset(draft, b.dataset.preset), 'Theme applied'); return; }
    const act = b.dataset.act;
    if (act === 'reset') setLook(S.defaultLook(current), 'Widget reset');
    if (act === 'reset-cat') {
      const next = Object.assign({}, draft), def = S.defaultLook(current);
      for (const p of S.propsFor(current)) if (p.group === cat) next[p.key] = def[p.key];
      setLook(next, 'Menu reset');
    }
    if (act === 'share') navigator.clipboard.writeText(S.encodeStyle(draft)).then(() => toast(t('Style code copied: send it to a friend')), () => toast(t('Could not copy')));
    if (act === 'import') {
      const next = S.decodeStyle($('#weCode').value, draft, current);
      if (!next) { toast(t('This is not a valid style code')); return; }
      $('#weCode').value = '';
      setLook(next, 'Style applied');
    }
    if (act === 'all') {
      const looks = Object.assign({}, Panel.state.settings.widgets.looks);
      for (const w of S.WIDGETS) if (w !== current) looks[w] = S.copyStyle(draft, looks[w], w);
      Panel.state.settings.widgets.looks = looks;
      Panel.save('widgets.looks', looks);
      lastEdit = Date.now();
      toast(t('Style applied to all widgets'));
    }
  });
  box.addEventListener('input', (e) => {
    const el = e.target, k = el.dataset.k;
    if (el.id === 'weFind') { query = el.value.trim().slice(0, 40); renderMenu(); renderPane(false); return; }
    if (!k) return;
    const p = S.PROPS.find((x) => x.key === k);
    if (p.type === 'num') {
      const v = Number(el.value);
      const out = box.querySelector(`[data-out="${k}"]`); if (out) out.textContent = fmtNum(p, v);
      set(k, v);
    } else if (p.type === 'color') {
      const v = el.value.trim();
      if (!/^#[0-9a-f]{6}$/i.test(v)) return;
      box.querySelectorAll(`[data-k="${k}"]`).forEach((x) => { if (x !== el) x.value = v; });
      set(k, v.toLowerCase());
    } else if (p.type === 'text') set(k, el.value.slice(0, p.max));
    else if (p.type === 'font' && el.hasAttribute('data-fontcustom')) { if (/^[\w .,'-]{1,60}$/.test(el.value.trim())) set(k, el.value.trim()); }
  });
  box.addEventListener('change', (e) => {
    const el = e.target, k = el.dataset.k;
    if (!k) return;
    if (el.type === 'checkbox') { set(k, el.checked, k === 'showLabel'); return; }
    if (el.hasAttribute('data-font')) {
      const custom = el.parentElement.querySelector('[data-fontcustom]');
      if (el.value === '__other') { custom.classList.remove('hidden'); custom.focus(); return; }
      custom.classList.add('hidden');
      set(k, el.value);
    }
  });

  // Rows of the widget list: "Customise" opens that widget's page.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-customize]');
    if (b) Panel.showTab('w-' + b.dataset.customize);
    const c = e.target.closest('#weHead [data-copyurl]');
    if (c) navigator.clipboard.writeText(c.dataset.copyurl).then(() => toast(t('Copied: add it as a Browser Source in OBS')), () => toast(t('Could not copy')));
  });

  function renderChatChans() {
    const st = Panel.state.settings;
    if (!st || current !== 'chat') return;
    const list = st.widgets.chat.channels;
    $('#weChatChans').textContent = list.length ? list.join(' x ') : (st.twitch.channel || (Panel.state.twitchAccount || {}).login || t('your channel'));
  }
  $('#weChatReset').onclick = () => Panel.save('widgets.chat.channels', []);
  Panel.onState(renderChatChans);
  const onPage = () => /^w-/.test(Panel.tab || '') && S.WIDGETS.includes(Panel.tab.slice(2));
  Panel.onState((s, langChanged) => {
    if (!s.settings || !onPage()) return;
    const fresh = Date.now() - lastEdit > 1500;
    // Rebuild on language change, first time, or when the look changed elsewhere (not while editing).
    if (langChanged || builtFor !== current + I18N.lang || (fresh && draft && JSON.stringify(draft) !== JSON.stringify(s.settings.widgets.looks[current]) && !box.contains(document.activeElement))) build();
    else feed();
  });
  // One page per widget; the preview only runs while the page is shown.
  Panel.onTab((name) => {
    if (/^w-/.test(name) && S.WIDGETS.includes(name.slice(2))) {
      if (name.slice(2) !== current) { current = name.slice(2); query = ''; builtFor = ''; }
      if (Panel.state.settings && builtFor !== current + I18N.lang) build(); else if (Panel.state.settings) feed();
    } else if (builtFor) { box.innerHTML = ''; builtFor = ''; }
  });
})();
