/*
 * First-run setup (language + tabs, unless the installer already asked), the tours (one per top tab: the first time
 * it is opened, a few highlighted steps; "?" or F1 replays it) and Settings → Tabs (keep / rename the top tabs).
 * Tours done or skipped are kept in settings.app.tours. Texts are built in functions so they follow the language.
 */
(function () {
  'use strict';
  const { $, $$, t, escapeHtml: esc } = Panel;
  const DESC = {
    puppet: 'Your Discord voice channel as paper puppets, on your screen and in OBS.',
    hud: 'Widgets for OBS: counters, Spotify, chat, game counters, friends\' cams, alert sounds and GIFs.',
    hub: 'Your stream (title, giveaway, poll, health…) and the crew: who is live, multi-stream, clips.',
    deck: 'A Stream Deck on your screen: buttons, shortcuts that work in game, OBS control.',
    bababot: 'A chat bot that answers with your Twitch account: commands, timers, sound commands.',
  };
  const ICON = (g) => `<svg class="gi"><use href="#ic-${g}"/></svg>`;

  // ---------- Tours ----------
  // { tab: page to show first, sel: element to highlight (missing = centred), title, text }
  const TOURS = {
    puppet: () => [
      { sel: '.gtabs', title: t('Your tools'), text: t('LaboHub has one tab per tool. Double-click a tab to rename it; Settings → Tabs hides the ones you don\'t use.') },
      { tab: 'status', sel: '.side', title: t('The pages'), text: t('Each tab has its pages here. <b>Guide</b> lists the steps to set it up: tick them as you go.') },
      { tab: 'status', sel: '.preview', title: t('Your crew as puppets'), text: t('Everyone in your Discord voice channel appears here and on your screen, as a paper puppet that talks with them.') },
      { tab: 'avatars', sel: '#openCreator', title: t('Your puppet'), text: t('Draw your puppet or start from a photo, then share it with the crew.') },
      { tab: 'overlay', sel: 'section[data-panel="overlay"] .card', title: t('On your screen'), text: t('Size, position, entrances… <b>Ctrl+Shift+P</b> moves the puppets with the mouse.') },
      { tab: 'obs', sel: '#urlAll', title: t('In OBS'), text: t('Paste this address in an OBS <b>Browser Source</b> to show the puppets on stream.') },
      { sel: '#helpBtn', title: t('Help'), text: t('Replay this tour any time with <b>?</b> (or F1).') },
    ],
    hud: () => [
      { tab: 'stream', sel: 'section[data-panel="stream"] [data-twitch-account]', title: t('Your Twitch account'), text: t('Log in with Twitch here: the counters, the follows and the bot need it. No password is typed in LaboHub.') },
      { tab: 'stream', sel: '#widgetList', title: t('One widget = one OBS source'), text: t('Copy a widget\'s link and add it to OBS as a <b>Browser Source</b>, then move and resize it freely.') },
      { tab: 'w-spotify', sel: '#weMenu', title: t('Make them yours'), text: t('Each widget has its page: themes, colours, your pictures, animations, even your own CSS code. Save a look as <b>My template</b> to reuse it.') },
      { tab: 'w-gameCounter', sel: '#weCounters', title: t('Game counters'), text: t('Deaths, wins, losses… Give each one a shortcut (e.g. Alt+1) to change it in game, without leaving it.') },
      { tab: 'cams', sel: 'section[data-panel="cams"] .card', title: t('Friends\' cams'), text: t('Add a friend, send them their link: their camera becomes a source in your OBS.') },
      { tab: 'alerts', sel: 'section[data-panel="alerts"] [data-open-media]', title: t('The Son Twitch folder'), text: t('Drop your sounds and GIFs in this folder, then choose them for each alert.') },
      { tab: 'alerts', sel: '#alertEvents', title: t('Alert sounds'), text: t('Several sounds per event (follow, sub, bits, raid…), with a GIF on stream if you want.') },
    ],
    hub: () => [
      { tab: 'mystream', sel: '#myLive', title: t('My stream'), text: t('Your live at a glance: title, category with its picture, viewers.') },
      { tab: 'mystream', sel: '#ltTitle', title: t('Title & category'), text: t('Change them without opening Twitch, and keep presets for your usual streams.') },
      { tab: 'mystream', sel: '#lgStatus', title: t('Giveaway & poll'), text: t('Your viewers enter or vote from the chat; each one has its overlay for OBS.') },
      { tab: 'mystream', sel: '#obsHealth', title: t('Stream health'), text: t('With OBS connected: FPS, dropped frames, network. LaboHub warns you if your stream struggles.') },
      { tab: 'hub', sel: '#hubMembers', title: t('The crew'), text: t('Add the crew\'s channels: you see who is live (with their game), raid them, chat with them.') },
      { tab: 'room', sel: 'section[data-panel="room"] .room-head', title: t('Multi-stream'), text: t('Their videos and chats side by side, or merged during a collab.') },
      { tab: 'markers', sel: '#markNow', title: t('Clips'), text: t('Mark a moment while live (even in game, with a shortcut), then make the clip from the VOD.') },
    ],
    deck: () => [
      { tab: 'deck', sel: '#deckDock', title: t('The dock'), text: t('Pages, grid size, a ready-made starter page, the floating deck, the shortcut strip and OBS.') },
      { tab: 'deck', sel: '#deckView', title: t('Your buttons'), text: t('<b>Click</b> a button to run it. <b>Right-click</b> it to edit it (label, emoji, colour, shortcut, actions). Drag it to move it.') },
      { tab: 'deck-keys', sel: '#keyRecs', title: t('Which keys?'), text: t('Shortcuts work in game. Here are the keys games leave alone, for QWERTY and AZERTY keyboards.') },
      { tab: 'deck-keys', sel: '#hudPlace', title: t('The shortcut strip'), text: t('A small strip on top of your game that shows your shortcuts and their state (muted mic, live…). It never catches your clicks.') },
      { tab: 'deck-obs', sel: 'section[data-panel="deck-obs"] .obs-connect', title: t('Connect OBS'), text: t('To switch scenes, mute your mic or go live from your buttons.') },
    ],
    bababot: () => [
      { tab: 'bb-cmds', sel: '#lcCmds', title: t('Your commands'), text: t('!discord, !planning… The bot answers in your chat with your account. Variables: {name}, {game}, {uptime}…') },
      { tab: 'bb-msgs', sel: '#lcTimers', title: t('Automatic messages'), text: t('Timers while you are live, a welcome for newcomers, a thank-you for raids.') },
      { tab: 'bb-sounds', sel: '#lcPickSound', title: t('Sound commands'), text: t('Pick sounds in the Son Twitch folder: viewers type !name to play them on stream.') },
      { sel: '.gtab[data-group="bababot"]', title: t('Your bot, your name'), text: t('Double-click this tab to rename it.') },
    ],
  };
  const tourEl = $('#tour'), hole = $('#tourHole'), tip = $('#tourTip');
  let tour = null; // { g, steps, i }
  function startTour(g, force) {
    const s = Panel.state.settings;
    if (!s || !TOURS[g] || tour) return;
    if (!force && (s.app.tours || []).includes(g)) return;
    tour = { g, steps: TOURS[g](), i: 0 };
    document.body.classList.add('touring');
    tourEl.classList.remove('hidden');
    show();
  }
  function endTour(saveDone) {
    if (!tour) return;
    const g = tour.g;
    tour = null;
    tourEl.classList.add('hidden');
    document.body.classList.remove('touring');
    const s = Panel.state.settings;
    if (saveDone && s && !(s.app.tours || []).includes(g)) { s.app.tours = (s.app.tours || []).concat(g); Panel.save('app.tours', s.app.tours); }
  }
  const visible = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  function show() {
    const st = tour.steps[tour.i];
    if (st.tab && Panel.tab !== st.tab) Panel.showTab(st.tab);
    // Let the page render, then scroll the target into view and measure it.
    setTimeout(() => {
      if (!tour) return;
      const el = st.sel ? [...document.querySelectorAll(st.sel)].find(visible) : null;
      if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
      requestAnimationFrame(() => place(el, st));
    }, 80);
  }
  function place(el, st) {
    if (!tour) return;
    const n = tour.steps.length, i = tour.i;
    tip.innerHTML = `<div class="tour-count">${i + 1} / ${n} · ${esc(Panel.groupName(tour.g))}</div><h3>${esc(st.title)}</h3><p>${st.text}</p>
      <div class="btns"><button class="ghost small" data-tour="skip">${esc(t('Skip the tour'))}</button><span class="grow"></span>
      ${i ? `<button class="ghost small" data-tour="back">${esc(t('Back'))}</button>` : ''}<button class="small" data-tour="next">${esc(t(i === n - 1 ? 'Finish' : 'Next'))}</button></div>`;
    const W = innerWidth, H = innerHeight, pad = 8;
    let r = el ? el.getBoundingClientRect() : null;
    if (r) r = { x: Math.max(4, r.left - pad), y: Math.max(4, r.top - pad), w: Math.min(W - 8, r.width + 2 * pad), h: Math.min(H - 8, r.height + 2 * pad) };
    if (r && r.h > H * 0.7) r.h = H * 0.7; // a long element: highlight its top
    hole.style.cssText = r ? `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px` : `left:${W / 2}px;top:${H / 2}px;width:0;height:0`;
    tip.classList.toggle('center', !r);
    const tw = Math.min(380, W - 24), th = tip.offsetHeight || 180;
    let x, y;
    if (!r) { x = (W - tw) / 2; y = (H - th) / 2; }
    else {
      x = Math.min(Math.max(12, r.x), W - tw - 12);
      if (r.y + r.h + th + 16 < H) y = r.y + r.h + 12;
      else if (r.y - th - 16 > 0) y = r.y - th - 12;
      else { y = Math.min(H - th - 12, Math.max(12, r.y)); x = r.x + r.w + tw + 16 < W ? r.x + r.w + 12 : Math.max(12, r.x - tw - 12); }
    }
    tip.style.cssText = `left:${x}px;top:${y}px;width:${tw}px`;
    const next = tip.querySelector('[data-tour="next"]'); if (next) next.focus({ preventScroll: true });
  }
  tip.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tour]');
    if (!b || !tour) return;
    if (b.dataset.tour === 'skip') endTour(true);
    if (b.dataset.tour === 'back' && tour.i > 0) { tour.i--; show(); }
    if (b.dataset.tour === 'next') { if (tour.i < tour.steps.length - 1) { tour.i++; show(); } else endTour(true); }
  });
  // A click on the dark area goes on; Esc skips; arrows move.
  hole.addEventListener('click', () => { if (tour) tip.querySelector('[data-tour="next"]').click(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') { e.preventDefault(); if (tour) endTour(false); startTour(Panel.group, true); return; }
    if (!tour) return;
    if (e.key === 'Escape') { e.preventDefault(); endTour(true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); tip.querySelector('[data-tour="next"]').click(); }
    else if (e.key === 'ArrowLeft' && tour.i > 0) { e.preventDefault(); tour.i--; show(); }
  }, true);
  addEventListener('resize', () => { if (tour) show(); });
  $('#helpBtn').onclick = () => { if (tour) endTour(false); startTour(Panel.group, true); };
  $('#resetTours').onclick = () => { Panel.save('app.tours', []); Panel.state.settings.app.tours = []; Panel.toast(t('The tours will start again when you open each tab')); };
  // First visit of a top tab: its tour, as soon as nothing else is open ("What's new"…), while that tab is shown.
  let gen = 0; // only the latest request waits
  function tourWhenFree(g, delay) {
    const my = ++gen;
    let tries = 0;
    setTimeout(() => {
      const id = setInterval(() => {
        const s = Panel.state.settings;
        if (my !== gen || ++tries > 240 || Panel.group !== g || tour || !s || (s.app.tours || []).includes(g)) { clearInterval(id); return; }
        if (!$('.modal:not(.hidden)')) { clearInterval(id); startTour(g); }
      }, 500);
    }, delay || 0);
  }
  Panel.onGroup((g) => {
    const s = Panel.state.settings;
    if (s && s.app.setupDone && !tour && !(s.app.tours || []).includes(g)) tourWhenFree(g, 300);
  });

  // ---------- First-run setup ----------
  const setup = $('#setup');
  let suStep = 0, suTabs = null, suLang = '', suOpen = false;
  function openSetup() {
    const s = Panel.state.settings;
    suTabs = Object.assign({}, s.app.tabs);
    suLang = s.app.language === 'auto' ? '' : s.app.language;
    suStep = 0; suOpen = true;
    if (tour) endTour(false);
    setup.classList.remove('hidden');
    renderSetup();
  }
  function renderSetup() {
    if (!suOpen) return;
    $$('#setup [data-step]').forEach((el) => el.classList.toggle('on', Number(el.dataset.step) === suStep));
    $('#suDots').innerHTML = [0, 1, 2].map((i) => `<span class="${i <= suStep ? 'on' : ''}"></span>`).join('');
    $('#suBack').style.visibility = suStep ? 'visible' : 'hidden';
    $('#suNext').textContent = t(suStep === 2 ? 'Start' : 'Next');
    $('#suNext').disabled = suStep === 1 && !Object.values(suTabs).some(Boolean);
    $$('.setup-lang').forEach((b) => b.classList.toggle('on', b.dataset.lang === (suLang || I18N.lang)));
    $('#suTabs').innerHTML = Panel.GROUPS.map((g) => `<label class="setup-tab${suTabs[g] !== false ? ' on' : ''}" style="--gc:${{ puppet: '#ff7a45', hud: '#a970ff', hub: '#2fd4a3', deck: '#3d8bff', bababot: '#ff9f1c' }[g]}">
      <input type="checkbox" data-g="${g}"${suTabs[g] !== false ? ' checked' : ''}>${ICON(g)}<span><b>${esc(t(Panel.GROUP_NAMES[g]))}</b><small>${esc(t(DESC[g]))}</small></span></label>`).join('');
  }
  $$('.setup-lang').forEach((b) => (b.onclick = () => { suLang = b.dataset.lang; Panel.save('app.language', suLang); suStep = 1; setTimeout(renderSetup, 250); renderSetup(); }));
  $('#suTabs').addEventListener('change', (e) => { const g = e.target.dataset.g; if (g) { suTabs[g] = e.target.checked; renderSetup(); } });
  $('#suBack').onclick = () => { if (suStep > 0) { suStep--; renderSetup(); } };
  $('#suNext').onclick = async () => {
    if (suStep < 2) { suStep++; renderSetup(); return; }
    suOpen = false;
    setup.classList.add('hidden');
    const s = Panel.state.settings;
    s.app.setupDone = true; s.app.tabs = Object.assign({}, suTabs);
    await Panel.action('setup-done', { language: suLang || s.app.language, tabs: suTabs });
    Panel.save('app.welcomeDone', true);
    const first = Panel.groupOn(Panel.group) ? Panel.group : Panel.visibleGroups()[0];
    if (first) { Panel.openGroup(first); tourWhenFree(first, 400); }
  };
  $('#showSetup').onclick = openSetup;
  let asked = false;

  // ---------- Settings → Tabs ----------
  let tabsKey = '';
  function renderTabsCard(s) {
    const box = $('#tabSetup');
    const k = I18N.lang + JSON.stringify([s.app.tabs, s.app.tabNames]);
    if (k === tabsKey || box.contains(document.activeElement)) return;
    tabsKey = k;
    box.innerHTML = Panel.GROUPS.map((g) => `<div class="ts-row" data-g="${g}"><label class="check"><input type="checkbox" data-show${s.app.tabs[g] !== false ? ' checked' : ''}>${ICON(g)}</label>
      <input data-name maxlength="24" value="${esc(s.app.tabNames[g] || '')}" placeholder="${esc(t(Panel.GROUP_NAMES[g]))}"><span class="muted">${esc(t(DESC[g]))}</span></div>`).join('');
  }
  $('#tabSetup').addEventListener('change', (e) => {
    const row = e.target.closest('[data-g]');
    if (!row) return;
    const s = Panel.state.settings, g = row.dataset.g;
    if (e.target.matches('[data-show]')) {
      const tabs = Object.assign({}, s.app.tabs, { [g]: e.target.checked });
      if (!Object.values(tabs).some(Boolean)) { e.target.checked = true; Panel.toast(t('Keep at least one tab')); return; }
      s.app.tabs = tabs; Panel.save('app.tabs', tabs);
    }
    if (e.target.matches('[data-name]')) { const names = Object.assign({}, s.app.tabNames, { [g]: e.target.value.trim() }); s.app.tabNames = names; Panel.save('app.tabNames', names); }
    tabsKey = '';
  });

  Panel.onState((s, langChanged) => {
    if (!s.settings) return;
    if (!asked && !s.settings.app.setupDone) { asked = true; openSetup(); }
    else if (!asked) { asked = true; tourWhenFree(Panel.group, 900); }
    if (langChanged) { renderSetup(); if (tour) show(); }
    renderTabsCard(s.settings);
  });
})();
