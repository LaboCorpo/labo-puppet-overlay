/*
 * Panel tab "Streaming hub": who in the crew is live, raid / Stream Together / open on Twitch,
 * and their chats read right here (anonymous IRC, like the overlay) with sending through the Twitch API.
 */
(function () {
  'use strict';
  const { $, t, escapeHtml, toast } = Panel;
  const MAX_CHATS = 4;
  const MAX_LINES = 200;
  const listEl = $('#hubList');
  const chatsEl = $('#chats');
  const membersEl = $('#hubMembers');

  // ---------- Crew list setting ----------
  const parseLogins = (txt) => txt.split(/[\s,;]+/).map((x) => x.trim().toLowerCase().replace(/^@/, '').replace(/^https?:\/\/(www\.)?twitch\.tv\//, '')).filter(Boolean);
  membersEl.addEventListener('change', () => {
    const logins = [...new Set(parseLogins(membersEl.value))];
    const bad = logins.filter((l) => !/^[a-z0-9_]{3,25}$/.test(l));
    if (bad.length) toast(t('Ignored (not a Twitch name): {list}', { list: bad.join(', ') }));
    Panel.save('hub.members', logins.filter((l) => !bad.includes(l)));
  });
  $('#hubRefresh').onclick = () => Panel.run('hub-refresh');

  // ---------- Channel cards ----------
  let lastKey = '';
  let armed = null; // login whose raid button awaits confirmation
  let armTimer = 0;
  const ago = (iso) => {
    const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    return min < 60 ? t('{n} min', { n: min }) : t('{h} h {m} min', { h: Math.floor(min / 60), m: min % 60 });
  };
  function card(m, connected, raid) {
    const live = m.live ? `<span class="live-badge">● ${escapeHtml(t('LIVE'))}</span> <span class="muted">${escapeHtml(t('{n} viewers', { n: m.viewers }))} · ${escapeHtml(ago(m.startedAt))}</span>` : `<span class="muted">${escapeHtml(t('offline'))}</span>`;
    const avatar = m.avatar ? `<img class="hub-av" src="${escapeHtml(m.avatar)}" alt="">` : '<span class="hub-av"></span>';
    const canAct = connected && !m.me;
    const raidLabel = armed === m.login ? t('Confirm raid?') : t('Raid');
    return `<div class="hub-card${m.live ? ' is-live' : ''}" data-login="${escapeHtml(m.login)}">
      ${m.live && m.thumb ? `<img class="hub-thumb" src="${escapeHtml(m.thumb)}?t=${Math.floor(Date.now() / 300000)}" alt="">` : ''}
      <div class="hub-who">${avatar}<div><b>${escapeHtml(m.display)}</b>${m.me ? ` <span class="tag">${escapeHtml(t('you'))}</span>` : ''}<div>${live}</div></div></div>
      ${m.live ? `<div class="hub-title" title="${escapeHtml(m.title)}">${escapeHtml(m.title)}</div><div class="muted">${escapeHtml(m.game || '')}</div>` : ''}
      <div class="btns">
        <button class="ghost small" data-hub="chat">💬 ${escapeHtml(t('Chat'))}</button>
        ${canAct && m.live ? `<button class="small${armed === m.login ? ' danger-solid' : ''}" data-hub="raid"${raid ? ' disabled' : ''}>🚀 ${escapeHtml(raidLabel)}</button>` : ''}
        ${canAct ? `<button class="ghost small" data-hub="invite">🤝 ${escapeHtml(t('Stream Together'))}</button>` : ''}
        <button class="ghost small" data-hub="open" title="${escapeHtml(t('Open on Twitch'))}">↗</button>
      </div>
    </div>`;
  }
  function render(s, force) {
    const h = s.hub || { list: [] };
    const connected = (s.twitchAccount || {}).status === 'connected';
    const key = I18N.lang + JSON.stringify([h, connected, armed]);
    if (document.activeElement !== membersEl) membersEl.value = (s.settings.hub.members || []).join(', ');
    if (!force && key === lastKey) return;
    lastKey = key;
    const STATUS = { empty: 'Add the crew’s channels above.', login: 'Log in with Twitch to see who is live.', ok: '', off: '' };
    $('#hubStatus').textContent = h.status === 'error' ? t(h.detail || 'error') : t(STATUS[h.status] || '') + (h.updatedAt ? (STATUS[h.status] ? ' · ' : '') + t('updated {time}', { time: new Date(h.updatedAt).toLocaleTimeString() }) : '');
    const sorted = [...(h.list || [])].sort((a, b) => (b.live - a.live) || (b.viewers - a.viewers) || a.login.localeCompare(b.login));
    listEl.innerHTML = sorted.map((m) => card(m, connected, h.raid)).join('');
    const rb = $('#raidBanner');
    rb.classList.toggle('hidden', !h.raid);
    if (h.raid) rb.innerHTML = `<span>🚀 ${escapeHtml(t('Raid to {name} started: Twitch is counting down on your stream.', { name: h.raid.login }))}</span><button class="ghost" data-hub="cancel-raid">${escapeHtml(t('Cancel the raid'))}</button>`;
  }

  async function onHubClick(e) {
    const b = e.target.closest('[data-hub]');
    if (!b) return;
    const act = b.dataset.hub;
    if (act === 'cancel-raid') { if (await Panel.run('hub-raid-cancel', null, 'Raid cancelled')) render(Panel.state, true); return; }
    const login = b.closest('[data-login]').dataset.login;
    if (act === 'open') Panel.action('open-url', { url: 'https://www.twitch.tv/' + login });
    if (act === 'chat') openChat(login);
    if (act === 'invite') Panel.run('hub-invite', { login }, 'Invitation sent: they accept it on Twitch');
    if (act === 'raid') {
      // Two clicks: a raid moves your whole audience, so the first click only arms the button.
      if (armed !== login) { armed = login; clearTimeout(armTimer); armTimer = setTimeout(() => { armed = null; render(Panel.state, true); }, 4000); render(Panel.state, true); return; }
      armed = null; clearTimeout(armTimer);
      b.disabled = true;
      await Panel.run('hub-raid', { login }, 'Raid started');
      render(Panel.state, true);
    }
  }
  listEl.addEventListener('click', onHubClick);
  $('#raidBanner').addEventListener('click', onHubClick);

  // ---------- Chats (anonymous IRC, read-only; sending goes through the app) ----------
  const chats = new Map(); // login -> { el, list }
  let ws = null, wsTimer = 0, retryMs = 2000;
  function irc() {
    if (ws || !chats.size) return;
    const sock = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    ws = sock;
    sock.onopen = () => {
      retryMs = 2000;
      sock.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      sock.send('PASS SCHMOOPIIE');
      sock.send('NICK justinfan' + Math.floor(10000 + Math.random() * 80000));
      for (const l of chats.keys()) sock.send('JOIN #' + l);
    };
    sock.onmessage = (ev) => String(ev.data).split('\r\n').forEach(onLine);
    sock.onclose = () => {
      if (ws !== sock) return;
      ws = null;
      if (chats.size) { clearTimeout(wsTimer); wsTimer = setTimeout(irc, retryMs); retryMs = Math.min(30000, retryMs * 2); }
    };
  }
  function tagsOf(raw) { const o = {}; (raw || '').split(';').forEach((kv) => { const i = kv.indexOf('='); if (i > 0) o[kv.slice(0, i)] = kv.slice(i + 1).replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\'); }); return o; }
  // Twitch emotes: tag "id:start-end,start-end/id2:…", positions in Unicode code points.
  function withEmotes(text, emotes) {
    const chars = Array.from(text);
    const marks = [];
    (emotes || '').split('/').filter(Boolean).forEach((part) => {
      const [id, ranges] = part.split(':');
      if (!/^[\w-]+$/.test(id || '')) return;
      (ranges || '').split(',').forEach((r) => { const [a, b] = r.split('-').map(Number); if (b >= a) marks.push([a, b, id]); });
    });
    marks.sort((x, y) => x[0] - y[0]);
    let out = '', pos = 0;
    for (const [a, b, id] of marks) {
      if (a < pos) continue;
      out += escapeHtml(chars.slice(pos, a).join(''));
      const name = chars.slice(a, b + 1).join('');
      out += `<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/1.0" alt="${escapeHtml(name)}" title="${escapeHtml(name)}">`;
      pos = b + 1;
    }
    return out + escapeHtml(chars.slice(pos).join(''));
  }
  function onLine(line) {
    if (!line) return;
    if (line.startsWith('PING')) { if (ws) ws.send('PONG :tmi.twitch.tv'); return; }
    const m = line.match(/^(?:@(\S+) )?:(\S+?)(?:!\S+)? (\w+)(?: #(\S+))?(?: :(.*))?$/);
    if (!m) return;
    const [, rawTags, prefix, cmd, chan, text] = m;
    const c = chats.get(chan);
    if (!c) return;
    const tags = tagsOf(rawTags);
    if (cmd === 'PRIVMSG') {
      let msg = text || '';
      const me = msg.startsWith('\u0001ACTION ');
      if (me) msg = msg.slice(8, -1);
      const color = /^#[0-9a-f]{6}$/i.test(tags.color || '') ? tags.color : '#b9a3ff';
      add(c, `<span class="cname" style="color:${color}">${escapeHtml(tags['display-name'] || prefix)}</span>${me ? ' ' : ': '}<span${me ? ` style="color:${color}"` : ''}>${withEmotes(msg.slice(0, 500), tags.emotes)}</span>`);
    } else if (cmd === 'USERNOTICE' && tags['system-msg']) {
      add(c, `<span class="sys">★ ${escapeHtml(tags['system-msg'])}</span>${text ? ' ' + withEmotes(text, tags.emotes) : ''}`);
    } else if (cmd === 'ROOMSTATE' && !c.joined) {
      c.joined = true;
      add(c, `<span class="sys">${escapeHtml(t('Connected to the chat.'))}</span>`);
    }
  }
  function add(c, html) {
    const atBottom = c.list.scrollTop + c.list.clientHeight >= c.list.scrollHeight - 30;
    const div = document.createElement('div');
    div.className = 'cline';
    div.innerHTML = html;
    c.list.appendChild(div);
    while (c.list.childElementCount > MAX_LINES) c.list.firstElementChild.remove();
    if (atBottom) c.list.scrollTop = c.list.scrollHeight;
  }
  function openChat(login) {
    if (chats.has(login)) { chats.get(login).input.focus(); return; }
    if (chats.size >= MAX_CHATS) { toast(t('4 chats max: close one first')); return; }
    const el = document.createElement('div');
    el.className = 'chat';
    el.innerHTML = `<div class="chat-head"><b>#${escapeHtml(login)}</b><button class="ghost small" title="${escapeHtml(t('Close'))}">✕</button></div>
      <div class="chat-list"></div>
      <form class="chat-send"><input maxlength="500" placeholder="${escapeHtml(t('Send a message'))}"><button class="small">${escapeHtml(t('Send'))}</button></form>`;
    chatsEl.appendChild(el);
    const c = { el, list: el.querySelector('.chat-list'), input: el.querySelector('input'), joined: false };
    chats.set(login, c);
    el.querySelector('.chat-head button').onclick = () => closeChat(login);
    el.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const text = c.input.value.trim();
      if (!text) return;
      if ((Panel.state.twitchAccount || {}).status !== 'connected') { toast(t('Log in with Twitch to send messages')); return; }
      c.input.disabled = true;
      const r = await Panel.run('hub-say', { login, text });
      c.input.disabled = false;
      if (r) c.input.value = '';
      c.input.focus();
    };
    $('#chatsEmpty').classList.add('hidden');
    if (ws && ws.readyState === 1) ws.send('JOIN #' + login); else irc();
  }
  function closeChat(login) {
    const c = chats.get(login);
    if (!c) return;
    c.el.remove();
    chats.delete(login);
    if (ws && ws.readyState === 1) ws.send('PART #' + login);
    if (!chats.size) { $('#chatsEmpty').classList.remove('hidden'); if (ws) { const w = ws; ws = null; w.close(); } }
  }

  Panel.onState((s, langChanged) => render(s, langChanged));
})();
