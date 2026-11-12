/*
 * Overlay scene: Discord voice puppets + Twitch viewer crowd.
 * Same page is used by the desktop overlay window and by OBS/Streamlabs (Browser Source).
 * URL params:
 *   scene=all|discord|twitch   which groups to draw
 *   host=desktop               enables placement mode (drag/scroll) in the app's overlay window
 *   test=1                     live settings + fake members/chat when there is nothing real (panel preview)
 *   demo=1                     fully offline demo, no server
 */
(function () {
  'use strict';
  const P = Puppet;
  const t = I18N.t;
  const params = new URLSearchParams(location.search);
  const SCENE = params.get('scene') || 'all';
  const DEMO = params.get('demo') === '1';
  const TEST = params.get('test') === '1';
  const DESKTOP = params.get('host') === 'desktop';
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint');

  let settings = null;
  let members = [];           // live Discord members
  let avatars = {};           // discordId -> avatar
  let overrides = {};         // twitch login -> customisation from chat commands
  let placement = false;
  let meId = null, selfSharing = false;
  const previews = new Map(); // member id -> Image of their screen (only ever our own screen)
  let fakeMembers = null;
  const dEnts = new Map();    // discord puppets on screen
  const viewers = new Map();  // twitch viewers on screen
  const particles = [];
  let W = innerWidth, H = innerHeight;

  // ---------- Canvas sizing ----------
  const perfMode = () => (settings && settings.app && settings.app.performance) || 'normal';
  function resize() {
    W = innerWidth; H = innerHeight;
    // Eco renders at 1x pixel density, Normal caps at 2x, Performance uses the screen's full density.
    const raw = window.devicePixelRatio || 1;
    const dpr = perfMode() === 'eco' ? Math.min(raw, 1) : perfMode() === 'normal' ? Math.min(raw, 2) : raw;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize); resize();

  // ---------- Server link (SSE) ----------
  function applyState(s) {
    if (s.settings && settings && s.settings.app && settings.app && s.settings.app.performance !== settings.app.performance) setTimeout(resize, 0);
    if (s.settings) { const restyle = !settings || styleKey(s.settings.twitch) !== styleKey(settings.twitch); settings = s.settings; if (restyle) restyleAll(); }
    if (s.avatars) avatars = s.avatars;
    if (s.viewers) { overrides = s.viewers; restyleAll(); }
    if (s.discord) { members = s.discord.members || []; meId = s.discord.me ? s.discord.me.id : null; }
    if (s.app) selfSharing = !!s.app.selfSharing;
    if (s.app && s.app.lang) I18N.setLang(s.app.lang);
    placement = DESKTOP && !!(s.app && s.app.placement);
    if (s.settings) configureSound();
    document.body.classList.toggle('placing', placement);
  }
  function connect() {
    const es = new EventSource('/api/events');
    es.addEventListener('state', (e) => applyState(JSON.parse(e.data)));
    es.addEventListener('speaking', (e) => {
      const d = JSON.parse(e.data);
      const m = members.find((x) => x.id === d.id);
      if (m) m.speaking = d.speaking;
    });
    es.addEventListener('chat', (e) => onChat(JSON.parse(e.data)));
    es.addEventListener('twitch-event', (e) => onTwitchEvent(JSON.parse(e.data)));
    es.addEventListener('viewer', (e) => { const d = JSON.parse(e.data); if (d.override) overrides[d.login] = d.override; else delete overrides[d.login]; restyle(d.login); });
    es.addEventListener('voice-effect', (e) => onVoiceEffect(JSON.parse(e.data)));
    es.addEventListener('screen-preview', (e) => {
      const d = JSON.parse(e.data);
      if (!d.img) { previews.delete(d.id); return; }
      const img = new Image(); img.onload = () => previews.set(d.id, img); img.src = d.img;
    });
    es.addEventListener('viewers-reset', () => { overrides = {}; restyleAll(); });
    // Panel "Replay entrances" button: everyone leaves with the exit effect, then comes back in.
    es.addEventListener('fx-test', () => { for (const e of dEnts.values()) if (e.leaving < 0) { e.forceLeave = true; startExit(e); } });
    es.onerror = () => { if (!DESKTOP) return; hint.style.display = 'block'; hint.textContent = t('Puppet Overlay app not reachable — retrying…'); };
    es.onopen = () => { hint.style.display = 'none'; };
  }

  // ---------- Fake data (demo / preview / placement) ----------
  function makeFakeMembers() {
    fakeMembers = [
      { id: 'f1', name: 'Timo', demoAvatar: Object.assign(P.randomAvatar('Timo'), { hat: 'headphones' }) },
      { id: 'f2', name: 'Lea', mute: true, demoAvatar: P.randomAvatar('Lea') },
      { id: 'f3', name: 'Max', streaming: true, demoAvatar: P.randomAvatar('Max') },
      { id: 'f4', name: 'Sam', deaf: true, mute: true, demoAvatar: P.randomAvatar('Sammy') },
    ];
    setInterval(() => { for (const m of fakeMembers) m.speaking = !m.mute && Math.random() < 0.35; }, 1300);
  }
  const FAKE_NAMES = ['pixelcat', 'Bobby_42', 'xXnoobXx', 'MamieGaming', 'kiwi', 'ZeroCool', 'tartiflette'];
  const FAKE_MSGS = ['hi everyone!', 'GG', 'the head flap is killing me 😂', 'first', 'what are we playing tonight?', 'lol', 'more please!!'];
  let lastRealChat = 0;
  function fakeChatLoop() {
    setInterval(() => {
      if (performance.now() - lastRealChat < 15000) return;
      const n = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
      const r = Math.random();
      if (r < 0.15) onTwitchEvent({ type: 'action', action: ['jump', 'dance', 'wave'][Math.floor(Math.random() * 3)], login: n.toLowerCase(), display: n });
      else onChat({ login: n.toLowerCase(), display: n, text: FAKE_MSGS[Math.floor(Math.random() * FAKE_MSGS.length)], fake: true });
    }, 1800);
  }
  function startDemo() {
    settings = {
      overlay: { enabled: true, anchor: 'bottom-left', scale: 0.8, spacing: 120, margin: 30, showNames: true, entrance: 'random', statusStyle: 'props', sleepMinutes: 0.3, lookAtSpeaker: true, maxVisible: 12 },
      twitch: { enabled: true, scale: 0.5, maxViewers: 20, bubbleSeconds: 7, idleMinutes: 10, palette: 'vivid', hats: true, beards: true, showNames: true, anchor: 'bottom-right', widthRatio: 0.55, raidEffects: true, raidMax: 15, subEffects: true, bitsEffects: true },
    };
    if (params.get('layout')) { settings.overlay.layout = params.get('layout'); settings.twitch.layout = params.get('layout'); }
    makeFakeMembers(); fakeChatLoop();
    setTimeout(() => onTwitchEvent({ type: 'sub', login: 'kiwi', display: 'kiwi', text: 'Thanks for the sub!' }), 4000);
  }

  // ---------- Discord puppets ----------
  function discordAvatarUrl(m) {
    if (m.avatarHash) return `https://cdn.discordapp.com/avatars/${m.id}/${m.avatarHash}.png?size=128`;
    let idx = 0;
    try { idx = Number((BigInt(m.id) >> 22n) % 6n); } catch (e) {}
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }

  // Group origin: either a corner anchor or a custom position (ratios of the screen) set in placement mode.
  // Slots are as wide as each puppet's own scale, so a bigger puppet pushes its neighbours away.
  function discordLayout(scales) {
    const cfg = settings.overlay;
    const s = cfg.scale || 0.8, margin = cfg.margin || 30;
    const vertical = cfg.layout === 'vertical';
    // Horizontal: gap between feet; vertical: gap between baselines (puppets overlap a little, like a stack).
    const gap = vertical ? 235 * s * (cfg.spacing || 120) / 120 : (cfg.spacing || 120) * s / 0.8;
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
      return { xs: offs.map(() => x), ys: offs.map((o) => yStart + dir * o), s, vertical, total };
    }
    let x0, y;
    if (anchor === 'custom' && cfg.pos) { x0 = cfg.pos.x * W - total / 2; y = cfg.pos.y * H; }
    else {
      if (anchor.endsWith('left')) x0 = margin + 60 * s * first;
      else if (anchor.endsWith('right')) x0 = W - margin - 60 * s * lastS - total;
      else x0 = W / 2 - total / 2;
      y = anchor.startsWith('top') ? margin + 230 * s * maxS : H - margin - 30 * s;
    }
    return { xs: offs.map((o) => x0 + o), ys: offs.map(() => y), s, vertical, total };
  }

  // Per-member settings (hide / nickname / size) and manual order from the panel.
  function memberCfg(id) { return (settings.members && settings.members[id]) || {}; }
  function orderMembers(list) {
    const order = settings.memberOrder || [];
    const idx = (id) => { const i = order.indexOf(id); return i < 0 ? 1e6 : i; };
    return list.map((m, i) => ({ m, i })).sort((a, b) => idx(a.m.id) - idx(b.m.id) || a.i - b.i).map((x) => x.m);
  }

  function updateDiscord(dt, t) {
    const cfg = settings.overlay;
    const real = members.length > 0;
    const src = real ? members : (fakeMembers && (TEST || DEMO || placement) ? fakeMembers : []);
    let list = src.filter((m) => !(cfg.showSelf === false && m.self) && !memberCfg(m.id).hidden);
    if (cfg.hideIdle && !placement) list = list.filter((m) => m.speaking || (dEnts.get(m.id) && dEnts.get(m.id).anim.hangover > 0));
    list = orderMembers(list).slice(0, cfg.maxVisible || 12);
    const scales = list.map((m) => Math.min(1.8, Math.max(0.5, Number(memberCfg(m.id).scale) || 1)));
    const L = discordLayout(scales);
    const ids = new Set(list.map((m) => m.id));

    list.forEach((m, i) => {
      let e = dEnts.get(m.id);
      const tx = L.xs[i];
      if (!e) {
        e = { id: m.id, anim: new P.Animator(m.id), x: tx, y: L.ys[i], vy: 0, enter: pickEntrance(cfg.entrance), age: 0, leaving: -1 };
        if (e.enter === 'walk') e.x = tx < W / 2 ? -120 : W + 120;
        if (e.enter === 'drop') e.y = L.ys[i] - H;
        dEnts.set(m.id, e);
      }
      e.member = m; e.tx = tx; e.ty = L.ys[i]; e.s = L.s * scales[i];
      if (e.leaving >= 0 && !e.forceLeave) { e.leaving = -1; e.scaleMul = 1; e.exit = null; }
    });
    for (const e of dEnts.values()) if (!ids.has(e.id) && e.leaving < 0) startExit(e);

    // who is speaking, for the "look at speaker" behaviour
    const speakers = [...dEnts.values()].filter((e) => e.leaving < 0 && e.member.speaking && !e.member.mute);
    for (const e of dEnts.values()) {
      const a = e.anim;
      e.age += dt;
      a.talking = !!e.member.speaking && !e.member.mute && e.leaving < 0;
      a.sleepAfter = (cfg.sleepMinutes || 0) * 60;
      if (cfg.lookAtSpeaker !== false && !a.talking && speakers.length) {
        let best = null; for (const sp of speakers) if (sp !== e && (!best || Math.abs(sp.x - e.x) < Math.abs(best.x - e.x))) best = sp;
        a.lookTarget = best ? Math.max(-1, Math.min(1, (best.x - e.x) / 120)) : 0;
      } else a.lookTarget = 0;
      a.update(dt, t);
      // movement: walk/slide to target, drop with a bounce
      if (e.enter === 'drop' && e.y < e.ty - 0.5 || Math.abs(e.vy) > 30) {
        e.vy += 2600 * dt; e.y += e.vy * dt;
        if (e.y >= e.ty) { e.y = e.ty; e.vy = -e.vy * 0.35; if (Math.abs(e.vy) < 120) { e.vy = 0; e.enter = 'done'; } }
      } else e.y += (e.ty - e.y) * Math.min(1, dt * 8);
      const dx = e.tx - e.x;
      e.walking = Math.abs(dx) > 4 && e.leaving < 0;
      if (e.leaving < 0) e.x += Math.sign(dx) * Math.min(Math.abs(dx), (e.enter === 'walk' ? 520 : 900) * dt * (Math.abs(dx) > 40 ? 1 : 0.5));
      enterFx(e, dt);
      if (e.leaving >= 0) {
        e.leaving += dt;
        exitFx(e, dt);
        if (e.leaving > EXIT_DURATION[e.exit]) dEnts.delete(e.id);
      }
    }
  }

  // ---------- Screen share (laptop prop) & voice effects ----------
  function isSharing(m) { return !!(m.streaming || (m.id === meId && selfSharing) || (m.self && selfSharing)); }
  // A small laptop in front of the puppet. With a preview image (own screen only) it is drawn into the lid.
  function drawLaptop(x, y, s, img, t) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    const W2 = 46, sh = 52, by = -26;
    // lid
    ctx.fillStyle = '#2b2a33'; ctx.beginPath(); ctx.moveTo(-W2, by); ctx.lineTo(W2, by); ctx.lineTo(W2 - 4, by - sh); ctx.lineTo(-W2 + 4, by - sh); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#1d1a1f'; ctx.stroke();
    const sx = -W2 + 8, sy = by - sh + 5, sw = W2 * 2 - 16, sh2 = sh - 11;
    if (img) ctx.drawImage(img, sx, sy, sw, sh2);
    else {
      const g = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh2);
      g.addColorStop(0, '#3a6df0'); g.addColorStop(1, '#9b5cff'); ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh2);
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy + ((t * 30) % sh2), sw, 3); ctx.globalAlpha = 1;
    }
    // LIVE badge
    ctx.fillStyle = '#ed4245'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(sx + 3, sy + 3, 26, 11, 3) : ctx.rect(sx + 3, sy + 3, 26, 11); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '800 8px "Segoe UI", sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText('LIVE', sx + 6, sy + 9);
    // base
    ctx.fillStyle = '#c9ccd6'; ctx.beginPath(); ctx.moveTo(-W2 - 6, by); ctx.lineTo(W2 + 6, by); ctx.lineTo(W2 + 2, by + 8); ctx.lineTo(-W2 - 2, by + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // Emoji reactions / soundboard sent in the voice channel, floating above the sender.
  function onVoiceEffect(ev) {
    if (!settings || settings.overlay.voiceEffects === false) return;
    let e = dEnts.get(ev.userId);
    if (!e && ev.test) e = [...dEnts.values()][Math.floor(Math.random() * dEnts.size)];
    if (!e) return;
    const em = ev.emoji || {};
    const p = { kind: 'emoji', follow: e, ox: (Math.random() - 0.5) * 30, rise: 0, life: 2.6, max: 2.6, sound: !!ev.soundId, init: true };
    if (em.id) { p.img = new Image(); p.img.src = `https://cdn.discordapp.com/emojis/${em.id}.${em.animated ? 'gif' : 'png'}?size=96`; }
    p.text = em.name && !em.id ? em.name : (ev.soundId && !em.id ? '🔊' : null);
    particles.push(p);
    e.anim.jump(14);
  }
  function drawEmojiParticle(p, dt) {
    const e = p.follow; if (!e || !dEnts.has(e.id)) { p.life = 0; return; }
    p.rise += dt * 55;
    const s = e.s, age = p.max - p.life;
    const k = Math.min(1, age / 0.18) * (age < 0.3 ? 1 + 0.25 * Math.sin(age / 0.3 * Math.PI) : 1);
    const x = e.x + p.ox * s, y = e.y + P.headTopLocal({}) * s - 30 * s - p.rise * s;
    ctx.save(); ctx.globalAlpha = Math.min(1, p.life * 1.5);
    if (p.sound) { // sound rings
      for (let i = 0; i < 2; i++) { const r = ((age * 1.4 + i * 0.5) % 1); ctx.globalAlpha = Math.min(1, p.life) * (1 - r) * 0.6; ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, (20 + r * 40) * s, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = Math.min(1, p.life * 1.5);
    }
    const size = 46 * s * k;
    if (p.img && p.img.complete && p.img.naturalWidth) ctx.drawImage(p.img, x - size / 2, y - size / 2, size, size);
    else if (p.text) { ctx.font = `${Math.round(size)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.text, x, y); }
    if (p.sound && (p.img || p.text !== '🔊')) { ctx.font = `${Math.round(18 * s)}px "Segoe UI Emoji", sans-serif`; ctx.fillText('🔊', x + size * 0.55, y + size * 0.4); }
    ctx.restore();
  }

  // ---------- Entrance / exit effects ----------
  // Each effect returns per-frame render modifiers on the entity (e.fx): offsets, squash, alpha, clip.
  const ENTRANCES = ['walk', 'drop', 'pop', 'portal', 'beam', 'feathers', 'smoke'];
  const EXITS = ['poof', 'portal', 'beam', 'feathers'];
  const EXIT_DURATION = { poof: 0.7, portal: 1.15, beam: 1.0, feathers: 0.35, none: 0 };
  const ease = (p) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
  function pickEntrance(mode) {
    if (ENTRANCES.includes(mode)) return mode;
    if (mode === 'none') return 'done';
    return ENTRANCES[Math.floor(Math.random() * ENTRANCES.length)];
  }
  function startExit(e) {
    const mode = settings.overlay.exit || 'random';
    e.exit = mode === 'none' ? 'none' : EXITS.includes(mode) ? mode : EXITS[Math.floor(Math.random() * EXITS.length)];
    e.leaving = 0;
    if (e.exit === 'feathers') featherBurst(e.x, e.y - 110 * e.s, e.s, e.anim, 14);
  }
  function enterFx(e, dt) {
    const f = (e.fx = { dy: 0, sx: 1, sy: 1, alpha: 1, clipBelow: null, hidden: false, rock: 0 });
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
        else if (a < 0.85) { const p = (a - 0.3) / 0.55; f.alpha = p * (0.6 + 0.4 * Math.abs(Math.sin(a * 40))); f.sx = 0.25 + 0.75 * ease(p); f.sy = 1.4 - 0.4 * ease(p); if (Math.random() < 0.6) sparkle(e.x + (Math.random() - 0.5) * 60 * e.s, e.y - Math.random() * 200 * e.s, e.s); }
        if (a > 1.15) e.enter = 'done';
        break;
      case 'feathers': {
        const D = 1.7, p = Math.min(1, a / D);
        f.dy = -(1 - ease(p)) * 420 * e.s; f.rock = Math.sin(a * 4) * 0.25 * (1 - p);
        if (p < 1 && Math.random() < dt * 5) featherBurst(e.x + (Math.random() - 0.5) * 90 * e.s, e.y + f.dy - 120 * e.s, e.s, null, 1);
        if (a > D) e.enter = 'done';
        break;
      }
      case 'smoke':
        if (a < 0.22) f.hidden = true;
        else if (a < 0.5) e.scaleMul = ease((a - 0.22) / 0.28);
        else { e.scaleMul = 1; }
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
        if (l > 0.25) { const p = Math.min(1, (l - 0.25) / 0.45); f.sx = 1 - 0.92 * ease(p); f.sy = 1 + 0.6 * ease(p); f.alpha = 1 - p; if (Math.random() < 0.7) sparkle(e.x + (Math.random() - 0.5) * 50 * e.s, e.y - Math.random() * 220 * e.s, e.s); if (p >= 1) f.hidden = true; }
        break;
      case 'feathers': e.scaleMul = Math.max(0, 1 - l / 0.12); break;
      default: f.hidden = true;
    }
  }
  // Effects drawn behind (portal back half, beam) and in front (portal rim, smoke) of the puppet.
  function drawFxBack(e, t) {
    const a = e.age, l = e.leaving;
    if (e.enter === 'portal' && a < 1.3) drawPortal(e.x, e.y, e.s, portalK(a, 0.35, 0.95, 1.3), t, true);
    if (e.exit === 'portal' && l >= 0) drawPortal(e.x, e.y, e.s, portalK(l, 0.3, 0.85, 1.15), t, true);
    if (e.enter === 'beam' && a < 1.15) drawBeam(e.x, e.y, e.s, a < 0.3 ? ease(a / 0.3) : 1 - ease((a - 0.85) / 0.3));
    if (e.exit === 'beam' && l >= 0) drawBeam(e.x, e.y, e.s, l < 0.25 ? ease(l / 0.25) : 1 - ease((l - 0.7) / 0.3));
  }
  function drawFxFront(e, t) {
    const a = e.age, l = e.leaving;
    if (e.enter === 'portal' && a < 1.3) drawPortal(e.x, e.y, e.s, portalK(a, 0.35, 0.95, 1.3), t, false);
    if (e.exit === 'portal' && l >= 0) drawPortal(e.x, e.y, e.s, portalK(l, 0.3, 0.85, 1.15), t, false);
    if (e.enter === 'smoke' && a < 0.8) P.drawPoof(ctx, e.x, e.y - 110 * e.s, e.s * 1.3, Math.min(1, a / 0.8));
    if ((e.exit === 'poof' || e.exit === 'feathers') && l >= 0) P.drawPoof(ctx, e.x, e.y - 120 * e.s, e.s * (e.exit === 'feathers' ? 0.7 : 1), Math.min(1, l / (e.exit === 'feathers' ? 0.35 : 0.7)));
  }
  // Portal size over time: opens, stays, closes.
  function portalK(time, open, hold, close) { return time < open ? ease(time / open) : time < hold ? 1 : 1 - ease((time - hold) / (close - hold)); }
  function drawPortal(x, y, s, k, t, back) {
    if (k <= 0.01) return;
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
    const w = 80 * s * k;
    ctx.save();
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, 'rgba(120,220,255,0)'); g.addColorStop(0.5, `rgba(200,245,255,${0.55 * k})`); g.addColorStop(1, 'rgba(120,220,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - w / 2, 0, w, y + 4);
    ctx.fillStyle = `rgba(255,255,255,${0.6 * k})`; ctx.fillRect(x - w * 0.07, 0, w * 0.14, y + 4);
    ctx.fillStyle = `rgba(160,235,255,${0.5 * k})`; ctx.beginPath(); ctx.ellipse(x, y, w * 0.8, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function sparkle(x, y, s) {
    if (perfMode() === 'eco' && Math.random() < 0.6) return;
    particles.push({ kind: 'sparkle', x, y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 40, life: 0.5 + Math.random() * 0.4, size: (3 + Math.random() * 4) * Math.max(0.6, s), init: true });
  }
  function featherBurst(x, y, s, anim, n) {
    if (perfMode() === 'eco') n = Math.ceil(n * 0.5);
    const cols = ['#ffffff', '#f6f1e7', '#ffe9a8', '#ffd1e3'];
    for (let i = 0; i < n; i++) particles.push({ kind: 'feather', x: x + (Math.random() - 0.5) * 40 * s, y: y + (Math.random() - 0.5) * 40 * s, vx: (Math.random() - 0.5) * 220, vy: -120 - Math.random() * 180, rot: Math.random() * 6, ph: Math.random() * 6, life: 2.2 + Math.random() * 1.2, size: (10 + Math.random() * 6) * Math.max(0.6, s), c: cols[i % cols.length], init: true });
  }

  function drawDiscord(t) {
    const cfg = settings.overlay;
    const ents = [...dEnts.values()].sort((a, b) => a.ty - b.ty || a.x - b.x);
    for (const e of ents) {
      const m = e.member;
      const f = e.fx || {};
      drawFxBack(e, t);
      if (!f.hidden) {
        const st = e.anim.state(t);
        if (e.walking) st.bob -= Math.abs(Math.sin(t * 13 + e.x * 0.01)) * 9;
        st.scaleMul = e.scaleMul == null ? 1 : e.scaleMul;
        st.sx = f.sx; st.sy = f.sy; st.alpha = f.alpha; st.rock = (st.rock || 0) + (f.rock || 0);
        const av = avatars[m.id] || m.demoAvatar || { ...P.defaultAvatar(), kind: 'discord', photoSplit: 0.6, clothColor: '#5865f2', accentColor: '#ffffff' };
        ctx.save();
        if (f.clipBelow != null) { ctx.beginPath(); ctx.rect(0, 0, W, f.clipBelow); ctx.clip(); }
        P.draw(ctx, av, st, {
          x: e.x, y: e.y + (f.dy || 0), scale: e.s,
          name: cfg.showNames !== false && e.leaving < 0 && e.enter === 'done' || cfg.showNames !== false && e.leaving < 0 && ['walk', 'drop', 'pop'].includes(e.enter) ? (memberCfg(m.id).alias || m.name) : null,
          muted: m.mute, deaf: m.deaf, glow: cfg.glow && m.speaking && !m.mute, statusStyle: cfg.statusStyle,
          flip: e.walking && e.tx > e.x, // puppets face left by default
          discordAvatarUrl: discordAvatarUrl(m),
        });
        if (isSharing(m) && cfg.screenShare !== 'off' && e.leaving < 0) drawLaptop(e.x, e.y + (f.dy || 0) + st.bob * e.s, e.s * st.scaleMul, cfg.screenShare === 'advanced' ? (previews.get(m.id) || (m.id === meId && previews.get('self'))) : null, t);
        ctx.restore();
      }
      drawFxFront(e, t);
    }
  }

  // ---------- Twitch viewers ----------
  function styleKey(cfg) { cfg = cfg || {}; return [cfg.palette, cfg.hats, cfg.beards, (cfg.colors || []).join()].join('|'); }
  function viewerAvatar(login) {
    const cfg = (settings && settings.twitch) || {};
    const ov = overrides[login] || {};
    const a = P.randomAvatar(ov.seed || login, { palette: cfg.palette, hats: cfg.hats, beards: cfg.beards, colors: cfg.colors });
    for (const k of ['hat', 'hair', 'outfit', 'eyes', 'glasses', 'held', 'neckwear', 'pattern', 'clothColor', 'hatColor']) if (ov[k]) a[k] = ov[k];
    return a;
  }
  function restyle(login) { const v = viewers.get(login); if (v && !v.temp) v.avatar = viewerAvatar(login); }
  function restyleAll() { for (const v of viewers.values()) if (!v.temp) v.avatar = viewerAvatar(v.login); }

  function ensureViewer(login, display, color) {
    const cfg = settings.twitch || {};
    let v = viewers.get(login);
    if (!v || v.leaving >= 0) {
      if (v) viewers.delete(login);
      v = { login, display, color, avatar: viewerAvatar(login), anim: new P.Animator('t:' + login), x: null, y: null, joined: performance.now(), leaving: -1 };
      viewers.set(login, v);
      const regular = [...viewers.values()].filter((x) => !x.temp && x.leaving < 0);
      if (regular.length > (cfg.maxViewers || 20)) {
        const oldest = regular.filter((x) => x !== v).sort((a, b) => (a.lastMsg || 0) - (b.lastMsg || 0))[0];
        if (oldest) oldest.leaving = 0;
      }
    }
    v.display = display || v.display; v.color = color || v.color;
    v.lastMsg = performance.now() / 1000;
    return v;
  }

  // ---------- Chat sounds ----------
  // Exactly one page plays them: the desktop overlay (output 'app') or the OBS source (output 'obs').
  const sound = new ChatSound();
  function soundHere() {
    const snd = (settings.twitch && settings.twitch.sound) || {};
    if (!settings.twitch.enabled || TEST || DEMO) return false;
    return (snd.output || 'app') === 'app' ? DESKTOP : !DESKTOP;
  }
  function configureSound() {
    const snd = Object.assign({}, (settings.twitch && settings.twitch.sound) || {});
    if (!soundHere()) snd.mode = 'none';
    snd.namePattern = t('{name} says: ');
    sound.configure(snd);
  }

  function onChat(m) {
    if (!settings) return;
    if (!m.fake && !m.system && m.text && sound.enabled()) {
      sound.say({
        login: m.login, display: m.display, text: m.text,
        // keep the puppet's mouth moving for exactly as long as its sound plays
        onStart: (sec) => { const v = viewers.get(m.login); if (v) v.anim.talkUntil = performance.now() / 1000 + sec; },
        onEnd: () => { const v = viewers.get(m.login); if (v) v.anim.talkUntil = 0; },
      });
    }
    if (SCENE === 'discord') return;
    if (!m.fake) lastRealChat = performance.now();
    const cfg = settings.twitch || {};
    const v = ensureViewer(m.login, m.display, m.color);
    if (m.text) {
      v.msg = String(m.text).slice(0, 220);
      v.system = !!m.system;
      v.msgUntil = v.lastMsg + (cfg.bubbleSeconds || 7);
      v.anim.jump(10);
      if (!sound.enabled() || m.fake) v.anim.talkUntil = v.lastMsg + Math.min(3.5, 0.6 + v.msg.length * 0.05); // otherwise synced to the sound
    }
  }

  function onTwitchEvent(e) {
    if (!settings || SCENE === 'discord') return;
    const cfg = settings.twitch || {};
    if (e.type === 'action') {
      const v = ensureViewer(e.login, e.display, e.color);
      if (e.action === 'jump') v.anim.jump(46);
      if (e.action === 'dance') v.anim.dance(3.5);
      if (e.action === 'wave') v.anim.wave(2.5);
    } else if (e.type === 'restyle') {
      const v = ensureViewer(e.login, e.display, e.color);
      v.avatar = viewerAvatar(e.login); v.pop = 0; v.anim.jump(20);
    } else if (e.type === 'sub' && cfg.subEffects !== false) {
      const v = ensureViewer(e.login, e.display, e.color);
      v.anim.jump(40); v.anim.wave(2.5); v.celebrate = performance.now() / 1000 + 3;
      if (e.text) { v.msg = e.text; v.system = true; v.msgUntil = v.lastMsg + Math.max(6, cfg.bubbleSeconds || 7); }
      burst(v, 70);
    } else if (e.type === 'bits' && cfg.bitsEffects !== false) {
      const v = ensureViewer(e.login, e.display, e.color);
      v.anim.jump(30); v.anim.dance(2); burst(v, Math.min(120, 20 + (e.amount || 0) / 5));
    } else if (e.type === 'raid' && cfg.raidEffects !== false) {
      const leader = ensureViewer(e.login, e.display, e.color);
      leader.msg = `RAID! ×${e.count}`; leader.system = true; leader.msgUntil = leader.lastMsg + 8; leader.anim.wave(4);
      const n = Math.min(cfg.raidMax || 15, e.count || 1);
      const now = performance.now() / 1000;
      for (let i = 0; i < n; i++) {
        const login = `raid:${e.login}:${i}:${Math.floor(now)}`;
        viewers.set(login, { login, display: '', temp: true, expires: now + 40 + Math.random() * 10, avatar: P.randomAvatar(login, { palette: cfg.palette, hats: cfg.hats, beards: cfg.beards, colors: cfg.colors }), anim: new P.Animator(login), x: null, y: null, joined: performance.now() + i * 120, leaving: -1, delay: i * 0.12, lastMsg: now });
      }
      setTimeout(() => burst(leader, 90), 300);
    }
  }

  function burst(v, n) {
    if (perfMode() === 'eco') n = Math.ceil(n * 0.4);
    const cols = ['#ff7a45', '#f5c518', '#43b581', '#5865f2', '#ff6fa8', '#00cec9', '#ffffff'];
    for (let i = 0; i < n; i++) {
      particles.push({ follow: v, x: 0, y: 0, vx: (Math.random() - 0.5) * 520, vy: -250 - Math.random() * 520, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, c: cols[i % cols.length], life: 2 + Math.random() * 1.2, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, init: false });
    }
  }

  function twitchLayout() {
    const cfg = settings.twitch;
    const s = cfg.scale || 0.5;
    const anchor = cfg.anchor || 'bottom-right';
    const fromRight = anchor !== 'bottom-left';
    if (cfg.layout === 'vertical') {
      // Columns along the side edge, filled bottom-up; bubbles open sideways toward the screen.
      const vgap = 210 * s, colGap = 230 * s, areaH = H * (cfg.widthRatio || 0.55);
      let colX, baseY;
      if (anchor === 'custom' && cfg.pos) { colX = cfg.pos.x * W; baseY = cfg.pos.y * H; }
      else { colX = fromRight ? W - 20 - 60 * s : 20 + 60 * s; baseY = H - 20 - 20 * s; }
      const perCol = Math.max(1, Math.floor(areaH / vgap));
      const slot = (i) => { const c = Math.floor(i / perCol), r = i % perCol; return { x: colX + (fromRight ? -1 : 1) * c * colGap, y: baseY - r * vgap, col: c }; };
      const rect = { x: fromRight ? colX - colGap * 1.4 : colX - 70 * s, y: baseY - areaH - 60 * s, w: colGap * 1.4 + 70 * s, h: areaH + 80 * s };
      return { s, vertical: true, fromRight, slot, rect, baseY };
    }
    const gap = 95 * s / 0.5;
    const areaW = W * (cfg.widthRatio || 0.55);
    let left, baseY;
    if (anchor === 'custom' && cfg.pos) { left = cfg.pos.x * W - areaW / 2; baseY = cfg.pos.y * H; }
    else { left = fromRight ? W - 20 - areaW : 20; baseY = H - 20 - 20 * s; }
    const perRow = Math.max(1, Math.floor(areaW / gap));
    const slot = (i) => {
      const row = Math.floor(i / perRow), col = i % perRow;
      const off = col * gap + (row % 2) * gap / 2 + 50 * s;
      return { x: fromRight ? left + areaW - off : left + off, y: baseY - row * 120 * s, col };
    };
    return { s, vertical: false, fromRight, slot, rect: { x: left, y: baseY - 210 * s, w: areaW, h: 250 * s }, baseY };
  }

  function updateTwitch(dt, t) {
    const cfg = settings.twitch;
    const now = performance.now() / 1000;
    const idle = (cfg.idleMinutes || 10) * 60;
    const L = twitchLayout();
    const list = [...viewers.values()].filter((v) => v.leaving < 0).sort((a, b) => a.joined - b.joined);
    list.forEach((v, i) => {
      if ((v.temp && now > v.expires) || (!v.temp && now - v.lastMsg > idle)) { v.leaving = 0; return; }
      const sl = L.slot(i);
      v.tx = sl.x; v.ty = sl.y; v.col = sl.col;
      if (v.x == null) { v.x = L.fromRight ? W + 80 : -80; v.y = v.ty; }
    });
    for (const v of [...viewers.values()]) {
      const a = v.anim;
      if (v.delay > 0) { v.delay -= dt; continue; }
      a.talking = now < (a.talkUntil || 0);
      a.update(dt, t);
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

  function drawTwitch(t) {
    const cfg = settings.twitch;
    const L = twitchLayout();
    const now = performance.now() / 1000;
    const list = [...viewers.values()].filter((v) => v.x != null && !(v.delay > 0)).sort((a, b) => a.ty - b.ty);
    for (const v of list) {
      const st = v.anim.state(t);
      if (v.walking) st.bob -= Math.abs(Math.sin(t * 14 + v.x * 0.01)) * 7;
      st.scaleMul = v.leaving >= 0 ? Math.max(0, 1 - v.leaving / 0.22) : (v.pop != null ? 1 + Math.sin(v.pop / 0.5 * Math.PI) * 0.18 : 1);
      P.draw(ctx, v.avatar, st, { x: v.x, y: v.y, scale: L.s, flip: v.walking ? v.tx > v.x : (L.vertical ? !L.fromRight : v.x < W / 2), name: cfg.showNames !== false && v.display && v.leaving < 0 ? v.display : null, labelColor: cfg.useChatColor ? v.color : null });
      if (v.leaving >= 0) P.drawPoof(ctx, v.x, v.y - 120 * L.s, L.s, Math.min(1, v.leaving / 0.7));
      if (v.msg && now < v.msgUntil && v.leaving < 0) {
        const alpha = Math.min(1, (v.msgUntil - now) / 0.5);
        const headTop = v.y + st.bob * L.s + P.headTopLocal(v.avatar) * L.s - (L.vertical ? 0 : (v.col % 2) * 46 * L.s);
        Puppet.drawBubble(ctx, v.msg, v.x, headTop, Math.max(0.75, L.s * 1.4), { alpha, bg: v.system ? '#2b2633' : cfg.bubbleBg, fg: v.system ? '#ffd166' : cfg.bubbleFg, viewW: W, maxLines: v.system ? 4 : 3,
          side: L.vertical ? (L.fromRight ? 'left' : 'right') : null, sideGap: 70 * L.s });
      }
    }
  }

  // Particles: confetti (falls fast), feathers (drift and sway), sparkles (twinkle and fade).
  function drawParticles(dt, t) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!p.init) { const v = p.follow; const s = settings.twitch.scale || 0.5; p.x = v.x || W / 2; p.y = (v.y || H) - 170 * s; p.init = true; p.follow = null; }
      p.life -= dt;
      if (p.kind === 'emoji') { drawEmojiParticle(p, dt); if (p.life <= 0) particles.splice(i, 1); continue; }
      if (p.kind === 'feather') {
        p.vy = Math.min(p.vy + 260 * dt, 55); p.vx *= Math.pow(0.15, dt);
        p.x += (p.vx + Math.sin(t * 2.4 + p.ph) * 38) * dt; p.y += p.vy * dt; p.rot = Math.sin(t * 2.4 + p.ph) * 0.9;
      } else if (p.kind === 'sparkle') {
        p.x += p.vx * dt; p.y += p.vy * dt;
      } else {
        p.vy += 900 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      }
      if (p.life <= 0 || p.y > H + 40) { particles.splice(i, 1); continue; }
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

  // ---------- Placement mode (desktop overlay only) ----------
  const groups = { discord: null, twitch: null };
  function groupRects() {
    const ds = [...dEnts.values()].filter((e) => e.leaving < 0);
    if (ds.length && SCENE !== 'twitch') {
      const s = Math.max(...ds.map((e) => e.s)); const xs = ds.map((e) => e.tx), ys = ds.map((e) => e.ty);
      groups.discord = { x: Math.min(...xs) - 75 * s, y: Math.min(...ys) - 270 * s, w: Math.max(...xs) - Math.min(...xs) + 150 * s, h: Math.max(...ys) - Math.min(...ys) + 310 * s };
    } else groups.discord = null;
    if (SCENE !== 'discord' && settings.twitch && (settings.twitch.enabled || settings.twitch.showOnDesktop)) {
      groups.twitch = twitchLayout().rect;
    } else groups.twitch = null;
  }
  function drawPlacement() {
    ctx.save();
    ctx.fillStyle = 'rgba(12,10,16,0.45)'; ctx.fillRect(0, 0, W, H);
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
  let drag = null, doneBtn = null;
  const inside = (r, x, y) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  function finishPlacement() { fetch('/api/action', { method: 'POST', body: JSON.stringify({ name: 'placement', on: false }) }); }
  function saveSettings(patch) { fetch('/api/settings', { method: 'POST', body: JSON.stringify(patch) }); }
  canvas.addEventListener('mousedown', (e) => {
    if (!placement) return;
    if (inside(doneBtn, e.clientX, e.clientY)) return finishPlacement();
    const key = inside(groups.discord, e.clientX, e.clientY) ? 'discord' : inside(groups.twitch, e.clientX, e.clientY) ? 'twitch' : null;
    if (!key) return;
    const cfg = key === 'discord' ? settings.overlay : settings.twitch;
    const r = groups[key];
    // Switch to a custom anchor at the group's current centre/baseline so the drag starts from where it is.
    if (cfg.anchor !== 'custom') {
      cfg.anchor = 'custom';
      cfg.pos = key === 'discord' ? { x: (r.x + r.w / 2) / W, y: dEnts.size ? Math.max(...[...dEnts.values()].map((e) => e.ty)) / H : 0.9 } : { x: (settings.twitch.layout === 'vertical' ? (settings.twitch.anchor === 'bottom-left' ? r.x + 70 * (settings.twitch.scale || 0.5) : r.x + r.w - 70 * (settings.twitch.scale || 0.5)) : r.x + r.w / 2) / W, y: twitchLayout().baseY / H };
    }
    drag = { key, sx: e.clientX, sy: e.clientY, px: cfg.pos.x, py: cfg.pos.y };
  });
  addEventListener('mousemove', (e) => {
    if (!drag) return;
    const cfg = drag.key === 'discord' ? settings.overlay : settings.twitch;
    cfg.pos = { x: Math.max(0.02, Math.min(0.98, drag.px + (e.clientX - drag.sx) / W)), y: Math.max(0.1, Math.min(1, drag.py + (e.clientY - drag.sy) / H)) };
  });
  addEventListener('mouseup', () => {
    if (!drag) return;
    const k = drag.key === 'discord' ? 'overlay' : 'twitch';
    saveSettings({ [k]: { anchor: 'custom', pos: settings[k].pos } });
    drag = null;
  });
  let wheelTimer = null;
  canvas.addEventListener('wheel', (e) => {
    if (!placement) return;
    const key = inside(groups.discord, e.clientX, e.clientY) ? 'overlay' : inside(groups.twitch, e.clientX, e.clientY) ? 'twitch' : null;
    if (!key) return;
    const cfg = settings[key];
    const [min, max] = key === 'overlay' ? [0.3, 1.6] : [0.25, 1];
    cfg.scale = Math.round(Math.max(min, Math.min(max, (cfg.scale || 0.8) * (e.deltaY < 0 ? 1.06 : 0.94))) * 100) / 100;
    clearTimeout(wheelTimer); wheelTimer = setTimeout(() => saveSettings({ [key]: { scale: cfg.scale } }), 250);
  }, { passive: true });
  addEventListener('keydown', (e) => { if (placement && e.key === 'Escape') finishPlacement(); });

  // ---------- Render loop ----------
  // Frame cap: Performance = display rate, Normal = 60 fps, Eco = 30 fps.
  // When nothing is on screen the canvas is cleared once and the loop idles (Eco also slows its polling).
  let last = performance.now(), lastDraw = 0, wasEmpty = false;
  function schedule(idle) {
    if (idle && perfMode() === 'eco') setTimeout(() => requestAnimationFrame(frame), 250);
    else requestAnimationFrame(frame);
  }
  function frame(now) {
    const cap = perfMode() === 'eco' ? 30 : perfMode() === 'normal' ? 60 : 0;
    if (cap && now - lastDraw < 1000 / cap - 2) { requestAnimationFrame(frame); return; }
    lastDraw = now;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    let empty = true;
    if (settings) {
      const showDiscord = SCENE !== 'twitch' && (settings.overlay.enabled !== false || placement || !DESKTOP);
      const showTwitch = SCENE !== 'discord' && (settings.twitch.enabled || DEMO || TEST);
      if (showDiscord) updateDiscord(dt, t);
      if (showTwitch) updateTwitch(dt, t);
      empty = !placement && (!showDiscord || !dEnts.size) && (!showTwitch || !viewers.size) && !particles.length;
      if (!(empty && wasEmpty)) {
        ctx.clearRect(0, 0, W, H);
        if (placement) { groupRects(); drawPlacement(); }
        if (showDiscord) drawDiscord(t);
        if (showTwitch) drawTwitch(t);
        drawParticles(dt, t);
      }
    }
    wasEmpty = empty;
    schedule(empty);
  }

  // Debug/test hooks (also handy from the DevTools console).
  window.puppetFxTest = () => { for (const e of dEnts.values()) if (e.leaving < 0) { e.forceLeave = true; startExit(e); } };
  if (DEMO && params.get('fx')) setTimeout(() => { settings.overlay.entrance = params.get('fx'); settings.overlay.exit = params.get('exit') || params.get('fx'); }, 0);

  if (DEMO) startDemo();
  else { connect(); makeFakeMembers(); if (TEST) fakeChatLoop(); }
  requestAnimationFrame(frame);
})();
