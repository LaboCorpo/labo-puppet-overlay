/*
 * Overlay effects: puppet entrances/exits (walk, drop, pop, portal, beam, feathers, smoke, poof)
 * and particles (confetti, feathers, sparkles). Particle counts are capped; Eco mode spawns fewer.
 */
(function (global) {
  'use strict';

  const ENTRANCES = ['walk', 'drop', 'pop', 'portal', 'beam', 'feathers', 'smoke'];
  const EXITS = ['poof', 'portal', 'beam', 'feathers'];
  const EXIT_DURATION = { poof: 0.7, portal: 1.15, beam: 1.0, feathers: 0.35, none: 0 };
  const MAX_PARTICLES = 600;
  const FEATHER_COLORS = ['#ffffff', '#f6f1e7', '#ffe9a8', '#ffd1e3'];
  const CONFETTI_COLORS = ['#ff7a45', '#f5c518', '#43b581', '#5865f2', '#ff6fa8', '#00cec9', '#ffffff'];
  const ease = (p) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /** scene: { ctx, W, H, settings, perfMode() } */
  function OverlayFx(scene) {
    const P = global.Puppet;
    const particles = [];
    const eco = () => scene.perfMode() === 'eco';
    const room = () => (eco() ? MAX_PARTICLES / 2 : MAX_PARTICLES) - particles.length;

    function pickEntrance(mode) {
      if (ENTRANCES.includes(mode)) return mode;
      if (mode === 'none') return 'done';
      return rand(ENTRANCES);
    }
    function startExit(e) {
      const mode = scene.settings.overlay.exit || 'random';
      e.exit = mode === 'none' ? 'none' : EXITS.includes(mode) ? mode : rand(EXITS);
      e.leaving = 0;
      if (e.exit === 'feathers') featherBurst(e.x, e.y - 110 * e.s, e.s, 14);
    }
    const exitDone = (e) => e.leaving > EXIT_DURATION[e.exit];

    // Per-frame render modifiers on the entity (e.fx): offset, squash, alpha, clip, hidden, rock.
    function enterFx(e, dt) {
      const f = e.fx || (e.fx = {});
      f.dy = 0; f.sx = 1; f.sy = 1; f.alpha = 1; f.clipBelow = null; f.hidden = false; f.rock = 0;
      const a = e.age;
      switch (e.enter) {
        case 'pop': { const p = Math.min(1, a / 0.45); e.scaleMul = p < 1 ? 1.15 * Math.sin(p * Math.PI * 0.62) / Math.sin(Math.PI * 0.62) : 1; break; }
        case 'portal':
          if (a < 0.35) f.hidden = true;
          else if (a < 0.95) { f.dy = (1 - ease((a - 0.35) / 0.6)) * 230 * e.s; f.clipBelow = e.y + 2; }
          if (a > 1.3) e.enter = 'done';
          break;
        case 'beam':
          if (a < 0.3) f.hidden = true;
          else if (a < 0.85) {
            const p = (a - 0.3) / 0.55;
            f.alpha = p * (0.6 + 0.4 * Math.abs(Math.sin(a * 40))); f.sx = 0.25 + 0.75 * ease(p); f.sy = 1.4 - 0.4 * ease(p);
            if (Math.random() < 0.6) sparkle(e.x + (Math.random() - 0.5) * 60 * e.s, e.y - Math.random() * 200 * e.s, e.s);
          }
          if (a > 1.15) e.enter = 'done';
          break;
        case 'feathers': {
          const D = 1.7, p = Math.min(1, a / D);
          f.dy = -(1 - ease(p)) * 420 * e.s; f.rock = Math.sin(a * 4) * 0.25 * (1 - p);
          if (p < 1 && Math.random() < dt * 5) featherBurst(e.x + (Math.random() - 0.5) * 90 * e.s, e.y + f.dy - 120 * e.s, e.s, 1);
          if (a > D) e.enter = 'done';
          break;
        }
        case 'smoke':
          if (a < 0.22) f.hidden = true;
          else if (a < 0.5) e.scaleMul = ease((a - 0.22) / 0.28);
          else e.scaleMul = 1;
          if (a > 0.8) e.enter = 'done';
          break;
        default:
      }
    }
    function exitFx(e) {
      const f = e.fx, l = e.leaving;
      switch (e.exit) {
        case 'poof': e.scaleMul = Math.max(0, 1 - l / 0.22); break;
        case 'portal':
          if (l > 0.3) { f.dy = ease((l - 0.3) / 0.55) * 230 * e.s; f.clipBelow = e.y + 2; if (l > 0.85) f.hidden = true; }
          break;
        case 'beam':
          if (l > 0.25) {
            const p = Math.min(1, (l - 0.25) / 0.45);
            f.sx = 1 - 0.92 * ease(p); f.sy = 1 + 0.6 * ease(p); f.alpha = 1 - p;
            if (Math.random() < 0.7) sparkle(e.x + (Math.random() - 0.5) * 50 * e.s, e.y - Math.random() * 220 * e.s, e.s);
            if (p >= 1) f.hidden = true;
          }
          break;
        case 'feathers': e.scaleMul = Math.max(0, 1 - l / 0.12); break;
        default: f.hidden = true;
      }
    }

    // Effects drawn behind (portal back half, beam) and in front (portal rim, smoke) of the puppet.
    function drawBack(e, t) {
      const a = e.age, l = e.leaving;
      if (e.enter === 'portal' && a < 1.3) drawPortal(e.x, e.y, e.s, portalK(a, 0.35, 0.95, 1.3), t, true);
      if (e.exit === 'portal' && l >= 0) drawPortal(e.x, e.y, e.s, portalK(l, 0.3, 0.85, 1.15), t, true);
      if (e.enter === 'beam' && a < 1.15) drawBeam(e.x, e.y, e.s, a < 0.3 ? ease(a / 0.3) : 1 - ease((a - 0.85) / 0.3));
      if (e.exit === 'beam' && l >= 0) drawBeam(e.x, e.y, e.s, l < 0.25 ? ease(l / 0.25) : 1 - ease((l - 0.7) / 0.3));
    }
    function drawFront(e, t) {
      const ctx = scene.ctx, a = e.age, l = e.leaving;
      if (e.enter === 'portal' && a < 1.3) drawPortal(e.x, e.y, e.s, portalK(a, 0.35, 0.95, 1.3), t, false);
      if (e.exit === 'portal' && l >= 0) drawPortal(e.x, e.y, e.s, portalK(l, 0.3, 0.85, 1.15), t, false);
      if (e.enter === 'smoke' && a < 0.8) P.drawPoof(ctx, e.x, e.y - 110 * e.s, e.s * 1.3, Math.min(1, a / 0.8));
      if ((e.exit === 'poof' || e.exit === 'feathers') && l >= 0) {
        const small = e.exit === 'feathers';
        P.drawPoof(ctx, e.x, e.y - 120 * e.s, e.s * (small ? 0.7 : 1), Math.min(1, l / (small ? 0.35 : 0.7)));
      }
    }
    // Portal size over time: opens, stays, closes.
    function portalK(time, open, hold, close) { return time < open ? ease(time / open) : time < hold ? 1 : 1 - ease((time - hold) / (close - hold)); }
    function drawPortal(x, y, s, k, t, back) {
      if (k <= 0.01) return;
      const ctx = scene.ctx;
      const rx = 72 * s * k, ry = 18 * s * k;
      ctx.save();
      if (back) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
        g.addColorStop(0, '#120a24'); g.addColorStop(0.6, '#2a1050'); g.addColorStop(1, 'rgba(155,92,255,0.0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx * 1.25, ry * 1.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#140b26'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        // swirl
        ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = ['#9b5cff', '#3fd0ff', '#ff6fd8'][i];
          ctx.beginPath(); ctx.ellipse(x, y, rx * (0.35 + i * 0.22), ry * (0.35 + i * 0.22), 0, t * (3 + i) + i, t * (3 + i) + i + Math.PI * 1.2); ctx.stroke();
        }
      } else {
        // front rim drawn over the puppet's feet so it looks like they pass through
        ctx.shadowColor = '#b48cff'; ctx.shadowBlur = 16 * s;
        ctx.lineWidth = 5 * s; ctx.strokeStyle = '#c9a6ff';
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI); ctx.stroke();
      }
      ctx.restore();
    }
    function drawBeam(x, y, s, k) {
      if (k <= 0.01) return;
      const ctx = scene.ctx;
      const w = 80 * s * k;
      ctx.save();
      const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      g.addColorStop(0, 'rgba(120,220,255,0)'); g.addColorStop(0.5, `rgba(200,245,255,${0.55 * k})`); g.addColorStop(1, 'rgba(120,220,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - w / 2, 0, w, y + 4);
      ctx.fillStyle = `rgba(255,255,255,${0.6 * k})`; ctx.fillRect(x - w * 0.07, 0, w * 0.14, y + 4);
      ctx.fillStyle = `rgba(160,235,255,${0.5 * k})`; ctx.beginPath(); ctx.ellipse(x, y, w * 0.8, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // ---------- Particles ----------
    function sparkle(x, y, s) {
      if ((eco() && Math.random() < 0.6) || room() <= 0) return;
      particles.push({ kind: 'sparkle', x, y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 40, life: 0.5 + Math.random() * 0.4, size: (3 + Math.random() * 4) * Math.max(0.6, s) });
    }
    function featherBurst(x, y, s, n) {
      n = Math.min(eco() ? Math.ceil(n * 0.5) : n, room());
      for (let i = 0; i < n; i++) {
        particles.push({ kind: 'feather', x: x + (Math.random() - 0.5) * 40 * s, y: y + (Math.random() - 0.5) * 40 * s, vx: (Math.random() - 0.5) * 220, vy: -120 - Math.random() * 180, rot: Math.random() * 6, ph: Math.random() * 6, life: 2.2 + Math.random() * 1.2, size: (10 + Math.random() * 6) * Math.max(0.6, s), c: FEATHER_COLORS[i % FEATHER_COLORS.length] });
      }
    }
    // Confetti over a Twitch viewer; positioned on the next frame, once the viewer has a place on screen.
    function confetti(v, n) {
      n = Math.min(eco() ? Math.ceil(n * 0.4) : n, room());
      for (let i = 0; i < n; i++) {
        particles.push({ kind: 'confetti', follow: v, x: 0, y: 0, vx: (Math.random() - 0.5) * 520, vy: -250 - Math.random() * 520, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, c: CONFETTI_COLORS[i % CONFETTI_COLORS.length], life: 2 + Math.random() * 1.2, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4 });
      }
    }

    // Confetti falls fast, feathers drift and sway, sparkles twinkle and fade.
    function drawParticles(dt, t) {
      const ctx = scene.ctx;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.follow) {
          const v = p.follow, s = (scene.settings.twitch && scene.settings.twitch.scale) || 0.5;
          p.x = v.x == null ? scene.W / 2 : v.x; p.y = (v.y == null ? scene.H : v.y) - 170 * s; p.follow = null;
        }
        p.life -= dt;
        if (p.kind === 'feather') {
          p.vy = Math.min(p.vy + 260 * dt, 55); p.vx *= Math.pow(0.15, dt);
          p.x += (p.vx + Math.sin(t * 2.4 + p.ph) * 38) * dt; p.y += p.vy * dt; p.rot = Math.sin(t * 2.4 + p.ph) * 0.9;
        } else if (p.kind === 'sparkle') {
          p.x += p.vx * dt; p.y += p.vy * dt;
        } else {
          p.vy += 900 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        }
        if (p.life <= 0 || p.y > scene.H + 40) { particles.splice(i, 1); continue; }
        ctx.save(); ctx.globalAlpha = Math.min(1, p.life * 2); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
        if (p.kind === 'feather') {
          const L = p.size;
          ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, L * 0.32, L, 0, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = 1.5; ctx.strokeStyle = '#1d1a1f'; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(0, L * 1.25); ctx.stroke();
        } else if (p.kind === 'sparkle') {
          const r = p.size * (0.6 + 0.4 * Math.abs(Math.sin(p.life * 18)));
          ctx.fillStyle = '#ffffff'; ctx.beginPath();
          for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4, rad = k % 2 ? r * 0.3 : r; ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad); }
          ctx.closePath(); ctx.shadowColor = '#7fe0ff'; ctx.shadowBlur = 8; ctx.fill();
        } else { ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
        ctx.restore();
      }
    }

    return { particles, pickEntrance, startExit, exitDone, enterFx, exitFx, drawBack, drawFront, confetti, drawParticles };
  }

  global.OverlayFx = OverlayFx;
})(window);
