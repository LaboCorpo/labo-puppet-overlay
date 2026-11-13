/*
 * Puppet renderer: assembles the parts into one cut-paper marionette, plus labels, bubbles and puffs.
 * The head is split along the mouth line; the upper half hinges open at the back of the head when the user speaks.
 */
(function (global) {
  'use strict';
  const P = (global.Puppet = global.Puppet || {});
  const { defaultAvatar } = P;
  const { OUTLINE, MOUTH, HEAD, NECK_Y, around, rr, stroke, shade, headPath, headTransform, headY, headTopLocal, getImage, imageFailed } = P.gfx;
  const { drawBody, drawLeftHand, drawNeckwear, drawEyes, drawGlasses, drawBrows, drawNose, drawCheeks, drawTeeth, drawTape, drawEarmuffs, drawHair, drawHat, drawBeard, drawMustache } = P.parts;

  // Drawn face used when a Discord picture can't load (offline, CDN error). Cached per avatar object.
  const fallbackFaces = new WeakMap();
  function fallbackFace(a) {
    let f = fallbackFaces.get(a);
    if (!f) { f = Object.assign(defaultAvatar(), { clothColor: a.clothColor, accentColor: a.accentColor }); fallbackFaces.set(a, f); }
    return f;
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
    const face = isPhoto || a.kind !== 'discord' ? a : fallbackFace(a);

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

  // Text wrapping is measured once per (text, size) and cached: bubbles are redrawn every frame.
  const wrapCache = new Map();
  function wrapText(ctx, text, maxW, maxLines) {
    const key = ctx.font + '|' + maxW + '|' + maxLines + '|' + text;
    let hit = wrapCache.get(key);
    if (hit) return hit;
    // Hard-wrap very long words (URLs, spam) so they cannot overflow.
    const words = [];
    String(text).split(/\s+/).forEach((w) => {
      while (ctx.measureText(w).width > maxW && w.length > 4) {
        let n = w.length - 1;
        while (n > 1 && ctx.measureText(w.slice(0, n)).width > maxW) n--;
        words.push(w.slice(0, n)); w = w.slice(n);
      }
      words.push(w);
    });
    const lines = []; let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
      if (lines.length >= maxLines) break;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '…');
    let width = 0;
    for (const l of lines) width = Math.max(width, ctx.measureText(l).width);
    if (wrapCache.size > 300) wrapCache.clear();
    hit = { lines, width };
    wrapCache.set(key, hit);
    return hit;
  }

  // Speech bubble above a puppet (Twitch chat). Wraps text to maxLines.
  function drawBubble(ctx, text, x, headTopY, s, opts) {
    opts = opts || {};
    const maxW = (opts.maxWidth || 220) * s, pad = 9 * s, lineH = 17 * s, maxLines = opts.maxLines || 3;
    ctx.save();
    ctx.font = `600 ${Math.round(14 * s)}px "Segoe UI", system-ui, sans-serif`;
    const { lines, width } = wrapText(ctx, text, maxW - pad * 2, maxLines);
    const w = Math.min(maxW, width + pad * 2);
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

  Object.assign(P, { draw, drawBubble, drawPoof });
})(typeof window !== 'undefined' ? window : globalThis);
