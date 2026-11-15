/*
 * Avatar format: part catalogue, sliders, defaults, deterministic random looks, share codes.
 * No drawing here, so the main process can require() it (attaches globalThis.Puppet).
 */
(function (global) {
  'use strict';
  const P = (global.Puppet = global.Puppet || {});

  // ---------- Options shown in the creator ----------
  const OPTIONS = {
    headShape: ['round', 'oval', 'square', 'pear', 'egg', 'wide', 'tall'],
    eyes: ['dots', 'round', 'sleepy', 'stars', 'angry', 'happy', 'cute', 'wink', 'dizzy', 'hearts'],
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
    a.eyes = pick(OPTIONS.eyes);
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
  const KINDS = ['drawn', 'photo', 'discord'];
  const COLOR_KEYS = ['skin', 'eyeColor', 'hairColor', 'hatColor', 'clothColor', 'accentColor', 'glassesColor', 'neckColor'];
  const PHOTO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
  const PHOTO_MAX = 1_500_000; // chars; a baked 220x198 photo is ~20 KB
  const clampNum = (v, min, max, def) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };

  // Returns a clean avatar: only known keys, valid options, clamped sliders, hex colours, data-URL photo.
  // Keeps old codes/files loadable (French values from v0.1, eyes:'glasses' from v0.1/0.2).
  function normalize(obj) {
    const src = obj && typeof obj === 'object' ? obj : {};
    const def = defaultAvatar();
    const a = {};
    for (const k of Object.keys(def)) a[k] = src[k] === undefined ? def[k] : src[k];
    for (const k of Object.keys(OPTIONS)) if (typeof a[k] === 'string' && LEGACY[a[k]]) a[k] = LEGACY[a[k]];
    if (a.eyes === 'glasses') { a.eyes = 'round'; if (a.glasses === 'none' || !OPTIONS.glasses.includes(a.glasses)) a.glasses = 'round'; }
    for (const k of Object.keys(OPTIONS)) if (!OPTIONS[k].includes(a[k])) a[k] = def[k];
    for (const [k, [min, max, d]] of Object.entries(SLIDERS)) a[k] = clampNum(a[k], min, max, d);
    for (const k of COLOR_KEYS) if (!/^#[0-9a-f]{3,8}$/i.test(String(a[k]))) a[k] = def[k];
    a.v = def.v;
    a.kind = KINDS.includes(a.kind) ? a.kind : 'drawn';
    a.id = String(a.id || '').replace(/\D/g, '').slice(0, 22);
    a.name = String(a.name || '').trim().slice(0, 32);
    a.photoSplit = clampNum(a.photoSplit, 0.35, 0.85, def.photoSplit);
    a.photo = typeof a.photo === 'string' && a.photo.length <= PHOTO_MAX && PHOTO_RE.test(a.photo) ? a.photo : null;
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

  function prettyLabel(v) { return String(v).charAt(0).toUpperCase() + String(v).slice(1); }

  Object.assign(P, { OPTIONS, SLIDERS, PALETTES, COLOR_NAMES, defaultAvatar, randomAvatar, encodeCode, decodeAny, toFileContent, normalize, prettyLabel, hashString, mulberry32 });
})(typeof window !== 'undefined' ? window : globalThis);
