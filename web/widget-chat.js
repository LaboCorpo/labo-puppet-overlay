/*
 * OBS widget "Live chat" (widget.html?w=chat): reads Twitch chat itself (anonymous IRC, shared/twitchchat.js)
 * for your channel or the channels set in widgets.chat.channels (merged, one colour per channel).
 * Style comes from the widget look (same editor as the other widgets). Deleted / timed-out messages vanish.
 * Badge pictures are asked to the app (needs the Twitch account; without it, no badges).
 */
(function () {
  'use strict';
  const BOTS = new Set(['nightbot', 'streamelements', 'streamlabs', 'moobot', 'fossabot', 'wizebot', 'soundalerts', 'sery_bot', 'kofistreambot', 'botrixoficial']);
  const CHAN_COLORS = ['#a970ff', '#2fd4a3', '#ff7a45', '#3d8bff', '#ff4fa3', '#ffc93c'];
  const DEMO_LINES = [
    ['pixelcat', '#ff6b9d', 'GG that was clean'], ['Bobby_42', '#4fc3f7', 'first time here, love the puppets'], ['MamieGaming', '#ffd166', 'Kappa Kappa'],
    ['kiwi', '#06d6a0', 'what game is this?'], ['ZeroCool', '#ef476f', 'LUL the jump'], ['tartiflette', '#c77dff', 'hello the Labo!'],
  ];

  function create(api) {
    const { root, esc, t } = api;
    const chat = new TwitchChat();
    let look = null, box = null, channels = [], badges = { global: {}, rooms: {} }, badgeKey = '', demoTimer = 0;
    const roomIds = {};

    function chanColor(c) { return CHAN_COLORS[Math.max(0, channels.indexOf(c)) % CHAN_COLORS.length]; }
    function build(lk, cssVars) {
      look = lk;
      const label = lk.showLabel ? `<div class="chat-title">${esc(lk.label || titleText())}</div>` : '';
      root.innerHTML = `<div class="chatw l-${lk.layout} n-${lk.newest}${lk.uppercase ? ' up' : ''}" style="${esc(cssVars)}">${label}<div class="chat-msgs"></div></div>`;
      box = root.querySelector('.chat-msgs');
      if (api.demo) startDemo();
    }
    function titleText() { return channels.length > 1 ? channels.join(' x ') : t('Chat'); }

    function setState(state) {
      if (api.demo) return;
      const st = state.settings;
      if (!st) return;
      const own = (st.twitch && st.twitch.channel) || (state.twitchAccount && state.twitchAccount.login) || '';
      const list = (st.widgets.chat && st.widgets.chat.channels && st.widgets.chat.channels.length) ? st.widgets.chat.channels : own ? [own] : [];
      if (list.join() !== channels.join()) { channels = list.slice(); chat.setChannels(channels); const tt = root.querySelector('.chat-title'); if (tt && !look.label) tt.textContent = titleText(); }
    }

    function line(m) {
      const lk = look;
      if (!lk || !box) return;
      if (lk.hideCommands && /^!/.test(m.text)) return;
      if (lk.hideBots && BOTS.has(m.login)) return;
      const name = lk.nameColor === 'twitch' ? (m.color || lk.accent) : lk.nameColor === 'accent' ? lk.accent : lk.textColor;
      const map = Object.assign({}, badges.global, badges.rooms[m.roomId] || {});
      const bdg = lk.showBadges ? TwitchChat.badgeHtml(m.badges, map, 'cbadge') : '';
      const ch = lk.showChannel && channels.length > 1 ? `<span class="cchan" style="--cc:${chanColor(m.channel)}">${esc(m.channel)}</span>` : '';
      const el = document.createElement('div');
      el.className = `cmsg wg f-${lk.frame} sh-${lk.shadow}${lk.entrance !== 'none' ? ' enter in-' + lk.entrance : ''}${m.first && lk.highlightFirst ? ' first' : ''}${m.action ? ' me' : ''}`;
      el.dataset.id = m.id || '';
      el.dataset.user = m.userId || '';
      el.dataset.chan = m.channel || '';
      el.style.setProperty('--nc', name);
      const nm = `<span class="cname">${bdg}${ch}<b>${esc(m.display)}</b></span>`;
      el.innerHTML = lk.layout === 'bubbles' ? `${nm}<span class="ctext">${TwitchChat.emoteHtml(m.text, m.emotes, 2)}</span>` : `${nm}<span class="csep">${m.action ? ' ' : ':'}</span> <span class="ctext">${TwitchChat.emoteHtml(m.text, m.emotes, 2)}</span>`;
      if (lk.newest === 'top') box.prepend(el); else box.appendChild(el);
      const extra = box.childElementCount - lk.maxMessages;
      for (let i = 0; i < extra; i++) (lk.newest === 'top' ? box.lastElementChild : box.firstElementChild).remove();
      if (lk.fadeAfter > 0) setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 600); }, lk.fadeAfter * 1000);
    }
    function remove(sel) { if (box) box.querySelectorAll(sel).forEach((el) => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }); }

    chat.on('message', line);
    chat.on('delete', (d) => remove(`.cmsg[data-id="${CSS.escape(d.id)}"]`));
    chat.on('clear', (c) => remove(c.userId ? `.cmsg[data-user="${CSS.escape(c.userId)}"]` : `.cmsg[data-chan="${CSS.escape(c.channel)}"]`));
    chat.on('room', (r) => {
      roomIds[r.channel] = r.roomId;
      const ids = Object.values(roomIds).filter(Boolean).sort();
      if (ids.join() === badgeKey) return;
      badgeKey = ids.join();
      fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'chat-badges', rooms: ids }) })
        .then((x) => x.json()).then((j) => { if (j && j.badges) badges = j.badges; }).catch(() => {});
    });

    let demoI = 0;
    function demoLine() {
      const [d, color, text] = DEMO_LINES[demoI++ % DEMO_LINES.length];
      line({ id: String(Math.random()), channel: 'demo', login: d.toLowerCase(), display: d, color, text, emotes: '', badges: [], first: demoI === 2 });
    }
    function startDemo() {
      clearInterval(demoTimer);
      for (let i = 0; i < Math.min(4, look.maxMessages); i++) demoLine();
      demoTimer = setInterval(demoLine, 2600);
    }
    return { build, setState, test: demoLine };
  }
  window.WidgetChat = { create };
})();
