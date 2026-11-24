/*
 * Baba Bot pages: your commands, timers and the sound commands (files from the Son Twitch folder).
 * Ready-made commands, welcome and raid thanks are plain settings (data-key). Lists are saved whole.
 */
(function () {
  'use strict';
  const { $, t, escapeHtml: esc, toast } = Panel;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const keys = {};
  function list(el, key, html) { if (keys[el.id] === key || el.contains(document.activeElement)) return; keys[el.id] = key; el.innerHTML = html(); }
  function saveList(path, fn) { const cur = clone(path.split('.').reduce((o, k) => o[k], Panel.state.settings)); fn(cur); Panel.save(path, cur); return cur; }
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

  // ---------- Commands ----------
  function renderCmds(s) {
    const cmds = s.chatbot.commands;
    list($('#lcCmds'), JSON.stringify([cmds, I18N.lang]), () => (cmds.length ? cmds.map((c, i) => `<div class="lc-row" data-i="${i}">
      <span class="lc-bang">!</span><input class="lc-name" data-f="name" maxlength="25" value="${esc(c.name)}">
      <input class="lc-grow" data-f="reply" maxlength="400" value="${esc(c.reply)}" placeholder="${esc(t('Answer'))}">
      <label class="inline" title="${esc(t('Seconds before it answers again'))}">⏱<input type="number" class="lc-num" data-f="cooldown" min="0" max="3600" value="${c.cooldown}"></label>
      <label class="check inline"><input type="checkbox" data-f="modOnly"${c.modOnly ? ' checked' : ''}> ${esc(t('mods'))}</label>
      <button class="ghost small danger-text" data-del title="${esc(t('Delete'))}">✕</button></div>`).join('') : `<p class="muted">${esc(t('No command yet.'))}</p>`));
  }
  bindRows($('#lcCmds'), 'lab.chatbot.commands', ['cooldown']);
  $('#lcAddCmd').onclick = () => { saveList('lab.chatbot.commands', (l) => l.push({ name: 'cmd' + (l.length + 1), reply: t('Hello {name}!'), cooldown: 30, modOnly: false })); keys.lcCmds = ''; };

  // ---------- Timers ----------
  function renderTimers(s) {
    const tm = s.chatbot.timers;
    list($('#lcTimers'), JSON.stringify([tm, I18N.lang]), () => (tm.length ? tm.map((x, i) => `<div class="lc-row" data-i="${i}">
      <input class="lc-grow" data-f="text" maxlength="400" value="${esc(x.text)}">
      <label class="inline">${esc(t('every'))}<input type="number" class="lc-num" data-f="minutes" min="1" max="240" value="${x.minutes}">${esc(t('min'))}</label>
      <button class="ghost small danger-text" data-del title="${esc(t('Delete'))}">✕</button></div>`).join('') : `<p class="muted">${esc(t('No timer yet.'))}</p>`));
  }
  bindRows($('#lcTimers'), 'lab.chatbot.timers', ['minutes']);
  $('#lcAddTimer').onclick = () => { saveList('lab.chatbot.timers', (l) => l.push({ text: t('Follow the channel so you never miss a live! 💜'), minutes: 20 })); keys.lcTimers = ''; };

  // ---------- Sound commands ----------
  function renderSounds(s) {
    const l = s.sounds.list;
    list($('#lcSounds'), JSON.stringify([l, I18N.lang]), () => (l.length ? l.map((x, i) => `<div class="lc-row" data-i="${i}">
      <span class="lc-bang">!</span><input class="lc-name" data-f="name" maxlength="25" value="${esc(x.name)}">
      <span class="muted lc-grow" title="${esc(x.file)}">🎵 ${esc(/^[a-f0-9]{16}\./.test(x.file) ? t('(uploaded sound)') : x.file)}</span>
      <label class="inline">🔊<input type="range" data-f="volume" min="0" max="1" step="0.05" value="${x.volume}"></label>
      <button class="ghost small" data-test="${esc(x.name)}" title="${esc(t('Play it on stream'))}">▶</button><button class="ghost small danger-text" data-del title="${esc(t('Delete'))}">✕</button></div>`).join('')
      : `<p class="muted">${esc(t('No sound yet: choose some in the Son Twitch folder.'))}</p>`));
  }
  bindRows($('#lcSounds'), 'lab.sounds.list', ['volume']);
  $('#lcSounds').addEventListener('click', (e) => { const b = e.target.closest('[data-test]'); if (b) Panel.run('lab-sound-test', { name: b.dataset.test }); });
  // A command name from the file name: "Bruh Sound (2).mp3" → "bruhsound2".
  const cmdOf = (file) => file.replace(/\.[^.]+$/, '').toLowerCase().normalize('NFD').replace(/[^a-z0-9_]/g, '').slice(0, 25);
  function addSounds(files) {
    if (!files.length) return;
    saveList('lab.sounds.list', (l) => {
      for (const file of files) {
        if (l.some((x) => x.file === file)) continue;
        const base = cmdOf(file) || 'son' + (l.length + 1);
        let n = base, k = 2;
        while (l.some((x) => x.name === n)) n = base.slice(0, 22) + k++;
        l.push({ name: n, file, volume: 1 });
      }
    });
    keys.lcSounds = '';
    toast(t(files.length > 1 ? 'Sounds added' : 'Sound added'));
  }
  $('#lcPickSound').onclick = async () => addSounds((await Panel.pickMedia({ kind: 'audio', multiple: true })).filter(Boolean));
  $('#lcSoundFile').onchange = async (e) => {
    const got = await Panel.uploadMedia(e.target.files);
    e.target.value = '';
    addSounds(got.filter((g) => g.kind === 'audio').map((g) => g.file));
  };

  Panel.onState((st) => {
    if (!st.settings) return;
    const s = st.settings.lab;
    renderCmds(s); renderTimers(s); renderSounds(s);
  });
})();
