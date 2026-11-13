/*
 * Hair, hats and facial hair.
 */
(function (global) {
  'use strict';
  const P = (global.Puppet = global.Puppet || {});
  const { OUTLINE, HEAD, rr, stroke, shade, star, headTopOffset } = P.gfx;

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


  P.parts = Object.assign(P.parts || {}, { drawHair, drawHat, drawBeard, drawMustache });
})(typeof window !== 'undefined' ? window : globalThis);
