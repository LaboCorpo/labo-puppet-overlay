/*
 * Read-only Twitch chat client (anonymous IRC over WebSocket) + chat commands.
 * Runs in the main process so commands are handled once and viewer customisations persist,
 * whatever number of overlays (desktop window, OBS sources) are open.
 */
const { EventEmitter } = require('events');

// Part lists come from the shared avatar format so chat commands always match what the creator offers.
const { Puppet } = require('./avatars');

const OPT = Puppet.OPTIONS;
const COLOR_NAMES = Puppet.COLOR_NAMES;
const list = (k) => OPT[k];
const MAX_TEXT = 500;
const STALE_MS = 6 * 60 * 1000; // Twitch pings every ~5 min: silence longer than this means a dead socket

// Command catalogue. kind 'action' = animation, 'style' = persistent customisation.
const COMMANDS = {
  jump: { kind: 'action', help: 'jump' },
  dance: { kind: 'action', help: 'dance for a few seconds' },
  wave: { kind: 'action', help: 'wave hello' },
  hat: { kind: 'style', key: 'hat', values: list('hat') },
  hair: { kind: 'style', key: 'hair', values: list('hair') },
  outfit: { kind: 'style', key: 'outfit', values: list('outfit') },
  eyes: { kind: 'style', key: 'eyes', values: list('eyes') },
  glasses: { kind: 'style', key: 'glasses', values: list('glasses') },
  item: { kind: 'style', key: 'held', values: list('held') },
  neck: { kind: 'style', key: 'neckwear', values: list('neckwear') },
  pattern: { kind: 'style', key: 'pattern', values: list('pattern') },
  color: { kind: 'style', help: 'color <name or #hex>', key: 'clothColor', color: true },
  hatcolor: { kind: 'style', help: 'hatcolor <name or #hex>', key: 'hatColor', color: true },
  reroll: { kind: 'style', help: 'get a brand new random look' },
  reset: { kind: 'style', help: 'back to your original look' },
  puppet: { kind: 'help', help: 'list commands' },
};
for (const [name, def] of Object.entries(COMMANDS)) if (def.values) def.help = name + ' <' + def.values.join('|') + '>';

function unescapeTag(v) { return String(v || '').replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\'); }
function parseTags(raw) {
  const tags = {};
  (raw || '').split(';').forEach((kv) => { const i = kv.indexOf('='); if (i > 0) tags[kv.slice(0, i)] = unescapeTag(kv.slice(i + 1)); });
  return tags;
}
function parseColor(arg) {
  if (!arg) return null;
  const a = arg.toLowerCase();
  if (COLOR_NAMES[a]) return COLOR_NAMES[a];
  if (/^#[0-9a-f]{6}$/.test(a)) return a;
  if (/^#[0-9a-f]{3}$/.test(a)) return '#' + a.slice(1).split('').map((c) => c + c).join('');
  return null;
}

// Sender fields shared by every event, capped so a crafted tag cannot bloat the overlay.
function viewer(login, tags) {
  const color = /^#[0-9a-f]{6}$/i.test(tags.color || '') ? tags.color : null;
  return { login, display: String(tags['display-name'] || login).slice(0, 40), color };
}

class TwitchChat extends EventEmitter {
  /** opts: { getSettings(), setOverride(login, patch|null) } */
  constructor(opts) {
    super();
    this.o = opts;
    this.ws = null;
    this.channel = '';
    this.status = 'off';
    this.cooldowns = new Map(); // login|cmd -> until (ms)
    this.retryMs = 2000;
    this.timer = null;
    this.watchdog = null;
    this.lastRx = 0;
  }

  setStatus(s, detail) { this.status = s; this.detail = detail || ''; this.emit('status'); }

  // Called whenever settings change; (re)connects only when the channel actually changed.
  sync() {
    const cfg = this.o.getSettings();
    const want = cfg.enabled && cfg.channel ? String(cfg.channel).toLowerCase().replace(/^#/, '').replace(/^https?:\/\/(www\.)?twitch\.tv\//, '').trim() : '';
    if (want === this.channel && (this.ws || !want)) return;
    this.channel = want;
    this.close();
    if (!want) return this.setStatus('off');
    if (!/^[a-z0-9_]{3,25}$/.test(want)) return this.setStatus('error', 'Invalid channel name');
    this.open();
  }

  close() {
    clearTimeout(this.timer);
    clearInterval(this.watchdog);
    this.watchdog = null;
    if (this.ws) { const w = this.ws; this.ws = null; try { w.close(); } catch (e) {} }
  }

  open() {
    const chan = this.channel;
    this.setStatus('connecting');
    let ws;
    try { ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443'); } catch (e) { return this.retry(); }
    this.ws = ws;
    this.lastRx = Date.now();
    this.watchdog = setInterval(() => {
      if (Date.now() - this.lastRx < STALE_MS) return;
      this.close();
      this.setStatus('reconnecting', 'Connection lost');
      this.retry();
    }, 60000);
    ws.onopen = () => {
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      ws.send('PASS SCHMOOPIIE');
      ws.send('NICK justinfan' + Math.floor(10000 + Math.random() * 80000));
      ws.send('JOIN #' + chan);
    };
    ws.onmessage = (ev) => {
      this.lastRx = Date.now();
      for (const l of String(ev.data).split('\r\n')) {
        try { this.handle(l); } catch (e) { /* one malformed line must not drop the connection */ }
      }
    };
    ws.onclose = () => { if (this.ws === ws) { this.ws = null; this.setStatus('reconnecting', 'Connection lost'); this.retry(); } };
    ws.onerror = () => {};
  }

  retry() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { if (this.channel && !this.ws) this.open(); }, this.retryMs);
    this.retryMs = Math.min(30000, this.retryMs * 2);
  }

  handle(line) {
    if (!line) return;
    if (line.startsWith('PING')) { this.ws && this.ws.send('PONG :tmi.twitch.tv'); return; }
    const m = line.match(/^(?:@(\S+) )?:(\S+?)(?:!\S+)? (\w+)(?: #(\S+))?(?: :(.*))?$/);
    if (!m) return;
    const [, rawTags, prefix, cmd, , trailing] = m;
    const tags = parseTags(rawTags);
    switch (cmd) {
      case 'ROOMSTATE': this.retryMs = 2000; this.setStatus('connected', '#' + this.channel); break;
      case 'NOTICE': if (/msg_channel_suspended|does not exist/i.test(tags['msg-id'] || trailing || '')) this.setStatus('error', trailing); break;
      case 'RECONNECT': this.close(); this.open(); break;
      case 'PRIVMSG': this.onPrivmsg(prefix, tags, trailing || ''); break;
      case 'USERNOTICE': this.onUsernotice(tags, trailing || ''); break;
      default:
    }
  }

  ignored(login) {
    const list = String(this.o.getSettings().ignore || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
    return list.includes(login);
  }

  onPrivmsg(login, tags, text) {
    if (this.ignored(login)) return;
    if (text.startsWith('\u0001ACTION ')) text = text.slice(8, -1);
    text = text.slice(0, MAX_TEXT);
    const base = viewer(login, tags);
    if (tags.bits) this.emit('event', Object.assign({ type: 'bits', amount: Number(tags.bits) || 0 }, base));
    const cfg = this.o.getSettings();
    const prefix = cfg.commandPrefix || '!';
    if (cfg.commandsEnabled !== false && text.startsWith(prefix)) {
      const handled = this.onCommand(base, text.slice(prefix.length).trim());
      if (handled && cfg.hideCommands !== false) { this.emit('chat', Object.assign({ text: null }, base)); return; }
    }
    this.emit('chat', Object.assign({ text }, base));
  }

  // Returns true when the message was a recognised command.
  onCommand(base, body) {
    const [nameRaw, ...rest] = body.split(/\s+/);
    const name = (nameRaw || '').toLowerCase();
    const arg = (rest[0] || '').toLowerCase();
    const def = COMMANDS[name];
    const cfg = this.o.getSettings();
    if (!def) return false;
    const disabled = (cfg.disabledCommands || []).map((x) => String(x).toLowerCase());
    if (disabled.includes(name)) return false;
    const now = Date.now();
    const cdKey = base.login + '|' + (def.kind === 'action' ? 'action' : name);
    const cd = (def.kind === 'action' ? cfg.actionCooldown : cfg.styleCooldown) ?? (def.kind === 'action' ? 5 : 10);
    if ((this.cooldowns.get(cdKey) || 0) > now) return true;
    this.cooldowns.set(cdKey, now + cd * 1000);
    if (this.cooldowns.size > 5000) for (const [k, until] of this.cooldowns) if (until <= now) this.cooldowns.delete(k);

    if (def.kind === 'help') {
      const p = cfg.commandPrefix || '!';
      const list = Object.keys(COMMANDS).filter((k) => k !== 'puppet' && !disabled.includes(k)).map((k) => p + k).join(' ');
      this.emit('chat', Object.assign({ text: list, system: true }, base));
      return true;
    }
    if (def.kind === 'action') { this.emit('event', Object.assign({ type: 'action', action: name }, base)); return true; }
    if (name === 'reset') { this.o.setOverride(base.login, null); this.emit('event', Object.assign({ type: 'restyle' }, base)); return true; }
    if (name === 'reroll') { this.o.setOverride(base.login, { seed: base.login + ':' + Math.random().toString(36).slice(2, 8) }); this.emit('event', Object.assign({ type: 'restyle' }, base)); return true; }
    let value = null;
    if (def.color) value = parseColor(arg);
    else if (def.values && def.values.includes(arg)) value = arg;
    else if (def.values && arg === 'off') value = 'none';
    if (!value) { this.emit('chat', Object.assign({ text: (cfg.commandPrefix || '!') + def.help, system: true }, base)); return true; }
    this.o.setOverride(base.login, { [def.key]: value });
    this.emit('event', Object.assign({ type: 'restyle' }, base));
    return true;
  }

  onUsernotice(tags, text) {
    const id = tags['msg-id'];
    const base = viewer(String(tags.login || '').toLowerCase(), tags);
    const sys = String(tags['system-msg'] || '').slice(0, MAX_TEXT);
    if (id === 'raid') {
      this.emit('event', Object.assign({ type: 'raid', count: Math.max(1, Number(tags['msg-param-viewerCount']) || 1), text: sys }, base));
    } else if (/^(sub|resub|subgift|submysterygift|giftpaidupgrade|primepaidupgrade|anongiftpaidupgrade)$/.test(id)) {
      this.emit('event', Object.assign({ type: 'sub', text: String(text || sys).slice(0, MAX_TEXT) }, base));
    }
  }

  // Lets the panel test the pipeline without a live channel.
  simulate(kind) {
    const names = ['pixelcat', 'Bobby_42', 'MamieGaming', 'kiwi', 'ZeroCool', 'tartiflette', 'Noodle', 'captain_obvious'];
    const n = names[Math.floor(Math.random() * names.length)];
    const base = { login: n.toLowerCase(), display: n, color: null };
    if (kind === 'raid') return this.emit('event', Object.assign({ type: 'raid', count: 12, text: n + ' is raiding with 12 viewers!' }, base));
    if (kind === 'sub') return this.emit('event', Object.assign({ type: 'sub', text: 'Thanks for the sub!' }, base));
    if (kind === 'bits') return this.emit('event', Object.assign({ type: 'bits', amount: 100 }, base));
    if (kind === 'command') {
      const c = ['jump', 'dance', 'wave', 'hat crown', 'color pink', 'hair afro'][Math.floor(Math.random() * 6)];
      return this.onPrivmsg(base.login, { 'display-name': n }, (this.o.getSettings().commandPrefix || '!') + c);
    }
    const msgs = ['hi everyone!', 'GG', 'the head flap is killing me 😂', 'first', 'what are we playing tonight?', 'lol', 'more please!!'];
    this.onPrivmsg(base.login, { 'display-name': n }, msgs[Math.floor(Math.random() * msgs.length)]);
  }

  snapshot() { return { status: this.status, detail: this.detail || '', channel: this.channel }; }
}

module.exports = { TwitchChat, COMMANDS };
