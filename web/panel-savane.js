/*
 * La savane pages in the panel: the room (name, password, invitation, who is in) and the scene editor
 * with a live preview (placeholders) and the OBS links (whole scene + one per camera).
 */
(function () {
  'use strict';
  const { $, t, escapeHtml, toast } = Panel;
  const ORIGIN = location.origin.replace('127.0.0.1', 'localhost');
  const rnd = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');

  $('#savNew').onclick = () => { Panel.save('savane.room', 'labo_savane_' + rnd(8)); Panel.save('savane.password', rnd(10)); toast(t('New room created: send the invitation to the crew')); };
  const invitation = (s) => `🍌 La savane — LaboHub\n${t('Room')}: ${s.room}\n${t('Password')}: ${s.password || '—'}\nSAV1.${btoa(JSON.stringify({ r: s.room, p: s.password }))}`;
  $('#savCopy').onclick = () => {
    const s = Panel.state.settings.savane;
    if (!s.room) { toast(t('Create a room first')); return; }
    navigator.clipboard.writeText(invitation(s)).then(() => toast(t('Invitation copied')), () => toast(t('Could not copy')));
  };
  $('#savPaste').onclick = async () => {
    let txt = '';
    try { txt = await navigator.clipboard.readText(); } catch (e) { txt = prompt(t('Paste the invitation here')) || ''; }
    const m = txt.match(/SAV1\.([A-Za-z0-9+/=]+)/);
    try {
      const j = JSON.parse(atob(m[1]));
      if (!/^[A-Za-z0-9_]{4,40}$/.test(j.r)) throw new Error();
      Panel.save('savane.room', j.r); Panel.save('savane.password', j.p || '');
      toast(t('Room joined: {room}', { room: j.r }));
    } catch (e) { toast(t('No invitation found in what you pasted')); }
  };
  $('#savJoin').onclick = () => {
    if (!Panel.state.settings.savane.room) { toast(t('Create a room first')); return; }
    Panel.action('savane-open');
  };

  let peopleKey = '';
  function renderPeople(s) {
    const list = (s.savane || {}).presence || [];
    const sc = s.settings.savane;
    const hidden = new Set(sc.hidden || []), labels = sc.labels || {};
    $('#savWho').textContent = list.length ? t('{n} in the room', { n: list.length }) : t('Nobody in the room (or your room window is closed).');
    const k = JSON.stringify([list, sc.hidden, labels, I18N.lang]);
    if (k !== peopleKey && !$('#savPeople').contains(document.activeElement)) {
      peopleKey = k;
      $('#savPeople').innerHTML = list.length ? list.map((p) => `<div class="sav-p${hidden.has(p.id) ? ' off' : ''}"><b>${escapeHtml(labels[p.id] || p.label || p.id)}</b>${p.me ? ` <span class="tag">${escapeHtml(t('you'))}</span>` : ''}
        <input class="sav-rename" data-label="${escapeHtml(p.id)}" maxlength="24" placeholder="${escapeHtml(t('Name shown'))}" value="${escapeHtml(labels[p.id] || '')}">
        <label class="check inline"><input type="checkbox" data-hide="${escapeHtml(p.id)}"${hidden.has(p.id) ? '' : ' checked'}> ${escapeHtml(t('in the scene'))}</label></div>`).join('') : `<p class="muted">${escapeHtml(t('Join to see who is here.'))}</p>`;
    }
    // Links: the whole room, your own camera (always: its link never changes), then everyone in the room.
    const name = SavaneId.nameOf(sc, s.twitchAccount && s.twitchAccount.login);
    const mine = sc.room && name ? SavaneId.streamId(sc.room, name) : '';
    const all = list.slice();
    if (mine && !all.some((p) => p.id === mine)) all.unshift({ id: mine, label: name, me: true });
    const row = (label, url, size, ghost) => `<div class="row"><b>${escapeHtml(label)}</b><code>${escapeHtml(url)}</code><span class="grow"></span><span class="muted">${escapeHtml(size)}</span><button class="${ghost ? 'ghost ' : ''}small" data-copy="${escapeHtml(url)}">${escapeHtml(t('Copy'))}</button></div>`;
    $('#savLinks').innerHTML = (sc.room ? row('🍌 ' + t('Whole room'), `${ORIGIN}/savane.html?scene=1`, `${sc.width} × ${sc.height}`) : `<p class="muted">${escapeHtml(t('Create a room first'))}</p>`)
      + all.map((p) => row((p.me ? '🎥 ' + t('Me') : '👤 ' + (labels[p.id] || p.label || p.id)), `${ORIGIN}/savane.html?cam=${p.id}`, '1280 × 720', true)
        + row('↳ ' + t('video only (no frame)'), `${ORIGIN}/savane.html?cam=${p.id}&raw=1`, '1280 × 720', true)).join('')
      + (sc.room && !mine ? `<p class="muted">${escapeHtml(t('Your camera link appears once you have a name (Room tab) or a Twitch login.'))}</p>` : '')
      + (sc.room && !list.length ? `<p class="muted">${escapeHtml(t('The others appear here when they are in the room. Your link works as soon as your camera is started.'))}</p>` : '');
  }
  document.addEventListener('change', (e) => {
    const l = e.target.closest('[data-label]');
    if (!l || !l.classList.contains('sav-rename')) return;
    Panel.save('savane.labels', Object.assign({}, Panel.state.settings.savane.labels, { [l.dataset.label]: l.value.trim() }));
  });
  $('#savArrange').onclick = () => {
    if (!Panel.state.settings.savane.room) { toast(t('Create a room first')); return; }
    Panel.action('savane-open');
  };
  $('#savNoLogo').onclick = () => Panel.save('savane.logo', '');
  $('#savLogo').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast(t('Picture too big (8 MB max)')); return; }
    const r = await fetch('/api/backgrounds', { method: 'POST', body: f }).then((x) => x.json()).catch(() => null);
    if (!r || !r.ok) { toast(t((r && r.error) || 'Something went wrong')); return; }
    Panel.save('savane.logo', r.url);
    toast(t('Logo added'));
  };
  document.addEventListener('change', (e) => {
    const h = e.target.closest('[data-hide]');
    if (!h) return;
    const hidden = new Set(Panel.state.settings.savane.hidden || []);
    if (h.checked) hidden.delete(h.dataset.hide); else hidden.add(h.dataset.hide);
    Panel.save('savane.hidden', [...hidden]);
  });
  $('#savLinks').addEventListener('click', (e) => { const b = e.target.closest('[data-copy]'); if (b) navigator.clipboard.writeText(b.dataset.copy).then(() => toast(t('Copied: add it as a Browser Source in OBS'))); });
  $('#savBg').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast(t('Picture too big (8 MB max)')); return; }
    const r = await fetch('/api/backgrounds', { method: 'POST', body: f }).then((x) => x.json()).catch(() => null);
    if (!r || !r.ok) { toast(t((r && r.error) || 'Something went wrong')); return; }
    Panel.save('savane.bgImage', r.url); Panel.save('savane.bg', 'image');
    toast(t('Background added'));
  };

  // Preview: placeholders in the real layout (no video, to keep the panel light).
  const frame = $('#savPreview');
  addEventListener('message', (e) => {
    if (e.origin === location.origin && e.data && e.data.type === 'po-widget-ready' && e.source === frame.contentWindow) frame.contentWindow.postMessage({ type: 'po-state', state: Panel.state }, location.origin);
  });
  Panel.onTab((name) => {
    if (name === 'savane-scene') { if (!frame.src.includes('savane.html')) frame.src = 'savane.html?scene=1&preview=1'; }
    else if (frame.src.includes('savane.html')) frame.src = 'about:blank';
  });
  Panel.onState((s) => {
    if (!s.settings) return;
    renderPeople(s);
    const sc = s.settings.savane;
    frame.style.aspectRatio = `${sc.width} / ${sc.height}`;
    if (frame.src.includes('savane.html')) try { frame.contentWindow.postMessage({ type: 'po-state', state: s }, location.origin); } catch (e) { /* loading */ }
  });
})();
