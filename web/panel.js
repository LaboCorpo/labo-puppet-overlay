/* Settings & status panel. Talks to the local server (/api/*). */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  let state = { settings: null, avatars: {}, discord: { members: [] }, app: {} };

  const api = (path, body, method) => fetch(path, { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json()).catch(() => ({ ok: false }));
  const action = (name, extra) => api('/api/action', Object.assign({ name }, extra || {}));
  function toast(text) { const t = $('#toast'); t.textContent = text; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---------- Tabs (remembered between openings) ----------
  function showTab(name) {
    $$('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
    $$('section').forEach((s) => s.classList.toggle('active', s.dataset.panel === name));
    try { localStorage.setItem('tab', name); } catch (e) {}
  }
  $$('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  try { const t = localStorage.getItem('tab'); if (t && $(`.tab[data-tab="${t}"]`)) showTab(t); } catch (e) {}

  // ---------- Settings binding ----------
  const get = (obj, key) => key.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
  function patchFor(key, value) { const out = {}; const ks = key.split('.'); let o = out; ks.slice(0, -1).forEach((k) => (o = o[k] = {})); o[ks[ks.length - 1]] = value; return out; }
  let saveTimer = null; let pending = {};
  function save(key, value) {
    const merge = (a, b) => { for (const k in b) a[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; return a; };
    merge(pending, patchFor(key, value));
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { const body = pending; pending = {}; api('/api/settings', body); }, 200);
  }
  function fillInputs() {
    $$('[data-key]').forEach((el) => {
      if (document.activeElement === el) return;
      const v = get(state.settings, el.dataset.key);
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.classList.contains('hotkey')) el.value = String(v || '').replace('CommandOrControl', 'Ctrl');
      else if (v !== undefined && v !== null) el.value = v;
      const out = el.parentElement.querySelector('output'); if (out) out.textContent = el.value;
    });
    const cc = $('#customColors'); if (document.activeElement !== cc) cc.value = (state.settings.twitch.colors || []).join(', ');
  }
  $$('[data-key]').forEach((el) => {
    if (el.classList.contains('hotkey')) return;
    const ev = el.type === 'range' || el.type === 'color' ? 'input' : 'change';
    el.addEventListener(ev, () => {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'number' || el.type === 'range' || el.hasAttribute('data-number')) v = Number(v);
      if (el.type === 'number' && Number.isNaN(v)) return;
      const out = el.parentElement.querySelector('output'); if (out) out.textContent = el.value;
      save(el.dataset.key, v);
    });
  });
  $('#customColors').addEventListener('change', (e) => save('twitch.colors', e.target.value.split(/[\s,;]+/).filter((c) => /^#[0-9a-f]{3,8}$/i.test(c))));

  // Hotkey capture: build an Electron accelerator from the pressed keys.
  $$('.hotkey').forEach((el) => {
    el.addEventListener('keydown', (e) => {
      e.preventDefault();
      if (e.key === 'Backspace' || e.key === 'Delete') { el.value = ''; save(el.dataset.key, ''); return; }
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
      const parts = [];
      if (e.ctrlKey) parts.push('CommandOrControl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      let key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (/^F\d{1,2}$/.test(e.key)) key = e.key;
      const map = { ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Escape: null };
      if (key in map) key = map[key];
      if (!key) { el.blur(); return; }
      if (!parts.length && !/^F\d{1,2}$/.test(key)) { toast('Use at least one modifier (Ctrl, Alt or Shift)'); return; }
      const acc = [...parts, key].join('+');
      el.value = acc.replace('CommandOrControl', 'Ctrl');
      save(el.dataset.key, acc);
      el.blur();
    });
  });

  // ---------- Status ----------
  const STATUS_CLASS = { connected: 'ok', error: 'err', refused: 'err', 'Discord not found': 'warn', 'setup required': 'warn' };
  function renderStatus() {
    const d = state.discord || {};
    const cls = STATUS_CLASS[d.status] || 'warn';
    $('#dStatus').innerHTML = `<span class="${cls}">● ${escapeHtml(d.status || '—')}</span>`;
    $('#dDetail').textContent = d.detail || '';
    $('#dMe').textContent = d.me ? d.me.name : '—';
    $('#dChannel').textContent = d.channel ? d.channel.name || 'Private call' : 'none';
    const tw = state.twitchStatus || {};
    const tcls = tw.status === 'connected' ? 'ok' : tw.status === 'error' ? 'err' : tw.status === 'off' ? '' : 'warn';
    $('#tStatus').innerHTML = `<span class="${tcls}">● ${escapeHtml(tw.status || 'off')}</span> ${escapeHtml(tw.detail || '')}`;
    $('#pill').innerHTML = `<span class="${cls}">●</span> ${escapeHtml(d.channel ? (d.channel.name || 'Call') : d.status || '')}`;
    const box = $('#members'); box.innerHTML = '';
    (d.members || []).forEach((m) => {
      const div = document.createElement('div');
      div.className = 'member' + (m.speaking ? ' speaking' : ''); div.dataset.id = m.id;
      const custom = state.avatars[m.id] ? '<span class="tag">custom avatar</span>' : '<span class="tag">Discord picture</span>';
      div.innerHTML = `<span class="dot"></span><span></span>${m.mute ? '<span class="tag">muted</span>' : ''}${m.deaf ? '<span class="tag">deafened</span>' : ''}${custom}`;
      div.children[1].textContent = m.name;
      box.appendChild(div);
    });
    if (!(d.members || []).length) box.innerHTML = '<span class="muted">Nobody yet — join a voice channel in Discord.</span>';
    renderOnboarding();
  }

  function renderOnboarding() {
    const s = state.settings, d = state.discord || {};
    const steps = [
      { done: !!(s.discord.clientId), html: 'Create the Discord application and paste its <b>Application ID</b> in <a href="#" data-goto="discord">Discord setup</a>.' },
      { done: d.status === 'connected' || !!d.channel, html: 'Make sure the <b>Discord desktop app</b> is running and click <b>Authorize</b> in its popup.' },
      { done: Object.keys(state.avatars || {}).length > 0, html: '<a href="#" data-goto="avatars">Create your avatar</a> and share the file with your friends.' },
    ];
    const show = steps.some((x) => !x.done);
    $('#onboarding').classList.toggle('hidden', !show);
    $('#steps').innerHTML = steps.map((x) => `<li class="${x.done ? 'done' : 'todo'}">${x.html}</li>`).join('');
    $$('[data-goto]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); showTab(a.dataset.goto); }));
  }

  // ---------- App / updates ----------
  const UPD = { idle: '—', dev: 'Development build (updates disabled)', checking: 'Checking…', 'up-to-date': 'Up to date', downloading: 'Downloading', ready: 'Ready — restart to install', available: 'New version available', error: 'Error' };
  function renderApp() {
    const a = state.app || {};
    $('#version').textContent = a.version ? 'v' + a.version + (a.portable ? ' · portable' : '') : '';
    $('#appVersion').textContent = a.version ? 'v' + a.version + (a.portable ? ' (portable)' : ' (installed)') : '—';
    const u = a.update || {};
    let txt = UPD[u.status] || u.status || '—';
    if (u.status === 'downloading') txt += ` v${u.latest} — ${u.progress || 0}%`;
    if (u.status === 'available' || u.status === 'ready') txt += ` (v${u.latest})`;
    if (u.status === 'error') txt += ': ' + (u.error || '');
    $('#updStatus').textContent = txt;
    const banner = $('#updateBanner');
    if (u.status === 'ready' || u.status === 'available') {
      banner.classList.remove('hidden');
      $('#updateText').textContent = u.status === 'ready' ? `Version ${u.latest} is downloaded and ready.` : `Version ${u.latest} is available. The portable build can't update itself — grab the new .exe.`;
      $('#updateBtn').textContent = u.status === 'ready' ? 'Restart & update' : 'Download';
    } else banner.classList.add('hidden');
    for (const k of ['toggleOverlay', 'placement']) $('#hk-' + k).textContent = (a.hotkeyErrors || {})[k] || '';
    const sel = $('#displaySelect');
    const opts = (a.displays || []).map((d) => `<option value="${d.index}">${escapeHtml(d.label)}</option>`).join('');
    if (sel.dataset.opts !== opts) { sel.innerHTML = opts; sel.dataset.opts = opts; sel.value = state.settings.overlay.display; }
    $$('[data-placement]').forEach((b) => (b.textContent = a.placement ? 'Finish placement' : b.dataset.label));
  }
  $('#updateBtn').onclick = () => action('update-install');
  $('#checkUpdate').onclick = () => action('update-check');
  $('#openLogs').onclick = () => action('open-logs');
  $('#exportConfig').onclick = () => action('export-config');
  $$('[data-placement]').forEach((b) => (b.dataset.label = b.textContent));
  $$('[data-placement]').forEach((b) => (b.onclick = () => action('placement', { on: !state.app.placement })));

  // ---------- Avatars ----------
  function previewCanvas(av) {
    const c = document.createElement('canvas'); c.width = 280; c.height = 320;
    const ctx = c.getContext('2d'); ctx.scale(2, 2);
    const draw = () => { ctx.clearRect(0, 0, 140, 160); Puppet.draw(ctx, av, { open: 0, bob: 0 }, { x: 70, y: 150, scale: 0.68 }); };
    draw(); setTimeout(draw, 400); setTimeout(draw, 1500); // repaint once photos have loaded
    return c;
  }
  function renderAvatars() {
    const box = $('#avatarList'); box.innerHTML = '';
    const entries = Object.values(state.avatars || {}).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    if (!entries.length) { box.innerHTML = '<span class="muted">No avatars imported yet.</span>'; return; }
    entries.forEach((av) => {
      const card = document.createElement('div'); card.className = 'avatar-card';
      card.appendChild(previewCanvas(av));
      const name = document.createElement('div'); name.textContent = av.name || '(no name)'; name.style.fontWeight = '700';
      const id = document.createElement('div'); id.className = 'id'; id.textContent = av.id;
      const btns = document.createElement('div'); btns.className = 'btns'; btns.style.justifyContent = 'center';
      const edit = document.createElement('button'); edit.className = 'ghost'; edit.textContent = 'Edit';
      edit.onclick = () => action('open-creator', { id: av.id });
      const del = document.createElement('button'); del.className = 'danger'; del.textContent = 'Delete';
      del.onclick = () => { if (confirm('Delete ' + (av.name || av.id) + '’s avatar?')) api('/api/avatars/' + encodeURIComponent(av.id), null, 'DELETE'); };
      btns.append(edit, del);
      card.append(name, id, btns);
      box.appendChild(card);
    });
  }
  async function importAvatar(text) {
    const msg = $('#importMsg');
    try {
      const av = Puppet.decodeAny(text);
      const j = await api('/api/avatars', av);
      if (!j.ok) throw new Error(j.error || 'Import failed');
      msg.innerHTML = `<span class="ok">✔ Imported ${escapeHtml(av.name || av.id)}’s avatar.</span>`;
    } catch (e) { msg.innerHTML = `<span class="err">✖ ${escapeHtml(e.message && !/JSON|token/i.test(e.message) ? e.message : 'Unreadable code or file')}</span>`; }
  }
  $('#importCodeBtn').onclick = () => { importAvatar($('#importCode').value); $('#importCode').value = ''; };
  $('#importCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#importCodeBtn').click(); });
  const readFiles = (files) => [...files].forEach((f) => f.text().then(importAvatar));
  $('#importFile').onchange = (e) => readFiles(e.target.files);
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'drop' || e.target === drop) drop.classList.remove('over'); }));
  document.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) { showTab('avatars'); readFiles(e.dataTransfer.files); } });
  $('#openCreator').onclick = () => { const me = state.discord && state.discord.me; action('open-creator', { id: me ? me.id : '' }); };

  // ---------- Twitch ----------
  const COMMANDS = [['jump', 'jump'], ['dance', 'dance'], ['wave', 'wave hello'], ['hat', 'hat crown / cap / none…'], ['hair', 'hair afro / long…'], ['outfit', 'outfit suit / dress…'], ['eyes', 'eyes stars / glasses…'], ['color', 'color pink / #ff00aa'], ['hatcolor', 'hatcolor gold'], ['reroll', 'new random look'], ['reset', 'back to default look'], ['puppet', 'list commands']];
  function renderCommands() {
    const s = state.settings.twitch, p = s.commandPrefix || '!';
    const disabled = s.disabledCommands || [];
    $('#cmdList').innerHTML = '<div class="cmd-grid">' + COMMANDS.map(([c, d]) => `<label class="check"><input type="checkbox" data-cmd="${c}" ${disabled.includes(c) ? '' : 'checked'}> <code>${escapeHtml(p + c)}</code> <span class="muted">${escapeHtml(d)}</span></label>`).join('') + '</div>';
    $$('[data-cmd]').forEach((el) => el.onchange = () => {
      const off = $$('[data-cmd]').filter((x) => !x.checked).map((x) => x.dataset.cmd);
      save('twitch.disabledCommands', off);
    });
  }
  $$('[data-test]').forEach((b) => (b.onclick = () => {
    if (!state.settings.twitch.enabled && !state.settings.twitch.showOnDesktop) toast('Tip: the effect shows in the Status preview and in OBS');
    action('twitch-test', { kind: b.dataset.test });
  }));
  $('#clearViewers').onclick = () => { if (confirm('Reset every viewer back to their default look?')) action('clear-viewers').then(() => toast('Viewer customisations cleared')); };

  // ---------- OBS ----------
  function renderUrls() {
    const origin = location.origin.replace('127.0.0.1', 'localhost');
    $('#urlAll').textContent = origin + '/overlay.html';
    $('#urlDiscord').textContent = origin + '/overlay.html?scene=discord';
    $('#urlTwitch').textContent = origin + '/overlay.html?scene=twitch';
  }
  renderUrls();
  $$('[data-copy]').forEach((b) => b.onclick = () => { navigator.clipboard.writeText($('#' + b.dataset.copy).textContent); toast('Copied to clipboard'); });
  $('#reconnect').onclick = () => { action('reconnect'); toast('Reconnecting to Discord…'); };

  // ---------- Logo ----------
  (function logo() {
    const c = $('#logo'), ctx = c.getContext('2d'), a = new Puppet.Animator('logo');
    const av = Object.assign(Puppet.defaultAvatar(), { hat: 'beanie', hatColor: '#ff7a45', hair: 'none' });
    let last = 0;
    (function f(t) { a.talking = Math.sin(t / 900) > 0.2; a.update(Math.min(0.05, (t - last) / 1000), t / 1000); last = t; ctx.clearRect(0, 0, 56, 56); Puppet.draw(ctx, av, a.state(t / 1000), { x: 28, y: 76, scale: 0.36 }); requestAnimationFrame(f); })(0);
  })();

  // ---------- Live updates ----------
  let lastAvatars = '', lastCmdKey = '';
  function connect() {
    const es = new EventSource('/api/events');
    es.onopen = () => $('#offline').classList.add('hidden');
    es.onerror = () => $('#offline').classList.remove('hidden');
    es.addEventListener('state', (e) => {
      state = JSON.parse(e.data);
      fillInputs(); renderStatus(); renderApp();
      const av = JSON.stringify(state.avatars); if (av !== lastAvatars) { lastAvatars = av; renderAvatars(); }
      const ck = (state.settings.twitch.commandPrefix || '') + JSON.stringify(state.settings.twitch.disabledCommands || []);
      if (ck !== lastCmdKey) { lastCmdKey = ck; renderCommands(); }
    });
    es.addEventListener('speaking', (e) => {
      const d = JSON.parse(e.data);
      const m = (state.discord.members || []).find((x) => x.id === d.id); if (m) m.speaking = d.speaking;
      const el = document.querySelector(`.member[data-id="${d.id}"]`); if (el) el.classList.toggle('speaking', d.speaking);
    });
  }
  connect();
})();
