/*
 * Placement mode (desktop overlay only): drag a group to move it, mouse wheel to resize, Esc or Done to finish.
 * Positions are saved as ratios of the screen, so they also fit any OBS canvas size.
 */
(function (global) {
  'use strict';

  /** scene: { canvas, ctx, W, H, settings, placement, t, saveSettings(patch), finishPlacement() } */
  function Placement(scene, discord, twitch, scope) {
    const groups = { discord: null, twitch: null };
    let drag = null, doneBtn = null, wheelTimer = null;
    const inside = (r, x, y) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    const hit = (x, y) => (inside(groups.discord, x, y) ? 'discord' : inside(groups.twitch, x, y) ? 'twitch' : null);
    const cfgFor = (key) => (key === 'discord' ? scene.settings.overlay : scene.settings.twitch);

    function measure() {
      groups.discord = scope !== 'twitch' ? discord.bounds() : null;
      const tw = scene.settings.twitch;
      groups.twitch = scope !== 'discord' && tw && (tw.enabled || tw.showOnDesktop) ? twitch.layout().rect : null;
    }

    function draw() {
      const ctx = scene.ctx, W = scene.W, t = scene.t;
      measure();
      ctx.save();
      ctx.fillStyle = 'rgba(12,10,16,0.45)'; ctx.fillRect(0, 0, W, scene.H);
      for (const [k, r] of Object.entries(groups)) {
        if (!r) continue;
        ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.strokeStyle = drag && drag.key === k ? '#ffffff' : '#ff7a45';
        ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
        ctx.font = '700 14px "Segoe UI", sans-serif'; ctx.fillStyle = '#ff7a45'; ctx.fillText(t(k === 'discord' ? 'Discord voice' : 'Twitch viewers'), r.x + 6, r.y - 8);
      }
      const msg = t('Drag a group to move it  ·  Mouse wheel to resize  ·  Esc or click Done to finish');
      ctx.font = '600 16px "Segoe UI", sans-serif';
      const w = ctx.measureText(msg).width + 150;
      ctx.fillStyle = '#211e28'; ctx.fillRect(W / 2 - w / 2, 24, w, 48); ctx.strokeStyle = '#3a3545'; ctx.lineWidth = 1; ctx.strokeRect(W / 2 - w / 2, 24, w, 48);
      ctx.fillStyle = '#f2eef7'; ctx.textBaseline = 'middle'; ctx.fillText(msg, W / 2 - w / 2 + 16, 48);
      doneBtn = { x: W / 2 + w / 2 - 100, y: 32, w: 84, h: 32 };
      ctx.fillStyle = '#ff7a45'; ctx.fillRect(doneBtn.x, doneBtn.y, doneBtn.w, doneBtn.h);
      ctx.fillStyle = '#1b1015'; ctx.textAlign = 'center'; ctx.fillText(t('Done'), doneBtn.x + doneBtn.w / 2, doneBtn.y + 17);
      ctx.restore();
    }

    scene.canvas.addEventListener('mousedown', (e) => {
      if (!scene.placement) return;
      if (inside(doneBtn, e.clientX, e.clientY)) { scene.finishPlacement(); return; }
      const key = hit(e.clientX, e.clientY);
      if (!key) return;
      const cfg = cfgFor(key);
      const r = groups[key];
      // Switch to a custom anchor at the group's current centre/baseline so the drag starts from where it is.
      // Measured before switching the anchor, since the layout depends on it.
      if (cfg.anchor !== 'custom') {
        let pos;
        if (key === 'discord') pos = { x: (r.x + r.w / 2) / scene.W, y: r.baseY / scene.H };
        else {
          const L = twitch.layout();
          const x = L.vertical ? (L.fromRight ? r.x + r.w - 70 * L.s : r.x + 70 * L.s) : r.x + r.w / 2;
          pos = { x: x / scene.W, y: L.baseY / scene.H };
        }
        cfg.anchor = 'custom';
        cfg.pos = pos;
      }
      drag = { key, sx: e.clientX, sy: e.clientY, px: cfg.pos.x, py: cfg.pos.y };
      scene.wake();
    });
    global.addEventListener('mousemove', (e) => {
      if (!drag) return;
      cfgFor(drag.key).pos = {
        x: Math.max(0.02, Math.min(0.98, drag.px + (e.clientX - drag.sx) / scene.W)),
        y: Math.max(0.1, Math.min(1, drag.py + (e.clientY - drag.sy) / scene.H)),
      };
      scene.wake();
    });
    global.addEventListener('mouseup', () => {
      if (!drag) return;
      const k = drag.key === 'discord' ? 'overlay' : 'twitch';
      scene.saveSettings({ [k]: { anchor: 'custom', pos: scene.settings[k].pos } });
      drag = null;
    });
    scene.canvas.addEventListener('wheel', (e) => {
      if (!scene.placement) return;
      const g = hit(e.clientX, e.clientY);
      if (!g) return;
      const key = g === 'discord' ? 'overlay' : 'twitch';
      const cfg = scene.settings[key];
      const [min, max] = key === 'overlay' ? [0.3, 1.6] : [0.25, 1];
      cfg.scale = Math.round(Math.max(min, Math.min(max, (cfg.scale || 0.8) * (e.deltaY < 0 ? 1.06 : 0.94))) * 100) / 100;
      clearTimeout(wheelTimer); wheelTimer = setTimeout(() => scene.saveSettings({ [key]: { scale: cfg.scale } }), 250);
      scene.wake();
    }, { passive: true });
    global.addEventListener('keydown', (e) => { if (scene.placement && e.key === 'Escape') scene.finishPlacement(); });

    return { draw };
  }

  global.Placement = Placement;
})(window);
