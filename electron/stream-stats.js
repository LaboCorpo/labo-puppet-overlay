/*
 * Live channel counters for the OBS widgets: followers, subs (Helix, polled) and the latest follower/sub
 * (with their Twitch profile picture). New followers are detected between polls (Helix lists the newest first)
 * and reported as 'follow' events.
 */
const { EventEmitter } = require('events');

class StreamStats extends EventEmitter {
  /** opts: { api: TwitchApi, log, intervalMs } */
  constructor(opts) {
    super();
    this.api = opts.api;
    this.log = opts.log;
    this.intervalMs = opts.intervalMs || 20000;
    this.timer = null;
    this.soon = null;
    this.forUser = null;
    this.avatars = new Map(); // login -> profile picture URL (or null)
    this.reset();
  }

  reset() {
    this.data = { followers: null, subs: null, subPoints: null, latestFollower: null, latestSub: null, live: null, errors: {}, updatedAt: 0 };
    this.lastFollowerId = null;
  }

  snapshot() { return this.data; }

  // (Re)starts polling when the account is connected, stops otherwise.
  sync() {
    if (!this.api.connected) { clearInterval(this.timer); this.timer = null; return; }
    if (this.forUser !== this.api.userId) { this.forUser = this.api.userId; this.reset(); this.emit('change'); }
    if (!this.timer) { this.timer = setInterval(() => this.poll(), this.intervalMs); this.poll(); }
  }

  stop() { clearInterval(this.timer); clearTimeout(this.soon); this.timer = null; }

  // A sub just happened in chat: show it at once and refresh the count shortly (Helix lags a few seconds).
  onSub(e) {
    if (e.bundled) return;
    this.data.latestSub = { login: e.login, display: e.display, kind: e.kind || 'sub', count: e.count || 1, at: Date.now() };
    this.emit('change');
    this.attachAvatar('latestSub');
    clearTimeout(this.soon);
    this.soon = setTimeout(() => this.poll(), 5000);
  }

  async poll() {
    if (!this.api.connected) return;
    const id = this.api.userId;
    let changed = false;
    const set = (k, v) => { if (this.data[k] !== v) { this.data[k] = v; changed = true; } };
    const fail = (k, e) => {
      const msg = e.status === 401 || e.status === 403 ? 'Missing permission: log in with Twitch again'
        : k === 'subs' && e.status === 400 ? 'Sub count needs Twitch Affiliate or Partner' : e.message;
      if (this.data.errors[k] !== msg) { this.data.errors = Object.assign({}, this.data.errors, { [k]: msg }); changed = true; }
    };
    const ok = (k) => { if (this.data.errors[k]) { const e = Object.assign({}, this.data.errors); delete e[k]; this.data.errors = e; changed = true; } };

    try {
      const r = await this.api.helix('GET', 'channels/followers', { broadcaster_id: id, first: 1 });
      ok('followers');
      const newest = (r.data || [])[0];
      if (newest) {
        const f = { login: newest.user_login, display: newest.user_name, at: Date.parse(newest.followed_at) || Date.now() };
        if (this.lastFollowerId && newest.user_id !== this.lastFollowerId && (r.total || 0) >= (this.data.followers || 0)) {
          this.emit('follow', { type: 'follow', login: f.login, display: f.display, color: null });
        }
        if (this.lastFollowerId !== newest.user_id) { this.lastFollowerId = newest.user_id; this.data.latestFollower = f; changed = true; this.attachAvatar('latestFollower'); }
      }
      set('followers', Number(r.total) || 0);
    } catch (e) { fail('followers', e); }

    try {
      const r = await this.api.helix('GET', 'subscriptions', { broadcaster_id: id, first: 1 });
      ok('subs');
      set('subs', Number(r.total) || 0);
      set('subPoints', Number(r.points) || 0);
    } catch (e) { fail('subs', e); }

    // Your own live (timestamps tab, status): start time, title, viewers.
    try {
      const r = await this.api.helix('GET', 'streams', { user_id: id });
      const st = (r.data || [])[0];
      const live = st ? { startedAt: st.started_at, title: st.title, game: st.game_name, viewers: st.viewer_count } : null;
      if (JSON.stringify(live) !== JSON.stringify(this.data.live)) { this.data.live = live; changed = true; }
    } catch (e) { /* the counters are still useful without it */ }

    if (changed) { this.data.updatedAt = Date.now(); this.emit('change'); }
  }
}

// Profile picture of the latest follower / sub, added once Helix answers (the name shows right away).
StreamStats.prototype.attachAvatar = async function (key) {
  const entry = this.data[key];
  if (!entry || !entry.login) return;
  const url = await this.avatarOf(entry.login);
  if (url && this.data[key] === entry) { this.data[key] = Object.assign({}, entry, { avatar: url }); this.data.updatedAt = Date.now(); this.emit('change'); }
};
StreamStats.prototype.avatarOf = async function (login) {
  const key = String(login).toLowerCase();
  if (!/^[a-z0-9_]{1,25}$/.test(key)) return null;
  if (this.avatars.has(key)) return this.avatars.get(key);
  let url = null;
  try {
    const r = await this.api.helix('GET', 'users', { login: key });
    const u = (r.data || [])[0];
    if (u && typeof u.profile_image_url === 'string' && /^https:\/\//.test(u.profile_image_url)) url = u.profile_image_url;
  } catch (e) { return null; } // not cached: try again next time
  if (this.avatars.size > 300) this.avatars.clear();
  this.avatars.set(key, url);
  return url;
};

module.exports = { StreamStats };
