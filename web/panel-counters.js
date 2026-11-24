/*
 * Game counters (Widget Twitch → Game counters): deaths, wins, losses… settings.lab.counters.
 * Each counter: name, chat command (!cmd shows it, !cmd+ / !cmd- change it), a shortcut to add one and one to remove one
 * (global, work in game), its OBS link (widget.html?w=counter&id=…, &vs=… shows two side by side).
 */
(function () {
  'use strict';
  const { $, t, escapeHtml: esc, toast } = Panel;
  const ORIGIN = location.origin.replace('127.0.0.1', 'localhost');
  const box = $('#lcCounters');
  const card = $('#weCounters');
  let key = '';
  const vsPick = {}; // counter id -> id shown next to it in the copied link (not saved)
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const rid = () => 'c' + Math.random().toString(36).slice(2, 9).replace(/[^a-z0-9]/g, 'x');
  const counters = () => Panel.state.settings.lab.counters;
  function saveCounters(fn) { const l = clone(counters()); fn(l); Panel.state.settings.lab.counters = l; Panel.save('lab.counters', l); key = ''; render(); }
  const linkOf = (c) => `${ORIGIN}/widget.html?w=counter&id=${c.id}${vsPick[c.id] ? '&vs=' + vsPick[c.id] : ''}`;

  function render() {
    const st = Panel.state;
    if (!st.settings) return;
    const cs = counters();
    const errs = (st.app && st.app.hotkeyErrors) || {};
    const k = JSON.stringify([cs, errs, vsPick, I18N.lang]);
    if (k === key || box.contains(document.activeElement)) return;
    key = k;
    box.innerHTML = cs.length ? cs.map((c, i) => {
      const err = errs['counter+:' + c.id] || errs['counter-:' + c.id];
      return `<div class="ct-row" data-i="${i}" data-id="${esc(c.id)}">
        <div class="ct-main">
          <input class="lc-cname" data-f="name" maxlength="30" value="${esc(c.name)}" title="${esc(t('Name shown on stream'))}">
          <span class="lc-bang">!</span><input class="lc-name" data-f="cmd" maxlength="25" value="${esc(c.cmd)}" title="${esc(t('Chat command'))}">
          <span class="ct-val"><button class="ghost small" data-d="-1" title="−1">−</button><b>${c.value}</b><button class="ghost small" data-d="1" title="+1">＋</button><button class="ghost small" data-d="reset" title="${esc(t('Back to 0'))}">0</button></span>
          <label class="check inline" title="${esc(t('Only moderators can change it from the chat'))}"><input type="checkbox" data-f="modOnly"${c.modOnly ? ' checked' : ''}> ${esc(t('mods'))}</label>
          <button class="ghost small danger-text" data-del title="${esc(t('Delete'))}">✕</button>
        </div>
        <div class="ct-keys">
          <label class="inline">＋1 <input class="keyrec" data-k="plusKey" readonly value="${esc(Panel.prettyKey(c.plusKey))}" placeholder="${esc(t('Shortcut…'))}"></label>
          <label class="inline">−1 <input class="keyrec" data-k="minusKey" readonly value="${esc(Panel.prettyKey(c.minusKey))}" placeholder="${esc(t('Shortcut…'))}"></label>
          <label class="inline">${esc(t('Next to'))} <select data-vs><option value="">—</option>${cs.filter((x) => x.id !== c.id).map((x) => `<option value="${esc(x.id)}"${vsPick[c.id] === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
          <button class="small" data-copy="${esc(linkOf(c))}">📺 ${esc(t('Copy the OBS link'))}</button>
          ${err ? `<span class="err">${esc(t(err))}</span>` : ''}
        </div></div>`;
    }).join('') : `<p class="muted">${esc(t('No counter yet.'))}</p>`;
  }

  box.addEventListener('click', (e) => {
    const row = e.target.closest('[data-i]');
    if (!row) return;
    const id = row.dataset.id;
    const d = e.target.closest('[data-d]');
    if (d) { Panel.run('lab-counter', { id, delta: d.dataset.d }); return; }
    if (e.target.closest('[data-del]')) { if (confirm(t('Delete this counter?'))) saveCounters((l) => l.splice(+row.dataset.i, 1)); return; }
    const c = e.target.closest('[data-copy]');
    if (c) navigator.clipboard.writeText(c.dataset.copy).then(() => toast(t('Copied: add it as a Browser Source in OBS')));
  });
  box.addEventListener('change', (e) => {
    const row = e.target.closest('[data-i]');
    if (!row) return;
    if (e.target.matches('[data-vs]')) { vsPick[row.dataset.id] = e.target.value; key = ''; render(); return; }
    const f = e.target.dataset.f;
    if (!f) return;
    saveCounters((l) => { l[+row.dataset.i][f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; });
  });
  // Shortcut recorders: press the combination (Backspace clears it).
  box.addEventListener('keydown', (e) => {
    const el = e.target.closest('.keyrec');
    if (!el) return;
    e.preventDefault();
    const i = +el.closest('[data-i]').dataset.i, k = el.dataset.k;
    if (e.key === 'Escape') { el.blur(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { el.blur(); saveCounters((l) => { l[i][k] = ''; }); return; }
    const r = Panel.keyFromEvent(e);
    if (!r) return;
    if (r.error) { toast(t(r.error)); return; }
    const taken = Panel.shortcutOwner && Panel.shortcutOwner(r.acc, 'counter:' + counters()[i].id + ':' + k);
    if (taken) { toast(t('Already used by: {what}', { what: taken })); return; }
    el.blur();
    saveCounters((l) => { l[i][k] = r.acc; });
  });
  box.addEventListener('focusin', (e) => { if (e.target.classList.contains('keyrec')) e.target.placeholder = t('Press the keys…'); });
  box.addEventListener('focusout', (e) => { if (e.target.classList.contains('keyrec')) { e.target.placeholder = t('Shortcut…'); key = ''; setTimeout(render, 0); } });

  // Ready-made counters, with shortcuts not used yet.
  const free = (acc) => !(Panel.shortcutOwner && Panel.shortcutOwner(acc));
  function make(name, cmd, n) {
    const l = counters();
    let c = cmd, k = 2;
    while (l.some((x) => x.cmd === c)) c = cmd + k++;
    const plus = `Alt+${n}`, minus = `Alt+Shift+${n}`;
    return { id: rid(), name, cmd: c, value: 0, modOnly: true, plusKey: free(plus) ? plus : '', minusKey: free(minus) ? minus : '' };
  }
  const fr = () => I18N.lang === 'fr';
  $('#lcAddCounter').onclick = () => saveCounters((l) => { if (l.length < 12) l.push(make(t('Counter'), 'count', l.length + 1)); else toast(t('12 counters max')); });
  document.addEventListener('click', (e) => {
    const p = e.target.closest('[data-ctpreset]');
    if (!p) return;
    saveCounters((l) => {
      const add = (c) => { if (l.length < 12) l.push(c); };
      if (p.dataset.ctpreset === 'deaths') add(make(t('Deaths'), fr() ? 'morts' : 'deaths', 1));
      else { const w = make(t('Wins'), 'win', 2); add(w); const lo = make(t('Losses'), fr() ? 'lose' : 'loss', 3); add(lo); vsPick[w.id] = lo.id; }
    });
    toast(t('Counter added: give it a key and copy its OBS link'));
  });

  Panel.onTab((name) => { card.classList.toggle('hidden', name !== 'w-gameCounter'); if (name === 'w-gameCounter') { key = ''; render(); } });
  Panel.onState(() => { if (Panel.tab === 'w-gameCounter') render(); });
})();
