/*
 * Local HTTP server: serves web/ (overlay, panel, creator) and a tiny JSON API.
 * OBS/Streamlabs use http://localhost:<port>/overlay.html as a Browser Source.
 * Bound to 127.0.0.1 only.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

function createServer({ webDir, store, getState, onSettings, onAction }) {
  const clients = new Set();

  function fullState() { return Object.assign({ settings: store.settings, avatars: store.allAvatars(), viewers: store.data.viewers }, getState()); }
  function broadcast(event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) { try { res.write(msg); } catch (e) { clients.delete(res); } }
  }
  // Coalesce bursts of state changes into one push per frame-ish.
  let stateTimer = null;
  function pushState() { if (stateTimer) return; stateTimer = setTimeout(() => { stateTimer = null; broadcast('state', fullState()); }, 30); }

  function readBody(req, limit = 2_000_000) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('Payload too large')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(new Error('Invalid JSON')); } });
      req.on('error', reject);
    });
  }
  function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }

  function validAvatar(a) {
    if (!a || typeof a !== 'object') throw new Error('Invalid avatar');
    if (!/^\d{15,22}$/.test(String(a.id || ''))) throw new Error('Missing or invalid Discord ID (17–20 digits)');
    if (a.photo && !/^data:image\/(png|jpeg|webp);base64,/.test(a.photo)) throw new Error('Invalid photo');
    return a;
  }

  // Only pages served by this server may call the API (blocks other websites from poking localhost).
  function sameOrigin(req) {
    const o = req.headers.origin;
    return !o || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    try {
      if (p === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write('retry: 2000\n');
        res.write(`event: state\ndata: ${JSON.stringify(fullState())}\n\n`);
        clients.add(res);
        const ka = setInterval(() => res.write(': ka\n\n'), 20000);
        req.on('close', () => { clients.delete(res); clearInterval(ka); });
        return;
      }
      if (p.startsWith('/api/') && req.method !== 'GET' && !sameOrigin(req)) return json(res, 403, { ok: false, error: 'Forbidden' });
      if (p === '/api/state' && req.method === 'GET') return json(res, 200, fullState());
      if (p === '/api/settings' && req.method === 'POST') { const body = await readBody(req); onSettings(body); return json(res, 200, { ok: true }); }
      if (p === '/api/avatars' && req.method === 'POST') {
        const body = await readBody(req);
        const list = Array.isArray(body) ? body : [body];
        list.forEach((a) => store.setAvatar(validAvatar(a)));
        pushState();
        return json(res, 200, { ok: true, count: list.length });
      }
      if (p.startsWith('/api/avatars/') && req.method === 'DELETE') { store.deleteAvatar(decodeURIComponent(p.split('/').pop())); pushState(); return json(res, 200, { ok: true }); }
      if (p === '/api/action' && req.method === 'POST') { const b = await readBody(req, 10000); const r = await onAction(b.name, b); return json(res, 200, Object.assign({ ok: true }, r || {})); }

      // static files
      const rel = decodeURIComponent(p === '/' ? '/panel.html' : p);
      const file = path.normalize(path.join(webDir, rel));
      if (!file.startsWith(webDir)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(data);
      });
    } catch (e) {
      json(res, 400, { ok: false, error: e.message });
    }
  });

  return { server, broadcast, pushState, fullState };
}

module.exports = { createServer };
