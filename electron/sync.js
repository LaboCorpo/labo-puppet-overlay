/*
 * Read-only avatar sync: a shared file (GitHub Gist or any raw URL) that every app re-reads periodically.
 * Accepted contents: {"avatars":[...]}, a JSON array, a single .puppet file, or plain text with one PUP1 code per line.
 */
const { EventEmitter } = require('events');
const { Puppet, cleanAvatar } = require('./avatars');

const MAX_BYTES = 5_000_000;
const MAX_AVATARS = 500;

// A gist page URL is converted to its raw URL; anything else is used as is.
function rawSyncUrl(url) {
  const u = String(url).trim();
  const m = u.match(/^https:\/\/gist\.github\.com\/([^/]+)\/([0-9a-f]+)\/?$/i);
  return m ? `https://gist.githubusercontent.com/${m[1]}/${m[2]}/raw` : u;
}

function parseSyncFile(text) {
  const raw = [];
  let json;
  try { json = JSON.parse(text); } catch (e) { json = undefined; }
  if (json && typeof json === 'object') {
    const list = Array.isArray(json) ? json : Array.isArray(json.avatars) ? json.avatars : json.avatar ? [json.avatar] : Object.values(json.avatars || json);
    for (const it of list) raw.push(it && it.avatar ? it.avatar : it);
  } else {
    for (const line of String(text).split(/\r?\n/)) {
      const code = (line.match(/PUP1\.[A-Za-z0-9_-]+/) || [])[0];
      if (code) try { raw.push(Puppet.decodeAny(code)); } catch (e) { /* skip bad line */ }
    }
  }
  const out = [];
  for (const r of raw.slice(0, MAX_AVATARS)) { try { out.push(cleanAvatar(r)); } catch (e) { /* skip invalid entry */ } }
  return out;
}

class AvatarSync extends EventEmitter {
  /** opts: { getSettings() -> {url, intervalSec}, onAvatars(map), log } */
  constructor(opts) {
    super();
    this.o = opts;
    this.timer = null;
    this.status = { status: 'off' };
    this.running = null;
  }

  setStatus(s) { this.status = s; this.emit('status', s); }

  schedule() {
    clearInterval(this.timer);
    this.timer = null;
    const s = this.o.getSettings();
    if (!s.url) { this.setStatus({ status: 'off' }); return; }
    this.now();
    this.timer = setInterval(() => this.now(), Math.max(30, s.intervalSec || 120) * 1000);
  }

  stop() { clearInterval(this.timer); this.timer = null; }

  // One fetch at a time: overlapping calls share the running request.
  now() {
    if (!this.running) this.running = this.fetchOnce().finally(() => { this.running = null; });
    return this.running;
  }

  async fetchOnce() {
    const s = this.o.getSettings();
    if (!s.url) { this.setStatus({ status: 'off' }); return; }
    try {
      const url = rawSyncUrl(s.url);
      const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      if (text.length > MAX_BYTES) throw new Error('File too large');
      const list = parseSyncFile(text);
      const map = {};
      for (const a of list) map[a.id] = a;
      this.o.onAvatars(map);
      this.setStatus({ status: 'ok', count: list.length, at: Date.now() });
    } catch (e) {
      if (this.o.log) this.o.log.warn('[sync] ' + e.message);
      this.setStatus({ status: 'error', error: e.message, at: Date.now() });
    }
  }
}

module.exports = { AvatarSync, parseSyncFile, rawSyncUrl };
