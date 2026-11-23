/*
 * Extra parts (v1.5): new hats, face extras, things on the back and new held items.
 * Same cut-paper style: flat colours, thick dark outline, a few light highlights.
 * Loaded after hair.js, before render.js.
 */
(function (global) {
  'use strict';
  const P = (global.Puppet = global.Puppet || {});
  const { OUTLINE, rr, stroke, shade, star, HEAD } = P.gfx;
  const hi = (ctx, x, y, rx, ry, rot) => { ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); ctx.fill(); };

  // ---------- Hats (top = top of the head) ----------
  function drawExtraHat(ctx, a, time, top, c) {
    const { cx, rx } = HEAD;
    switch (a.hat) {
      case 'viking': {
        for (const s of [-1, 1]) { // horns
          ctx.fillStyle = '#f4ead2';
          ctx.beginPath(); ctx.moveTo(cx + s * 40, top + 6); ctx.quadraticCurveTo(cx + s * 80, top - 4, cx + s * 74, top - 44); ctx.quadraticCurveTo(cx + s * 62, top - 14, cx + s * 34, top - 8); ctx.closePath(); ctx.fill(); stroke(ctx, 2.5);
        }
        ctx.fillStyle = '#9aa3ad'; ctx.beginPath(); ctx.ellipse(cx, top + 14, rx * 0.95, 44, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.fillStyle = c; rr(ctx, cx - rx * 0.97, top + 4, rx * 1.94, 13, 5); ctx.fill(); stroke(ctx, 2.5);
        ctx.fillStyle = '#d9dee3'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(cx + i * 22, top + 10.5, 2.6, 0, Math.PI * 2); ctx.fill(); }
        hi(ctx, cx - 18, top - 16, 12, 6, -0.3);
        break;
      }
      case 'catears':
        for (const s of [-1, 1]) {
          ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(cx + s * 18, top + 12); ctx.lineTo(cx + s * 40, top - 30); ctx.lineTo(cx + s * 56, top + 22); ctx.closePath(); ctx.fill(); stroke(ctx);
          ctx.fillStyle = '#ffb3c7'; ctx.beginPath(); ctx.moveTo(cx + s * 27, top + 10); ctx.lineTo(cx + s * 40, top - 16); ctx.lineTo(cx + s * 49, top + 16); ctx.closePath(); ctx.fill();
        }
        ctx.lineWidth = 5; ctx.strokeStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(cx, top + 30, rx * 0.98, 30, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        ctx.lineWidth = 2.5; ctx.strokeStyle = c; ctx.stroke();
        break;
      case 'bucket':
        ctx.fillStyle = shade(c, -18);
        ctx.beginPath(); ctx.moveTo(cx - rx - 16, top + 22); ctx.quadraticCurveTo(cx, top + 36, cx + rx + 16, top + 22); ctx.lineTo(cx + rx - 4, top + 6); ctx.lineTo(cx - rx + 4, top + 6); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(cx - rx * 0.86, top + 10); ctx.quadraticCurveTo(cx - rx * 0.8, top - 30, cx, top - 32); ctx.quadraticCurveTo(cx + rx * 0.8, top - 30, cx + rx * 0.86, top + 10); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(cx - rx * 0.84, top + 2); ctx.quadraticCurveTo(cx, top + 8, cx + rx * 0.84, top + 2); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.stroke(); ctx.setLineDash([]);
        hi(ctx, cx - 20, top - 16, 10, 5, -0.2);
        break;
      case 'graduation':
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(cx, top + 10, rx * 0.8, 20, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.moveTo(cx - 70, top - 12); ctx.lineTo(cx, top - 34); ctx.lineTo(cx + 70, top - 12); ctx.lineTo(cx, top + 8); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.beginPath(); ctx.moveTo(cx, top - 12); ctx.quadraticCurveTo(cx + 50, top - 8, cx + 52, top + 22); ctx.lineWidth = 2.5; ctx.strokeStyle = '#f5c518'; ctx.stroke();
        ctx.fillStyle = '#f5c518'; rr(ctx, cx + 47, top + 20, 10, 16, 3); ctx.fill(); stroke(ctx, 1.8);
        ctx.beginPath(); ctx.arc(cx, top - 12, 4, 0, Math.PI * 2); ctx.fill();
        break;
      case 'flowercrown': {
        ctx.lineWidth = 6; ctx.strokeStyle = '#3f8f3a'; ctx.beginPath(); ctx.ellipse(cx, top + 26, rx * 0.98, 26, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
        const cols = ['#ff6fa8', '#ffd43b', '#ffffff', '#b18cff', '#ff8a5c'];
        for (let i = 0; i < 7; i++) {
          const ang = Math.PI * (1.12 + i * 0.127), x = cx + Math.cos(ang) * rx * 0.98, y = top + 26 + Math.sin(ang) * 26;
          ctx.fillStyle = cols[i % cols.length];
          for (let k = 0; k < 5; k++) { const pa = k * 1.2566; ctx.beginPath(); ctx.ellipse(x + Math.cos(pa) * 6, y + Math.sin(pa) * 6, 5.5, 4, pa, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 1.5); }
          ctx.fillStyle = '#f5a623'; ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 1.2);
        }
        break;
      }
      case 'sombrero':
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(cx, top + 12, rx + 52, 18, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx);
        ctx.beginPath(); ctx.moveTo(cx - 34, top + 8); ctx.quadraticCurveTo(cx - 30, top - 46, cx, top - 50); ctx.quadraticCurveTo(cx + 30, top - 46, cx + 34, top + 8); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.fillStyle = a.accentColor || '#e74c3c'; ctx.fillRect(cx - 33, top - 6, 66, 9);
        for (let i = -3; i <= 3; i++) { ctx.fillStyle = i % 2 ? '#ffd43b' : '#2ecc71'; ctx.beginPath(); ctx.arc(cx + i * 18, top + 18, 3, 0, Math.PI * 2); ctx.fill(); }
        break;
      case 'mushroom':
        ctx.fillStyle = '#e0383b';
        ctx.beginPath(); ctx.moveTo(cx - rx - 20, top + 16); ctx.bezierCurveTo(cx - rx - 14, top - 52, cx + rx + 14, top - 52, cx + rx + 20, top + 16); ctx.quadraticCurveTo(cx, top + 30, cx - rx - 20, top + 16); ctx.closePath(); ctx.fill(); stroke(ctx);
        ctx.fillStyle = '#fff7ea';
        [[-38, -6, 9], [-6, -24, 11], [28, -10, 8], [52, 6, 6], [-62, 8, 6], [8, 4, 6]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(cx + x, top + y, r, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 1.6); });
        break;
      case 'frog':
        ctx.fillStyle = '#5cc95a';
        ctx.beginPath(); ctx.ellipse(cx, top + 16, rx * 0.98, 40, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); stroke(ctx);
        for (const s of [-1, 1]) {
          ctx.fillStyle = '#5cc95a'; ctx.beginPath(); ctx.arc(cx + s * 26, top - 22, 15, 0, Math.PI * 2); ctx.fill(); stroke(ctx);
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + s * 26, top - 22, 9, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2);
          ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(cx + s * 26 + 2, top - 21, 4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#ff8fb1'; ctx.beginPath(); ctx.ellipse(cx - 42, top + 2, 7, 4, 0, 0, Math.PI * 2); ctx.ellipse(cx + 42, top + 2, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
        break;
      default:
    }
  }

  // ---------- Face extras (on the upper half of the head; y of the eyes) ----------
  function drawFaceExtra(ctx, a, splitY) {
    const { cx, cy, rx } = HEAD;
    const ey = cy - 12 + (a.eyeHeight || 0) * 12, dx = 22 * (a.eyeSpacing || 1);
    switch (a.faceExtra) {
      case 'eyepatch':
        ctx.beginPath(); ctx.moveTo(cx - rx + 2, ey - 22); ctx.lineTo(cx + rx - 4, ey + 14); ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.stroke();
        ctx.fillStyle = '#1d1520'; ctx.beginPath(); ctx.ellipse(cx + dx, ey + 1, 14, 12, 0.2, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
        hi(ctx, cx + dx - 4, ey - 4, 4, 2, 0.3);
        break;
      case 'mask':
        ctx.fillStyle = a.accentColor || '#1d1520';
        ctx.beginPath(); ctx.moveTo(cx - rx + 4, ey - 4); ctx.quadraticCurveTo(cx - dx, ey - 22, cx, ey - 10); ctx.quadraticCurveTo(cx + dx, ey - 22, cx + rx - 4, ey - 4);
        ctx.quadraticCurveTo(cx + dx, ey + 22, cx, ey + 8); ctx.quadraticCurveTo(cx - dx, ey + 22, cx - rx + 4, ey - 4); ctx.closePath(); ctx.fill(); stroke(ctx, 2.5);
        for (const s of [-1, 1]) { ctx.fillStyle = a.skin || '#ffe0c2'; ctx.beginPath(); ctx.ellipse(cx + s * dx, ey, 8.5, 7, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2); ctx.fillStyle = a.eyeColor || OUTLINE; ctx.beginPath(); ctx.arc(cx + s * dx, ey + 1, 3.4, 0, Math.PI * 2); ctx.fill(); }
        break;
      case 'warpaint':
        ctx.fillStyle = a.accentColor || '#e74c3c';
        for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(cx + s * (dx + 9), ey - 6 + i * 8); ctx.lineTo(cx + s * (dx + 30), ey - 9 + i * 8); ctx.lineTo(cx + s * (dx + 29), ey - 4 + i * 8); ctx.lineTo(cx + s * (dx + 9), ey - 1 + i * 8); ctx.closePath(); ctx.fill(); }
        break;
      case 'earrings':
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.arc(cx + s * (rx - 2), cy + 6, 7, 0, Math.PI * 2); ctx.lineWidth = 5.5; ctx.strokeStyle = OUTLINE; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#f5c518'; ctx.stroke();
        }
        break;
      case 'piercing':
        ctx.fillStyle = '#d9dee3'; for (const [x, y] of [[cx + dx + 12, ey - 14], [cx + dx + 16, ey - 10], [cx - 4, ey + 26]]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 1.5); }
        break;
      case 'sparkle':
        ctx.fillStyle = '#ffd43b'; star(ctx, cx - dx - 18, ey - 18, 8, 3.5); stroke(ctx, 1.5); star(ctx, cx + dx + 22, ey + 16, 6, 2.6); stroke(ctx, 1.5);
        break;
      default:
    }
  }

  // ---------- On the back (drawn before the body) ----------
  function drawBack(ctx, a, st) {
    const t = (st && st.time) || 0;
    switch (a.back) {
      case 'wings': case 'angelwings': {
        const flap = Math.sin(t * 3) * 0.08;
        for (const s of [-1, 1]) {
          ctx.save(); ctx.translate(s * 22, -70); ctx.rotate(s * (0.15 + flap)); ctx.scale(s, 1);
          ctx.fillStyle = a.back === 'angelwings' ? '#ffffff' : (a.accentColor || '#9b59b6');
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(30, -46, 78, -40, 86, -22); ctx.bezierCurveTo(70, -14, 74, -2, 60, 2); ctx.bezierCurveTo(52, 10, 46, 14, 34, 16); ctx.bezierCurveTo(22, 20, 10, 16, 0, 8); ctx.closePath(); ctx.fill(); stroke(ctx);
          ctx.beginPath(); ctx.moveTo(18, 2); ctx.quadraticCurveTo(44, -14, 70, -18); ctx.moveTo(16, 10); ctx.quadraticCurveTo(38, 2, 56, 0); ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case 'backpack':
        ctx.fillStyle = a.accentColor || '#e67e22'; rr(ctx, -52, -92, 104, 74, 20); ctx.fill(); stroke(ctx);
        ctx.fillStyle = shade(a.accentColor || '#e67e22', -25); for (const s of [-1, 1]) { rr(ctx, s * 46 - 9, -66, 18, 34, 7); ctx.fill(); stroke(ctx, 2.5); }
        break;
      case 'jetpack': {
        for (const s of [-1, 1]) {
          const x0 = s * 46;
          ctx.fillStyle = '#b9c3cc'; rr(ctx, x0 - 12, -92, 24, 64, 10); ctx.fill(); stroke(ctx);
          ctx.fillStyle = '#e74c3c'; rr(ctx, x0 - 12, -96, 24, 14, 6); ctx.fill(); stroke(ctx, 2);
          hi(ctx, x0 - 5, -70, 3, 12, 0);
          const f = 18 + Math.sin(t * 20 + s) * 6;
          ctx.fillStyle = '#ffb703'; ctx.beginPath(); ctx.moveTo(x0 - 9, -28); ctx.quadraticCurveTo(x0, -28 + f * 1.6, x0 + 9, -28); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.moveTo(x0 - 5, -28); ctx.quadraticCurveTo(x0, -28 + f, x0 + 5, -28); ctx.closePath(); ctx.fill();
        }
        break;
      }
      case 'sword':
        ctx.save(); ctx.rotate(0.55);
        ctx.fillStyle = '#d9dee3'; ctx.beginPath(); ctx.moveTo(-6, -40); ctx.lineTo(6, -40); ctx.lineTo(6, -150); ctx.lineTo(0, -166); ctx.lineTo(-6, -150); ctx.closePath(); ctx.fill(); stroke(ctx, 2.5);
        ctx.fillStyle = '#f5c518'; rr(ctx, -20, -44, 40, 8, 3); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = '#7f5539'; rr(ctx, -5, -36, 10, 26, 3); ctx.fill(); stroke(ctx, 2);
        ctx.restore();
        break;
      default:
    }
  }

  // ---------- More held items (around the left hand at x, y) ----------
  function drawExtraHeld(ctx, a, st, x, y) {
    switch (a.held) {
      case 'guitar':
        ctx.save(); ctx.translate(x + 2, y + 6); ctx.rotate(-0.6);
        ctx.fillStyle = '#7f5539'; rr(ctx, -3, -58, 6, 46, 2); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = '#2b1d14'; rr(ctx, -5, -66, 10, 10, 2); ctx.fill(); stroke(ctx, 1.8);
        ctx.fillStyle = a.accentColor || '#e74c3c';
        ctx.beginPath(); ctx.ellipse(0, -6, 14, 11, 0, 0, Math.PI * 2); ctx.ellipse(0, 12, 18, 14, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
        ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(0, 4, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      case 'banana':
        ctx.save(); ctx.translate(x, y - 4); ctx.rotate(-0.3);
        ctx.fillStyle = '#ffd43b';
        ctx.beginPath(); ctx.moveTo(-4, -24); ctx.quadraticCurveTo(-18, -2, -2, 18); ctx.quadraticCurveTo(10, 24, 20, 18); ctx.quadraticCurveTo(4, 10, 4, -22); ctx.closePath(); ctx.fill(); stroke(ctx, 2.5);
        ctx.fillStyle = '#5a3825'; rr(ctx, -6, -30, 6, 8, 2); ctx.fill();
        hi(ctx, -6, -2, 2, 8, 0.2);
        ctx.restore();
        break;
      case 'icecream':
        ctx.save(); ctx.translate(x + 2, y);
        ctx.fillStyle = '#e8b36a'; ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(10, -8); ctx.lineTo(0, 18); ctx.closePath(); ctx.fill(); stroke(ctx, 2.5);
        ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(4, -8); ctx.moveTo(-3, 6); ctx.lineTo(7, -2); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
        ctx.fillStyle = '#ff9ec7'; ctx.beginPath(); ctx.arc(0, -16, 11, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
        ctx.fillStyle = '#c9f2ff'; ctx.beginPath(); ctx.arc(0, -31, 9, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 2.5);
        ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(2, -41, 3.5, 0, Math.PI * 2); ctx.fill(); stroke(ctx, 1.5);
        ctx.restore();
        break;
      case 'wand':
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5);
        ctx.fillStyle = '#2b1d14'; rr(ctx, -2.5, -40, 5, 52, 2); ctx.fill(); stroke(ctx, 1.8);
        ctx.fillStyle = '#ffd43b'; star(ctx, 0, -46, 11, 5); stroke(ctx, 2);
        const tw = Math.sin(((st && st.time) || 0) * 6);
        ctx.fillStyle = '#fff'; star(ctx, 14, -60 + tw * 3, 4, 1.6); star(ctx, -12, -56 - tw * 3, 3, 1.2);
        ctx.restore();
        break;
      case 'book':
        ctx.save(); ctx.translate(x + 4, y - 4); ctx.rotate(-0.15);
        ctx.fillStyle = a.accentColor || '#2e86de'; rr(ctx, -16, -22, 32, 40, 3); ctx.fill(); stroke(ctx, 2.5);
        ctx.fillStyle = '#f4f1ea'; ctx.fillRect(12, -20, 3, 36);
        ctx.fillStyle = 'rgba(255,255,255,.75)'; rr(ctx, -10, -14, 18, 5, 2); ctx.fill();
        ctx.restore();
        break;
      default:
    }
  }

  P.parts = Object.assign(P.parts || {}, { drawExtraHat, drawFaceExtra, drawBack, drawExtraHeld });
})(typeof window !== 'undefined' ? window : globalThis);
