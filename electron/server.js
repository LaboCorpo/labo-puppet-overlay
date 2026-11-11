/*
 * Local HTTP server: serves web/ (overlay, panel, creator) and a tiny JSON API.
 * OBS/Streamlabs use http://localhost:<port>/overlay.html as a Browser Source.
 * Bound to 127.0.0.1 only.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

function createServer({ webDir, store, getDiscord, onSettings, onReconnect, onOpenCreator }) {
  const clients = new Set();

  function fullState() {
    return { settings: store.settings, avatars: store.allAvatars(), discord: getDiscord() };
  }
  function broadcast(event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) res.write(msg);
  }
  function readBody(req, limit = 2_000_000) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('Trop volumineux')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); } });
    });
  }
  function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }

  function validAvatar(a) {
    if (!a || typeof a !== 'object') throw new Error('Avatar invalide');
    if (!/^\d{15,22}$/.test(String(a.id || ''))) throw new Error('ID Discord manquant ou invalide (17 à 20 chiffres)');
    if (a.photo && !/^data:image\/(png|jpeg|webp);base64,/.test(a.photo)) throw new Error('Photo invalide');
    return a;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    try {
      if (p === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
        res.write(`event: state\ndata: ${JSON.stringify(fullState())}\n\n`);
        clients.add(res);
        const ka = setInterval(() => res.write(': ka\n\n'), 20000);
        req.on('close', () => { clients.delete(res); clearInterval(ka); });
        return;
      }
      if (p === '/api/state' && req.method === 'GET') return json(res, 200, fullState());
      if (p === '/api/settings' && req.method === 'POST') { const body = await readBody(req); onSettings(body); return json(res, 200, { ok: true, settings: store.settings }); }
      if (p === '/api/avatars' && req.method === 'POST') {
        const body = await readBody(req);
        const list = Array.isArray(body) ? body : [body];
        list.forEach((a) => store.setAvatar(validAvatar(a)));
        broadcast('state', fullState());
        return json(res, 200, { ok: true, count: list.length });
      }
      if (p.startsWith('/api/avatars/') && req.method === 'DELETE') { store.deleteAvatar(decodeURIComponent(p.split('/').pop())); broadcast('state', fullState()); return json(res, 200, { ok: true }); }
      if (p === '/api/discord/reconnect' && req.method === 'POST') { onReconnect(); return json(res, 200, { ok: true }); }
      if (p === '/api/open-creator' && req.method === 'POST') { const b = await readBody(req); onOpenCreator(b && b.id); return json(res, 200, { ok: true }); }

      // static files
      let rel = decodeURIComponent(p === '/' ? '/panel.html' : p);
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

  return { server, broadcast, fullState };
}

module.exports = { createServer };
