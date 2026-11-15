/*
 * Minimal Discord local RPC client (IPC named pipe) for voice-channel data.
 * Requires a Discord application in which every user is the owner or an approved tester
 * (Developer Portal > App Testers, max 50) — rpc.voice.read is otherwise restricted.
 *
 * Auth: AUTHORIZE over RPC -> code -> token exchange.
 *   - Recommended: "Public Client" enabled on the app + PKCE (no secret shipped).
 *   - Fallback: client secret entered in the settings panel.
 */
const net = require('net');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };
const API = 'https://discord.com/api/v10';
const MAX_FRAME = 4 * 1024 * 1024;
const CHANNEL_EVENTS = ['VOICE_STATE_CREATE', 'VOICE_STATE_UPDATE', 'VOICE_STATE_DELETE', 'SPEAKING_START', 'SPEAKING_STOP'];

function pipePath(i) {
  if (process.platform === 'win32') return `\\\\?\\pipe\\discord-ipc-${i}`;
  const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || '/tmp';
  return `${base.replace(/\/$/, '')}/discord-ipc-${i}`;
}

function encode(op, data) {
  const json = Buffer.from(JSON.stringify(data), 'utf8');
  const header = Buffer.alloc(8);
  header.writeInt32LE(op, 0);
  header.writeInt32LE(json.length, 4);
  return Buffer.concat([header, json]);
}

class DiscordVoiceRPC extends EventEmitter {
  /**
   * @param {object} o { clientId, clientSecret?, redirectUri, getToken(), saveToken(tok) }
   */
  constructor(o) {
    super();
    this.o = o;
    this.sock = null;
    this.buf = Buffer.alloc(0);
    this.pending = new Map();
    this.status = 'disconnected';
    this.channel = null;          // {id, name, guild_id}
    this.members = new Map();     // userId -> member
    this.me = null;
    this.stopped = false;
    this.retryTimer = null;
  }

  setStatus(s, detail) { this.status = s; this.statusDetail = detail || ''; this.emit('status', s, detail); }

  start() { this.stopped = false; this.halted = false; this._connect(0); }
  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    if (this.sock) this.sock.destroy();
    this.sock = null;
  }
  restart() {
    this.stop();
    this.members.clear(); this.channel = null; this.emit('channel');
    this.retryTimer = setTimeout(() => this.start(), 300); // cleared by stop() if the client is replaced meanwhile
  }

  _retry(ms) {
    if (this.stopped) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this._connect(0), ms || 5000);
  }

  _connect(i) {
    if (this.stopped) return;
    if (!this.o.clientId) { this.setStatus('setup required', 'Enter your Discord Application ID in Setup.'); return; }
    if (i > 9) { this.setStatus('Discord not found', 'Start the Discord desktop app (the browser version is not supported).'); return this._retry(5000); }
    const sock = net.createConnection(pipePath(i));
    let opened = false;
    sock.once('connect', () => {
      opened = true;
      this.sock = sock; this.buf = Buffer.alloc(0);
      this.setStatus('connecting');
      sock.write(encode(OP.HANDSHAKE, { v: 1, client_id: this.o.clientId }));
    });
    sock.on('data', (d) => this._onData(d));
    sock.on('error', () => { if (!opened) this._connect(i + 1); });
    sock.on('close', () => {
      if (!opened) return;
      if (this.sock === sock) this.sock = null;
      for (const p of this.pending.values()) p.reject(new Error('RPC closed'));
      this.pending.clear();
      this.members.clear(); this.channel = null; this.emit('channel');
      // After an auth failure we stop here: retrying would spam the Discord popup. The user clicks Reconnect.
      if (this.halted) return;
      this.setStatus('disconnected', 'Discord closed or connection lost — retrying…');
      this._retry(5000);
    });
  }

  _onData(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.buf.length >= 8) {
      const op = this.buf.readInt32LE(0), len = this.buf.readInt32LE(4);
      if (len < 0 || len > MAX_FRAME) { this.emit('warn', new Error('Invalid RPC frame')); this._drop(); return; }
      if (this.buf.length < 8 + len) break;
      let payload;
      try { payload = JSON.parse(this.buf.subarray(8, 8 + len).toString('utf8')); } catch (e) { payload = null; }
      this.buf = this.buf.subarray(8 + len);
      if (!payload) continue;
      if (op === OP.PING) { this._write(OP.PONG, payload); continue; }
      if (op === OP.CLOSE) { this.setStatus('refused', payload.message || 'Discord closed the connection'); this._drop(); return; }
      try { this._onFrame(payload); } catch (e) { this.emit('warn', e); }
    }
  }

  _write(op, data) { if (this.sock && !this.sock.destroyed) this.sock.write(encode(op, data)); }
  _drop() { this.buf = Buffer.alloc(0); if (this.sock) this.sock.destroy(); }

  _onFrame(msg) {
    if (msg.cmd === 'DISPATCH') {
      if (msg.evt === 'READY') { this.me = msg.data.user; this._auth().catch((e) => this._authFailed(e)); }
      else this._onEvent(msg.evt, msg.data);
      return;
    }
    const p = this.pending.get(msg.nonce);
    if (!p) return;
    this.pending.delete(msg.nonce);
    if (msg.evt === 'ERROR') p.reject(Object.assign(new Error(msg.data && msg.data.message), { code: msg.data && msg.data.code }));
    else p.resolve(msg.data);
  }

  request(cmd, args, evt, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (!this.sock) return reject(new Error('RPC not connected'));
      const nonce = crypto.randomUUID();
      const timer = setTimeout(() => { if (this.pending.delete(nonce)) reject(new Error('Timed out: ' + cmd)); }, timeoutMs || 15000);
      this.pending.set(nonce, { resolve: (d) => { clearTimeout(timer); resolve(d); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      const frame = { cmd, args: args || {}, nonce };
      if (evt) frame.evt = evt;
      this._write(OP.FRAME, frame);
    });
  }

  // ---------- OAuth ----------
  async _tokenRequest(params) {
    const body = new URLSearchParams(Object.assign({ client_id: this.o.clientId }, params));
    if (this.o.clientSecret) body.set('client_secret', this.o.clientSecret);
    const res = await fetch(API + '/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15000) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('Token exchange refused: ' + (json.error_description || json.error || res.status));
    const tok = { access_token: json.access_token, refresh_token: json.refresh_token, expires_at: Date.now() + (json.expires_in || 0) * 1000 };
    this.o.saveToken(tok);
    return tok;
  }

  async _auth(retried) {
    let tok = this.o.getToken();
    const stored = !!(tok && tok.access_token);
    if (tok && tok.refresh_token && tok.expires_at < Date.now() + 60_000) {
      try { tok = await this._tokenRequest({ grant_type: 'refresh_token', refresh_token: tok.refresh_token }); } catch (e) { tok = null; }
    }
    if (!tok || !tok.access_token) {
      this.setStatus('authorizing', 'Click “Authorize” in the Discord popup.');
      const verifier = crypto.randomBytes(48).toString('base64url');
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      const args = { client_id: this.o.clientId, scopes: ['rpc', 'rpc.voice.read', 'identify'] };
      if (!this.o.clientSecret) { args.code_challenge = challenge; args.code_challenge_method = 'S256'; }
      const { code } = await this.request('AUTHORIZE', args, null, 120000);
      const params = { grant_type: 'authorization_code', code, redirect_uri: this.o.redirectUri || 'http://localhost' };
      if (!this.o.clientSecret) params.code_verifier = verifier;
      tok = await this._tokenRequest(params);
    }
    try {
      const auth = await this.request('AUTHENTICATE', { access_token: tok.access_token });
      this.me = auth.user || this.me;
    } catch (e) {
      this.o.saveToken(null); // stale token: forget it and authorize again once
      if (stored && !retried) return this._auth(true);
      throw e;
    }
    this.setStatus('connected');
    await this.request('SUBSCRIBE', {}, 'VOICE_CHANNEL_SELECT');
    const ch = await this.request('GET_SELECTED_VOICE_CHANNEL', {});
    await this._setChannel(ch);
  }

  _authFailed(e) {
    const msg = String(e && e.message || e);
    let hint = msg;
    if (/not.*tester|4000|Not authenticated|Invalid client/i.test(msg)) hint = msg + ' — make sure your account is an accepted App Tester of the Discord application.';
    if (/cancel|5000|denied/i.test(msg)) hint = 'Authorization was declined in Discord.';
    this.halted = true;
    this.setStatus('error', hint);
    this.emit('error', e);
    if (this.sock) this.sock.destroy();
  }

  // ---------- Voice channel tracking ----------
  async _setChannel(ch) {
    const prev = this.channel;
    if (prev) for (const evt of CHANNEL_EVENTS) this.request('UNSUBSCRIBE', { channel_id: prev.id }, evt).catch(() => {});
    this.members.clear();
    this.channel = ch && ch.id ? { id: ch.id, name: ch.name, guild_id: ch.guild_id } : null;
    if (this.channel) (ch.voice_states || []).forEach((vs) => this._upsert(vs));
    this.emit('channel');
    if (this.channel) {
      const id = this.channel.id;
      for (const evt of CHANNEL_EVENTS) await this.request('SUBSCRIBE', { channel_id: id }, evt).catch((e) => this.emit('warn', e));
    }
  }

  _upsert(vs) {
    const u = (vs && vs.user) || {};
    if (!u.id) return;
    const st = vs.voice_state || {};
    const old = this.members.get(u.id) || {};
    this.members.set(u.id, {
      id: u.id,
      name: vs.nick || u.global_name || u.username || 'Unknown',
      avatarHash: u.avatar || null,
      mute: !!(st.mute || st.self_mute || st.suppress),
      deaf: !!(st.deaf || st.self_deaf),
      speaking: old.speaking || false,
      self: this.me && u.id === this.me.id,
    });
  }

  _onEvent(evt, data) {
    switch (evt) {
      case 'VOICE_CHANNEL_SELECT': {
        // Quick channel hops: only the latest selection wins.
        const seq = (this.selectSeq = (this.selectSeq || 0) + 1);
        if (!data || !data.channel_id) { this._setChannel(null); break; }
        this.request('GET_CHANNEL', { channel_id: data.channel_id })
          .then((ch) => { if (seq === this.selectSeq) return this._setChannel(ch); })
          .catch((e) => this.emit('warn', e));
        break;
      }
      case 'VOICE_STATE_CREATE':
      case 'VOICE_STATE_UPDATE':
        this._upsert(data); this.emit('channel'); break;
      case 'VOICE_STATE_DELETE':
        this.members.delete(data.user && data.user.id); this.emit('channel'); break;
      case 'SPEAKING_START':
      case 'SPEAKING_STOP': {
        const m = this.members.get(data.user_id);
        const speaking = evt === 'SPEAKING_START';
        if (m) m.speaking = speaking;
        this.emit('speaking', data.user_id, speaking);
        break;
      }
      default:
    }
  }

  snapshot() {
    return {
      status: this.status, detail: this.statusDetail || '',
      me: this.me ? { id: this.me.id, name: this.me.global_name || this.me.username } : null,
      channel: this.channel,
      members: [...this.members.values()],
    };
  }
}

module.exports = { DiscordVoiceRPC };
