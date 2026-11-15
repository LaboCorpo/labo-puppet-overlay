/*
 * Face parts: eyes, glasses, brows, nose, cheeks, teeth, and the mute/deafen props.
 */
(function (global) {
  'use strict';
  const P = (global.Puppet = global.Puppet || {});
  const { OUTLINE, HEAD, around, rr, stroke, shade, star } = P.gfx;

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

  P.parts = Object.assign(P.parts || {}, { drawEyes, drawGlasses, drawBrows, drawNose, drawCheeks, drawTeeth, drawTape, drawEarmuffs });
})(typeof window !== 'undefined' ? window : globalThis);
