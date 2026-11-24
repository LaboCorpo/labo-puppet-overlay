/* Panel: Twitch account box (shared by several tabs) and the "Stream widgets" tab (OBS sources). */
(function () {
  'use strict';
  const { $, $$, t, escapeHtml, toast } = Panel;
  const origin = location.origin.replace('127.0.0.1', 'localhost');

  // ---------- Twitch account ----------
  let lastAccount = '';
  function renderAccount(s, force) {
    const a = s.twitchAccount || {};
    const key = I18N.lang + JSON.stringify(a);
    if (!force && key === lastAccount) return;
    lastAccount = key;
    let html;
    if (a.status === 'no-client' || a.hasClientId === false) {
      html = `<h3>${escapeHtml(t('Twitch account'))}</h3>
        <p class="muted">${escapeHtml(t('Needed for follower/sub counts, follow alerts, raids, Stream Together and sending chat messages. First, whoever manages the app must create a Twitch application and give you its Client ID.'))}</p>
        <div class="paste"><input data-tw="clientId" placeholder="Client ID" spellcheck="false"><button data-tw="saveClient">${escapeHtml(t('Save'))}</button></div>`;
    } else if (a.status === 'pending') {
      html = `<h3>${escapeHtml(t('Twitch account'))}</h3>
        <p>${escapeHtml(t('On Twitch, enter this code:'))}</p>
        <div class="device-code">${escapeHtml(a.userCode || '')}</div>
        <div class="btns"><button data-tw="open">${escapeHtml(t('Open twitch.tv/activate'))}</button><button class="ghost" data-tw="cancel">${escapeHtml(t('Cancel'))}</button></div>
        <p class="muted">${escapeHtml(t('Waiting for you to accept on Twitch…'))}</p>`;
    } else if (a.status === 'connected') {
      const miss = (a.missingScopes || []).length ? `<p class="warn">${escapeHtml(t('Some permissions are missing: log out and log in again.'))}</p>` : '';
      html = `<div class="row" style="border:0"><span><b>${escapeHtml(t('Twitch account'))}</b> · <span class="ok">● ${escapeHtml(t('Connected as {name}', { name: a.login || '' }))}</span></span>
        <button class="ghost small" data-tw="logout">${escapeHtml(t('Log out'))}</button></div>${miss}`;
    } else {
      const detail = a.detail ? `<p class="${a.status === 'error' ? 'err' : 'muted'}">${escapeHtml(t(a.detail))}</p>` : '';
      html = `<h3>${escapeHtml(t('Twitch account'))}</h3>
        <p class="muted">${escapeHtml(t('Log in to get follower/sub counts, follow alerts, raids, Stream Together invites and chat sending. Twitch shows a code to confirm: no password is typed in this app.'))}</p>
        ${detail}<div class="btns"><button data-tw="login">${escapeHtml(t('Log in with Twitch'))}</button>${a.status === 'error' ? `<button class="ghost" data-tw="logout">${escapeHtml(t('Log out'))}</button>` : ''}</div>`;
    }
    $$('[data-twitch-account]').forEach((el) => { el.innerHTML = html; });
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tw]');
    if (!b || !b.closest('[data-twitch-account]')) return;
    const act = b.dataset.tw;
    if (act === 'login') {
      const r = await Panel.run('twitch-login');
      if (r && r.login && r.login.verificationUri) Panel.action('open-url', { url: r.login.verificationUri });
    }
    if (act === 'open') { const a = Panel.state.twitchAccount || {}; if (a.verificationUri) Panel.action('open-url', { url: a.verificationUri }); }
    if (act === 'cancel') Panel.run('twitch-login-cancel');
    if (act === 'logout') Panel.run('twitch-logout');
    if (act === 'saveClient') {
      const v = b.parentElement.querySelector('input').value.trim().toLowerCase();
      if (!/^[a-z0-9]{20,40}$/.test(v)) { toast(t('This does not look like a Twitch Client ID')); return; }
      Panel.save('twitchApi.clientId', v);
    }
  });

  // ---------- Widgets ----------
  // [w param, name, recommended source size]
  const WIDGETS = [
    ['followers', 'Followers', '600 × 120'],
    ['subs', 'Subs', '600 × 120'],
    ['latest-follower', 'Latest follower', '700 × 120'],
    ['latest-sub', 'Latest sub', '700 × 120'],
    ['spotify', 'Now playing (Spotify)', '800 × 200 (Gallery: 500 × 500)'],
    ['chat', 'Live chat', '500 × 700'],
    ['counter', 'Game counter (deaths, wins…)', '600 × 120'],
    ['alerts', 'Alerts (GIF + sound)', '800 × 600'],
  ];
  const list = $('#widgetList');
  const CUSTOM = { followers: 'followers', subs: 'subs', 'latest-follower': 'latestFollower', 'latest-sub': 'latestSub', spotify: 'spotify', chat: 'chat', counter: 'gameCounter' };
  let builtLang = '';
  function buildWidgets() {
    if (builtLang === I18N.lang) return;
    builtLang = I18N.lang;
    const shown = list.querySelector('iframe') && list.querySelector('iframe').getAttribute('src') !== 'about:blank';
    list.innerHTML = WIDGETS.map(([w, name, size]) => {
      const url = `${origin}/widget.html?w=${w}`;
      return `<div class="widget-row">
        <div class="wprev checker"><iframe data-src="widget.html?w=${w}&preview=1" src="about:blank" title="${escapeHtml(t(name))}"></iframe></div>
        <div class="wmeta"><b>${escapeHtml(t(name))}</b>
          <div class="url"><code>${escapeHtml(url)}</code><button class="small" data-copyurl="${escapeHtml(url)}">${escapeHtml(t('Copy'))}</button></div>
          <span class="muted">${escapeHtml(t('Suggested size: {size}', { size }))}</span>${CUSTOM[w] ? ` <button class="ghost small" data-customize="${CUSTOM[w]}">🎨 ${escapeHtml(t('Customise'))}</button>` : ''}</div>
      </div>`;
    }).join('');
    if (shown) loadPreviews(true);
  }
  // Previews only run while the tab is shown.
  function loadPreviews(on) {
    list.querySelectorAll('iframe').forEach((f) => {
      const want = on ? f.dataset.src : 'about:blank';
      if (f.getAttribute('src') !== want) f.setAttribute('src', want);
    });
  }
  // Previews get the state from here (see widget.js: no event stream of their own).
  const previewState = () => { const s = Panel.state; return { settings: s.settings, stats: s.stats, nowPlaying: s.nowPlaying, app: { lang: I18N.lang } }; };
  function feedPreviews(target) {
    if (!Panel.state.settings) return;
    const msg = { type: 'po-state', state: previewState() };
    if (target) { target.postMessage(msg, location.origin); return; }
    list.querySelectorAll('iframe').forEach((f) => { if (f.getAttribute('src') !== 'about:blank' && f.contentWindow) f.contentWindow.postMessage(msg, location.origin); });
  }
  addEventListener('message', (e) => { if (e.origin === location.origin && e.data && e.data.type === 'po-widget-ready') feedPreviews(e.source); });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copyurl]');
    if (!b) return;
    navigator.clipboard.writeText(b.dataset.copyurl);
    toast(t('Copied to clipboard'));
  });

  const NP = { off: 'off', waiting: 'Nothing playing — is the Spotify app open?', running: 'connected', unsupported: 'Windows only', error: 'Could not read the music (PowerShell blocked?)' };
  function renderLive(s) {
    const st = s.stats;
    const acc = s.twitchAccount || {};
    let now;
    if (acc.status !== 'connected') now = t('Log in with Twitch to get the counters.');
    else if (!st || !st.updatedAt) now = t('Loading…');
    else {
      const errs = Object.values(st.errors || {}).map((x) => t(x));
      now = [
        `${t('Followers')}: ${st.followers == null ? '—' : st.followers}`,
        `${t('Subs')}: ${st.subs == null ? '—' : st.subs}`,
        st.latestFollower ? `${t('Latest follower')}: ${st.latestFollower.display}` : '',
      ].filter(Boolean).join(' · ') + (errs.length ? ' — ' + errs.join(' · ') : '');
    }
    $('#statsNow').textContent = now;
    const np = s.nowPlaying || { status: 'off' };
    let txt = np.playing ? `♪ ${np.artist ? np.artist + ' — ' : ''}${np.title}${np.app && np.app !== 'Spotify' ? ` (${np.app})` : ''}` : t(NP[np.status] || np.status) + (np.status === 'running' ? ' · ' + t('paused') : '');
    // Old fallback (Spotify window title): no position, cover looked up online.
    if (np.source === 'window' && np.status === 'running') txt += ' · ' + t('basic mode (window title)');
    $$('.np-status').forEach((el) => { el.textContent = txt; });
  }

  Panel.onTab((name) => { if (name === 'stream') { buildWidgets(); loadPreviews(true); } else loadPreviews(false); });
  Panel.onState((s, langChanged) => { renderAccount(s, langChanged); if (langChanged) buildWidgets(); renderLive(s); feedPreviews(); });
})();
