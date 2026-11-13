/*
 * Discord voice puppets: layout (row or column, corner or custom position), per-member settings,
 * "look at the speaker", entrance/exit effects. Fake members fill the panel preview and placement mode.
 */
(function (global) {
  'use strict';

  const DEFAULT_LOOK = { kind: 'discord', photoSplit: 0.6, clothColor: '#5865f2', accentColor: '#ffffff' };

  function discordAvatarUrl(m) {
    if (m.avatarHash) return `https://cdn.discordapp.com/avatars/${m.id}/${m.avatarHash}.png?size=128`;
    let idx = 0;
    try { idx = Number((BigInt(m.id) >> 22n) % 6n); } catch (e) { /* fake member id */ }
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }

  /** scene: { ctx, W, H, settings, placement, useFake() }; fx: OverlayFx */
  function DiscordGroup(scene, fx) {
    const P = global.Puppet;
    const ents = new Map(); // puppets on screen, by member id
    let members = [];       // live Discord members
    let avatars = {};       // discordId -> avatar
    let fakeMembers = null;
    let fakeTimer = null;
    const defaultLook = Object.assign(P.defaultAvatar(), DEFAULT_LOOK);

    function setMembers(list) { members = list || []; }
    function setAvatars(map) { avatars = map || {}; }
    function setSpeaking(id, speaking) { const m = members.find((x) => x.id === id); if (m) m.speaking = speaking; }

    // Created on first use only: OBS sources never need them.
    function fakes() {
      if (!fakeMembers) {
        fakeMembers = [
          { id: 'f1', name: 'Timo', demoAvatar: Object.assign(P.randomAvatar('Timo'), { hat: 'headphones' }) },
          { id: 'f2', name: 'Lea', mute: true, demoAvatar: P.randomAvatar('Lea') },
          { id: 'f3', name: 'Max', demoAvatar: P.randomAvatar('Max') },
          { id: 'f4', name: 'Sam', deaf: true, mute: true, demoAvatar: P.randomAvatar('Sammy') },
        ];
      }
      if (!fakeTimer) fakeTimer = setInterval(() => { for (const m of fakeMembers) m.speaking = !m.mute && Math.random() < 0.35; }, 1300);
      return fakeMembers;
    }
    function stopFakes() { clearInterval(fakeTimer); fakeTimer = null; }

    // Group origin: a corner anchor or a custom position (ratios of the screen) set in placement mode.
    // Slots are as wide as each puppet's own scale, so a bigger puppet pushes its neighbours away.
    function layout(scales) {
      const cfg = scene.settings.overlay, W = scene.W, H = scene.H;
      const s = cfg.scale || 0.8, margin = cfg.margin ?? 30, spacing = cfg.spacing || 120;
      const vertical = cfg.layout === 'vertical';
      // Horizontal: gap between feet; vertical: gap between baselines (puppets overlap a little, like a stack).
      const gap = vertical ? 235 * s * spacing / 120 : spacing * s / 0.8;
      const offs = []; let cur = 0;
      scales.forEach((sc, i) => { if (i > 0) cur += gap * (scales[i - 1] + sc) / 2; offs.push(cur); });
      const total = cur;
      const first = scales[0] || 1, lastS = scales[scales.length - 1] || 1, maxS = Math.max(1, ...scales);
      const anchor = cfg.anchor || 'bottom-left';
      if (vertical) {
        // Column: first puppet at the anchored end (bottom for bottom anchors, top for top anchors).
        let x, yStart, dir;
        if (anchor === 'custom' && cfg.pos) { x = cfg.pos.x * W; yStart = cfg.pos.y * H; dir = -1; }
        else {
          x = anchor.endsWith('left') ? margin + 70 * s * maxS : anchor.endsWith('right') ? W - margin - 70 * s * maxS : W / 2;
          if (anchor.startsWith('top')) { yStart = margin + 230 * s * first; dir = 1; } else { yStart = H - margin - 30 * s; dir = -1; }
        }
        return { xs: offs.map(() => x), ys: offs.map((o) => yStart + dir * o), s };
      }
      let x0, y;
      if (anchor === 'custom' && cfg.pos) { x0 = cfg.pos.x * W - total / 2; y = cfg.pos.y * H; }
      else {
        if (anchor.endsWith('left')) x0 = margin + 60 * s * first;
        else if (anchor.endsWith('right')) x0 = W - margin - 60 * s * lastS - total;
        else x0 = W / 2 - total / 2;
        y = anchor.startsWith('top') ? margin + 230 * s * maxS : H - margin - 30 * s;
      }
      return { xs: offs.map((o) => x0 + o), ys: offs.map(() => y), s };
    }

    // Per-member settings (hide / nickname / size) and manual order from the panel.
    const memberCfg = (id) => (scene.settings.members && scene.settings.members[id]) || {};
    function ordered(list) {
      const order = scene.settings.memberOrder || [];
      const idx = (id) => { const i = order.indexOf(id); return i < 0 ? 1e6 : i; };
      return list.map((m, i) => ({ m, i })).sort((a, b) => idx(a.m.id) - idx(b.m.id) || a.i - b.i).map((x) => x.m);
    }

    function update(dt, t) {
      const cfg = scene.settings.overlay;
      const src = members.length ? members : scene.useFake() ? fakes() : [];
      if (src !== fakeMembers && fakeTimer) stopFakes();
      let list = src.filter((m) => !(cfg.showSelf === false && m.self) && !memberCfg(m.id).hidden);
      if (cfg.hideIdle && !scene.placement) list = list.filter((m) => m.speaking || (ents.get(m.id) && ents.get(m.id).anim.hangover > 0));
      list = ordered(list).slice(0, cfg.maxVisible || 12);
      const scales = list.map((m) => Math.min(1.8, Math.max(0.5, Number(memberCfg(m.id).scale) || 1)));
      const L = layout(scales);
      const ids = new Set();

      list.forEach((m, i) => {
        ids.add(m.id);
        let e = ents.get(m.id);
        const tx = L.xs[i];
        if (!e) {
          e = { id: m.id, anim: new P.Animator(m.id), x: tx, y: L.ys[i], vy: 0, enter: fx.pickEntrance(cfg.entrance), age: 0, leaving: -1 };
          if (e.enter === 'walk') e.x = tx < scene.W / 2 ? -120 : scene.W + 120;
          if (e.enter === 'drop') e.y = L.ys[i] - scene.H;
          ents.set(m.id, e);
        }
        e.member = m; e.tx = tx; e.ty = L.ys[i]; e.s = L.s * scales[i];
        if (e.leaving >= 0 && !e.forceLeave) { e.leaving = -1; e.scaleMul = 1; e.exit = null; }
      });
      for (const e of ents.values()) if (!ids.has(e.id) && e.leaving < 0) fx.startExit(e);

      // "Look at the speaker": each puppet turns toward the nearest one talking.
      const lookAt = cfg.lookAtSpeaker !== false;
      for (const e of ents.values()) {
        const a = e.anim;
        e.age += dt;
        a.talking = !!e.member.speaking && !e.member.mute && e.leaving < 0;
        a.sleepAfter = (cfg.sleepMinutes || 0) * 60;
        let best = null;
        if (lookAt && !a.talking) {
          for (const sp of ents.values()) {
            if (sp === e || sp.leaving >= 0 || !sp.member.speaking || sp.member.mute) continue;
            if (!best || Math.abs(sp.x - e.x) < Math.abs(best.x - e.x)) best = sp;
          }
        }
        a.lookTarget = best ? Math.max(-1, Math.min(1, (best.x - e.x) / 120)) : 0;
        a.update(dt, t);
        // movement: walk/slide to target, drop with a bounce
        if ((e.enter === 'drop' && e.y < e.ty - 0.5) || Math.abs(e.vy) > 30) {
          e.vy += 2600 * dt; e.y += e.vy * dt;
          if (e.y >= e.ty) { e.y = e.ty; e.vy = -e.vy * 0.35; if (Math.abs(e.vy) < 120) { e.vy = 0; e.enter = 'done'; } }
        } else e.y += (e.ty - e.y) * Math.min(1, dt * 8);
        const dx = e.tx - e.x;
        e.walking = Math.abs(dx) > 4 && e.leaving < 0;
        if (e.leaving < 0) e.x += Math.sign(dx) * Math.min(Math.abs(dx), (e.enter === 'walk' ? 520 : 900) * dt * (Math.abs(dx) > 40 ? 1 : 0.5));
        fx.enterFx(e, dt);
        if (e.leaving >= 0) {
          e.leaving += dt;
          fx.exitFx(e);
          if (fx.exitDone(e)) ents.delete(e.id);
        }
      }
    }

    const SHOW_NAME_DURING = ['done', 'walk', 'drop', 'pop'];
    function draw(t) {
      const ctx = scene.ctx, cfg = scene.settings.overlay;
      const list = [...ents.values()].sort((a, b) => a.ty - b.ty || a.x - b.x);
      for (const e of list) {
        const m = e.member;
        const f = e.fx;
        fx.drawBack(e, t);
        if (!f.hidden) {
          const st = e.anim.state(t);
          if (e.walking) st.bob -= Math.abs(Math.sin(t * 13 + e.x * 0.01)) * 9;
          st.scaleMul = e.scaleMul == null ? 1 : e.scaleMul;
          st.sx = f.sx; st.sy = f.sy; st.alpha = f.alpha; st.rock = (st.rock || 0) + f.rock;
          const showName = cfg.showNames !== false && e.leaving < 0 && SHOW_NAME_DURING.includes(e.enter);
          ctx.save();
          if (f.clipBelow != null) { ctx.beginPath(); ctx.rect(0, 0, scene.W, f.clipBelow); ctx.clip(); }
          P.draw(ctx, avatars[m.id] || m.demoAvatar || defaultLook, st, {
            x: e.x, y: e.y + f.dy, scale: e.s,
            name: showName ? (memberCfg(m.id).alias || m.name) : null,
            muted: m.mute, deaf: m.deaf, glow: cfg.glow && m.speaking && !m.mute, statusStyle: cfg.statusStyle,
            flip: e.walking && e.tx > e.x, // puppets face left by default
            discordAvatarUrl: discordAvatarUrl(m),
          });
          ctx.restore();
        }
        fx.drawFront(e, t);
      }
    }

    // Everyone leaves with the exit effect, then comes back in (panel "Replay entrances").
    function replay() { for (const e of ents.values()) if (e.leaving < 0) { e.forceLeave = true; fx.startExit(e); } }

    // Screen rectangle around the group (placement mode).
    function bounds() {
      const ds = [...ents.values()].filter((e) => e.leaving < 0);
      if (!ds.length) return null;
      const s = Math.max(...ds.map((e) => e.s)); const xs = ds.map((e) => e.tx), ys = ds.map((e) => e.ty);
      return { x: Math.min(...xs) - 75 * s, y: Math.min(...ys) - 270 * s, w: Math.max(...xs) - Math.min(...xs) + 150 * s, h: Math.max(...ys) - Math.min(...ys) + 310 * s, baseY: Math.max(...ys) };
    }

    return { ents, setMembers, setAvatars, setSpeaking, update, draw, replay, bounds, get size() { return ents.size; } };
  }

  global.DiscordGroup = DiscordGroup;
})(window);
