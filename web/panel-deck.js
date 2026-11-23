/*
 * BabaDeck pages in the panel: the deck (press or edit buttons), and the OBS connection with stream health.
 * A button = label + emoji + colours + optional global shortcut + a list of actions run in order.
 */
(function () {
  'use strict';
  const { $, $$, t, escapeHtml, toast } = Panel;
  const TYPES = [
    ['obs.scene', '🎬', 'OBS: switch scene'], ['obs.source', '👁', 'OBS: show / hide a source'], ['obs.mute', '🎙', 'OBS: mute / unmute'],
    ['obs.stream', '🔴', 'OBS: start / stop the stream'], ['obs.record', '⏺', 'OBS: start / stop recording'], ['obs.replay', '💾', 'OBS: save the replay'],
    ['app.marker', '⏱', 'Timestamp (+ clip)'], ['twitch.clip', '🎞', 'Twitch clip (link copied)'], ['twitch.say', '💬', 'Send a chat message'], ['twitch.title', '✏', 'Change the stream title'],
    ['app.alert', '🔔', 'Play an alert sound'], ['app.overlay', '🪆', 'Show / hide the puppets'], ['app.muteChat', '🔇', 'Mute / unmute chat sound'], ['app.fx', '✨', 'Replay entrances'],
    ['app.savane', '🍌', 'Open La savane'],
    ['lab.giveaway', '🎉', 'Giveaway: open / close / draw'], ['lab.poll', '📊', 'End the chat poll'], ['lab.counter', '🔢', 'Counter + / −'], ['lab.queue', '🎮', 'Viewer queue: next…'],
    ['lab.sound', '🔊', 'Play a viewer sound'], ['lab.profile', '✏', 'Apply a title & category preset'], ['lab.ad', '⏰', 'Snooze the next ad'],
    ['url', '🔗', 'Open a link'], ['delay', '⏳', 'Wait'],
  ];
  // Labo test actions start on the first counter / sound / preset, as their selects show.
  function labDefaults(ty) {
    const l = Panel.state.settings.lab;
    if (ty === 'lab.counter') return { name: (l.counters[0] || {}).id || '', delta: '1' };
    if (ty === 'lab.sound') return { name: (l.sounds.list[0] || {}).name || '' };
    if (ty === 'lab.profile') return { name: (l.profiles[0] || {}).name || '' };
    if (ty === 'lab.giveaway') return { op: 'draw' };
    if (ty === 'lab.queue') return { op: 'next' };
    return {};
  }
  const typeInfo = (ty) => TYPES.find((x) => x[0] === ty) || [ty, '?', ty];
  const EMOJIS = ['🎬', '🎮', '💬', '🎙', '🔇', '🔴', '⏺', '⏱', '🎞', '🔔', '🍌', '🪆', '✨', '🚀', '🔥', '💜', '⭐', '😂', '🤝', '☕', '🍕', '🎵', '👋', '🛑'];
  const COLORS = ['#2a2236', '#a970ff', '#ff4fa3', '#ff7a45', '#ffc93c', '#2fd4a3', '#3d8bff', '#e03b3b', '#111111', '#f4f1ea'];
  let deck = null, sel = -1, editing = false, saveTimer = 0, recording = false;
  const isState = () => Panel.state && Panel.state.settings;

  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { saveTimer = 0; Panel.save('deck', deck); }, 300); }
  const page = () => deck.pages[view.page] || deck.pages[0];
  const button = () => (sel >= 0 ? page().buttons[sel] : null);
  const newId = () => 'b' + Math.random().toString(36).slice(2, 9).replace(/[^a-z0-9]/g, 'x');

  const view = DeckView($('#deckView'), {
    editable: true,
    pageTools: '',
    onPage: () => { sel = -1; view.select(-1); renderInsp(); },
    onClick: async (pg, i, el) => {
      if (editing) { sel = i; view.select(i); renderInsp(); return; }
      const b = page().buttons[i];
      if (!b) { editing = true; $('#deckEdit').checked = true; sel = i; view.select(i); document.body.classList.add('deck-editing'); renderInsp(); return; }
      el.classList.add('pressed'); setTimeout(() => el.classList.remove('pressed'), 250);
      await Panel.run('deck-press', { id: b.id });
    },
  });

  // ---------- Inspector ----------
  function sceneOptions(v) { const sc = ((Panel.state.obs || {}).scenes || []); return (sc.includes(v) || !v ? sc : [v].concat(sc)).map((x) => `<option${x === v ? ' selected' : ''}>${escapeHtml(x)}</option>`).join(''); }
  function inputOptions(v) { const ins = ((Panel.state.obs || {}).inputs || []); return (ins.includes(v) || !v ? ins : [v].concat(ins)).map((x) => `<option${x === v ? ' selected' : ''}>${escapeHtml(x)}</option>`).join(''); }
  function params(a, ai) {
    const f = (k, html) => `<label>${html}</label>`;
    const mode = (vals) => f('mode', `${escapeHtml(t('Mode'))}<select data-p="mode">${vals.map((m) => `<option value="${m}"${a.mode === m ? ' selected' : ''}>${escapeHtml(t({ toggle: 'Toggle', start: 'Start', stop: 'Stop', show: 'Show', hide: 'Hide' }[m]))}</option>`).join('')}</select>`);
    switch (a.type) {
      case 'obs.scene': return f('scene', `${escapeHtml(t('Scene'))}<select data-p="scene"><option value="">—</option>${sceneOptions(a.scene)}</select>`);
      case 'obs.source': return f('scene', `${escapeHtml(t('Scene'))}<select data-p="scene"><option value="">—</option>${sceneOptions(a.scene)}</select>`)
        + f('source', `${escapeHtml(t('Source'))}<input data-p="source" value="${escapeHtml(a.source || '')}" list="dkSrc${ai}"><datalist id="dkSrc${ai}" data-for="${escapeHtml(a.scene || '')}"></datalist>`) + mode(['toggle', 'show', 'hide']);
      case 'obs.mute': return f('input', `${escapeHtml(t('Audio source'))}<select data-p="input"><option value="">—</option>${inputOptions(a.input)}</select>`);
      case 'obs.stream': case 'obs.record': return mode(['toggle', 'start', 'stop']);
      case 'app.marker': return f('note', `${escapeHtml(t('Note'))}<input data-p="note" maxlength="140" value="${escapeHtml(a.note || '')}">`);
      case 'twitch.say': return f('text', `${escapeHtml(t('Message'))}<input data-p="text" maxlength="500" value="${escapeHtml(a.text || '')}">`);
      case 'twitch.title': return f('text', `${escapeHtml(t('Title'))}<input data-p="text" maxlength="140" value="${escapeHtml(a.text || '')}">`);
      case 'app.alert': return f('key', `${escapeHtml(t('Event'))}<select data-p="key">${['follow', 'sub', 'prime', 'gift', 'bits', 'raid'].map((k) => `<option value="${k}"${a.key === k ? ' selected' : ''}>${escapeHtml(t({ follow: 'Follow', sub: 'Sub', prime: 'Prime', gift: 'Gifted subs', bits: 'Bits', raid: 'Raid' }[k]))}</option>`).join('')}</select>`);
      case 'lab.giveaway': return f('op', `${escapeHtml(t('Action'))}<select data-p="op">${[['open', 'Open'], ['close', 'Close'], ['draw', 'Draw a winner'], ['reset', 'Reset']].map(([v, l]) => `<option value="${v}"${a.op === v ? ' selected' : ''}>${escapeHtml(t(l))}</option>`).join('')}</select>`);
      case 'lab.queue': return f('op', `${escapeHtml(t('Action'))}<select data-p="op">${[['next', 'Next'], ['open', 'Open the queue'], ['close', 'Close the queue'], ['clear', 'Clear']].map(([v, l]) => `<option value="${v}"${a.op === v ? ' selected' : ''}>${escapeHtml(t(l))}</option>`).join('')}</select>`);
      case 'lab.counter': {
        const cs = (Panel.state.settings.lab.counters || []);
        return f('name', `${escapeHtml(t('Counter'))}<select data-p="name">${cs.map((c) => `<option value="${escapeHtml(c.id)}"${a.name === c.id ? ' selected' : ''}>${escapeHtml(c.name)} (!${escapeHtml(c.cmd)})</option>`).join('') || `<option value="">${escapeHtml(t('Create a counter in Labo test first'))}</option>`}</select>`)
          + f('delta', `${escapeHtml(t('Change'))}<select data-p="delta">${['1', '-1', '5', '-5', 'reset'].map((v) => `<option value="${v}"${String(a.delta || '1') === v ? ' selected' : ''}>${v === 'reset' ? escapeHtml(t('Back to 0')) : (v > 0 ? '+' : '') + v}</option>`).join('')}</select>`);
      }
      case 'lab.sound': return f('name', `${escapeHtml(t('Sound'))}<select data-p="name">${(Panel.state.settings.lab.sounds.list || []).map((x) => `<option value="${escapeHtml(x.name)}"${a.name === x.name ? ' selected' : ''}>!${escapeHtml(x.name)}</option>`).join('') || `<option value="">${escapeHtml(t('Add sounds in Labo test first'))}</option>`}</select>`);
      case 'lab.profile': return f('name', `${escapeHtml(t('Preset'))}<select data-p="name">${(Panel.state.settings.lab.profiles || []).map((x) => `<option value="${escapeHtml(x.name)}"${a.name === x.name ? ' selected' : ''}>${escapeHtml(x.name)}</option>`).join('') || `<option value="">${escapeHtml(t('Save a preset in Labo test first'))}</option>`}</select>`);
      case 'url': return f('url', `${escapeHtml(t('Link'))}<input data-p="url" placeholder="https://…" value="${escapeHtml(a.url || '')}">`);
      case 'delay': return f('ms', `${escapeHtml(t('Milliseconds'))}<input type="number" data-p="ms" min="0" max="10000" step="100" value="${a.ms || 500}">`);
      default: return '';
    }
  }
  function renderInsp() {
    const box = $('#deckInsp');
    const b = button();
    box.classList.toggle('hidden', !editing || sel < 0);
    if (!editing || sel < 0) return;
    if (!b) {
      box.innerHTML = `<div class="dk-new"><p class="muted">${escapeHtml(t('Empty slot.'))}</p><button id="dkCreate">＋ ${escapeHtml(t('Create a button'))}</button></div>`;
      return;
    }
    const hkErr = ((Panel.state.app || {}).hotkeyErrors || {})['deck:' + b.id];
    box.innerHTML = `
      <div class="dk-insp-grid">
        <label>${escapeHtml(t('Label'))}<input data-b="label" maxlength="30" value="${escapeHtml(b.label)}"></label>
        <label>${escapeHtml(t('Icon (emoji)'))}<input data-b="icon" maxlength="8" value="${escapeHtml(b.icon)}"></label>
        <div class="dk-emojis">${EMOJIS.map((e) => `<button class="dk-emo" data-emo="${e}">${e}</button>`).join('')}</div>
        <div class="dk-colors">${COLORS.map((c) => `<button class="dk-col${b.color === c ? ' on' : ''}" data-col="${c}" style="background:${c}"></button>`).join('')}<input type="color" data-b="color" value="${b.color}"><input type="color" data-b="fg" value="${b.fg}" title="${escapeHtml(t('Text colour'))}"></div>
        <label>${escapeHtml(t('Global shortcut (works in game)'))}<input class="dk-hkin" readonly value="${escapeHtml(b.hotkey.replace('CommandOrControl', 'Ctrl'))}" placeholder="${escapeHtml(t('Click, then press keys'))}"><span class="err">${escapeHtml(hkErr ? t(hkErr) : '')}</span></label>
      </div>
      <h3>${escapeHtml(t('Actions (run in order)'))}</h3>
      <div class="dk-actions">${b.actions.map((a, ai) => `<div class="dk-act" data-ai="${ai}"><span class="dk-act-t">${typeInfo(a.type)[1]} ${escapeHtml(t(typeInfo(a.type)[2]))}</span>${params(a, ai)}
        <span class="dk-act-tools"><button class="ghost small" data-act="up" title="↑">↑</button><button class="ghost small" data-act="down" title="↓">↓</button><button class="ghost small danger-text" data-act="del">✕</button></span></div>`).join('') || `<p class="muted">${escapeHtml(t('No action yet.'))}</p>`}</div>
      <div class="btns"><select id="dkAddType">${TYPES.map(([ty, ic, name]) => `<option value="${ty}">${ic} ${escapeHtml(t(name))}</option>`).join('')}</select><button class="small" id="dkAdd">＋ ${escapeHtml(t('Add the action'))}</button>
        <span class="grow"></span><button class="ghost small" id="dkTest">▶ ${escapeHtml(t('Try'))}</button><button class="ghost small danger-text" id="dkDel">${escapeHtml(t('Delete the button'))}</button></div>`;
    box.querySelectorAll('datalist[data-for]').forEach(async (dl) => {
      if (!dl.dataset.for) return;
      const r = await Panel.action('obs-sources', { scene: dl.dataset.for });
      if (r && r.sources) dl.innerHTML = r.sources.map((x) => `<option value="${escapeHtml(x.name)}">`).join('');
    });
  }
  function changed(full) { save(); view.setState({ settings: Object.assign({}, Panel.state.settings, { deck }) }); view.render(true); if (full) renderInsp(); }

  $('#deckInsp').addEventListener('click', (e) => {
    const b = button();
    if (e.target.id === 'dkCreate') { page().buttons[sel] = { id: newId(), label: t('New'), icon: '⭐', color: '#a970ff', fg: '#ffffff', hotkey: '', actions: [] }; changed(true); return; }
    if (!b) return;
    const emo = e.target.closest('[data-emo]'); if (emo) { b.icon = emo.dataset.emo; changed(true); return; }
    const col = e.target.closest('[data-col]'); if (col) { b.color = col.dataset.col; b.fg = ['#ffc93c', '#2fd4a3', '#f4f1ea'].includes(b.color) ? '#160f1c' : '#ffffff'; changed(true); return; }
    if (e.target.id === 'dkAdd') { const ty = $('#dkAddType').value; b.actions.push(Object.assign({ type: ty, mode: 'toggle', ms: 500, key: 'follow' }, labDefaults(ty))); if (b.label === t('New')) { b.label = t(typeInfo(ty)[2]).replace(/^OBS: /, '').slice(0, 30); b.icon = typeInfo(ty)[1]; } changed(true); return; }
    if (e.target.id === 'dkTest') { Panel.run('deck-press', { id: b.id }); return; }
    if (e.target.id === 'dkDel') { page().buttons[sel] = null; changed(true); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      const ai = +act.closest('.dk-act').dataset.ai;
      if (act.dataset.act === 'del') b.actions.splice(ai, 1);
      if (act.dataset.act === 'up' && ai > 0) b.actions.splice(ai - 1, 0, b.actions.splice(ai, 1)[0]);
      if (act.dataset.act === 'down' && ai < b.actions.length - 1) b.actions.splice(ai + 1, 0, b.actions.splice(ai, 1)[0]);
      changed(true);
    }
  });
  $('#deckInsp').addEventListener('change', (e) => {
    const b = button(); if (!b) return;
    const el = e.target;
    if (el.dataset.b) { b[el.dataset.b] = el.value; changed(false); return; }
    if (el.dataset.p) { const a = b.actions[+el.closest('.dk-act').dataset.ai]; a[el.dataset.p] = el.dataset.p === 'ms' ? +el.value : el.value; changed(el.dataset.p === 'scene'); }
  });
  $('#deckInsp').addEventListener('input', (e) => { const b = button(); if (b && (e.target.dataset.b === 'label' || e.target.dataset.b === 'icon')) { b[e.target.dataset.b] = e.target.value; changed(false); } });
  // Shortcut capture (same style as the other shortcut fields).
  $('#deckInsp').addEventListener('keydown', (e) => {
    if (!e.target.classList.contains('dk-hkin')) return;
    e.preventDefault();
    const b = button(); if (!b) return;
    if (e.key === 'Backspace' || e.key === 'Delete') { b.hotkey = ''; e.target.value = ''; changed(false); return; }
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    const mods = [e.ctrlKey && 'CommandOrControl', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean);
    let k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (/^F\d{1,2}$/.test(k) === false && !mods.length) { toast(t('Use Ctrl, Alt or Shift with a key (or F1–F24)')); return; }
    if (k === ' ') k = 'Space';
    b.hotkey = mods.concat(k).join('+');
    e.target.value = b.hotkey.replace('CommandOrControl', 'Ctrl');
    changed(false);
  });

  // ---------- Pages / grid ----------
  $('#deckEdit').onchange = (e) => { editing = e.target.checked; document.body.classList.toggle('deck-editing', editing); if (!editing) { sel = -1; view.select(-1); } renderInsp(); };
  $('#deckAddPage').onclick = () => { if (deck.pages.length >= 10) return; deck.pages.push({ name: t('Page {n}', { n: deck.pages.length + 1 }), buttons: [] }); view.page = deck.pages.length - 1; changed(false); };
  $('#deckRenamePage').onclick = () => { const n = prompt(t('Page name'), page().name); if (n != null) { page().name = n.slice(0, 30) || page().name; changed(false); } };
  $('#deckDelPage').onclick = () => { if (deck.pages.length < 2) return; deck.pages.splice(view.page, 1); view.page = 0; sel = -1; changed(true); };
  $('#deckCols').onchange = (e) => { deck.cols = +e.target.value; changed(false); };
  $('#deckRows').onchange = (e) => { deck.rows = +e.target.value; changed(false); };
  $('#deckFloat').onclick = () => Panel.action('deck-window');
  $('#deckStarter').onclick = () => {
    // A ready-made page from what OBS reports + the LaboHub essentials.
    const obs = Panel.state.obs || {};
    const mk = (label, icon, color, actions) => ({ id: newId(), label, icon, color, fg: ['#ffc93c', '#2fd4a3'].includes(color) ? '#160f1c' : '#ffffff', hotkey: '', actions });
    const btns = (obs.scenes || []).slice(0, 5).map((sc) => mk(sc.slice(0, 30), '🎬', '#3d8bff', [{ type: 'obs.scene', scene: sc }]));
    const mic = (obs.inputs || []).find((x) => /mic|micro|aux/i.test(x));
    if (mic) btns.push(mk(t('Mic'), '🎙', '#e03b3b', [{ type: 'obs.mute', input: mic }]));
    btns.push(mk(t('Live'), '🔴', '#e03b3b', [{ type: 'obs.stream', mode: 'toggle' }]), mk(t('Clip'), '🎞', '#a970ff', [{ type: 'app.marker', note: '' }]),
      mk(t('Puppets'), '🪆', '#ff7a45', [{ type: 'app.overlay' }]), mk(t('Chat sound'), '🔇', '#2a2236', [{ type: 'app.muteChat' }]),
      mk('La savane', '🍌', '#ffc93c', [{ type: 'app.savane' }]), mk(t('Hello chat'), '👋', '#2fd4a3', [{ type: 'twitch.say', text: t('Hello chat! 👋') }]));
    if (deck.pages.length >= 10) { toast(t('10 pages max')); return; }
    deck.pages.push({ name: t('Starter'), buttons: btns.slice(0, deck.cols * deck.rows) });
    view.page = deck.pages.length - 1;
    changed(true);
    toast(t('Starter page added'));
  };

  // ---------- OBS connection & health ----------
  $('#obsPwSave').onclick = async () => { await Panel.run('obs-password', { password: $('#obsPw').value }, 'Password saved'); $('#obsPw').value = ''; };
  $('#obsRetry').onclick = () => Panel.run('obs-reconnect');
  const OBS_STATUS = { off: 'Off', connecting: 'Connecting…', connected: 'Connected', error: 'Not connected', auth: 'Wrong password' };
  function renderObs(s) {
    const o = s.obs || { status: 'off' };
    $$('.obs-status').forEach((el) => { el.textContent = t(OBS_STATUS[o.status] || o.status) + (o.detail ? ' — ' + t(o.detail) : ''); el.dataset.st = o.status; });
    $('#obsPwState').textContent = o.hasPassword ? t('A password is saved (encrypted).') : t('No password saved.');
    const st = o.stats;
    const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
    $('#obsHealth').innerHTML = o.status !== 'connected' || !st ? `<p class="muted">${escapeHtml(t('Connect OBS to see the stream health.'))}</p>` : [
      [t('Live'), o.streaming ? '🔴 ' + t('on air') + (st.duration ? ' · ' + st.duration.split('.')[0] : '') : '—', o.streaming ? 'good' : ''],
      [t('Recording'), o.recording ? '⏺ ' + t('on') : '—', ''],
      ['FPS', st.fps, st.fps >= 55 ? 'good' : st.fps >= 28 ? 'warn' : 'bad'],
      ['CPU (OBS)', st.cpu + ' %', st.cpu < 50 ? 'good' : st.cpu < 80 ? 'warn' : 'bad'],
      [t('Frames dropped (network)'), pct(st.outputSkipped, st.outputTotal) + ' %', pct(st.outputSkipped, st.outputTotal) < 1 ? 'good' : pct(st.outputSkipped, st.outputTotal) < 5 ? 'warn' : 'bad'],
      [t('Frames lagged (render)'), pct(st.renderSkipped, st.renderTotal) + ' %', pct(st.renderSkipped, st.renderTotal) < 1 ? 'good' : 'warn'],
      [t('Network congestion'), st.congestion + ' %', st.congestion < 10 ? 'good' : st.congestion < 40 ? 'warn' : 'bad'],
      [t('Current scene'), o.current || '—', ''],
    ].map(([k, v, c]) => `<div class="hl ${c}"><span>${escapeHtml(k)}</span><b>${escapeHtml(String(v))}</b></div>`).join('');
  }

  Panel.onState((s, langChanged) => {
    if (!s.settings) return;
    if (!saveTimer && (!deck || JSON.stringify(deck) !== JSON.stringify(s.settings.deck))) { deck = JSON.parse(JSON.stringify(s.settings.deck)); renderInsp(); }
    $('#deckCols').value = deck.cols; $('#deckRows').value = deck.rows;
    $('#deckOnTop').checked = deck.onTop;
    view.setState(Object.assign({}, s, { settings: Object.assign({}, s.settings, { deck }) }));
    if (langChanged) { view.render(true); renderInsp(); }
    renderObs(s);
  });
  $('#deckOnTop').onchange = (e) => { deck.onTop = e.target.checked; changed(false); };
})();
