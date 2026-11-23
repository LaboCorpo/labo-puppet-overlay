/*
 * Guides: one page per top tab, like "Discord setup". Steps turn green when the app sees they are done; the steps
 * the app cannot check get a "Done" tick (kept in this window). Each step has buttons to the right page.
 * Texts are built inside functions so they are re-translated when the language changes.
 */
(function () {
  'use strict';
  const { $$, t, escapeHtml } = Panel;
  const pretty = (acc) => escapeHtml(String(acc || '').replace('CommandOrControl', 'Ctrl')) || '—';
  const go = (tab, label) => ({ goto: tab, label });
  const link = (url, label) => ({ url, label });

  // Shared "handy" tips shown under every guide.
  const tips = () => [
    t('<b>Right-click</b> anywhere (outside a text field), <b>Alt+←</b> or the mouse back button: previous page. <b>Alt+→</b>: next page.'),
    t('<b>Ctrl+K</b>: jump to any page by typing its name.'),
    t('<b>Ctrl+1 … 5</b> or <b>Ctrl+Tab</b>: switch between the top tabs. Double-click a top tab to rename it.'),
    t('<b>?</b> at the top right (or <b>F1</b>): the tour of the current tab.'),
  ];

  const GUIDES = {
    puppet: (s) => ({
      title: t('Puppet Overlay — guide'),
      intro: t('Everyone in your Discord voice channel appears on your screen as a paper puppet that talks with them, on your desktop and in OBS.'),
      steps: [
        { title: t('Connect Discord'), body: t('Open the Discord <b>desktop</b> app (the browser version does not work). The first time, Discord asks you to authorize LaboHub: click <b>Authorize</b>. If it talks about testers, ask whoever manages the app to invite you as an App Tester.'),
          done: (s.discord || {}).status === 'connected', actions: [go('status', t('Status')), go('discord', t('Discord setup'))] },
        { title: t('Create your avatar'), body: t('Draw your puppet or start from a photo, then share it with the crew (code or .puppet file). Until then, your Discord picture is used.'),
          done: !!((s.discord || {}).me && (s.avatars || {})[s.discord.me.id]), actions: [go('avatars', t('Avatars'))] },
        { title: t('Place the puppets'), body: t('Layout, size and effects are in <b>Overlay</b>. To move them with the mouse: <b>{key}</b>, then <b>Esc</b>. Games must be in <b>borderless window</b> mode to show the overlay.', { key: pretty(s.settings.app.hotkeys.placement) }),
          actions: [go('overlay', t('Overlay'))] },
        { title: t('Show them in OBS'), body: t('In OBS: <b>Sources → + → Browser</b>, paste the address from <b>OBS / Streamlabs</b>, size 1920 × 1080. Changes made here apply live in OBS.'),
          actions: [go('obs', t('OBS / Streamlabs'))] },
        { title: t('Twitch viewers (optional)'), body: t('Type your channel in <b>Twitch viewers</b>: your chat shows up as puppets with speech bubbles, and viewers customise theirs with commands (<b>!puppet</b> lists them).'),
          done: !!(s.settings.twitch.enabled && s.settings.twitch.channel), actions: [go('twitch', t('Twitch viewers'))] },
      ],
    }),
    hud: (s) => {
      const acc = s.twitchAccount || {};
      const sounds = ['follow', 'sub', 'prime', 'gift', 'bits', 'raid'].some((k) => s.settings.alerts[k].sounds.length);
      return {
        title: t('Widget Twitch — guide'),
        intro: t('Everything on your stream: follower and sub counters, the song playing, the chat, game counters, your friends\' cameras, alert sounds and GIFs. One OBS Browser Source per widget.'),
        steps: [
          { title: t('Create the Twitch application (once for the whole Labo)'), body: t('On <b>dev.twitch.tv/console/apps</b> → <b>Register Your Application</b>: any unique name, OAuth redirect <code>http://localhost</code> (type it, do not click <i>Add</i>: the HTTPS warning goes away when you create), category <i>Application Integration</i>, client type <b>Public</b> → <b>Create</b>. Then <b>Manage</b> → copy the <b>Client ID</b> and share it with the crew: it is not a secret.'),
            done: acc.hasClientId !== false && acc.status !== 'no-client', actions: [link('https://dev.twitch.tv/console/apps', t('Open dev.twitch.tv')), go('stream', t('Paste the Client ID'))] },
          { title: t('Log in with Twitch'), body: t('In <b>Stream widgets</b>, click <b>Log in with Twitch</b>: Twitch shows a code to confirm on twitch.tv/activate. No password is typed in LaboHub.'),
            done: acc.status === 'connected', actions: [go('stream', t('Stream widgets'))] },
          { title: t('Add the widgets to OBS'), body: t('Copy a widget address, then in OBS: <b>Sources → + → Browser</b> → paste. Each widget is its own source: move and resize it freely. LaboHub must stay open while you stream.'),
            actions: [go('stream', t('Stream widgets'))] },
          { title: t('Make them yours'), body: t('Each widget has its page: themes, colours, text, icon, animations, <b>your pictures</b> (background, icon) and even <b>your own CSS code</b>. <b>Save this look</b> keeps it as a template for the other widgets.'),
            actions: [go('w-spotify', t('Customise the widgets'))] },
          { title: t('Game counters'), body: t('Deaths, wins, losses: create them in <b>Game counters</b>, give each one a shortcut (e.g. <b>Alt+1</b>: one more loss) and copy its OBS link. Viewers can see it with <b>!command</b>.'),
            done: (s.settings.lab.counters || []).length > 0, actions: [go('w-gameCounter', t('Game counters')), go('deck-keys', t('Recommended keys'))] },
          { title: t('Your friends\' cameras'), body: t('In <b>Friends\' cams</b>, add a friend and send them <b>their link</b>: they open it, choose their camera, click Start. Their camera becomes a source in your OBS (alone or all together in one scene).'),
            done: (s.settings.savane.friends || []).length > 0, actions: [go('cams', t('Friends\' cams'))] },
          { title: t('Alert sounds and GIFs'), body: t('Put your sounds and GIFs in the <b>Son Twitch</b> folder (📂 button), then choose them for each event, with a GIF if you like. Add the <i>Alerts (GIF + sound)</i> widget to OBS to see the GIFs.'),
            done: sounds, actions: [go('alerts', t('Alert sounds'))] },
          { title: t('The song playing'), body: t('Open the Spotify <b>desktop</b> app: the song, its album cover and its progress show up on their own in the Spotify widget. Keep Spotify open (minimized is fine).'),
            done: (s.nowPlaying || {}).status === 'running', actions: [go('w-spotify', t('Spotify widget'))] },
        ],
      };
    },
    hub: (s) => {
      const acc = s.twitchAccount || {};
      return {
        title: t('Hub Labo — guide'),
        intro: t('Your stream and the Labo: title and category, giveaway and poll, stream health; who is live in the crew, their chats, raids, and the moments to clip.'),
        steps: [
          { title: t('Log in with Twitch'), body: t('Needed for My stream, to see who is live and to act on their channels (same account as Widget Twitch).'),
            done: acc.status === 'connected', actions: [go('stream', t('Twitch account'))] },
          { title: t('My stream'), body: t('Change your title and category (with presets), run a <b>giveaway</b> or a <b>chat poll</b> (each one has its OBS overlay), get warned before ads, post “I\'m live” in Discord and tick your checklist.'),
            done: (s.settings.lab.profiles || []).length > 0, actions: [go('mystream', t('My stream'))] },
          { title: t('Stream health'), body: t('Connect OBS (in My stream or BabaDeck → OBS connection): FPS, dropped frames and network show up, and LaboHub warns you when the stream struggles.'),
            done: (s.obs || {}).status === 'connected', actions: [go('mystream', t('My stream'))] },
          { title: t('Add the crew'), body: t('In <b>Friends\' streams</b>, type the Labo\'s Twitch channels, separated by commas. You get a notification when one of them goes live.'),
            done: (s.settings.hub.members || []).length > 0, actions: [go('hub', t("Friends' streams"))] },
          { title: t('Raid, collab, chat'), body: t('<b>Raid</b>: two clicks to confirm, then Twitch counts down on your stream. <b>Collab</b>: open Stream Together in your Twitch Stream Manager first, then invite. <b>Watch &amp; chat</b>: their video and chat in Multi-stream.'),
            actions: [go('hub', t("Friends' streams"))] },
          { title: t('Multi-stream: videos + merged chats'), body: t('Up to 6 channels with their video (bigger, smaller, minimised). During a collab, <b>Merge the chats</b>: one chat titled “you x your friend”. Hover a message to delete it, time out or ban (your channel, or where you are a moderator).'),
            actions: [go('room', t('Multi-stream'))] },
          { title: t('Mark the moments to clip'), body: t('While live, press <b>{key}</b> (works in game), use the button in <b>Clips</b>, or type <b>!{cmd} [note]</b> in your chat (you and your mods). Each timestamp keeps the moment in the stream.', { key: pretty(s.settings.app.hotkeys.marker), cmd: escapeHtml(s.settings.markers.commandName) }),
            done: (s.markers || []).length > 0, actions: [go('markers', t('Clips'))] },
          { title: t('Make your clips from the VOD'), body: t('Turn on <b>Store past broadcasts</b> on Twitch. In <b>Clips</b>, “VOD at this moment” opens the VOD {n} s before the moment; tick “Clip done” as you go. VODs are kept 7 days (60 for Partners).', { n: s.settings.markers.leadSeconds }),
            done: (s.markers || []).some((m) => m.done), actions: [go('markers', t('Clips'))] },
        ],
      };
    },
  };

  GUIDES.deck = (s) => {
    const o = s.obs || {}, deck = s.settings.deck || {};
    const hasKeys = (deck.pages || []).some((p) => p.buttons.some((b) => b && b.hotkey));
    return {
      title: t('BabaDeck — guide'),
      intro: t('Your Stream Deck without the hardware: buttons that switch OBS scenes, mute your mic, start the stream, create a clip, play a sound, change a game counter… Each button can run several actions and have its own shortcut, which works in game.'),
      steps: [
        { title: t('Connect OBS'), body: t('In OBS: <b>Tools → WebSocket Server Settings</b>, tick “Enable WebSocket server”, then “Show Connect Info”. In <b>OBS connection</b>, tick “Connect to OBS Studio” and paste the password.'),
          done: o.status === 'connected', actions: [go('deck-obs', t('OBS connection'))] },
        { title: t('Make your buttons'), body: t('<b>✨ Starter</b> in the dock creates buttons from your OBS scenes. To make your own: click an empty slot (＋), then choose label, emoji, colour and actions. <b>Right-click</b> a button to edit it; drag it to move it.'),
          done: (deck.pages || []).some((p) => p.buttons.some(Boolean)), actions: [go('deck', 'BabaDeck')] },
        { title: t('Give them shortcuts'), body: t('In the button (right-click) or in <b>Shortcuts</b>: click the field and press your combination. The list of <b>recommended keys</b> (QWERTY and AZERTY) shows the ones games leave alone.'),
          done: hasKeys, actions: [go('deck-keys', t('Shortcuts'))] },
        { title: t('See your shortcuts on screen'), body: t('🏷 <b>Strip</b> in the dock: a small bar on top of your game shows your shortcuts and their state (muted mic, live, counters). It lets clicks through; move and resize it in Shortcuts.'),
          done: !!(deck.hud && deck.hud.enabled), actions: [go('deck-keys', t('Shortcuts'))] },
        { title: t('Keep it at hand'), body: t('🗔 <b>Floating</b> opens the deck in its own window (clickable), on top of your game if you want. Channel points rewards can also press a button (Shortcuts page).'),
          actions: [go('deck', 'BabaDeck')] },
      ],
    };
  };
  GUIDES.bababot = (s) => {
    const acc = s.twitchAccount || {}, c = s.settings.lab;
    return {
      title: t('{name} — guide', { name: Panel.groupName('bababot') }),
      intro: t('A chat bot that answers in your Twitch chat with your own account, while LaboHub is open: your commands, timers, welcome messages, thanks for raids and sound commands.'),
      steps: [
        { title: t('Log in with Twitch'), body: t('The bot writes with your account: log in once in Widget Twitch → Stream widgets.'),
          done: acc.status === 'connected', actions: [go('stream', t('Twitch account'))] },
        { title: t('Your commands'), body: t('Tick <b>Bot on</b>, then add commands: <code>!discord</code>, <code>!planning</code>… Variables: <code>{name}</code>, <code>{game}</code>, <code>{uptime}</code>, <code>{random:a|b}</code>.'),
          done: !!c.chatbot.enabled, actions: [go('bb-cmds', t('Commands'))] },
        { title: t('Automatic messages'), body: t('Timers while you are live (only if the chat moved), a welcome for first-time chatters, a thank-you when someone raids you.'),
          done: c.chatbot.timers.length > 0 || c.chatbot.welcome || c.raidThanks.enabled, actions: [go('bb-msgs', t('Automatic messages'))] },
        { title: t('Sound commands'), body: t('Put sounds in the <b>Son Twitch</b> folder, choose them here: viewers type <code>!name</code> to play one on stream (with a cooldown).'),
          done: c.sounds.list.length > 0, actions: [go('bb-sounds', t('Sound commands'))] },
        { title: t('Test it'), body: t('Type a command in your own chat: the answer comes within a second or two. Nothing? Check that LaboHub is open and that you are logged in.'),
          actions: [go('bb-cmds', t('Commands'))] },
      ],
    };
  };

  // Steps the app cannot check: ticked by hand, kept in this window.
  const ticks = () => { try { return JSON.parse(localStorage.getItem('guideTicks')) || {}; } catch (e) { return {}; } };
  function setTick(id, on) { const all = ticks(); if (on) all[id] = 1; else delete all[id]; try { localStorage.setItem('guideTicks', JSON.stringify(all)); } catch (e) { /* storage disabled */ } }
  const lastKey = {};
  function render(sec, s, force) {
    const gk = sec.dataset.guide;
    const g = GUIDES[gk](s);
    const tk = ticks();
    g.steps.forEach((x, i) => { if (x.done === undefined) { x.manual = true; x.done = !!tk[gk + ':' + i]; } });
    const key = I18N.lang + JSON.stringify(g.steps.map((x) => [x.done, x.body]));
    if (!force && key === lastKey[gk]) return;
    lastKey[gk] = key;
    const checkable = g.steps;
    const done = checkable.filter((x) => x.done).length;
    const btn = (a, i) => a.goto
      ? `<button class="${i ? 'ghost ' : ''}small" data-goto="${a.goto}">${escapeHtml(a.label)} →</button>`
      : `<button class="ghost small" data-url="${escapeHtml(a.url)}">${escapeHtml(a.label)} ↗</button>`;
    sec.innerHTML = `<h1>${escapeHtml(g.title)}</h1>
      <p class="guide-intro">${escapeHtml(g.intro)}</p>
      <div class="muted">${escapeHtml(t('{done} of {total} done', { done, total: checkable.length }))}</div>
      <div class="guide-progress"><i style="width:${checkable.length ? Math.round((done / checkable.length) * 100) : 0}%"></i></div>
      ${g.steps.map((st, i) => `<div class="card gstep${st.done ? ' done' : ''}"><div class="gnum">${st.done ? '✓' : i + 1}</div>
        <div><h3>${escapeHtml(st.title)}</h3><p>${st.body}</p><div class="btns">${st.actions.map(btn).join('')}${st.manual ? `<label class="check inline gtick"><input type="checkbox" data-tick="${gk}:${i}"${st.done ? ' checked' : ''}> ${escapeHtml(t('Done'))}</label>` : ''}</div></div></div>`).join('')}
      <div class="card guide-tips"><h3 style="margin:0">${escapeHtml(t('Handy'))}</h3><ul>${tips().map((x) => `<li>${x}</li>`).join('')}</ul></div>`;
  }

  document.addEventListener('change', (e) => {
    const tick = e.target.closest('[data-tick]');
    if (!tick) return;
    setTick(tick.dataset.tick, tick.checked);
    const sec = tick.closest('[data-guide]');
    if (sec) render(sec, Panel.state, true);
  });
  document.addEventListener('click', (e) => {
    const u = e.target.closest('[data-url]');
    if (u && u.closest('[data-guide]')) { e.preventDefault(); Panel.action('open-url', { url: u.dataset.url }); }
  });
  Panel.onState((s, langChanged) => $$('[data-guide]').forEach((sec) => render(sec, s, langChanged)));
})();
