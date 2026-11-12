/* Avatar creator: drawn ("from scratch") or photo puppet. Works standalone (file://) or served by the app. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const P = Puppet;
  const t = I18N.t;

  let av = P.defaultAvatar();
  let mode = 'drawn';
  let photoImg = null; // source image for the crop editor
  const crop = { ox: 0, oy: 0, zoom: 1 };
  const CROP = { W: 640, rx: 270, ry: 243 }; // ellipse ratio matches the puppet head (60:54)
  let photoDirty = false;

  // ---------- Tabs & controls ----------
  // photo: true = also offered for photo puppets (body, accessories…)
  const TABS = [
    { id: 'head', label: 'Head', items: [
      { type: 'opt', key: 'headShape', label: 'Head shape' },
      { type: 'color', key: 'skin', label: 'Skin', pal: 'skin' },
      { type: 'slider', key: 'headSize', label: 'Head size', photo: true },
      { type: 'opt', key: 'nose', label: 'Nose' },
      { type: 'opt', key: 'cheeks', label: 'Cheeks' },
      { type: 'opt', key: 'teeth', label: 'Teeth' },
    ] },
    { id: 'eyes', label: 'Eyes', items: [
      { type: 'opt', key: 'eyes', label: 'Eyes', exclude: ['glasses'] },
      { type: 'color', key: 'eyeColor', label: 'Eye colour', pal: 'eye' },
      { type: 'slider', key: 'eyeSize', label: 'Eye size' },
      { type: 'slider', key: 'eyeSpacing', label: 'Eye spacing' },
      { type: 'slider', key: 'eyeHeight', label: 'Eye height' },
      { type: 'opt', key: 'brows', label: 'Eyebrows' },
      { type: 'opt', key: 'glasses', label: 'Glasses', photo: true },
      { type: 'color', key: 'glassesColor', label: 'Glasses colour', pal: 'cloth', photo: true },
    ] },
    { id: 'hair', label: 'Hair', items: [
      { type: 'opt', key: 'hair', label: 'Hair' },
      { type: 'color', key: 'hairColor', label: 'Hair / beard', pal: 'hair' },
      { type: 'opt', key: 'beard', label: 'Facial hair' },
    ] },
    { id: 'outfit', label: 'Outfit', items: [
      { type: 'opt', key: 'outfit', label: 'Outfit', photo: true },
      { type: 'opt', key: 'pattern', label: 'Pattern', photo: true },
      { type: 'color', key: 'clothColor', label: 'Clothes', pal: 'cloth', photo: true },
      { type: 'color', key: 'accentColor', label: 'Details', pal: 'cloth', photo: true },
      { type: 'slider', key: 'bodyWidth', label: 'Body width', photo: true },
      { type: 'slider', key: 'bodyHeight', label: 'Body height', photo: true },
    ] },
    { id: 'extras', label: 'Accessories', items: [
      { type: 'opt', key: 'hat', label: 'Hat', photo: true },
      { type: 'color', key: 'hatColor', label: 'Hat', pal: 'cloth', photo: true },
      { type: 'opt', key: 'neckwear', label: 'Neckwear', photo: true },
      { type: 'color', key: 'neckColor', label: 'Neckwear colour', pal: 'cloth', photo: true },
      { type: 'opt', key: 'held', label: 'In hand', photo: true },
    ] },
  ];
  let tab = 'head';
  const visibleItems = (tb) => tb.items.filter((it) => mode !== 'photo' || it.photo);
  const visibleTabs = () => TABS.filter((tb) => visibleItems(tb).length);

  function buildTabs() {
    const bar = $('#ctabs'); bar.innerHTML = '';
    if (!visibleTabs().some((x) => x.id === tab)) tab = visibleTabs()[0].id;
    visibleTabs().forEach((tb) => {
      const b = document.createElement('button'); b.className = 'ctab' + (tb.id === tab ? ' on' : ''); b.textContent = t(tb.label);
      b.onclick = () => { tab = tb.id; buildTabs(); buildOptions(); };
      bar.appendChild(b);
    });
    const grow = document.createElement('div'); grow.className = 'grow'; bar.appendChild(grow);
    const dice = document.createElement('button'); dice.className = 'ghost iconbtn'; dice.textContent = '🎲 ' + t('This tab');
    dice.title = t('Randomize only this tab');
    dice.onclick = () => {
      const r = P.randomAvatar(Math.random().toString(36));
      visibleItems(TABS.find((x) => x.id === tab)).forEach((it) => (av[it.key] = r[it.key]));
      commit(); buildOptions();
    };
    bar.appendChild(dice);
  }

  function buildOptions() {
    const box = $('#options'); box.innerHTML = '';
    const card = document.createElement('div'); card.className = 'card';
    visibleItems(TABS.find((x) => x.id === tab)).forEach((it) => {
      const row = document.createElement('div');
      if (it.type === 'opt') {
        row.className = 'opt-row';
        row.innerHTML = `<div class="lbl">${t(it.label)}</div><div class="chips"></div>`;
        P.OPTIONS[it.key].filter((v) => !(it.exclude || []).includes(v)).forEach((v) => {
          const b = document.createElement('button'); b.className = 'chip' + (av[it.key] === v ? ' on' : ''); b.textContent = t(P.prettyLabel(v));
          b.onclick = () => { av[it.key] = v; commit(); buildOptions(); };
          row.lastChild.appendChild(b);
        });
      } else if (it.type === 'color') {
        row.className = 'opt-row';
        row.innerHTML = `<div class="lbl">${t(it.label)}</div><div class="sw"></div>`;
        P.PALETTES[it.pal].forEach((c) => {
          const b = document.createElement('button'); b.style.background = c; b.title = c;
          if ((av[it.key] || '').toLowerCase() === c.toLowerCase()) b.className = 'on';
          b.onclick = () => { av[it.key] = c; commit(); buildOptions(); };
          row.lastChild.appendChild(b);
        });
        const custom = document.createElement('input'); custom.type = 'color'; custom.value = av[it.key] || '#ffffff'; custom.title = t('Custom colour');
        custom.oninput = () => { av[it.key] = custom.value; };
        custom.onchange = () => { commit(); buildOptions(); };
        row.lastChild.appendChild(custom);
      } else if (it.type === 'slider') {
        const [min, max, def] = P.SLIDERS[it.key];
        row.className = 'slider-row';
        row.innerHTML = `<span>${t(it.label)}</span><input type="range" min="${min}" max="${max}" step="0.01"><output></output>`;
        const inp = row.querySelector('input'), out = row.querySelector('output');
        const show = () => (out.textContent = it.key === 'eyeHeight' ? (av[it.key] > 0 ? '+' : '') + Math.round(av[it.key] * 100) : Math.round(av[it.key] * 100) + '%');
        inp.value = av[it.key]; show();
        inp.oninput = () => { av[it.key] = Number(inp.value); show(); };
        inp.onchange = commit;
        inp.ondblclick = () => { av[it.key] = def; inp.value = def; show(); commit(); };
        row.title = t('Double-click to reset');
      }
      card.appendChild(row);
    });
    box.appendChild(card);
  }

  // ---------- Undo / redo ----------
  let history = [], hIndex = -1;
  function commit() {
    const snap = JSON.stringify(av);
    if (history[hIndex] === snap) return;
    history = history.slice(0, hIndex + 1); history.push(snap); hIndex = history.length - 1;
    if (history.length > 80) { history.shift(); hIndex--; }
    updateUndo();
  }
  function restore(i) {
    hIndex = i;
    const prev = av;
    av = JSON.parse(history[i]);
    av.id = prev.id; av.name = prev.name; // identity fields are not part of undo
    if (av.kind !== mode) setMode(av.kind, true); else { buildTabs(); buildOptions(); }
    updateUndo();
  }
  function updateUndo() { $('#undo').disabled = hIndex <= 0; $('#redo').disabled = hIndex >= history.length - 1; }
  $('#undo').onclick = () => { if (hIndex > 0) restore(hIndex - 1); };
  $('#redo').onclick = () => { if (hIndex < history.length - 1) restore(hIndex + 1); };
  addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || /INPUT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.type !== 'range') return;
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); $('#undo').click(); }
    if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); $('#redo').click(); }
  });

  function setMode(m, fromHistory) {
    mode = m;
    av.kind = m;
    $$('.modes [data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    $('#photoPanel').classList.toggle('hidden', m !== 'photo');
    buildTabs(); buildOptions();
    if (m === 'photo') drawCrop();
    if (!fromHistory) commit();
  }
  $$('.modes [data-mode]').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  $('#random').onclick = () => {
    const keep = { id: av.id, name: av.name, kind: av.kind, photo: av.photo, photoSplit: av.photoSplit, headShape: av.headShape };
    const r = P.randomAvatar(Math.random().toString(36));
    if (mode === 'photo') { TABS.forEach((tb) => tb.items.filter((it) => it.photo).forEach((it) => (av[it.key] = r[it.key]))); }
    else av = Object.assign(r, keep, { headShape: r.headShape });
    commit(); buildOptions();
  };

  // ---------- Photo crop editor ----------
  const cc = $('#crop'), cctx = cc.getContext('2d');
  const adj = () => ({
    rot: Number($('#pRotate').value) * Math.PI / 180, mirror: $('#pMirror').checked,
    filter: `brightness(${$('#pBright').value}%) contrast(${$('#pContrast').value}%) saturate(${$('#pGray').checked ? 0 : $('#pSat').value}%)`,
    cartoon: $('#pCartoon').checked,
  });
  function baseScale() { return photoImg ? Math.max(CROP.W / photoImg.width, CROP.W / photoImg.height) : 1; }
  // Draws the photo with the current crop/rotation/mirror/filters into a context whose origin is the crop canvas.
  function paintPhoto(ctx) {
    const A = adj();
    const s = baseScale() * crop.zoom;
    const w = photoImg.width * s, h = photoImg.height * s;
    ctx.save();
    ctx.filter = A.filter;
    ctx.translate(CROP.W / 2 + crop.ox, CROP.W / 2 + crop.oy);
    ctx.rotate(A.rot);
    if (A.mirror) ctx.scale(-1, 1);
    ctx.drawImage(photoImg, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  function drawCrop() {
    const W = CROP.W; cctx.clearRect(0, 0, W, W);
    if (!photoImg) {
      cctx.fillStyle = '#26222e'; cctx.fillRect(0, 0, W, W);
      cctx.fillStyle = '#a49cb3'; cctx.font = '28px Segoe UI, sans-serif'; cctx.textAlign = 'center';
      cctx.fillText(t('Choose a photo'), W / 2, W / 2);
      return;
    }
    paintPhoto(cctx);
    if (adj().cartoon) posterize(cctx, W, W);
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
  // Flat-colour "cartoon" look: quantize each channel and slightly boost saturation.
  function posterize(ctx, w, h) {
    try {
      const d = ctx.getImageData(0, 0, w, h), p = d.data, L = 5, step = 255 / (L - 1);
      for (let i = 0; i < p.length; i += 4) for (let k = 0; k < 3; k++) p[i + k] = Math.round(Math.round(p[i + k] / step) * step);
      ctx.putImageData(d, 0, 0);
    } catch (e) { /* tainted canvas: skip */ }
  }
  function maskPath(ctx, cx, cy, rx, ry, sub) {
    if ($('#photoShape').value === 'square') {
      const x = cx - rx, y = cy - ry, w = rx * 2, h = ry * 2, r = 22 * (rx / 60);
      if (sub) { ctx.moveTo(x + r, y); ctx.arcTo(x, y, x, y + h, r); ctx.arcTo(x, y + h, x + w, y + h, r); ctx.arcTo(x + w, y + h, x + w, y, r); ctx.arcTo(x + w, y, x, y, r); ctx.closePath(); }
      else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    } else { ctx.moveTo(cx + rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2, sub); }
  }
  // Bake the framed region (with all adjustments) into a small image stored in the avatar.
  let bakeTimer = null;
  function bakePhoto() {
    if (!photoImg) return;
    const out = document.createElement('canvas'); out.width = 220; out.height = 198;
    const o = out.getContext('2d');
    const k = out.width / (CROP.rx * 2);
    o.save(); o.scale(k, k); o.translate(-(CROP.W / 2 - CROP.rx), -(CROP.W / 2 - CROP.ry));
    paintPhoto(o);
    o.restore();
    if (adj().cartoon) posterize(o, out.width, out.height);
    let url = out.toDataURL('image/webp', 0.86);
    if (!url.startsWith('data:image/webp')) url = out.toDataURL('image/jpeg', 0.86);
    av.photo = url; av.photoSplit = Number($('#split').value); av.headShape = $('#photoShape').value;
    photoDirty = false;
  }
  function changed() { drawCrop(); photoDirty = true; clearTimeout(bakeTimer); bakeTimer = setTimeout(() => { bakePhoto(); commit(); }, 150); }
  function resetAdjust() { $('#pRotate').value = 0; $('#pBright').value = 100; $('#pContrast').value = 100; $('#pSat').value = 100; $('#pMirror').checked = false; $('#pCartoon').checked = false; $('#pGray').checked = false; }
  $('#photoFile').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => { photoImg = img; crop.ox = 0; crop.oy = 0; crop.zoom = 1; $('#zoom').value = 1; resetAdjust(); av.kind = 'photo'; changed(); };
    img.src = URL.createObjectURL(f);
  };
  $('#zoom').oninput = (e) => { crop.zoom = Number(e.target.value); changed(); };
  ['#split', '#pRotate', '#pBright', '#pContrast', '#pSat'].forEach((id) => ($(id).oninput = changed));
  ['#photoShape', '#pMirror', '#pCartoon', '#pGray'].forEach((id) => ($(id).onchange = changed));
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
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const tt = now / 1000;
    anim.talking = holding || ($('#autoTalk').checked && Math.sin(tt * 0.9) > 0);
    anim.update(dt, tt);
    vctx.clearRect(0, 0, vc.width, vc.height);
    const show = mode === 'photo' && !av.photo ? Object.assign({}, av, { kind: 'drawn' }) : av;
    // shrink a little when the avatar is tall (hat + big head + tall body) so it always fits
    const tall = Math.max(1, (-(P.headTopLocal(show)) + 80) / 230);
    P.draw(vctx, show, anim.state(tt), { x: vc.width / 2, y: vc.height - 100, scale: 2.5 / tall, name: av.name || null });
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
    if (mode === 'photo') { if (photoDirty) bakePhoto(); if (!av.photo) throw new Error(t('Choose a photo first.')); }
    if (!/^\d{15,22}$/.test(av.id)) throw new Error(t('Enter your Discord user ID (17–20 digits) so your friends’ apps can recognise you.'));
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
      msg(`<span class="ok">${t('✔ File downloaded — send it to your friends; they drop it into their Avatars tab.')}</span>`);
    } catch (e) { msg(`<span class="err">✖ ${t(e.message)}</span>`); }
  };
  $('#copyCode').onclick = async () => {
    try {
      const a = finalAvatar();
      if (a.kind === 'photo') throw new Error(t('Photo avatars are too large for a code — use the .puppet file.'));
      const code = P.encodeCode(a);
      await navigator.clipboard.writeText(code);
      msg(`<span class="ok">${t('✔ Code copied ({n} characters). Paste it to your friends on Discord.', { n: code.length })}</span>`);
    } catch (e) { msg(`<span class="err">✖ ${t(e.message)}</span>`); }
  };
  $('#sendApp').onclick = async () => {
    try {
      const a = finalAvatar();
      const r = await fetch('/api/avatars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) });
      const j = await r.json(); if (!j.ok) throw new Error(j.error);
      msg(`<span class="ok">${t('✔ Saved to your overlay. Remember to share the file or code with your friends too.')}</span>`);
    } catch (e) { msg(`<span class="err">✖ ${t(e.message)}</span>`); }
  };

  // ---------- Load existing ----------
  function load(a) {
    av = P.normalize(a);
    syncFields();
    if (av.kind === 'photo' && av.photo) {
      const img = new Image();
      img.onload = () => {
        photoImg = img; crop.ox = 0; crop.oy = 0; resetAdjust();
        crop.zoom = (CROP.rx * 2) / (img.width * baseScale());
        $('#zoom').value = crop.zoom; $('#split').value = av.photoSplit || 0.6; $('#photoShape').value = av.headShape === 'square' ? 'square' : 'round';
        drawCrop();
      };
      img.src = av.photo;
    }
    history = []; hIndex = -1;
    setMode(av.kind === 'photo' ? 'photo' : 'drawn');
  }
  $('#loadBtn').onclick = () => { try { load(P.decodeAny($('#loadCode').value)); msg(`<span class="ok">${t('✔ Avatar loaded.')}</span>`); } catch (e) { msg(`<span class="err">${t('✖ Unreadable code.')}</span>`); } };
  $('#loadFile').onchange = (e) => { const f = e.target.files[0]; if (f) f.text().then((tx) => { try { load(P.decodeAny(tx)); } catch (err) { msg(`<span class="err">${t('✖ Unreadable file.')}</span>`); } }); };

  // ---------- Language ----------
  // Served by the app: follow (and change) the app setting. Standalone file: remember locally.
  const served = location.protocol.startsWith('http');
  let langPref = 'auto';
  try { langPref = localStorage.getItem('lang') || 'auto'; } catch (e) {}
  function applyLang(pref) {
    langPref = pref || 'auto';
    $('#lang').value = langPref;
    I18N.setLang(I18N.resolve(langPref));
    I18N.apply(document.body);
    buildTabs(); buildOptions(); drawCrop();
  }
  $('#lang').onchange = () => {
    const v = $('#lang').value;
    try { localStorage.setItem('lang', v); } catch (e) {}
    if (served) fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app: { language: v } }) }).catch(() => {});
    applyLang(v);
  };

  // ---------- Boot ----------
  const qid = new URLSearchParams(location.search).get('id') || '';
  av.id = qid;
  syncFields();
  setMode('drawn');
  applyLang(langPref);
  if (served) {
    fetch('/api/state').then((r) => r.json()).then((s) => {
      $('#sendApp').classList.remove('hidden');
      if (s.settings && s.settings.app) applyLang(s.settings.app.language || 'auto');
      const existing = qid && s.avatars && s.avatars[qid];
      if (existing) load(existing);
      else if (!av.name && s.discord && s.discord.me && s.discord.me.id === qid) { av.name = s.discord.me.name; syncFields(); }
    }).catch(() => {});
  }
})();
