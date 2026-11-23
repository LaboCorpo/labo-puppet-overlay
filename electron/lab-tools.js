/*
 * Hub Labo → My stream — streamer tools that talk to Twitch / Discord for you:
 *  - ad warning: Helix "Get Ad Schedule" while you are live; N seconds before a mid-roll, a chat message,
 *    a Windows notification and the lab.html?w=ad countdown; "Snooze" pushes it back 5 minutes (Twitch limits the snoozes);
 *  - Discord go-live: one message to a Discord webhook when your live starts (the webhook URL stays encrypted);
 *  - stream info: read/change the title and category, with saved presets.
 */
const { EventEmitter } = require('events');

const WEBHOOK_RE = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,30}\/[\w-]{20,200}$/;

class LabTools extends EventEmitter {
  /** o: { getSettings() -> settings.lab, api, live() -> {startedAt,title,game,viewers}|null, say(text), notify(t, b), getWebhook() -> url, broadcast(ev, data), log, t, fetch } */
  constructor(o) {
    super();
    this.o = o;
    this.fetch = o.fetch || ((...a) => globalThis.fetch(...a));
    this.ad = null; // { nextAt, lastAt, duration, snoozes, refreshAt, prerollFree, checkedAt, error }
    this.warned = 0;
    this.nextPoll = 0;
    this.posted = '';
    this.timer = setInterval(() => this.tick().catch(() => {}), 15000);
  }
  cfg() { return this.o.getSettings(); }

  // ---------- Ads ----------
  async tick() {
    const c = this.cfg().ads, api = this.o.api, live = this.o.live();
    if (!c.enabled || !api.connected || !live) { if (this.ad) { this.ad = null; this.emit('change'); } return; }
    const now = Date.now();
    const soon = this.ad && this.ad.nextAt && this.ad.nextAt - now < 4 * 60000;
    if (now >= this.nextPoll) {
      this.nextPoll = now + (soon ? 15000 : 60000);
      await this.readAds();
    }
    const a = this.ad;
    if (a && a.nextAt && a.nextAt > now && a.nextAt - now <= c.warnSec * 1000 + 7000 && this.warned !== a.nextAt) {
      this.warned = a.nextAt;
      const s = Math.max(5, Math.round((a.nextAt - now) / 1000));
      if (c.chat) this.o.say(c.chatText.replace(/\{s\}/g, String(s)).replace(/\{duration\}/g, String(a.duration || 0))).catch((e) => this.o.log.warn('[lab-tools] ad message: ' + e.message));
      this.o.notify(this.o.t('Ad break in {s} s', { s }), a.snoozes ? this.o.t('Snooze it in Hub Labo → My stream (or the BabaDeck): {n} left.', { n: a.snoozes }) : this.o.t('No snooze left.'));
      this.o.broadcast('lab-event', { type: 'ad', at: a.nextAt, duration: a.duration });
    }
  }
  async readAds() {
    try {
      const r = await this.o.api.helix('GET', 'channels/ads', { broadcaster_id: this.o.api.userId });
      const d = (r.data || [])[0] || {};
      const sec = (x) => (Number(x) > 0 ? Number(x) * 1000 : 0);
      this.ad = { nextAt: sec(d.next_ad_at), lastAt: sec(d.last_ad_at), duration: Number(d.duration) || 0, snoozes: Number(d.snooze_count) || 0, refreshAt: sec(d.snooze_refresh_at), prerollFree: Number(d.preroll_free_time) || 0, checkedAt: Date.now() };
    } catch (e) {
      this.ad = { error: e.status === 401 || e.status === 403 ? 'Log in with Twitch again (new permission).' : e.message, checkedAt: Date.now() };
    }
    this.emit('change');
  }
  async snooze() {
    const r = await this.o.api.helix('POST', 'channels/ads/schedule/snooze', { broadcaster_id: this.o.api.userId });
    const d = (r.data || [])[0] || {};
    this.ad = Object.assign({}, this.ad, { nextAt: Number(d.next_ad_at) * 1000 || 0, snoozes: Number(d.snooze_count) || 0, refreshAt: Number(d.snooze_refresh_at) * 1000 || 0 });
    this.warned = 0;
    this.emit('change');
    this.o.broadcast('lab-event', { type: 'ad-snoozed', at: this.ad.nextAt });
    return this.ad;
  }

  // ---------- Discord go-live ----------
  async onLive(live, was) {
    if (!live || (was && was.startedAt === live.startedAt) || this.posted === live.startedAt) return;
    // LaboHub restarted in the middle of a live: the crew already got the message.
    if (Date.now() - Date.parse(live.startedAt) > 15 * 60000) return;
    const c = this.cfg().discordLive;
    if (!c.enabled || !this.o.getWebhook()) return;
    this.posted = live.startedAt;
    try { await this.postDiscord(live); this.o.log.info('[lab-tools] Discord go-live message sent'); } catch (e) { this.o.log.warn('[lab-tools] Discord webhook: ' + e.message); this.o.notify(this.o.t('Discord message not sent'), this.o.t(e.message)); }
  }
  async postDiscord(live, test) {
    const url = this.o.getWebhook();
    if (!WEBHOOK_RE.test(url || '')) throw new Error('Paste a Discord webhook link first');
    const login = this.o.api.login || '';
    const l = live || { title: this.o.t('(test) My stream title'), game: 'Just Chatting' };
    const content = this.cfg().discordLive.text.replace(/\{(name|login|title|game)\}/g, (m, k) => ({ name: login, login, title: l.title || '', game: l.game || '' }[k])).slice(0, 1900);
    const r = await this.fetch(url + '?wait=false', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: (test ? '🧪 ' : '') + content, username: 'LaboHub', allowed_mentions: { parse: ['everyone', 'roles'] } }) });
    if (!r.ok) throw new Error(r.status === 404 ? 'This Discord webhook no longer exists' : 'Discord refused the message (' + r.status + ')');
  }

  // ---------- Stream info ----------
  async info() {
    const r = await this.o.api.helix('GET', 'channels', { broadcaster_id: this.o.api.userId });
    const d = (r.data || [])[0] || {};
    return { title: d.title || '', gameId: d.game_id || '', gameName: d.game_name || '', tags: d.tags || [] };
  }
  async setInfo(b) {
    const body = {};
    if (typeof b.title === 'string' && b.title.trim()) body.title = b.title.trim().slice(0, 140);
    if (/^\d{1,20}$/.test(String(b.gameId || ''))) body.game_id = String(b.gameId);
    if (!Object.keys(body).length) throw new Error('Nothing to change');
    await this.o.api.helix('PATCH', 'channels', { broadcaster_id: this.o.api.userId }, body);
  }
  async searchGames(q) {
    const query = String(q || '').trim().slice(0, 80);
    if (!query) return [];
    const r = await this.o.api.helix('GET', 'search/categories', { query, first: 8 });
    return (r.data || []).map((g) => ({ id: String(g.id), name: String(g.name || '').slice(0, 80), box: /^https:\/\//.test(g.box_art_url || '') ? g.box_art_url : '' }));
  }
  async applyProfile(name) {
    const p = this.cfg().profiles.find((x) => x.name.toLowerCase() === String(name || '').toLowerCase());
    if (!p) throw new Error('Unknown preset');
    await this.setInfo({ title: p.title, gameId: p.gameId });
    return p;
  }

  snapshot() { return { ad: this.ad }; }
  stop() { clearInterval(this.timer); }
}

module.exports = { LabTools, WEBHOOK_RE };
