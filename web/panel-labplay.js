/*
 * Labo test v2 pages in the panel: Chat bot (commands, timers, sound commands), Viewer games (giveaway, poll,
 * counters, queue, emote rain, hype, end screen) and Streamer tools (title & category, ads, Discord go-live,
 * summary, checklist). Lists are edited here and saved whole (settings arrays are replaced, not merged).
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
  const rid = () => 'c' + Math.random().toString(36).slice(2, 9).replace(/[^a-z0-9]/g, 'x');

  // ---------- OBS links of the overlays ----------
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
    const c = e.target.closest('[data-copy]');
    if (c && c.closest('.lab-link, #lcCounters')) navigator.clipboard.writeText(c.dataset.copy).then(() => toast(t('Copied: add it as a Browser Source in OBS')));
    const p = e.target.closest('[data-preview]');
    if (p) Panel.action('open-url-local', { path: p.dataset.preview });
  });

  // ---------- Chat bot: commands ----------
  function renderCmds(s) {
    const cmds = s.chatbot.commands;
    list($('#lcCmds'), JSON.stringify([cmds, I18N.lang]), () => (cmds.length ? cmds.map((c, i) => `<div class="lc-row" data-i="${i}">
      <span class="lc-bang">!</span><input class="lc-name" data-f="name" maxlength="25" value="${esc(c.name)}">
      <input class="lc-grow" data-f="reply" maxlength="400" value="${esc(c.reply)}" placeholder="${esc(t('Answer'))}">
      <label class="inline" title="${esc(t('Seconds before it answers again'))}">⏱<input type="number" class="lc-num" data-f="cooldown" min="0" max="3600" value="${c.cooldown}"></label>
      <label class="check inline"><input type="checkbox" data-f="modOnly"${c.modOnly ? ' checked' : ''}> ${esc(t('mods'))}</label>
      <button class="ghost small danger-text" data-del>✕</button></div>`).join('') : `<p class="muted">${esc(t('No command yet.'))}</p>`));
  }
  function bindRows(el, path, numFields) {
    el.addEventListener('change', (e) => {
      const row = e.target.closest('[data-i]');
      if (!row || !e.target.dataset.f) return;
      const f = e.target.dataset.f, i = +row.dataset.i;
      saveList(path, (l) => { l[i][f] = e.target.type === 'checkbox' ? e.target.checked : numFields.includes(f) ? Number(e.target.value) : e.target.value; });
      keys[el.id] = '';
    });
    el.addEventListener('click', (e) => {
      if (!e.target.closest('[data-del]')) return;
      const i = +e.target.closest('[data-i]').dataset.i;
      saveList(path, (l) => l.splice(i, 1));
      keys[el.id] = '';
    });
  }
  bindRows($('#lcCmds'), 'lab.chatbot.commands', ['cooldown']);
  $('#lcAddCmd').onclick = () => { saveList('lab.chatbot.commands', (l) => l.push({ name: 'cmd' + (l.length + 1), reply: t('Hello {name}!'), cooldown: 30, modOnly: false })); keys.lcCmds = ''; };

  // ---------- Chat bot: timers ----------
  function renderTimers(s) {
    const tm = s.chatbot.timers;
    list($('#lcTimers'), JSON.stringify([tm, I18N.lang]), () => (tm.length ? tm.map((x, i) => `<div class="lc-row" data-i="${i}">
      <input class="lc-grow" data-f="text" maxlength="400" value="${esc(x.text)}">
      <label class="inline">${esc(t('every'))}<input type="number" class="lc-num" data-f="minutes" min="1" max="240" value="${x.minutes}">${esc(t('min'))}</label>
      <button class="ghost small danger-text" data-del>✕</button></div>`).join('') : `<p class="muted">${esc(t('No timer yet.'))}</p>`));
  }
  bindRows($('#lcTimers'), 'lab.chatbot.timers', ['minutes']);
  $('#lcAddTimer').onclick = () => { saveList('lab.chatbot.timers', (l) => l.push({ text: t('Follow the channel so you never miss a live! 💜'), minutes: 20 })); keys.lcTimers = ''; };

  // ---------- Sound commands ----------
  function renderSounds(s) {
    const l = s.sounds.list;
    list($('#lcSounds'), JSON.stringify([l, I18N.lang]), () => (l.length ? l.map((x, i) => `<div class="lc-row" data-i="${i}">
      <span class="lc-bang">!</span><input class="lc-name" data-f="name" maxlength="25" value="${esc(x.name)}">
      <span class="muted lc-grow">${esc(x.file)}</span>
      <label class="inline">🔊<input type="range" data-f="volume" min="0" max="1" step="0.05" value="${x.volume}"></label>
      <button class="ghost small" data-test="${esc(x.name)}">▶</button><button class="ghost small danger-text" data-del>✕</button></div>`).join('') : `<p class="muted">${esc(t('No sound yet: add MP3, WAV or OGG files.'))}</p>`));
  }
  bindRows($('#lcSounds'), 'lab.sounds.list', ['volume']);
  $('#lcSounds').addEventListener('click', (e) => { const b = e.target.closest('[data-test]'); if (b) Panel.run('lab-sound-test', { name: b.dataset.test }); });
  $('#lcSoundFile').onchange = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    const added = [];
    for (const f of files.slice(0, 20)) {
      if (f.size > 20 * 1024 * 1024) { toast(t('File too big (20 MB max)')); continue; }
      const r = await fetch('/api/sounds?name=' + encodeURIComponent(f.name), { method: 'POST', body: f }).then((x) => x.json()).catch(() => null);
      if (!r || !r.file) { toast(t((r && r.error) || 'Something went wrong')); continue; }
      const name = f.name.replace(/\.[^.]+$/, '').toLowerCase().normalize('NFD').replace(/[^a-z0-9_]/g, '').slice(0, 25) || 'son' + (added.length + 1);
      added.push({ name, file: r.file, volume: 1 });
    }
    if (added.length) { saveList('lab.sounds.list', (l) => { for (const a of added) { let n = a.name, k = 2; while (l.some((x) => x.name === n)) n = a.name.slice(0, 22) + k++; l.push(Object.assign(a, { name: n })); } }); keys.lcSounds = ''; toast(t('Sound added')); }
  };

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
  const optBox = $('#lpOpts');
  optBox.innerHTML = [1, 2, 3, 4, 5, 6].map((i) => `<input data-o="${i}" maxlength="60">`).join('');
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

  // ---------- Counters ----------
  function renderCounters(s) {
    const cs = s.counters;
    list($('#lcCounters'), JSON.stringify([cs, I18N.lang]), () => (cs.length ? cs.map((c, i) => `<div class="lc-row" data-i="${i}">
      <input class="lc-cname" data-f="name" maxlength="30" value="${esc(c.name)}"><span class="lc-bang">!</span><input class="lc-name" data-f="cmd" maxlength="25" value="${esc(c.cmd)}">
      <button class="ghost small" data-ct="${esc(c.id)}" data-d="-1">−</button><b class="lc-val">${c.value}</b><button class="ghost small" data-ct="${esc(c.id)}" data-d="1">＋</button>
      <button class="ghost small" data-ct="${esc(c.id)}" data-d="reset" title="${esc(t('Back to 0'))}">0</button>
      <label class="check inline"><input type="checkbox" data-f="modOnly"${c.modOnly ? ' checked' : ''}> ${esc(t('mods'))}</label>
      <button class="ghost small" data-copy="${esc(ORIGIN)}/lab.html?w=counter&amp;id=${esc(c.id)}" title="${esc(t('Copy its OBS link'))}">📺</button>
      <button class="ghost small danger-text" data-del>✕</button></div>`).join('') : `<p class="muted">${esc(t('No counter yet.'))}</p>`));
  }
  bindRows($('#lcCounters'), 'lab.counters', []);
  $('#lcCounters').addEventListener('click', (e) => { const b = e.target.closest('[data-ct]'); if (b) Panel.run('lab-counter', { id: b.dataset.ct, delta: b.dataset.d }); });
  $('#lcAddCounter').onclick = () => { saveList('lab.counters', (l) => l.push({ id: rid(), name: t('Deaths'), cmd: l.some((x) => x.cmd === 'death') ? 'count' + (l.length + 1) : 'death', value: 0, modOnly: true })); keys.lcCounters = ''; };

  // ---------- Queue ----------
  $$('[data-qu]').forEach((b) => (b.onclick = () => Panel.run('lab-queue', { op: b.dataset.qu })));
  $('#lqOpen').onclick = () => Panel.run('lab-queue', { op: Panel.state.lab.play.queue.open ? 'close' : 'open' });
  $('#lqList').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) Panel.run('lab-queue', { op: 'remove', login: b.dataset.rm }); });
  function renderQueue(p) {
    const qu = p.queue;
    $('#lqOpen').textContent = qu.open ? t('Close the queue') : t('Open the queue');
    list($('#lqList'), JSON.stringify([qu.list, I18N.lang]), () => (qu.list.length ? qu.list.map((x, i) => `<div class="lc-row"><b>${i + 1}.</b><span class="lc-grow">${esc(x.display)}${x.sub ? ' ⭐' : ''}</span><button class="ghost small danger-text" data-rm="${esc(x.login)}">✕</button></div>`).join('') : `<p class="muted">${esc(t('Nobody in the queue.'))}</p>`));
  }

  // ---------- Streamer tools: title & category ----------
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
  bindRows($('#ltProfiles'), 'lab.profiles', []);
  $('#ltProfiles').addEventListener('click', async (e) => { const b = e.target.closest('[data-apply]'); if (b && (await Panel.run('lab-profile', { name: b.dataset.apply }, 'Updated on Twitch'))) loadInfo(); });

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

  // ---------- Checklist (ticks per day, in this browser) ----------
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

  // ---------- Twitch account notice (the bot answers with your account; ads and !so need the 1.6 permissions) ----------
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
    if (!st.settings || !st.lab) return;
    staticTexts();
    renderAccount(st);
    const s = st.settings.lab, p = st.lab.play;
    renderCmds(s); renderTimers(s); renderSounds(s); renderCounters(s); renderProfiles(s); renderChecklist(s);
    if (p) { renderGiveaway(p, s); renderPoll(p); renderQueue(p); }
    renderTools(st.lab, s);
    $('#lhNow').textContent = t('Chat speed now: ×{n}', { n: st.lab.hype || 1 }) + ' · ' + t('{n} msg/min', { n: st.lab.perMin || 0 });
  });
  Panel.onTab((name) => { if (name === 'lab-tools' && Panel.state.settings && !$('#ltTitle').value) loadInfo(); });
  setInterval(() => { if (Panel.tab === 'lab-tools' && Panel.state.lab) renderTools(Panel.state.lab, S()); }, 1000);
})();
