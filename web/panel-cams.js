/*
 * Widget Twitch → Friends' cams: the friends list (their VDO.Ninja link to send, their OBS links), the scene preview
 * (drag / resize the cameras, cams.html?edit=1) and its look (settings.savane, bound with data-key).
 */
(function () {
  'use strict';
  const { $, t, escapeHtml: esc, toast } = Panel;
  const ORIGIN = location.origin.replace('127.0.0.1', 'localhost');
  const rnd = (n, abc) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => (abc || 'abcdefghjkmnpqrstuvwxyz23456789')[b % (abc || 'abcdefghjkmnpqrstuvwxyz23456789').length]).join('');
  const cfg = () => Panel.state.settings.savane;
  const copy = (text, msg) => navigator.clipboard.writeText(text).then(() => toast(t(msg || 'Copied')), () => toast(t('Could not copy')));
  // The link the friend opens: their camera is sent under their own id, protected by the password.
  const pushUrl = (f, pw) => `https://vdo.ninja/?push=${encodeURIComponent(f.id)}&password=${encodeURIComponent(pw)}&label=${encodeURIComponent(f.name || 'cam')}&webcam`;
  const camUrl = (f, raw) => `${ORIGIN}/cams.html?cam=${encodeURIComponent(f.id)}${raw ? '&raw=1' : ''}`;
  function saveFriends(fn) { const l = JSON.parse(JSON.stringify(cfg().friends)); fn(l); cfg().friends = l; Panel.save('savane.friends', l); key = ''; render(); }
  function ensurePassword() { if (!cfg().password) { const pw = rnd(14); cfg().password = pw; Panel.save('savane.password', pw); } return cfg().password; }

  // ---------- Friends ----------
  let key = '';
  function render() {
    const s = cfg(), box = $('#camFriends');
    const k = JSON.stringify([s.friends, I18N.lang]);
    if (k !== key && !box.contains(document.activeElement)) {
      key = k;
      box.innerHTML = s.friends.length ? s.friends.map((f, i) => `<div class="cam-row" data-i="${i}">
        <span class="cam-av">${esc((f.name || '?').charAt(0).toUpperCase())}</span>
        <input data-f="name" maxlength="24" value="${esc(f.name)}" placeholder="${esc(t('Name'))}">
        <label class="check inline"><input type="checkbox" data-f="on"${f.on ? ' checked' : ''}> ${esc(t('in the scene'))}</label>
        <button class="small" data-act="invite" title="${esc(t('Copy the link to send to this friend'))}">📨 ${esc(t('Their link'))}</button>
        <button class="ghost small" data-act="obs" title="${esc(camUrl(f))}">📺 ${esc(t('OBS: their cam'))}</button>
        <button class="ghost small" data-act="raw" title="${esc(camUrl(f, true))}">${esc(t('video only'))}</button>
        <button class="ghost small danger-text" data-act="del" title="${esc(t('Delete'))}">✕</button></div>`).join('')
        : `<p class="muted">${esc(t('No friend yet: type a name below, then send them their link.'))}</p>`;
    }
    const scene = `${ORIGIN}/cams.html?scene=1`;
    const lk = JSON.stringify([scene, s.width, s.height, I18N.lang]);
    if ($('#camLinks').dataset.k !== lk) {
      $('#camLinks').dataset.k = lk;
      $('#camLinks').innerHTML = `<div class="row"><b>🎥 ${esc(t('All the cams (the scene)'))}</b><code>${esc(scene)}</code><span class="grow"></span><span class="muted">${s.width} × ${s.height}</span><button class="small" data-copy="${esc(scene)}">${esc(t('Copy'))}</button></div>
        <p class="muted">${esc(t('One friend alone: the 📺 buttons above (1280 × 720).'))}</p>`;
    }
  }
  $('#camFriends').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const i = +b.closest('[data-i]').dataset.i, f = cfg().friends[i];
    if (!f) return;
    if (b.dataset.act === 'invite') {
      const me = (Panel.state.twitchAccount || {}).display || (Panel.state.twitchAccount || {}).login || '';
      const msg = me ? t('🎥 Your camera for {me}\'s stream: open this link (computer or phone), choose your camera, then click Start. Keep the page open during the live.', { me })
        : t('🎥 Your camera for the stream: open this link (computer or phone), choose your camera, then click Start. Keep the page open during the live.');
      copy(`${msg}\n${pushUrl(f, ensurePassword())}`, 'Link copied: send it to your friend (Discord…)');
    }
    if (b.dataset.act === 'obs') copy(camUrl(f), 'Copied: add it as a Browser Source in OBS');
    if (b.dataset.act === 'raw') copy(camUrl(f, true), 'Copied: add it as a Browser Source in OBS');
    if (b.dataset.act === 'del' && confirm(t('Remove {name}? Their link will stop working.', { name: f.name || '?' }))) saveFriends((l) => l.splice(i, 1));
  });
  $('#camFriends').addEventListener('change', (e) => {
    const row = e.target.closest('[data-i]'), f = e.target.dataset.f;
    if (!row || !f) return;
    saveFriends((l) => { l[+row.dataset.i][f] = f === 'on' ? e.target.checked : e.target.value.trim().slice(0, 24); });
  });
  $('#camLinks').addEventListener('click', (e) => { const b = e.target.closest('[data-copy]'); if (b) copy(b.dataset.copy, 'Copied: add it as a Browser Source in OBS'); });
  function add() {
    const name = $('#camNewName').value.trim().slice(0, 24);
    if (!name) { toast(t('Type the friend\'s name first')); $('#camNewName').focus(); return; }
    if (cfg().friends.length >= 12) { toast(t('12 friends max')); return; }
    ensurePassword();
    saveFriends((l) => l.push({ id: 'F' + rnd(10, 'abcdefghijklmnopqrstuvwxyz0123456789'), name, on: true }));
    $('#camNewName').value = '';
    toast(t('Added: now click “Their link” and send it to {name}', { name }));
  }
  $('#camAdd').onclick = add;
  $('#camNewName').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  $('#camNewPw').onclick = () => {
    if (!confirm(t('A new password cancels every link already sent. Continue?'))) return;
    const pw = rnd(14); cfg().password = pw; Panel.save('savane.password', pw);
    toast(t('New password: send the new links to your friends'));
  };

  // ---------- Pictures ----------
  async function upload(input, apply) {
    const f = input.files[0];
    input.value = '';
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast(t('Picture too big (8 MB max)')); return; }
    const r = await fetch('/api/backgrounds', { method: 'POST', body: f }).then((x) => x.json()).catch(() => null);
    if (!r || !r.ok) { toast(t((r && r.error) || 'Something went wrong')); return; }
    apply(r.url);
  }
  $('#camBg').onchange = (e) => upload(e.target, (url) => { Panel.save('savane.bgImage', url); Panel.save('savane.bg', 'image'); toast(t('Background added')); });
  $('#camLogo').onchange = (e) => upload(e.target, (url) => { Panel.save('savane.logo', url); toast(t('Logo added')); });
  $('#camNoLogo').onclick = () => Panel.save('savane.logo', '');
  $('#camResetPos').onclick = () => { Panel.save('savane.positions', []); if (cfg().layout === 'free') Panel.save('savane.layout', 'grid'); toast(t('Automatic layout')); };

  // ---------- Preview (placeholders, or the real cameras) ----------
  const frame = $('#camPreview');
  const src = () => `cams.html?scene=1&preview=1&edit=1${$('#camLive').checked ? '&live=1' : ''}`;
  const feed = () => { try { frame.contentWindow.postMessage({ type: 'po-state', state: Panel.state }, location.origin); } catch (e) { /* loading */ } };
  addEventListener('message', (e) => { if (e.origin === location.origin && e.data && e.data.type === 'po-widget-ready' && e.source === frame.contentWindow) feed(); });
  $('#camLive').onchange = () => { frame.src = src(); };
  // The preview keeps the scene's shape (an iframe ignores aspect-ratio once it has a default height).
  function sizeFrame() { const c = cfg(); if (frame.clientWidth) frame.style.height = Math.round((frame.clientWidth * c.height) / c.width) + 'px'; }
  addEventListener('resize', () => { if (Panel.tab === 'cams') sizeFrame(); });
  Panel.onTab((name) => {
    if (name === 'cams') { if (!frame.src.includes('cams.html')) frame.src = src(); if (Panel.state.settings) { key = ''; render(); setTimeout(sizeFrame, 30); } }
    else if (frame.src.includes('cams.html')) frame.src = 'about:blank';
  });
  Panel.onState((s) => {
    if (!s.settings || Panel.tab !== 'cams') return;
    render();
    sizeFrame();
    if (frame.src.includes('cams.html')) feed();
  });
})();
