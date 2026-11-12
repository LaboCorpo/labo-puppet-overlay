/* Avatar creator: drawn ("from scratch") or photo puppet. Works standalone (file://) or served by the app. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const P = Puppet;

  let av = P.defaultAvatar();
  let mode = 'drawn';
  let photoImg = null; // HTMLImageElement source for the crop editor
  const crop = { ox: 0, oy: 0, zoom: 1 };
  const CROP = { W: 640, rx: 270, ry: 243 }; // ellipse ratio matches the puppet head (60:54)
  let photoDirty = false;

  // ---------- Option UI ----------
  const LABELS = { headShape: 'Head shape', eyes: 'Eyes', brows: 'Eyebrows', hair: 'Hair', hat: 'Hat', beard: 'Facial hair', outfit: 'Outfit' };
  const COLORS = [
    ['skin', 'Skin', P.PALETTES.skin], ['eyeColor', 'Eye colour', P.PALETTES.eye], ['hairColor', 'Hair / beard', P.PALETTES.hair],
    ['hatColor', 'Hat', P.PALETTES.cloth], ['clothColor', 'Clothes', P.PALETTES.cloth], ['accentColor', 'Details', P.PALETTES.cloth],
  ];
  const PHOTO_KEYS = ['hat', 'outfit', 'hatColor', 'clothColor', 'accentColor'];

  function buildOptions() {
    const box = $('#options'); box.innerHTML = '';
    const card = document.createElement('div'); card.className = 'card';
    Object.keys(P.OPTIONS).forEach((key) => {
      if (mode === 'photo' && !PHOTO_KEYS.includes(key)) return;
      const row = document.createElement('div'); row.className = 'opt-row';
      row.innerHTML = `<div class="lbl">${LABELS[key]}</div><div class="chips"></div>`;
      P.OPTIONS[key].forEach((v) => {
        const b = document.createElement('button'); b.className = 'chip' + (av[key] === v ? ' on' : ''); b.textContent = P.prettyLabel(v);
        b.onclick = () => { av[key] = v; buildOptions(); };
        row.lastChild.appendChild(b);
      });
      card.appendChild(row);
    });
    COLORS.forEach(([key, label, pal]) => {
      if (mode === 'photo' && !PHOTO_KEYS.includes(key)) return;
      const row = document.createElement('div'); row.className = 'opt-row';
      row.innerHTML = `<div class="lbl">${label}</div><div class="sw"></div>`;
      pal.forEach((c) => {
        const b = document.createElement('button'); b.style.background = c; b.title = c;
        if ((av[key] || '').toLowerCase() === c.toLowerCase()) b.className = 'on';
        b.onclick = () => { av[key] = c; buildOptions(); };
        row.lastChild.appendChild(b);
      });
      const custom = document.createElement('input'); custom.type = 'color'; custom.value = av[key] || '#ffffff'; custom.title = 'Custom colour';
      custom.oninput = () => { av[key] = custom.value; };
      custom.onchange = buildOptions;
      row.lastChild.appendChild(custom);
      card.appendChild(row);
    });
    box.appendChild(card);
  }

  function setMode(m) {
    mode = m;
    av.kind = m;
    $$('.modes [data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    $('#photoPanel').classList.toggle('hidden', m !== 'photo');
    buildOptions();
    if (m === 'photo') drawCrop();
  }
  $$('.modes [data-mode]').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  $('#random').onclick = () => {
    const keep = { id: av.id, name: av.name, kind: av.kind, photo: av.photo, photoSplit: av.photoSplit };
    const r = P.randomAvatar(Math.random().toString(36));
    if (mode === 'photo') PHOTO_KEYS.forEach((k) => (av[k] = r[k])); else av = Object.assign(r, keep);
    buildOptions();
  };

  // ---------- Photo crop editor ----------
  const cc = $('#crop'), cctx = cc.getContext('2d');
  function baseScale() { return photoImg ? Math.max(CROP.W / photoImg.width, CROP.W / photoImg.height) : 1; }
  function drawCrop() {
    const W = CROP.W; cctx.clearRect(0, 0, W, W);
    if (!photoImg) {
      cctx.fillStyle = '#26222e'; cctx.fillRect(0, 0, W, W);
      cctx.fillStyle = '#a49cb3'; cctx.font = '28px Segoe UI, sans-serif'; cctx.textAlign = 'center';
      cctx.fillText('Choose a photo', W / 2, W / 2);
      return;
    }
    const s = baseScale() * crop.zoom;
    const w = photoImg.width * s, h = photoImg.height * s;
    cctx.drawImage(photoImg, W / 2 - w / 2 + crop.ox, W / 2 - h / 2 + crop.oy, w, h);
    // darken outside the head mask
    cctx.save();
    cctx.fillStyle = 'rgba(10,8,14,0.65)';
    cctx.beginPath(); cctx.rect(0, 0, W, W);
    maskPath(cctx, W / 2, W / 2, CROP.rx, CROP.ry, true);
    cctx.fill('evenodd');
    cctx.restore();
    cctx.beginPath(); maskPath(cctx, W / 2, W / 2, CROP.rx, CROP.ry, false); cctx.lineWidth = 4; cctx.strokeStyle = '#fff'; cctx.stroke();
    const y = W / 2 - CROP.ry + 2 * CROP.ry * Number($('#split').value);
    cctx.setLineDash([14, 10]); cctx.lineWidth = 5; cctx.strokeStyle = '#ff7a45';
    cctx.beginPath(); cctx.moveTo(W / 2 - CROP.rx, y); cctx.lineTo(W / 2 + CROP.rx, y); cctx.stroke(); cctx.setLineDash([]);
  }
  function maskPath(ctx, cx, cy, rx, ry, sub) {
    if ($('#photoShape').value === 'square') {
      const x = cx - rx, y = cy - ry, w = rx * 2, h = ry * 2, r = 22 * (rx / 60);
      if (sub) { ctx.moveTo(x + r, y); ctx.arcTo(x, y, x, y + h, r); ctx.arcTo(x, y + h, x + w, y + h, r); ctx.arcTo(x + w, y + h, x + w, y, r); ctx.arcTo(x + w, y, x, y, r); ctx.closePath(); }
      else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    } else { ctx.moveTo(cx + rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2, sub); }
  }
  // Bake the framed region into a small image stored in the avatar.
  let bakeTimer = null;
  function bakePhoto() {
    if (!photoImg) return;
    const out = document.createElement('canvas'); out.width = 200; out.height = 180;
    const o = out.getContext('2d');
    const k = out.width / (CROP.rx * 2);
    const s = baseScale() * crop.zoom;
    const w = photoImg.width * s, h = photoImg.height * s;
    o.scale(k, k);
    o.translate(-(CROP.W / 2 - CROP.rx), -(CROP.W / 2 - CROP.ry));
    o.drawImage(photoImg, CROP.W / 2 - w / 2 + crop.ox, CROP.W / 2 - h / 2 + crop.oy, w, h);
    let url = out.toDataURL('image/webp', 0.86);
    if (!url.startsWith('data:image/webp')) url = out.toDataURL('image/jpeg', 0.86);
    av.photo = url; av.photoSplit = Number($('#split').value); av.headShape = $('#photoShape').value;
    photoDirty = false;
  }
  function changed() { drawCrop(); photoDirty = true; clearTimeout(bakeTimer); bakeTimer = setTimeout(bakePhoto, 120); }
  $('#photoFile').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => { photoImg = img; crop.ox = 0; crop.oy = 0; crop.zoom = 1; $('#zoom').value = 1; av.kind = 'photo'; changed(); };
    img.src = URL.createObjectURL(f);
  };
  $('#zoom').oninput = (e) => { crop.zoom = Number(e.target.value); changed(); };
  $('#split').oninput = changed;
  $('#photoShape').onchange = changed;
  let drag = null;
  const box = $('#cropBox');
  box.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, ox: crop.ox, oy: crop.oy }; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', (e) => { if (!drag) return; const k = CROP.W / box.clientWidth; crop.ox = drag.ox + (e.clientX - drag.x) * k; crop.oy = drag.oy + (e.clientY - drag.y) * k; changed(); });
  box.addEventListener('pointerup', () => (drag = null));
  box.addEventListener('wheel', (e) => { e.preventDefault(); crop.zoom = Math.min(4, Math.max(0.2, crop.zoom * (e.deltaY < 0 ? 1.06 : 0.94))); $('#zoom').value = crop.zoom; changed(); }, { passive: false });

  // ---------- Preview ----------
  const vc = $('#view'), vctx = vc.getContext('2d');
  const anim = new P.Animator('creator');
  let holding = false;
  $('#talk').addEventListener('pointerdown', () => (holding = true));
  addEventListener('pointerup', () => (holding = false));
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
    anim.talking = holding || ($('#autoTalk').checked && Math.sin(t * 0.9) > 0);
    anim.update(dt, t);
    vctx.clearRect(0, 0, vc.width, vc.height);
    const show = mode === 'photo' && !av.photo ? Object.assign({}, av, { kind: 'drawn' }) : av;
    P.draw(vctx, show, anim.state(t), { x: vc.width / 2, y: vc.height - 100, scale: 2.6, name: av.name || null });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- Identity fields ----------
  $('#name').oninput = (e) => (av.name = e.target.value.trim());
  $('#discordId').oninput = (e) => (av.id = e.target.value.replace(/\D/g, ''));
  function syncFields() { $('#name').value = av.name || ''; $('#discordId').value = av.id || ''; }

  // ---------- Export ----------
  const msg = (html) => ($('#msg').innerHTML = html);
  function finalAvatar() {
    if (mode === 'photo') { if (photoDirty) bakePhoto(); if (!av.photo) throw new Error('Choose a photo first.'); }
    if (!/^\d{15,22}$/.test(av.id)) throw new Error('Enter your Discord user ID (17–20 digits) so your friends’ apps can recognise you.');
    const out = Object.assign({}, av, { kind: mode });
    if (mode !== 'photo') delete out.photo;
    return out;
  }
  $('#dlFile').onclick = () => {
    try {
      const a = finalAvatar();
      const blob = new Blob([P.toFileContent(a)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = (a.name || a.id).replace(/[^\w\-]+/g, '_') + '.puppet';
      link.click();
      msg('<span class="ok">✔ File downloaded — send it to your friends; they drop it into their Avatars tab.</span>');
    } catch (e) { msg(`<span class="err">✖ ${e.message}</span>`); }
  };
  $('#copyCode').onclick = async () => {
    try {
      const a = finalAvatar();
      if (a.kind === 'photo') throw new Error('Photo avatars are too large for a code — use the .puppet file.');
      const code = P.encodeCode(a);
      await navigator.clipboard.writeText(code);
      msg(`<span class="ok">✔ Code copied (${code.length} characters). Paste it to your friends on Discord.</span>`);
    } catch (e) { msg(`<span class="err">✖ ${e.message}</span>`); }
  };
  $('#sendApp').onclick = async () => {
    try {
      const a = finalAvatar();
      const r = await fetch('/api/avatars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) });
      const j = await r.json(); if (!j.ok) throw new Error(j.error);
      msg('<span class="ok">✔ Saved to your overlay. Remember to share the file or code with your friends too.</span>');
    } catch (e) { msg(`<span class="err">✖ ${e.message}</span>`); }
  };

  // ---------- Load existing ----------
  function load(a) {
    av = P.normalize(a);
    syncFields();
    if (av.kind === 'photo' && av.photo) {
      const img = new Image();
      img.onload = () => {
        photoImg = img; crop.ox = 0; crop.oy = 0;
        crop.zoom = (CROP.rx * 2) / (img.width * baseScale());
        $('#zoom').value = crop.zoom; $('#split').value = av.photoSplit || 0.6; $('#photoShape').value = av.headShape === 'square' ? 'square' : 'round';
        drawCrop();
      };
      img.src = av.photo;
    }
    setMode(av.kind === 'photo' ? 'photo' : 'drawn');
  }
  $('#loadBtn').onclick = () => { try { load(P.decodeAny($('#loadCode').value)); msg('<span class="ok">✔ Avatar loaded.</span>'); } catch (e) { msg('<span class="err">✖ Unreadable code.</span>'); } };
  $('#loadFile').onchange = (e) => { const f = e.target.files[0]; if (f) f.text().then((t) => { try { load(P.decodeAny(t)); } catch (err) { msg('<span class="err">✖ Unreadable file.</span>'); } }); };

  // ---------- Boot ----------
  const qid = new URLSearchParams(location.search).get('id') || '';
  av.id = qid;
  syncFields();
  setMode('drawn');
  if (location.protocol.startsWith('http')) {
    fetch('/api/state').then((r) => r.json()).then((s) => {
      $('#sendApp').classList.remove('hidden');
      const existing = qid && s.avatars && s.avatars[qid];
      if (existing) load(existing);
      else if (!av.name && s.discord && s.discord.me && s.discord.me.id === qid) { av.name = s.discord.me.name; syncFields(); }
    }).catch(() => {});
  }
})();
