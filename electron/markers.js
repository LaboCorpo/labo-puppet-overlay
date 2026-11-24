/*
 * Stream timestamps: press a hotkey (or the button, or "!clip" in chat) during your live and LaboHub notes
 * the moment: offset since the start of the stream, title, game, a note. It also creates a Twitch stream marker
 * when possible. Once Twitch has the VOD (the archive of the stream), each timestamp gets a direct link
 * to that second of the VOD, so clips can be made without watching the whole VOD.
 */
const { EventEmitter } = require('events');
const crypto = require('crypto');
const MAX_MARKERS = 5000;

const RESOLVE_MS = 5 * 60 * 1000;
const RESOLVE_MAX_AGE = 60 * 24 * 3600 * 1000; // VODs are kept 7 days (60 for Partners): no point looking further

// 3725 -> "1h02m05s" (Twitch VOD ?t= format)
function vodTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${h}h${String(m).padStart(2, '0')}m${String(s).padStart(2, '0')}s`;
}
function vodLink(m, leadSeconds) {
  return m.videoId ? `https://www.twitch.tv/videos/${m.videoId}?t=${vodTime(m.offset - (leadSeconds || 0))}` : null;
}

class Markers extends EventEmitter {
  /** opts: { api: TwitchApi, store, log, getSettings() -> settings.markers } */
  constructor(opts) {
    super();
    this.api = opts.api;
    this.store = opts.store;
    this.o = opts;
    this.timer = null;
    this.busy = false;
  }

  get list() { return this.store.data.markers; }
  snapshot() { return this.list; }

  start() { clearInterval(this.timer); this.timer = setInterval(() => this.resolveVideos().catch(() => {}), RESOLVE_MS); this.resolveVideos().catch(() => {}); }
  stop() { clearInterval(this.timer); }

  changed() { this.store.save(); this.emit('change'); }

  /** source: 'hotkey' | 'button' | 'chat'. Throws a user-readable error (translated by the panel) when it can't be done. */
  async add({ source, note, by }) {
    if (!this.api.connected) throw new Error('Log in with Twitch to create timestamps.');
    if (this.busy) throw new Error('A timestamp is already being created.');
    this.busy = true;
    try {
      const now = Date.now();
      const me = this.api.userId;
      const r = await this.api.helix('GET', 'streams', { user_id: me });
      const live = r.data && r.data[0];
      if (!live) throw new Error('You are not live: no timestamp created.');
      const m = {
        id: crypto.randomBytes(6).toString('hex'),
        at: now,
        streamId: String(live.id || ''),
        startedAt: live.started_at,
        offset: Math.max(0, Math.round((now - Date.parse(live.started_at)) / 1000)),
        title: String(live.title || '').slice(0, 200),
        game: String(live.game_name || '').slice(0, 100),
        note: String(note || '').trim().slice(0, 140),
        by: by ? String(by).slice(0, 40) : null,
        source: ['hotkey', 'button', 'chat'].includes(source) ? source : 'button',
        twitchMarker: null,
        videoId: null,
        clipId: null,
      };
      const cfg = this.o.getSettings();
      if (cfg.createClip) {
        // A real Twitch clip of the last seconds, opened in one click from the Clips page.
        try {
          const c = await this.api.helix('POST', 'clips', { broadcaster_id: me });
          const id = c.data && c.data[0] && String(c.data[0].id || '');
          if (/^[\w-]{3,100}$/.test(id || '')) m.clipId = id;
        } catch (e) { m.clipError = e.message.slice(0, 200); }
      }
      if (cfg.twitchMarker) {
        // Best effort: Twitch refuses markers when past broadcasts are off; the local timestamp is kept anyway.
        try {
          const mk = await this.api.helix('POST', 'streams/markers', null, Object.assign({ user_id: me }, m.note ? { description: m.note } : {}));
          m.twitchMarker = mk.data && mk.data[0] ? String(mk.data[0].id) : null;
        } catch (e) { m.markerError = e.message.slice(0, 200); }
      }
      this.list.push(m);
      if (this.list.length > MAX_MARKERS) this.list.splice(0, this.list.length - MAX_MARKERS);
      this.changed();
      this.emit('added', m);
      this.resolveVideos().catch(() => {}); // the archive usually exists while you're still live
      return m;
    } finally { this.busy = false; }
  }

  update(id, patch) {
    const m = this.list.find((x) => x.id === id);
    if (!m) throw new Error('Timestamp not found.');
    if (typeof patch.note === 'string') m.note = patch.note.trim().slice(0, 140);
    if (typeof patch.done === 'boolean') m.done = patch.done; // "clip made"
    this.changed();
  }

  remove(id) {
    const i = this.list.findIndex((x) => x.id === id);
    if (i < 0) throw new Error('Timestamp not found.');
    this.list.splice(i, 1);
    this.changed();
  }

  removeDay(day) {
    const before = this.list.length;
    this.store.data.markers = this.list.filter((m) => dayKey(m.at) !== day);
    if (this.list.length !== before) this.changed();
  }

  // Links timestamps to their VOD (Get Videos returns stream_id for archives).
  async resolveVideos() {
    if (!this.api.connected) return;
    const now = Date.now();
    const todo = this.list.filter((m) => !m.videoId && m.streamId && now - m.at < RESOLVE_MAX_AGE);
    if (!todo.length) return;
    const r = await this.api.helix('GET', 'videos', { user_id: this.api.userId, type: 'archive', first: 50 });
    const byStream = new Map();
    for (const v of r.data || []) if (v.stream_id) byStream.set(String(v.stream_id), v);
    let hit = false;
    for (const m of todo) {
      const v = byStream.get(m.streamId);
      if (v) { m.videoId = String(v.id); hit = true; }
    }
    if (hit) this.changed();
  }
}

// Local calendar day, used to sort timestamps by day ("2026-11-22").
function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const clipLink = (m) => (m && m.clipId ? `https://clips.twitch.tv/${m.clipId}` : null);
module.exports = { clipLink, Markers, vodTime, vodLink, dayKey };
