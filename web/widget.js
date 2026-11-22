/*
 * OBS widgets, one per Browser Source so each can be moved and resized freely in OBS:
 *   widget.html?w=followers | subs | latest-follower | latest-sub | spotify | alerts
 * demo=1: shows sample data when there is nothing real yet.
 * preview=1 (panel previews, implies demo): gets its data from the panel by postMessage instead of opening
 *   its own event stream (Chromium allows only 6 connections per host: six previews would starve the panel).
 * 'alerts' draws nothing: it plays alert sounds inside OBS when the alert output is "OBS".
 */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const W = params.get('w') || 'followers';
  const PREVIEW = params.get('preview') === '1' && window.parent !== window;
  const DEMO = params.get('demo') === '1' || PREVIEW;
  const t = I18N.t;
  const root = document.getElementById('root');
  const body = document.body;
  let state = { settings: null, stats: null, nowPlaying: null };
  const DEMO_STATS = { followers: 1234, subs: 42, latestFollower: { display: 'pixelcat' }, latestSub: { display: 'MamieGaming', kind: 'prime' }, errors: {} };
  const DEMO_NP = { status: 'running', playing: true, artist: 'Paper Puppets', title: 'Head Flap Boogie (Radio Edit)', cover: null };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString(I18N.lang === 'fr' ? 'fr-FR' : 'en-US');

  function applyStyle(w) {
    body.style.setProperty('--size', w.size + 'px');
    body.style.setProperty('--color', w.color);
    body.style.setProperty('--accent', w.accent);
    body.style.setProperty('--font', `"${w.font || 'Segoe UI'}", system-ui, sans-serif`);
    body.className = `style-${w.style} align-${w.align}${w.shadow ? ' shadow' : ''}`;
  }

  // Long song titles scroll instead of being cut.
  function marquee(el) {
    el.classList.remove('scroll');
    const text = el.textContent;
    el.innerHTML = `<span>${esc(text)}</span>`;
    if (el.scrollWidth <= el.clientWidth + 2) return;
    el.classList.add('scroll');
    el.innerHTML = `<span>${esc(text)}</span><span>${esc(text)}</span>`;
    el.style.setProperty('--dur', Math.max(8, text.length * 0.35) + 's');
  }

  let lastValue = null, lastKey = '';
  function counter(label, value, goal) {
    const g = goal > 0 ? ` <span class="goal">/ ${num(goal)}</span>` : '';
    const key = 'c' + label + goal;
    if (key !== lastKey) {
      lastKey = key;
      root.innerHTML = `<div class="w"><div class="row"><span class="label">${esc(label)}</span><span class="value"></span></div>${goal > 0 ? '<div class="bar"><i></i></div>' : ''}</div>`;
    }
    const v = root.querySelector('.value');
    v.innerHTML = (value == null ? '—' : num(value)) + g;
    if (lastValue !== null && value !== lastValue) { v.classList.remove('bump'); void v.offsetWidth; v.classList.add('bump'); }
    lastValue = value;
    const bar = root.querySelector('.bar i');
    if (bar) bar.style.width = Math.min(100, ((value || 0) / goal) * 100) + '%';
  }

  function latest(label, who) {
    const key = 'l' + label + (who || '');
    if (key === lastKey) return;
    const changed = lastKey && lastKey.startsWith('l' + label);
    lastKey = key;
    root.innerHTML = `<div class="w"><div class="row"><span class="label">${esc(label)}</span><span class="value">${esc(who || '—')}</span></div></div>`;
    if (changed) root.querySelector('.value').classList.add('bump');
  }

  function spotify(cfg) {
    const np = state.nowPlaying && (state.nowPlaying.playing || !DEMO) ? state.nowPlaying : DEMO ? DEMO_NP : null;
    const playing = !!(np && np.playing);
    const key = 's' + (np ? np.artist + '|' + np.title + '|' + np.cover : '') + cfg.showCover;
    if (key !== lastKey) {
      lastKey = key;
      const cover = cfg.showCover && np && np.cover ? `<img src="${esc(np.cover)}" alt="">` : '<span class="note">♪</span>';
      root.innerHTML = `<div class="w"><div class="np">${cover}<div class="txt"><div class="title">${esc(np && np.title ? np.title : t('Nothing playing'))}</div>${np && np.artist ? `<div class="artist">${esc(np.artist)}</div>` : ''}</div></div></div>`;
      root.querySelectorAll('.title, .artist').forEach(marquee);
    }
    root.firstElementChild.classList.toggle('hide', !playing && cfg.hideWhenPaused && !DEMO);
  }

  function render() {
    const s = state.settings;
    if (!s) return;
    const w = s.widgets;
    applyStyle(w);
    const real = state.stats && state.stats.updatedAt ? state.stats : null;
    const st = real || (DEMO ? DEMO_STATS : {});
    switch (W) {
      case 'followers': return counter(w.followers.label || t('Followers'), st.followers, w.followers.goal);
      case 'subs': return counter(w.subs.label || t('Subs'), st.subs, w.subs.goal);
      case 'latest-follower': return latest(w.latestFollower.label || t('Latest follower'), st.latestFollower && st.latestFollower.display);
      case 'latest-sub': return latest(w.latestSub.label || t('Latest sub'), st.latestSub && st.latestSub.display);
      case 'spotify': return spotify(w.spotify);
      case 'alerts':
        body.className = '';
        root.innerHTML = DEMO ? `<span class="placeholder">${esc(t('Alert sounds play here when “Played by” is set to OBS.'))}</span>` : '';
        return;
      default: root.innerHTML = '';
    }
  }

  function applyState(next) {
    ['settings', 'stats', 'nowPlaying'].forEach((k) => { if (k in next) state[k] = next[k]; });
    if (next.app && next.app.lang && I18N.setLang(next.app.lang)) lastKey = '';
    render();
  }
  const alerts = new AlertSound();
  function connect() {
    const es = new EventSource('/api/events');
    es.addEventListener('state', (e) => applyState(JSON.parse(e.data)));
    es.addEventListener('alert-sound', (e) => {
      const a = JSON.parse(e.data);
      if (W === 'alerts' && !DEMO && a.output === 'obs') alerts.play(a);
    });
  }
  addEventListener('resize', () => { lastKey = ''; render(); });
  if (PREVIEW) {
    addEventListener('message', (e) => { if (e.origin === location.origin && e.data && e.data.type === 'po-state') applyState(e.data.state); });
    window.parent.postMessage({ type: 'po-widget-ready' }, location.origin);
  } else connect();
})();
