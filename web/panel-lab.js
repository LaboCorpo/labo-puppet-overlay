/*
 * Labo test page: experiments (settings bound with data-key) + the channel points → BabaDeck mapping.
 */
(function () {
  'use strict';
  const { $, t, escapeHtml, toast } = Panel;
  const ORIGIN = location.origin.replace('127.0.0.1', 'localhost');
  const STATUS = { off: 'off', login: 'Log in with Twitch (HUD Twitch tab)', connecting: 'Connecting…', connected: 'Listening to rewards', reconnecting: 'Reconnecting…', error: 'Error' };
  let key = '';
  function buttons(s) {
    const out = [];
    for (const p of s.settings.deck.pages) for (const b of p.buttons) if (b) out.push([b.id, `${b.icon} ${b.label || '?'} (${p.name})`]);
    return out;
  }
  function render(s) {
    const map = s.settings.lab.points.map;
    const btns = buttons(s);
    const k = JSON.stringify([map, btns, I18N.lang]);
    if (k !== key && !$('#labPoints').contains(document.activeElement)) {
      key = k;
      $('#labPoints').innerHTML = map.map((m, i) => `<div class="lab-map" data-i="${i}"><input data-f="reward" maxlength="45" value="${escapeHtml(m.reward)}" placeholder="${escapeHtml(t('Reward name'))}">→<select data-f="button">${btns.map(([id, name]) => `<option value="${id}"${id === m.button ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select><button class="ghost small danger-text" data-del>✕</button></div>`).join('')
        + (btns.length ? `<button class="ghost small" id="labAdd">＋ ${escapeHtml(t('Add a reward'))}</button>` : `<p class="muted">${escapeHtml(t('Create BabaDeck buttons first.'))}</p>`);
    }
    const l = s.lab || {};
    $('#labPointsStatus').textContent = t(STATUS[l.points] || l.points || 'off') + (l.pointsError ? ' — ' + t(l.pointsError) : '') + (l.lastReward ? ' · ' + t('last: {title} by {user}', { title: l.lastReward.title, user: l.lastReward.user }) : '');
    $('#labHype').textContent = s.settings.lab.hype.enabled ? t('Chat speed now: ×{n}', { n: l.hype || 0 }) : '';
    $('#labCountdown').textContent = `${ORIGIN}/countdown.html?min=5&text=${encodeURIComponent(t('Starting soon'))}`;
  }
  function saveMap(fn) { const map = JSON.parse(JSON.stringify(Panel.state.settings.lab.points.map)); fn(map); Panel.save('lab.points.map', map); }
  $('#labPoints').addEventListener('click', (e) => {
    if (e.target.id === 'labAdd') { const first = buttons(Panel.state)[0]; saveMap((m) => m.push({ reward: t('New reward'), button: first[0] })); key = ''; }
    if (e.target.closest('[data-del]')) { const i = +e.target.closest('.lab-map').dataset.i; saveMap((m) => m.splice(i, 1)); key = ''; }
  });
  $('#labPoints').addEventListener('change', (e) => { const row = e.target.closest('.lab-map'); if (!row) return; const i = +row.dataset.i; saveMap((m) => { m[i][e.target.dataset.f] = e.target.value; }); });
  $('#labCountdownCopy').onclick = () => navigator.clipboard.writeText($('#labCountdown').textContent).then(() => toast(t('Copied: add it as a Browser Source in OBS')));
  Panel.onState((s) => { if (s.settings) render(s); });
})();
