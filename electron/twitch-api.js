/*
 * Optional Twitch account: Device Code Grant login (no client secret, no redirect: the user types a code
 * on twitch.tv/activate) and a small Helix client that refreshes the token on 401.
 * Public-client refresh tokens expire after 30 days of non-use: the user then simply logs in again.
 */
const { EventEmitter } = require('events');

const ID = 'https://id.twitch.tv/oauth2';
const HELIX = 'https://api.twitch.tv/helix';
// Followers and subs counters, raids, Stream Together (Guest Star) invites, sending chat messages.
const SCOPES = ['moderator:read:followers', 'channel:read:subscriptions', 'channel:manage:raids', 'channel:manage:guest_star', 'user:write:chat'];
const VALIDATE_MS = 60 * 60 * 1000; // Twitch asks apps to validate tokens hourly

class TwitchApi extends EventEmitter {
  /** opts: { getClientId(), getToken(), saveToken(tok|null), log, fetch } */
  constructor(opts) {
    super();
    this.o = opts;
    this.fetch = opts.fetch || ((...a) => globalThis.fetch(...a));
    this.status = 'off';
    this.detail = '';
    this.device = null; // { userCode, uri, expiresAt }
    this.pollTimer = null;
    this.validateTimer = null;
    this.refreshing = null;
  }

  get clientId() { return String(this.o.getClientId() || ''); }
  get token() { const t = this.o.getToken(); return t && t.clientId === this.clientId ? t : null; }
  get connected() { return this.status === 'connected' && !!this.token; }
  get userId() { return this.token ? this.token.userId : null; }
  get login() { return this.token ? this.token.login : null; }

  setStatus(s, detail) {
    if (this.status === s && this.detail === (detail || '')) return;
    this.status = s; this.detail = detail || '';
    if (this.o.log) this.o.log.info(`[twitch-api] ${s}${detail ? ' — ' + detail : ''}`);
    this.emit('status');
  }

  snapshot() {
    const tok = this.token;
    const missing = tok ? SCOPES.filter((s) => !(tok.scopes || []).includes(s)) : [];
    return {
      status: this.status, detail: this.detail, login: tok ? tok.login : null, hasClientId: !!this.clientId,
      userCode: this.device ? this.device.userCode : null, verificationUri: this.device ? this.device.uri : null, missingScopes: missing,
    };
  }

  // Called at boot and whenever the client ID setting changes.
  async start() {
    this.cancelLogin();
    clearInterval(this.validateTimer);
    if (!this.clientId) return this.setStatus('no-client');
    if (!this.token) return this.setStatus('off');
    try { await this.validate(); } catch (e) { /* status already set */ }
    this.validateTimer = setInterval(() => this.validate().catch(() => {}), VALIDATE_MS);
  }

  stop() { this.cancelLogin(); clearInterval(this.validateTimer); }

  async form(url, fields) {
    const res = await this.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });
    let json = {};
    try { json = await res.json(); } catch (e) { /* empty body */ }
    return { ok: res.ok, status: res.status, json };
  }

  // ---------- Device Code login ----------
  async beginLogin() {
    if (!this.clientId) throw new Error('No Twitch Client ID set');
    this.cancelLogin();
    const r = await this.form(`${ID}/device`, { client_id: this.clientId, scopes: SCOPES.join(' ') });
    if (!r.ok) throw new Error(r.json.message || `Twitch refused the login (${r.status})`);
    const { device_code: deviceCode, user_code: userCode, verification_uri: uri, interval, expires_in: expiresIn } = r.json;
    this.device = { deviceCode, userCode, uri, interval: Math.max(1, Number(interval) || 5), expiresAt: Date.now() + (Number(expiresIn) || 1800) * 1000 };
    this.setStatus('pending');
    this.schedulePoll();
    return { userCode, verificationUri: uri };
  }

  schedulePoll() {
    clearTimeout(this.pollTimer);
    if (!this.device) return;
    this.pollTimer = setTimeout(() => this.pollLogin().catch((e) => this.setStatus('error', e.message)), this.device.interval * 1000);
  }

  async pollLogin() {
    const d = this.device;
    if (!d) return;
    if (Date.now() > d.expiresAt) { this.device = null; return this.setStatus('off', 'Login code expired'); }
    const r = await this.form(`${ID}/token`, { client_id: this.clientId, scopes: SCOPES.join(' '), device_code: d.deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
    if (this.device !== d) return; // cancelled meanwhile
    if (!r.ok) {
      const msg = String(r.json.message || '');
      if (/authorization_pending/i.test(msg)) return this.schedulePoll();
      if (/slow_down/i.test(msg)) { d.interval += 5; return this.schedulePoll(); }
      this.device = null;
      return this.setStatus('off', /denied/i.test(msg) ? 'Login declined on Twitch' : /expired|invalid device/i.test(msg) ? 'Login code expired' : msg || 'Login failed');
    }
    this.device = null;
    this.saveTokens(r.json);
    await this.validate();
    clearInterval(this.validateTimer);
    this.validateTimer = setInterval(() => this.validate().catch(() => {}), VALIDATE_MS);
  }

  cancelLogin() {
    clearTimeout(this.pollTimer);
    if (!this.device) return;
    this.device = null;
    if (this.status === 'pending') this.setStatus(this.token ? 'connected' : 'off');
  }

  saveTokens(j, extra) {
    const prev = this.token || {};
    this.o.saveToken(Object.assign({}, prev, extra, {
      clientId: this.clientId,
      access_token: j.access_token,
      refresh_token: j.refresh_token || prev.refresh_token,
      expires_at: Date.now() + (Number(j.expires_in) || 3600) * 1000,
      scopes: Array.isArray(j.scope) ? j.scope : prev.scopes || [],
    }));
  }

  async logout() {
    this.cancelLogin();
    clearInterval(this.validateTimer);
    const tok = this.token;
    this.o.saveToken(null);
    this.setStatus(this.clientId ? 'off' : 'no-client');
    if (tok) this.form(`${ID}/revoke`, { client_id: this.clientId, token: tok.access_token }).catch(() => {});
  }

  // ---------- Token upkeep ----------
  async validate() {
    const tok = this.token;
    if (!tok) return this.setStatus(this.clientId ? 'off' : 'no-client');
    let res;
    try { res = await this.fetch(`${ID}/validate`, { headers: { Authorization: 'OAuth ' + tok.access_token } }); } catch (e) {
      // Offline: keep the account, just say so; the next hourly check (or any Helix call) retries.
      return this.setStatus('error', 'Twitch unreachable');
    }
    if (res.status === 401) {
      if (await this.refresh()) return this.validate();
      return;
    }
    if (!res.ok) return this.setStatus('error', `Twitch error ${res.status}`);
    const j = await res.json();
    this.o.saveToken(Object.assign({}, this.token, { login: j.login, userId: j.user_id, scopes: j.scopes || tok.scopes }));
    this.setStatus('connected', j.login);
  }

  // One refresh at a time; false = the account must log in again.
  refresh() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const tok = this.token;
      if (!tok || !tok.refresh_token) { this.o.saveToken(null); this.setStatus('off', 'Session expired, log in again'); return false; }
      let r;
      try { r = await this.form(`${ID}/token`, { client_id: this.clientId, grant_type: 'refresh_token', refresh_token: tok.refresh_token }); } catch (e) {
        this.setStatus('error', 'Twitch unreachable');
        return false;
      }
      if (!r.ok) { this.o.saveToken(null); this.setStatus('off', 'Session expired, log in again'); return false; }
      this.saveTokens(r.json);
      return true;
    })().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }

  // ---------- Helix ----------
  /** query: object; array values become repeated params (e.g. user_login=a&user_login=b). */
  async helix(method, path, query, body, retried) {
    const tok = this.token;
    if (!tok) throw Object.assign(new Error('Log in with Twitch first'), { status: 401 });
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query || {})) for (const x of [].concat(v)) if (x !== undefined && x !== null) qs.append(k, String(x));
    const url = `${HELIX}/${path}${qs.toString() ? '?' + qs : ''}`;
    const headers = { 'Client-Id': this.clientId, Authorization: 'Bearer ' + tok.access_token };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await this.fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 401 && !retried && (await this.refresh())) return this.helix(method, path, query, body, true);
    let json = {};
    try { json = res.status === 204 ? {} : await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) throw Object.assign(new Error(json.message || `Twitch error ${res.status}`), { status: res.status });
    return json;
  }
}

module.exports = { TwitchApi, SCOPES };
