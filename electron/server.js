/*
 * Local HTTP server: serves web/ (overlay, panel, creator), a small JSON API and Server-Sent Events.
 * OBS/Streamlabs use http://localhost:<port>/overlay.html as a Browser Source. Bound to 127.0.0.1 only.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { cleanAvatar } = require('./avatars');
const { SOUND_FILE_RE, MEDIA_RE } = require('./settings');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
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
// Background pictures for La savane: PNG, JPEG, WebP or GIF (checked by their first bytes).
function imageType(b) {
  if (b.length > 8 && b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return 'png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (b.length > 6 && b.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  return null;
}
const BG_RE = /^[a-f0-9]{16}\.(png|jpg|webp|gif)$/;
const BG_TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

// "Son Twitch" folder: a file name (no folder parts) that stays inside the folder.
function mediaPath(dir, name) {
  if (!dir || !MEDIA_RE.test(name)) return null;
  const f = path.resolve(dir, name);
  return path.dirname(f) === path.resolve(dir) ? f : null;
}
// A name the user will recognise in the folder, made safe for Windows, and not taken yet.
function freeMediaName(dir, wanted, ext) {
  let stem = String(wanted || 'son').replace(/\.[^.]*$/, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[. ]+/, '').slice(0, 80) || 'son';
  let name = `${stem}.${ext}`, i = 2;
  while (fs.existsSync(path.join(dir, name))) name = `${stem} (${i++}).${ext}`;
  return name;
}

/** getMediaDir(): the "Son Twitch" folder (sounds and pictures the user drops in, alert GIFs). */
function createServer({ webDir, soundsDir, coversDir, bgDir, getMediaDir, store, getState, onSettings, onAction, onAvatarsChanged }) {
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

  // Album covers read from the Windows media session (see nowplaying.js).
  function serveCover(name, res) {
    if (!/^[a-f0-9]{12}\.(jpg|png)$/.test(name)) { res.writeHead(404); return res.end(); }
    fs.readFile(path.join(coversDir, name), (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': name.endsWith('.png') ? 'image/png' : 'image/jpeg', 'Content-Length': data.length, 'Cache-Control': 'max-age=86400', 'X-Content-Type-Options': 'nosniff' });
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
        if (p.startsWith('/covers/') && coversDir) return serveCover(p.slice(8), res);
        if (p.startsWith('/media/') && getMediaDir) {
          let name;
          try { name = decodeURIComponent(p.slice(7)); } catch (e) { res.writeHead(400); return res.end(); }
          const f = mediaPath(getMediaDir(), name);
          if (!f) { res.writeHead(404); return res.end(); }
          return fs.readFile(f, (err, data) => {
            if (err) { res.writeHead(404); return res.end('Not found'); }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
            res.end(data);
          });
        }
        if (p.startsWith('/backgrounds/') && bgDir) {
          const name = p.slice(13);
          if (!BG_RE.test(name)) { res.writeHead(404); return res.end(); }
          return fs.readFile(path.join(bgDir, name), (err, data) => {
            if (err) { res.writeHead(404); return res.end('Not found'); }
            res.writeHead(200, { 'Content-Type': BG_TYPES[name.split('.')[1]], 'Content-Length': data.length, 'Cache-Control': 'max-age=86400', 'X-Content-Type-Options': 'nosniff' });
            res.end(data);
          });
        }
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
      if (p === '/api/backgrounds' && m === 'POST' && bgDir) {
        const buf = await readRaw(req, 8 * 1024 * 1024);
        const type = imageType(buf);
        if (!type) throw new Error('Not a PNG, JPEG, WebP or GIF picture');
        const file = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) + '.' + type;
        await fs.promises.mkdir(bgDir, { recursive: true });
        await fs.promises.writeFile(path.join(bgDir, file), buf);
        return json(res, 200, { ok: true, url: '/backgrounds/' + file });
      }
      // "Son Twitch" folder: list, add (the file keeps its name), so alerts and sound commands can pick from it.
      if (p === '/api/media' && m === 'GET' && getMediaDir) {
        const dir = getMediaDir();
        await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
        const names = (await fs.promises.readdir(dir).catch(() => [])).filter((n) => MEDIA_RE.test(n)).slice(0, 1000);
        const files = [];
        for (const name of names) {
          const st = await fs.promises.stat(path.join(dir, name)).catch(() => null);
          if (st && st.isFile()) files.push({ name, kind: /\.(mp3|wav|ogg)$/i.test(name) ? 'audio' : 'image', size: st.size });
        }
        files.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
        return json(res, 200, { ok: true, dir, files });
      }
      if (p === '/api/media' && m === 'POST' && getMediaDir) {
        const buf = await readRaw(req, MAX_SOUND);
        const type = soundType(buf) || imageType(buf);
        if (!type) throw new Error('Not an MP3, WAV, Ogg, GIF, PNG, JPEG or WebP file');
        if (!soundType(buf) && buf.length > 8 * 1024 * 1024) throw new Error('Picture too big (8 MB max)');
        const dir = getMediaDir();
        await fs.promises.mkdir(dir, { recursive: true });
        const name = freeMediaName(dir, url.searchParams.get('name'), type);
        await fs.promises.writeFile(path.join(dir, name), buf);
        return json(res, 200, { ok: true, file: name, kind: soundType(buf) ? 'audio' : 'image' });
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

module.exports = { createServer, soundType, mediaPath, freeMediaName };
