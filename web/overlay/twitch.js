/*
 * Twitch viewer crowd: one deterministic puppet per chatter (customised by chat commands),
 * chat bubbles, actions, and sub/bits/raid celebrations.
 */
(function (global) {
  'use strict';

  const STYLE_KEYS = ['hat', 'hair', 'outfit', 'eyes', 'glasses', 'held', 'neckwear', 'pattern', 'clothColor', 'hatColor'];

  /** scene: { ctx, W, H, settings }; fx: OverlayFx */
  function TwitchCrowd(scene, fx) {
    const P = global.Puppet;
    const viewers = new Map(); // login -> viewer on screen
    let overrides = {};        // login -> customisation from chat commands
    const cfg = () => scene.settings.twitch || {};
    const nowSec = () => performance.now() / 1000;

    const look = (c) => ({ palette: c.palette, hats: c.hats, beards: c.beards, colors: c.colors });
    function styleKey(c) { c = c || {}; return [c.palette, c.hats, c.beards, (c.colors || []).join()].join('|'); }
    function viewerAvatar(login) {
      const ov = overrides[login] || {};
      const a = P.randomAvatar(ov.seed || login, look(cfg()));
      for (const k of STYLE_KEYS) if (ov[k]) a[k] = ov[k];
      return a;
    }
    function restyle(login) { const v = viewers.get(login); if (v && !v.temp) v.avatar = viewerAvatar(login); }
    function restyleAll() { for (const v of viewers.values()) if (!v.temp) v.avatar = viewerAvatar(v.login); }
    function setOverrides(map) { overrides = map || {}; restyleAll(); }
    function setOverride(login, ov) { if (ov) overrides[login] = ov; else delete overrides[login]; restyle(login); }

    function ensureViewer(login, display, color) {
      let v = viewers.get(login);
      if (!v || v.leaving >= 0) {
        if (v) viewers.delete(login);
        v = { login, display, color, avatar: viewerAvatar(login), anim: new P.Animator('t:' + login), x: null, y: null, joined: performance.now(), leaving: -1 };
        viewers.set(login, v);
        // Over the limit: the least recently active viewer leaves.
        let count = 0, oldest = null;
        for (const x of viewers.values()) {
          if (x.temp || x.leaving >= 0) continue;
          count++;
          if (x !== v && (!oldest || (x.lastMsg || 0) < (oldest.lastMsg || 0))) oldest = x;
        }
        if (count > (cfg().maxViewers || 20) && oldest) oldest.leaving = 0;
      }
      v.display = display || v.display; v.color = color || v.color;
      v.lastMsg = nowSec();
      return v;
    }

    // Keeps a viewer's mouth moving for as long as its chat sound plays.
    function talkFor(login, sec) { const v = viewers.get(login); if (v) v.anim.talkUntil = sec > 0 ? nowSec() + sec : 0; }

    function onChat(m, soundSynced) {
      const v = ensureViewer(m.login, m.display, m.color);
      if (!m.text) return;
      v.msg = String(m.text).slice(0, 220);
      v.system = !!m.system;
      v.msgUntil = v.lastMsg + (cfg().bubbleSeconds || 7);
      v.anim.jump(10);
      if (!soundSynced) v.anim.talkUntil = v.lastMsg + Math.min(3.5, 0.6 + v.msg.length * 0.05);
    }

    function onEvent(e) {
      const c = cfg();
      if (e.type === 'action') {
        const v = ensureViewer(e.login, e.display, e.color);
        if (e.action === 'jump') v.anim.jump(46);
        if (e.action === 'dance') v.anim.dance(3.5);
        if (e.action === 'wave') v.anim.wave(2.5);
      } else if (e.type === 'restyle') {
        const v = ensureViewer(e.login, e.display, e.color);
        v.avatar = viewerAvatar(e.login); v.pop = 0; v.anim.jump(20);
      } else if (e.type === 'sub' && c.subEffects !== false) {
        const v = ensureViewer(e.login, e.display, e.color);
        v.anim.jump(40); v.anim.wave(2.5);
        if (e.text) { v.msg = String(e.text).slice(0, 220); v.system = true; v.msgUntil = v.lastMsg + Math.max(6, c.bubbleSeconds || 7); }
        fx.confetti(v, 70);
      } else if (e.type === 'bits' && c.bitsEffects !== false) {
        const v = ensureViewer(e.login, e.display, e.color);
        v.anim.jump(30); v.anim.dance(2); fx.confetti(v, Math.min(120, 20 + (e.amount || 0) / 5));
      } else if (e.type === 'raid' && c.raidEffects !== false) {
        const leader = ensureViewer(e.login, e.display, e.color);
        leader.msg = `RAID! ×${e.count}`; leader.system = true; leader.msgUntil = leader.lastMsg + 8; leader.anim.wave(4);
        const n = Math.min(c.raidMax || 15, e.count || 1);
        const now = nowSec();
        for (let i = 0; i < n; i++) {
          const login = `raid:${e.login}:${i}:${Math.floor(now)}`;
          viewers.set(login, { login, display: '', temp: true, expires: now + 40 + Math.random() * 10, avatar: P.randomAvatar(login, look(c)), anim: new P.Animator(login), x: null, y: null, joined: performance.now() + i * 120, leaving: -1, delay: i * 0.12, lastMsg: now });
        }
        setTimeout(() => fx.confetti(leader, 90), 300);
      }
    }

    function layout() {
      const c = cfg(), W = scene.W, H = scene.H;
      const s = c.scale || 0.5;
      const anchor = c.anchor || 'bottom-right';
      const fromRight = anchor !== 'bottom-left';
      if (c.layout === 'vertical') {
        // Columns along the side edge, filled bottom-up; bubbles open sideways toward the screen.
        const vgap = 210 * s, colGap = 230 * s, areaH = H * (c.widthRatio || 0.55);
        let colX, baseY;
        if (anchor === 'custom' && c.pos) { colX = c.pos.x * W; baseY = c.pos.y * H; }
        else { colX = fromRight ? W - 20 - 60 * s : 20 + 60 * s; baseY = H - 20 - 20 * s; }
        const perCol = Math.max(1, Math.floor(areaH / vgap));
        const slot = (i) => { const col = Math.floor(i / perCol), r = i % perCol; return { x: colX + (fromRight ? -1 : 1) * col * colGap, y: baseY - r * vgap, col }; };
        const rect = { x: fromRight ? colX - colGap * 1.4 : colX - 70 * s, y: baseY - areaH - 60 * s, w: colGap * 1.4 + 70 * s, h: areaH + 80 * s };
        return { s, vertical: true, fromRight, slot, rect, baseY };
      }
      const gap = 95 * s / 0.5;
      const areaW = W * (c.widthRatio || 0.55);
      let left, baseY;
      if (anchor === 'custom' && c.pos) { left = c.pos.x * W - areaW / 2; baseY = c.pos.y * H; }
      else { left = fromRight ? W - 20 - areaW : 20; baseY = H - 20 - 20 * s; }
      const perRow = Math.max(1, Math.floor(areaW / gap));
      const slot = (i) => {
        const row = Math.floor(i / perRow), col = i % perRow;
        const off = col * gap + (row % 2) * gap / 2 + 50 * s;
        return { x: fromRight ? left + areaW - off : left + off, y: baseY - row * 120 * s, col };
      };
      return { s, vertical: false, fromRight, slot, rect: { x: left, y: baseY - 210 * s, w: areaW, h: 250 * s }, baseY };
    }

    let L = null; // layout of the current frame, shared by update() and draw()
    function update(dt, t) {
      const c = cfg();
      const now = nowSec();
      const idle = (c.idleMinutes || 10) * 60;
      L = layout();
      const list = [...viewers.values()].filter((v) => v.leaving < 0).sort((a, b) => a.joined - b.joined);
      list.forEach((v, i) => {
        if ((v.temp && now > v.expires) || (!v.temp && now - v.lastMsg > idle)) { v.leaving = 0; return; }
        const sl = L.slot(i);
        v.tx = sl.x; v.ty = sl.y; v.col = sl.col;
        if (v.x == null) { v.x = L.fromRight ? scene.W + 80 : -80; v.y = v.ty; }
      });
      for (const v of viewers.values()) {
        if (v.delay > 0) { v.delay -= dt; continue; }
        const a = v.anim;
        a.talking = now < (a.talkUntil || 0);
        a.update(dt, t);
        if (v.x != null && L) { const ht = scene.hoverTarget ? scene.hoverTarget(v.x, v.y, L.s) : 1; v.hoverA = v.hoverA == null ? 1 : v.hoverA + (ht - v.hoverA) * Math.min(1, dt * 12); }
        if (v.tx != null) {
          const dx = v.tx - v.x;
          v.walking = Math.abs(dx) > 4;
          v.x += Math.sign(dx) * Math.min(Math.abs(dx), (v.temp ? 700 : 450) * dt);
          v.y += (v.ty - v.y) * Math.min(1, dt * 6);
        }
        if (v.pop != null) { v.pop += dt; if (v.pop > 0.5) v.pop = null; }
        if (v.leaving >= 0) { v.leaving += dt; if (v.leaving > 0.7) viewers.delete(v.login); }
      }
    }

    function draw(t) {
      const ctx = scene.ctx, c = cfg(), W = scene.W;
      if (!L) L = layout();
      const now = nowSec();
      const list = [...viewers.values()].filter((v) => v.x != null && !(v.delay > 0)).sort((a, b) => a.ty - b.ty);
      for (const v of list) {
        const st = v.anim.state(t);
        if (v.walking) st.bob -= Math.abs(Math.sin(t * 14 + v.x * 0.01)) * 7;
        st.scaleMul = v.leaving >= 0 ? Math.max(0, 1 - v.leaving / 0.22) : (v.pop != null ? 1 + Math.sin(v.pop / 0.5 * Math.PI) * 0.18 : 1);
        if (v.hoverA != null && v.hoverA < 1) st.alpha = v.hoverA;
        P.draw(ctx, v.avatar, st, {
          x: v.x, y: v.y, scale: L.s,
          flip: v.walking ? v.tx > v.x : (L.vertical ? !L.fromRight : v.x < W / 2),
          name: c.showNames !== false && v.display && v.leaving < 0 ? v.display : null,
          labelColor: c.useChatColor ? v.color : null,
        });
        if (v.leaving >= 0) P.drawPoof(ctx, v.x, v.y - 120 * L.s, L.s, Math.min(1, v.leaving / 0.7));
        if (v.msg && now < v.msgUntil && v.leaving < 0) {
          const alpha = Math.min(1, (v.msgUntil - now) / 0.5);
          const headTop = v.y + st.bob * L.s + P.headTopLocal(v.avatar) * L.s - (L.vertical ? 0 : (v.col % 2) * 46 * L.s);
          P.drawBubble(ctx, v.msg, v.x, headTop, Math.max(0.75, L.s * 1.4), {
            alpha: alpha * (v.hoverA == null ? 1 : v.hoverA), bg: v.system ? '#2b2633' : c.bubbleBg, fg: v.system ? '#ffd166' : c.bubbleFg, viewW: W, maxLines: v.system ? 4 : 3,
            side: L.vertical ? (L.fromRight ? 'left' : 'right') : null, sideGap: 70 * L.s,
          });
        }
      }
    }

    return { viewers, styleKey, restyleAll, setOverrides, setOverride, talkFor, onChat, onEvent, layout, update, draw, get size() { return viewers.size; } };
  }

  global.TwitchCrowd = TwitchCrowd;
})(window);
