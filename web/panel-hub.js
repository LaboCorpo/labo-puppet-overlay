/*
 * Panel tab "Streaming hub": who in the crew is live, raid / Stream Together / open on Twitch,
 * "Watch & chat" adds the channel to the multi-stream room (panel-room.js).
 */
(function () {
  'use strict';
  const { $, t, escapeHtml, toast } = Panel;
  const listEl = $('#hubList');
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
        <button class="ghost small" data-hub="chat">💬 ${escapeHtml(t(m.live ? 'Watch & chat' : 'Chat'))}</button>
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
    if (act === 'chat') { window.PanelRoom.add(login); Panel.showTab('room'); }
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

  Panel.onState((s, langChanged) => render(s, langChanged));
})();
