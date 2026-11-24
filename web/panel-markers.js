/*
 * Panel tab "Timestamps": moments noted during your stream (hotkey, button or "!clip" in chat),
 * sorted by day then by stream, with a link to that second of the VOD to make clips without rewatching it.
 */
(function () {
  'use strict';
  const { $, t, escapeHtml, toast } = Panel;
  const list = $('#markList');
  let lastKey = '', armedDay = null;
  const loc = () => (I18N.lang === 'fr' ? 'fr-FR' : 'en-GB');
  const hms = (sec) => { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
  const vodT = (sec) => { sec = Math.max(0, Math.floor(sec)); return `${Math.floor(sec / 3600)}h${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}m${String(sec % 60).padStart(2, '0')}s`; };
  const linkOf = (m) => (m.videoId ? `https://www.twitch.tv/videos/${m.videoId}?t=${vodT(m.offset - (Panel.state.settings.markers.leadSeconds || 0))}` : null);
  const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const dayLabel = (key) => { const [y, mo, d] = key.split('-').map(Number); const s = new Date(y, mo - 1, d).toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); };
  const clock = (ts) => new Date(ts).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' });
  const SOURCE = { hotkey: 'shortcut', button: 'button', chat: 'chat' };
  const pretty = (acc) => String(acc || '').replace('CommandOrControl', 'Ctrl');
  const since = (iso) => { const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return min < 60 ? t('{n} min', { n: min }) : t('{h} h {m} min', { h: Math.floor(min / 60), m: min % 60 }); };
  const copy = (text, ok) => navigator.clipboard.writeText(text).then(() => toast(t(ok)), () => toast(t('Could not copy')));

  function render(force) {
    const s = Panel.state;
    const q = $('#markSearch').value.trim().toLowerCase();
    const key = I18N.lang + JSON.stringify([s.markers, s.settings.markers.leadSeconds, s.settings.app.hotkeys.marker, q, armedDay]);
    if (!force && (key === lastKey || list.contains(document.activeElement))) return;
    lastKey = key;
    const items = (s.markers || []).filter((m) => !q || (m.note || '').toLowerCase().includes(q) || (m.title || '').toLowerCase().includes(q));
    if (!items.length) {
      list.innerHTML = `<div class="empty">${escapeHtml(q ? t('No timestamp matches.') : t('No timestamp yet. While live, press {key} or the button above.', { key: pretty(s.settings.app.hotkeys.marker) || '—' }))}</div>`;
      return;
    }
    // Days newest first; inside a day, in stream order.
    const days = new Map();
    for (const m of items) { const k = dayKey(m.at); if (!days.has(k)) days.set(k, []); days.get(k).push(m); }
    const html = [];
    for (const k of [...days.keys()].sort().reverse()) {
      const day = days.get(k).sort((a, b) => a.at - b.at);
      html.push(`<div class="day" data-day="${k}"><div class="day-head"><h2>${escapeHtml(dayLabel(k))} <span class="tag">${day.length}</span></h2>
        <div class="btns" style="margin:0"><button class="ghost small" data-mk="copy-day">${escapeHtml(t('Copy the list'))}</button>
        <button class="${armedDay === k ? 'danger-solid' : 'danger'} small" data-mk="del-day">${escapeHtml(t(armedDay === k ? 'Confirm deletion?' : 'Delete the day'))}</button></div></div>`);
      let stream = null;
      for (const m of day) {
        if (m.streamId !== stream) {
          stream = m.streamId;
          html.push(`<div class="stream-head">📺 ${escapeHtml(m.title || 'Live')}${m.game ? ' · ' + escapeHtml(m.game) : ''} — ${escapeHtml(t('stream started at {time}', { time: clock(m.startedAt) }))}</div>`);
        }
        const link = linkOf(m);
        const via = t('via {source}', { source: t(SOURCE[m.source] || m.source) }) + (m.by ? ` (${m.by})` : '') + (m.twitchMarker ? ' · ' + t('Twitch marker ✓') : '');
        html.push(`<div class="mk${m.done ? ' done' : ''}" data-id="${escapeHtml(m.id)}">
          <span class="t" title="${escapeHtml(t('Moment in the stream'))}">${hms(m.offset)}</span>
          <span class="clock">${clock(m.at)}</span>
          <div><input class="note" value="${escapeHtml(m.note)}" maxlength="140" placeholder="${escapeHtml(t('Add a note…'))}"><div class="by">${escapeHtml(via)}</div></div>
          <div class="btns">
            ${m.clipId ? `<button class="small clipbtn" data-mk="clip">🎬 ${escapeHtml(t('Open the clip'))}</button>` : ''}
            ${link ? `<button class="${m.clipId ? 'ghost ' : ''}small" data-mk="open">▶ ${escapeHtml(t('VOD at this moment'))}</button><button class="ghost small" data-mk="copy">${escapeHtml(t('Copy link'))}</button>` : `<span class="muted" style="font-size:12px">${escapeHtml(t('VOD not available yet'))}</span>`}
            <button class="ghost small" data-mk="done">${escapeHtml(t(m.done ? '✓ Clip done' : 'Clip done?'))}</button>
            <button class="danger" data-mk="del" title="${escapeHtml(t('Delete'))}">✕</button>
          </div></div>`);
      }
      html.push('</div>');
    }
    list.innerHTML = html.join('');
  }

  function renderHelp() {
    const s = Panel.state, st = s.stats || {}, acc = s.twitchAccount || {}, mk = s.settings.markers;
    const live = st.live ? `<span class="err">● ${escapeHtml(t('LIVE'))}</span> ${escapeHtml(t('for {d}', { d: since(st.live.startedAt) }))} — ` : acc.status === 'connected' ? `<span class="muted">● ${escapeHtml(t('offline'))}</span> — ` : '';
    const parts = [t('Shortcut: {key} (works in game)', { key: pretty(s.settings.app.hotkeys.marker) || t('none') })];
    if (mk.chatCommand) parts.push(t('chat command !{name} [note] (you and your mods)', { name: mk.commandName }));
    parts.push(t('the VOD link starts {n} s earlier', { n: mk.leadSeconds }));
    $('#markHelp').innerHTML = live + escapeHtml(parts.join(' · '));
  }

  $('#markNow').onclick = async () => { const r = await Panel.run('marker-add', { note: $('#markNote').value }, 'Timestamp added'); if (r) $('#markNote').value = ''; };
  $('#markNote').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#markNow').click(); });
  $('#markSearch').addEventListener('input', () => render(true));
  $('#markRefresh').onclick = () => Panel.run('markers-refresh', null, 'VODs checked');
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mk]');
    if (!b) return;
    const act = b.dataset.mk, day = b.closest('[data-day]').dataset.day;
    const all = Panel.state.markers || [];
    if (act === 'copy-day') {
      const items = all.filter((m) => dayKey(m.at) === day).sort((x, y) => x.at - y.at);
      copy(`${dayLabel(day)}\n` + items.map((m) => `${hms(m.offset)}${m.note ? ' — ' + m.note : ''}${linkOf(m) ? ' — ' + linkOf(m) : ''}`).join('\n'), 'List copied');
      return;
    }
    if (act === 'del-day') {
      // Two clicks: a whole day of notes is gone for good.
      if (armedDay !== day) { armedDay = day; render(true); setTimeout(() => { if (armedDay === day) { armedDay = null; render(true); } }, 4000); return; }
      armedDay = null;
      Panel.run('marker-delete-day', { day }, 'Day deleted');
      return;
    }
    const id = b.closest('[data-id]').dataset.id, m = all.find((x) => x.id === id);
    if (!m) return;
    if (act === 'open') Panel.action('open-url', { url: linkOf(m) });
    if (act === 'clip' && /^[\w-]{3,100}$/.test(m.clipId || '')) Panel.action('open-url', { url: 'https://clips.twitch.tv/' + m.clipId });
    if (act === 'copy') copy(linkOf(m), 'Link copied');
    if (act === 'done') Panel.run('marker-update', { id, done: !m.done });
    if (act === 'del') Panel.run('marker-delete', { id });
  });
  list.addEventListener('change', (e) => { if (e.target.classList.contains('note')) Panel.run('marker-update', { id: e.target.closest('[data-id]').dataset.id, note: e.target.value }); });
  list.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('note')) e.target.blur(); });

  Panel.onState((s, langChanged) => { render(langChanged); renderHelp(); });
})();
