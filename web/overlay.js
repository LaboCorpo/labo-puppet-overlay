/*
 * Overlay scene: Discord voice puppets + Twitch viewer crowd.
 * The same page runs in the desktop overlay window and in OBS/Streamlabs (Browser Source).
 * URL params:
 *   scene=all|discord|twitch   which groups to draw
 *   host=desktop               enables placement mode and app-side chat sound (desktop overlay window)
 *   test=1                     live settings + fake members/chat when there is nothing real (panel preview)
 *   demo=1                     fully offline demo, no server (demo extras: fx=<entrance>, exit=<exit>, layout=vertical)
 */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const SCENE = params.get('scene') || 'all';
  const DEMO = params.get('demo') === '1';
  const TEST = params.get('test') === '1';
  const DESKTOP = params.get('host') === 'desktop';
  const IDLE_POLL_MS = 1000; // nothing on screen: re-check rarely; server events wake the loop at once
  const t = I18N.t;
  const canvas = document.getElementById('c');
  const hint = document.getElementById('hint');

  const scene = {
    canvas, ctx: canvas.getContext('2d'), W: innerWidth, H: innerHeight, t,
    settings: null, placement: false,
    perfMode: () => (scene.settings && scene.settings.app && scene.settings.app.performance) || 'normal',
    useFake: () => TEST || DEMO || scene.placement,
    saveSettings: (patch) => post('/api/settings', patch),
    finishPlacement: () => post('/api/action', { name: 'placement', on: false }),
    wake: () => wake(),
  };
  const fx = OverlayFx(scene);
  const discord = DiscordGroup(scene, fx);
  const twitch = TwitchCrowd(scene, fx);
  const placement = DESKTOP ? Placement(scene, discord, twitch, SCENE) : null;

  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
  }

  // ---------- Canvas sizing ----------
  // Eco renders at 1x pixel density, Normal caps at 2x, Performance uses the screen's full density.
  function resize() {
    scene.W = innerWidth; scene.H = innerHeight;
    const raw = window.devicePixelRatio || 1;
    const mode = scene.perfMode();
    const dpr = mode === 'eco' ? Math.min(raw, 1) : mode === 'normal' ? Math.min(raw, 2) : raw;
    canvas.width = Math.round(scene.W * dpr);
    canvas.height = Math.round(scene.H * dpr);
    scene.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wasEmpty = false;
    wake();
  }
  addEventListener('resize', resize);

  // ---------- Chat sounds ----------
  // Exactly one page plays them: the desktop overlay (output 'app') or the OBS source (output 'obs').
  const sound = new ChatSound();
  function configureSound() {
    const tw = scene.settings.twitch || {};
    const snd = Object.assign({}, tw.sound || {});
    const here = tw.enabled && !TEST && !DEMO && ((snd.output || 'app') === 'app' ? DESKTOP : !DESKTOP);
    if (!here) snd.mode = 'none';
    snd.namePattern = t('{name} says: ');
    sound.configure(snd);
  }

  // ---------- Events ----------
  let lastRealChat = 0;
  function onChat(m) {
    if (!scene.settings) return;
    const speak = !m.fake && !m.system && m.text && sound.enabled();
    if (speak) {
      sound.say({
        login: m.login, display: m.display, text: m.text,
        onStart: (sec) => twitch.talkFor(m.login, sec),
        onEnd: () => twitch.talkFor(m.login, 0),
      });
    }
    if (SCENE === 'discord') return;
    if (!m.fake) lastRealChat = performance.now();
    twitch.onChat(m, speak);
    wake();
  }
  function onTwitchEvent(e) {
    if (!scene.settings || SCENE === 'discord') return;
    twitch.onEvent(e);
    wake();
  }

  function applyState(s) {
    if (s.settings) {
      const prev = scene.settings;
      scene.settings = s.settings;
      if (prev && prev.app && s.settings.app && prev.app.performance !== s.settings.app.performance) resize();
      if (!prev || twitch.styleKey(prev.twitch) !== twitch.styleKey(s.settings.twitch)) twitch.restyleAll();
      configureSound();
    }
    if (s.avatars) discord.setAvatars(s.avatars);
    if (s.viewers) twitch.setOverrides(s.viewers);
    if (s.discord) discord.setMembers(s.discord.members);
    if (s.app && s.app.lang) I18N.setLang(s.app.lang);
    scene.placement = DESKTOP && !!(s.app && s.app.placement);
    document.body.classList.toggle('placing', scene.placement);
    wake();
  }

  function connect() {
    const es = new EventSource('/api/events');
    const on = (name, fn) => es.addEventListener(name, (e) => { try { fn(JSON.parse(e.data)); } catch (err) { console.error(err); } });
    on('state', applyState);
    on('speaking', (d) => { discord.setSpeaking(d.id, d.speaking); wake(); });
    on('chat', onChat);
    on('twitch-event', onTwitchEvent);
    on('viewer', (d) => twitch.setOverride(d.login, d.override));
    on('viewers-reset', () => twitch.setOverrides({}));
    on('fx-test', () => { discord.replay(); wake(); });
    es.onerror = () => { if (!DESKTOP) return; hint.style.display = 'block'; hint.textContent = t('Puppet Overlay app not reachable — retrying…'); };
    es.onopen = () => { hint.style.display = 'none'; };
  }

  // ---------- Fake data (demo / panel preview) ----------
  const FAKE_NAMES = ['pixelcat', 'Bobby_42', 'xXnoobXx', 'MamieGaming', 'kiwi', 'ZeroCool', 'tartiflette'];
  const FAKE_MSGS = ['hi everyone!', 'GG', 'the head flap is killing me 😂', 'first', 'what are we playing tonight?', 'lol', 'more please!!'];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function fakeChatLoop() {
    setInterval(() => {
      if (performance.now() - lastRealChat < 15000) return;
      const n = pick(FAKE_NAMES);
      if (Math.random() < 0.15) onTwitchEvent({ type: 'action', action: pick(['jump', 'dance', 'wave']), login: n.toLowerCase(), display: n });
      else onChat({ login: n.toLowerCase(), display: n, text: pick(FAKE_MSGS), fake: true });
    }, 1800);
  }
  function startDemo() {
    scene.settings = {
      app: { performance: 'normal' },
      overlay: { enabled: true, anchor: 'bottom-left', scale: 0.8, spacing: 120, margin: 30, showNames: true, entrance: params.get('fx') || 'random', exit: params.get('exit') || params.get('fx') || 'random', statusStyle: 'props', sleepMinutes: 0.3, lookAtSpeaker: true, maxVisible: 12, layout: params.get('layout') || 'horizontal' },
      twitch: { enabled: true, scale: 0.5, maxViewers: 20, bubbleSeconds: 7, idleMinutes: 10, palette: 'vivid', hats: true, beards: true, showNames: true, anchor: 'bottom-right', widthRatio: 0.55, raidEffects: true, raidMax: 15, subEffects: true, bitsEffects: true, layout: params.get('layout') || 'horizontal', bubbleBg: '#ffffff', bubbleFg: '#1d1a1f' },
    };
    fakeChatLoop();
    setTimeout(() => onTwitchEvent({ type: 'sub', login: 'kiwi', display: 'kiwi', text: 'Thanks for the sub!' }), 4000);
  }

  // ---------- Render loop ----------
  // Frame cap: Performance = display rate, Normal = 60 fps, Eco and the panel preview = 30 fps.
  // When nothing is on screen the canvas is cleared once and the loop sleeps until an event wakes it.
  let last = performance.now(), lastDraw = 0, wasEmpty = false, sleeping = false, idleTimer = 0, errorLogged = false;
  function wake() {
    if (!sleeping) return;
    sleeping = false;
    clearTimeout(idleTimer);
    requestAnimationFrame(frame);
  }
  function frame(now) {
    const mode = scene.perfMode();
    const cap = mode === 'eco' || TEST ? 30 : mode === 'normal' ? 60 : 0; // the panel preview is small: 30 fps is enough
    if (cap && now - lastDraw < 1000 / cap - 2) { requestAnimationFrame(frame); return; }
    lastDraw = now;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    let empty = true;
    try { empty = render(dt, now / 1000); } catch (e) {
      // Never let one bad frame stop the loop.
      if (!errorLogged) { errorLogged = true; console.error(e); }
    }
    wasEmpty = empty;
    if (empty) { sleeping = true; idleTimer = setTimeout(wake, IDLE_POLL_MS); } else requestAnimationFrame(frame);
  }
  function render(dt, time) {
    const s = scene.settings;
    if (!s) return true;
    const ctx = scene.ctx;
    const showDiscord = SCENE !== 'twitch' && (s.overlay.enabled !== false || scene.placement || !DESKTOP);
    const showTwitch = SCENE !== 'discord' && (s.twitch.enabled || DEMO || TEST);
    if (showDiscord) discord.update(dt, time);
    if (showTwitch) twitch.update(dt, time);
    const empty = !scene.placement && (!showDiscord || !discord.size) && (!showTwitch || !twitch.size) && !fx.particles.length;
    if (empty && wasEmpty) return true;
    ctx.clearRect(0, 0, scene.W, scene.H);
    if (scene.placement && placement) placement.draw();
    if (showDiscord) discord.draw(time);
    if (showTwitch) twitch.draw(time);
    fx.drawParticles(dt, time);
    return empty;
  }

  // Debug hook (DevTools console): replay exits/entrances.
  window.puppetFxTest = () => { discord.replay(); wake(); };

  resize();
  if (DEMO) startDemo();
  else { connect(); if (TEST) fakeChatLoop(); }
  requestAnimationFrame(frame);
})();
