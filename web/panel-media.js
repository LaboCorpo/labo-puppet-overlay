/*
 * "Son Twitch" folder picker, shared by Alert sounds (sounds + GIFs), Baba Bot sound commands and the widget editor
 * (pictures). Panel.pickMedia({ kind: 'audio' | 'image', multiple }) resolves to the chosen file names ([] = cancelled).
 * Panel.mediaUrl(file): sounds uploaded before v1.7 (16 hex chars) live in /sounds/, the rest in the folder (/media/).
 * Panel.uploadMedia(files): copies files into the folder (they keep their name), resolves to [{ file, kind }].
 */
(function () {
  'use strict';
  const { t, escapeHtml: esc, toast } = Panel;
  const LEGACY = /^[a-f0-9]{16}\.(mp3|wav|ogg)$/;
  const mediaUrl = (f) => (!f ? '' : LEGACY.test(f) ? '/sounds/' + encodeURIComponent(f) : '/media/' + encodeURIComponent(f));
  const isAudio = (f) => /\.(mp3|wav|ogg)$/i.test(f);

  async function uploadMedia(files) {
    const out = [];
    for (const f of [...files].slice(0, 30)) {
      const audio = /^audio\//.test(f.type) || isAudio(f.name);
      if (f.size > (audio ? 20 : 8) * 1024 * 1024) { toast(t('{name}: file too large (max {n} MB)', { name: f.name, n: audio ? 20 : 8 })); continue; }
      const r = await fetch('/api/media?name=' + encodeURIComponent(f.name), { method: 'POST', body: f }).then((x) => x.json()).catch(() => null);
      if (!r || !r.ok) { toast(f.name + ' — ' + t((r && r.error) || 'Upload failed')); continue; }
      out.push({ file: r.file, kind: r.kind });
    }
    return out;
  }

  // ---------- Picker ----------
  let modal = null, resolveFn = null, opts = null, chosen = new Set(), preview = null;
  function ensure() {
    if (modal) return;
    modal = document.createElement('div');
    modal.className = 'modal hidden media-modal';
    modal.setAttribute('data-no-i18n', '');
    modal.innerHTML = '<div class="modal-box"><div class="mp-head"></div><div class="mp-list"></div><div class="btns modal-nav mp-foot"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', onClick);
    modal.addEventListener('change', async (e) => {
      if (!e.target.matches('.mp-upload')) return;
      const got = await uploadMedia(e.target.files);
      e.target.value = '';
      for (const g of got) if ((opts.kind === 'image') === (g.kind === 'image')) { if (!opts.multiple) chosen.clear(); chosen.add(g.file); }
      await load();
    });
    modal.addEventListener('mousedown', (e) => { if (e.target === modal) close([]); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) close([]); });
  }
  async function load() {
    const list = modal.querySelector('.mp-list');
    const r = await fetch('/api/media').then((x) => x.json()).catch(() => null);
    if (!r || !r.ok) { list.innerHTML = `<p class="err">${esc(t('Could not read the folder'))}</p>`; return; }
    const files = r.files.filter((f) => f.kind === opts.kind);
    modal.querySelector('.mp-dir').textContent = r.dir;
    list.innerHTML = files.length ? files.map((f) => `<button class="mp-item${chosen.has(f.name) ? ' on' : ''}" data-f="${esc(f.name)}">
        ${f.kind === 'image' ? `<img src="${esc(mediaUrl(f.name))}" alt="" loading="lazy">` : '<span class="mp-play" data-play title="▶">▶</span>'}
        <span class="mp-name">${esc(f.name)}</span><span class="muted">${Math.max(1, Math.round(f.size / 1024))} ${esc(t('KB'))}</span></button>`).join('')
      : `<p class="muted">${esc(t(opts.kind === 'image' ? 'No picture in the folder yet: put GIF, PNG, JPG or WEBP files in it, or import them.' : 'No sound in the folder yet: put MP3, WAV or OGG files in it, or import them.'))}</p>`;
    renderFoot();
  }
  function renderFoot() {
    modal.querySelector('.mp-foot').innerHTML = `<span class="muted">${esc(t('{n} selected', { n: chosen.size }))}</span><span class="grow"></span>
      <button class="ghost" data-mp="cancel">${esc(t('Cancel'))}</button><button data-mp="ok"${chosen.size ? '' : ' disabled'}>${esc(t(opts.multiple ? 'Add' : 'Choose'))}</button>`;
  }
  function onClick(e) {
    const b = e.target.closest('[data-mp]');
    if (b) {
      if (b.dataset.mp === 'cancel') close([]);
      if (b.dataset.mp === 'ok') close([...chosen]);
      if (b.dataset.mp === 'open') Panel.action('open-media-dir');
      if (b.dataset.mp === 'refresh') load();
      if (b.dataset.mp === 'none') close(['']);
      return;
    }
    const it = e.target.closest('[data-f]');
    if (!it) return;
    if (e.target.closest('[data-play]')) {
      if (preview) preview.pause();
      preview = new Audio(mediaUrl(it.dataset.f));
      preview.play().catch(() => toast(t('Could not play this file')));
      return;
    }
    const f = it.dataset.f;
    if (!opts.multiple) { chosen.clear(); modal.querySelectorAll('.mp-item.on').forEach((x) => x.classList.remove('on')); }
    if (chosen.has(f)) chosen.delete(f); else chosen.add(f);
    it.classList.toggle('on', chosen.has(f));
    renderFoot();
    if (!opts.multiple && e.detail === 2) close([f]); // double-click picks at once
  }
  function close(result) {
    if (preview) { preview.pause(); preview = null; }
    modal.classList.add('hidden');
    const r = resolveFn; resolveFn = null;
    if (r) r(result);
  }
  function pickMedia(o) {
    ensure();
    opts = Object.assign({ kind: 'audio', multiple: false, allowNone: false }, o);
    chosen = new Set(o && o.current ? [o.current] : []);
    const img = opts.kind === 'image';
    modal.querySelector('.mp-head').innerHTML = `<h2>📂 ${esc(t('Son Twitch folder'))}</h2>
      <p class="muted">${esc(t(img ? 'Pictures (GIF, PNG, JPG, WEBP) put in this folder:' : 'Sounds (MP3, WAV, OGG) put in this folder:'))} <code class="mp-dir"></code></p>
      <div class="btns" style="margin:0 0 8px"><button class="ghost small" data-mp="open">📂 ${esc(t('Open the folder'))}</button><button class="ghost small" data-mp="refresh">⟳ ${esc(t('Refresh'))}</button>
        <label class="button ghost small upload">＋ ${esc(t('Import files…'))}<input type="file" class="mp-upload" multiple hidden accept="${img ? 'image/gif,image/png,image/jpeg,image/webp' : 'audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg'}"></label>
        ${opts.allowNone ? `<button class="ghost small" data-mp="none">✕ ${esc(t('None'))}</button>` : ''}</div>`;
    modal.querySelector('.mp-list').innerHTML = `<p class="muted">${esc(t('Loading…'))}</p>`;
    modal.classList.remove('hidden');
    load();
    return new Promise((res) => { resolveFn = res; });
  }

  Object.assign(window.Panel, { pickMedia, mediaUrl, uploadMedia });
})();
