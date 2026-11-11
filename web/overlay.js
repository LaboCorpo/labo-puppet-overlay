/*
 * Overlay scene: Discord voice puppets + Twitch viewer crowd.
 * Same page is used by the desktop overlay window and by OBS/Streamlabs (Browser Source).
 * URL params: ?scene=all|discord|twitch  &demo=1 (fake data, no server needed)
 */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const SCENE = params.get('scene') || 'all';
  const DEMO = params.get('demo') === '1';
  const TEST = params.get('test') === '1'; // live settings + fake members/chat (panel preview)
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint');

  let settings = null;
  let members = [];            // [{id,name,avatarHash,speaking,mute,deaf,self}]
  let avatars = {};            // discordId -> avatar
  const animators = new Map(); // key -> Animator
  const viewers = new Map();   // login -> viewer

  // ---------- Canvas sizing ----------
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize); resize();

  function anim(key) {
    let a = animators.get(key);
    if (!a) { a = new Puppet.Animator(key); animators.set(key, a); }
    return a;
  }

  // ---------- Server link (SSE) ----------
  function applyState(s) {
    if (s.settings) settings = s.settings;
    if (s.avatars) avatars = s.avatars;
    if (s.discord) members = s.discord.members || [];
    for (const m of members) anim('d:' + m.id).talking = !!m.speaking;
    if (settings) setupTwitch(settings.twitch);
  }
  function connect() {
    const es = new EventSource('/api/events');
    es.addEventListener('state', (e) => applyState(JSON.parse(e.data)));
    es.addEventListener('speaking', (e) => {
      const d = JSON.parse(e.data);
      const m = members.find((x) => x.id === d.id);
      if (m) m.speaking = d.speaking;
      anim('d:' + d.id).talking = d.speaking;
    });
    es.onerror = () => { hint.style.display = 'block'; hint.textContent = 'Overlay : app Puppet Overlay injoignable, nouvelle tentative…'; };
    es.onopen = () => { hint.style.display = 'none'; };
  }

  // ---------- Demo data ----------
  let fakeMembers = null;
  function startDemo(fakeSettings) {
    if (fakeSettings) settings = {
      overlay: { anchor: 'bottom-left', scale: 0.8, spacing: 120, margin: 30, showNames: true, hideIdle: false, glow: true, maxVisible: 12 },
      twitch: { enabled: true, channel: '', scale: 0.5, maxViewers: 20, bubbleSeconds: 7, idleMinutes: 10, palette: 'vif', hats: true, beards: true, showNames: true, bubbleBg: '#ffffff', bubbleFg: '#1d1a1f' },
    };
    fakeMembers = [
      { id: '1', name: 'Timo', speaking: false, demoAvatar: Object.assign(Puppet.randomAvatar('Timo'), { hat: 'casque audio' }) },
      { id: '2', name: 'Léa', speaking: false, mute: true, demoAvatar: Puppet.randomAvatar('Léa') },
      { id: '3', name: 'Max', speaking: false, demoAvatar: Puppet.randomAvatar('Max') },
    ];
    setInterval(() => {
      for (const m of fakeMembers) { m.speaking = !m.mute && Math.random() < 0.4; }
    }, 1200);
    const names = ['pixelcat', 'Bobby_42', 'xXnoobXx', 'MamieGaming', 'kiwi', 'ZeroCool', 'tartiflette'];
    const msgs = ['salut !', 'GG', 'trop drôle la tête qui s’ouvre 😂', 'first', 'tu joues à quoi ce soir ?', 'lol', 'on veut la suite !!'];
    setInterval(() => {
      const n = names[Math.floor(Math.random() * names.length)];
      onChat(n.toLowerCase(), n, msgs[Math.floor(Math.random() * msgs.length)], null);
    }, 1600);
  }

  // ---------- Twitch (anonymous IRC over WebSocket, read-only) ----------
  let tw = { ws: null, channel: '' };
  function setupTwitch(cfg) {
    if (SCENE === 'discord') return;
    const want = cfg && cfg.enabled && cfg.channel ? cfg.channel.toLowerCase().replace(/^#/, '').trim() : '';
    if (want === tw.channel) return;
    if (tw.ws) { try { tw.ws.close(); } catch (e) {} tw.ws = null; }
    tw.channel = want;
    viewers.clear();
    if (!want) return;
    const open = () => {
      if (tw.channel !== want) return;
      const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
      tw.ws = ws;
      ws.onopen = () => {
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        ws.send('PASS SCHMOOPIIE');
        ws.send('NICK justinfan' + Math.floor(10000 + Math.random() * 80000));
        ws.send('JOIN #' + want);
      };
      ws.onmessage = (ev) => String(ev.data).split('\r\n').forEach(handleIrc);
      ws.onclose = () => { if (tw.ws === ws) setTimeout(open, 4000); };
    };
    open();
  }
  function handleIrc(line) {
    if (!line) return;
    if (line.startsWith('PING')) { tw.ws && tw.ws.send('PONG :tmi.twitch.tv'); return; }
    // @tags :login!login@login.tmi.twitch.tv PRIVMSG #chan :message
    const m = line.match(/^(?:@(\S+) )?:(\w+)!\S+ PRIVMSG #\S+ :(.*)$/);
    if (!m) return;
    const tags = {};
    (m[1] || '').split(';').forEach((kv) => { const i = kv.indexOf('='); if (i > 0) tags[kv.slice(0, i)] = kv.slice(i + 1); });
    let text = m[3];
    if (text.startsWith('\u0001ACTION ')) text = text.slice(8, -1);
    onChat(m[2], tags['display-name'] || m[2], text, tags.color || null);
  }
  function onChat(login, display, text, color) {
    const cfg = (settings && settings.twitch) || {};
    const ignore = String(cfg.ignore || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
    if (ignore.includes(login)) return;
    let v = viewers.get(login);
    if (!v) {
      v = { login, display, color, avatar: Puppet.randomAvatar(login, { palette: cfg.palette, hats: cfg.hats, beards: cfg.beards, colors: cfg.colors }), enter: 0, x: null };
      viewers.set(login, v);
      // Drop the oldest-silent viewer if over capacity.
      const max = cfg.maxViewers || 20;
      if (viewers.size > max) {
        const oldest = [...viewers.values()].sort((a, b) => a.lastMsg - b.lastMsg)[0];
        viewers.delete(oldest.login);
      }
    }
    v.lastMsg = performance.now() / 1000;
    v.msg = text.slice(0, 200);
    v.msgUntil = v.lastMsg + (cfg.bubbleSeconds || 7);
    const a = anim('t:' + login);
    a.hop = 1;
    a.talkUntil = v.lastMsg + Math.min(3.5, 0.6 + text.length * 0.05);
  }
  // Viewer avatars must be regenerated when style settings change.
  let lastStyleKey = '';
  function refreshViewerStyles() {
    const cfg = (settings && settings.twitch) || {};
    const key = [cfg.palette, cfg.hats, cfg.beards, (cfg.colors || []).join()].join('|');
    if (key === lastStyleKey) return;
    lastStyleKey = key;
    for (const v of viewers.values()) v.avatar = Puppet.randomAvatar(v.login, { palette: cfg.palette, hats: cfg.hats, beards: cfg.beards, colors: cfg.colors });
  }

  // ---------- Layout ----------
  function discordAvatarUrl(m) {
    if (m.avatarHash) return `https://cdn.discordapp.com/avatars/${m.id}/${m.avatarHash}.png?size=128`;
    let idx = 0;
    try { idx = Number((BigInt(m.id) >> 22n) % 6n); } catch (e) {}
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }

  function layoutRow(count, cfg, W, H, unitH) {
    const s = cfg.scale || 0.8, gap = (cfg.spacing || 120) * s / 0.8, margin = cfg.margin || 30;
    const anchor = cfg.anchor || 'bottom-left';
    const total = (count - 1) * gap;
    let x0;
    if (anchor.endsWith('left')) x0 = margin + 60 * s;
    else if (anchor.endsWith('right')) x0 = W - margin - 60 * s - total;
    else x0 = W / 2 - total / 2;
    const y = anchor.startsWith('top') ? margin + unitH * s : H - margin - 30 * s;
    return { x0, gap, y, s };
  }

  // ---------- Render loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    const W = innerWidth, H = innerHeight;
    ctx.clearRect(0, 0, W, H);
    if (settings) {
      if (SCENE !== 'twitch') drawDiscord(dt, t, W, H);
      if (SCENE !== 'discord') drawTwitch(dt, t, W, H);
    }
    requestAnimationFrame(frame);
  }

  function drawDiscord(dt, t, W, H) {
    const cfg = settings.overlay || {};
    if (cfg.enabled === false) return;
    const src = members.length || !fakeMembers ? members : fakeMembers;
    let list = src.filter((m) => !(cfg.showSelf === false && m.self));
    if (cfg.hideIdle) list = list.filter((m) => m.speaking || anim('d:' + m.id).open > 0.05);
    list = list.slice(0, cfg.maxVisible || 12);
    const L = layoutRow(list.length, cfg, W, H, 230);
    list.forEach((m, i) => {
      const a = anim('d:' + m.id); a.talking = !!m.speaking && !m.mute; a.update(dt, t);
      const av = avatars[m.id] || m.demoAvatar || { ...Puppet.defaultAvatar(), kind: 'discord', photoSplit: 0.6, clothColor: '#5865f2', accentColor: '#ffffff' };
      Puppet.draw(ctx, av, a.state(t), {
        x: L.x0 + i * L.gap, y: L.y, scale: L.s,
        name: cfg.showNames !== false ? (av.name && avatars[m.id] && cfg.preferAvatarName ? av.name : m.name) : null,
        muted: m.mute, deaf: m.deaf, glow: cfg.glow && m.speaking,
        discordAvatarUrl: discordAvatarUrl(m),
      });
    });
  }

  function drawTwitch(dt, t, W, H) {
    const cfg = settings.twitch || {};
    if (!cfg.enabled && !DEMO && !TEST) return;
    refreshViewerStyles();
    const now = performance.now() / 1000;
    const idle = (cfg.idleMinutes || 10) * 60;
    for (const v of [...viewers.values()]) if (now - v.lastMsg > idle) viewers.delete(v.login);
    const list = [...viewers.values()];
    const s = cfg.scale || 0.5;
    const gap = 95 * s / 0.5;
    const margin = 20;
    // Viewers fill the bottom edge from the right (or left), wrapping into a second row.
    const fromRight = (cfg.anchor || 'bottom-right') !== 'bottom-left';
    const perRow = Math.max(1, Math.floor((W * (cfg.widthRatio || 0.55)) / gap));
    list.forEach((v, i) => {
      const row = Math.floor(i / perRow), col = i % perRow;
      const tx = fromRight ? W - margin - 50 * s - col * gap - (row % 2) * gap / 2 : margin + 50 * s + col * gap + (row % 2) * gap / 2;
      if (v.x == null) v.x = fromRight ? W + 80 : -80; // walk in from the edge
      v.x += (tx - v.x) * Math.min(1, dt * 4);
      const y = H - margin - 20 * s - row * 150 * s;
      const a = anim('t:' + v.login); a.talking = now < (a.talkUntil || 0); a.update(dt, t);
      const st = a.state(t);
      Puppet.draw(ctx, v.avatar, st, { x: v.x, y, scale: s, flip: !fromRight ? false : true, name: cfg.showNames !== false ? v.display : null, labelColor: cfg.useChatColor ? v.color : null });
      if (v.msg && now < v.msgUntil) {
        const alpha = Math.min(1, (v.msgUntil - now) / 0.5);
        const headTop = y + st.bob * s + (Puppet.HEAD.cy - Puppet.HEAD.ry) * s - (col % 2) * 46 * s;
        Puppet.drawBubble(ctx, v.msg, v.x, headTop, Math.max(0.75, s * 1.4), { alpha, bg: cfg.bubbleBg, fg: cfg.bubbleFg, viewW: W });
      }
    });
  }

  if (DEMO) startDemo(true); else { connect(); if (TEST) startDemo(false); }
  requestAnimationFrame(frame);
})();
