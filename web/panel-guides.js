/*
 * Guides: one page per top tab (Puppet Overlay, HUD Twitch, Hub Labo), like "Discord setup".
 * Steps turn green when the app sees they are done; each has buttons to the right page.
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
    t('<b>Ctrl+1 … 6</b> or <b>Ctrl+Tab</b>: switch between the top tabs.'),
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
        title: t('HUD Twitch — guide'),
        intro: t('Everything on your stream: live follower and sub counters, the song playing in Spotify, and alert sounds for follows, subs, bits and raids.'),
        steps: [
          { title: t('Create the Twitch application (once for the whole Labo)'), body: t('On <b>dev.twitch.tv/console/apps</b> → <b>Register Your Application</b>: any unique name, OAuth redirect <code>http://localhost</code> (type it, do not click <i>Add</i>: the HTTPS warning goes away when you create), category <i>Application Integration</i>, client type <b>Public</b> → <b>Create</b>. Then <b>Manage</b> → copy the <b>Client ID</b> and share it with the crew: it is not a secret.'),
            done: acc.hasClientId !== false && acc.status !== 'no-client', actions: [link('https://dev.twitch.tv/console/apps', t('Open dev.twitch.tv')), go('stream', t('Paste the Client ID'))] },
          { title: t('Log in with Twitch'), body: t('In <b>Stream widgets</b>, click <b>Log in with Twitch</b>: Twitch shows a code to confirm on twitch.tv/activate. No password is typed in LaboHub.'),
            done: acc.status === 'connected', actions: [go('stream', t('Stream widgets'))] },
          { title: t('Add the widgets to OBS'), body: t('Copy a widget address, then in OBS: <b>Sources → + → Browser</b> → paste. Each widget is its own source: move and resize it freely. LaboHub must stay open while you stream.'),
            actions: [go('stream', t('Stream widgets'))] },
          { title: t('Customise each widget'), body: t('Each widget has its own page under <b>Stream widgets</b> in the left menu, with one menu per category: themes, appearance, picture (album cover, profile picture), colours, text, sizes, icon, animations and content. The preview changes as you edit.'),
            actions: [go('w-spotify', t('Customise the widgets'))] },
          { title: t('Alert sounds'), body: t('Add MP3 files for each event and choose <b>Random</b>, <b>In order</b> or <b>All together</b>. “This app” is picked up by OBS Desktop Audio; “OBS” needs the <i>Alert sounds</i> widget.'),
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
        intro: t('The Labo corner: see who is live, read and write in their chats, raid them or invite them to stream together, and keep track of the moments to clip from your own lives.'),
        steps: [
          { title: t('Log in with Twitch'), body: t('Needed to see who is live and to act on their channels (same account as HUD Twitch).'),
            done: acc.status === 'connected', actions: [go('hub', t("Friends' streams"))] },
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

  GUIDES.savane = (s) => ({
    title: t('La savane — guide'),
    intro: t('A video room for the Labo, like VDO.Ninja: everyone joins with the camera and microphone of their choice (microphones start muted), you lay out the scene, and every camera is also available alone in OBS.'),
    steps: [
      { title: t('Choose the room'), body: t('Everyone in the crew uses the same room name and password: create them once in <b>The room</b>, then send them with “Copy the invitation”.'),
        done: !!(s.settings.savane && s.settings.savane.room), actions: [go('savane', t('The room'))] },
      { title: t('Join with your camera'), body: t('Click <b>Join</b>: in the window, pick your camera, microphone and quality, then <b>Start</b>. Your microphone starts <b>muted</b>: the 🔇 button turns it on.'),
        actions: [go('savane', t('The room'))] },
      { title: t('Lay out the scene'), body: t('In the room window, <b>🎨 Customise</b>: drag the cameras, resize them, pick a background, a logo, a title. What you see is what OBS shows.'),
        actions: [go('savane-scene', t('Scene & OBS'))] },
      { title: t('Put it in OBS'), body: t('<b>📺 OBS links</b> (room window or Scene &amp; OBS): one link for the whole room, and one per camera (with or without its frame) to place them yourself in your scenes.'),
        actions: [go('savane-scene', t('Scene & OBS'))] },
    ],
  });
  GUIDES.deck = (s) => {
    const o = s.obs || {};
    return {
      title: t('BabaDeck — guide'),
      intro: t('Your Stream Deck without the hardware: buttons that switch OBS scenes, mute your mic, start the stream, create a clip, play a sound… Each button can run several actions and have its own shortcut.'),
      steps: [
        { title: t('Connect OBS'), body: t('In OBS: <b>Tools → WebSocket Server Settings</b>, tick “Enable WebSocket server”. Then in <b>OBS &amp; stream health</b>, tick “Connect to OBS Studio” and paste the password.'),
          done: o.status === 'connected', actions: [go('obsws', t('OBS & stream health'))] },
        { title: t('Make your buttons'), body: t('<b>✨ Starter page</b> creates buttons from your OBS scenes. Or tick <b>Edit</b> and click a slot: label, emoji, colour, actions and shortcut.'),
          done: ((s.settings.deck || {}).pages || []).some((p) => p.buttons.some(Boolean)), actions: [go('deck', 'BabaDeck')] },
        { title: t('Keep it at hand'), body: t('The <b>floating deck</b> stays on top of your game; the shortcuts work even in full screen.'),
          actions: [go('deck', 'BabaDeck')] },
      ],
    };
  };

  const lastKey = {};
  function render(sec, s, force) {
    const g = GUIDES[sec.dataset.guide](s);
    const key = I18N.lang + JSON.stringify(g.steps.map((x) => [x.done, x.body]));
    if (!force && key === lastKey[sec.dataset.guide]) return;
    lastKey[sec.dataset.guide] = key;
    const checkable = g.steps.filter((x) => x.done !== undefined);
    const done = checkable.filter((x) => x.done).length;
    const btn = (a, i) => a.goto
      ? `<button class="${i ? 'ghost ' : ''}small" data-goto="${a.goto}">${escapeHtml(a.label)} →</button>`
      : `<button class="ghost small" data-url="${escapeHtml(a.url)}">${escapeHtml(a.label)} ↗</button>`;
    sec.innerHTML = `<h1>${escapeHtml(g.title)}</h1>
      <p class="guide-intro">${escapeHtml(g.intro)}</p>
      <div class="muted">${escapeHtml(t('{done} of {total} done', { done, total: checkable.length }))}</div>
      <div class="guide-progress"><i style="width:${checkable.length ? Math.round((done / checkable.length) * 100) : 0}%"></i></div>
      ${g.steps.map((st, i) => `<div class="card gstep${st.done ? ' done' : ''}"><div class="gnum">${st.done ? '✓' : i + 1}</div>
        <div><h3>${escapeHtml(st.title)}</h3><p>${st.body}</p><div class="btns">${st.actions.map(btn).join('')}</div></div></div>`).join('')}
      <div class="card guide-tips"><h3 style="margin:0">${escapeHtml(t('Handy'))}</h3><ul>${tips().map((x) => `<li>${x}</li>`).join('')}</ul></div>`;
  }

  document.addEventListener('click', (e) => {
    const u = e.target.closest('[data-url]');
    if (u && u.closest('[data-guide]')) { e.preventDefault(); Panel.action('open-url', { url: u.dataset.url }); }
  });
  Panel.onState((s, langChanged) => $$('[data-guide]').forEach((sec) => render(sec, s, langChanged)));
})();
