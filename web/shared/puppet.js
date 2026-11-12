/*
 * Puppet renderer — shared by the overlay, the OBS source, the panel and the avatar creator.
 * Classic script (no ES modules) so creator.html also works when opened from disk.
 * Exposes window.Puppet.
 *
 * Style: original cut-paper marionettes. The head is split along the mouth line;
 * the upper half hinges open at the back of the head when the user speaks.
 */
(function (global) {
  'use strict';

  // ---------- Options shown in the creator ----------
  const OPTIONS = {
    headShape: ['round', 'oval', 'square', 'pear', 'egg', 'wide', 'tall'],
    eyes: ['dots', 'round', 'sleepy', 'stars', 'angry', 'happy', 'cute', 'wink', 'dizzy', 'hearts', 'glasses'],
    brows: ['none', 'thin', 'thick', 'frown', 'surprised', 'worried', 'unibrow'],
    glasses: ['none', 'round', 'square', 'sunglasses', 'monocle', 'goggles'],
    nose: ['none', 'dot', 'round', 'long', 'pointy', 'pig', 'button'],
    cheeks: ['none', 'blush', 'freckles', 'scar', 'mole', 'bandage'],
    teeth: ['none', 'buck', 'fangs', 'gap'],
    hair: ['none', 'short', 'spiky', 'bowl', 'long', 'bun', 'mohawk', 'afro', 'curly', 'pigtails', 'ponytail', 'sidepart'],
    beard: ['none', 'beard', 'goatee', 'mustache', 'stubble', 'full', 'chinstrap', 'handlebar'],
    hat: ['none', 'beanie', 'cap', 'crown', 'headphones', 'tophat', 'cowboy', 'wizard', 'beret', 'bandana', 'horns', 'halo', 'propeller', 'hardhat', 'party', 'pirate', 'santa', 'chef'],
    outfit: ['jacket', 'sweater', 'dress', 'suit', 'hoodie', 'tshirt', 'overalls', 'hawaiian', 'labcoat', 'cape', 'hivis', 'apron', 'jersey', 'kimono', 'superhero', 'raincoat'],
    pattern: ['none', 'stripes', 'dots', 'stars', 'checks'],
    neckwear: ['none', 'scarf', 'bowtie', 'tie', 'necklace', 'medal', 'lei', 'chain'],
    held: ['none', 'mug', 'controller', 'sword', 'flower', 'phone', 'pizza', 'balloon', 'microphone', 'trophy', 'popcorn'],
    heldLayer: ['behind', 'front'],
  };
  // Numeric sliders: [min, max, default]
  const SLIDERS = {
    headSize: [0.85, 1.25, 1], headWidth: [0.85, 1.2, 1], headHeight: [0.85, 1.2, 1], mouthHeight: [0.45, 0.75, 0.62],
    eyeSize: [0.7, 1.4, 1], eyeSpacing: [0.75, 1.3, 1], eyeHeight: [-1, 1, 0], eyeTilt: [-0.5, 0.5, 0],
    browSize: [0.6, 1.6, 1], browHeight: [-1, 1, 0], browTilt: [-0.6, 0.6, 0], browSpacing: [0.7, 1.4, 1],
    glassesSize: [0.7, 1.4, 1], glassesHeight: [-1, 1, 0], glassesSpacing: [0.7, 1.4, 1], noseSize: [0.6, 1.6, 1], noseHeight: [-1, 1, 0], cheekSize: [0.6, 1.6, 1],
    hairSize: [0.85, 1.25, 1], hairHeight: [-1, 1, 0], beardSize: [0.7, 1.4, 1],
    hatSize: [0.7, 1.4, 1], hatHeight: [-1, 1, 0], hatTilt: [-0.5, 0.5, 0],
    bodyWidth: [0.8, 1.3, 1], bodyHeight: [0.85, 1.2, 1], heldSize: [0.6, 1.6, 1], heldHeight: [0, 1, 0], heldX: [-1, 1, 0],
    // Offsets for every add-on (1 = ~20 px sideways / ~15 px vertically in puppet units)
    hatX: [-1, 1, 0], glassesX: [-1, 1, 0], noseX: [-1, 1, 0], cheekX: [-1, 1, 0], cheekY: [-1, 1, 0],
    beardX: [-1, 1, 0], beardY: [-1, 1, 0], teethX: [-1, 1, 0], neckSize: [0.6, 1.5, 1], neckX: [-1, 1, 0], neckY: [-1, 1, 0],
  };
  // Transform helper: scale/rotate around a pivot, optionally shifted.
  function around(ctx, px, py, sc, rot, dx, dy) {
    ctx.translate(px + (dx || 0), py + (dy || 0));
    if (rot) ctx.rotate(rot);
    if (sc && sc !== 1) ctx.scale(sc, sc);
    ctx.translate(-px, -py);
  }

  // v0.1 stored French values: translate them so old codes/files keep working.
  const LEGACY = {
    rond: 'round', ovale: 'oval', 'carré': 'square', poire: 'pear',
    points: 'dots', ronds: 'round', endormis: 'sleepy', 'étoiles': 'stars', lunettes: 'glasses', 'colère': 'angry',
    aucun: 'none', aucune: 'none', fins: 'thin', 'épais': 'thick', 'froncés': 'frown', surpris: 'surprised',
    court: 'short', pointes: 'spiky', bol: 'bowl', chignon: 'bun', 'crête': 'mohawk',
    bonnet: 'beanie', casquette: 'cap', couronne: 'crown', 'casque audio': 'headphones', chapeau: 'tophat',
    barbe: 'beard', bouc: 'goatee', moustache: 'mustache',
    veste: 'jacket', pull: 'sweater', robe: 'dress', costume: 'suit',
  };

  const PALETTES = {
    skin: ['#ffe0c2', '#f7c9a0', '#e8b088', '#c98d62', '#9c6644', '#6e4529', '#4a2e1c', '#b5e3a1', '#c7c3ff', '#8fd3ff', '#ff9a8a', '#b8b8c0'],
    hair: ['#2b1d14', '#5a3825', '#a0632b', '#e3b04b', '#f2e6c9', '#c0392b', '#ff7ac8', '#7d3cff', '#2e86de', '#2ecc71', '#111111', '#9e9e9e', '#ffffff'],
    cloth: ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#16a085', '#3498db', '#9b59b6', '#34495e', '#ecf0f1', '#ff6fa8', '#7f5539', '#c0ff5a', '#111111', '#f5c518'],
    eye: ['#2b1d14', '#2e86de', '#27ae60', '#7f8c8d', '#8e44ad', '#c0392b', '#f5c518'],
  };

  // Named colours accepted by chat commands.
  const COLOR_NAMES = {
    red: '#e74c3c', orange: '#e67e22', yellow: '#f1c40f', green: '#2ecc71', teal: '#16a085', blue: '#3498db',
    navy: '#34495e', purple: '#9b59b6', pink: '#ff6fa8', white: '#ecf0f1', black: '#222222', grey: '#888888',
    gray: '#888888', brown: '#8b5a2b', gold: '#f5c518', cyan: '#00cec9', lime: '#a3e635',
  };

  const OUTLINE = '#1d1a1f';
  const MOUTH = '#3b0f17';

  function defaultAvatar() {
    return {
      v: 3, kind: 'drawn', id: '', name: '',
      headShape: 'round', skin: PALETTES.skin[0], headSize: 1,
      eyes: 'dots', eyeColor: PALETTES.eye[0], eyeSize: 1, eyeSpacing: 1, eyeHeight: 0,
      brows: 'thin', glasses: 'none', glassesColor: '#1d1a1f',
      nose: 'none', cheeks: 'none', teeth: 'none',
      hair: 'short', hairColor: PALETTES.hair[1], beard: 'none',
      hat: 'none', hatColor: PALETTES.cloth[0],
      outfit: 'jacket', pattern: 'none', clothColor: PALETTES.cloth[5], accentColor: PALETTES.cloth[2],
      bodyWidth: 1, bodyHeight: 1,
      neckwear: 'none', neckColor: PALETTES.cloth[0], held: 'none', heldLayer: 'behind',
      photo: null, photoSplit: 0.58,
      ...Object.fromEntries(Object.entries(SLIDERS).map(([k, v]) => [k, v[2]])),
    };
  }

  // ---------- Deterministic random (Twitch viewers) ----------
  function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // style: { palette: 'vivid'|'pastel'|'mono'|'custom', colors: [], hats: bool, beards: bool }
  function randomAvatar(seed, style) {
    style = style || {};
    const r = mulberry32(hashString(String(seed).toLowerCase()));
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const maybe = (p, arr) => (r() < p ? pick(arr.slice(1)) : arr[0]);
    const between = (a, b) => Math.round((a + r() * (b - a)) * 100) / 100;
    let cloth = PALETTES.cloth;
    if (style.palette === 'pastel') cloth = ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#d7baff', '#f4c2e0'];
    if (style.palette === 'mono') cloth = ['#2d2d2d', '#555555', '#888888', '#bbbbbb', '#e6e6e6'];
    if (style.palette === 'custom' && Array.isArray(style.colors) && style.colors.length) cloth = style.colors;
    const a = defaultAvatar();
    a.headShape = pick(OPTIONS.headShape);
    a.skin = pick(PALETTES.skin.slice(0, 7));
    a.headSize = between(0.92, 1.12);
    a.eyes = pick(OPTIONS.eyes.filter((e) => e !== 'glasses'));
    a.eyeColor = pick(PALETTES.eye);
    a.eyeSize = between(0.85, 1.2); a.eyeSpacing = between(0.85, 1.15); a.eyeHeight = between(-0.4, 0.4);
    a.brows = pick(OPTIONS.brows);
    a.glasses = maybe(0.2, OPTIONS.glasses); a.glassesColor = pick(['#1d1a1f', '#c0392b', '#3498db', '#f5c518']);
    a.nose = maybe(0.6, OPTIONS.nose);
    a.cheeks = maybe(0.3, OPTIONS.cheeks);
    a.teeth = maybe(0.15, OPTIONS.teeth);
    a.hair = pick(OPTIONS.hair);
    a.hairColor = pick(PALETTES.hair);
    a.hat = style.hats === false ? 'none' : maybe(0.45, OPTIONS.hat);
    a.hatColor = pick(cloth);
    a.beard = style.beards === false ? 'none' : maybe(0.25, OPTIONS.beard);
    a.outfit = pick(OPTIONS.outfit);
    a.pattern = maybe(0.25, OPTIONS.pattern);
    a.clothColor = pick(cloth);
    a.accentColor = pick(cloth);
    a.bodyWidth = between(0.9, 1.15); a.bodyHeight = between(0.92, 1.08);
    a.neckwear = maybe(0.25, OPTIONS.neckwear); a.neckColor = pick(cloth);
    a.held = maybe(0.15, OPTIONS.held);
    a.eyeTilt = between(-0.15, 0.15); a.browTilt = between(-0.2, 0.2); a.noseSize = between(0.85, 1.2);
    a.mouthHeight = between(0.56, 0.68); a.headWidth = between(0.94, 1.08);
    return a;
  }

  // ---------- Share codes ----------
  // Code = "PUP1." + base64url(JSON). Photos are too heavy for a code: use .puppet files.
  function b64urlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  const SHARE_KEYS = ['v', 'kind', 'id', 'name', 'photoSplit', 'skin', 'eyeColor', 'hairColor', 'hatColor', 'clothColor', 'accentColor', 'glassesColor', 'neckColor']
    .concat(Object.keys(OPTIONS), Object.keys(SLIDERS));
  function encodeCode(avatar) {
    if (avatar.kind === 'photo') throw new Error('Photo avatars are too large for a code — share the .puppet file instead.');
    const o = {};
    SHARE_KEYS.forEach((k) => { if (avatar[k] !== undefined) o[k] = avatar[k]; });
    return 'PUP1.' + b64urlEncode(JSON.stringify(o));
  }
  function normalize(obj) {
    const a = Object.assign(defaultAvatar(), obj || {});
    for (const k of Object.keys(OPTIONS)) {
      if (LEGACY[a[k]]) a[k] = LEGACY[a[k]];
      if (!OPTIONS[k].includes(a[k])) a[k] = defaultAvatar()[k];
    }
    // v0.1/0.2 "glasses" was an eye style: move it to the glasses slot.
    if (a.eyes === 'glasses') { a.eyes = 'round'; if (a.glasses === 'none') a.glasses = 'round'; }
    for (const [k, [min, max, def]] of Object.entries(SLIDERS)) {
      const n = Number(a[k]);
      a[k] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
    }
    a.id = String(a.id || '').trim();
    a.name = String(a.name || '').slice(0, 32);
    return a;
  }
  // Accepts a PUP1 code or the JSON content of a .puppet file.
  function decodeAny(text) {
    text = String(text || '').trim();
    if (text.startsWith('PUP1.')) return normalize(JSON.parse(b64urlDecode(text.slice(5))));
    const parsed = JSON.parse(text);
    return normalize(parsed.avatar || parsed);
  }
  function toFileContent(avatar) {
    return JSON.stringify({ format: 'puppet-overlay-avatar', version: 3, avatar });
  }

  // ---------- Image cache ----------
  const imgCache = new Map();
  function imageEntry(src) {
    let e = imgCache.get(src);
    if (!e) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      e = { img, ok: false, failed: false };
      img.onload = () => (e.ok = true);
      img.onerror = () => (e.failed = true);
      img.src = src;
      imgCache.set(src, e);
    }
    return e;
  }
  function getImage(src) { if (!src) return null; const e = imageEntry(src); return e.ok ? e.img : null; }
  function imageFailed(src) { return !!src && imageEntry(src).failed; }

  // ---------- Animation state per puppet ----------
  class Animator {
    constructor(seed) {
      const r = mulberry32(hashString(String(seed || Math.random())));
      this.phase = r() * 100;
      this.speed = 15 + r() * 6;
      this.open = 0;
      this.talking = false;
      this.hangover = 0;   // keeps the mouth moving briefly through short speaking gaps
      this.talkTime = 0;   // seconds of (mostly) continuous speech -> intensity
      this.idleTime = 0;   // seconds since last speech -> sleep
      this.nextBlink = 1 + r() * 3;
      this.blink = 0;
      this.hop = 0;        // 1 -> 0 jump arc
      this.hopHeight = 18;
      this.look = 0; this.lookTarget = 0;
      this.danceT = 0; this.waveT = 0;
      this.sleepAfter = 0; // seconds, 0 = never
    }
    jump(h) { this.hop = 1; this.hopHeight = h || 18; }
    dance(sec) { this.danceT = Math.max(this.danceT, sec || 3); }
    wave(sec) { this.waveT = Math.max(this.waveT, sec || 2.5); }
    update(dt, t) {
      if (this.talking) this.hangover = 0.18; else this.hangover = Math.max(0, this.hangover - dt);
      const speaking = this.talking || this.hangover > 0;
      if (speaking) { this.talkTime = Math.min(20, this.talkTime + dt); this.idleTime = 0; }
      else { this.talkTime = Math.max(0, this.talkTime - dt * 3); this.idleTime += dt; }
      const intensity = this.intensity();
      let target = 0;
      if (speaking) {
        const sp = this.speed * (1 + intensity * 0.45);
        const s = Math.sin((t + this.phase) * sp);
        const s2 = Math.sin((t + this.phase) * sp * 0.37);
        target = Math.max(0, 0.55 + 0.45 * s * (0.6 + 0.4 * s2)) * (0.85 + intensity * 0.3);
      }
      const k = target > this.open ? 30 : 18;
      this.open += (target - this.open) * Math.min(1, dt * k);
      this.nextBlink -= dt;
      if (this.nextBlink <= 0) { this.blink = 0.14; this.nextBlink = 2 + Math.random() * 4; }
      this.blink = Math.max(0, this.blink - dt);
      this.hop = Math.max(0, this.hop - dt * 2.6);
      this.danceT = Math.max(0, this.danceT - dt);
      this.waveT = Math.max(0, this.waveT - dt);
      this.look += (this.lookTarget - this.look) * Math.min(1, dt * 5);
    }
    intensity() { return Math.min(1, Math.max(0, (this.talkTime - 2) / 8)); }
    asleep() { return this.sleepAfter > 0 && this.idleTime > this.sleepAfter && !this.talking; }
    state(t) {
      const tt = t + this.phase;
      const asleep = this.asleep();
      const intensity = this.intensity();
      const speaking = this.talking || this.hangover > 0;
      let bob = Math.sin(tt * (asleep ? 1.2 : 2.2)) * (asleep ? 2.5 : 1.5);
      if (speaking) bob -= Math.abs(Math.sin(tt * 9)) * (2.5 + intensity * 4);
      bob -= Math.sin(this.hop * Math.PI) * this.hopHeight;
      let rock = speaking ? Math.sin(tt * 7) * 0.035 * intensity : 0;
      if (this.danceT > 0) { rock += Math.sin(tt * 10) * 0.22; bob -= Math.abs(Math.sin(tt * 10)) * 8; }
      return {
        open: this.open, blinking: this.blink > 0 || asleep, bob, rock, look: this.look,
        wave: this.waveT > 0 ? Math.min(1, this.waveT * 3, (2.5 - this.waveT) * 4 + 0.2) : 0,
        asleep, intensity, time: tt,
      };
    }
  }

  // ---------- Drawing helpers ----------
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function stroke(ctx, w) { ctx.lineWidth = w || 3; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  function shade(hex, amt) {
    const n = parseInt(String(hex || '#888888').replace('#', '').slice(0, 6), 16) || 0x888888;
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  // Head geometry in local units (feet at 0,0; puppet ~210 tall).
  const HEAD = { cx: 0, cy: -132, rx: 60, ry: 54 };
  const NECK_Y = -84;
  function headPath(ctx, shape) {
    const { cx, cy, rx, ry } = HEAD;
    ctx.beginPath();
    switch (shape) {
      case 'square': rr(ctx, cx - rx, cy - ry, rx * 2, ry * 2, 22); break;
      case 'oval': ctx.ellipse(cx, cy - 4, rx * 0.88, ry * 1.12, 0, 0, Math.PI * 2); break;
      case 'wide': ctx.ellipse(cx, cy + 4, rx * 1.12, ry * 0.9, 0, 0, Math.PI * 2); break;
      case 'tall': rr(ctx, cx - rx * 0.8, cy - ry * 1.18, rx * 1.6, ry * 2.18, 34); break;
      case 'egg':
        ctx.moveTo(cx, cy - ry * 1.1);
        ctx.bezierCurveTo(cx + rx * 0.75, cy - ry * 1.1, cx + rx * 1.05, cy + ry * 0.3, cx + rx * 0.8, cy + ry * 0.75);
        ctx.quadraticCurveTo(cx, cy + ry * 1.12, cx - rx * 0.8, cy + ry * 0.75);
        ctx.bezierCurveTo(cx - rx * 1.05, cy + ry * 0.3, cx - rx * 0.75, cy - ry * 1.1, cx, cy - ry * 1.1);
        ctx.closePath(); break;
      case 'pear':
        ctx.moveTo(cx, cy - ry);
        ctx.bezierCurveTo(cx + rx * 0.8, cy - ry, cx + rx * 1.08, cy + ry * 0.5, cx + rx * 0.7, cy + ry);
        ctx.lineTo(cx - rx * 0.7, cy + ry);
        ctx.bezierCurveTo(cx - rx * 1.08, cy + ry * 0.5, cx - rx * 0.8, cy - ry, cx, cy - ry);
        ctx.closePath(); break;
      default: ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    }
  }
  // Top of the head for a given shape (hats sit there).
  function headTopOffset(shape) { return shape === 'tall' ? -10 : shape === 'egg' || shape === 'oval' ? -6 : shape === 'wide' ? 6 : 0; }

  function mitten(ctx, x, y, rot, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, y, 10, 12, rot, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
  }

  function torsoPath(ctx, a) {
    ctx.beginPath();
    if (a.outfit === 'dress') { ctx.moveTo(-26, -86); ctx.lineTo(26, -86); ctx.lineTo(46, -10); ctx.lineTo(-46, -10); }
    else if (a.outfit === 'labcoat') { ctx.moveTo(-30, -88); ctx.lineTo(30, -88); ctx.lineTo(42, -6); ctx.lineTo(-42, -6); }
    else { ctx.moveTo(-30, -88); ctx.lineTo(30, -88); ctx.lineTo(38, -10); ctx.lineTo(-38, -10); }
    ctx.closePath();
  }

  function drawPattern(ctx, a) {
    if (!a.pattern || a.pattern === 'none') return;
    ctx.save(); torsoPath(ctx, a); ctx.clip();
    ctx.globalAlpha *= 0.55; ctx.fillStyle = a.accentColor; ctx.strokeStyle = a.accentColor;
    if (a.pattern === 'stripes') for (let y = -84; y < 0; y += 14) ctx.fillRect(-50, y, 100, 6);
    else if (a.pattern === 'dots') for (let y = -80; y < 0; y += 14) for (let x = -44 + ((y / 14) % 2 ? 7 : 0); x < 50; x += 14) { ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); }
    else if (a.pattern === 'checks') for (let j = 0; j < 8; j++) for (let i = 0; i < 9; i++) { if ((i + j) % 2 === 0) ctx.fillRect(-54 + i * 12, -88 + j * 12, 12, 12); }
    else if (a.pattern === 'stars') for (let y = -76; y < 0; y += 22) for (let x = -36 + ((y / 22) % 2 ? 11 : 0); x < 50; x += 22) star(ctx, x, y, 5, 2.2);
    ctx.restore();
  }
  function star(ctx, x, y, R, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const ang = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R; ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad); }
    ctx.closePath(); ctx.fill();
  }

  function drawCape(ctx, a) {
    if (a.outfit !== 'cape' && a.outfit !== 'superhero') return;
    ctx.fillStyle = a.accentColor;
    ctx.beginPath(); ctx.moveTo(-28, -86); ctx.quadraticCurveTo(-58, -40, -52, -4); ctx.lineTo(52, -4); ctx.quadraticCurveTo(58, -40, 28, -86); ctx.closePath();
    ctx.fill(); stroke(ctx);
  }

  function drawBody(ctx, a, st) {
    const c = a.clothColor || '#3498db';
    drawCape(ctx, a);
    // feet
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.ellipse(-18, -5, 16, 7, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
    ctx.beginPath(); ctx.ellipse(18, -5, 16, 7, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
    // torso (paper trapezoid)
    torsoPath(ctx, a);
    ctx.fillStyle = a.outfit === 'labcoat' ? '#f4f6f8' : a.outfit === 'overalls' ? a.accentColor : c;
    ctx.fill();
    drawPattern(ctx, a);
    torsoPath(ctx, a); stroke(ctx);
    // outfit details
    ctx.fillStyle = a.accentColor || '#f1c40f';
    switch (a.outfit) {
      case 'jacket':
        ctx.beginPath(); ctx.moveTo(0, -88); ctx.lineTo(0, -10); stroke(ctx, 2);
        [-66, -46, -26].forEach((y) => { ctx.beginPath(); ctx.arc(-6, y, 3, 0, Math.PI * 2); ctx.fillStyle = OUTLINE; ctx.fill(); });
        break;
      case 'sweater': ctx.fillRect(-34, -40, 68, 9); ctx.beginPath(); ctx.rect(-34, -40, 68, 9); stroke(ctx, 2); break;
      case 'suit':
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(-12, -88); ctx.lineTo(12, -88); ctx.lineTo(0, -56); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        if (!a.neckwear || a.neckwear === 'none') { ctx.fillStyle = a.accentColor; ctx.beginPath(); ctx.moveTo(0, -84); ctx.lineTo(-5, -76); ctx.lineTo(0, -58); ctx.lineTo(5, -76); ctx.closePath(); ctx.fill(); stroke(ctx, 1.5); }
        break;
      case 'dress': ctx.fillRect(-30, -58, 60, 6); break;
      case 'hoodie':
        ctx.fillStyle = shade(c, -18); rr(ctx, -22, -44, 44, 22, 8); ctx.fill(); stroke(ctx, 2);
        ctx.beginPath(); ctx.moveTo(-8, -86); ctx.lineTo(-10, -62); ctx.moveTo(8, -86); ctx.lineTo(10, -62); stroke(ctx, 2);
        break;
      case 'tshirt':
        ctx.beginPath(); ctx.arc(0, -88, 12, 0, Math.PI); ctx.fillStyle = shade(c, -25); ctx.fill(); stroke(ctx, 2);
        break;
      case 'overalls':
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(-24, -62); ctx.lineTo(24, -62); ctx.lineTo(37, -10); ctx.lineTo(-37, -10); ctx.closePath(); ctx.fill(); stroke(ctx, 2.5);
        ctx.beginPath(); ctx.moveTo(-20, -62); ctx.lineTo(-24, -88); ctx.moveTo(20, -62); ctx.lineTo(24, -88); ctx.lineWidth = 6; ctx.strokeStyle = c; ctx.stroke();
        ctx.fillStyle = '#f5c518'; [-16, 16].forEach((x) => { ctx.beginPath(); ctx.arc(x, -58, 3.5, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 1.5); });
        rr(ctx, -10, -50, 20, 14, 3); ctx.fillStyle = shade(c, -20); ctx.fill(); stroke(ctx, 1.5);
        break;
      case 'hawaiian': {
        const cols = ['#ffffff', a.accentColor, '#ff6fa8'];
        ctx.save(); torsoPath(ctx, a); ctx.clip();
        for (let i = 0; i < 9; i++) { const x = -30 + (i % 3) * 30 + (i % 2) * 6, y = -76 + Math.floor(i / 3) * 24; ctx.fillStyle = cols[i % 3]; for (let k = 0; k < 5; k++) { const ang = k * 1.256; ctx.beginPath(); ctx.arc(x + Math.cos(ang) * 4, y + Math.sin(ang) * 4, 3.5, 0, Math.PI * 2); ctx.fill(); } }
        ctx.restore();
        ctx.fillStyle = shade(c, -20); ctx.beginPath(); ctx.moveTo(-14, -88); ctx.lineTo(0, -68); ctx.lineTo(14, -88); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        break;
      }
      case 'labcoat':
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-10, -88); ctx.lineTo(10, -88); ctx.lineTo(6, -20); ctx.lineTo(-6, -20); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        ctx.beginPath(); ctx.moveTo(-10, -88); ctx.lineTo(-16, -60); ctx.moveTo(10, -88); ctx.lineTo(16, -60); stroke(ctx, 2);
        ctx.fillStyle = '#3498db'; ctx.fillRect(18, -60, 3, 10);
        break;
      case 'hivis': {
        // High-visibility vest (gilet jaune) worn open over the shirt colour
        const vest = '#e4f21f', band = '#d9dde3';
        for (const sd of [-1, 1]) {
          ctx.fillStyle = vest; ctx.beginPath();
          ctx.moveTo(sd * 30, -88); ctx.lineTo(sd * 10, -88); ctx.lineTo(sd * 7, -10); ctx.lineTo(sd * 38, -10); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
          ctx.fillStyle = band;
          for (const y of [-54, -32]) { ctx.beginPath(); ctx.moveTo(sd * 8.5, y); ctx.lineTo(sd * (33 + (y + 88) / 78 * 5), y); ctx.lineTo(sd * (33.5 + (y + 95) / 78 * 5), y + 7); ctx.lineTo(sd * 8.2, y + 7); ctx.closePath(); ctx.fill(); stroke(ctx, 1.5); }
          ctx.beginPath(); ctx.moveTo(sd * 15, -88); ctx.lineTo(sd * 14, -60); ctx.lineWidth = 6; ctx.strokeStyle = band; ctx.stroke();
        }
        break;
      }
      case 'apron':
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-20, -70); ctx.lineTo(20, -70); ctx.lineTo(24, -12); ctx.quadraticCurveTo(0, -6, -24, -12); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        ctx.beginPath(); ctx.moveTo(-18, -70); ctx.lineTo(-12, -88); ctx.moveTo(18, -70); ctx.lineTo(12, -88); stroke(ctx, 2);
        ctx.fillStyle = a.accentColor; rr(ctx, -10, -44, 20, 12, 3); ctx.fill(); stroke(ctx, 1.5);
        break;
      case 'jersey':
        ctx.fillStyle = a.accentColor; ctx.fillRect(-36, -60, 6, 48); ctx.fillRect(30, -60, 6, 48);
        ctx.beginPath(); ctx.arc(0, -88, 11, 0, Math.PI); ctx.fill(); stroke(ctx, 2);
        ctx.font = '900 30px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.strokeText('10', 0, -44); ctx.fillStyle = a.accentColor; ctx.fillText('10', 0, -44);
        break;
      case 'kimono':
        ctx.fillStyle = a.accentColor; ctx.beginPath(); ctx.moveTo(-14, -88); ctx.lineTo(-4, -88); ctx.lineTo(20, -50); ctx.lineTo(12, -48); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        ctx.beginPath(); ctx.moveTo(14, -88); ctx.lineTo(-2, -60); stroke(ctx, 2);
        ctx.fillStyle = shade(a.accentColor, -30); ctx.fillRect(-35, -48, 70, 12); ctx.beginPath(); ctx.rect(-35, -48, 70, 12); stroke(ctx, 2);
        break;
      case 'superhero':
        ctx.fillStyle = a.accentColor; ctx.beginPath(); ctx.arc(0, -60, 14, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = '#f5c518'; star(ctx, 0, -60, 10, 4.2); ctx.fillRect(-36, -26, 72, 7); ctx.beginPath(); ctx.rect(-36, -26, 72, 7); stroke(ctx, 1.5);
        break;
      case 'raincoat':
        ctx.beginPath(); ctx.moveTo(0, -88); ctx.lineTo(0, -10); stroke(ctx, 2);
        ctx.fillStyle = shade(c, -25); ctx.beginPath(); ctx.moveTo(-18, -88); ctx.lineTo(0, -74); ctx.lineTo(18, -88); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = '#ffffff'; [-62, -44, -26].forEach((y) => { rr(ctx, -4, y, 8, 4, 2); ctx.fill(); stroke(ctx, 1.2); });
        break;
      case 'cape':
        ctx.beginPath(); ctx.moveTo(0, -88); ctx.lineTo(0, -10); stroke(ctx, 2);
        ctx.fillStyle = '#f5c518'; [-26, 26].forEach((x) => { ctx.beginPath(); ctx.arc(x, -84, 4, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 1.5); });
        break;
      default:
    }
    // mitten hands (right one can wave)
    const hand = a.outfit === 'tshirt' ? (a.skin || '#ffe0c2') : shade(c, -25);
    if (a.heldLayer !== 'front') drawLeftHand(ctx, a, st, hand, c);
    const w = st.wave || 0;
    if (w > 0) {
      const wig = Math.sin((st.time || 0) * 14) * 0.35;
      const hx = 40 + 14 * w, hy = -40 - 62 * w;
      ctx.beginPath(); ctx.moveTo(28, -78); ctx.quadraticCurveTo(44 + 8 * w, -70, hx, hy + 8);
      ctx.lineWidth = 12; ctx.strokeStyle = OUTLINE; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = a.outfit === 'tshirt' ? hand : c; ctx.stroke();
      mitten(ctx, hx, hy, -0.3 + wig, hand);
    } else {
      mitten(ctx, 40, -40, -0.3, hand);
    }
  }

  // Left hand + held item. The hand can be raised/moved (heldHeight/heldX) and drawn in front of the head.
  function drawLeftHand(ctx, a, st, hand, cloth) {
    const hx = -40 + (a.heldX || 0) * 30, hy = -40 - (a.heldHeight || 0) * 85;
    if (hx !== -40 || hy !== -40) {
      // arm from the shoulder to the moved hand
      ctx.beginPath(); ctx.moveTo(-26, -80); ctx.quadraticCurveTo(-46, (hy - 80) / 2 + 8, hx, hy + 6);
      ctx.lineWidth = 12; ctx.strokeStyle = OUTLINE; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = a.outfit === 'tshirt' ? hand : cloth; ctx.stroke();
    }
    if (a.held && a.held !== 'none') {
      const k = 1.4 * (a.heldSize || 1);
      ctx.save(); ctx.translate(hx - 4, hy - 4); ctx.scale(k, k); ctx.translate(44, 44); drawHeld(ctx, a, st); ctx.restore();
    }
    mitten(ctx, hx, hy, 0.3, hand); // mitten in front of the item = it's being held
  }

  // Item held in the left mitten (-40, -40).
  function drawHeld(ctx, a, st) {
    const x = -44, y = -44;
    switch (a.held) {
      case 'mug':
        ctx.fillStyle = '#ffffff'; rr(ctx, x - 12, y - 8, 18, 20, 3); ctx.fill(); stroke(ctx, 2);
        ctx.beginPath(); ctx.arc(x - 13, y + 2, 5, Math.PI * 0.5, Math.PI * 1.5); stroke(ctx, 2.5);
        ctx.fillStyle = a.accentColor; ctx.fillRect(x - 10, y - 2, 14, 4);
        ctx.globalAlpha *= 0.6; ctx.beginPath(); ctx.moveTo(x - 6, y - 12); ctx.quadraticCurveTo(x - 2, y - 18 + Math.sin((st.time || 0) * 3) * 2, x - 6, y - 24); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha /= 0.6;
        break;
      case 'controller':
        ctx.fillStyle = '#2d2d36'; rr(ctx, x - 18, y - 2, 30, 14, 7); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(x + 4, y + 4, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(x + 8, y + 7, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 12, y + 4, 8, 2); ctx.fillRect(x - 9, y + 1, 2, 8);
        break;
      case 'sword':
        ctx.fillStyle = '#d7dde5'; ctx.beginPath(); ctx.moveTo(x - 3, y - 6); ctx.lineTo(x - 3, y - 58); ctx.lineTo(x, y - 66); ctx.lineTo(x + 3, y - 58); ctx.lineTo(x + 3, y - 6); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = '#f5c518'; rr(ctx, x - 12, y - 8, 24, 5, 2); ctx.fill(); stroke(ctx, 2);
        break;
      case 'flower':
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 4, y - 18, x, y - 34); ctx.lineWidth = 3; ctx.strokeStyle = '#27ae60'; ctx.stroke();
        ctx.fillStyle = a.accentColor; for (let k = 0; k < 6; k++) { const ang = k * Math.PI / 3; ctx.beginPath(); ctx.arc(x + Math.cos(ang) * 6, y - 36 + Math.sin(ang) * 6, 5, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(x, y - 36, 4, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 1.5);
        break;
      case 'phone':
        ctx.fillStyle = '#1d1a1f'; rr(ctx, x - 7, y - 18, 14, 24, 3); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = '#5ac8fa'; ctx.fillRect(x - 5, y - 15, 10, 17);
        break;
      case 'pizza':
        ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.moveTo(x - 14, y - 16); ctx.lineTo(x + 10, y - 16); ctx.lineTo(x - 2, y + 10); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = '#d68a3c'; rr(ctx, x - 15, y - 20, 26, 6, 3); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = '#c0392b'; [[-6, -10], [2, -9], [-2, -2]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(x + dx, y + dy, 2.5, 0, Math.PI * 2); ctx.fill(); });
        break;
      case 'microphone':
        ctx.fillStyle = '#2d2d36'; rr(ctx, x - 4, y - 14, 8, 26, 3); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = '#b8bec8'; ctx.beginPath(); ctx.arc(x, y - 20, 9, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2);
        ctx.strokeStyle = '#7d848f'; ctx.lineWidth = 1; for (let k = -6; k <= 6; k += 4) { ctx.beginPath(); ctx.moveTo(x + k, y - 28); ctx.lineTo(x + k, y - 12); ctx.stroke(); }
        break;
      case 'trophy':
        ctx.fillStyle = '#f5c518';
        ctx.beginPath(); ctx.moveTo(x - 12, y - 26); ctx.lineTo(x + 12, y - 26); ctx.quadraticCurveTo(x + 12, y - 6, x, y - 4); ctx.quadraticCurveTo(x - 12, y - 6, x - 12, y - 26); ctx.fill(); stroke(ctx, 2);
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sd * 14, y - 18, 5, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = '#d4a10f'; ctx.stroke(); }
        ctx.fillStyle = '#d4a10f'; ctx.fillRect(x - 3, y - 4, 6, 6); rr(ctx, x - 10, y + 2, 20, 6, 2); ctx.fill(); stroke(ctx, 1.5);
        break;
      case 'popcorn':
        ctx.fillStyle = '#fff6d6'; [[-8, -24], [0, -28], [8, -24], [-4, -30], [5, -32]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(x + dx, y + dy, 6, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 1.2); });
        ctx.save(); ctx.beginPath(); ctx.moveTo(x - 13, y - 22); ctx.lineTo(x + 13, y - 22); ctx.lineTo(x + 9, y + 6); ctx.lineTo(x - 9, y + 6); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.clip();
        ctx.fillStyle = '#e74c3c'; for (let k = -12; k < 14; k += 8) ctx.fillRect(x + k, y - 24, 4, 32); ctx.restore();
        ctx.beginPath(); ctx.moveTo(x - 13, y - 22); ctx.lineTo(x + 13, y - 22); ctx.lineTo(x + 9, y + 6); ctx.lineTo(x - 9, y + 6); ctx.closePath(); stroke(ctx, 2);
        break;
      case 'balloon': {
        const sway = Math.sin((st.time || 0) * 1.6) * 6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 6 + sway, y - 50, x - 4 + sway, y - 96); ctx.lineWidth = 1.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
        ctx.fillStyle = a.accentColor; ctx.beginPath(); ctx.ellipse(x - 4 + sway, y - 116, 16, 20, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
        ctx.fillStyle = '#ffffff88'; ctx.beginPath(); ctx.ellipse(x - 10 + sway, y - 124, 4, 6, -0.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      default:
    }
  }

  function drawNeckwear(ctx, a) {
    const c = a.neckColor || '#e74c3c';
    ctx.fillStyle = c;
    switch (a.neckwear) {
      case 'scarf':
        rr(ctx, -30, -88, 60, 14, 7); ctx.fill(); stroke(ctx, 2.5);
        ctx.beginPath(); ctx.moveTo(12, -78); ctx.lineTo(24, -48); ctx.lineTo(10, -48); ctx.lineTo(4, -78); ctx.closePath(); ctx.fill(); stroke(ctx, 2.5);
        ctx.fillStyle = shade(c, 30); ctx.fillRect(12, -52, 11, 3);
        break;
      case 'bowtie':
        ctx.beginPath(); ctx.moveTo(0, -80); ctx.lineTo(-14, -88); ctx.lineTo(-14, -72); ctx.closePath(); ctx.moveTo(0, -80); ctx.lineTo(14, -88); ctx.lineTo(14, -72); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        ctx.beginPath(); ctx.arc(0, -80, 4, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2);
        break;
      case 'tie':
        ctx.beginPath(); ctx.moveTo(-5, -84); ctx.lineTo(5, -84); ctx.lineTo(3, -78); ctx.lineTo(8, -40); ctx.lineTo(0, -32); ctx.lineTo(-8, -40); ctx.lineTo(-3, -78); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        break;
      case 'necklace':
        ctx.beginPath(); ctx.arc(0, -90, 22, 0.25 * Math.PI, 0.75 * Math.PI); ctx.lineWidth = 2.5; ctx.strokeStyle = '#f5c518'; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -68, 5, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2);
        break;
      case 'lei':
        for (let i = 0; i <= 10; i++) {
          const ang = Math.PI * (0.12 + 0.76 * i / 10), px = Math.cos(ang) * 26, py = -84 + Math.sin(ang) * 14;
          ctx.fillStyle = ['#ff6fa8', '#f5c518', '#ffffff', c][i % 4]; ctx.beginPath(); ctx.arc(px, py, 5.5, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 1.5);
        }
        break;
      case 'chain':
        ctx.beginPath(); ctx.arc(0, -96, 26, 0.2 * Math.PI, 0.8 * Math.PI); ctx.lineWidth = 6; ctx.strokeStyle = OUTLINE; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#f5c518'; ctx.setLineDash([4, 2]); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(0, -66, 9, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
        ctx.fillStyle = '#d4a10f'; ctx.font = '900 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, -65.5);
        break;
      case 'medal':
        ctx.beginPath(); ctx.moveTo(-14, -88); ctx.lineTo(-2, -64); ctx.moveTo(14, -88); ctx.lineTo(2, -64); ctx.lineWidth = 5; ctx.strokeStyle = c; ctx.stroke();
        ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(0, -58, 9, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
        ctx.fillStyle = '#d4a10f'; star(ctx, 0, -58, 5, 2.2);
        break;
      default:
    }
  }

  // Eyes are drawn in a local frame (0,0) per eye so size/spacing/height sliders just transform it.
  function drawEyes(ctx, a, blinking, look) {
    const es = a.eyeSize || 1;
    const y = HEAD.cy - 12 + (a.eyeHeight || 0) * 12;
    const dx = 22 * (a.eyeSpacing || 1);
    const col = a.eyeColor || OUTLINE;
    const px = (look || 0) * 4;
    for (const side of [-1, 1]) {
      const x = HEAD.cx + side * dx - 4;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-side * (a.eyeTilt || 0)); ctx.scale(es, es);
      const closed = blinking || a.eyes === 'sleepy' || (a.eyes === 'wink' && side === 1);
      if (closed) {
        ctx.beginPath(); ctx.moveTo(-10, 2); ctx.quadraticCurveTo(0, blinking ? 6 : 8, 10, 2); stroke(ctx, 3);
      } else switch (a.eyes) {
        case 'dots': case 'wink':
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px * 0.6, 0, 5, 0, Math.PI * 2); ctx.fill(); break;
        case 'stars':
          ctx.fillStyle = '#ffd34d'; star(ctx, px * 0.4, 0, 11, 4.5); stroke(ctx, 2); break;
        case 'hearts':
          ctx.fillStyle = '#ff3d6e'; ctx.beginPath(); ctx.moveTo(px * 0.4, 8);
          ctx.bezierCurveTo(-14 + px * 0.4, -2, -6 + px * 0.4, -12, px * 0.4, -4); ctx.bezierCurveTo(6 + px * 0.4, -12, 14 + px * 0.4, -2, px * 0.4, 8);
          ctx.fill(); stroke(ctx, 2); break;
        case 'happy':
          ctx.beginPath(); ctx.moveTo(-9, 4); ctx.quadraticCurveTo(0, -10, 9, 4); stroke(ctx, 3.5); break;
        case 'dizzy':
          ctx.beginPath(); for (let i = 0; i < 26; i++) { const ang = i * 0.5, r = i * 0.42; ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); } stroke(ctx, 2); break;
        case 'cute':
          ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(px * 0.6, 0, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-3 + px * 0.6, -4, 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(2 + px * 0.6, 3, 1.5, 0, Math.PI * 2); ctx.fill(); break;
        default: // round, angry
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 0, 11, 12, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(1 + px, 2, 5, 0, Math.PI * 2); ctx.fill();
          if (a.eyes === 'angry') {
            ctx.fillStyle = a.skin; ctx.beginPath(); ctx.moveTo(-13, -14); ctx.lineTo(13, -14); ctx.lineTo(-13 * side, -1); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(13 * side, -13); ctx.lineTo(-13 * side, -1); stroke(ctx, 3);
          }
      }
      ctx.restore();
    }
  }

  function drawGlasses(ctx, a) {
    if (!a.glasses || a.glasses === 'none') return;
    const es = a.eyeSize || 1;
    const y = HEAD.cy - 12 + (a.eyeHeight || 0) * 12 + (a.glassesHeight || 0) * 16;
    const dx = 22 * (a.eyeSpacing || 1) * (a.glassesSpacing || 1);
    const c = a.glassesColor || OUTLINE;
    const L = HEAD.cx - dx - 4, R = HEAD.cx + dx - 4, r = 14 * es * (a.glassesSize || 1);
    ctx.lineWidth = 3.5; ctx.strokeStyle = c;
    const lens = (x, fill) => {
      ctx.beginPath();
      if (a.glasses === 'square' || a.glasses === 'sunglasses') rr(ctx, x - r - 1, y - r * 0.8, (r + 1) * 2, r * 1.6, 4); else ctx.arc(x, y, r, 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.lineWidth = 3.5; ctx.strokeStyle = c; ctx.stroke();
    };
    if (a.glasses === 'monocle') {
      lens(R, 'rgba(200,230,255,0.25)');
      ctx.beginPath(); ctx.moveTo(R + r * 0.7, y + r * 0.7); ctx.quadraticCurveTo(R + 20, y + 30, R + 6, y + 44); ctx.lineWidth = 1.5; ctx.strokeStyle = '#f5c518'; ctx.stroke();
      return;
    }
    if (a.glasses === 'goggles') {
      ctx.beginPath(); ctx.moveTo(HEAD.cx - HEAD.rx, y); ctx.lineTo(HEAD.cx + HEAD.rx, y); ctx.lineWidth = 9; ctx.strokeStyle = OUTLINE; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = c; ctx.stroke();
      for (const x of [L, R]) { ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(140,210,255,0.45)'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = c; ctx.stroke(); stroke(ctx, 1.5); }
      return;
    }
    const fill = a.glasses === 'sunglasses' ? 'rgba(15,15,20,0.92)' : null;
    lens(L, fill); lens(R, fill);
    ctx.beginPath(); ctx.moveTo(L + r, y); ctx.quadraticCurveTo(HEAD.cx - 4, y - 5, R - r, y); ctx.lineWidth = 3; ctx.strokeStyle = c; ctx.stroke();
    if (a.glasses === 'sunglasses') { ctx.fillStyle = '#ffffff55'; ctx.beginPath(); ctx.ellipse(L - 5, y - 4, 3, 5, -0.5, 0, Math.PI * 2); ctx.fill(); }
  }

  function drawBrows(ctx, a) {
    if (a.brows === 'none') return;
    const y = HEAD.cy - 30 + (a.eyeHeight || 0) * 12 - ((a.eyeSize || 1) - 1) * 12 + (a.browHeight || 0) * 10;
    const dx = 22 * (a.eyeSpacing || 1) * (a.browSpacing || 1);
    const bs = a.browSize || 1, tilt = a.browTilt || 0;
    ctx.lineCap = 'round'; ctx.strokeStyle = a.hairColor;
    if (a.brows === 'unibrow') {
      ctx.save(); around(ctx, HEAD.cx - 4, y, bs, 0);
      ctx.beginPath(); ctx.moveTo(HEAD.cx - dx - 14, y + 1); ctx.quadraticCurveTo(HEAD.cx - 4, y - 6, HEAD.cx + dx + 6, y + 1);
      ctx.lineWidth = 7; ctx.stroke(); ctx.restore(); return;
    }
    for (const side of [-1, 1]) {
      const x = HEAD.cx + side * dx - 4;
      ctx.save(); ctx.translate(x, y); ctx.rotate(side * tilt); ctx.scale(bs, bs);
      ctx.beginPath();
      if (a.brows === 'frown') { ctx.moveTo(-10 * side, -4); ctx.lineTo(10 * side, 4); }
      else if (a.brows === 'worried') { ctx.moveTo(-10 * side, 3); ctx.lineTo(10 * side, -5); }
      else if (a.brows === 'surprised') { ctx.moveTo(-9, -2); ctx.quadraticCurveTo(0, -12, 9, -2); }
      else { ctx.moveTo(-10, 0); ctx.lineTo(10, -1); }
      ctx.lineWidth = a.brows === 'thick' ? 7 : 3.5; ctx.strokeStyle = a.hairColor; ctx.stroke();
      ctx.restore();
    }
  }

  function drawNose(ctx, a) {
    if (!a.nose || a.nose === 'none') return;
    const x = HEAD.cx - 6, y = HEAD.cy + 2;
    ctx.save(); around(ctx, x, y, a.noseSize || 1, 0, (a.noseX || 0) * 20, (a.noseHeight || 0) * 10);
    drawNoseShape(ctx, a, x, y);
    ctx.restore();
  }
  function drawNoseShape(ctx, a, x, y) {
    ctx.fillStyle = shade(a.skin || '#ffe0c2', -28);
    switch (a.nose) {
      case 'dot': ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); break;
      case 'round': ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2); break;
      case 'button': ctx.fillStyle = '#ff7a7a'; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2); ctx.fillStyle = '#ffffff99'; ctx.beginPath(); ctx.arc(x - 3, y - 3, 2.5, 0, Math.PI * 2); ctx.fill(); break;
      case 'long': ctx.beginPath(); ctx.moveTo(x + 2, y - 14); ctx.quadraticCurveTo(x - 24, y + 4, x - 4, y + 6); ctx.quadraticCurveTo(x + 4, y + 4, x + 2, y - 14); ctx.fill(); stroke(ctx, 2); break;
      case 'pointy': ctx.beginPath(); ctx.moveTo(x + 4, y - 10); ctx.lineTo(x - 14, y + 4); ctx.lineTo(x + 4, y + 5); ctx.closePath(); ctx.fill(); stroke(ctx, 2); break;
      case 'pig':
        ctx.fillStyle = '#ffadc6'; ctx.beginPath(); ctx.ellipse(x, y, 10, 7, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = OUTLINE; [-3.5, 3.5].forEach((d) => { ctx.beginPath(); ctx.ellipse(x + d, y, 1.8, 3, 0, 0, Math.PI * 2); ctx.fill(); });
        break;
      default:
    }
  }

  function drawCheeks(ctx, a) {
    if (!a.cheeks || a.cheeks === 'none') return;
    ctx.save(); around(ctx, HEAD.cx - 3, HEAD.cy + 4, a.cheekSize || 1, 0, (a.cheekX || 0) * 20, (a.cheekY || 0) * 15);
    drawCheekShapes(ctx, a);
    ctx.restore();
  }
  function drawCheekShapes(ctx, a) {
    const y = HEAD.cy + 4, xl = HEAD.cx - 36, xr = HEAD.cx + 30;
    switch (a.cheeks) {
      case 'blush':
        ctx.fillStyle = 'rgba(255,90,120,0.35)';
        [xl, xr].forEach((x) => { ctx.beginPath(); ctx.ellipse(x, y, 10, 6, 0, 0, Math.PI * 2); ctx.fill(); });
        break;
      case 'freckles':
        ctx.fillStyle = shade(a.skin || '#ffe0c2', -60);
        [xl, xr].forEach((x) => [[-5, -2], [0, 2], [5, -2], [-2, 5], [3, 6]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(x + dx, y + dy, 1.4, 0, Math.PI * 2); ctx.fill(); }));
        break;
      case 'scar':
        ctx.beginPath(); ctx.moveTo(xr - 8, y - 12); ctx.lineTo(xr + 6, y + 6); stroke(ctx, 2.5);
        for (let i = 0; i < 3; i++) { const t2 = (i + 1) / 4, sx = xr - 8 + 14 * t2, sy = y - 12 + 18 * t2; ctx.beginPath(); ctx.moveTo(sx - 4, sy + 3); ctx.lineTo(sx + 4, sy - 3); stroke(ctx, 1.5); }
        break;
      case 'mole': ctx.fillStyle = '#3b2418'; ctx.beginPath(); ctx.arc(xr - 2, y + 2, 2.6, 0, Math.PI * 2); ctx.fill(); break;
      case 'bandage':
        ctx.save(); ctx.translate(xr, y - 2); ctx.rotate(-0.5);
        ctx.fillStyle = '#f1c9a5'; rr(ctx, -12, -4, 24, 8, 3); ctx.fill(); stroke(ctx, 1.5);
        ctx.rotate(1.0); rr(ctx, -12, -4, 24, 8, 3); ctx.fill(); stroke(ctx, 1.5);
        ctx.restore();
        break;
      default:
    }
  }

  // Teeth hang from the upper half, just above the mouth line.
  function drawTeeth(ctx, a, splitY) {
    const x = HEAD.cx - 20;
    ctx.fillStyle = '#ffffff';
    if (a.teeth === 'buck') { rr(ctx, x - 9, splitY - 2, 8, 11, 2); ctx.fill(); stroke(ctx, 1.8); rr(ctx, x, splitY - 2, 8, 11, 2); ctx.fill(); stroke(ctx, 1.8); }
    else if (a.teeth === 'fangs') { for (const dx of [-14, 10]) { ctx.beginPath(); ctx.moveTo(x + dx, splitY - 1); ctx.lineTo(x + dx + 6, splitY - 1); ctx.lineTo(x + dx + 3, splitY + 9); ctx.closePath(); ctx.fill(); stroke(ctx, 1.6); } }
    else if (a.teeth === 'gap') { rr(ctx, x + 4, splitY - 2, 8, 9, 2); ctx.fill(); stroke(ctx, 1.8); }
  }

  function drawHair(ctx, a) {
    const { cx, cy, rx, ry } = HEAD;
    const top = cy - ry;
    ctx.fillStyle = a.hairColor;
    ctx.beginPath();
    switch (a.hair) {
      case 'short': ctx.ellipse(cx, cy - ry * 0.55, rx * 0.98, ry * 0.55, 0, Math.PI, Math.PI * 2); break;
      case 'spiky':
        ctx.moveTo(cx - rx, cy - 18);
        for (let i = 0; i <= 8; i++) { const x = cx - rx + (i * rx * 2) / 8; ctx.lineTo(x, i % 2 ? top - 14 : top + 10); }
        ctx.lineTo(cx + rx, cy - 18); break;
      case 'bowl': ctx.moveTo(cx - rx - 4, cy - 6); ctx.ellipse(cx, cy - 6, rx + 4, ry + 6, 0, Math.PI, Math.PI * 2); ctx.lineTo(cx - rx - 4, cy - 6); break;
      case 'long':
        ctx.ellipse(cx, cy - ry * 0.5, rx * 1.02, ry * 0.6, 0, Math.PI, Math.PI * 2);
        ctx.rect(cx - rx - 6, cy - ry * 0.5, 16, ry * 1.1); ctx.rect(cx + rx - 10, cy - ry * 0.5, 16, ry * 0.95); break;
      case 'bun':
        ctx.ellipse(cx, cy - ry * 0.55, rx * 0.98, ry * 0.55, 0, Math.PI, Math.PI * 2);
        ctx.moveTo(cx + 22, top - 10); ctx.arc(cx, top - 10, 22, 0, Math.PI * 2); break;
      case 'mohawk':
        ctx.moveTo(cx - 14, top + 6);
        for (let i = 0; i < 5; i++) { ctx.lineTo(cx - 14 + i * 7, top - 26 - (i % 2) * 6); ctx.lineTo(cx - 10 + i * 7, top + 2); }
        break;
      case 'afro':
        for (let i = 0; i < 9; i++) { const ang = Math.PI + (i * Math.PI) / 8; ctx.moveTo(cx + Math.cos(ang) * rx + 20, cy - 10 + Math.sin(ang) * ry); ctx.arc(cx + Math.cos(ang) * rx, cy - 10 + Math.sin(ang) * ry, 20, 0, Math.PI * 2); }
        break;
      case 'curly':
        for (let i = 0; i < 11; i++) { const ang = Math.PI * 1.02 + (i * Math.PI * 0.96) / 10; const x = cx + Math.cos(ang) * rx * 0.92, y = cy - 8 + Math.sin(ang) * ry * 0.92; ctx.moveTo(x + 12, y); ctx.arc(x, y, 12, 0, Math.PI * 2); }
        break;
      case 'pigtails':
        ctx.ellipse(cx, cy - ry * 0.55, rx * 0.98, ry * 0.55, 0, Math.PI, Math.PI * 2);
        for (const s2 of [-1, 1]) { ctx.moveTo(cx + s2 * (rx + 12) + 13, cy - 4); ctx.ellipse(cx + s2 * (rx + 12), cy - 4, 13, 22, s2 * 0.3, 0, Math.PI * 2); }
        break;
      case 'ponytail':
        ctx.ellipse(cx, cy - ry * 0.55, rx * 0.98, ry * 0.55, 0, Math.PI, Math.PI * 2);
        ctx.moveTo(cx + rx - 4, top + 14); ctx.quadraticCurveTo(cx + rx + 34, top + 10, cx + rx + 18, cy + 18); ctx.quadraticCurveTo(cx + rx + 6, top + 30, cx + rx - 10, top + 22);
        break;
      case 'sidepart':
        ctx.moveTo(cx - rx, cy - 8); ctx.bezierCurveTo(cx - rx, top - 18, cx + rx * 0.4, top - 16, cx + rx, cy - 20);
        ctx.quadraticCurveTo(cx + rx * 0.2, top + 6, cx - rx * 0.55, cy - 14); ctx.closePath();
        break;
      default: return;
    }
    ctx.fill(); stroke(ctx, 2.5);
    if (a.hair === 'pigtails') { ctx.fillStyle = a.accentColor; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s2 * (rx + 2), cy - 22, 5, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 1.5); } }
  }

  function drawHat(ctx, a, time) {
    const { cx, cy, rx, ry } = HEAD;
    const top = cy - ry + headTopOffset(a.headShape);
    const c = a.hatColor;
    ctx.fillStyle = c;
    switch (a.hat) {
      case 'beanie':
        ctx.beginPath(); ctx.ellipse(cx, top + 18, rx * 0.95, ry * 0.75, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.fillStyle = shade(c, -30); rr(ctx, cx - rx * 0.98, top + 8, rx * 1.96, 16, 6); ctx.fill(); stroke(ctx, 2.5);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, top - 36, 10, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
        break;
      case 'cap': case 'propeller':
        ctx.beginPath(); ctx.ellipse(cx, top + 16, rx * 0.92, ry * 0.6, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.fillStyle = shade(c, -30); ctx.beginPath(); ctx.ellipse(cx - rx * 0.75, top + 15, 34, 7, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
        if (a.hat === 'propeller') {
          ctx.fillStyle = '#555'; ctx.fillRect(cx - 2, top - 30, 4, 14);
          const k = Math.cos((time || 0) * 18);
          ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.ellipse(cx - 16 * k, top - 30, 16 * Math.abs(k) + 2, 4, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 1.5);
          ctx.fillStyle = '#3498db'; ctx.beginPath(); ctx.ellipse(cx + 16 * k, top - 30, 16 * Math.abs(k) + 2, 4, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 1.5);
          ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(cx, top - 30, 3.5, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 1.5);
        }
        break;
      case 'crown':
        ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.moveTo(cx - 34, top + 8);
        [[-34, -22], [-17, -6], [0, -28], [17, -6], [34, -22]].forEach(([x, y]) => ctx.lineTo(cx + x, top + y));
        ctx.lineTo(cx + 34, top + 8); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(cx, top - 2, 4, 0, Math.PI * 2); ctx.fill();
        break;
      case 'headphones':
        ctx.beginPath(); ctx.ellipse(cx, cy - 6, rx + 6, ry + 8, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.lineWidth = 9; ctx.strokeStyle = OUTLINE; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = c; ctx.stroke();
        for (const s of [-1, 1]) { ctx.fillStyle = c; rr(ctx, cx + s * (rx + 2) - 9, cy - 22, 18, 30, 7); ctx.fill(); stroke(ctx, 2.5); }
        break;
      case 'tophat':
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(cx, top + 10, rx + 18, 10, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx);
        rr(ctx, cx - rx * 0.62, top - 40, rx * 1.24, 52, 8); ctx.fill(); stroke(ctx);
        ctx.fillStyle = a.accentColor; ctx.fillRect(cx - rx * 0.62, top - 2, rx * 1.24, 9);
        break;
      case 'cowboy':
        ctx.beginPath(); ctx.moveTo(cx - rx - 30, top + 2); ctx.quadraticCurveTo(cx, top + 26, cx + rx + 30, top + 2); ctx.quadraticCurveTo(cx, top + 14, cx - rx - 30, top + 2); ctx.fill(); stroke(ctx);
        ctx.beginPath(); ctx.moveTo(cx - rx * 0.62, top + 10); ctx.lineTo(cx - rx * 0.55, top - 30); ctx.quadraticCurveTo(cx, top - 18, cx + rx * 0.55, top - 30); ctx.lineTo(cx + rx * 0.62, top + 10); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.fillStyle = shade(c, -40); ctx.fillRect(cx - rx * 0.6, top + 1, rx * 1.2, 7);
        break;
      case 'wizard':
        ctx.beginPath(); ctx.moveTo(cx - rx * 0.75, top + 12); ctx.quadraticCurveTo(cx + 6, top - 40, cx + 26, top - 82); ctx.quadraticCurveTo(cx + 18, top - 30, cx + rx * 0.75, top + 12); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.beginPath(); ctx.ellipse(cx, top + 12, rx + 14, 9, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx);
        ctx.fillStyle = '#f5c518'; star(ctx, cx - 6, top - 14, 7, 3); star(ctx, cx + 14, top - 44, 5, 2.2);
        break;
      case 'beret':
        ctx.beginPath(); ctx.ellipse(cx - 6, top + 6, rx * 0.95, 16, -0.12, 0, Math.PI * 2); ctx.fill(); stroke(ctx);
        ctx.fillRect(cx - 9, top - 14, 4, 8);
        break;
      case 'bandana':
        ctx.beginPath(); ctx.ellipse(cx, cy - 6, rx + 1, ry + 1, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.lineWidth = 16; ctx.strokeStyle = OUTLINE; ctx.stroke(); ctx.lineWidth = 12; ctx.strokeStyle = c; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + rx - 4, cy - 34); ctx.lineTo(cx + rx + 22, cy - 46); ctx.lineTo(cx + rx + 16, cy - 28); ctx.closePath(); ctx.moveTo(cx + rx - 4, cy - 32); ctx.lineTo(cx + rx + 24, cy - 22); ctx.lineTo(cx + rx + 8, cy - 14); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = '#ffffff'; [[-30, -44], [-6, -50], [18, -46]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 2.5, 0, Math.PI * 2); ctx.fill(); });
        break;
      case 'horns':
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(cx + s * 24, top + 10); ctx.quadraticCurveTo(cx + s * 52, top - 4, cx + s * 46, top - 34); ctx.quadraticCurveTo(cx + s * 40, top - 8, cx + s * 12, top + 6); ctx.closePath();
          ctx.fillStyle = c; ctx.fill(); stroke(ctx, 2.5);
        }
        break;
      case 'hardhat':
        ctx.beginPath(); ctx.ellipse(cx, top + 16, rx * 0.86, ry * 0.72, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.fillStyle = shade(c, -25); rr(ctx, cx - rx - 8, top + 10, rx * 2 + 16, 9, 4); ctx.fill(); stroke(ctx, 2.5);
        ctx.fillStyle = shade(c, 25); rr(ctx, cx - 5, top - 22, 10, 32, 4); ctx.fill(); stroke(ctx, 2);
        break;
      case 'party':
        ctx.save(); ctx.translate(cx + 8, top + 8); ctx.rotate(0.18);
        ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(0, -62); ctx.lineTo(24, 0); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.clip(); ctx.fillStyle = a.accentColor; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-30, -8 - i * 16); ctx.lineTo(30, -20 - i * 16); ctx.lineTo(30, -14 - i * 16); ctx.lineTo(-30, -2 - i * 16); ctx.fill(); } ctx.restore();
        ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(0, -62); ctx.lineTo(24, 0); ctx.closePath(); stroke(ctx);
        ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(0, -64, 7, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2);
        ctx.restore();
        break;
      case 'pirate':
        ctx.fillStyle = '#1f1d24';
        ctx.beginPath(); ctx.moveTo(cx - rx - 14, top + 14); ctx.quadraticCurveTo(cx - rx * 0.6, top - 34, cx, top - 20); ctx.quadraticCurveTo(cx + rx * 0.6, top - 34, cx + rx + 14, top + 14); ctx.quadraticCurveTo(cx, top + 2, cx - rx - 14, top + 14); ctx.fill(); stroke(ctx);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, top - 6, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1f1d24'; ctx.beginPath(); ctx.arc(cx - 2.5, top - 7, 1.6, 0, Math.PI * 2); ctx.arc(cx + 2.5, top - 7, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = a.accentColor; ctx.fillRect(cx - rx * 0.7, top + 2, rx * 1.4, 4);
        break;
      case 'santa':
        ctx.beginPath(); ctx.moveTo(cx - rx * 0.92, top + 14); ctx.quadraticCurveTo(cx - 10, top - 50, cx + 44, top - 30); ctx.quadraticCurveTo(cx + 40, top - 10, cx + rx * 0.92, top + 14); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.fillStyle = '#ffffff'; rr(ctx, cx - rx * 0.98, top + 6, rx * 1.96, 16, 8); ctx.fill(); stroke(ctx, 2.5);
        ctx.beginPath(); ctx.arc(cx + 46, top - 28, 10, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
        break;
      case 'chef':
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); [[-22, -26, 18], [0, -36, 20], [22, -26, 18]].forEach(([dx, dy, r]) => { ctx.moveTo(cx + dx + r, top + dy); ctx.arc(cx + dx, top + dy, r, 0, Math.PI * 2); }); ctx.fill(); stroke(ctx, 2.5);
        rr(ctx, cx - rx * 0.66, top - 22, rx * 1.32, 34, 4); ctx.fill(); stroke(ctx, 2.5);
        break;
      case 'halo': {
        const hy = top - 22 + Math.sin((time || 0) * 2) * 2;
        ctx.save(); ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.ellipse(cx, hy, 34, 9, 0, 0, Math.PI * 2); ctx.lineWidth = 6; ctx.strokeStyle = '#ffd43b'; ctx.stroke();
        ctx.restore();
        break;
      }
      default:
    }
  }

  function drawBeard(ctx, a, splitY) {
    const { cx } = HEAD;
    ctx.fillStyle = a.hairColor;
    switch (a.beard) {
      case 'beard': ctx.beginPath(); ctx.moveTo(cx - 50, splitY + 2); ctx.quadraticCurveTo(cx, splitY + 70, cx + 50, splitY + 2); ctx.closePath(); ctx.fill(); stroke(ctx, 2.5); break;
      case 'full':
        ctx.beginPath(); ctx.moveTo(cx - 58, splitY - 14); ctx.lineTo(cx - 50, splitY + 2); ctx.quadraticCurveTo(cx, splitY + 86, cx + 50, splitY + 2); ctx.lineTo(cx + 58, splitY - 14); ctx.lineTo(cx + 46, splitY + 2); ctx.lineTo(cx - 46, splitY + 2); ctx.closePath(); ctx.fill(); stroke(ctx, 2.5); break;
      case 'goatee': ctx.beginPath(); ctx.moveTo(cx - 14, splitY + 8); ctx.quadraticCurveTo(cx - 4, splitY + 40, cx + 6, splitY + 8); ctx.closePath(); ctx.fill(); stroke(ctx, 2.5); break;
      case 'chinstrap': ctx.beginPath(); ctx.ellipse(cx, splitY + 4, 52, 34, 0, 0.1, Math.PI - 0.1); ctx.lineWidth = 9; ctx.strokeStyle = OUTLINE; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = a.hairColor; ctx.stroke(); break;
      case 'stubble':
        ctx.globalAlpha *= 0.55;
        for (let i = 0; i < 40; i++) { const ang = 0.15 + (i % 10) * 0.28, rad = 22 + Math.floor(i / 10) * 7; ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * rad * 1.4, splitY + 4 + Math.sin(ang) * rad * 0.8, 1.2, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha /= 0.55; break;
      default:
    }
  }
  // Mustaches live on the upper half (they move with it).
  function drawMustache(ctx, a, splitY) {
    if (a.beard !== 'mustache' && a.beard !== 'handlebar' && a.beard !== 'full') return;
    ctx.fillStyle = a.hairColor;
    ctx.beginPath();
    if (a.beard === 'handlebar') {
      const x = HEAD.cx - 12, y = splitY - 5;
      ctx.moveTo(x, y - 4); ctx.quadraticCurveTo(x - 20, y - 8, x - 28, y + 2); ctx.quadraticCurveTo(x - 34, y - 8, x - 26, y - 12); ctx.quadraticCurveTo(x - 30, y - 2, x - 22, y - 2);
      ctx.quadraticCurveTo(x - 10, y + 2, x, y + 2); ctx.quadraticCurveTo(x + 10, y + 2, x + 22, y - 2); ctx.quadraticCurveTo(x + 30, y - 2, x + 26, y - 12); ctx.quadraticCurveTo(x + 34, y - 8, x + 28, y + 2); ctx.quadraticCurveTo(x + 20, y - 8, x, y - 4);
    } else ctx.ellipse(HEAD.cx - 12, splitY - 6, 22, 7, 0, Math.PI, Math.PI * 2);
    ctx.closePath(); ctx.fill(); stroke(ctx, 2);
  }

  // Muted: two strips of tape across the mouth.
  function drawTape(ctx, splitY) {
    for (const rot of [-0.32, 0.32]) {
      ctx.save(); ctx.translate(HEAD.cx - 16, splitY); ctx.rotate(rot);
      ctx.fillStyle = '#e9e2cf'; rr(ctx, -26, -6, 52, 12, 2); ctx.fill(); stroke(ctx, 2);
      ctx.restore();
    }
  }
  // Deafened: fluffy earmuffs.
  function drawEarmuffs(ctx, hasHeadband) {
    const { cx, cy, rx, ry } = HEAD;
    if (!hasHeadband) {
      ctx.beginPath(); ctx.ellipse(cx, cy - 4, rx + 4, ry + 6, 0, Math.PI * 1.08, Math.PI * 1.92);
      ctx.lineWidth = 8; ctx.strokeStyle = OUTLINE; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#bfc7d5'; ctx.stroke();
    }
    for (const s of [-1, 1]) {
      const x = cx + s * (rx + 2), y = cy - 6;
      // fluffy pom: a ring of overlapping circles, outlined once
      ctx.beginPath();
      for (let i = 0; i < 7; i++) { const ang = (i / 7) * Math.PI * 2; ctx.moveTo(x + Math.cos(ang) * 9 + 10, y + Math.sin(ang) * 9); ctx.arc(x + Math.cos(ang) * 9, y + Math.sin(ang) * 9, 10, 0, Math.PI * 2); }
      stroke(ctx, 5); ctx.fillStyle = '#ff9fbf'; ctx.fill();
      ctx.fillStyle = '#ffc2d6'; ctx.beginPath(); ctx.arc(x - 3, y - 4, 7, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Head is drawn bigger/smaller around the neck and lifted by a taller body.
  // Width/height stretch the head from its chin, so it grows upwards and stays on the body.
  const CHIN_Y = HEAD.cy + HEAD.ry;
  function headTransform(ctx, a) {
    const bh = a.bodyHeight || 1, hs = a.headSize || 1;
    ctx.translate(0, -(bh - 1) * 88);
    ctx.translate(0, NECK_Y); ctx.scale(hs, hs); ctx.translate(0, -NECK_Y);
    ctx.translate(HEAD.cx, CHIN_Y); ctx.scale(a.headWidth || 1, a.headHeight || 1); ctx.translate(-HEAD.cx, -CHIN_Y);
  }
  // Maps a y in head space to puppet space (used for bubbles/labels/glow).
  function headY(a, y) {
    const bh = (a && a.bodyHeight) || 1, hs = (a && a.headSize) || 1, hh = (a && a.headHeight) || 1;
    const y1 = CHIN_Y + (y - CHIN_Y) * hh;
    return -(bh - 1) * 88 + NECK_Y + (y1 - NECK_Y) * hs;
  }
  function headTopLocal(a) {
    return headY(a, HEAD.cy - HEAD.ry);
  }

  /**
   * Draw one puppet.
   * a: avatar; st: Animator.state() (+ optional alpha, scaleMul)
   * opts: {x, y, scale, name, muted, deaf, glow, flip, discordAvatarUrl, statusStyle: 'props'|'badges'|'both', labelColor}
   */
  function draw(ctx, a, st, opts) {
    opts = opts || {};
    st = st || {};
    const s = (opts.scale || 1) * (st.scaleMul == null ? 1 : st.scaleMul);
    if (s <= 0.001) return;
    const flipK = opts.flip ? -1 : 1;
    const look = (st.look || 0) * flipK;
    const statusStyle = opts.statusStyle || 'props';
    const props = statusStyle !== 'badges';
    ctx.save();
    if (st.alpha != null) ctx.globalAlpha *= Math.max(0, Math.min(1, st.alpha));
    ctx.translate(opts.x || 0, (opts.y || 0) + (st.bob || 0) * s);
    ctx.scale(s * flipK * (st.sx || 1), s * (st.sy || 1));
    if (st.rock) ctx.rotate(st.rock * flipK);

    // soft shadow under the paper cut-out
    ctx.save();
    ctx.globalAlpha *= 0.25; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, 2 - (st.bob || 0), 46 * (a.bodyWidth || 1), 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save(); ctx.scale(a.bodyWidth || 1, a.bodyHeight || 1);
    drawBody(ctx, a, st);
    ctx.restore();

    let photoSrc = a.kind === 'photo' ? a.photo : (a.kind === 'discord' ? opts.discordAvatarUrl : null);
    if (photoSrc && imageFailed(photoSrc)) photoSrc = null; // CDN down / offline: fall back to a drawn face
    const img = photoSrc ? getImage(photoSrc) : null;
    const isPhoto = !!photoSrc;
    const shape = isPhoto ? (a.headShape === 'square' ? 'square' : 'round') : a.headShape;
    const splitRatio = isPhoto ? (a.photoSplit || 0.6) : (a.mouthHeight || 0.62);
    const splitY = HEAD.cy - HEAD.ry + HEAD.ry * 2 * splitRatio;
    const pivotX = HEAD.cx + HEAD.rx * 0.92;
    const angle = (st.open || 0) * 0.6; // radians; upper half hinges at the back
    const face = isPhoto || a.kind !== 'discord' ? a : Object.assign({}, defaultAvatar(), { clothColor: a.clothColor, accentColor: a.accentColor });

    const fillHead = () => {
      if (isPhoto) {
        if (img) ctx.drawImage(img, HEAD.cx - HEAD.rx, HEAD.cy - HEAD.ry, HEAD.rx * 2, HEAD.ry * 2);
        else { ctx.fillStyle = '#8a8a99'; ctx.fill(); }
      } else { ctx.fillStyle = face.skin; ctx.fill(); }
    };

    // whole head: size/height sliders, then a slight turn toward whoever is speaking
    ctx.save();
    headTransform(ctx, a);
    if (a.outfit === 'hoodie') { ctx.fillStyle = shade(a.clothColor || '#3498db', -18); ctx.beginPath(); ctx.ellipse(HEAD.cx + 4, HEAD.cy + 10, HEAD.rx + 12, HEAD.ry + 8, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx); }
    ctx.translate(look * 3, NECK_Y); ctx.rotate(look * 0.07); ctx.translate(0, -NECK_Y);

    // ---- lower jaw ----
    ctx.save();
    ctx.beginPath(); ctx.rect(-200, splitY, 400, 200); ctx.clip();
    headPath(ctx, shape); ctx.save(); ctx.clip(); fillHead(); ctx.restore();
    headPath(ctx, shape); stroke(ctx);
    ctx.restore();
    if (!isPhoto && face.beard !== 'none') { ctx.save(); around(ctx, HEAD.cx, splitY, face.beardSize || 1, 0, (face.beardX || 0) * 20, (face.beardY || 0) * 15); drawBeard(ctx, face, splitY); ctx.restore(); }

    // ---- mouth interior (wedge revealed when open) ----
    if (st.open > 0.02) {
      const leftX = HEAD.cx - HEAD.rx * 0.98;
      const lx = pivotX + (leftX - pivotX) * Math.cos(angle);
      const ly = splitY + (leftX - pivotX) * Math.sin(angle);
      ctx.beginPath(); ctx.moveTo(pivotX, splitY); ctx.lineTo(leftX, splitY); ctx.quadraticCurveTo(leftX - 4, (splitY + ly) / 2, lx, ly); ctx.closePath();
      ctx.fillStyle = MOUTH; ctx.fill(); stroke(ctx, 2.5);
      ctx.fillStyle = '#d9576b';
      ctx.beginPath(); ctx.ellipse(leftX + 30, splitY - 3, 20, 5 * st.open + 2, 0, Math.PI, Math.PI * 2); ctx.fill();
    }

    // ---- upper half (rotates) ----
    ctx.save();
    ctx.translate(pivotX, splitY); ctx.rotate(angle); ctx.translate(-pivotX, -splitY);
    const backHair = ['long', 'afro', 'pigtails', 'ponytail', 'curly'];
    const hairT = () => around(ctx, HEAD.cx, HEAD.cy - HEAD.ry * 0.3, face.hairSize || 1, 0, 0, (face.hairHeight || 0) * 8);
    if (!isPhoto && backHair.includes(face.hair)) { ctx.save(); hairT(); drawHair(ctx, face); ctx.restore(); } // hair behind the head
    if (!isPhoto && face.teeth !== 'none') { ctx.save(); ctx.translate((face.teethX || 0) * 20, 0); drawTeeth(ctx, face, splitY); ctx.restore(); }
    ctx.save();
    ctx.beginPath(); ctx.rect(-200, -400, 400, splitY + 400); ctx.clip();
    headPath(ctx, shape); ctx.save(); ctx.clip(); fillHead(); ctx.restore();
    headPath(ctx, shape); stroke(ctx);
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(HEAD.cx - HEAD.rx * 0.98, splitY); ctx.lineTo(pivotX, splitY); stroke(ctx, 2.5);
    if (!isPhoto) {
      drawCheeks(ctx, face);
      ctx.save(); around(ctx, HEAD.cx - 12, splitY - 6, face.beardSize || 1, 0, (face.beardX || 0) * 20, (face.beardY || 0) * 15); drawMustache(ctx, face, splitY); ctx.restore();
      drawEyes(ctx, face, st.blinking, look);
      drawNose(ctx, face);
      drawBrows(ctx, face);
      if (!backHair.includes(face.hair)) {
        // Tall hairstyles would poke through hats: flatten them under a hat.
        const hatted = face.hat && !['none', 'headphones', 'crown', 'halo', 'horns', 'bandana'].includes(face.hat);
        ctx.save(); hairT();
        drawHair(ctx, hatted && ['spiky', 'mohawk', 'bun'].includes(face.hair) ? Object.assign({}, face, { hair: 'short' }) : face);
        ctx.restore();
      }
    } else if (st.asleep) {
      // photo puppets: a dark band so they still read as "eyes closed"
      ctx.save(); ctx.globalAlpha *= 0.35; ctx.fillStyle = '#000'; ctx.fillRect(HEAD.cx - HEAD.rx, HEAD.cy - 24, HEAD.rx * 2, 20); ctx.restore();
    }
    ctx.save(); ctx.translate((a.glassesX || 0) * 20, 0); drawGlasses(ctx, a); ctx.restore();
    if (a.hat && a.hat !== 'none') {
      ctx.save(); around(ctx, HEAD.cx, HEAD.cy - HEAD.ry, a.hatSize || 1, a.hatTilt || 0, (a.hatX || 0) * 20, (a.hatHeight || 0) * 12);
      drawHat(ctx, a, st.time); ctx.restore();
    }
    if (props && opts.deaf) drawEarmuffs(ctx, a.hat === 'headphones');
    ctx.restore();
    if (props && opts.muted) drawTape(ctx, splitY);

    ctx.restore(); // head

    // neckwear sits in front of the chin
    if (a.neckwear && a.neckwear !== 'none') { ctx.save(); ctx.scale(a.bodyWidth || 1, a.bodyHeight || 1); around(ctx, 0, -80, a.neckSize || 1, 0, (a.neckX || 0) * 20, (a.neckY || 0) * 15); drawNeckwear(ctx, a); ctx.restore(); }
    if (a.heldLayer === 'front') {
      const c = a.clothColor || '#3498db';
      ctx.save(); ctx.scale(a.bodyWidth || 1, a.bodyHeight || 1);
      drawLeftHand(ctx, a, st, a.outfit === 'tshirt' ? (a.skin || '#ffe0c2') : shade(c, -25), c);
      ctx.restore();
    }

    ctx.restore(); // puppet transform

    // ---- overlays not affected by flip ----
    const x = opts.x || 0;
    const topLocal = headTopLocal(a);
    const hs = (a.headSize || 1) * Math.max(a.headWidth || 1, a.headHeight || 1);
    const headCY = (opts.y || 0) + (st.bob || 0) * s + headY(a, HEAD.cy) * s;
    const headTopY = (opts.y || 0) + (st.bob || 0) * s + topLocal * s;
    ctx.save();
    if (st.alpha != null) ctx.globalAlpha *= Math.max(0, Math.min(1, st.alpha));
    if (opts.glow) {
      ctx.globalAlpha *= 0.9; ctx.strokeStyle = '#43b581'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x, headCY, HEAD.rx * hs * s + 8, HEAD.ry * hs * s + 8, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha /= 0.9;
    }
    if (statusStyle !== 'props' && (opts.muted || opts.deaf)) drawStatusIcon(ctx, x + HEAD.rx * hs * s * 0.9, headTopY + 8, opts.deaf ? 'deaf' : 'mute', Math.max(0.6, s));
    if (st.asleep) drawZzz(ctx, x + HEAD.rx * hs * s * 0.7, headTopY, s, st.time || 0);
    if (opts.name) drawLabel(ctx, opts.name, x, (opts.y || 0) + 14 * s, Math.max(0.7, s), opts.labelColor);
    ctx.restore();
  }

  function drawZzz(ctx, x, y, s, t) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const p = ((t * 0.5 + i / 3) % 1);
      const size = (14 + p * 14) * Math.max(0.6, s);
      ctx.font = `900 ${size}px "Segoe UI", system-ui, sans-serif`;
      const zx = x + p * 26 * s + Math.sin(t * 2 + i) * 4 * s, zy = y - p * 50 * s;
      ctx.globalAlpha = Math.sin(p * Math.PI);
      ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.strokeText('z', zx, zy);
      ctx.fillStyle = '#ffffff'; ctx.fillText('z', zx, zy);
    }
    ctx.restore();
  }

  function drawStatusIcon(ctx, x, y, kind, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#ed4245'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    if (kind === 'deaf') { ctx.beginPath(); ctx.arc(0, 1, 6, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(-7, 1, 3, 5); ctx.fillRect(4, 1, 3, 5); }
    else { rr(ctx, -3, -7, 6, 10, 3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, 8); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.stroke();
    ctx.restore();
  }

  function drawLabel(ctx, text, x, y, s, color) {
    ctx.save();
    ctx.font = `700 ${Math.round(14 * s)}px "Segoe UI", system-ui, sans-serif`;
    const w = Math.min(ctx.measureText(text).width, 160 * s) + 16 * s, h = 22 * s;
    ctx.fillStyle = 'rgba(20,18,24,0.82)'; rr(ctx, x - w / 2, y, w, h, 8 * s); ctx.fill();
    ctx.fillStyle = color || '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + h / 2 + 1, 160 * s);
    ctx.restore();
  }

  // Speech bubble above a puppet (Twitch chat). Wraps text to maxLines.
  function drawBubble(ctx, text, x, headTopY, s, opts) {
    opts = opts || {};
    const maxW = (opts.maxWidth || 220) * s, pad = 9 * s, lineH = 17 * s, maxLines = opts.maxLines || 3;
    ctx.save();
    ctx.font = `600 ${Math.round(14 * s)}px "Segoe UI", system-ui, sans-serif`;
    // Hard-wrap very long words (URLs, spam) so they cannot overflow.
    const words = [];
    String(text).split(/\s+/).forEach((w) => { while (ctx.measureText(w).width > maxW - pad * 2 && w.length > 4) { let n = w.length - 1; while (n > 1 && ctx.measureText(w.slice(0, n)).width > maxW - pad * 2) n--; words.push(w.slice(0, n)); w = w.slice(n); } words.push(w); });
    const lines = []; let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW - pad * 2 && cur) { lines.push(cur); cur = w; } else cur = test;
      if (lines.length >= maxLines) break;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '…');
    const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2);
    const h = lines.length * lineH + pad * 2 - 4 * s;
    ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    ctx.fillStyle = opts.bg || '#ffffff';
    let bx, by;
    if (opts.side) {
      // Beside the head (vertical layouts), tail pointing at the puppet.
      const gap = opts.sideGap || 60 * s, ty = headTopY + 22 * s;
      bx = opts.side === 'left' ? x - gap - w : x + gap;
      bx = Math.max(4, Math.min((opts.viewW || ctx.canvas.width) - w - 4, bx));
      by = ty - h / 2;
      rr(ctx, bx, by, w, h, 10 * s); ctx.fill(); stroke(ctx, 2.5);
      const ex = opts.side === 'left' ? bx + w : bx, dir = opts.side === 'left' ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(ex - dir, ty - 7 * s); ctx.lineTo(ex + dir * 12 * s, ty + 2 * s); ctx.lineTo(ex - dir, ty + 6 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(ex, ty - 7 * s); ctx.lineTo(ex + dir * 12 * s, ty + 2 * s); ctx.lineTo(ex, ty + 6 * s); stroke(ctx, 2.5);
    } else {
      bx = Math.max(4, Math.min((opts.viewW || ctx.canvas.width) - w - 4, x - w / 2)); by = headTopY - h - 16 * s;
      rr(ctx, bx, by, w, h, 10 * s); ctx.fill(); stroke(ctx, 2.5);
      ctx.beginPath(); ctx.moveTo(x - 8 * s, by + h - 1); ctx.lineTo(x, by + h + 12 * s); ctx.lineTo(x + 6 * s, by + h - 1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 8 * s, by + h); ctx.lineTo(x, by + h + 12 * s); ctx.lineTo(x + 6 * s, by + h); stroke(ctx, 2.5);
    }
    ctx.fillStyle = opts.fg || '#1d1a1f'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + pad, by + pad + i * lineH));
    ctx.restore();
  }

  // Puff of smoke used when a puppet leaves. p: 0 -> 1
  function drawPoof(ctx, x, y, s, p) {
    ctx.save();
    ctx.globalAlpha = 1 - p;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const d = (10 + p * 55) * s;
      ctx.fillStyle = i % 2 ? '#f2eef7' : '#d9d3e2';
      ctx.beginPath(); ctx.arc(x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.7, (22 - p * 10) * s, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
    }
    ctx.restore();
  }

  function prettyLabel(v) { return String(v).charAt(0).toUpperCase() + String(v).slice(1); }

  global.Puppet = {
    OPTIONS, SLIDERS, PALETTES, COLOR_NAMES, HEAD, headTopLocal, defaultAvatar, randomAvatar, encodeCode, decodeAny, toFileContent,
    normalize, draw, drawBubble, drawLabel, drawPoof, Animator, getImage, imageFailed, hashString, mulberry32, prettyLabel,
    HEIGHT: 200,
  };
})(typeof window !== 'undefined' ? window : globalThis);
