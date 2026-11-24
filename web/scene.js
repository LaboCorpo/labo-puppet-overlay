/*
 * OBS scene (scene.html?id=…): several widgets in one Browser Source, laid out in the panel (HUD → Scenes).
 * One connection to the app; every widget is an iframe in feed mode that receives the state from here
 * (browsers allow only ~6 connections per host, so each widget can't have its own).
 * fit=1 scales the scene to the window (used by the panel preview).
 */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const ID = params.get('id') || '';
  const FIT = params.get('fit') === '1';
  const PARAM = { followers: 'followers', subs: 'subs', latestFollower: 'latest-follower', latestSub: 'latest-sub', spotify: 'spotify', chat: 'chat', alerts: 'alerts' };
  const box = document.getElementById('scene');
  let state = {}, key = '', frames = [];

  function post(f, msg) { try { f.contentWindow.postMessage(msg, location.origin); } catch (e) { /* not loaded yet */ } }
  function layout() {
    const sc = ((state.settings && state.settings.scenes) || []).find((x) => x.id === ID);
    if (!sc) { box.innerHTML = `<div class="msg">Scene not found: ${ID.replace(/[^a-z0-9]/g, '')}</div>`; frames = []; key = ''; return; }
    box.style.width = sc.width + 'px';
    box.style.height = sc.height + 'px';
    const k = JSON.stringify(sc.items.map((it) => it.w));
    if (k !== key) {
      key = k;
      box.innerHTML = '';
      frames = sc.items.map((it) => {
        const f = document.createElement('iframe');
        f.src = `widget.html?w=${PARAM[it.w]}&feed=1${it.w === 'alerts' ? '&host=obs' : ''}`;
        f.setAttribute('allow', 'autoplay');
        box.appendChild(f);
        return f;
      });
    }
    sc.items.forEach((it, i) => Object.assign(frames[i].style, { left: it.x + 'px', top: it.y + 'px', width: it.width + 'px', height: it.height + 'px' }));
    if (FIT) { const k2 = Math.min(innerWidth / sc.width, innerHeight / sc.height); box.style.transform = `scale(${k2})`; }
  }
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === 'po-widget-ready') { const f = frames.find((x) => x.contentWindow === e.source); if (f) post(f, { type: 'po-state', state }); }
  });
  addEventListener('resize', () => { if (FIT) layout(); });
  const es = new EventSource('/api/events');
  es.addEventListener('state', (e) => {
    const next = JSON.parse(e.data);
    state = Object.assign({}, state, next);
    layout();
    frames.forEach((f) => post(f, { type: 'po-state', state: next }));
  });
  es.addEventListener('alert-sound', (e) => { const a = JSON.parse(e.data); frames.forEach((f) => post(f, { type: 'po-alert', alert: a })); });
})();
