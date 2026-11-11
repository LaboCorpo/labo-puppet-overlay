/*
 * Puppet renderer — shared by the overlay, the OBS source and the avatar creator.
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
    headShape: ['rond', 'ovale', 'carré', 'poire'],
    eyes: ['points', 'ronds', 'endormis', 'étoiles', 'lunettes', 'colère'],
    brows: ['aucun', 'fins', 'épais', 'froncés', 'surpris'],
    hair: ['aucun', 'court', 'pointes', 'bol', 'long', 'chignon', 'crête', 'afro'],
    hat: ['aucun', 'bonnet', 'casquette', 'couronne', 'casque audio', 'chapeau'],
    beard: ['aucune', 'barbe', 'bouc', 'moustache'],
    outfit: ['veste', 'pull', 'robe', 'costume'],
  };

  const PALETTES = {
    skin: ['#ffe0c2', '#f7c9a0', '#e8b088', '#c98d62', '#9c6644', '#6e4529', '#b5e3a1', '#c7c3ff'],
    hair: ['#2b1d14', '#5a3825', '#a0632b', '#e3b04b', '#f2e6c9', '#c0392b', '#7d3cff', '#2e86de', '#111111', '#9e9e9e'],
    cloth: ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#16a085', '#3498db', '#9b59b6', '#34495e', '#ecf0f1', '#ff6fa8'],
    eye: ['#2b1d14', '#2e86de', '#27ae60', '#7f8c8d', '#8e44ad'],
  };

  const OUTLINE = '#1d1a1f';
  const MOUTH = '#3b0f17';

  function defaultAvatar() {
    return {
      v: 1, kind: 'drawn', id: '', name: '',
      headShape: 'rond', skin: PALETTES.skin[0],
      eyes: 'points', eyeColor: PALETTES.eye[0], brows: 'fins',
      hair: 'court', hairColor: PALETTES.hair[1],
      hat: 'aucun', hatColor: PALETTES.cloth[0],
      beard: 'aucune',
      outfit: 'veste', clothColor: PALETTES.cloth[5], accentColor: PALETTES.cloth[2],
      photo: null, photoSplit: 0.58,
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
  // style: { palette: 'vif'|'pastel'|'mono'|'discord', hats: bool, beards: bool }
  function randomAvatar(seed, style) {
    style = style || {};
    const r = mulberry32(hashString(String(seed).toLowerCase()));
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    let cloth = PALETTES.cloth;
    if (style.palette === 'pastel') cloth = ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#d7baff', '#f4c2e0'];
    if (style.palette === 'mono') cloth = ['#2d2d2d', '#555555', '#888888', '#bbbbbb', '#e6e6e6'];
    if (style.palette === 'custom' && Array.isArray(style.colors) && style.colors.length) cloth = style.colors;
    const a = defaultAvatar();
    a.kind = 'drawn';
    a.headShape = pick(OPTIONS.headShape);
    a.skin = pick(PALETTES.skin.slice(0, 6));
    a.eyes = pick(OPTIONS.eyes);
    a.eyeColor = pick(PALETTES.eye);
    a.brows = pick(OPTIONS.brows);
    a.hair = pick(OPTIONS.hair);
    a.hairColor = pick(PALETTES.hair);
    a.hat = style.hats === false ? 'aucun' : (r() < 0.45 ? pick(OPTIONS.hat.slice(1)) : 'aucun');
    a.hatColor = pick(cloth);
    a.beard = style.beards === false ? 'aucune' : (r() < 0.25 ? pick(OPTIONS.beard.slice(1)) : 'aucune');
    a.outfit = pick(OPTIONS.outfit);
    a.clothColor = pick(cloth);
    a.accentColor = pick(cloth);
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
  const SHARE_KEYS = ['v', 'kind', 'id', 'name', 'headShape', 'skin', 'eyes', 'eyeColor', 'brows', 'hair', 'hairColor', 'hat', 'hatColor', 'beard', 'outfit', 'clothColor', 'accentColor', 'photoSplit'];
  function encodeCode(avatar) {
    if (avatar.kind === 'photo') throw new Error('Un avatar photo se partage en fichier .puppet');
    const o = {};
    SHARE_KEYS.forEach((k) => { if (avatar[k] !== undefined) o[k] = avatar[k]; });
    return 'PUP1.' + b64urlEncode(JSON.stringify(o));
  }
  function normalize(obj) {
    const a = Object.assign(defaultAvatar(), obj || {});
    a.id = String(a.id || '').trim();
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
    return JSON.stringify({ format: 'puppet-overlay-avatar', version: 1, avatar }, null, 0);
  }

  // ---------- Image cache ----------
  const imgCache = new Map();
  function getImage(src) {
    if (!src) return null;
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
    return e.ok ? e.img : null;
  }

  // ---------- Animation state per puppet ----------
  class Animator {
    constructor(seed) {
      const r = mulberry32(hashString(String(seed || Math.random())));
      this.phase = r() * 100;
      this.speed = 15 + r() * 6;
      this.open = 0;
      this.talking = false;
      this.nextBlink = 1 + r() * 3;
      this.blink = 0;
      this.hop = 0;
    }
    update(dt, t) {
      // Target mouth opening: jittery flapping while talking.
      let target = 0;
      if (this.talking) {
        const s = Math.sin((t + this.phase) * this.speed);
        const s2 = Math.sin((t + this.phase) * this.speed * 0.37);
        target = Math.max(0, 0.55 + 0.45 * s * (0.6 + 0.4 * s2));
      }
      const k = target > this.open ? 30 : 18;
      this.open += (target - this.open) * Math.min(1, dt * k);
      this.nextBlink -= dt;
      if (this.nextBlink <= 0) { this.blink = 0.14; this.nextBlink = 2 + Math.random() * 4; }
      this.blink = Math.max(0, this.blink - dt);
      this.hop = Math.max(0, this.hop - dt * 3);
    }
    state(t) {
      return {
        open: this.open,
        blinking: this.blink > 0,
        bob: Math.sin((t + this.phase) * 2.2) * 1.5 + (this.talking ? Math.abs(Math.sin((t + this.phase) * 9)) * -2.5 : 0) - Math.sin(this.hop * Math.PI) * 18,
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
    const n = parseInt(hex.replace('#', ''), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  // Head geometry in local units (feet at 0,0; puppet ~210 tall).
  const HEAD = { cx: 0, cy: -132, rx: 60, ry: 54 };
  function headPath(ctx, shape) {
    const { cx, cy, rx, ry } = HEAD;
    ctx.beginPath();
    if (shape === 'carré') {
      rr(ctx, cx - rx, cy - ry, rx * 2, ry * 2, 22);
    } else if (shape === 'ovale') {
      ctx.ellipse(cx, cy - 4, rx * 0.88, ry * 1.12, 0, 0, Math.PI * 2);
    } else if (shape === 'poire') {
      ctx.moveTo(cx, cy - ry);
      ctx.bezierCurveTo(cx + rx * 0.8, cy - ry, cx + rx * 1.08, cy + ry * 0.5, cx + rx * 0.7, cy + ry);
      ctx.lineTo(cx - rx * 0.7, cy + ry);
      ctx.bezierCurveTo(cx - rx * 1.08, cy + ry * 0.5, cx - rx * 0.8, cy - ry, cx, cy - ry);
      ctx.closePath();
    } else {
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    }
  }

  function drawBody(ctx, a) {
    const c = a.clothColor || '#3498db';
    // feet
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.ellipse(-18, -5, 16, 7, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
    ctx.beginPath(); ctx.ellipse(18, -5, 16, 7, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
    // torso (paper trapezoid)
    ctx.beginPath();
    if (a.outfit === 'robe') {
      ctx.moveTo(-26, -86); ctx.lineTo(26, -86); ctx.lineTo(46, -10); ctx.lineTo(-46, -10);
    } else {
      ctx.moveTo(-30, -88); ctx.lineTo(30, -88); ctx.lineTo(38, -10); ctx.lineTo(-38, -10);
    }
    ctx.closePath();
    ctx.fillStyle = c; ctx.fill(); stroke(ctx);
    // outfit details
    ctx.fillStyle = a.accentColor || '#f1c40f';
    if (a.outfit === 'veste') {
      ctx.beginPath(); ctx.moveTo(0, -88); ctx.lineTo(0, -10); stroke(ctx, 2);
      [-66, -46, -26].forEach((y) => { ctx.beginPath(); ctx.arc(-6, y, 3, 0, Math.PI * 2); ctx.fillStyle = OUTLINE; ctx.fill(); });
    } else if (a.outfit === 'pull') {
      ctx.fillRect(-34, -40, 68, 9); ctx.beginPath(); ctx.rect(-34, -40, 68, 9); stroke(ctx, 2);
    } else if (a.outfit === 'costume') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(-12, -88); ctx.lineTo(12, -88); ctx.lineTo(0, -56); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
      ctx.fillStyle = a.accentColor; ctx.beginPath(); ctx.moveTo(0, -84); ctx.lineTo(-5, -76); ctx.lineTo(0, -58); ctx.lineTo(5, -76); ctx.closePath(); ctx.fill(); stroke(ctx, 1.5);
    } else if (a.outfit === 'robe') {
      ctx.fillRect(-30, -58, 60, 6);
    }
    // mitten hands
    ctx.fillStyle = shade(c, -25);
    ctx.beginPath(); ctx.ellipse(-40, -40, 10, 12, 0.3, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
    ctx.beginPath(); ctx.ellipse(40, -40, 10, 12, -0.3, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
  }

  function drawEyes(ctx, a, blinking) {
    const y = HEAD.cy - 12, dx = 22;
    const col = a.eyeColor || OUTLINE;
    for (const side of [-1, 1]) {
      const x = HEAD.cx + side * dx - 4;
      if (blinking || a.eyes === 'endormis') {
        ctx.beginPath(); ctx.moveTo(x - 10, y + 2); ctx.quadraticCurveTo(x, y + (blinking ? 6 : 8), x + 10, y + 2); stroke(ctx, 3);
        continue;
      }
      if (a.eyes === 'points') {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      } else if (a.eyes === 'étoiles') {
        ctx.fillStyle = '#ffd34d'; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const ang = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? 4.5 : 11; ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad); }
        ctx.closePath(); ctx.fill(); stroke(ctx, 2);
      } else {
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x, y, 11, 12, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 2, y + 2, 5, 0, Math.PI * 2); ctx.fill();
        if (a.eyes === 'colère') {
          ctx.fillStyle = a.skin; ctx.beginPath(); ctx.moveTo(x - 13, y - 14); ctx.lineTo(x + 13, y - 14); ctx.lineTo(x - 13 * side, y - 1); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x + 13 * side, y - 13); ctx.lineTo(x - 13 * side, y - 1); stroke(ctx, 3);
        }
        if (a.eyes === 'lunettes') {
          ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); stroke(ctx, 3);
        }
      }
    }
    if (a.eyes === 'lunettes') { ctx.beginPath(); ctx.moveTo(HEAD.cx - 11, y); ctx.lineTo(HEAD.cx + 3, y); stroke(ctx, 3); }
  }

  function drawBrows(ctx, a) {
    if (a.brows === 'aucun') return;
    const y = HEAD.cy - 30;
    ctx.strokeStyle = a.hairColor || OUTLINE;
    for (const side of [-1, 1]) {
      const x = HEAD.cx + side * 22 - 4;
      ctx.beginPath();
      if (a.brows === 'froncés') { ctx.moveTo(x - 10 * side, y - 4); ctx.lineTo(x + 10 * side, y + 4); }
      else if (a.brows === 'surpris') { ctx.moveTo(x - 9, y - 2); ctx.quadraticCurveTo(x, y - 12, x + 9, y - 2); }
      else { ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y - 1); }
      ctx.lineWidth = a.brows === 'épais' ? 7 : 3.5; ctx.lineCap = 'round'; ctx.strokeStyle = a.hairColor; ctx.stroke();
    }
  }

  function drawHair(ctx, a) {
    const { cx, cy, rx, ry } = HEAD;
    const top = cy - ry;
    ctx.fillStyle = a.hairColor;
    ctx.beginPath();
    switch (a.hair) {
      case 'court':
        ctx.ellipse(cx, cy - ry * 0.55, rx * 0.98, ry * 0.55, 0, Math.PI, Math.PI * 2); break;
      case 'pointes':
        ctx.moveTo(cx - rx, cy - 18);
        for (let i = 0; i <= 8; i++) { const x = cx - rx + (i * rx * 2) / 8; ctx.lineTo(x, i % 2 ? top - 14 : top + 10); }
        ctx.lineTo(cx + rx, cy - 18); break;
      case 'bol':
        ctx.moveTo(cx - rx - 4, cy - 6); ctx.ellipse(cx, cy - 6, rx + 4, ry + 6, 0, Math.PI, Math.PI * 2); ctx.lineTo(cx - rx - 4, cy - 6); break;
      case 'long':
        ctx.ellipse(cx, cy - ry * 0.5, rx * 1.02, ry * 0.6, 0, Math.PI, Math.PI * 2);
        ctx.rect(cx - rx - 6, cy - ry * 0.5, 16, ry * 1.1); ctx.rect(cx + rx - 10, cy - ry * 0.5, 16, ry * 0.95); break;
      case 'chignon':
        ctx.ellipse(cx, cy - ry * 0.55, rx * 0.98, ry * 0.55, 0, Math.PI, Math.PI * 2);
        ctx.moveTo(cx + 22, top - 10); ctx.arc(cx, top - 10, 22, 0, Math.PI * 2); break;
      case 'crête':
        ctx.moveTo(cx - 14, top + 6);
        for (let i = 0; i < 5; i++) { ctx.lineTo(cx - 14 + i * 7, top - 26 - (i % 2) * 6); ctx.lineTo(cx - 10 + i * 7, top + 2); }
        break;
      case 'afro':
        for (let i = 0; i < 9; i++) { const ang = Math.PI + (i * Math.PI) / 8; ctx.moveTo(cx + Math.cos(ang) * rx + 20, cy - 10 + Math.sin(ang) * ry); ctx.arc(cx + Math.cos(ang) * rx, cy - 10 + Math.sin(ang) * ry, 20, 0, Math.PI * 2); }
        break;
      default: return;
    }
    ctx.fill(); stroke(ctx, 2.5);
  }

  function drawHat(ctx, a) {
    const { cx, cy, rx, ry } = HEAD;
    const top = cy - ry;
    const c = a.hatColor;
    ctx.fillStyle = c;
    switch (a.hat) {
      case 'bonnet':
        ctx.beginPath(); ctx.ellipse(cx, top + 18, rx * 0.95, ry * 0.75, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.fillStyle = shade(c, -30); rr(ctx, cx - rx * 0.98, top + 8, rx * 1.96, 16, 6); ctx.fill(); stroke(ctx, 2.5);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, top - 36, 10, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
        break;
      case 'casquette':
        ctx.beginPath(); ctx.ellipse(cx, top + 16, rx * 0.92, ry * 0.6, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.fillStyle = shade(c, -30); ctx.beginPath(); ctx.ellipse(cx - rx * 0.75, top + 15, 34, 7, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
        break;
      case 'couronne':
        ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.moveTo(cx - 34, top + 8);
        [[-34, -22], [-17, -6], [0, -28], [17, -6], [34, -22]].forEach(([x, y]) => ctx.lineTo(cx + x, top + y));
        ctx.lineTo(cx + 34, top + 8); ctx.closePath(); ctx.fill(); stroke(ctx);
        break;
      case 'casque audio':
        ctx.beginPath(); ctx.ellipse(cx, cy - 6, rx + 6, ry + 8, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.lineWidth = 9; ctx.strokeStyle = OUTLINE; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = c; ctx.stroke();
        for (const s of [-1, 1]) { ctx.fillStyle = c; rr(ctx, cx + s * (rx + 2) - 9, cy - 22, 18, 30, 7); ctx.fill(); stroke(ctx, 2.5); }
        break;
      case 'chapeau':
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(cx, top + 10, rx + 18, 10, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx);
        rr(ctx, cx - rx * 0.62, top - 40, rx * 1.24, 52, 8); ctx.fill(); stroke(ctx);
        ctx.fillStyle = a.accentColor; ctx.fillRect(cx - rx * 0.62, top - 2, rx * 1.24, 9);
        break;
      default:
    }
  }

  function drawBeard(ctx, a, splitY) {
    const { cx } = HEAD;
    if (a.beard === 'aucune') return;
    ctx.fillStyle = a.hairColor;
    ctx.beginPath();
    if (a.beard === 'barbe') { ctx.moveTo(cx - 50, splitY + 2); ctx.quadraticCurveTo(cx, splitY + 70, cx + 50, splitY + 2); ctx.closePath(); }
    else if (a.beard === 'bouc') { ctx.moveTo(cx - 14, splitY + 8); ctx.quadraticCurveTo(cx - 4, splitY + 40, cx + 6, splitY + 8); ctx.closePath(); }
    else { ctx.fill(); return; }
    ctx.fill(); stroke(ctx, 2.5);
  }

  /**
   * Draw one puppet.
   * a: avatar object; st: {open 0..1, blinking, bob}; opts: {x, y, scale, name, muted, deaf, glow, flip, discordAvatarUrl}
   */
  function draw(ctx, a, st, opts) {
    opts = opts || {};
    const s = opts.scale || 1;
    ctx.save();
    ctx.translate(opts.x || 0, (opts.y || 0) + (st.bob || 0) * s);
    ctx.scale(s * (opts.flip ? -1 : 1), s);

    // soft shadow under the paper cut-out
    ctx.save();
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, 2 - (st.bob || 0), 46, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    drawBody(ctx, a);

    const photoSrc = a.kind === 'photo' ? a.photo : (a.kind === 'discord' ? opts.discordAvatarUrl : null);
    const img = photoSrc ? getImage(photoSrc) : null;
    const isPhoto = !!photoSrc;
    const shape = isPhoto ? (a.headShape === 'carré' ? 'carré' : 'rond') : a.headShape;
    const splitRatio = isPhoto ? (a.photoSplit || 0.6) : 0.62;
    const splitY = HEAD.cy - HEAD.ry + HEAD.ry * 2 * splitRatio;
    const pivotX = HEAD.cx + HEAD.rx * 0.92;
    const angle = (st.open || 0) * 0.6; // radians; upper half hinges at the back

    const fillHead = () => {
      if (isPhoto) {
        if (img) ctx.drawImage(img, HEAD.cx - HEAD.rx, HEAD.cy - HEAD.ry, HEAD.rx * 2, HEAD.ry * 2);
        else { ctx.fillStyle = '#8a8a99'; ctx.fill(); }
      } else { ctx.fillStyle = a.skin; ctx.fill(); }
    };

    // ---- lower jaw ----
    ctx.save();
    ctx.beginPath(); ctx.rect(-200, splitY, 400, 200); ctx.clip();
    headPath(ctx, shape); ctx.save(); ctx.clip(); fillHead(); ctx.restore();
    headPath(ctx, shape); stroke(ctx);
    ctx.restore();
    if (!isPhoto) drawBeard(ctx, a, splitY);

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
    if (!isPhoto) drawHair(ctx, a.hair === 'long' || a.hair === 'afro' ? a : { hair: 'aucun' }); // back hair
    ctx.save();
    ctx.beginPath(); ctx.rect(-200, -400, 400, splitY + 400); ctx.clip();
    headPath(ctx, shape); ctx.save(); ctx.clip(); fillHead(); ctx.restore();
    headPath(ctx, shape); stroke(ctx);
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(HEAD.cx - HEAD.rx * 0.98, splitY); ctx.lineTo(pivotX, splitY); stroke(ctx, 2.5);
    if (!isPhoto) {
      if (a.beard === 'moustache') {
        ctx.fillStyle = a.hairColor; ctx.beginPath(); ctx.ellipse(HEAD.cx - 12, splitY - 6, 22, 7, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
      }
      drawEyes(ctx, a, st.blinking);
      drawBrows(ctx, a);
      if (a.hair !== 'long' && a.hair !== 'afro') {
        // Tall hairstyles would poke through hats: flatten them under a hat.
        const hatted = a.hat && a.hat !== 'aucun' && a.hat !== 'casque audio' && a.hat !== 'couronne';
        drawHair(ctx, hatted && ['pointes', 'crête', 'chignon'].includes(a.hair) ? Object.assign({}, a, { hair: 'court' }) : a);
      }
    }
    if (a.hat && a.hat !== 'aucun') drawHat(ctx, a);
    ctx.restore();

    ctx.restore();

    // ---- overlays not affected by flip ----
    const headTopY = (opts.y || 0) + (st.bob || 0) * s + (HEAD.cy - HEAD.ry) * s;
    if (opts.glow) {
      ctx.save(); ctx.globalAlpha = 0.9; ctx.strokeStyle = '#43b581'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(opts.x, (opts.y || 0) + HEAD.cy * s + (st.bob || 0) * s, HEAD.rx * s + 8, HEAD.ry * s + 8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (opts.muted || opts.deaf) drawStatusIcon(ctx, opts.x + HEAD.rx * s * 0.9, headTopY + 8, opts.deaf ? 'deaf' : 'mute', Math.max(0.6, s));
    if (opts.name) drawLabel(ctx, opts.name, opts.x, (opts.y || 0) + 14 * s, Math.max(0.7, s), opts.labelColor);
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

  // Speech bubble above a puppet (Twitch chat). Returns nothing; wraps text to maxLines.
  function drawBubble(ctx, text, x, headTopY, s, opts) {
    opts = opts || {};
    const maxW = (opts.maxWidth || 220) * s, pad = 9 * s, lineH = 17 * s, maxLines = opts.maxLines || 3;
    ctx.save();
    ctx.font = `600 ${Math.round(14 * s)}px "Segoe UI", system-ui, sans-serif`;
    const words = String(text).split(/\s+/); const lines = []; let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW - pad * 2 && cur) { lines.push(cur); cur = w; } else cur = test;
      if (lines.length >= maxLines) break;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '…');
    const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2);
    const h = lines.length * lineH + pad * 2 - 4 * s;
    const bx = Math.max(4, Math.min((opts.viewW || ctx.canvas.width) - w - 4, x - w / 2)), by = headTopY - h - 16 * s;
    ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    ctx.fillStyle = opts.bg || '#ffffff';
    rr(ctx, bx, by, w, h, 10 * s); ctx.fill(); stroke(ctx, 2.5);
    ctx.beginPath(); ctx.moveTo(x - 8 * s, by + h - 1); ctx.lineTo(x, by + h + 12 * s); ctx.lineTo(x + 6 * s, by + h - 1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 8 * s, by + h); ctx.lineTo(x, by + h + 12 * s); ctx.lineTo(x + 6 * s, by + h); stroke(ctx, 2.5);
    ctx.fillStyle = opts.fg || '#1d1a1f'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + pad, by + pad + i * lineH));
    ctx.restore();
  }

  global.Puppet = {
    OPTIONS, PALETTES, HEAD, defaultAvatar, randomAvatar, encodeCode, decodeAny, toFileContent,
    normalize, draw, drawBubble, drawLabel, Animator, getImage, hashString,
    HEIGHT: 200,
  };
})(typeof window !== 'undefined' ? window : globalThis);
