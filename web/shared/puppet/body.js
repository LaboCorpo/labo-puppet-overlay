/*
 * Body parts: torso and outfits, patterns, hands and held items, neckwear.
 */
(function (global) {
  'use strict';
  const P = (global.Puppet = global.Puppet || {});
  const { OUTLINE, rr, stroke, shade, star } = P.gfx;

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

  P.parts = Object.assign(P.parts || {}, { drawBody, drawLeftHand, drawNeckwear });
})(typeof window !== 'undefined' ? window : globalThis);
