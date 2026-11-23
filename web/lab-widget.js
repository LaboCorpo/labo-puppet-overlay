/*
 * Labo test overlays for OBS (one Browser Source each): lab.html?w=giveaway | poll | queue | counter&id=… | hype | ad | session | emotes
 * Optional: &accent=ffc93c (frame colour), &demo=1 (fake data, to place it in OBS before the stream).
 * Data: the app state (lab.play, lab.tools, settings.lab), chat messages (emote rain) and 'lab-event' events, over SSE.
 */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const W = q.get('w') || 'giveaway';
  const DEMO = q.get('demo') === '1';
  if (/^[0-9a-f]{6}$/i.test(q.get('accent') || '')) document.documentElement.style.setProperty('--ac', '#' + q.get('accent'));
  const t = (s, v) => (window.I18N ? I18N.t(s, v) : s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const root = document.getElementById('root');
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  let st = {}, lastCounter = null, pollShownUntil = 0;

  // ---------- Particles: confetti and emote rain on one canvas ----------
  const cv = document.getElementById('fx'), ctx = cv.getContext('2d');
  const parts = [];
  const imgs = new Map();
  let raf = 0;
  function size() { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; }
  addEventListener('resize', size); size();
  function loop() {
    raf = 0;
    const H = cv.height, Wd = cv.width, d = devicePixelRatio;
    ctx.clearRect(0, 0, Wd, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life--;
      if (p.img && p.y > H - p.s * d / 2 && p.vy > 0) { p.y = H - p.s * d / 2; p.vy *= -0.45; p.vx *= 0.8; if (Math.abs(p.vy) < 1) p.vy = 0; } // emotes bounce on the floor
      if (p.life <= 0 || p.y > H + 100) { parts.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / 40);
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      if (p.img) { if (p.img.complete && p.img.naturalWidth) ctx.drawImage(p.img, -p.s * d / 2, -p.s * d / 2, p.s * d, p.s * d); }
      else { ctx.fillStyle = p.c; ctx.fillRect(-p.s * d / 2, -p.s * d / 4, p.s * d, p.s * d / 2); }
      ctx.restore();
    }
    if (parts.length) raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  function confetti(n) {
    const cols = ['#ffc93c', '#ff4fa3', '#a970ff', '#2fd4a3', '#3d8bff', '#ff7a45'];
    const d = devicePixelRatio;
    for (let i = 0; i < n; i++) parts.push({ x: cv.width / 2, y: cv.height * 0.45, vx: (Math.random() - 0.5) * 22 * d, vy: (-Math.random() * 18 - 6) * d, g: 0.45 * d, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, s: 8 + Math.random() * 8, c: cols[i % cols.length], life: 160 + Math.random() * 80 });
    kick();
  }
  function emote(id) {
    const max = (st.settings && st.settings.lab && st.settings.lab.emotes.max) || 40;
    if (parts.filter((p) => p.img).length >= max) return;
    if (!imgs.has(id)) { const im = new Image(); im.src = `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(id)}/default/dark/3.0`; imgs.set(id, im); if (imgs.size > 300) imgs.delete(imgs.keys().next().value); }
    const d = devicePixelRatio, s = 56 + Math.random() * 40;
    parts.push({ img: imgs.get(id), x: Math.random() * cv.width, y: -s * d, vx: (Math.random() - 0.5) * 4 * d, vy: (2 + Math.random() * 3) * d, g: 0.25 * d, r: (Math.random() - 0.5) * 0.6, vr: (Math.random() - 0.5) * 0.05, s, life: 420 + Math.random() * 120 });
    kick();
  }
  function onChat(m) {
    if (W !== 'emotes' || !m || !m.emotes) return;
    // "id:0-4,6-10/id2:12-16": one emote per range, at most 8 per message.
    let n = 0;
    for (const part of String(m.emotes).split('/')) {
      const [id, ranges] = part.split(':');
      if (!/^[\w-]{1,60}$/.test(id || '')) continue;
      for (let k = 0; k < (ranges || '').split(',').length && n < 8; k++, n++) setTimeout(() => emote(id), n * 120);
    }
  }

  // ---------- Winner roulette ----------
  function winner(name, names) {
    const box = document.getElementById('winner'), el = document.getElementById('winName');
    document.getElementById('winLbl').textContent = '🎉 ' + t('GIVEAWAY');
    box.classList.add('on');
    el.classList.remove('final');
    const pool = (names && names.length ? names : [name]).slice(0, 40);
    let i = 0, delay = 50;
    const spin = () => {
      el.textContent = pool[i++ % pool.length];
      delay *= 1.12;
      if (delay < 420) setTimeout(spin, delay);
      else { el.textContent = name; el.classList.add('final'); document.getElementById('winLbl').textContent = '🏆 ' + t('The winner is'); confetti(160); setTimeout(() => box.classList.remove('on'), 12000); }
    };
    spin();
  }

  // ---------- Widgets ----------
  // Rebuilt only when the content changes (entry animations would replay every second otherwise).
  const view = { set html(h) { if (root._h !== h) { root._h = h; root.innerHTML = h; } } };
  function card(html, hidden) { return `<div class="card${hidden ? ' hide' : ''}">${html}</div>`; }
  function render() {
    const lab = st.lab || {}, play = lab.play || {}, cfg = (st.settings && st.settings.lab) || {};
    const now = Date.now();
    switch (W) {
      case 'giveaway': {
        const g = play.giveaway || {};
        view.html = card(`<div class="head">🎉 ${esc(t('GIVEAWAY'))}<span class="tag">${esc(t('{n} in', { n: g.count || 0 }))}</span></div>
          <div class="sub">${g.open ? esc(t('Type !{kw} in the chat to enter', { kw: g.keyword || 'join' })) : g.winner ? esc(t('Winner: {name}', { name: g.winner.display })) : esc(t('Closed'))}</div>
          <div class="chips">${(g.recent || []).map((n) => `<span class="chip">${esc(n)}</span>`).join('')}</div>`, !g.open && !(g.winner && now - g.winner.at < 60000));
        break;
      }
      case 'poll': {
        const p = play.poll;
        if (!p) { view.html = card('', true); break; }
        if (!p.open && !pollShownUntil) pollShownUntil = now + 20000;
        if (p.open) pollShownUntil = 0;
        const total = p.options.reduce((a, o) => a + o.votes, 0);
        const left = Math.max(0, p.endsAt - now);
        view.html = card(`<div class="head">📊 ${esc(p.question)}<span class="tag">${p.open ? mmss(left) : esc(t('Result'))}</span></div>
          ${p.options.map((o, i) => { const pc = total ? Math.round((o.votes / total) * 100) : 0; return `<div class="opt${!p.open && p.winner === i ? ' win' : ''}"><div class="bar" style="width:${pc}%"></div><div class="txt"><span class="n">${i + 1}</span><span>${esc(o.text)}</span><span class="p">${pc} %</span></div></div>`; }).join('')}
          <div class="sub">${p.open ? esc(t('Type the number in the chat · {n} votes', { n: total })) : esc(t('{n} votes', { n: total }))}</div>
          ${p.open ? `<div class="timer"><i style="width:${(left / (p.seconds * 1000)) * 100}%"></i></div>` : ''}`, !p.open && now > pollShownUntil);
        break;
      }
      case 'queue': {
        const qu = play.queue || { list: [] };
        const list = qu.list || [];
        view.html = card(`<div class="head">🎮 ${esc(t('Queue'))}<span class="tag">!${esc((cfg.queue && cfg.queue.joinCmd) || 'play')}</span></div>
          ${list.length ? list.slice(0, 8).map((x, i) => `<div class="q${i ? '' : ' first'}"><b>${i + 1}</b>${esc(x.display)}${x.sub ? ' ⭐' : ''}</div>`).join('') + (list.length > 8 ? `<div class="sub">+${list.length - 8}</div>` : '') : `<div class="empty">${esc(qu.open === false ? t('The queue is closed') : t('Empty: type !{cmd} to join', { cmd: (cfg.queue && cfg.queue.joinCmd) || 'play' }))}</div>`}`, cfg.queue && !cfg.queue.enabled);
        break;
      }
      case 'counter': {
        const id = q.get('id') || '';
        const c = (cfg.counters || []).find((x) => x.id === id || x.cmd === id) || (cfg.counters || [])[0];
        if (!c) { view.html = card(`<div class="empty">${esc(t('No counter yet: create one in Labo test.'))}</div>`); break; }
        const bump = lastCounter !== null && lastCounter !== c.value;
        lastCounter = c.value;
        view.html = card(`<div class="counter"><span class="l">${esc(c.name)}</span><span class="v${bump ? ' bump' : ''}">${c.value}</span></div>`);
        break;
      }
      case 'hype': {
        const r = lab.hype || 1, f = (cfg.hype && cfg.hype.factor) || 3;
        const pc = Math.max(4, Math.min(100, ((r - 0.5) / (f - 0.5)) * 100));
        const level = pc >= 100 ? t('ON FIRE 🔥🔥🔥') : pc > 66 ? t('Hot 🔥') : pc > 33 ? t('Warming up') : t('Calm');
        view.html = card(`<div class="head">🔥 ${esc(t('Chat hype'))}<span class="tag">×${r}</span></div><div class="meter${pc >= 100 ? ' hot' : ''}"><i style="width:${pc}%"></i></div><div class="sub">${esc(level)} · ${esc(t('{n} msg/min', { n: lab.perMin || 0 }))}</div>`);
        break;
      }
      case 'ad': {
        const a = (lab.tools && lab.tools.ad) || {};
        const warn = ((cfg.ads && cfg.ads.warnSec) || 60) * 1000;
        const before = a.nextAt ? a.nextAt - now : -1, during = a.nextAt && now >= a.nextAt && now < a.nextAt + (a.duration || 0) * 1000;
        const show = (before > 0 && before <= warn) || during;
        view.html = card(`<div class="head">📺 ${during ? esc(t('Ad break')) : esc(t('Ad break in {t}', { t: mmss(before) }))}</div><div class="sub">${during ? esc(t('Back in {t}, stay with us!', { t: mmss(a.nextAt + a.duration * 1000 - now) })) : esc(t('Grab a drink, we will be right back 💜'))}</div>`, !show);
        break;
      }
      case 'session': {
        const s = play.session || {};
        const live = st.stats && st.stats.live;
        const dur = live ? mmssH(now - Date.parse(live.startedAt)) : s.since ? mmssH(now - s.since) : '—';
        view.html = card(`<div class="head">💜 ${esc(t('Thanks for watching!'))}<span class="tag">${esc(dur)}</span></div><div class="stats">
          <div><b>${s.messages || 0}</b>${esc(t('messages'))}</div><div><b>${s.chatters || 0}</b>${esc(t('chatters'))}</div>
          <div><b>${s.follows || 0}</b>${esc(t('new followers'))}</div><div><b>${(s.subs || 0) + (s.gifts || 0)}</b>${esc(t('subs'))}</div>
          <div><b>${s.bits || 0}</b>${esc(t('bits'))}</div><div><b>${s.raids || 0}</b>${esc(t('raids'))}</div></div>`);
        break;
      }
      default: view.html = '';
    }
  }
  const mmssH = (ms) => { const m = Math.floor(ms / 60000); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };

  function onEvent(e) {
    if (W === 'giveaway' && e.type === 'giveaway-winner') winner(e.name, e.names);
    if (W === 'poll' && e.type === 'poll-end') confetti(60);
    if (W === 'queue' && e.type === 'queue-next') confetti(40);
  }

  // ---------- Data ----------
  function apply(next) {
    st = Object.assign({}, st, next);
    if (next.app && next.app.lang && window.I18N && I18N.setLang(next.app.lang)) I18N.apply(document.body);
    render();
  }
  // Demo: the app's language if it answers (the preview button), English otherwise.
  if (DEMO) fetch('/api/state').then((r) => r.json()).then((s) => { if (s.app && s.app.lang && window.I18N) I18N.setLang(s.app.lang); }).catch(() => {}).then(demo);
  else {
    const es = new EventSource('/api/events');
    es.addEventListener('state', (e) => apply(JSON.parse(e.data)));
    es.addEventListener('chat', (e) => onChat(JSON.parse(e.data)));
    es.addEventListener('lab-event', (e) => onEvent(JSON.parse(e.data)));
  }
  // Countdowns move on their own.
  if (['poll', 'ad', 'session', 'giveaway'].includes(W)) setInterval(render, 1000);
  if (W === 'emotes') root.style.display = 'none';

  function demo() {
    const names = ['Civibrr', 'trkzlive', 'Pixelcat', 'MamieGaming', 'kiwi', 'ZeroCool', 'tartiflette', 'Bobby_42'];
    const now = Date.now();
    apply({
      settings: { lab: { queue: { enabled: true, joinCmd: 'play' }, hype: { factor: 3 }, ads: { warnSec: 60 }, emotes: { max: 40 }, counters: [{ id: 'demo', name: t('Deaths'), cmd: 'death', value: 12 }] } },
      lab: { hype: 2.4, perMin: 38, tools: { ad: { nextAt: now + 45000, duration: 90 } },
        play: { giveaway: { open: true, keyword: 'join', count: 27, recent: names.slice(0, 6) }, queue: { open: true, list: names.slice(0, 5).map((d, i) => ({ display: d, sub: i === 1 })) },
          poll: { question: t('Which game next?'), options: [{ text: 'Valorant', votes: 12 }, { text: 'Minecraft', votes: 21 }, { text: 'Mario Kart', votes: 7 }], open: true, endsAt: now + 42000, seconds: 60, winner: -1 },
          session: { messages: 1284, chatters: 96, follows: 23, subs: 7, gifts: 5, bits: 1500, raids: 2, since: now - 3 * 3600000 - 1200000 } } },
    });
    if (W === 'giveaway') setTimeout(() => winner('Pixelcat', names), 1500);
    if (W === 'emotes') setInterval(() => onChat({ emotes: ['25:0-4', '1902:0-4,6-10', '354:0-4'][Math.floor(Math.random() * 3)] }), 400);
  }
})();
