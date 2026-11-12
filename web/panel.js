/* Settings & status panel. Talks to the local server (/api/*). */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const t = I18N.t;
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
      if (!parts.length && !/^F\d{1,2}$/.test(key)) { toast(t('Use at least one modifier (Ctrl, Alt or Shift)')); return; }
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
    $('#dStatus').innerHTML = `<span class="${cls}">● ${escapeHtml(t(d.status || '—'))}</span>`;
    $('#dDetail').textContent = d.detail ? d.detail.split(' — ').map((x) => t(x)).join(' — ') : '';
    $('#dMe').textContent = d.me ? d.me.name : '—';
    $('#dChannel').textContent = d.channel ? d.channel.name || t('Private call') : t('none');
    const tw = state.twitchStatus || {};
    const tcls = tw.status === 'connected' ? 'ok' : tw.status === 'error' ? 'err' : tw.status === 'off' ? '' : 'warn';
    $('#tStatus').innerHTML = `<span class="${tcls}">● ${escapeHtml(t(tw.status || 'off'))}</span> ${escapeHtml(t(tw.detail || ''))}`;
    $('#pill').innerHTML = `<span class="${cls}">●</span> ${escapeHtml(d.channel ? (d.channel.name || t('Call')) : t(d.status || ''))}`;
    const box = $('#members'); box.innerHTML = '';
    (d.members || []).forEach((m) => {
      const div = document.createElement('div');
      div.className = 'member' + (m.speaking ? ' speaking' : ''); div.dataset.id = m.id;
      const custom = `<span class="tag">${t(state.avatars[m.id] ? 'custom avatar' : 'Discord picture')}</span>`;
      div.innerHTML = `<span class="dot"></span><span></span>${m.mute ? `<span class="tag">${t('muted')}</span>` : ''}${m.deaf ? `<span class="tag">${t('deafened')}</span>` : ''}${custom}`;
      div.children[1].textContent = m.name;
      box.appendChild(div);
    });
    if (!(d.members || []).length) box.innerHTML = `<span class="muted">${t('Nobody yet — join a voice channel in Discord.')}</span>`;
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
    $('#steps').innerHTML = steps.map((x) => `<li class="${x.done ? 'done' : 'todo'}">${t(x.html)}</li>`).join('');
    $$('[data-goto]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); showTab(a.dataset.goto); }));
  }

  // ---------- App / updates ----------
  const UPD = { idle: '—', dev: 'Development build (updates disabled)', checking: 'Checking…', 'up-to-date': 'Up to date', downloading: 'Downloading', ready: 'Ready — restart to install', available: 'New version available', error: 'Error' };
  function renderApp() {
    const a = state.app || {};
    $('#version').textContent = a.version ? 'v' + a.version + (a.portable ? ' · ' + t('portable') : '') : '';
    $('#appVersion').textContent = a.version ? 'v' + a.version + ' ' + t(a.portable ? '(portable)' : '(installed)') : '—';
    const u = a.update || {};
    let txt = t(UPD[u.status] || u.status || '—');
    if (u.status === 'downloading') txt += ` v${u.latest} — ${u.progress || 0}%`;
    if (u.status === 'available' || u.status === 'ready') txt += ` (v${u.latest})`;
    if (u.status === 'error') txt += ': ' + t(u.error || '');
    $('#updStatus').textContent = txt;
    const banner = $('#updateBanner');
    if (u.status === 'ready' || u.status === 'available') {
      banner.classList.remove('hidden');
      $('#updateText').textContent = u.status === 'ready' ? t('Version {v} is downloaded and ready.', { v: u.latest }) : t("Version {v} is available. The portable build can't update itself — grab the new .exe.", { v: u.latest });
      $('#updateBtn').textContent = t(u.status === 'ready' ? 'Restart & update' : 'Download');
    } else banner.classList.add('hidden');
    for (const k of ['toggleOverlay', 'placement']) $('#hk-' + k).textContent = t((a.hotkeyErrors || {})[k] || '');
    const sel = $('#displaySelect');
    const opts = (a.displays || []).map((d) => `<option value="${d.index}">${escapeHtml(d.label.replace('Primary', t('Primary')))}</option>`).join('');
    if (sel.dataset.opts !== opts) { sel.innerHTML = opts; sel.dataset.opts = opts; sel.value = state.settings.overlay.display; }
    $$('[data-placement]').forEach((b) => (b.textContent = t(a.placement ? 'Finish placement' : b.dataset.label)));
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
    if (!entries.length) { box.innerHTML = `<span class="muted">${t('No avatars imported yet.')}</span>`; return; }
    entries.forEach((av) => {
      const card = document.createElement('div'); card.className = 'avatar-card';
      card.appendChild(previewCanvas(av));
      const name = document.createElement('div'); name.textContent = av.name || t('(no name)'); name.style.fontWeight = '700';
      const id = document.createElement('div'); id.className = 'id'; id.textContent = av.id;
      const btns = document.createElement('div'); btns.className = 'btns'; btns.style.justifyContent = 'center';
      const edit = document.createElement('button'); edit.className = 'ghost'; edit.textContent = t('Edit');
      edit.onclick = () => action('open-creator', { id: av.id });
      const del = document.createElement('button'); del.className = 'danger'; del.textContent = t('Delete');
      del.onclick = () => { if (confirm(t('Delete {name}’s avatar?', { name: av.name || av.id }))) api('/api/avatars/' + encodeURIComponent(av.id), null, 'DELETE'); };
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
      msg.innerHTML = `<span class="ok">${escapeHtml(t('✔ Imported {name}’s avatar.', { name: av.name || av.id }))}</span>`;
    } catch (e) { msg.innerHTML = `<span class="err">✖ ${escapeHtml(t(e.message && !/JSON|token/i.test(e.message) ? e.message : 'Unreadable code or file'))}</span>`; }
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

  // ---------- Members ----------
  function orderedKnown() {
    const known = state.known || {};
    const live = new Set((state.discord.members || []).map((m) => m.id));
    const order = state.settings.memberOrder || [];
    const ids = Object.keys(known);
    (state.discord.members || []).forEach((m) => { if (!known[m.id]) { known[m.id] = { name: m.name, avatarHash: m.avatarHash, lastSeen: Date.now() }; ids.push(m.id); } });
    const idx = (id) => { const i = order.indexOf(id); return i < 0 ? 1e6 : i; };
    return ids.sort((a, b) => idx(a) - idx(b) || (live.has(b) - live.has(a)) || (known[b].lastSeen - known[a].lastSeen)).map((id) => ({ id, live: live.has(id), ...known[id] }));
  }
  function ago(ts) {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 2) return t('just now');
    if (m < 60) return t('{n} min ago', { n: m });
    const h = Math.round(m / 60); if (h < 48) return t('{n} h ago', { n: h });
    return t('{n} days ago', { n: Math.round(h / 24) });
  }
  function memberAvatar(m) {
    return state.avatars[m.id] || Object.assign(Puppet.defaultAvatar(), { kind: 'discord', photoSplit: 0.6, clothColor: '#5865f2', accentColor: '#ffffff' });
  }
  function renderMembers() {
    const box = $('#memberList');
    if (box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return; // don't steal focus while typing
    const list = orderedKnown();
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = `<span class="muted">${t('Nobody yet — members appear here once you have joined a voice channel with them.')}</span>`; return; }
    const cfg = state.settings.members || {};
    const saveOrder = (ids) => save('memberOrder', ids);
    list.forEach((m, i) => {
      const c = cfg[m.id] || {};
      const row = document.createElement('div'); row.className = 'mrow' + (c.hidden ? ' hidden-member' : '');
      // preview
      const cv = document.createElement('canvas'); cv.width = 112; cv.height = 128;
      const cx = cv.getContext('2d'); cx.scale(2, 2);
      const url = m.avatarHash ? `https://cdn.discordapp.com/avatars/${m.id}/${m.avatarHash}.png?size=128` : null;
      const paint = () => { cx.clearRect(0, 0, 56, 64); Puppet.draw(cx, memberAvatar(m), { open: 0 }, { x: 28, y: 60, scale: 0.26, discordAvatarUrl: url }); };
      paint(); setTimeout(paint, 500); setTimeout(paint, 1500);
      // who
      const who = document.createElement('div'); who.className = 'who';
      const nb = document.createElement('b'); nb.textContent = c.alias || m.name;
      const sm = document.createElement('small'); sm.innerHTML = (m.live ? `<span class="live-dot"></span>${t('in the channel')}` : escapeHtml(ago(m.lastSeen))) + (c.alias ? ' · ' + escapeHtml(m.name) : '');
      who.append(nb, sm);
      // alias
      const alias = document.createElement('input'); alias.placeholder = t('Nickname'); alias.value = c.alias || ''; alias.maxLength = 32;
      alias.onchange = () => save(`members.${m.id}.alias`, alias.value.trim());
      // size
      const size = document.createElement('div'); size.className = 'size';
      size.innerHTML = `<input type="range" min="0.5" max="1.8" step="0.05"><output></output>`;
      const rng = size.querySelector('input'), out = size.querySelector('output');
      rng.value = c.scale || 1; out.textContent = Math.round(rng.value * 100) + '%';
      rng.oninput = () => { out.textContent = Math.round(rng.value * 100) + '%'; save(`members.${m.id}.scale`, Number(rng.value)); };
      rng.title = t('Size');
      // hide
      const hide = document.createElement('label'); hide.className = 'check';
      hide.innerHTML = `<input type="checkbox" ${c.hidden ? 'checked' : ''}> ${t('Hidden')}`;
      hide.querySelector('input').onchange = (e) => { save(`members.${m.id}.hidden`, e.target.checked); row.classList.toggle('hidden-member', e.target.checked); };
      // order
      const ord = document.createElement('div'); ord.className = 'order';
      const ids = list.map((x) => x.id);
      const up = document.createElement('button'); up.className = 'ghost'; up.textContent = '▲'; up.title = t('Move left'); up.disabled = i === 0;
      const dn = document.createElement('button'); dn.className = 'ghost'; dn.textContent = '▼'; dn.title = t('Move right'); dn.disabled = i === list.length - 1;
      up.onclick = () => { [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; state.settings.memberOrder = ids; saveOrder(ids); renderMembers(); };
      dn.onclick = () => { [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]]; state.settings.memberOrder = ids; saveOrder(ids); renderMembers(); };
      ord.append(up, dn);
      // forget
      const forget = document.createElement('button'); forget.className = 'danger'; forget.textContent = t('Forget');
      forget.onclick = () => { if (confirm(t('Forget {name} and their settings?', { name: c.alias || m.name }))) action('forget-member', { id: m.id }); };
      if (m.live) forget.disabled = true;
      row.append(cv, who, alias, size, hide, ord, forget);
      box.appendChild(row);
    });
  }

  // ---------- Twitch ----------
  const COMMANDS = [['jump', 'jump'], ['dance', 'dance'], ['wave', 'wave hello'], ['hat', 'hat crown / cap / none…'], ['hair', 'hair afro / long…'], ['outfit', 'outfit suit / dress…'], ['eyes', 'eyes stars / hearts…'], ['glasses', 'glasses sunglasses…'], ['item', 'item pizza / sword…'], ['neck', 'neck scarf / medal…'], ['pattern', 'pattern stripes…'], ['color', 'color pink / #ff00aa'], ['hatcolor', 'hatcolor gold'], ['reroll', 'new random look'], ['reset', 'back to default look'], ['puppet', 'list commands']];
  function renderCommands() {
    const s = state.settings.twitch, p = s.commandPrefix || '!';
    const disabled = s.disabledCommands || [];
    $('#cmdList').innerHTML = '<div class="cmd-grid">' + COMMANDS.map(([c, d]) => `<label class="check"><input type="checkbox" data-cmd="${c}" ${disabled.includes(c) ? '' : 'checked'}> <code>${escapeHtml(p + c)}</code> <span class="muted">${escapeHtml(t(d))}</span></label>`).join('') + '</div>';
    $$('[data-cmd]').forEach((el) => el.onchange = () => {
      const off = $$('[data-cmd]').filter((x) => !x.checked).map((x) => x.dataset.cmd);
      save('twitch.disabledCommands', off);
    });
  }
  $$('[data-test]').forEach((b) => (b.onclick = () => {
    if (!state.settings.twitch.enabled && !state.settings.twitch.showOnDesktop) toast(t('Tip: the effect shows in the Status preview and in OBS'));
    action('twitch-test', { kind: b.dataset.test });
  }));
  $('#clearViewers').onclick = () => { if (confirm(t('Reset every viewer back to their default look?'))) action('clear-viewers').then(() => toast(t('Viewer customisations cleared'))); };

  // ---------- OBS ----------
  function renderUrls() {
    const origin = location.origin.replace('127.0.0.1', 'localhost');
    $('#urlAll').textContent = origin + '/overlay.html';
    $('#urlDiscord').textContent = origin + '/overlay.html?scene=discord';
    $('#urlTwitch').textContent = origin + '/overlay.html?scene=twitch';
  }
  renderUrls();
  $$('[data-copy]').forEach((b) => b.onclick = () => { navigator.clipboard.writeText($('#' + b.dataset.copy).textContent); toast(t('Copied to clipboard')); });
  $('#replayFx').onclick = () => { action('fx-test'); toast(t('Watch the preview, your overlay and OBS')); };
  $('#reconnect').onclick = () => { action('reconnect'); toast(t('Reconnecting to Discord…')); };

  // ---------- Logo ----------
  (function logo() {
    const c = $('#logo'), ctx = c.getContext('2d'), a = new Puppet.Animator('logo');
    const av = Object.assign(Puppet.defaultAvatar(), { hat: 'beanie', hatColor: '#ff7a45', hair: 'none' });
    let last = 0;
    (function f(t) { a.talking = Math.sin(t / 900) > 0.2; a.update(Math.min(0.05, (t - last) / 1000), t / 1000); last = t; ctx.clearRect(0, 0, 56, 56); Puppet.draw(ctx, av, a.state(t / 1000), { x: 28, y: 76, scale: 0.36 }); requestAnimationFrame(f); })(0);
  })();

  // ---------- Live updates ----------
  let lastAvatars = '', lastCmdKey = '', lastMembers = '', langApplied = false;
  function connect() {
    const es = new EventSource('/api/events');
    es.onopen = () => $('#offline').classList.add('hidden');
    es.onerror = () => $('#offline').classList.remove('hidden');
    es.addEventListener('state', (e) => {
      state = JSON.parse(e.data);
      // Language: translate static text once per change, then force the dynamic parts to re-render.
      const langChanged = I18N.setLang((state.app && state.app.lang) || 'en') || !langApplied;
      if (langChanged) { langApplied = true; I18N.apply(document.body); lastAvatars = ''; lastCmdKey = ''; lastMembers = ''; $('#displaySelect').dataset.opts = ''; }
      fillInputs(); renderStatus(); renderApp();
      const av = JSON.stringify(state.avatars); if (av !== lastAvatars) { lastAvatars = av; renderAvatars(); }
      const mk = I18N.lang + JSON.stringify([Object.keys(state.known || {}), (state.discord.members || []).map((m) => m.id), state.settings.memberOrder, state.settings.members, av.length]);
      if (mk !== lastMembers) { lastMembers = mk; renderMembers(); }
      const ck = I18N.lang + (state.settings.twitch.commandPrefix || '') + JSON.stringify(state.settings.twitch.disabledCommands || []);
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
