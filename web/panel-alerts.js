/* Panel tab "Alert sounds": several audio files per Twitch event, uploaded to the app (/api/sounds). */
(function () {
  'use strict';
  const { $, t, escapeHtml, toast } = Panel;
  // [key, title, help, label of the `min` column (null = no threshold), test kind for twitch-test]
  const EVENTS = [
    ['follow', 'Follow', 'A new follower.', null],
    ['sub', 'Sub', 'Subs and resubs (also used for Prime and gifts when those have no sounds).', null],
    ['prime', 'Prime sub', 'Subs paid with Prime Gaming.', null],
    ['gift', 'Gifted subs', 'One alert per gift, even for “gift 10 subs”. “From” = number of subs gifted.', 'From (subs)'],
    ['bits', 'Bits', 'Cheers. “From” = minimum bits: the highest threshold reached plays (e.g. 1 / 100 / 1000).', 'From (bits)'],
    ['raid', 'Raid', 'Incoming raids. “From” = minimum raiders.', 'From (viewers)'],
  ];
  const MODES = [['random', 'Random'], ['sequence', 'In order'], ['all', 'All together']];
  const box = $('#alertEvents');
  let lastKey = '';
  let preview = null;

  const cfg = () => Panel.state.settings.alerts;
  const sounds = (key) => cfg()[key].sounds.map((x) => Object.assign({}, x));
  function setSounds(key, list) {
    Panel.state.settings.alerts[key].sounds = list; // local copy, so the next render shows it at once
    Panel.save(`alerts.${key}.sounds`, list);
    render(true);
  }
  // Removes the stored file unless another event still uses it.
  function forget(file) {
    const used = EVENTS.some(([k]) => cfg()[k].sounds.some((x) => x.file === file));
    if (!used) fetch('/api/sounds/' + encodeURIComponent(file), { method: 'DELETE' }).catch(() => {});
  }
  function play(s) {
    if (preview) preview.pause();
    preview = new Audio('/sounds/' + encodeURIComponent(s.file));
    preview.volume = Math.max(0, Math.min(1, s.volume * cfg().volume));
    preview.play().catch(() => toast(t('Could not play this file')));
  }

  async function upload(key, files) {
    const list = sounds(key);
    for (const f of files) {
      if (list.length >= 30) { toast(t('30 sounds max per event')); break; }
      if (f.size > 20 * 1024 * 1024) { toast(t('{name}: file too large (max 20 MB)', { name: f.name })); continue; }
      const r = await fetch('/api/sounds?name=' + encodeURIComponent(f.name.replace(/\.(mp3|wav|ogg)$/i, '')), { method: 'POST', headers: { 'Content-Type': f.type || 'audio/mpeg' }, body: f })
        .then((x) => x.json()).catch(() => ({ ok: false }));
      if (!r.ok) { toast(f.name + ' — ' + t(r.error || 'Upload failed')); continue; }
      list.push({ file: r.file, name: r.name, volume: 1, min: 0 });
    }
    setSounds(key, list);
  }

  function row(key, s, i, minLabel) {
    return `<div class="snd" data-i="${i}">
      <button class="ghost small" data-act="play" title="${escapeHtml(t('Listen'))}">▶</button>
      <span class="name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
      <label class="inline">${escapeHtml(t('Volume'))} <input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-f="volume"><output>${Math.round(s.volume * 100)}%</output></label>
      ${minLabel ? `<label class="inline">${escapeHtml(t(minLabel))} <input type="number" min="0" value="${s.min}" data-f="min" style="width:90px"></label>` : '<span></span>'}
      <button class="danger" data-act="del" title="${escapeHtml(t('Delete'))}">✕</button>
    </div>`;
  }

  function render(force) {
    if (!Panel.state.settings) return;
    const key = I18N.lang + JSON.stringify(EVENTS.map(([k]) => cfg()[k]));
    if (!force && key === lastKey) return;
    if (!force && box.contains(document.activeElement)) return; // don't rebuild under the user's fingers
    lastKey = key;
    box.innerHTML = EVENTS.map(([k, title, help, minLabel]) => {
      const ev = cfg()[k];
      return `<div class="card alert-ev" data-ev="${k}">
        <div class="alert-head"><h3>${escapeHtml(t(title))} <span class="tag">${ev.sounds.length}</span></h3>
          <select data-act="mode">${MODES.map(([v, l]) => `<option value="${v}"${ev.mode === v ? ' selected' : ''}>${escapeHtml(t(l))}</option>`).join('')}</select></div>
        <p class="muted">${escapeHtml(t(help))}</p>
        <div class="snds">${ev.sounds.map((s, i) => row(k, s, i, minLabel)).join('') || `<span class="muted">${escapeHtml(t('No sound yet.'))}</span>`}</div>
        <div class="btns">
          <label class="button ghost">${escapeHtml(t('Add MP3 files…'))}<input type="file" accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg" multiple hidden data-act="add"></label>
          <button class="ghost" data-act="test">🔊 ${escapeHtml(t('Test'))}</button>
          <button class="ghost" data-act="sim">${escapeHtml(t('Simulate the event'))}</button>
        </div>
      </div>`;
    }).join('');
  }

  // One delegated listener set for the whole list.
  const evKey = (el) => el.closest(".alert-ev").dataset.ev;
  const idx = (el) => Number(el.closest('.snd').dataset.i);
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return;
    const k = evKey(b);
    if (b.dataset.act === 'play') play(sounds(k)[idx(b)]);
    if (b.dataset.act === 'del') {
      const list = sounds(k); const [gone] = list.splice(idx(b), 1);
      setSounds(k, list);
      if (gone) forget(gone.file);
    }
    if (b.dataset.act === 'test') Panel.run('alert-test', { key: k });
    if (b.dataset.act === 'sim') Panel.run('twitch-test', { kind: k === 'sub' ? 'sub' : k }, 'Event sent: watch the overlay and listen');
  });
  box.addEventListener('change', (e) => {
    const el = e.target, k = el.closest('.alert-ev') && evKey(el);
    if (!k) return;
    if (el.dataset.act === 'add') { upload(k, [...el.files]); el.value = ''; return; }
    if (el.dataset.act === 'mode') { Panel.state.settings.alerts[k].mode = el.value; Panel.save(`alerts.${k}.mode`, el.value); return; }
    if (el.dataset.f) {
      const list = sounds(k), s = list[idx(el)];
      if (!s) return;
      s[el.dataset.f] = el.dataset.f === 'min' ? Math.max(0, Math.round(Number(el.value) || 0)) : Number(el.value);
      Panel.state.settings.alerts[k].sounds = list;
      Panel.save(`alerts.${k}.sounds`, list);
    }
  });
  box.addEventListener('input', (e) => {
    if (e.target.dataset.f === 'volume') e.target.nextElementSibling.textContent = Math.round(e.target.value * 100) + '%';
  });

  Panel.onState(() => render());
})();
