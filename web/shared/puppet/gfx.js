/*
 * Drawing primitives and head geometry shared by every part (local units: feet at 0,0; puppet ~210 tall).
 */
(function (global) {
  'use strict';
  const P = (global.Puppet = global.Puppet || {});

  const OUTLINE = '#1d1a1f';
  const MOUTH = '#3b0f17';

  // Transform helper: scale/rotate around a pivot, optionally shifted.
  function around(ctx, px, py, sc, rot, dx, dy) {
    ctx.translate(px + (dx || 0), py + (dy || 0));
    if (rot) ctx.rotate(rot);
    if (sc && sc !== 1) ctx.scale(sc, sc);
    ctx.translate(-px, -py);
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

  function star(ctx, x, y, R, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const ang = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R; ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad); }
    ctx.closePath(); ctx.fill();
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

  P.gfx = { OUTLINE, MOUTH, HEAD, NECK_Y, CHIN_Y, around, rr, stroke, shade, star, headPath, headTopOffset, headTransform, headY, headTopLocal, getImage, imageFailed };
  P.headTopLocal = headTopLocal;
})(typeof window !== 'undefined' ? window : globalThis);
