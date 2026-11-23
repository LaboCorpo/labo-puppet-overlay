/*
 * Streaming hub: who in the crew is live (Helix Get Streams), plus actions on a crew member's channel:
 * start/cancel a raid, invite them to Stream Together (Guest Star API, beta) and send a chat message.
 * Reading their chats is done by the panel itself (anonymous IRC), so nothing here for that.
 */
const { EventEmitter } = require('events');

const LOGIN_RE = /^[a-z0-9_]{3,25}$/;

class Hub extends EventEmitter {
  /** opts: { api: TwitchApi, getSettings() -> settings.hub, log } */
  constructor(opts) {
    super();
    this.api = opts.api;
    this.o = opts;
    this.users = new Map(); // login -> { id, login, display, avatar }
    this.live = new Map(); // login -> stream
    this.list = [];
    this.status = 'off';
    this.detail = '';
    this.timer = null;
    this.polledOnce = false;
    this.raid = null; // { login, at }
    this.boxes = {}; // game id -> box art URL (live banner)
  }

  snapshot() { return { status: this.status, detail: this.detail, list: this.list, raid: this.raid, updatedAt: this.updatedAt || 0 }; }

  setStatus(s, detail) { this.status = s; this.detail = detail || ''; }

  // (Re)starts polling for the current settings and account.
  schedule() {
    clearInterval(this.timer);
    this.timer = null;
    const cfg = this.o.getSettings();
    if (!cfg.members.length) { this.setStatus('empty'); this.list = []; this.emit('change'); return; }
    if (!this.api.connected) { this.setStatus('login'); this.rebuild(); this.emit('change'); return; }
    this.timer = setInterval(() => this.poll(), Math.max(30, cfg.pollSec || 60) * 1000);
    this.poll();
  }

  stop() { clearInterval(this.timer); this.timer = null; }

  rebuild() {
    const me = this.api.login;
    this.list = this.o.getSettings().members.map((login) => {
      const u = this.users.get(login) || {};
      const s = this.live.get(login);
      return {
        login, id: u.id || null, display: u.display || login, avatar: u.avatar || null, me: login === me,
        live: !!s, title: s ? s.title : '', game: s ? s.game_name : '', box: s ? this.boxes[s.game_id] || '' : '', viewers: s ? s.viewer_count : 0,
        startedAt: s ? s.started_at : null,
        thumb: s && s.thumbnail_url ? s.thumbnail_url.replace('{width}', '320').replace('{height}', '180') : null,
      };
    });
  }

  async fetchUsers(logins) {
    const todo = logins.filter((l) => !this.users.has(l));
    for (let i = 0; i < todo.length; i += 100) {
      const r = await this.api.helix('GET', 'users', { login: todo.slice(i, i + 100) });
      for (const u of r.data || []) this.users.set(u.login, { id: u.id, login: u.login, display: u.display_name, avatar: u.profile_image_url });
    }
  }

  async poll() {
    const logins = this.o.getSettings().members;
    if (!logins.length || !this.api.connected) return;
    try {
      await this.fetchUsers(logins);
      const r = await this.api.helix('GET', 'streams', { user_login: logins.slice(0, 100), first: 100 });
      const next = new Map();
      for (const s of r.data || []) next.set(String(s.user_login).toLowerCase(), s);
      if (this.api.gameBoxes) Object.assign(this.boxes, await this.api.gameBoxes([...next.values()].map((s) => s.game_id)));
      // Notify for channels that just went live (not on the first poll: they were already live).
      if (this.polledOnce) for (const [login, s] of next) if (!this.live.has(login) && login !== this.api.login) this.emit('live', { login, display: s.user_name, title: s.title, game: s.game_name, box: this.boxes[s.game_id] || '' });
      this.live = next;
      this.polledOnce = true;
      this.updatedAt = Date.now();
      this.setStatus('ok');
    } catch (e) {
      this.setStatus('error', e.message);
    }
    this.rebuild();
    this.emit('change');
  }

  async userId(login) {
    login = String(login || '').toLowerCase();
    if (!LOGIN_RE.test(login)) throw new Error('Invalid channel name');
    if (!this.users.has(login)) await this.fetchUsers([login]);
    const u = this.users.get(login);
    if (!u) throw new Error('Channel not found');
    return u.id;
  }

  // ---------- Actions ----------
  async startRaid(login) {
    const to = await this.userId(login);
    if (to === this.api.userId) throw new Error("You can't raid yourself");
    await this.api.helix('POST', 'raids', { from_broadcaster_id: this.api.userId, to_broadcaster_id: to });
    // Twitch shows a 90 s countdown on your stream, then sends the raid (or you click "Raid now" on Twitch).
    this.raid = { login: String(login).toLowerCase(), at: Date.now() };
    this.emit('change');
  }

  async cancelRaid() {
    await this.api.helix('DELETE', 'raids', { broadcaster_id: this.api.userId });
    this.raid = null;
    this.emit('change');
  }

  // Stream Together: invite into your current session, creating one if needed.
  // Twitch ends a session nobody is connected to, so the host must have Stream Together open on Twitch.
  async inviteStreamTogether(login) {
    const guest = await this.userId(login);
    const me = this.api.userId;
    if (guest === me) throw new Error("You can't invite yourself");
    let session = null;
    const cur = await this.api.helix('GET', 'guest_star/session', { broadcaster_id: me, moderator_id: me });
    if (cur.data && cur.data[0]) session = cur.data[0].id;
    if (!session) {
      const created = await this.api.helix('POST', 'guest_star/session', { broadcaster_id: me });
      session = created.data && created.data[0] && created.data[0].id;
    }
    if (!session) throw new Error('Could not start a Stream Together session');
    await this.api.helix('POST', 'guest_star/invites', { broadcaster_id: me, moderator_id: me, session_id: session, guest_id: guest });
  }

  async say(login, text) {
    const msg = String(text || '').trim().slice(0, 500);
    if (!msg) throw new Error('Empty message');
    const to = await this.userId(login);
    const r = await this.api.helix('POST', 'chat/messages', null, { broadcaster_id: to, sender_id: this.api.userId, message: msg });
    const d = r.data && r.data[0];
    if (d && d.is_sent === false) throw new Error((d.drop_reason && d.drop_reason.message) || 'Message not sent');
  }

  // ---------- Moderation (your channel, or channels where you are a moderator) ----------
  // roomId = the channel's user id (IRC tag room-id); Twitch answers 403 when you are not a moderator there.
  async moderate(b) {
    const room = String(b.roomId || ''), me = this.api.userId;
    if (!ID_RE.test(room)) throw new Error('Unknown channel');
    const q = { broadcaster_id: room, moderator_id: me };
    const user = String(b.userId || '');
    try {
      switch (b.op) {
        case 'delete':
          if (!/^[\w-]{8,64}$/.test(String(b.messageId || ''))) throw new Error('Unknown message');
          await this.api.helix('DELETE', 'moderation/chat', Object.assign({ message_id: b.messageId }, q)); return;
        case 'clear': await this.api.helix('DELETE', 'moderation/chat', q); return;
        case 'timeout': case 'ban': {
          if (!ID_RE.test(user)) throw new Error('Unknown user');
          const data = { user_id: user, reason: String(b.reason || '').slice(0, 500) };
          if (b.op === 'timeout') data.duration = Math.max(1, Math.min(1209600, Math.round(Number(b.seconds) || 600)));
          await this.api.helix('POST', 'moderation/bans', q, { data }); return;
        }
        case 'unban':
          if (!ID_RE.test(user)) throw new Error('Unknown user');
          await this.api.helix('DELETE', 'moderation/bans', Object.assign({ user_id: user }, q)); return;
        case 'settings': {
          const p = b.settings || {}, body = {};
          if ('slow' in p) { body.slow_mode = !!p.slow; if (p.slow) body.slow_mode_wait_time = Math.max(3, Math.min(120, Number(p.slow) || 30)); }
          if ('followers' in p) { body.follower_mode = p.followers !== false && p.followers != null; if (body.follower_mode) body.follower_mode_duration = Math.max(0, Math.min(129600, Number(p.followers) || 0)); }
          if ('emoteOnly' in p) body.emote_mode = !!p.emoteOnly;
          if ('subsOnly' in p) body.subscriber_mode = !!p.subsOnly;
          await this.api.helix('PATCH', 'chat/settings', q, body); return;
        }
        default: throw new Error('Unknown action');
      }
    } catch (e) {
      if (e.status === 403 || e.status === 401) throw new Error('You are not a moderator of this channel (or log in again to allow moderation).');
      throw e;
    }
  }

  // Chat badge pictures: { global: {"set/version": url}, rooms: {roomId: {...}} }, cached for the session.
  async badges(roomIds) {
    this.badgeCache = this.badgeCache || { global: null, rooms: {} };
    const c = this.badgeCache;
    const toMap = (r) => { const o = {}; for (const set of (r && r.data) || []) for (const v of set.versions || []) if (/^https:\/\//.test(v.image_url_2x || v.image_url_1x || '')) o[set.set_id + '/' + v.id] = v.image_url_2x || v.image_url_1x; return o; };
    if (this.api.connected) {
      if (!c.global) try { c.global = toMap(await this.api.helix('GET', 'chat/badges/global')); } catch (e) { /* later */ }
      for (const id of (roomIds || []).map(String).filter((x) => ID_RE.test(x)).slice(0, 10)) {
        if (c.rooms[id]) continue;
        try { c.rooms[id] = toMap(await this.api.helix('GET', 'chat/badges', { broadcaster_id: id })); } catch (e) { /* later */ }
      }
    }
    return { global: c.global || {}, rooms: c.rooms };
  }
}

const ID_RE = /^\d{1,20}$/;

module.exports = { Hub };
