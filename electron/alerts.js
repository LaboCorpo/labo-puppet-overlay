/*
 * Alert sounds: maps a Twitch event to the sounds to play, chosen in the main process so the
 * "sequence" and "no repeat" state is shared, whichever page (desktop overlay or OBS source) plays them.
 */
const { ALERT_KEYS } = require('./settings');

// Event from twitch.js / stream-stats.js -> alert key, or null (no alert for it).
function alertKey(e) {
  if (!e) return null;
  if (e.type === 'follow') return 'follow';
  if (e.type === 'bits') return 'bits';
  if (e.type === 'raid') return 'raid';
  if (e.type === 'sub') {
    if (e.bundled) return null; // part of a "gift N subs": the bundle notice already played
    return e.kind === 'gift' || e.kind === 'prime' ? e.kind : 'sub';
  }
  return null;
}

// Amount compared with each sound's `min`: bits cheered, raiders, gifted subs.
function amountOf(e, key) {
  if (key === 'bits') return Number(e.amount) || 0;
  if (key === 'raid') return Number(e.count) || 0;
  if (key === 'gift') return Number(e.count) || 1;
  return 0;
}

class AlertPicker {
  constructor(random) {
    this.random = random || Math.random;
    this.cursor = {}; // sequence position per key
    this.last = {}; // last file played per key (random mode avoids repeating it)
  }

  /** cfg: settings.alerts. Returns [{ file, volume }] (empty = nothing to play). */
  pick(cfg, key, amount) {
    if (!cfg || !cfg.enabled || !ALERT_KEYS.includes(key)) return [];
    let ev = cfg[key];
    // Prime and gifted subs fall back to the regular sub sounds when they have none of their own.
    if ((!ev || !ev.sounds.length) && (key === 'prime' || key === 'gift')) { key = 'sub'; ev = cfg.sub; }
    if (!ev || !ev.sounds.length) return [];
    let pool = ev.sounds.filter((s) => (s.min || 0) <= amount);
    if (!pool.length) return [];
    // Tiers: only the sounds with the highest threshold reached (e.g. 1000 bits beats 100 bits).
    const top = Math.max(...pool.map((s) => s.min || 0));
    pool = pool.filter((s) => (s.min || 0) === top);
    const master = cfg.volume == null ? 1 : cfg.volume;
    const out = (list) => list.map((s) => ({ file: s.file, volume: Math.round(s.volume * master * 1000) / 1000 }));
    if (ev.mode === 'all') return out(pool);
    let chosen;
    if (ev.mode === 'sequence') {
      const i = (this.cursor[key] || 0) % pool.length;
      this.cursor[key] = i + 1;
      chosen = pool[i];
    } else {
      const choices = pool.length > 1 ? pool.filter((s) => s.file !== this.last[key]) : pool;
      chosen = choices[Math.floor(this.random() * choices.length)] || pool[0];
    }
    this.last[key] = chosen.file;
    return out([chosen]);
  }
}

module.exports = { alertKey, amountOf, AlertPicker };
