/*
 * HUD page "Scenes": several widgets in one OBS Browser Source of the size you choose.
 * Drag the widgets on the canvas, resize them with the corner, arrows nudge (Shift = 10 px).
 * Saved in settings.scenes; OBS loads scene.html?id=… (see scene.js).
 */
(function () {
  'use strict';
  const { $, t, escapeHtml, toast } = Panel;
  const ORIGIN = location.origin.replace('127.0.0.1', 'localhost');
  const WIDGETS = [['followers', 'followers', 420, 110], ['subs', 'subs', 420, 110], ['latestFollower', 'latest-follower', 680, 110], ['latestSub', 'latest-sub', 680, 110],
    ['spotify', 'spotify', 640, 190], ['chat', 'chat', 460, 620], ['alerts', 'alerts', 200, 60]];
  const SIZES = [[1920, 1080], [1280, 720], [2560, 1440], [1080, 1920], [800, 600]];
  const name = (w) => ({ followers: t('Followers'), subs: t('Subs'), latestFollower: t('Latest follower'), latestSub: t('Latest sub'), spotify: t('Now playing (Spotify)'), chat: t('Live chat'), alerts: t('Alert sounds') }[w]);
  let scenes = [], cur = null, sel = -1, saveTimer = 0, builtKey = '', k = 1;
  const stage = $('#scnStage');

  const newId = () => Math.random().toString(36).slice(2, 10).replace(/[^a-z0-9]/g, 'a').padEnd(8, 'x');
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => Panel.save('scenes', scenes), 300); }
  const scene = () => scenes.find((s) => s.id === cur) || null;

  function renderBar() {
    $('#scnPick').innerHTML = scenes.map((s) => `<option value="${escapeHtml(s.id)}"${s.id === cur ? ' selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
    const sc = scene();
    $('#scnEmpty').classList.toggle('hidden', !!sc);
    $('#scnWork').classList.toggle('hidden', !sc);
    if (!sc) return;
    $('#scnName').value = sc.name;
    $('#scnW').value = sc.width; $('#scnH').value = sc.height;
    const preset = SIZES.findIndex(([w, h]) => w === sc.width && h === sc.height);
    $('#scnSize').value = preset >= 0 ? String(preset) : 'custom';
    const url = `${ORIGIN}/scene.html?id=${sc.id}`;
    $('#scnUrl').textContent = url;
    $('#scnUrl').dataset.url = url;
    $('#scnObsSize').textContent = `${sc.width} × ${sc.height}`;
    $('#scnAdd').innerHTML = WIDGETS.map(([w]) => `<button class="ghost small" data-add="${w}">＋ ${escapeHtml(name(w))}</button>`).join('');
  }

  // ---------- Canvas ----------
  function build() {
    const sc = scene();
    if (!sc) { stage.innerHTML = ''; builtKey = ''; return; }
    const key = sc.id + JSON.stringify(sc.items.map((i) => i.w)) + sc.width + 'x' + sc.height + I18N.lang;
    if (key !== builtKey) {
      builtKey = key;
      stage.innerHTML = `<div class="scn-canvas" style="width:${sc.width}px;height:${sc.height}px"><div class="scn-guides"><i class="gv"></i><i class="gh"></i></div>${sc.items.map((it, i) => `
        <div class="si" data-i="${i}"><iframe src="widget.html?w=${WIDGETS.find((x) => x[0] === it.w)[1]}&preview=1" tabindex="-1"></iframe>
        <div class="si-grab" title="${escapeHtml(name(it.w))}"><span>${escapeHtml(name(it.w))}</span><i class="si-size"></i></div></div>`).join('')}</div>`;
    }
    fit();
    place();
  }
  function fit() {
    const sc = scene();
    const c = stage.querySelector('.scn-canvas');
    if (!sc || !c) return;
    const w = stage.clientWidth - 2;
    k = Math.min(w / sc.width, 560 / sc.height);
    c.style.transform = `scale(${k})`;
    stage.style.height = Math.ceil(sc.height * k) + 2 + 'px';
  }
  function place() {
    const sc = scene();
    if (!sc) return;
    stage.querySelectorAll('.si').forEach((el) => {
      const it = sc.items[+el.dataset.i];
      Object.assign(el.style, { left: it.x + 'px', top: it.y + 'px', width: it.width + 'px', height: it.height + 'px' });
      el.classList.toggle('sel', +el.dataset.i === sel);
      el.querySelector('.si-size').textContent = `${it.width}×${it.height}`;
    });
    renderInsp();
  }
  function renderInsp() {
    const sc = scene(), it = sc && sc.items[sel];
    $('#scnInsp').classList.toggle('hidden', !it);
    if (!it) return;
    $('#scnInspName').textContent = name(it.w);
    for (const f of ['x', 'y', 'width', 'height']) { const el = $('#scnI-' + f); if (document.activeElement !== el) el.value = it[f]; }
  }
  function feed() {
    stage.querySelectorAll('iframe').forEach((f) => { try { f.contentWindow.postMessage({ type: 'po-state', state: Panel.state }, location.origin); } catch (e) { /* loading */ } });
  }
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'po-widget-ready') return;
    const f = [...stage.querySelectorAll('iframe')].find((x) => x.contentWindow === e.source);
    if (f) f.contentWindow.postMessage({ type: 'po-state', state: Panel.state }, location.origin);
  });

  // ---------- Drag / resize with snapping (grid 10 px, canvas edges and centre) ----------
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    const grab = e.target.closest('.si-grab');
    if (!grab) { if (e.target.closest('.scn-canvas')) { sel = -1; place(); } return; }
    const el = grab.parentElement, i = +el.dataset.i, it = scene().items[i];
    sel = i;
    drag = { i, resize: e.target.classList.contains('si-size') || (e.offsetX > grab.clientWidth - 18 && e.offsetY > grab.clientHeight - 18), sx: e.clientX, sy: e.clientY, o: Object.assign({}, it) };
    grab.setPointerCapture(e.pointerId);
    place();
    e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const sc = scene(), it = sc.items[drag.i];
    const dx = (e.clientX - drag.sx) / k, dy = (e.clientY - drag.sy) / k;
    const snap = (v, targets) => { for (const tg of targets) if (Math.abs(v - tg) < 10 / k * 0.8) return tg; return e.altKey ? v : Math.round(v / 10) * 10; };
    let gv = false, gh = false;
    if (drag.resize) {
      it.width = Math.max(40, snap(drag.o.width + dx, [sc.width - it.x]));
      it.height = Math.max(40, snap(drag.o.height + dy, [sc.height - it.y]));
    } else {
      let x = drag.o.x + dx, y = drag.o.y + dy;
      const cx = sc.width / 2 - it.width / 2, cy = sc.height / 2 - it.height / 2;
      x = snap(x, [0, sc.width - it.width, cx]); y = snap(y, [0, sc.height - it.height, cy]);
      gv = x === cx; gh = y === cy;
      it.x = Math.round(x); it.y = Math.round(y);
    }
    stage.querySelector('.gv').classList.toggle('on', gv);
    stage.querySelector('.gh').classList.toggle('on', gh);
    place();
  });
  const endDrag = () => { if (!drag) return; drag = null; stage.querySelectorAll('.scn-guides i').forEach((g) => g.classList.remove('on')); save(); };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  document.addEventListener('keydown', (e) => {
    if (Panel.tab !== 'scenes' || sel < 0 || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const it = scene() && scene().items[sel];
    if (!it) return;
    const step = e.shiftKey ? 10 : 1;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (mv) { it.x += mv[0]; it.y += mv[1]; place(); save(); e.preventDefault(); }
    if (e.key === 'Delete') { removeSel(); e.preventDefault(); }
  });
  function removeSel() { const sc = scene(); if (!sc || sel < 0) return; sc.items.splice(sel, 1); sel = -1; build(); save(); }

  // ---------- Controls ----------
  $('#scnNew').onclick = () => {
    if (scenes.length >= 20) { toast(t('20 scenes max')); return; }
    const sc = { id: newId(), name: t('Scene {n}', { n: scenes.length + 1 }), width: 1920, height: 1080, items: [] };
    scenes.push(sc); cur = sc.id; sel = -1; renderBar(); build(); save();
  };
  $('#scnDup').onclick = () => { const sc = scene(); if (!sc || scenes.length >= 20) return; const c = JSON.parse(JSON.stringify(sc)); c.id = newId(); c.name = (sc.name + ' 2').slice(0, 40); scenes.push(c); cur = c.id; renderBar(); build(); save(); };
  let armDel = false;
  $('#scnDel').onclick = (e) => {
    if (!armDel) { armDel = true; e.target.textContent = t('Confirm deletion?'); setTimeout(() => { armDel = false; e.target.textContent = t('Delete'); }, 3000); return; }
    armDel = false; e.target.textContent = t('Delete');
    scenes = scenes.filter((s) => s.id !== cur); cur = scenes[0] ? scenes[0].id : null; sel = -1; renderBar(); build(); save();
  };
  $('#scnPick').onchange = (e) => { cur = e.target.value; sel = -1; renderBar(); build(); };
  $('#scnName').oninput = (e) => { const sc = scene(); if (sc) { sc.name = e.target.value.slice(0, 40); save(); $('#scnPick').selectedOptions[0].textContent = sc.name; } };
  $('#scnSize').onchange = (e) => { const sc = scene(); if (!sc || e.target.value === 'custom') return; [sc.width, sc.height] = SIZES[+e.target.value]; renderBar(); build(); save(); };
  ['scnW', 'scnH'].forEach((id) => { $('#' + id).onchange = (e) => { const sc = scene(); if (!sc) return; const v = Math.max(200, Math.min(3840, Math.round(+e.target.value) || 0)); if (id === 'scnW') sc.width = v; else sc.height = v; renderBar(); build(); save(); }; });
  $('#scnAdd').addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    const sc = scene();
    if (!b || !sc) return;
    if (sc.items.length >= 24) { toast(t('24 widgets max per scene')); return; }
    const [w, , width, height] = WIDGETS.find((x) => x[0] === b.dataset.add);
    const n = sc.items.length;
    sc.items.push({ w, x: Math.min(sc.width - width, 40 + n * 30), y: Math.min(sc.height - height, 40 + n * 30), width, height });
    sel = sc.items.length - 1; build(); save();
  });
  ['x', 'y', 'width', 'height'].forEach((f) => { $('#scnI-' + f).onchange = (e) => { const it = scene() && scene().items[sel]; if (!it) return; it[f] = Math.round(+e.target.value) || 0; if (f === 'width' || f === 'height') it[f] = Math.max(40, it[f]); place(); save(); }; });
  $('#scnInsp').addEventListener('click', (e) => {
    const b = e.target.closest('[data-al]');
    const sc = scene(), it = sc && sc.items[sel];
    if (!b || !it) return;
    const a = b.dataset.al;
    if (a === 'left') it.x = 0; if (a === 'hcenter') it.x = Math.round((sc.width - it.width) / 2); if (a === 'right') it.x = sc.width - it.width;
    if (a === 'top') it.y = 0; if (a === 'vcenter') it.y = Math.round((sc.height - it.height) / 2); if (a === 'bottom') it.y = sc.height - it.height;
    if (a === 'front') { sc.items.push(sc.items.splice(sel, 1)[0]); sel = sc.items.length - 1; build(); }
    if (a === 'remove') { removeSel(); return; }
    place(); save();
  });
  $('#scnCopy').onclick = () => navigator.clipboard.writeText($('#scnUrl').dataset.url).then(() => toast(t('Copied: add it as a Browser Source in OBS')), () => toast(t('Could not copy')));
  $('#scnOpen').onclick = () => Panel.action('open-url-local', { path: 'scene.html?id=' + cur + '&fit=1' });
  addEventListener('resize', () => { if (Panel.tab === 'scenes') { fit(); } });

  let lastSaved = '';
  Panel.onState((s, langChanged) => {
    if (!s.settings) return;
    const incoming = JSON.stringify(s.settings.scenes || []);
    // Take the saved scenes unless we are editing (pending save or drag).
    if (incoming !== lastSaved && !drag && !saveTimer) {
      lastSaved = incoming;
      scenes = JSON.parse(incoming);
      if (!scenes.find((x) => x.id === cur)) cur = scenes[0] ? scenes[0].id : null;
      if (Panel.tab === 'scenes') { renderBar(); build(); }
    }
    if (langChanged && Panel.tab === 'scenes') { builtKey = ''; renderBar(); build(); }
    if (Panel.tab === 'scenes') feed();
  });
  // Saves flow back through the state; clear the pending flag once sent.
  const origSave = save;
  save = function () { origSave(); clearTimeout(save.t); save.t = setTimeout(() => { saveTimer = 0; lastSaved = JSON.stringify(scenes); }, 400); };
  // The section may still be hidden when the tab event fires: measure once it is laid out.
  new ResizeObserver(() => { if (Panel.tab === 'scenes') fit(); }).observe(stage);
  Panel.onTab((name) => {
    if (name === 'scenes') { renderBar(); builtKey = ''; requestAnimationFrame(build); }
    else if (builtKey) { stage.innerHTML = ''; builtKey = ''; }
  });
})();
