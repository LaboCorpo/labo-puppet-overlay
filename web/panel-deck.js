/*
 * BabaDeck page in the panel: the dock (pages, grid, starter page, floating deck, shortcut strip, OBS) and the deck.
 * Click a button = run it; right-click (or its ✏) = edit it in the inspector; drag it onto another slot = swap.
 * A button = label + emoji + colours + optional global shortcut + a list of actions run in order.
 */
(function () {
  'use strict';
  const { $, t, escapeHtml, toast } = Panel;
  const TYPES = [
    ['obs.scene', '🎬', 'OBS: switch scene'], ['obs.source', '👁', 'OBS: show / hide a source'], ['obs.mute', '🎙', 'OBS: mute / unmute'],
    ['obs.stream', '🔴', 'OBS: start / stop the stream'], ['obs.record', '⏺', 'OBS: start / stop recording'], ['obs.replay', '💾', 'OBS: save the replay'],
    ['app.marker', '⏱', 'Timestamp (+ clip)'], ['twitch.clip', '🎞', 'Twitch clip (link copied)'], ['twitch.say', '💬', 'Send a chat message'], ['twitch.title', '✏', 'Change the stream title'],
    ['app.alert', '🔔', 'Play an alert sound'], ['app.overlay', '🪆', 'Show / hide the puppets'], ['app.muteChat', '🔇', 'Mute / unmute chat sound'], ['app.fx', '✨', 'Replay entrances'],
    ['lab.counter', '🔢', 'Game counter + / −'], ['lab.giveaway', '🎉', 'Giveaway: open / close / draw'], ['lab.poll', '📊', 'End the chat poll'],
    ['lab.sound', '🔊', 'Play a sound command'], ['lab.profile', '✏', 'Apply a title & category preset'], ['lab.ad', '⏰', 'Snooze the next ad'],
    ['url', '🔗', 'Open a link'], ['delay', '⏳', 'Wait'],
  ];
  // Counter / sound / preset actions start on the first one, as their selects show.
  function labDefaults(ty) {
    const l = Panel.state.settings.lab;
    if (ty === 'lab.counter') return { name: (l.counters[0] || {}).id || '', delta: '1' };
    if (ty === 'lab.sound') return { name: (l.sounds.list[0] || {}).name || '' };
    if (ty === 'lab.profile') return { name: (l.profiles[0] || {}).name || '' };
    if (ty === 'lab.giveaway') return { op: 'draw' };
    return {};
  }
  const typeInfo = (ty) => TYPES.find((x) => x[0] === ty) || [ty, '?', ty];
  const EMOJIS = ['🎬', '🎮', '💬', '🎙', '🔇', '🔴', '⏺', '⏱', '🎞', '🔔', '💀', '🏆', '🪆', '✨', '🚀', '🔥', '💜', '⭐', '😂', '🤝', '☕', '🍕', '🎵', '👋', '🛑', '🍌'];
  const COLORS = ['#2a2236', '#a970ff', '#ff4fa3', '#ff7a45', '#ffc93c', '#2fd4a3', '#3d8bff', '#e03b3b', '#111111', '#f4f1ea'];
  let deck = null, sel = -1, saveTimer = 0;

  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { saveTimer = 0; Panel.save('deck', deck); }, 300); }
  const page = () => deck.pages[view.page] || deck.pages[0];
  const button = () => (sel >= 0 ? page().buttons[sel] : null);
  const newId = () => 'b' + Math.random().toString(36).slice(2, 9).replace(/[^a-z0-9]/g, 'x');
  function edit(i) { sel = i; view.select(i); renderInsp(); setTimeout(() => $('#deckInsp').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30); }
  function closeEdit() { sel = -1; view.select(-1); renderInsp(); }

  const view = DeckView($('#deckView'), {
    editable: true,
    pageTools: '',
    onPage: () => closeEdit(),
    onClick: async (pg, i, el) => {
      const b = page().buttons[i];
      if (!b) { page().buttons[i] = newButton(); changed(false); edit(i); return; }
      el.classList.add('pressed'); setTimeout(() => el.classList.remove('pressed'), 250);
      await Panel.run('deck-press', { id: b.id });
    },
    onContext: (pg, i) => { if (!page().buttons[i]) { page().buttons[i] = newButton(); changed(false); } edit(i); },
    onSwap: (pg, a, b) => {
      const btns = page().buttons;
      while (btns.length <= Math.max(a, b)) btns.push(null);
      [btns[a], btns[b]] = [btns[b], btns[a]];
      if (sel === a) sel = b; else if (sel === b) sel = a;
      changed(true);
    },
  });
  const newButton = () => ({ id: newId(), label: t('New'), icon: '⭐', color: '#a970ff', fg: '#ffffff', hotkey: '', actions: [] });

  // ---------- Dock ----------
  let dockKey = '';
  function renderDock(s) {
    const o = s.obs || { status: 'off' };
    const hud = deck.hud || {};
    const k = JSON.stringify([I18N.lang, deck.cols, deck.rows, deck.onTop, hud.enabled, o.status, deck.pages.length]);
    if (k === dockKey) return;
    dockKey = k;
    const item = (id, icon, label, extra) => `<button class="dock-it${extra && extra.on ? ' on' : ''}${extra && extra.cls ? ' ' + extra.cls : ''}" data-dock="${id}" title="${escapeHtml((extra && extra.title) || label)}"><span class="dock-ic">${icon}</span><span class="dock-lb">${escapeHtml(label)}</span></button>`;
    $('#deckDock').innerHTML = `<div class="dock">
      ${item('addPage', '➕', t('Page'), { title: t('Add a page') })}${item('renamePage', '✏️', t('Rename'), { title: t('Rename the page') })}${item('delPage', '🗑️', t('Delete'), { title: t('Delete the page'), cls: deck.pages.length < 2 ? 'off' : '' })}
      <span class="dock-sep"></span>
      <span class="dock-grid" title="${escapeHtml(t('Grid size'))}"><span class="dock-ic">▦</span><select id="deckCols">${[3, 4, 5, 6, 7, 8].map((n) => `<option${n === deck.cols ? ' selected' : ''}>${n}</option>`).join('')}</select>×<select id="deckRows">${[1, 2, 3, 4, 5, 6].map((n) => `<option${n === deck.rows ? ' selected' : ''}>${n}</option>`).join('')}</select></span>
      ${item('starter', '✨', t('Starter'), { title: t('Starter page: buttons made from your OBS scenes') })}
      <span class="dock-sep"></span>
      ${item('float', '🗔', t('Floating'), { title: t('Open the floating deck (clickable, on top of your game)') })}${item('onTop', '📌', t('On top'), { on: deck.onTop, title: t('Floating deck always on top') })}
      ${item('hud', '🏷️', t('Strip'), { on: hud.enabled, title: t('Shortcut strip on the screen (information only)') })}${item('keys', '⌨️', t('Shortcuts'), { title: t('Shortcuts and recommended keys') })}
      <span class="dock-sep"></span>
      ${item('obs', `<span class="obs-dot st-${escapeHtml(o.status)}"></span>`, 'OBS', { title: t('OBS connection') })}
    </div>`;
  }
  $('#deckDock').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dock]');
    if (!b) return;
    const d = b.dataset.dock;
    if (d === 'addPage') { if (deck.pages.length >= 10) { toast(t('10 pages max')); return; } deck.pages.push({ name: t('Page {n}', { n: deck.pages.length + 1 }), buttons: [] }); view.page = deck.pages.length - 1; closeEdit(); changed(false); }
    if (d === 'renamePage') { const n = prompt(t('Page name'), page().name); if (n != null) { page().name = n.slice(0, 30) || page().name; changed(false); } }
    if (d === 'delPage') { if (deck.pages.length < 2) return; if (!confirm(t('Delete the page “{name}” and its buttons?', { name: page().name }))) return; deck.pages.splice(view.page, 1); view.page = 0; closeEdit(); changed(true); }
    if (d === 'starter') starter();
    if (d === 'float') Panel.action('deck-window');
    if (d === 'onTop') { deck.onTop = !deck.onTop; changed(false); }
    if (d === 'hud') { deck.hud = Object.assign({}, deck.hud, { enabled: !(deck.hud && deck.hud.enabled) }); changed(false); toast(t(deck.hud.enabled ? 'Shortcut strip shown: move it in Shortcuts' : 'Shortcut strip hidden')); }
    if (d === 'keys') Panel.showTab('deck-keys');
    if (d === 'obs') Panel.showTab('deck-obs');
  });
  $('#deckDock').addEventListener('change', (e) => {
    if (e.target.id === 'deckCols') { deck.cols = +e.target.value; changed(false); }
    if (e.target.id === 'deckRows') { deck.rows = +e.target.value; changed(false); }
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
      case 'lab.giveaway': return f('op', `${escapeHtml(t('Action'))}<select data-p="op">${[['open', 'Entries open'], ['close', 'Close entries'], ['draw', 'Draw a winner'], ['reset', 'Reset']].map(([v, l]) => `<option value="${v}"${a.op === v ? ' selected' : ''}>${escapeHtml(t(l))}</option>`).join('')}</select>`);
      case 'lab.counter': {
        const cs = (Panel.state.settings.lab.counters || []);
        return f('name', `${escapeHtml(t('Counter'))}<select data-p="name">${cs.map((c) => `<option value="${escapeHtml(c.id)}"${a.name === c.id ? ' selected' : ''}>${escapeHtml(c.name)} (!${escapeHtml(c.cmd)})</option>`).join('') || `<option value="">${escapeHtml(t('Create a counter in Widget Twitch → Game counters first'))}</option>`}</select>`)
          + f('delta', `${escapeHtml(t('Change'))}<select data-p="delta">${['1', '-1', '5', '-5', 'reset'].map((v) => `<option value="${v}"${String(a.delta || '1') === v ? ' selected' : ''}>${v === 'reset' ? escapeHtml(t('Back to 0')) : (v > 0 ? '+' : '') + v}</option>`).join('')}</select>`);
      }
      case 'lab.sound': return f('name', `${escapeHtml(t('Sound'))}<select data-p="name">${(Panel.state.settings.lab.sounds.list || []).map((x) => `<option value="${escapeHtml(x.name)}"${a.name === x.name ? ' selected' : ''}>!${escapeHtml(x.name)}</option>`).join('') || `<option value="">${escapeHtml(t('Add sounds in Baba Bot → Sound commands first'))}</option>`}</select>`);
      case 'lab.profile': return f('name', `${escapeHtml(t('Preset'))}<select data-p="name">${(Panel.state.settings.lab.profiles || []).map((x) => `<option value="${escapeHtml(x.name)}"${a.name === x.name ? ' selected' : ''}>${escapeHtml(x.name)}</option>`).join('') || `<option value="">${escapeHtml(t('Save a preset in Hub Labo → My stream first'))}</option>`}</select>`);
      case 'url': return f('url', `${escapeHtml(t('Link'))}<input data-p="url" placeholder="https://…" value="${escapeHtml(a.url || '')}">`);
      case 'delay': return f('ms', `${escapeHtml(t('Milliseconds'))}<input type="number" data-p="ms" min="0" max="10000" step="100" value="${a.ms || 500}">`);
      default: return '';
    }
  }
  function renderInsp() {
    const box = $('#deckInsp');
    const b = button();
    box.classList.toggle('hidden', sel < 0 || !b);
    if (sel < 0 || !b) return;
    const hkErr = ((Panel.state.app || {}).hotkeyErrors || {})['deck:' + b.id];
    box.innerHTML = `
      <div class="dk-insp-head"><span class="dk-insp-prev" style="--bc:${escapeHtml(b.color)};--fg:${escapeHtml(b.fg)}">${escapeHtml(b.icon)}</span><h3>${escapeHtml(t('Edit the button'))}</h3><span class="grow"></span><button class="small" id="dkDone">✓ ${escapeHtml(t('Done'))}</button></div>
      <div class="dk-insp-grid">
        <label>${escapeHtml(t('Label'))}<input data-b="label" maxlength="30" value="${escapeHtml(b.label)}"></label>
        <label>${escapeHtml(t('Icon (emoji)'))}<input data-b="icon" maxlength="8" value="${escapeHtml(b.icon)}"></label>
        <label>${escapeHtml(t('Shortcut (works in game)'))}<span class="dk-hkline"><input class="keyrec dk-hkin" readonly value="${escapeHtml(Panel.prettyKey(b.hotkey))}" placeholder="${escapeHtml(t('Click, then press keys'))}">${b.hotkey ? `<button class="ghost small" id="dkHkClear" title="${escapeHtml(t('Remove the shortcut'))}">✕</button>` : ''}<button class="ghost small" data-goto="deck-keys" title="${escapeHtml(t('Recommended keys'))}">💡</button></span><span class="err">${escapeHtml(hkErr ? t(hkErr) : '')}</span></label>
        <div class="dk-emojis">${EMOJIS.map((e) => `<button class="dk-emo" data-emo="${e}">${e}</button>`).join('')}</div>
        <div class="dk-colors">${COLORS.map((c) => `<button class="dk-col${b.color === c ? ' on' : ''}" data-col="${c}" style="background:${c}"></button>`).join('')}<input type="color" data-b="color" value="${b.color}" title="${escapeHtml(t('Colour'))}"><input type="color" data-b="fg" value="${b.fg}" title="${escapeHtml(t('Text colour'))}"></div>
      </div>
      <h3>${escapeHtml(t('Actions (run in order)'))}</h3>
      <div class="dk-actions">${b.actions.map((a, ai) => `<div class="dk-act" data-ai="${ai}"><span class="dk-act-t">${typeInfo(a.type)[1]} ${escapeHtml(t(typeInfo(a.type)[2]))}</span>${params(a, ai)}
        <span class="dk-act-tools"><button class="ghost small" data-act="up" title="↑">↑</button><button class="ghost small" data-act="down" title="↓">↓</button><button class="ghost small danger-text" data-act="del" title="${escapeHtml(t('Delete'))}">✕</button></span></div>`).join('') || `<p class="muted">${escapeHtml(t('No action yet: add one below.'))}</p>`}</div>
      <div class="btns"><select id="dkAddType">${TYPES.map(([ty, ic, name]) => `<option value="${ty}">${ic} ${escapeHtml(t(name))}</option>`).join('')}</select><button class="small" id="dkAdd">＋ ${escapeHtml(t('Add the action'))}</button>
        <span class="grow"></span><button class="ghost small" id="dkTest">▶ ${escapeHtml(t('Try'))}</button><button class="ghost small danger-text" id="dkDel">${escapeHtml(t('Delete the button'))}</button></div>`;
    box.querySelectorAll('datalist[data-for]').forEach(async (dl) => {
      if (!dl.dataset.for) return;
      const r = await Panel.action('obs-sources', { scene: dl.dataset.for });
      if (r && r.sources) dl.innerHTML = r.sources.map((x) => `<option value="${escapeHtml(x.name)}">`).join('');
    });
  }
  function changed(full) { save(); dockKey = ''; renderDock(Panel.state); view.setState({ settings: Object.assign({}, Panel.state.settings, { deck }) }); view.render(true); if (full) renderInsp(); }

  $('#deckInsp').addEventListener('click', (e) => {
    const b = button();
    if (e.target.closest('#dkDone')) { closeEdit(); return; }
    if (!b) return;
    if (e.target.closest('#dkHkClear')) { b.hotkey = ''; changed(true); return; }
    const emo = e.target.closest('[data-emo]'); if (emo) { b.icon = emo.dataset.emo; changed(true); return; }
    const col = e.target.closest('[data-col]'); if (col) { b.color = col.dataset.col; b.fg = ['#ffc93c', '#2fd4a3', '#f4f1ea'].includes(b.color) ? '#160f1c' : '#ffffff'; changed(true); return; }
    if (e.target.id === 'dkAdd') { const ty = $('#dkAddType').value; b.actions.push(Object.assign({ type: ty, mode: 'toggle', ms: 500, key: 'follow' }, labDefaults(ty))); if (b.label === t('New')) { b.label = t(typeInfo(ty)[2]).replace(/^OBS: /, '').slice(0, 30); b.icon = typeInfo(ty)[1]; } changed(true); return; }
    if (e.target.id === 'dkTest') { Panel.run('deck-press', { id: b.id }); return; }
    if (e.target.id === 'dkDel') { if (!confirm(t('Delete this button?'))) return; page().buttons[sel] = null; closeEdit(); changed(false); return; }
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
    if (el.dataset.b) { b[el.dataset.b] = el.value; changed(el.dataset.b === 'color' || el.dataset.b === 'fg'); return; }
    if (el.dataset.p) { const a = b.actions[+el.closest('.dk-act').dataset.ai]; a[el.dataset.p] = el.dataset.p === 'ms' ? +el.value : el.value; changed(el.dataset.p === 'scene'); }
  });
  $('#deckInsp').addEventListener('input', (e) => { const b = button(); if (b && (e.target.dataset.b === 'label' || e.target.dataset.b === 'icon')) { b[e.target.dataset.b] = e.target.value; changed(false); } });
  // Shortcut: press the combination (Panel.keyFromEvent: AZERTY-safe, up to three modifiers).
  $('#deckInsp').addEventListener('keydown', (e) => {
    if (!e.target.classList.contains('dk-hkin')) return;
    e.preventDefault();
    const b = button(); if (!b) return;
    if (e.key === 'Escape') { e.target.blur(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { b.hotkey = ''; changed(true); return; }
    const r = Panel.keyFromEvent(e);
    if (!r) return;
    if (r.error) { toast(t(r.error)); return; }
    const owner = Panel.shortcutOwner && Panel.shortcutOwner(r.acc, 'deck:' + b.id);
    if (owner) { toast(t('Already used by: {what}', { what: owner })); return; }
    b.hotkey = r.acc;
    changed(true);
  });
  $('#deckInsp').addEventListener('focusin', (e) => { if (e.target.classList.contains('dk-hkin')) e.target.placeholder = t('Press the keys…'); });
  // Esc closes the inspector (outside a field).
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sel >= 0 && Panel.tab === 'deck' && !e.target.closest('input, select, textarea')) closeEdit(); });

  // A ready-made page from what OBS reports + the LaboHub essentials.
  function starter() {
    const obs = Panel.state.obs || {};
    const mk = (label, icon, color, actions) => ({ id: newId(), label, icon, color, fg: ['#ffc93c', '#2fd4a3'].includes(color) ? '#160f1c' : '#ffffff', hotkey: '', actions });
    const btns = (obs.scenes || []).slice(0, 5).map((sc) => mk(sc.slice(0, 30), '🎬', '#3d8bff', [{ type: 'obs.scene', scene: sc }]));
    const mic = (obs.inputs || []).find((x) => /mic|micro|aux/i.test(x));
    if (mic) btns.push(mk(t('Mic'), '🎙', '#e03b3b', [{ type: 'obs.mute', input: mic }]));
    btns.push(mk(t('Live'), '🔴', '#e03b3b', [{ type: 'obs.stream', mode: 'toggle' }]), mk(t('Clip'), '🎞', '#a970ff', [{ type: 'app.marker', note: '' }]),
      mk(t('Puppets'), '🪆', '#ff7a45', [{ type: 'app.overlay' }]), mk(t('Chat sound'), '🔇', '#2a2236', [{ type: 'app.muteChat' }]),
      mk(t('Hello chat'), '👋', '#2fd4a3', [{ type: 'twitch.say', text: t('Hello chat! 👋') }]));
    for (const c of Panel.state.settings.lab.counters.slice(0, 2)) btns.push(mk(c.name.slice(0, 26) + ' +1', '💀', '#ff4f5e', [{ type: 'lab.counter', name: c.id, delta: '1' }]));
    if (deck.pages.length >= 10) { toast(t('10 pages max')); return; }
    deck.pages.push({ name: t('Starter'), buttons: btns.slice(0, deck.cols * deck.rows) });
    view.page = deck.pages.length - 1;
    closeEdit();
    changed(true);
    toast(obs.status === 'connected' ? t('Starter page added') : t('Starter page added — connect OBS to also get your scenes'));
  }

  Panel.onState((s, langChanged) => {
    if (!s.settings) return;
    if (!saveTimer && (!deck || JSON.stringify(deck) !== JSON.stringify(s.settings.deck))) { deck = JSON.parse(JSON.stringify(s.settings.deck)); dockKey = ''; if (!$('#deckInsp').contains(document.activeElement)) renderInsp(); }
    renderDock(s);
    view.setState(Object.assign({}, s, { settings: Object.assign({}, s.settings, { deck }) }));
    if (langChanged) { dockKey = ''; renderDock(s); view.render(true); renderInsp(); }
  });
})();
