/*
 * Hub page "Multi-stream": several crew channels at once.
 * - Videos: Twitch players (muted at start), layout adapts to how many are shown; each one can be focused
 *   (big) or minimised (chip). Hidden when the "Videos" switch is off (saves CPU).
 * - Chats: merged into one ("trkzlive x Civibrr", one colour per channel) or side by side.
 * - Moderation on hover (delete, timeout, ban) and chat modes, through the app (Helix): works on your channel
 *   and on the channels where you are a moderator.
 * Room content is remembered in localStorage (per panel).
 */
(function () {
  'use strict';
  const { $, t, escapeHtml, toast } = Panel;
  const MAX = 6;
  const MAX_LINES = 250;
  const COLORS = ['#a970ff', '#2fd4a3', '#ff7a45', '#3d8bff', '#ff4fa3', '#ffc93c'];
  const LOGIN_RE = /^[a-z0-9_]{3,25}$/;
  const store = (() => { try { return JSON.parse(localStorage.getItem('room') || '{}'); } catch (e) { return {}; } })();
  let channels = (store.channels || []).filter((l) => LOGIN_RE.test(l)).slice(0, MAX);
  let merge = store.merge !== false;
  let video = store.video !== false;
  let focus = null;
  let minimized = new Set(store.minimized || []);
  const rooms = {}; // login -> { roomId, slow, followers, emoteOnly, subsOnly }
  let badges = { global: {}, rooms: {} };
  let armedBan = null;
  const save = () => { try { localStorage.setItem('room', JSON.stringify({ channels, merge, video, minimized: [...minimized] })); } catch (e) { /* private mode */ } };

  const chat = new TwitchChat();
  const colorOf = (login) => COLORS[Math.max(0, channels.indexOf(login)) % COLORS.length];
  const hubInfo = (login) => ((Panel.state.hub || {}).list || []).find((m) => m.login === login) || null;
  const nameOf = (login) => { const h = hubInfo(login); return (h && h.display) || login; };
  const me = () => (Panel.state.twitchAccount || {}).login || '';
  const connected = () => (Panel.state.twitchAccount || {}).status === 'connected';

  // ---------- Channels ----------
  function add(login) {
    login = String(login || '').toLowerCase().replace(/^@/, '').replace(/^https?:\/\/(www\.)?twitch\.tv\//, '').trim();
    if (!LOGIN_RE.test(login)) { toast(t('Not a Twitch name')); return; }
    if (channels.includes(login)) return;
    if (channels.length >= MAX) { toast(t('{n} channels max: remove one first', { n: MAX })); return; }
    channels.push(login);
    changed();
  }
  function remove(login) {
    channels = channels.filter((c) => c !== login);
    minimized.delete(login);
    if (focus === login) focus = null;
    changed();
  }
  function changed() {
    save();
    chat.setChannels(channels);
    renderChans();
    renderVideos();
    buildChats();
  }
  window.PanelRoom = { add, remove, get channels() { return channels.slice(); } };

  function title() { return channels.length ? channels.map(nameOf).join(' x ') : t('Shared chats'); }
  function renderChans() {
    $('#roomTitle').textContent = title();
    $('#roomEmpty').classList.toggle('hidden', channels.length > 0);
    $('#roomMerge').checked = merge;
    $('#roomVideo').checked = video;
    const crew = ((Panel.state.hub || {}).list || []).filter((m) => !channels.includes(m.login)).sort((a, b) => b.live - a.live);
    $('#roomChans').innerHTML = channels.map((c) => {
      const h = hubInfo(c);
      return `<span class="rchip" style="--cc:${colorOf(c)}">${h && h.live ? '<i class="ldot"></i>' : ''}<b>${escapeHtml(nameOf(c))}</b><button data-rm="${escapeHtml(c)}" title="${escapeHtml(t('Remove'))}">✕</button></span>`;
    }).join('') + `<form class="radd" id="roomAdd"><input list="roomCrew" maxlength="40" placeholder="${escapeHtml(t('Add a channel…'))}" spellcheck="false"><datalist id="roomCrew">${crew.map((m) => `<option value="${escapeHtml(m.login)}">${escapeHtml(m.display)}${m.live ? ' ● LIVE' : ''}</option>`).join('')}</datalist><button class="small">+</button></form>`;
  }

  // ---------- Videos ----------
  const playerUrl = (login) => `https://player.twitch.tv/?channel=${encodeURIComponent(login)}&parent=localhost&parent=127.0.0.1&muted=true&autoplay=true`;
  function renderVideos() {
    const box = $('#roomVideos');
    const shown = video ? channels.filter((c) => !minimized.has(c)) : [];
    if (focus && !shown.includes(focus)) focus = null;
    // Keep the existing iframes (reloading a player is slow): add / remove only what changed.
    const keep = new Set(shown);
    box.querySelectorAll('.vt').forEach((el) => { if (!keep.has(el.dataset.login)) el.remove(); });
    for (const c of shown) {
      let el = box.querySelector(`.vt[data-login="${c}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = 'vt';
        el.dataset.login = c;
        el.innerHTML = `<div class="vt-bar"><b></b><span class="grow"></span>
          <button data-v="focus" title="${escapeHtml(t('Bigger'))}">⤢</button><button data-v="min" title="${escapeHtml(t('Minimise'))}">—</button></div>
          <iframe src="${playerUrl(c)}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
        box.appendChild(el);
      }
      el.style.setProperty('--cc', colorOf(c));
      const h = hubInfo(c);
      el.querySelector('.vt-bar b').textContent = nameOf(c) + (h && h.live ? ` · ${t('{n} viewers', { n: h.viewers })}` : h ? ' · ' + t('offline') : '');
      el.classList.toggle('focused', focus === c);
      el.style.order = String(focus === c ? -1 : channels.indexOf(c));
    }
    const n = shown.length;
    box.className = 'room-videos n' + Math.min(n, 6) + (focus ? ' has-focus' : '');
    box.classList.toggle('hidden', !n);
    $('#roomMin').innerHTML = video ? channels.filter((c) => minimized.has(c)).map((c) => `<button class="rmin" data-restore="${escapeHtml(c)}" style="--cc:${colorOf(c)}">▣ ${escapeHtml(nameOf(c))}</button>`).join('') : '';
  }

  // ---------- Chats ----------
  const lists = new Map(); // key ('*' when merged, else login) -> element
  function buildChats() {
    const box = $('#roomChats');
    lists.clear();
    if (!channels.length) { box.innerHTML = ''; return; }
    const cols = merge ? ['*'] : channels;
    box.className = 'room-chats ' + (merge ? 'merged' : 'split n' + Math.min(cols.length, 4));
    box.innerHTML = cols.map((k) => {
      const targets = k === '*' ? channels : [k];
      const own = targets.includes(me()) ? me() : targets[0];
      return `<div class="rchat" data-key="${escapeHtml(k)}">
        <div class="chat-head"><b>${escapeHtml(k === '*' ? title() : nameOf(k))}</b><span class="grow"></span>
          ${connected() ? `<button class="ghost small" data-modbar="${escapeHtml(k)}" title="${escapeHtml(t('Chat modes'))}">🛡</button>` : ''}</div>
        <div class="modbar hidden"></div>
        <div class="chat-list"></div>
        <form class="chat-send">${targets.length > 1 ? `<select class="to">${targets.map((c) => `<option value="${escapeHtml(c)}"${c === own ? ' selected' : ''}>${escapeHtml(nameOf(c))}</option>`).join('')}</select>` : `<input type="hidden" class="to" value="${escapeHtml(own)}">`}
          <input class="msg" maxlength="500" placeholder="${escapeHtml(t('Send a message'))}"><button class="small">${escapeHtml(t('Send'))}</button></form>
      </div>`;
    }).join('');
    box.querySelectorAll('.rchat').forEach((el) => lists.set(el.dataset.key, el.querySelector('.chat-list')));
    loadBadges();
  }
  function listFor(login) { return lists.get(merge ? '*' : login); }
  function addLine(login, html, data) {
    const list = listFor(login);
    if (!list) return;
    const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 40;
    const div = document.createElement('div');
    div.className = 'cline';
    if (data) for (const k in data) div.dataset[k] = data[k];
    div.innerHTML = html;
    list.appendChild(div);
    while (list.childElementCount > MAX_LINES) list.firstElementChild.remove();
    if (atBottom) list.scrollTop = list.scrollHeight;
  }
  const chanTag = (login) => (merge && channels.length > 1 ? `<span class="ctag" style="--cc:${colorOf(login)}" title="${escapeHtml(nameOf(login))}">${escapeHtml(nameOf(login).slice(0, 10))}</span>` : '');
  function badgeMap(roomId) { return Object.assign({}, badges.global, badges.rooms[roomId] || {}); }
  function modButtons(m) {
    if (!connected() || !m.roomId || m.login === me()) return '';
    return `<span class="mods"><button data-mod="delete" title="${escapeHtml(t('Delete the message'))}">🗑</button><button data-mod="timeout" title="${escapeHtml(t('Timeout 10 min'))}">⏱</button><button data-mod="ban" title="${escapeHtml(t('Ban'))}">🔨</button></span>`;
  }
  chat.on('message', (m) => {
    const color = m.color || '#b9a3ff';
    const text = TwitchChat.emoteHtml(m.text, m.emotes);
    addLine(m.channel, `${modButtons(m)}${chanTag(m.channel)}${TwitchChat.badgeHtml(m.badges, badgeMap(m.roomId))}<span class="cname" style="color:${color}">${escapeHtml(m.display)}</span>${m.action ? ' ' : ': '}<span${m.action ? ` style="color:${color}"` : ''}>${text}</span>${m.first ? ` <span class="first">${escapeHtml(t('first message'))}</span>` : ''}`,
      { id: m.id, user: m.userId, room: m.roomId, login: m.login, chan: m.channel });
  });
  chat.on('notice', (n) => { if (n.text) addLine(n.channel, `${chanTag(n.channel)}<span class="sys">★ ${escapeHtml(n.text)}</span>${n.message ? ' ' + TwitchChat.emoteHtml(n.message, n.emotes) : ''}`); });
  chat.on('delete', (d) => { document.querySelectorAll(`#roomChats .cline[data-id="${CSS.escape(d.id)}"]`).forEach((el) => el.classList.add('deleted')); });
  chat.on('clear', (c) => {
    const sel = c.userId ? `#roomChats .cline[data-user="${CSS.escape(c.userId)}"][data-chan="${CSS.escape(c.channel)}"]` : `#roomChats .cline[data-chan="${CSS.escape(c.channel)}"]`;
    document.querySelectorAll(sel).forEach((el) => el.classList.add('deleted'));
    addLine(c.channel, `${chanTag(c.channel)}<span class="sys">${escapeHtml(c.userId ? (c.duration ? t('{name} timed out ({n} s)', { name: c.login, n: c.duration }) : t('{name} banned', { name: c.login })) : t('Chat cleared by a moderator'))}</span>`);
  });
  chat.on('room', (r) => {
    const was = rooms[r.channel] || {};
    rooms[r.channel] = Object.assign(was, r);
    if (!was.joined) { was.joined = true; addLine(r.channel, `${chanTag(r.channel)}<span class="sys">${escapeHtml(t('Connected to the chat of {name}.', { name: nameOf(r.channel) }))}</span>`); loadBadges(); }
    renderModbars();
  });

  let badgeAsk = '';
  async function loadBadges() {
    if (!connected()) return;
    const ids = Object.values(rooms).map((r) => r.roomId).filter(Boolean);
    const key = ids.sort().join(',');
    if (key === badgeAsk) return;
    badgeAsk = key;
    const r = await Panel.action('chat-badges', { rooms: ids });
    if (r && r.badges) badges = r.badges;
  }

  // ---------- Moderation ----------
  function renderModbars() {
    document.querySelectorAll('#roomChats .rchat').forEach((el) => {
      const bar = el.querySelector('.modbar');
      if (bar.classList.contains('hidden')) return;
      const k = el.dataset.key;
      const targets = k === '*' ? channels : [k];
      bar.innerHTML = targets.map((c) => {
        const r = rooms[c] || {};
        const on = (x) => (x ? ' on' : '');
        return `<div class="modrow" data-chan="${escapeHtml(c)}"><b style="color:${colorOf(c)}">${escapeHtml(nameOf(c))}</b>
          <button class="mchip${on(r.slow)}" data-set="slow">🐢 ${escapeHtml(t('Slow'))}${r.slow ? ' ' + r.slow + 's' : ''}</button>
          <button class="mchip${on(r.followers != null && r.followers >= 0)}" data-set="followers">❤ ${escapeHtml(t('Followers only'))}</button>
          <button class="mchip${on(r.emoteOnly)}" data-set="emoteOnly">😀 ${escapeHtml(t('Emotes only'))}</button>
          <button class="mchip${on(r.subsOnly)}" data-set="subsOnly">⭐ ${escapeHtml(t('Subs only'))}</button>
          <button class="mchip danger-text" data-set="clear">🧹 ${escapeHtml(t('Clear chat'))}</button></div>`;
      }).join('');
    });
  }
  async function mod(op, extra) {
    const r = await Panel.run('mod', Object.assign({ op }, extra));
    return r;
  }

  // ---------- Events ----------
  $('#roomChans').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) remove(b.dataset.rm); });
  $('#roomChans').addEventListener('submit', (e) => { e.preventDefault(); const i = e.target.querySelector('input'); add(i.value); i.value = ''; });
  $('#roomMerge').onchange = (e) => { merge = e.target.checked; save(); buildChats(); };
  $('#roomVideo').onchange = (e) => { video = e.target.checked; save(); renderVideos(); };
  $('#roomToWidget').onclick = () => {
    Panel.save('widgets.chat.channels', channels.slice());
    toast(t('The OBS chat widget now shows: {list}', { list: title() }));
  };
  $('#roomVideos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    const login = b.closest('.vt').dataset.login;
    if (b.dataset.v === 'focus') focus = focus === login ? null : login;
    if (b.dataset.v === 'min') { minimized.add(login); save(); }
    renderVideos();
  });
  $('#roomMin').addEventListener('click', (e) => { const b = e.target.closest('[data-restore]'); if (b) { minimized.delete(b.dataset.restore); save(); renderVideos(); } });
  $('#roomChats').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, input = f.querySelector('.msg'), to = f.querySelector('.to').value, text = input.value.trim();
    if (!text) return;
    if (!connected()) { toast(t('Log in with Twitch to send messages')); return; }
    input.disabled = true;
    const ok = await Panel.run('hub-say', { login: to, text });
    input.disabled = false;
    if (ok) input.value = '';
    input.focus();
  });
  $('#roomChats').addEventListener('click', async (e) => {
    const mb = e.target.closest('[data-modbar]');
    if (mb) { const bar = mb.closest('.rchat').querySelector('.modbar'); bar.classList.toggle('hidden'); renderModbars(); return; }
    const set = e.target.closest('[data-set]');
    if (set) {
      const c = set.closest('.modrow').dataset.chan, r = rooms[c] || {};
      if (!r.roomId) { toast(t('Not connected to this chat yet')); return; }
      const k = set.dataset.set;
      if (k === 'clear') { if (await mod('clear', { roomId: r.roomId })) toast(t('Chat cleared')); return; }
      const cur = k === 'followers' ? r.followers != null && r.followers >= 0 : !!r[k];
      const value = k === 'slow' ? (cur ? 0 : 10) : k === 'followers' ? (cur ? false : 0) : !cur;
      await mod('settings', { roomId: r.roomId, settings: { [k]: value } });
      return;
    }
    const btn = e.target.closest('[data-mod]');
    if (!btn) return;
    const line = btn.closest('.cline');
    const d = line.dataset, op = btn.dataset.mod;
    if (op === 'ban' && armedBan !== line) { armedBan = line; btn.classList.add('armed'); btn.title = t('Click again to ban'); setTimeout(() => { if (armedBan === line) { armedBan = null; btn.classList.remove('armed'); } }, 3000); return; }
    armedBan = null;
    const ok = op === 'delete' ? await mod('delete', { roomId: d.room, messageId: d.id })
      : await mod(op, { roomId: d.room, userId: d.user, seconds: 600, reason: '' });
    if (ok) toast(op === 'delete' ? t('Message deleted') : op === 'timeout' ? t('{name} timed out for 10 min', { name: d.login }) : t('{name} banned', { name: d.login }));
  });

  let lastHub = '';
  Panel.onState((s, langChanged) => {
    const key = JSON.stringify([(s.hub || {}).list, (s.twitchAccount || {}).status]);
    if (key === lastHub && !langChanged) return;
    lastHub = key;
    renderChans();
    renderVideos();
    if (langChanged) buildChats();
  });
  // Players only run while the page is shown.
  Panel.onTab((name) => {
    const on = name === 'room';
    $('#roomVideos').querySelectorAll('iframe').forEach((f) => { if (!on && f.src !== 'about:blank') { f.dataset.src = f.src; f.src = 'about:blank'; } else if (on && f.dataset.src) { f.src = f.dataset.src; delete f.dataset.src; } });
  });

  chat.setChannels(channels);
  setTimeout(() => { renderChans(); buildChats(); renderVideos(); }, 0);
})();
