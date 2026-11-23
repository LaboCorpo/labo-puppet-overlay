/*
 * OBS widget looks: every customisable property in one place, used by
 *  - the main process (settings validation: sanitizeLooks),
 *  - the panel (the editor is generated from PROPS),
 *  - widget.js (rendering).
 * One look per widget (followers, subs, latestFollower, latestSub, spotify). Exposes window.WidgetSchema
 * in pages and module.exports in Node.
 */
(function (root) {
  'use strict';

  // Widget -> kind. A property applies to some kinds only.
  const KIND = { followers: 'counter', subs: 'counter', latestFollower: 'latest', latestSub: 'latest', spotify: 'spotify', chat: 'chat' };
  const WIDGETS = Object.keys(KIND);
  const ALL = ['counter', 'latest', 'spotify'];
  // Editor menus, in order. 'media' is the album cover (Spotify) or the profile picture (latest follower / sub).
  const GROUPS = [
    ['presets', 'Themes'], ['appearance', 'Appearance'], ['media', 'Picture'], ['colors', 'Colours'], ['text', 'Text'],
    ['box', 'Size & spacing'], ['icon', 'Icon'], ['anim', 'Animations'], ['content', 'Content'],
  ];
  const FONTS = ['Segoe UI', 'Bahnschrift', 'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia',
    'Corbel', 'Courier New', 'Franklin Gothic Medium', 'Gabriola', 'Georgia', 'Impact', 'Ink Free', 'Lucida Console', 'Palatino Linotype',
    'Segoe Print', 'Segoe Script', 'Sitka Text', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];

  const PROPS = [];
  const add = (key, def) => PROPS.push(Object.assign({ key, kinds: ALL.slice() }, def));

  // ---------- Appearance ----------
  add('layout', { group: 'appearance', label: 'Layout', type: 'enum', cards: true,
    values: { counter: ['inline', 'stacked', 'badge', 'bar', 'minimal'], latest: ['inline', 'stacked', 'badge', 'ticker', 'minimal'],
      spotify: ['compact', 'boxy', 'gallery', 'minimal', 'window', 'terminal', 'activity'], chat: ['stack', 'bubbles', 'plain', 'compact'] },
    def: { counter: 'inline', latest: 'inline', spotify: 'compact', chat: 'stack' } });
  add('frame', { group: 'appearance', label: 'Frame', type: 'enum', cards: true, values: ['none', 'pill', 'card', 'glass', 'outline', 'neon', 'paper', 'gradient'], def: 'pill' });
  add('align', { group: 'appearance', label: 'Alignment', type: 'enum', values: ['left', 'center', 'right'], def: 'left' });

  // ---------- Colours ----------
  add('textColor', { group: 'colors', label: 'Text', type: 'color', def: '#ffffff' });
  add('subColor', { group: 'colors', label: 'Secondary text', type: 'color', def: '#d9d0ea' });
  add('accent', { group: 'colors', label: 'Accent', type: 'color', def: '#a970ff' });
  add('bgColor', { group: 'colors', label: 'Background', type: 'color', def: '#0d0b12' });
  add('bgOpacity', { group: 'colors', label: 'Background opacity', type: 'num', min: 0, max: 100, step: 1, unit: '%', def: 72 });
  add('gradColor', { group: 'colors', label: 'Second gradient colour', type: 'color', def: '#ff5fa2' });
  add('gradAngle', { group: 'colors', label: 'Gradient angle', type: 'num', min: 0, max: 360, step: 5, unit: '°', def: 135 });
  add('borderColor', { group: 'colors', label: 'Border', type: 'color', def: '#ffffff' });
  add('borderOpacity', { group: 'colors', label: 'Border opacity', type: 'num', min: 0, max: 100, step: 1, unit: '%', def: 18 });
  add('textGradient', { group: 'colors', label: 'Gradient text (accent → second colour)', type: 'bool', def: false });

  // ---------- Text ----------
  add('font', { group: 'text', label: 'Font', type: 'font', def: 'Segoe UI' });
  add('fontWeight', { group: 'text', label: 'Weight', type: 'num', min: 300, max: 900, step: 100, def: 800 });
  add('size', { group: 'text', label: 'Text size', type: 'num', min: 12, max: 200, step: 1, unit: 'px', def: 40 });
  add('labelScale', { group: 'text', label: 'Label size', type: 'num', min: 30, max: 120, step: 1, unit: '%', def: 58 });
  add('letterSpacing', { group: 'text', label: 'Letter spacing', type: 'num', min: -2, max: 12, step: 0.5, unit: 'px', def: 0 });
  add('uppercase', { group: 'text', label: 'Labels in capitals', type: 'bool', def: true });
  add('italic', { group: 'text', label: 'Italic', type: 'bool', def: false });
  add('textShadow', { group: 'text', label: 'Text shadow', type: 'enum', values: ['none', 'soft', 'strong', 'outline', 'glow'], def: 'soft' });

  // ---------- Size & spacing ----------
  add('radius', { group: 'box', label: 'Corner radius', type: 'num', min: 0, max: 80, step: 1, unit: 'px', def: 30 });
  add('padding', { group: 'box', label: 'Inner spacing', type: 'num', min: 0, max: 80, step: 1, unit: 'px', def: 14 });
  add('gap', { group: 'box', label: 'Gap between elements', type: 'num', min: 0, max: 60, step: 1, unit: 'px', def: 12 });
  add('borderWidth', { group: 'box', label: 'Border width', type: 'num', min: 0, max: 10, step: 1, unit: 'px', def: 0 });
  add('width', { group: 'box', label: 'Fixed width (0 = automatic)', type: 'num', min: 0, max: 1600, step: 10, unit: 'px', def: 0 });
  add('shadow', { group: 'box', label: 'Shadow', type: 'enum', values: ['none', 'soft', 'strong', 'glow'], def: 'soft' });
  add('blur', { group: 'box', label: 'Glass blur', type: 'num', min: 0, max: 30, step: 1, unit: 'px', def: 14 });
  add('barHeight', { group: 'box', label: 'Bar thickness', type: 'num', min: 2, max: 30, step: 1, unit: 'px', kinds: ['counter', 'spotify'], def: 6 });

  // ---------- Picture: album cover / profile picture ----------
  add('cover', { group: 'media', label: 'Album cover', type: 'enum', cards: true, kinds: ['spotify'], values: ['square', 'rounded', 'circle', 'vinyl', 'canvas', 'none'], def: 'rounded' });
  add('coverSize', { group: 'media', label: 'Cover size', type: 'num', min: 50, max: 250, step: 5, unit: '%', kinds: ['spotify'], def: 100 });
  add('coverColors', { group: 'media', label: 'Accent taken from the album cover', type: 'bool', kinds: ['spotify'], def: false });
  add('avatar', { group: 'media', label: 'Profile picture', type: 'enum', cards: true, kinds: ['latest'], values: ['circle', 'rounded', 'square', 'none'], def: 'circle' });
  add('avatarSize', { group: 'media', label: 'Picture size', type: 'num', min: 50, max: 250, step: 5, unit: '%', kinds: ['latest'], def: 100 });
  add('avatarRing', { group: 'media', label: 'Accent ring around the picture', type: 'bool', kinds: ['latest'], def: true });

  // ---------- Icon ----------
  add('icon', { group: 'icon', label: 'Icon', type: 'enum', values: ['none', 'heart', 'star', 'user', 'crown', 'gift', 'bolt', 'music', 'fire', 'custom'], def: 'none' });
  add('iconText', { group: 'icon', label: 'Custom icon (emoji or text)', type: 'text', max: 4, def: '★' });
  add('iconColor', { group: 'icon', label: 'Icon colour', type: 'color', def: '#ff5fa2' });
  add('iconSize', { group: 'icon', label: 'Icon size', type: 'num', min: 50, max: 200, step: 5, unit: '%', def: 100 });

  // ---------- Animations ----------
  add('entrance', { group: 'anim', label: 'Entrance', type: 'enum', values: ['none', 'fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'pop', 'blur', 'flip'], def: 'slide-up' });
  add('update', { group: 'anim', label: 'When it changes', type: 'enum', values: ['none', 'bump', 'flip', 'count', 'glow', 'shake', 'confetti'], def: 'bump' });
  add('idle', { group: 'anim', label: 'While waiting', type: 'enum', values: ['none', 'float', 'pulse', 'breathe', 'shine', 'wobble'], def: 'none' });
  add('speed', { group: 'anim', label: 'Animation speed', type: 'num', min: 25, max: 300, step: 5, unit: '%', def: 100 });
  add('marquee', { group: 'anim', label: 'Scroll long text', type: 'bool', kinds: ['latest', 'spotify'], def: true });
  add('equalizer', { group: 'anim', label: 'Equalizer bars while playing', type: 'bool', kinds: ['spotify'], def: true });

  // ---------- Content ----------
  add('showLabel', { group: 'content', label: 'Show the label', type: 'bool', def: true });
  add('label', { group: 'content', label: 'Label (empty = default)', type: 'text', max: 40, def: '' });
  add('goal', { group: 'content', label: 'Goal (0 = none)', type: 'num', min: 0, max: 10000000, step: 1, kinds: ['counter'], def: 0 });
  add('goalStyle', { group: 'content', label: 'Show the goal as', type: 'enum', values: ['both', 'bar', 'text'], kinds: ['counter'], def: 'both' });
  add('numberFormat', { group: 'content', label: 'Number format', type: 'enum', values: ['spaced', 'plain', 'compact'], kinds: ['counter'], def: 'spaced' });
  add('prefix', { group: 'content', label: 'Text before the number', type: 'text', max: 12, kinds: ['counter'], def: '' });
  add('suffix', { group: 'content', label: 'Text after the number', type: 'text', max: 12, kinds: ['counter'], def: '' });
  add('maxChars', { group: 'content', label: 'Max name length', type: 'num', min: 6, max: 60, step: 1, kinds: ['latest'], def: 24 });
  add('showKind', { group: 'content', label: 'Show Prime / gift', type: 'bool', kinds: ['latest'], def: true });
  add('showArtist', { group: 'content', label: 'Show the artist', type: 'bool', kinds: ['spotify'], def: true });
  add('twoLines', { group: 'content', label: 'Title and artist on two lines', type: 'bool', kinds: ['spotify'], def: true });
  add('showAlbum', { group: 'content', label: 'Show the album', type: 'bool', kinds: ['spotify'], def: false });
  add('progress', { group: 'content', label: 'Progress', type: 'enum', kinds: ['spotify'], values: ['bar', 'line', 'none'], def: 'bar' });
  add('showTime', { group: 'content', label: 'Show the time (1:02 / 3:20)', type: 'bool', kinds: ['spotify'], def: true });
  add('showApp', { group: 'content', label: 'Show the player name', type: 'bool', kinds: ['spotify'], def: false });
  add('hideWhenPaused', { group: 'content', label: 'Hide when nothing is playing', type: 'bool', kinds: ['spotify'], def: true });

  // ---------- Live chat widget ----------
  // Style properties shared with the other widgets (each message is a box styled like a widget).
  ['layout', 'frame', 'align', 'textColor', 'subColor', 'accent', 'bgColor', 'bgOpacity', 'gradColor', 'gradAngle', 'borderColor', 'borderOpacity',
    'font', 'fontWeight', 'size', 'labelScale', 'letterSpacing', 'uppercase', 'italic', 'textShadow', 'radius', 'padding', 'gap', 'borderWidth', 'width',
    'shadow', 'blur', 'entrance', 'speed', 'showLabel', 'label'].forEach((k) => PROPS.find((p) => p.key === k).kinds.push('chat'));
  add('maxMessages', { group: 'content', label: 'Messages shown', type: 'num', min: 1, max: 40, step: 1, kinds: ['chat'], def: 8 });
  add('fadeAfter', { group: 'content', label: 'Hide a message after (0 = never)', type: 'num', min: 0, max: 600, step: 5, unit: 's', kinds: ['chat'], def: 0 });
  add('newest', { group: 'content', label: 'Newest message', type: 'enum', values: ['bottom', 'top'], kinds: ['chat'], def: 'bottom' });
  add('nameColor', { group: 'colors', label: 'Name colour', type: 'enum', values: ['twitch', 'accent', 'text'], kinds: ['chat'], def: 'twitch' });
  add('showBadges', { group: 'content', label: 'Show badges (mod, VIP, sub…)', type: 'bool', kinds: ['chat'], def: true });
  add('showChannel', { group: 'content', label: 'Show the channel (several chats)', type: 'bool', kinds: ['chat'], def: true });
  add('hideCommands', { group: 'content', label: 'Hide !commands', type: 'bool', kinds: ['chat'], def: true });
  add('hideBots', { group: 'content', label: 'Hide bots (Nightbot, StreamElements…)', type: 'bool', kinds: ['chat'], def: true });
  add('highlightFirst', { group: 'content', label: 'Highlight first messages', type: 'bool', kinds: ['chat'], def: true });
  add('emoteScale', { group: 'text', label: 'Emote size', type: 'num', min: 80, max: 300, step: 10, unit: '%', kinds: ['chat'], def: 130 });

  // Per-widget defaults on top of the property defaults.
  const WIDGET_DEFAULTS = {
    followers: { icon: 'heart' },
    subs: { icon: 'star', iconColor: '#ffd166' },
    latestFollower: { icon: 'heart' },
    latestSub: { icon: 'crown', iconColor: '#ffd166' },
    spotify: { showLabel: false, accent: '#2fd4a3', icon: 'none' },
    chat: { showLabel: false, size: 22, fontWeight: 600, radius: 14, padding: 9, gap: 8, frame: 'card', entrance: 'slide-up', uppercase: false, width: 420 },
  };

  // Ready-made themes: only style properties (labels, goals and other content are kept).
  const PRESETS = [
    { id: 'spotify', name: 'Spotify', props: { frame: 'card', bgColor: '#121212', bgOpacity: 94, accent: '#1ed760', gradColor: '#1db954', textColor: '#ffffff', subColor: '#b3b3b3', iconColor: '#1ed760', font: 'Segoe UI', fontWeight: 800, radius: 12, borderWidth: 0, shadow: 'strong', textShadow: 'none', idle: 'none', textGradient: false, coverColors: true } },
    { id: 'labo', name: 'Labo', props: { frame: 'pill', bgColor: '#0d0b12', bgOpacity: 72, accent: '#a970ff', textColor: '#ffffff', subColor: '#d9d0ea', font: 'Segoe UI', fontWeight: 800, radius: 30, borderWidth: 0, shadow: 'soft', textShadow: 'soft', idle: 'none', textGradient: false } },
    { id: 'neon', name: 'Neon', props: { frame: 'neon', bgColor: '#07060c', bgOpacity: 88, accent: '#00e5ff', textColor: '#ffffff', subColor: '#9ff6ff', radius: 14, borderWidth: 2, shadow: 'glow', textShadow: 'glow', idle: 'pulse', font: 'Bahnschrift', fontWeight: 700 } },
    { id: 'glass', name: 'Glass', props: { frame: 'glass', bgColor: '#ffffff', bgOpacity: 14, accent: '#ffffff', textColor: '#ffffff', subColor: '#eeeaf6', borderColor: '#ffffff', borderOpacity: 35, borderWidth: 1, radius: 22, blur: 18, shadow: 'soft', textShadow: 'soft' } },
    { id: 'paper', name: 'Paper', props: { frame: 'paper', bgColor: '#fff4e2', bgOpacity: 100, accent: '#ff7a45', textColor: '#1d1520', subColor: '#6b5a66', iconColor: '#ff7a45', radius: 10, borderWidth: 3, borderColor: '#1d1520', borderOpacity: 100, shadow: 'strong', textShadow: 'none', font: 'Trebuchet MS', fontWeight: 800, idle: 'wobble' } },
    { id: 'minimal', name: 'Minimal', props: { frame: 'none', textColor: '#ffffff', subColor: '#eeeeee', accent: '#ffffff', textShadow: 'strong', shadow: 'none', uppercase: false, fontWeight: 700, idle: 'none' } },
    { id: 'terminal', name: 'Terminal', props: { frame: 'outline', bgColor: '#030803', bgOpacity: 92, accent: '#39ff88', textColor: '#39ff88', subColor: '#1fbf63', iconColor: '#39ff88', font: 'Consolas', fontWeight: 700, radius: 4, borderWidth: 2, shadow: 'glow', textShadow: 'glow', uppercase: true } },
    { id: 'candy', name: 'Candy', props: { frame: 'gradient', accent: '#ff5fa2', gradColor: '#7a5cff', gradAngle: 120, textColor: '#ffffff', subColor: '#fff0fa', iconColor: '#ffffff', radius: 40, shadow: 'strong', textShadow: 'soft', idle: 'float', font: 'Segoe UI', fontWeight: 900 } },
    { id: 'sunset', name: 'Sunset', props: { frame: 'gradient', accent: '#ff7a45', gradColor: '#ff2d6f', gradAngle: 100, textColor: '#ffffff', subColor: '#fff1e8', iconColor: '#ffe066', radius: 18, shadow: 'soft', textShadow: 'soft', idle: 'shine' } },
    { id: 'mono', name: 'Mono', props: { frame: 'card', bgColor: '#000000', bgOpacity: 85, accent: '#ffffff', textColor: '#ffffff', subColor: '#bdbdbd', iconColor: '#ffffff', radius: 6, borderWidth: 0, shadow: 'none', textShadow: 'none', font: 'Arial Black', fontWeight: 900 } },
  ];
  const CONTENT_KEYS = new Set(PROPS.filter((p) => p.group === 'content').map((p) => p.key).concat(['layout', 'cover']));

  const propsFor = (w) => PROPS.filter((p) => p.kinds.includes(KIND[w]));
  const valuesFor = (p, w) => (Array.isArray(p.values) ? p.values : p.values[KIND[w]]);
  const defFor = (p, w) => {
    const wd = WIDGET_DEFAULTS[w] || {};
    if (p.key in wd) return wd[p.key];
    return p.def && typeof p.def === 'object' ? p.def[KIND[w]] : p.def;
  };
  function defaultLook(w) { const o = {}; for (const p of propsFor(w)) o[p.key] = defFor(p, w); return o; }

  const COLOR_RE = /^#[0-9a-f]{6}$/i;
  const FONT_RE = /^[\w .,'-]{1,60}$/; // goes into CSS font-family: no quotes, braces or semicolons
  function cleanValue(p, w, v) {
    switch (p.type) {
      case 'enum': return valuesFor(p, w).includes(v) ? v : undefined;
      case 'color': return typeof v === 'string' && COLOR_RE.test(v) ? v.toLowerCase() : undefined;
      case 'bool': return typeof v === 'boolean' ? v : undefined;
      case 'font': return typeof v === 'string' && FONT_RE.test(v.trim()) ? v.trim() : undefined;
      case 'text': return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, p.max) : undefined;
      case 'num': {
        const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
        if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
        const c = Math.min(p.max, Math.max(p.min, n));
        return Math.round(c / p.step) * p.step;
      }
      default: return undefined;
    }
  }
  /** Full, valid look for widget w: invalid or missing values fall back to `fallback` (valid) or the defaults. */
  function sanitizeLook(w, value, fallback) {
    const src = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const fb = fallback && typeof fallback === 'object' ? fallback : {};
    const out = {};
    for (const p of propsFor(w)) {
      let v = cleanValue(p, w, src[p.key]);
      if (v === undefined) v = cleanValue(p, w, fb[p.key]);
      if (v === undefined) v = defFor(p, w);
      out[p.key] = v;
    }
    return out;
  }
  function sanitizeLooks(value, fallback) {
    const src = value && typeof value === 'object' ? value : {};
    const fb = fallback && typeof fallback === 'object' ? fallback : {};
    const out = {};
    for (const w of WIDGETS) out[w] = sanitizeLook(w, src[w], fb[w]);
    return out;
  }
  // A theme changes the style only.
  function applyPreset(look, presetId) {
    const p = PRESETS.find((x) => x.id === presetId);
    if (!p) return look;
    const out = Object.assign({}, look);
    for (const [k, v] of Object.entries(p.props)) if (k in out && !CONTENT_KEYS.has(k)) out[k] = v;
    return out;
  }
  // Copies the style of one widget to another (content and layout stay, they don't mean the same thing).
  function copyStyle(from, to, wTo) {
    const out = Object.assign({}, to);
    for (const p of propsFor(wTo)) if (!CONTENT_KEYS.has(p.key) && p.key in from) out[p.key] = from[p.key];
    return out;
  }

  // Share codes: "WID1." + base64url(JSON) of the style properties.
  function b64e(s) {
    const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Buffer.from(s, 'utf8');
    let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
    return (typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(s) {
    const b = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = typeof atob !== 'undefined' ? atob(b) : Buffer.from(b, 'base64').toString('binary');
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(bytes) : Buffer.from(bytes).toString('utf8');
  }
  function encodeStyle(look) {
    const o = {}; for (const [k, v] of Object.entries(look)) if (!CONTENT_KEYS.has(k)) o[k] = v;
    return 'WID1.' + b64e(JSON.stringify(o));
  }
  /** Returns the look with the shared style applied, or null when the code is not valid. */
  function decodeStyle(code, look, w) {
    const m = String(code || '').trim().match(/^WID1\.([A-Za-z0-9_-]{4,20000})$/);
    if (!m) return null;
    let o;
    try { o = JSON.parse(b64d(m[1])); } catch (e) { return null; }
    if (!o || typeof o !== 'object') return null;
    return sanitizeLook(w, copyStyle(o, look, w), look);
  }

  const api = { KIND, WIDGETS, GROUPS, FONTS, PROPS, PRESETS, CONTENT_KEYS, propsFor, valuesFor, defFor, defaultLook, sanitizeLook, sanitizeLooks, applyPreset, copyStyle, encodeStyle, decodeStyle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WidgetSchema = api;
})(typeof window !== 'undefined' ? window : globalThis);
