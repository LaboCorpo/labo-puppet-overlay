/*
 * Panel niceties: tab logos in the top-left corner, the sliding pill in the side menu,
 * back/forward like File Explorer (right-click, Alt+arrows, mouse side buttons, Backspace)
 * and Ctrl+K to jump to any page.
 */
(function () {
  'use strict';
  const { $, $$, t, escapeHtml } = Panel;

  // ---------- Logos: the brand corner reuses the tab icons (with their animations) ----------
  for (const g of ['hud', 'hub', 'deck', 'bababot']) {
    const sym = document.getElementById('ic-' + g), el = $(`.blogo[data-g="${g}"]`);
    if (sym && el) el.innerHTML = sym.innerHTML;
  }

  // ---------- Sliding pill behind the active side entry ----------
  const ind = $('#sideIndicator');
  function moveIndicator() {
    const a = $('.side .tab.active:not(.hidden)');
    if (!a) { ind.style.opacity = 0; return; }
    ind.style.opacity = 1;
    ind.style.top = a.offsetTop + 'px';
    ind.style.height = a.offsetHeight + 'px';
  }
  Panel.onTab(() => requestAnimationFrame(moveIndicator));
  addEventListener('resize', moveIndicator);
  // Language changes resize the entries.
  Panel.onState((s, langChanged) => { if (langChanged) requestAnimationFrame(moveIndicator); });

  // ---------- Links to other pages, anywhere ----------
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-goto]');
    if (!a || a.onclick) return; // the onboarding links have their own handler
    e.preventDefault();
    Panel.showTab(a.dataset.goto);
  });

  // ---------- Back / forward ----------
  const editing = (el) => !!(el && el.closest && el.closest('input, textarea, select, [contenteditable="true"], iframe'));
  const modalOpen = () => !!$('.modal:not(.hidden)');
  function ripple(x, y, glyph) {
    const r = document.createElement('div');
    r.className = 'ripple';
    r.style.left = x + 'px'; r.style.top = y + 'px';
    r.textContent = glyph;
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 600);
  }
  // Right-click outside text fields = previous page (Electron shows no context menu there anyway).
  document.addEventListener('contextmenu', (e) => {
    // e.defaultPrevented: the page uses right-click itself (BabaDeck buttons: edit).
    if (e.defaultPrevented || editing(e.target) || modalOpen() || String(getSelection() || '').trim()) return;
    e.preventDefault();
    if (Panel.goBack()) ripple(e.clientX, e.clientY, '←');
  });
  // Mouse side buttons (3 = back, 4 = forward).
  document.addEventListener('mouseup', (e) => {
    if (e.button === 3) { e.preventDefault(); if (Panel.goBack()) ripple(e.clientX, e.clientY, '←'); }
    if (e.button === 4) { e.preventDefault(); if (Panel.goForward()) ripple(e.clientX, e.clientY, '→'); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && e.key === 'ArrowLeft') { e.preventDefault(); Panel.goBack(); }
    else if (e.altKey && !e.ctrlKey && e.key === 'ArrowRight') { e.preventDefault(); Panel.goForward(); }
    else if (e.key === 'Backspace' && !e.ctrlKey && !e.altKey && !editing(e.target) && !modalOpen() && !document.body.classList.contains('touring')) { e.preventDefault(); Panel.goBack(); }
    else if (e.ctrlKey && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openPalette(); }
  });

  // ---------- Ctrl+K: jump to any page ----------
  const pal = $('#palette'), input = $('#palInput'), list = $('#palList');
  const COLORS = { puppet: '#ff7a45', hud: '#a970ff', hub: '#2fd4a3', deck: '#3d8bff', bababot: '#ff9f1c', all: '#a49cb3' };
  let items = [], sel = 0;
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function pages() {
    return $$('.side .tab').filter((b) => b.dataset.group === 'all' || Panel.groupOn(b.dataset.group)).map((b) => {
      const g = b.dataset.group;
      const group = g === 'all' ? t('Settings') : Panel.groupName(g);
      return { tab: b.dataset.tab, label: b.textContent.trim(), group, color: COLORS[g] || COLORS.all };
    });
  }
  function renderPalette() {
    const q = norm(input.value.trim());
    items = pages().filter((p) => !q || norm(p.label + ' ' + p.group).includes(q));
    sel = Math.min(sel, Math.max(0, items.length - 1));
    list.innerHTML = items.length
      ? items.map((p, i) => `<div class="pal-item${i === sel ? ' sel' : ''}" data-i="${i}" style="--gc:${p.color}"><span class="dot"></span><b>${escapeHtml(p.label)}</b><span>${escapeHtml(p.group)}</span></div>`).join('')
      : `<div class="pal-item">${escapeHtml(t('No page matches.'))}</div>`;
    const s = list.querySelector('.sel'); if (s) s.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    if (!pal.classList.contains('hidden')) return;
    input.value = ''; sel = 0;
    pal.classList.remove('hidden');
    renderPalette();
    setTimeout(() => input.focus(), 0);
  }
  function closePalette() { pal.classList.add('hidden'); }
  function choose(i) { const p = items[i]; if (!p) return; closePalette(); Panel.showTab(p.tab); }
  $('#openPalette').addEventListener('click', openPalette);
  input.addEventListener('input', () => { sel = 0; renderPalette(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); renderPalette(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); renderPalette(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
  });
  list.addEventListener('mousemove', (e) => { const it = e.target.closest('[data-i]'); if (it && Number(it.dataset.i) !== sel) { sel = Number(it.dataset.i); list.querySelectorAll('.pal-item').forEach((x, i) => x.classList.toggle('sel', i === sel)); } });
  list.addEventListener('click', (e) => { const it = e.target.closest('[data-i]'); if (it) choose(Number(it.dataset.i)); });
  pal.addEventListener('mousedown', (e) => { if (e.target === pal) closePalette(); });
})();
