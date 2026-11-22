/*
 * Local HTTP server: serves web/ (overlay, panel, creator), a small JSON API and Server-Sent Events.
 * OBS/Streamlabs use http://localhost:<port>/overlay.html as a Browser Source. Bound to 127.0.0.1 only.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { cleanAvatar } = require('./avatars');
const { SOUND_FILE_RE } = require('./settings');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };
const MAX_SOUND = 20 * 1024 * 1024;

// Alert sounds are stored under a random name; the content must really be MP3, WAV or Ogg.
function soundType(buf) {
  if (buf.length < 12) return null;
  if (buf.slice(0, 3).toString('latin1') === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'mp3';
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WAVE') return 'wav';
  if (buf.slice(0, 4).toString('latin1') === 'OggS') return 'ogg';
  return null;
}
const LOCAL_HOST = /^(localhost|127\.0\.0\.1)(:\d+)?$/;
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const MAX_CLIENTS = 32;

/**
 * store: Store; getState(): runtime state merged into every 'state' event;
 * onSettings(patch); onAction(name, body) -> optional result object; onAvatarsChanged()
 */
function createServer({ webDir, soundsDir, store, getState, onSettings, onAction, onAvatarsChanged }) {
  const root = path.resolve(webDir);
  const clients = new Set();

  // Avatars (photos can be large) and viewer looks are only sent when they changed;
  // the per-viewer 'viewer' event keeps pages up to date in between.
  function statePayload(full) {
    const s = Object.assign({ settings: store.settings }, getState());
    if (full) { s.avatars = store.allAvatars(); s.viewers = store.data.viewers; }
    return s;
  }
  function send(res, event, json) {
    try { res.write(`event: ${event}\ndata: ${json}\n\n`); } catch (e) { clients.delete(res); }
  }
  function broadcast(event, data) {
    if (!clients.size) return;
    const json = JSON.stringify(data);
    for (const res of clients) send(res, event, json);
  }
  // Coalesce bursts of changes into one push.
  let stateTimer = null, avatarsDirty = false;
  function pushState(opts) {
    if (opts && opts.avatars) avatarsDirty = true;
    if (stateTimer) return;
    stateTimer = setTimeout(() => {
      stateTimer = null;
      const s = statePayload(false);
      if (avatarsDirty) s.avatars = store.allAvatars();
      avatarsDirty = false;
      broadcast('state', s);
    }, 30);
  }

  function readBody(req, limit) {
    return new Promise((resolve, reject) => {
      let size = 0, tooBig = false; const chunks = [];
      req.on('data', (c) => {
        if (tooBig) return; // drain and discard, so the 413 response still reaches the client
        size += c.length;
        if (size > limit) { tooBig = true; chunks.length = 0; reject(Object.assign(new Error('Payload too large'), { status: 413 })); } else chunks.push(c);
      });
      req.on('end', () => {
        if (tooBig) return;
        try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(new Error('Invalid JSON')); }
      });
      req.on('error', reject);
    });
  }
  function readRaw(req, limit) {
    return new Promise((resolve, reject) => {
      let size = 0, tooBig = false; const chunks = [];
      req.on('data', (c) => {
        if (tooBig) return;
        size += c.length;
        if (size > limit) { tooBig = true; chunks.length = 0; reject(Object.assign(new Error('File too large (max 20 MB)'), { status: 413 })); } else chunks.push(c);
      });
      req.on('end', () => { if (!tooBig) resolve(Buffer.concat(chunks)); });
      req.on('error', reject);
    });
  }
  function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }

  function openEvents(req, res) {
    if (clients.size >= MAX_CLIENTS) return json(res, 503, { ok: false, error: 'Too many connections' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    send(res, 'state', JSON.stringify(statePayload(true)));
    clients.add(res);
    const ka = setInterval(() => { try { res.write(': ka\n\n'); } catch (e) { clients.delete(res); } }, 20000);
    req.on('close', () => { clients.delete(res); clearInterval(ka); });
  }

  function serveStatic(p, res) {
    let rel;
    try { rel = decodeURIComponent(p === '/' ? '/panel.html' : p); } catch (e) { res.writeHead(400); return res.end(); }
    const file = path.resolve(root, '.' + rel);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(data);
    });
  }

  function serveSound(name, res) {
    if (!SOUND_FILE_RE.test(name)) { res.writeHead(404); return res.end(); }
    fs.readFile(path.join(soundsDir, name), (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(name)], 'Content-Length': data.length, 'Cache-Control': 'max-age=86400', 'X-Content-Type-Options': 'nosniff' });
      res.end(data);
    });
  }

  const server = http.createServer(async (req, res) => {
    // Host check blocks DNS-rebinding pages from reading the API through a hostname they control.
    if (!LOCAL_HOST.test(req.headers.host || '')) { res.writeHead(421); return res.end(); }
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch (e) { res.writeHead(400); return res.end(); }
    const p = url.pathname;
    const m = req.method;
    try {
      if (!p.startsWith('/api/')) {
        if (m !== 'GET' && m !== 'HEAD') { res.writeHead(405); return res.end(); }
        if (p.startsWith('/sounds/') && soundsDir) return serveSound(p.slice(8), res);
        return serveStatic(p, res);
      }
      // Mutations only from pages served here (or non-browser clients): other websites can't poke the API.
      if (m !== 'GET' && req.headers.origin && !LOCAL_ORIGIN.test(req.headers.origin)) return json(res, 403, { ok: false, error: 'Forbidden' });
      if (p === '/api/events' && m === 'GET') return openEvents(req, res);
      if (p === '/api/state' && m === 'GET') return json(res, 200, statePayload(true));
      if (p === '/api/settings' && m === 'POST') {
        const body = await readBody(req, 200_000);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected an object');
        onSettings(body);
        return json(res, 200, { ok: true });
      }
      if (p === '/api/avatars' && m === 'POST') {
        const body = await readBody(req, 4_000_000);
        const list = (Array.isArray(body) ? body : [body]).slice(0, 100).map(cleanAvatar);
        list.forEach((a) => store.setAvatar(a));
        if (onAvatarsChanged) onAvatarsChanged();
        return json(res, 200, { ok: true, count: list.length });
      }
      if (p.startsWith('/api/avatars/') && m === 'DELETE') {
        store.deleteAvatar(decodeURIComponent(p.slice('/api/avatars/'.length)));
        if (onAvatarsChanged) onAvatarsChanged();
        return json(res, 200, { ok: true });
      }
      if (p === '/api/sounds' && m === 'POST' && soundsDir) {
        const buf = await readRaw(req, MAX_SOUND);
        const type = soundType(buf);
        if (!type) throw new Error('Not an MP3, WAV or Ogg file');
        const file = crypto.randomBytes(8).toString('hex') + '.' + type;
        await fs.promises.mkdir(soundsDir, { recursive: true });
        await fs.promises.writeFile(path.join(soundsDir, file), buf);
        const name = String(url.searchParams.get('name') || file).slice(0, 80);
        return json(res, 200, { ok: true, file, name });
      }
      if (p.startsWith('/api/sounds/') && m === 'DELETE' && soundsDir) {
        const file = decodeURIComponent(p.slice('/api/sounds/'.length));
        if (!SOUND_FILE_RE.test(file)) throw new Error('Invalid file name');
        await fs.promises.unlink(path.join(soundsDir, file)).catch(() => {});
        return json(res, 200, { ok: true });
      }
      if (p === '/api/action' && m === 'POST') {
        const b = await readBody(req, 10_000);
        if (!b || typeof b.name !== 'string') throw new Error('Missing action name');
        const r = await onAction(b.name, b);
        return json(res, 200, Object.assign({ ok: true }, r || {}));
      }
      return json(res, 404, { ok: false, error: 'Not found' });
    } catch (e) {
      if (!res.headersSent) json(res, e.status || 400, { ok: false, error: e.message });
    }
  });

  function close() {
    for (const res of clients) { try { res.end(); } catch (e) { /* already closed */ } }
    clients.clear();
    server.close();
  }

  return { server, broadcast, pushState, close };
}

module.exports = { createServer, soundType };
