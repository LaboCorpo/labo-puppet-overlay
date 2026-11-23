/*
 * Background helpers kept from "Labo test" (each one off by default, settings.lab):
 *  - health (Hub → My stream): a notification when OBS drops frames or the network chokes;
 *  - raidThanks (Baba Bot): a thank-you message in your chat when someone raids you;
 *  - points (BabaDeck): channel points rewards press BabaDeck buttons (EventSub over WebSocket, no server needed).
 */
const { EventEmitter } = require('events');

class Lab extends EventEmitter {
  constructor(o) {
    super();
    this.o = o; // { getSettings() -> settings.lab, notify(title, body), say(text), obsStats(), pressDeck(id), api, log, t }
    this.lastHealth = 0;
    this.es = null;
    this.status = { points: 'off' };
    this.timer = setInterval(() => this.tick(), 30000);
  }
  cfg() { return this.o.getSettings(); }

  onTwitchEvent(e) {
    const c = this.cfg().raidThanks;
    if (e.type === 'raid' && c.enabled && e.login) {
      const text = c.text.replace(/\{name\}/g, e.display || e.login).replace(/\{login\}/g, e.login).replace(/\{viewers\}/g, String(e.count || ''));
      setTimeout(() => this.o.say(text).catch((x) => this.o.log.warn('[lab] raid thanks: ' + x.message)), 4000);
    }
  }
  tick() {
    const c = this.cfg(), now = Date.now();
    const st = this.o.obsStats();
    if (c.healthAlerts && st && st.outputTotal > 300 && now - this.lastHealth > 5 * 60000) {
      const drop = (st.outputSkipped / st.outputTotal) * 100;
      if (drop > 5 || st.congestion > 40) { this.lastHealth = now; this.o.notify(this.o.t('Your stream is struggling'), this.o.t('{p} % of frames dropped, network congestion {c} %. Lower the bitrate in OBS?', { p: Math.round(drop), c: st.congestion })); }
    }
  }

  // ---------- Channel points → BabaDeck (EventSub WebSocket) ----------
  syncPoints() {
    const c = this.cfg().points;
    const want = c.enabled && this.o.api.connected;
    if (!want) { this.stopPoints(); this.status.points = c.enabled ? 'login' : 'off'; this.emit('change'); return; }
    if (this.es) return;
    this.connectPoints('wss://eventsub.wss.twitch.tv/ws');
  }
  stopPoints() { clearTimeout(this.esTimer); clearTimeout(this.esWatch); const w = this.es; this.es = null; if (w) try { w.close(); } catch (e) { /* closed */ } }
  connectPoints(url) {
    let ws;
    try { ws = new WebSocket(url); } catch (e) { return this.retryPoints(); }
    this.es = ws;
    this.status.points = 'connecting'; this.emit('change');
    let keep = 30;
    const watch = () => { clearTimeout(this.esWatch); this.esWatch = setTimeout(() => { if (this.es === ws) { this.es = null; try { ws.close(); } catch (e) { /* closed */ } this.retryPoints(); } }, (keep + 10) * 1000); };
    ws.onmessage = async (ev) => {
      let m; try { m = JSON.parse(String(ev.data)); } catch (e) { return; }
      watch();
      const type = m.metadata && m.metadata.message_type;
      if (type === 'session_welcome') {
        keep = (m.payload.session.keepalive_timeout_seconds) || 30;
        try {
          await this.o.api.helix('POST', 'eventsub/subscriptions', null, { type: 'channel.channel_points_custom_reward_redemption.add', version: '1',
            condition: { broadcaster_user_id: this.o.api.userId }, transport: { method: 'websocket', session_id: m.payload.session.id } });
          this.status.points = 'connected';
        } catch (e) {
          this.status.points = 'error';
          this.status.pointsError = e.status === 403 ? 'Channel points need Affiliate or Partner (or log in again).' : e.message;
        }
        this.emit('change');
      } else if (type === 'session_reconnect') {
        const next = m.payload.session.reconnect_url;
        this.es = null; try { ws.close(); } catch (e) { /* closed */ }
        if (/^wss:\/\/eventsub\.wss\.twitch\.tv\//.test(next || '')) this.connectPoints(next); else this.retryPoints();
      } else if (type === 'notification') {
        const e = m.payload.event || {};
        const title = String((e.reward && e.reward.title) || '').trim().toLowerCase();
        const hit = this.cfg().points.map.find((x) => x.reward.trim().toLowerCase() === title);
        this.status.lastReward = { title: e.reward && e.reward.title, user: e.user_name, at: Date.now() };
        this.emit('change');
        if (hit) this.o.pressDeck(hit.button);
      }
    };
    ws.onclose = () => { if (this.es !== ws) return; this.es = null; this.retryPoints(); };
    ws.onerror = () => {};
  }
  retryPoints() { this.status.points = 'reconnecting'; this.emit('change'); clearTimeout(this.esTimer); this.esTimer = setTimeout(() => this.syncPoints(), 15000); }
  snapshot() { return this.status; }
}

module.exports = { Lab };
