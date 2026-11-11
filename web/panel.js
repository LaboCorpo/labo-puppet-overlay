/* Settings & status panel. Talks to the local server (/api/*). */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  let state = { settings: null, avatars: {}, discord: { members: [] } };

  // ---------- Tabs ----------
  $$('.tab').forEach((b) => b.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.classList.toggle('active', x === b));
    $$('section').forEach((s) => s.classList.toggle('active', s.dataset.panel === b.dataset.tab));
  }));

  // ---------- Settings binding ----------
  const get = (obj, key) => key.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
  function patchFor(key, value) { const out = {}; const ks = key.split('.'); let o = out; ks.slice(0, -1).forEach((k) => (o = o[k] = {})); o[ks[ks.length - 1]] = value; return out; }
  let saveTimer = null; let pending = {};
  function save(key, value) {
    const merge = (a, b) => { for (const k in b) a[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; return a; };
    merge(pending, patchFor(key, value));
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { const body = pending; pending = {}; fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }, 250);
  }
  function fillInputs() {
    $$('[data-key]').forEach((el) => {
      if (document.activeElement === el) return;
      const v = get(state.settings, el.dataset.key);
      if (el.type === 'checkbox') el.checked = !!v; else if (v !== undefined) el.value = v;
      const out = el.parentElement.querySelector('output'); if (out) out.textContent = el.value;
    });
    const cc = $('#customColors'); if (document.activeElement !== cc) cc.value = (state.settings.twitch.colors || []).join(', ');
  }
  $$('[data-key]').forEach((el) => {
    const ev = el.type === 'range' || el.type === 'color' ? 'input' : 'change';
    el.addEventListener(ev, () => {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'number' || el.type === 'range') v = Number(v);
      const out = el.parentElement.querySelector('output'); if (out) out.textContent = el.value;
      save(el.dataset.key, v);
    });
  });
  $('#customColors').addEventListener('change', (e) => save('twitch.colors', e.target.value.split(/[\s,;]+/).filter((c) => /^#[0-9a-f]{3,8}$/i.test(c))));

  // ---------- Status ----------
  const STATUS_CLASS = { 'connecté': 'ok', 'erreur': 'err', 'refusé': 'err', 'Discord introuvable': 'warn', 'configuration requise': 'warn' };
  function renderStatus() {
    const d = state.discord || {};
    const cls = STATUS_CLASS[d.status] || 'warn';
    $('#dStatus').innerHTML = `<span class="${cls}">● ${d.status || '—'}</span>`;
    $('#dDetail').textContent = d.detail || '';
    $('#dMe').textContent = d.me ? d.me.name : '—';
    $('#dChannel').textContent = d.channel ? d.channel.name || 'Appel privé' : 'aucun';
    $('#pill').innerHTML = `<span class="${cls}">●</span> ${d.channel ? (d.channel.name || 'Appel') : d.status || ''}`;
    const box = $('#members'); box.innerHTML = '';
    (d.members || []).forEach((m) => {
      const div = document.createElement('div');
      div.className = 'member' + (m.speaking ? ' speaking' : ''); div.dataset.id = m.id;
      const custom = state.avatars[m.id] ? '<span class="tag">avatar perso</span>' : '<span class="tag">photo Discord</span>';
      div.innerHTML = `<span class="dot"></span><span></span>${m.mute ? '<span class="tag">muet</span>' : ''}${m.deaf ? '<span class="tag">sourd</span>' : ''}${custom}`;
      div.children[1].textContent = m.name;
      box.appendChild(div);
    });
    if (!(d.members || []).length) box.innerHTML = '<span class="muted">Personne : rejoins un salon vocal sur Discord.</span>';
  }

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
    const entries = Object.values(state.avatars || {});
    if (!entries.length) { box.innerHTML = '<span class="muted">Aucun avatar importé pour l’instant.</span>'; return; }
    entries.forEach((av) => {
      const card = document.createElement('div'); card.className = 'avatar-card';
      card.appendChild(previewCanvas(av));
      const name = document.createElement('div'); name.textContent = av.name || '(sans nom)'; name.style.fontWeight = '700';
      const id = document.createElement('div'); id.className = 'id'; id.textContent = av.id;
      const btns = document.createElement('div'); btns.className = 'btns'; btns.style.justifyContent = 'center';
      const edit = document.createElement('button'); edit.className = 'ghost'; edit.textContent = 'Modifier';
      edit.onclick = () => fetch('/api/open-creator', { method: 'POST', body: JSON.stringify({ id: av.id }) });
      const del = document.createElement('button'); del.className = 'danger'; del.textContent = 'Supprimer';
      del.onclick = () => { if (confirm('Supprimer l’avatar de ' + (av.name || av.id) + ' ?')) fetch('/api/avatars/' + encodeURIComponent(av.id), { method: 'DELETE' }); };
      btns.append(edit, del);
      card.append(name, id, btns);
      box.appendChild(card);
    });
  }
  async function importAvatar(text) {
    const msg = $('#importMsg');
    try {
      const av = Puppet.decodeAny(text);
      const r = await fetch('/api/avatars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(av) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      msg.innerHTML = `<span class="ok">✔ Avatar de ${escapeHtml(av.name || av.id)} importé.</span>`;
    } catch (e) { msg.innerHTML = `<span class="err">✖ ${escapeHtml(e.message || 'Code ou fichier illisible')}</span>`; }
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  $('#importCodeBtn').onclick = () => { importAvatar($('#importCode').value); $('#importCode').value = ''; };
  const readFiles = (files) => [...files].forEach((f) => f.text().then(importAvatar));
  $('#importFile').onchange = (e) => readFiles(e.target.files);
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'drop' || e.target === drop) drop.classList.remove('over'); }));
  document.addEventListener('drop', (e) => readFiles(e.dataTransfer.files));
  $('#openCreator').onclick = () => {
    const me = state.discord && state.discord.me;
    fetch('/api/open-creator', { method: 'POST', body: JSON.stringify({ id: me ? me.id : '' }) });
  };

  // ---------- OBS ----------
  const origin = location.origin.replace('127.0.0.1', 'localhost');
  $('#urlAll').textContent = origin + '/overlay.html';
  $('#urlDiscord').textContent = origin + '/overlay.html?scene=discord';
  $('#urlTwitch').textContent = origin + '/overlay.html?scene=twitch';
  $$('[data-copy]').forEach((b) => b.onclick = () => { navigator.clipboard.writeText($('#' + b.dataset.copy).textContent); b.textContent = 'Copié ✔'; setTimeout(() => (b.textContent = 'Copier'), 1500); });

  $('#reconnect').onclick = () => fetch('/api/discord/reconnect', { method: 'POST' });

  // ---------- Logo ----------
  (function logo() {
    const c = $('#logo'), ctx = c.getContext('2d'), a = new Puppet.Animator('logo'); a.talking = true;
    const av = Object.assign(Puppet.defaultAvatar(), { hat: 'bonnet', hatColor: '#ff7a45', hair: 'aucun' });
    (function f(t) { a.update(1 / 60, t / 1000); ctx.clearRect(0, 0, 56, 56); Puppet.draw(ctx, av, a.state(t / 1000), { x: 28, y: 76, scale: 0.36 }); requestAnimationFrame(f); })(0);
  })();

  // ---------- Live updates ----------
  const es = new EventSource('/api/events');
  es.addEventListener('state', (e) => {
    const s = JSON.parse(e.data);
    const avatarsChanged = JSON.stringify(Object.keys(s.avatars || {})) + JSON.stringify(s.avatars) !== JSON.stringify(Object.keys(state.avatars || {})) + JSON.stringify(state.avatars);
    state = s;
    fillInputs(); renderStatus();
    if (avatarsChanged) renderAvatars();
  });
  es.addEventListener('speaking', (e) => {
    const d = JSON.parse(e.data);
    const m = (state.discord.members || []).find((x) => x.id === d.id); if (m) m.speaking = d.speaking;
    const el = document.querySelector(`.member[data-id="${d.id}"]`); if (el) el.classList.toggle('speaking', d.speaking);
  });
})();
