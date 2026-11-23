/*
 * BabaDeck: Stream Deck-like buttons. A button runs its actions in order (multi-action), with optional delays.
 * Buttons live in settings.deck.pages; this module only executes them (main.js passes the action runners).
 */
const ACTIONS = {
  // OBS (obs-websocket)
  'obs.scene': ['scene'], 'obs.source': ['scene', 'source', 'mode'], 'obs.mute': ['input'], 'obs.stream': ['mode'], 'obs.record': ['mode'], 'obs.replay': [],
  // LaboHub
  'app.marker': ['note'], 'app.overlay': [], 'app.muteChat': [], 'app.alert': ['key'], 'app.fx': [],
  // Twitch
  'twitch.say': ['text'], 'twitch.clip': [], 'twitch.title': ['text'],
  // Hub → My stream, Baba Bot, game counters (settings keys kept under "lab")
  'lab.giveaway': ['op'], 'lab.poll': [], 'lab.counter': ['name', 'delta'], 'lab.ad': [], 'lab.profile': ['name'], 'lab.sound': ['name'],
  // Other
  'url': ['url'], 'delay': ['ms'],
};
const MODES = ['toggle', 'start', 'stop', 'show', 'hide'];

function cleanAction(a) {
  if (!a || typeof a !== 'object' || !(a.type in ACTIONS)) return null;
  const out = { type: a.type };
  for (const k of ACTIONS[a.type]) {
    let v = a[k];
    if (k === 'ms') v = Math.max(0, Math.min(10000, Math.round(Number(v) || 0)));
    else if (k === 'mode') v = MODES.includes(v) ? v : 'toggle';
    else if (k === 'url') v = /^https?:\/\/\S{1,500}$/.test(String(v || '')) ? String(v) : '';
    else if (k === 'key') v = ['follow', 'sub', 'prime', 'gift', 'bits', 'raid'].includes(v) ? v : 'follow';
    else if (k === 'op') v = ['open', 'close', 'draw', 'reset'].includes(v) ? v : 'draw';
    else if (k === 'delta') v = v === 'reset' ? 'reset' : String(Math.max(-1000, Math.min(1000, Math.round(Number(v) || 1))));
    else v = String(v == null ? '' : v).slice(0, k === 'text' ? 500 : 200);
    out[k] = v;
  }
  return out;
}
const COLOR_RE = /^#[0-9a-f]{6}$/i;
// Electron accelerator: modifiers and keys joined by "+" (letters, digits, F1-F24, num0-9, punctuation…).
const HOTKEY_RE = /^[\w+\-=,./;'[\]\\`]{0,60}$/;
function cleanButton(b, i) {
  if (!b || typeof b !== 'object') return null;
  return {
    id: /^[a-z0-9]{4,16}$/.test(b.id || '') ? b.id : 'b' + i + Math.random().toString(36).slice(2, 7).replace(/[^a-z0-9]/g, 'x'),
    label: String(b.label || '').slice(0, 30), icon: String(b.icon || '').slice(0, 8),
    color: COLOR_RE.test(b.color || '') ? b.color : '#2a2236', fg: COLOR_RE.test(b.fg || '') ? b.fg : '#ffffff',
    hotkey: HOTKEY_RE.test(b.hotkey || '') ? String(b.hotkey || '') : '',
    actions: (Array.isArray(b.actions) ? b.actions : []).slice(0, 12).map(cleanAction).filter(Boolean),
  };
}
function cleanDeck(d, fb) {
  if (!d || typeof d !== 'object') return fb;
  const cols = Math.max(2, Math.min(8, Math.round(Number(d.cols) || 5)));
  const rows = Math.max(1, Math.min(6, Math.round(Number(d.rows) || 3)));
  const pages = (Array.isArray(d.pages) ? d.pages : []).slice(0, 10).map((p, pi) => ({
    name: String((p && p.name) || 'Page ' + (pi + 1)).slice(0, 30),
    buttons: (Array.isArray(p && p.buttons) ? p.buttons : []).slice(0, cols * rows).map((b, i) => (b ? cleanButton(b, i) : null)),
  }));
  return { cols, rows, pages: pages.length ? pages : [{ name: 'Page 1', buttons: [] }], onTop: !!d.onTop, hud: cleanHud(d.hud, fb && fb.hud) };
}
// Shortcut strip (info only, click-through): where it sits on screen, how big, what it lists.
function cleanHud(h, fb) {
  const f = fb && typeof fb === 'object' ? fb : { enabled: false, x: -1, y: 8, w: 640, h: 64, opacity: 92, labels: true, all: false };
  if (!h || typeof h !== 'object') return Object.assign({}, f);
  const n = (v, lo, hi, d) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  return {
    enabled: typeof h.enabled === 'boolean' ? h.enabled : !!f.enabled,
    x: n(h.x, -1, 20000, f.x), y: n(h.y, -20000, 20000, f.y), w: n(h.w, 160, 3000, f.w), h: n(h.h, 40, 1200, f.h),
    opacity: n(h.opacity, 20, 100, f.opacity),
    labels: typeof h.labels === 'boolean' ? h.labels : f.labels !== false,
    all: typeof h.all === 'boolean' ? h.all : !!f.all, // false: only the buttons that have a shortcut
  };
}

class Deck {
  constructor(o) { this.o = o; this.running = new Set(); } // o: { getSettings, run(action), log }
  find(id) {
    for (const p of this.o.getSettings().pages) for (const b of p.buttons) if (b && b.id === id) return b;
    return null;
  }
  async press(id) {
    const b = this.find(id);
    if (!b) throw new Error('Unknown button');
    if (this.running.has(id)) return { busy: true };
    this.running.add(id);
    try {
      for (const a of b.actions) {
        if (a.type === 'delay') { await new Promise((r) => setTimeout(r, a.ms)); continue; }
        await this.o.run(a);
      }
      return { ok: true };
    } finally { this.running.delete(id); }
  }
  hotkeys() {
    const out = [];
    for (const p of this.o.getSettings().pages) for (const b of p.buttons) if (b && b.hotkey) out.push({ id: b.id, acc: b.hotkey });
    return out;
  }
}

module.exports = { Deck, cleanDeck, cleanAction, cleanHud, ACTIONS, HOTKEY_RE };
