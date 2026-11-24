/*
 * Hub Labo → My stream: your live (banner with the category box art), title & category with presets,
 * giveaway and chat poll (OBS overlays in lab.html), stream health (OBS) with alerts, ad warning,
 * Discord "I'm live", stream summary and the checklist. Also draws the live strip shown on every Hub Labo page
 * (you and the crew, with the box art of the game) and binds the OBS connection blocks (.obs-connect).
 * Lists are edited here and saved whole (settings arrays are replaced, not merged).
 */
(function () {
  'use strict';
  const { $, $$, t, escapeHtml: esc, toast } = Panel;
  const ORIGIN = location.origin.replace('127.0.0.1', 'localhost');
  const S = () => Panel.state.settings.lab;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const keys = {};
  // Re-renders a list only when its data changed and nobody is typing in it.
  function list(el, key, html) { if (keys[el.id] === key || el.contains(document.activeElement)) return; keys[el.id] = key; el.innerHTML = html(); }
  function saveList(path, fn) { const cur = clone(path.split('.').reduce((o, k) => o[k], Panel.state.settings)); fn(cur); Panel.save(path, cur); return cur; }
  const dur = (iso) => {
    const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    return min < 60 ? t('{n} min', { n: min }) : t('{h} h {m} min', { h: Math.floor(min / 60), m: min % 60 });
  };
  const box = (url, w, h) => (url ? `<img class="boxart" src="${esc(url)}" width="${w}" height="${h}" alt="" referrerpolicy="no-referrer">` : `<span class="boxart none" style="width:${w}px;height:${h}px">🎮</span>`);

  // ---------- OBS links of the overlays (giveaway, poll, ad countdown) ----------
  let textLang = '';
  function staticTexts() { // built here (not in the HTML) so they follow the language
    if (textLang === I18N.lang) return;
    textLang = I18N.lang;
    for (const el of $$('.lab-link')) {
      const url = `${ORIGIN}/lab.html?w=${el.dataset.w}`;
      el.innerHTML = `<div class="row lab-url"><code title="${esc(url)}">${esc(url)}</code><button class="small" data-copy="${esc(url)}">${esc(t('Copy'))}</button><button class="ghost small" data-preview="lab.html?w=${el.dataset.w}&demo=1">${esc(t('Preview'))}</button></div>`;
    }
    $$('#lpOpts input').forEach((x) => (x.placeholder = t('Answer {n}', { n: x.dataset.o })));
  }
  document.addEventListener('click', (e) => {
    const c = e.target.closest('.lab-link [data-copy]');
    if (c) navigator.clipboard.writeText(c.dataset.copy).then(() => toast(t('Copied: add it as a Browser Source in OBS')));
    const p = e.target.closest('[data-preview]');
    if (p) Panel.action('open-url-local', { path: p.dataset.preview });
  });

  // ---------- Live banner (this page) and live strip (every Hub Labo page) ----------
  function renderLive(st) {
    const live = st.stats && st.stats.live;
    const acc = st.twitchAccount || {};
    const el = $('#myLive');
    let html;
    if (acc.status !== 'connected') html = `<div class="card my-off"><span>${esc(t('Log in with Twitch to see your live here.'))}</span><button class="small" data-goto="stream">${esc(t('Twitch account →'))}</button></div>`;
    else if (!live) html = `<div class="card my-off"><span class="dot-off"></span><b>${esc(t('You are not live'))}</b><span class="muted">${esc(t('Your title and category are ready below.'))}</span></div>`;
    else html = `<div class="my-banner">${box(live.box, 72, 96)}<div class="my-txt"><span class="live-badge">● ${esc(t('LIVE'))}</span>
        <b class="my-title">${esc(live.title || '')}</b><span class="my-game">${esc(live.game || t('No category'))}</span>
        <span class="muted">${esc(t('{n} viewers', { n: live.viewers || 0 }))} · ${esc(dur(live.startedAt))}</span></div></div>`;
    if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
  }
  // Live strip: one chip per live (you first), with the category box art.
  function renderStrip(st) {
    const strip = $('#liveStrip');
    const lives = [];
    const me = st.stats && st.stats.live, acc = st.twitchAccount || {};
    if (me) lives.push({ me: true, name: acc.display || acc.login || t('You'), game: me.game, box: me.box, viewers: me.viewers, startedAt: me.startedAt, title: me.title });
    for (const m of (st.hub && st.hub.list) || []) if (m.live && !m.me) lives.push({ name: m.display, login: m.login, game: m.game, box: m.box, viewers: m.viewers, startedAt: m.startedAt, title: m.title });
    const show = Panel.group === 'hub' && lives.length > 0;
    strip.classList.toggle('hidden', !show);
    if (!show) return;
    const html = lives.map((l) => `<button class="ls-chip${l.me ? ' me' : ''}" ${l.login ? `data-watch="${esc(l.login)}"` : 'data-goto="mystream"'} title="${esc(l.title || '')}">
      ${box(l.box, 30, 40)}<span class="ls-txt"><b>${esc(l.name)}${l.me ? ` <i>${esc(t('you'))}</i>` : ''}</b><span>${esc(l.game || t('No category'))}</span></span>
      <span class="ls-meta"><span class="live-dot"></span>${esc(String(l.viewers || 0))}</span></button>`).join('');
    if (strip.dataset.html !== html) { strip.dataset.html = html; strip.innerHTML = `<span class="ls-head">● ${esc(t('Live now'))}</span>${html}`; }
  }
  // A box art that does not load (no Internet, unknown game): the controller icon instead.
  document.addEventListener('error', (e) => {
    const im = e.target;
    if (!im || im.tagName !== 'IMG' || !im.classList.contains('boxart')) return;
    const ph = document.createElement('span');
    ph.className = 'boxart none'; ph.textContent = '🎮';
    ph.style.width = im.getAttribute('width') + 'px'; ph.style.height = im.getAttribute('height') + 'px';
    im.replaceWith(ph);
  }, true);
  $('#liveStrip').addEventListener('click', (e) => {
    const b = e.target.closest('[data-watch]');
    if (b) { Panel.showTab('hub'); const card = document.querySelector(`.hub-card[data-login="${b.dataset.watch}"]`); if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });

  // ---------- Title & category ----------
  let game = { id: '', name: '' }, searchTimer = 0;
  async function loadInfo() {
    const r = await Panel.action('lab-info');
    if (!r || !r.ok || !r.info) { $('#ltTitle').placeholder = t('Log in with Twitch to read your title'); return; }
    $('#ltTitle').value = r.info.title; $('#ltGame').value = r.info.gameName; game = { id: r.info.gameId, name: r.info.gameName };
  }
  $('#ltReload').onclick = loadInfo;
  $('#ltGame').addEventListener('input', () => {
    clearTimeout(searchTimer);
    const qv = $('#ltGame').value.trim();
    if (!qv) { $('#ltGames').innerHTML = ''; return; }
    searchTimer = setTimeout(async () => {
      const r = await Panel.action('lab-games', { query: qv });
      $('#ltGames').innerHTML = r && r.ok ? r.games.map((g) => `<button class="ghost small lt-game" data-gid="${esc(g.id)}" data-gname="${esc(g.name)}">${g.box ? `<img src="${esc(g.box.replace('{width}', '26').replace('{height}', '36'))}" alt="">` : ''}${esc(g.name)}</button>`).join('') : '';
    }, 350);
  });
  $('#ltGames').addEventListener('click', (e) => { const b = e.target.closest('[data-gid]'); if (!b) return; game = { id: b.dataset.gid, name: b.dataset.gname }; $('#ltGame').value = game.name; $('#ltGames').innerHTML = ''; });
  $('#ltApply').onclick = () => Panel.run('lab-info-set', { title: $('#ltTitle').value, gameId: $('#ltGame').value.trim() === game.name ? game.id : '' }, 'Updated on Twitch');
  $('#ltSavePreset').onclick = () => {
    const name = $('#ltPresetName').value.trim();
    if (!name) { toast(t('Give the preset a name')); return; }
    saveList('lab.profiles', (l) => { const i = l.findIndex((x) => x.name === name); const p = { name, title: $('#ltTitle').value.trim(), gameId: $('#ltGame').value.trim() === game.name ? game.id : '', gameName: game.name }; if (i >= 0) l[i] = p; else l.push(p); });
    $('#ltPresetName').value = ''; keys.ltProfiles = ''; toast(t('Preset saved'));
  };
  function renderProfiles(s) {
    list($('#ltProfiles'), JSON.stringify([s.profiles, I18N.lang]), () => (s.profiles.length ? s.profiles.map((p, i) => `<div class="lc-row" data-i="${i}"><b>${esc(p.name)}</b><span class="muted lc-grow">${esc(p.title)}${p.gameName ? ' · ' + esc(p.gameName) : ''}</span><button class="small" data-apply="${esc(p.name)}">${esc(t('Apply'))}</button><button class="ghost small danger-text" data-del>✕</button></div>`).join('') : `<p class="muted">${esc(t('No preset yet.'))}</p>`));
  }
  $('#ltProfiles').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-apply]');
    if (b && (await Panel.run('lab-profile', { name: b.dataset.apply }, 'Updated on Twitch'))) loadInfo();
    if (e.target.closest('[data-del]')) { const i = +e.target.closest('[data-i]').dataset.i; saveList('lab.profiles', (l) => l.splice(i, 1)); keys.ltProfiles = ''; }
  });

  // ---------- Giveaway ----------
  $$('[data-gw]').forEach((b) => (b.onclick = async () => {
    const r = await Panel.run('lab-giveaway', { op: b.dataset.gw });
    if (r && b.dataset.gw === 'draw' && r.winner) toast(t('Winner: {name}', { name: r.winner.display }));
  }));
  function renderGiveaway(p, s) {
    const g = p.giveaway;
    $('#lgStatus').innerHTML = (g.open ? `<b class="ok">● ${esc(t('Entries open'))}</b> — ${esc(t('viewers type !{kw}', { kw: s.giveaway.keyword }))}` : esc(t('Closed')))
      + ` · ${esc(t('{n} entries', { n: g.count }))}` + (g.winner ? ` · 🏆 <b>${esc(g.winner.display)}</b>` : '');
    list($('#lgEntries'), JSON.stringify(g.entries), () => g.entries.map((n) => `<span class="chip">${esc(n)}</span>`).join(''));
  }

  // ---------- Poll ----------
  $('#lpOpts').innerHTML = [1, 2, 3, 4, 5, 6].map((i) => `<input data-o="${i}" maxlength="60">`).join('');
  $('#lpStart').onclick = () => Panel.run('lab-poll', { op: 'start', question: $('#lpQ').value, options: $$('#lpOpts input').map((x) => x.value), seconds: S().poll.seconds }, 'Poll started');
  $('#lpEnd').onclick = () => Panel.run('lab-poll', { op: 'end' });
  $('#lpClear').onclick = () => Panel.run('lab-poll', { op: 'clear' });
  function renderPoll(p) {
    const po = p.poll;
    if (!po) { $('#lpRes').innerHTML = ''; return; }
    const total = po.options.reduce((a, o) => a + o.votes, 0);
    $('#lpRes').innerHTML = `<div class="muted">${po.open ? '● ' + esc(t('Running')) : esc(t('Finished'))} · ${esc(po.question)} · ${esc(t('{n} votes', { n: total }))}</div>`
      + po.options.map((o, i) => { const pc = total ? Math.round((o.votes / total) * 100) : 0; return `<div class="lp-bar${po.winner === i && !po.open ? ' win' : ''}"><i style="width:${pc}%"></i><span>${i + 1}. ${esc(o.text)}</span><b>${o.votes} · ${pc} %</b></div>`; }).join('');
  }

  // ---------- Stream health + OBS connection blocks ----------
  document.addEventListener('click', async (e) => {
    const save = e.target.closest('.obs-pw-save');
    if (save) {
      const input = save.closest('.obs-connect').querySelector('.obs-pw');
      await Panel.run('obs-password', { password: input.value }, 'Password saved');
      input.value = '';
    }
    if (e.target.closest('.obs-retry')) Panel.run('obs-reconnect');
  });
  const OBS_STATUS = { off: 'Off', connecting: 'Connecting…', connected: 'Connected', error: 'Not connected', auth: 'Wrong password' };
  let healthKey = '';
  function renderObs(s) {
    const o = s.obs || { status: 'off' };
    $$('.obs-status').forEach((el) => { el.textContent = t(OBS_STATUS[o.status] || o.status) + (o.detail ? ' — ' + t(o.detail) : ''); el.dataset.st = o.status; });
    $$('.obs-pw-state').forEach((el) => { el.textContent = o.hasPassword ? t('A password is saved (encrypted).') : t('No password saved.'); });
    const det = $('.obs-details');
    if (det && !det.dataset.auto && o.status !== 'connected') { det.open = true; det.dataset.auto = '1'; }
    const st = o.stats;
    const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
    const html = o.status !== 'connected' || !st ? `<p class="muted">${esc(t('Connect OBS to see the stream health.'))}</p>` : [
      [t('Live'), o.streaming ? '🔴 ' + t('on air') + (st.duration ? ' · ' + st.duration.split('.')[0] : '') : '—', o.streaming ? 'good' : ''],
      [t('Recording'), o.recording ? '⏺ ' + t('on') : '—', ''],
      ['FPS', st.fps, st.fps >= 55 ? 'good' : st.fps >= 28 ? 'warn' : 'bad'],
      ['CPU (OBS)', st.cpu + ' %', st.cpu < 50 ? 'good' : st.cpu < 80 ? 'warn' : 'bad'],
      [t('Frames dropped (network)'), pct(st.outputSkipped, st.outputTotal) + ' %', pct(st.outputSkipped, st.outputTotal) < 1 ? 'good' : pct(st.outputSkipped, st.outputTotal) < 5 ? 'warn' : 'bad'],
      [t('Frames lagged (render)'), pct(st.renderSkipped, st.renderTotal) + ' %', pct(st.renderSkipped, st.renderTotal) < 1 ? 'good' : 'warn'],
      [t('Network congestion'), st.congestion + ' %', st.congestion < 10 ? 'good' : st.congestion < 40 ? 'warn' : 'bad'],
      [t('Current scene'), o.current || '—', ''],
    ].map(([k, v, c]) => `<div class="hl ${c}"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('');
    if (html !== healthKey) { healthKey = html; $('#obsHealth').innerHTML = html; }
  }

  // ---------- Ads, Discord, summary ----------
  $('#ltSnooze').onclick = () => Panel.run('lab-ad-snooze', null, 'Ad pushed back 5 minutes');
  $('#ltAdRefresh').onclick = () => Panel.run('lab-ad-refresh');
  $('#ltHookSave').onclick = async () => { if (await Panel.run('lab-webhook', { url: $('#ltHook').value }, 'Saved')) $('#ltHook').value = ''; };
  $('#ltHookTest').onclick = () => Panel.run('lab-webhook-test', null, 'Test sent: look in your Discord');
  $('#ltCopySummary').onclick = async () => { const r = await Panel.run('lab-summary'); if (r) navigator.clipboard.writeText(r.text).then(() => toast(t('Copied'))); };
  const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function renderTools(l, s) {
    const tools = l.tools || {}, a = tools.ad;
    const live = Panel.state.stats && Panel.state.stats.live;
    $('#ltAd').textContent = !s.ads.enabled ? '' : !live ? t('Works while you are live.') : !a ? t('Checking…') : a.error ? t(a.error)
      : (a.nextAt ? t('Next ad in {t} ({d} s)', { t: mmss(a.nextAt - Date.now()), d: a.duration }) : t('No ad scheduled')) + ' · ' + t('{n} snoozes left', { n: a.snoozes });
    $('#ltHookState').textContent = tools.hasWebhook ? '✓ ' + t('Webhook saved (encrypted)') : t('No webhook yet');
    const ss = (l.play || {}).session;
    if (ss) $('#ltSession').textContent = [`💬 ${ss.messages} ${t('messages')} · ${ss.chatters} ${t('chatters')} · ${ss.firsts} ${t('first-timers')}`, `❤ ${ss.follows} ${t('new followers')} · ⭐ ${ss.subs + ss.gifts} ${t('subs')} · 💎 ${ss.bits} ${t('bits')}`, `🚀 ${ss.raids} ${t('raids')} · 👀 ${t('Viewer peak: {n}', { n: ss.peak })} · 🔊 ${ss.sounds}`].join('\n');
  }

  // ---------- Checklist (ticks per day, in this window) ----------
  const dayKey = () => 'labCheck:' + new Date().toISOString().slice(0, 10);
  const ticks = () => { try { return JSON.parse(localStorage.getItem(dayKey())) || []; } catch (e) { return []; } };
  function renderChecklist(s) {
    const done = ticks();
    list($('#ltCheck'), JSON.stringify([s.checklist, done]), () => s.checklist.map((x, i) => `<label class="check"><input type="checkbox" data-ck="${i}"${done.includes(x) ? ' checked' : ''}> ${esc(x)}</label>`).join('') + `<p class="muted">${done.filter((x) => s.checklist.includes(x)).length} / ${s.checklist.length}</p>`);
    if (document.activeElement !== $('#ltCheckEdit')) $('#ltCheckEdit').value = s.checklist.join('\n');
  }
  $('#ltCheck').addEventListener('change', (e) => {
    const i = e.target.dataset.ck;
    if (i == null) return;
    const item = S().checklist[+i], d = new Set(ticks());
    if (e.target.checked) d.add(item); else d.delete(item);
    try { localStorage.setItem(dayKey(), JSON.stringify([...d])); } catch (x) { /* storage disabled */ }
    keys.ltCheck = '';
    renderChecklist(S());
  });
  $('#ltCheckSave').onclick = () => { Panel.save('lab.checklist', $('#ltCheckEdit').value.split('\n').map((x) => x.trim()).filter(Boolean)); keys.ltCheck = ''; toast(t('Saved')); };

  // ---------- Twitch account notice (My stream and Baba Bot pages) ----------
  function renderAccount(st) {
    const a = st.twitchAccount || {};
    const missing = (a.missingScopes || []).length;
    const msg = a.status !== 'connected' ? t('Log in with Twitch so the bot can answer in your chat (and to read your ads, title and category).') : missing ? t('Log in to Twitch again once to allow the new permissions (ads, shoutouts).') : '';
    for (const el of $$('.lab-acct')) {
      el.classList.toggle('hidden', !msg);
      if (!msg || el.dataset.msg === msg) continue;
      el.dataset.msg = msg;
      el.innerHTML = `<span>${esc(msg)}</span><button class="small">${esc(t('Twitch account →'))}</button>`;
      el.querySelector('button').onclick = () => Panel.showTab('stream');
    }
  }

  // ---------- State ----------
  Panel.onState((st) => {
    if (!st.settings) return;
    staticTexts();
    renderAccount(st);
    renderObs(st);
    renderStrip(st);
    if (!st.lab) return;
    const s = st.settings.lab, p = st.lab.play;
    renderLive(st);
    renderProfiles(s); renderChecklist(s);
    if (p) { renderGiveaway(p, s); renderPoll(p); }
    renderTools(st.lab, s);
  });
  Panel.onTab((name) => {
    if (name === 'mystream' && Panel.state.settings && !$('#ltTitle').value) loadInfo();
    if (Panel.state.settings) renderStrip(Panel.state);
  });
  setInterval(() => { if (Panel.tab === 'mystream' && Panel.state.lab) { renderTools(Panel.state.lab, S()); renderLive(Panel.state); } }, 1000);
})();
