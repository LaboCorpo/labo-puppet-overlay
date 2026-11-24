/*
 * Read-only Twitch chat for web pages (hub room, OBS chat widget): anonymous IRC over WebSocket,
 * several channels on one connection, automatic reconnect. Emits plain message objects; HTML helpers
 * render Twitch emotes and badges. Moderation and sending go through the app (Helix), not here.
 */
(function (global) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LOGIN_RE = /^[a-z0-9_]{3,25}$/;

  function tagsOf(raw) {
    const o = {};
    (raw || '').split(';').forEach((kv) => {
      const i = kv.indexOf('=');
      if (i > 0) o[kv.slice(0, i)] = kv.slice(i + 1).replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\');
    });
    return o;
  }

  // Twitch emotes: tag "id:start-end,start-end/id2:…", positions in Unicode code points.
  function emoteHtml(text, emotes, size) {
    const chars = Array.from(text || '');
    const marks = [];
    (emotes || '').split('/').filter(Boolean).forEach((part) => {
      const [id, ranges] = part.split(':');
      if (!/^[\w-]+$/.test(id || '')) return;
      (ranges || '').split(',').forEach((r) => { const [a, b] = r.split('-').map(Number); if (b >= a) marks.push([a, b, id]); });
    });
    marks.sort((x, y) => x[0] - y[0]);
    let out = '', pos = 0;
    const scale = size >= 2 ? '2.0' : '1.0';
    for (const [a, b, id] of marks) {
      if (a < pos) continue;
      out += esc(chars.slice(pos, a).join(''));
      const name = chars.slice(a, b + 1).join('');
      out += `<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/${scale}" alt="${esc(name)}" title="${esc(name)}">`;
      pos = b + 1;
    }
    return out + esc(chars.slice(pos).join(''));
  }

  // badges tag "moderator/1,subscriber/12" -> [{set, version}]
  const badgesOf = (raw) => (raw || '').split(',').filter(Boolean).map((b) => { const [set, version] = b.split('/'); return { set, version: version || '1' }; });

  function parse(line) {
    const m = line.match(/^(?:@(\S+) )?:(\S+?)(?:!\S+)? (\w+)(?: #(\S+))?(?: :(.*))?$/);
    if (!m) return null;
    const [, rawTags, prefix, cmd, chan, text] = m;
    return { tags: tagsOf(rawTags), prefix, cmd, chan, text: text || '' };
  }

  class TwitchChat {
    constructor() {
      this.channels = new Set();
      this.ws = null;
      this.timer = 0;
      this.retryMs = 2000;
      this.handlers = {};
      this.closed = false;
    }
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this; }
    emit(ev, x) { (this.handlers[ev] || []).forEach((f) => { try { f(x); } catch (e) { console.error(e); } }); }

    // Replace the channel list (joins / parts the difference).
    setChannels(list) {
      const next = new Set((list || []).map((l) => String(l).toLowerCase().replace(/^#/, '')).filter((l) => LOGIN_RE.test(l)));
      const open = this.ws && this.ws.readyState === 1;
      for (const c of this.channels) if (!next.has(c) && open) this.ws.send('PART #' + c);
      for (const c of next) if (!this.channels.has(c) && open) this.ws.send('JOIN #' + c);
      this.channels = next;
      if (!next.size) { this.disconnect(); return; }
      if (!this.ws) this.connect();
    }
    connect() {
      if (this.ws || this.closed || !this.channels.size) return;
      let sock;
      try { sock = new WebSocket('wss://irc-ws.chat.twitch.tv:443'); } catch (e) { this.retry(); return; }
      this.ws = sock;
      sock.onopen = () => {
        this.retryMs = 2000;
        sock.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        sock.send('PASS SCHMOOPIIE');
        sock.send('NICK justinfan' + Math.floor(10000 + Math.random() * 80000));
        for (const c of this.channels) sock.send('JOIN #' + c);
        this.emit('status', 'connected');
      };
      sock.onmessage = (ev) => String(ev.data).split('\r\n').forEach((l) => this.onLine(l));
      sock.onclose = () => { if (this.ws !== sock) return; this.ws = null; this.emit('status', 'reconnecting'); this.retry(); };
      sock.onerror = () => {};
    }
    retry() {
      clearTimeout(this.timer);
      if (this.closed || !this.channels.size) return;
      this.timer = setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(30000, this.retryMs * 2);
    }
    disconnect() { clearTimeout(this.timer); const w = this.ws; this.ws = null; if (w) try { w.close(); } catch (e) { /* closed */ } }
    close() { this.closed = true; this.disconnect(); }

    onLine(line) {
      if (!line) return;
      if (line.startsWith('PING')) { if (this.ws) this.ws.send('PONG :tmi.twitch.tv'); return; }
      const p = parse(line);
      if (!p || !p.chan || !this.channels.has(p.chan)) return;
      const tg = p.tags;
      if (p.cmd === 'PRIVMSG') {
        let text = p.text;
        const action = text.startsWith('\u0001ACTION ');
        if (action) text = text.slice(8, -1);
        this.emit('message', {
          id: tg.id || '', channel: p.chan, roomId: tg['room-id'] || '', userId: tg['user-id'] || '',
          login: p.prefix.toLowerCase(), display: tg['display-name'] || p.prefix,
          color: /^#[0-9a-f]{6}$/i.test(tg.color || '') ? tg.color : '', text: text.slice(0, 500), emotes: tg.emotes || '',
          badges: badgesOf(tg.badges), action, first: tg['first-msg'] === '1', bits: Number(tg.bits) || 0,
          mod: tg.mod === '1' || /(^|,)(moderator|broadcaster)\//.test(tg.badges || ''), at: Number(tg['tmi-sent-ts']) || Date.now(),
        });
      } else if (p.cmd === 'USERNOTICE') {
        this.emit('notice', { channel: p.chan, roomId: tg['room-id'] || '', kind: tg['msg-id'] || '', text: tg['system-msg'] || '', message: p.text, emotes: tg.emotes || '', login: (tg.login || '').toLowerCase(), display: tg['display-name'] || '' });
      } else if (p.cmd === 'CLEARMSG') {
        this.emit('delete', { channel: p.chan, id: tg['target-msg-id'] || '' });
      } else if (p.cmd === 'CLEARCHAT') {
        // With a target: that user's messages (timeout / ban); without: the whole chat.
        this.emit('clear', { channel: p.chan, userId: tg['target-user-id'] || '', login: (p.text || '').toLowerCase(), duration: Number(tg['ban-duration']) || 0 });
      } else if (p.cmd === 'ROOMSTATE') {
        this.emit('room', { channel: p.chan, roomId: tg['room-id'] || '', slow: Number(tg.slow) || 0, followers: tg['followers-only'] != null ? Number(tg['followers-only']) : null, emoteOnly: tg['emote-only'] === '1', subsOnly: tg['subs-only'] === '1' });
      }
    }
  }

  TwitchChat.emoteHtml = emoteHtml;
  TwitchChat.esc = esc;
  TwitchChat.parse = parse;
  TwitchChat.tagsOf = tagsOf;
  // Badge image from the map the app sends ({ "set/version": url }), or null.
  TwitchChat.badgeHtml = (badges, map, cls) => (badges || []).map((b) => { const u = map && (map[b.set + '/' + b.version] || map[b.set + '/1']); return u ? `<img class="${cls || 'badge'}" src="${esc(u)}" alt="">` : ''; }).join('');
  global.TwitchChat = TwitchChat;
  if (typeof module !== 'undefined') module.exports = TwitchChat;
})(typeof window !== 'undefined' ? window : globalThis);
