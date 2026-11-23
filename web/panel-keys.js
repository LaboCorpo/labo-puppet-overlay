/*
 * BabaDeck → Shortcuts: the on-screen shortcut strip (deck-hud.html), every shortcut of the app in one list
 * (BabaDeck buttons, game counters, app shortcuts), the recommended keys for QWERTY / AZERTY keyboards,
 * and channel points → BabaDeck. Panel.shortcutOwner(acc, self) tells who already uses a combination.
 */
(function () {
  'use strict';
  const { $, $$, t, escapeHtml: esc, toast } = Panel;
  const APP_KEYS = [['toggleOverlay', 'Show / hide overlay'], ['placement', 'Move puppets (placement mode)'], ['muteChat', 'Mute / unmute chat sound'], ['marker', 'Stream timestamp']];
  // Same key whatever the spelling: "CommandOrControl+Alt+1" = "Alt+Ctrl+1".
  const norm = (acc) => String(acc || '').split('+').map((k) => (k === 'CommandOrControl' || k === 'Control' || k === 'CmdOrCtrl' ? 'Ctrl' : k.length === 1 ? k.toUpperCase() : k)).sort().join('+');

  // Every shortcut in use: [{ id, acc, what, kind, ... }]
  function all() {
    const s = Panel.state.settings, out = [];
    for (const [k, label] of APP_KEYS) out.push({ id: 'app:' + k, acc: s.app.hotkeys[k], what: t(label), kind: 'app', key: k });
    for (const p of s.deck.pages) for (const b of p.buttons) if (b) out.push({ id: 'deck:' + b.id, acc: b.hotkey, what: `${b.icon || ''} ${b.label || '?'}`.trim(), page: p.name, kind: 'deck', b });
    for (const c of s.lab.counters) {
      out.push({ id: `counter:${c.id}:plusKey`, acc: c.plusKey, what: `${c.name} +1`, kind: 'counter', c, k: 'plusKey' });
      out.push({ id: `counter:${c.id}:minusKey`, acc: c.minusKey, what: `${c.name} −1`, kind: 'counter', c, k: 'minusKey' });
    }
    return out;
  }
  Panel.shortcutOwner = (acc, self) => {
    if (!acc || !Panel.state.settings) return '';
    const hit = all().find((x) => x.acc && x.id !== self && norm(x.acc) === norm(acc));
    return hit ? hit.what : '';
  };

  // ---------- Strip ----------
  $('#hudPlace').onclick = () => {
    const s = Panel.state.settings;
    if (!s.deck.hud.enabled) { Panel.save('deck.hud.enabled', true); setTimeout(() => Panel.action('deck-hud-place', { on: true }), 600); }
    else Panel.action('deck-hud-place', { on: !Panel.state.app.hudPlacing });
  };

  // ---------- All shortcuts ----------
  let listKey = '';
  function renderList() {
    const st = Panel.state, errs = (st.app && st.app.hotkeyErrors) || {};
    const rows = all();
    const k = JSON.stringify([rows.map((r) => [r.id, r.acc, r.what, r.page]), errs, I18N.lang]);
    const box = $('#keyList');
    if (k === listKey || box.contains(document.activeElement)) return;
    listKey = k;
    const dup = {};
    for (const r of rows) if (r.acc) (dup[norm(r.acc)] = dup[norm(r.acc)] || []).push(r.what);
    const section = (title, list) => (list.length ? `<div class="kl-sub">${esc(title)}</div>` + list.map((r) => {
      const err = r.kind === 'deck' ? errs['deck:' + r.b.id] : r.kind === 'counter' ? errs[(r.k === 'plusKey' ? 'counter+:' : 'counter-:') + r.c.id] : errs[r.key];
      const clash = r.acc && dup[norm(r.acc)].length > 1;
      return `<div class="kl-row" data-id="${esc(r.id)}"><span class="kl-what">${esc(r.what)}${r.page ? ` <span class="muted">· ${esc(r.page)}</span>` : ''}</span>
        <input class="keyrec" readonly value="${esc(Panel.prettyKey(r.acc))}" placeholder="${esc(t('Shortcut…'))}">
        ${r.acc ? `<button class="ghost small" data-clear title="${esc(t('Remove the shortcut'))}">✕</button>` : '<span></span>'}
        <span class="err">${esc(err ? t(err) : clash ? t('Used twice') : '')}</span></div>`;
    }).join('') : '');
    box.innerHTML = section(t('BabaDeck buttons'), rows.filter((r) => r.kind === 'deck'))
      + section(t('Game counters'), rows.filter((r) => r.kind === 'counter'))
      + section(t('LaboHub'), rows.filter((r) => r.kind === 'app'))
      + (rows.some((r) => r.kind === 'deck') ? '' : `<p class="muted">${esc(t('No BabaDeck button yet.'))}</p>`)
      + `<p class="muted">${esc(t('Click a field, then press your combination: up to three modifiers (Ctrl, Alt, Shift) and a key. Backspace removes it.'))}</p>`;
  }
  function setKey(id, acc) {
    const s = Panel.state.settings;
    if (id.startsWith('app:')) { Panel.save('app.hotkeys.' + id.slice(4), acc); return; }
    if (id.startsWith('deck:')) {
      const deck = JSON.parse(JSON.stringify(s.deck));
      for (const p of deck.pages) for (const b of p.buttons) if (b && b.id === id.slice(5)) b.hotkey = acc;
      s.deck = deck; Panel.save('deck', deck); return;
    }
    const [, cid, k] = id.split(':');
    const l = JSON.parse(JSON.stringify(s.lab.counters));
    const c = l.find((x) => x.id === cid); if (c) c[k] = acc;
    s.lab.counters = l; Panel.save('lab.counters', l);
  }
  $('#keyList').addEventListener('keydown', (e) => {
    const el = e.target.closest('.keyrec');
    if (!el) return;
    e.preventDefault();
    const id = el.closest('[data-id]').dataset.id;
    if (e.key === 'Escape') { el.blur(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { el.blur(); setKey(id, ''); return; }
    const r = Panel.keyFromEvent(e);
    if (!r) return;
    if (r.error) { toast(t(r.error)); return; }
    const owner = Panel.shortcutOwner(r.acc, id);
    if (owner) { toast(t('Already used by: {what}', { what: owner })); return; }
    el.value = Panel.prettyKey(r.acc);
    el.blur();
    setKey(id, r.acc);
  });
  $('#keyList').addEventListener('click', (e) => { const b = e.target.closest('[data-clear]'); if (b) setKey(b.closest('[data-id]').dataset.id, ''); });
  $('#keyList').addEventListener('focusin', (e) => { if (e.target.classList.contains('keyrec')) e.target.placeholder = t('Press the keys…'); });
  $('#keyList').addEventListener('focusout', () => { listKey = ''; setTimeout(renderList, 0); });

  // ---------- Recommended keys ----------
  // Picked because games, Windows and the usual overlays (Discord, NVIDIA, Xbox Game Bar) leave them alone.
  const RECS = {
    qwerty: [
      ['Ctrl+Alt+Num 0 … Num 9', 'The safest: the numpad with Ctrl+Alt is almost never used by games. Needs a numpad.', 'good'],
      ['F13 … F24', 'Perfect for the extra buttons of a gaming mouse or keyboard (assign them F13–F24 in its software): no game uses them.', 'good'],
      ['Alt+1 … Alt+9', 'Easy to reach in game (e.g. Alt+1 = one more loss). A few MMOs use Alt+number: check your game.', 'ok'],
      ['Ctrl+Shift+F1 … F12', 'Rarely used. Avoid Ctrl+Shift+F if your game uses F keys a lot.', 'ok'],
      ['Ctrl+Alt+1 … 9', 'Free on a QWERTY keyboard.', 'ok'],
      ['Ctrl+Alt+Num + / Num −', 'Handy pair for a counter: + adds one, − removes one.', 'good'],
    ],
    azerty: [
      ['Ctrl+Alt+Num 0 … Num 9', 'The safest: the numpad with Ctrl+Alt is almost never used by games, and it is not AltGr. Needs a numpad.', 'good'],
      ['F13 … F24', 'Perfect for the extra buttons of a gaming mouse or keyboard (assign them F13–F24 in its software): no game uses them.', 'good'],
      ['Alt+1 … Alt+9', 'The keys & é " \' ( - è _ ç of the top row, without Shift. Easy in game; a few MMOs use them: check your game.', 'ok'],
      ['Ctrl+Shift+F1 … F12', 'Rarely used. Avoid Ctrl+Shift+F if your game uses F keys a lot.', 'ok'],
      ['Ctrl+Alt+Num + / Num −', 'Handy pair for a counter: + adds one, − removes one.', 'good'],
    ],
  };
  const AVOID = {
    qwerty: [['Alt+F4, Alt+Tab, Alt+Enter, Win+…', 'Windows (close, switch, full screen).'], ['Alt+Z, Alt+F1, Alt+F9, Alt+F10', 'NVIDIA overlay (record, replay, screenshot).'], ['Ctrl+Shift+M / O / P', 'LaboHub already uses them (unless you changed them).'], ['Ctrl+Alt+arrows', 'Rotates the screen on some PCs.'], ['Letters alone, Space, Shift', 'Your game needs them.']],
    azerty: [['Ctrl+Alt+0 … 9, Ctrl+Alt+E', 'On AZERTY, Ctrl+Alt = AltGr: they type @ # { [ | ` \\ ^ ~ €. Taking them would stop you typing these characters.'], ['Alt+F4, Alt+Tab, Alt+Entrée, Win+…', 'Windows (close, switch, full screen).'], ['Alt+Z, Alt+F1, Alt+F9, Alt+F10', 'NVIDIA overlay (record, replay, screenshot).'], ['Ctrl+Shift+M / O / P', 'LaboHub already uses them (unless you changed them).'], ['Ctrl+Alt+arrows', 'Rotates the screen on some PCs.']],
  };
  let kb = null, recLang = '';
  function renderRecs() {
    const lay = kb || Panel.kbLayout || 'qwerty';
    const k = lay + I18N.lang;
    if (k === recLang) return;
    recLang = k;
    $$('.kb-pick').forEach((b) => b.classList.toggle('on', b.dataset.kb === lay));
    $('#kbGuess').textContent = Panel.kbLayout === 'azerty' || Panel.kbLayout === 'qwerty' ? t('(your keyboard looks {k})', { k: Panel.kbLayout.toUpperCase() }) : '';
    $('#keyRecs').innerHTML = `<div class="kr-grid">${RECS[lay].map(([keys, why, lvl]) => `<div class="kr ${lvl}"><kbd>${esc(keys)}</kbd><span>${esc(t(why))}</span></div>`).join('')}</div>
      <div class="kl-sub">${esc(t('To avoid'))}</div><div class="kr-grid">${AVOID[lay].map(([keys, why]) => `<div class="kr bad"><kbd>${esc(keys)}</kbd><span>${esc(t(why))}</span></div>`).join('')}</div>
      <p class="muted">${esc(t('Combinations work: e.g. Ctrl+Alt+Shift+K. A shortcut is taken from every other program while LaboHub runs.'))}</p>`;
  }
  $$('.kb-pick').forEach((b) => (b.onclick = () => { kb = b.dataset.kb; recLang = ''; renderRecs(); }));

  // ---------- Channel points → BabaDeck ----------
  const STATUS = { off: 'off', login: 'Log in with Twitch (Widget Twitch tab)', connecting: 'Connecting…', connected: 'Listening to rewards', reconnecting: 'Reconnecting…', error: 'Error' };
  let ptKey = '';
  function buttons(s) {
    const out = [];
    for (const p of s.settings.deck.pages) for (const b of p.buttons) if (b) out.push([b.id, `${b.icon} ${b.label || '?'} (${p.name})`]);
    return out;
  }
  function renderPoints(s) {
    const map = s.settings.lab.points.map;
    const btns = buttons(s);
    const k = JSON.stringify([map, btns, I18N.lang]);
    if (k !== ptKey && !$('#labPoints').contains(document.activeElement)) {
      ptKey = k;
      $('#labPoints').innerHTML = map.map((m, i) => `<div class="lab-map" data-i="${i}"><input data-f="reward" maxlength="45" value="${esc(m.reward)}" placeholder="${esc(t('Reward name'))}">→<select data-f="button">${btns.map(([id, name]) => `<option value="${id}"${id === m.button ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select><button class="ghost small danger-text" data-del>✕</button></div>`).join('')
        + (btns.length ? `<button class="ghost small" id="labAdd">＋ ${esc(t('Add a reward'))}</button>` : `<p class="muted">${esc(t('Create BabaDeck buttons first.'))}</p>`);
    }
    const l = s.lab || {};
    $('#labPointsStatus').textContent = t(STATUS[l.points] || l.points || 'off') + (l.pointsError ? ' — ' + t(l.pointsError) : '') + (l.lastReward ? ' · ' + t('last: {title} by {user}', { title: l.lastReward.title, user: l.lastReward.user }) : '');
  }
  function saveMap(fn) { const map = JSON.parse(JSON.stringify(Panel.state.settings.lab.points.map)); fn(map); Panel.save('lab.points.map', map); }
  $('#labPoints').addEventListener('click', (e) => {
    if (e.target.id === 'labAdd') { const first = buttons(Panel.state)[0]; saveMap((m) => m.push({ reward: t('New reward'), button: first[0] })); ptKey = ''; }
    if (e.target.closest('[data-del]')) { const i = +e.target.closest('.lab-map').dataset.i; saveMap((m) => m.splice(i, 1)); ptKey = ''; }
  });
  $('#labPoints').addEventListener('change', (e) => { const row = e.target.closest('.lab-map'); if (!row) return; const i = +row.dataset.i; saveMap((m) => { m[i][e.target.dataset.f] = e.target.value; }); });

  Panel.onState((s) => {
    if (!s.settings) return;
    $('#hudPlace').textContent = s.app.hudPlacing ? '✓ ' + t('Done moving') : '✥ ' + t('Move the strip…');
    if (Panel.tab !== 'deck-keys') return;
    renderList(); renderRecs(); renderPoints(s);
  });
  Panel.onTab((name) => { if (name === 'deck-keys' && Panel.state.settings) { listKey = ''; recLang = ''; ptKey = ''; renderList(); renderRecs(); renderPoints(Panel.state); } });
})();
