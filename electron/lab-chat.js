/*
 * Labo test — chat bot and viewer games on your own Twitch chat. Chat is read anonymously (IRC, twitch.js);
 * replies are sent with your Twitch account (Helix "Send Chat Message"), at most one every 1.2 s.
 *  - commands you write (!discord…), timers, !uptime, !so, !lurk, !commands, a welcome for first-time chatters;
 *  - sound commands (!airhorn…) played where your alert sounds play;
 *  - giveaway, chat poll (!vote 2 or just "2"), counters (!death, !death+), viewer queue (!play / !leave);
 *  - a stream session (messages, chatters, follows, subs…) summed up when the live ends.
 * What viewers see on stream: lab.html overlays, fed by snapshot() (app state `lab.play`) and 'lab-event' SSE events.
 */
const { EventEmitter } = require('events');

const SAY_GAP_MS = 1200;
const fmtDur = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; };

/** Replaces {name}-style variables; {random:a|b|c} picks one. Unknown variables stay as they are. */
function fill(tpl, vars) {
  return String(tpl || '')
    .replace(/\{random:([^}]{1,300})\}/g, (m, list) => { const o = list.split('|'); return o[Math.floor(Math.random() * o.length)]; })
    .replace(/\{(\w{1,20})\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m))
    .slice(0, 500);
}

function newSession(startedAt) {
  return { startedAt: startedAt || null, since: Date.now(), messages: 0, chatters: new Set(), firsts: 0, follows: 0, subs: 0, gifts: 0, bits: 0, raids: 0, raiders: 0, peak: 0, sounds: 0 };
}

class LabChat extends EventEmitter {
  /**
   * o: { getSettings() -> settings.lab, say(text) -> Promise, live() -> {startedAt, title, game, viewers}|null,
   *      api (TwitchApi), userIdOf(login) -> Promise<id>, playSound({file, volume}), setCounters(list),
   *      broadcast(event, data), notify(title, body), log, t }
   */
  constructor(o) {
    super();
    this.o = o;
    this.cool = new Map();
    this.sayQ = [];
    this.sayBusy = false;
    this.giveaway = { open: false, entries: new Map(), winners: [], winner: null, recent: [] };
    this.poll = null;
    this.queue = { open: true, list: [] };
    this.session = newSession(null);
    this.lastSummary = null;
    this.lines = 0;
    this.timerState = [];
    this.timer = setInterval(() => this.tick(), 30000);
  }
  cfg() { return this.o.getSettings(); }
  t(s, v) { return this.o.t(s, v); }
  changed() { clearTimeout(this.chTimer); this.chTimer = setTimeout(() => this.emit('change'), 300); }

  // ---------- Sending (throttled; a long queue is dropped rather than spamming late answers) ----------
  reply(text) {
    const msg = String(text || '').trim();
    if (!msg) return;
    if (this.sayQ.length >= 6) return;
    this.sayQ.push(msg);
    this.pump();
  }
  async pump() {
    if (this.sayBusy) return;
    this.sayBusy = true;
    while (this.sayQ.length) {
      const m = this.sayQ.shift();
      try { await this.o.say(m); } catch (e) { this.o.log.warn('[lab-chat] say: ' + e.message); }
      await new Promise((r) => setTimeout(r, SAY_GAP_MS));
    }
    this.sayBusy = false;
  }
  cooled(key, sec) {
    const now = Date.now();
    if ((this.cool.get(key) || 0) > now) return false;
    this.cool.set(key, now + sec * 1000);
    if (this.cool.size > 3000) for (const [k, u] of this.cool) if (u <= now) this.cool.delete(k);
    return true;
  }
  vars(m, extra) {
    const live = this.o.live();
    return Object.assign({ name: m.display || m.login, user: m.display || m.login, login: m.login, channel: this.o.api.login || '', uptime: live ? fmtDur(Date.now() - Date.parse(live.startedAt)) : this.t('offline'), game: live ? live.game : '', title: live ? live.title : '' }, extra);
  }

  // ---------- Chat ----------
  /** m: chat event from twitch.js (login, display, text, self, mod, sub, vip, first, broadcaster). */
  onChat(m) {
    if (!m || !m.text) return;
    const c = this.cfg();
    this.lines++;
    if (Date.now() - (this.sessEmit || 0) > 5000) { this.sessEmit = Date.now(); this.changed(); } // session counters in the panel
    if (!m.self) {
      this.session.messages++;
      this.session.chatters.add(m.login);
      if (m.first) {
        this.session.firsts++;
        if (c.chatbot.welcome) this.reply(fill(c.chatbot.welcomeText, this.vars(m)));
      }
    }
    const text = m.text.trim();
    if (this.poll && this.poll.open && /^[1-9]$/.test(text)) { this.vote(m, Number(text)); return; }
    if (!text.startsWith('!')) return;
    const [head, ...rest] = text.slice(1).split(/\s+/);
    const cmd = (head || '').toLowerCase();
    const arg = rest.join(' ').trim();
    if (!cmd) return;
    const isMod = !!(m.mod || m.broadcaster || m.self);
    try { this.command(m, cmd, arg, isMod, c); } catch (e) { this.o.log.warn('[lab-chat] !' + cmd + ': ' + e.message); }
  }

  command(m, cmd, arg, isMod, c) {
    // Games first: they only answer while running.
    if (this.giveaway.open && cmd === c.giveaway.keyword) return this.enter(m);
    if (cmd === 'vote' && this.poll && this.poll.open) return this.vote(m, parseInt(arg, 10));
    if (c.queue.enabled) {
      if (cmd === c.queue.joinCmd) return this.queueJoin(m);
      if (cmd === c.queue.leaveCmd) return this.queueLeave(m);
      if (cmd === 'queue' || cmd === 'file') return this.queueWhere(m);
    }
    // Counters: !death shows it, !death+ / !death- / "!death +3" change it (moderators).
    const cm = cmd.match(/^([a-z0-9_]+?)([+-])?$/);
    const counter = cm && c.counters.find((x) => x.cmd === cm[1]);
    if (counter) {
      const sign = cm[2] || (/^[+-]\d*$/.test(arg) ? arg[0] : '');
      if (sign) {
        if (counter.modOnly && !isMod) return;
        const n = Math.max(1, Math.min(1000, parseInt(arg.replace(/^[+-]/, ''), 10) || 1));
        return this.bumpCounter(counter.id, sign === '-' ? -n : n, true);
      }
      if (this.cooled('counter:' + counter.id, 10)) this.reply(`${counter.name} : ${counter.value}`);
      return;
    }
    // Sound commands
    if (c.sounds.enabled) {
      if (cmd === 'sons' || cmd === 'sounds') { if (this.cooled('sndlist', 30)) this.reply(this.t('Sounds: {list}', { list: c.sounds.list.map((s) => '!' + s.name).join(' ') || '—' })); return; }
      const snd = c.sounds.list.find((s) => s.name === cmd);
      if (snd) return this.viewerSound(m, snd, isMod, c.sounds);
    }
    const b = c.chatbot;
    if (!b.enabled) return;
    const own = b.commands.find((x) => x.name === cmd);
    if (own) {
      if (own.modOnly && !isMod) return;
      if (!this.cooled('cmd:' + own.name, own.cooldown)) return;
      this.reply(fill(own.reply, this.vars(m, { target: arg.replace(/^@/, '').split(/\s/)[0] || m.display, count: '' })));
      return;
    }
    if (cmd === 'uptime' && b.uptime) { if (this.cooled('uptime', 15)) this.reply(this.o.live() ? fill(b.uptimeText, this.vars(m)) : this.t('Not live right now.')); return; }
    if (cmd === 'lurk' && b.lurk) { if (this.cooled('lurk:' + m.login, 300)) this.reply(fill(b.lurkText, this.vars(m))); return; }
    if ((cmd === 'so' || cmd === 'shoutout') && b.so && isMod) { this.shoutout(arg); return; }
    if ((cmd === 'commands' || cmd === 'commandes') && b.list) {
      if (!this.cooled('list', 30)) return;
      const names = b.commands.filter((x) => !x.modOnly).map((x) => '!' + x.name);
      if (b.uptime) names.push('!uptime');
      if (b.lurk) names.push('!lurk');
      if (c.sounds.enabled && c.sounds.list.length) names.push('!sons');
      if (c.queue.enabled) names.push('!' + c.queue.joinCmd);
      this.reply(this.t('Commands: {list}', { list: names.join(' ') || '—' }));
    }
  }

  async shoutout(arg) {
    const login = String(arg || '').replace(/^@/, '').split(/\s/)[0].toLowerCase();
    if (!/^[a-z0-9_]{3,25}$/.test(login) || !this.cooled('so:' + login, 60)) return;
    let game = '', display = login;
    try {
      const id = await this.o.userIdOf(login);
      const r = await this.o.api.helix('GET', 'channels', { broadcaster_id: id });
      const ch = (r.data || [])[0];
      if (ch) { game = ch.game_name || ''; display = ch.broadcaster_name || login; }
      // The real Twitch shoutout card too (live only, 2 min between two; failures are fine: the message is enough).
      this.o.api.helix('POST', 'chat/shoutouts', { from_broadcaster_id: this.o.api.userId, to_broadcaster_id: id, moderator_id: this.o.api.userId }).catch(() => {});
    } catch (e) { /* unknown channel: still say the message */ }
    this.reply(fill(this.cfg().chatbot.soText, { name: display, login, game: game || '?' }));
  }

  viewerSound(m, snd, isMod, s) {
    const ok = s.who === 'all' || isMod || (s.who === 'vip' && (m.vip || m.sub)) || (s.who === 'subs' && m.sub);
    if (!ok) return;
    if (!isMod && (this.cool.get('snd') || 0) > Date.now()) return;
    if (!isMod && !this.cooled('snd:' + m.login, s.userCooldown)) return;
    this.cool.set('snd', Date.now() + s.cooldown * 1000);
    this.session.sounds++;
    this.o.playSound({ file: snd.file, volume: snd.volume });
    this.o.log.info(`[lab-chat] sound !${snd.name} by ${m.login}`);
  }
  playByName(name) {
    const snd = this.cfg().sounds.list.find((s) => s.name === String(name || '').toLowerCase().replace(/^!/, ''));
    if (!snd) throw new Error('Unknown sound');
    this.o.playSound({ file: snd.file, volume: snd.volume });
  }

  // ---------- Giveaway ----------
  giveawayOp(op) {
    const g = this.giveaway, c = this.cfg().giveaway;
    if (op === 'open') {
      if (!g.open) { g.open = true; g.winner = null; if (c.announce) this.reply(this.t('🎉 Giveaway open! Type !{kw} to enter.', { kw: c.keyword })); }
    } else if (op === 'close') {
      if (g.open) { g.open = false; if (c.announce) this.reply(this.t('Giveaway closed: {n} entries. Good luck!', { n: g.entries.size })); }
    } else if (op === 'draw') {
      const pool = [...g.entries].filter(([login]) => !g.winners.includes(login));
      if (!pool.length) throw new Error('Nobody to draw');
      const total = pool.reduce((a, [, e]) => a + e.tickets, 0);
      let r = Math.random() * total, win = pool[0];
      for (const p of pool) { r -= p[1].tickets; if (r <= 0) { win = p; break; } }
      g.winners.push(win[0]);
      g.winner = { login: win[0], display: win[1].display, at: Date.now() };
      this.o.broadcast('lab-event', { type: 'giveaway-winner', name: win[1].display, names: pool.slice(0, 40).map(([, e]) => e.display) });
      if (c.announce) this.reply(this.t('🎉 And the winner is… {name}! Congratulations!', { name: win[1].display }));
    } else if (op === 'reset') {
      this.giveaway = { open: false, entries: new Map(), winners: [], winner: null, recent: [] };
    } else throw new Error('Unknown action');
    this.changed();
    return g.winner;
  }
  enter(m) {
    const g = this.giveaway;
    if (g.entries.has(m.login)) return;
    const tickets = m.sub ? this.cfg().giveaway.subLuck : 1;
    g.entries.set(m.login, { display: m.display || m.login, tickets });
    g.recent.unshift(m.display || m.login);
    g.recent.length = Math.min(g.recent.length, 8);
    this.changed();
  }

  // ---------- Poll (in chat: "!vote 2" or just "2") ----------
  pollStart(b) {
    const options = (Array.isArray(b.options) ? b.options : []).map((x) => String(x || '').trim().slice(0, 60)).filter(Boolean).slice(0, 6);
    const question = String(b.question || '').trim().slice(0, 140);
    if (!question || options.length < 2) throw new Error('A question and at least two answers');
    const seconds = Math.max(10, Math.min(1800, Math.round(Number(b.seconds) || this.cfg().poll.seconds)));
    this.pollEnd(true);
    this.poll = { question, options: options.map((text) => ({ text, votes: 0 })), voters: new Map(), open: true, endsAt: Date.now() + seconds * 1000, seconds };
    clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => this.pollEnd(), seconds * 1000);
    if (this.cfg().poll.announce) this.reply(this.t('📊 {q} — type the number: {list}', { q: question, list: options.map((o, i) => `${i + 1} = ${o}`).join(' · ') }));
    this.o.broadcast('lab-event', { type: 'poll-start' });
    this.changed();
  }
  vote(m, n) {
    const p = this.poll;
    if (!p || !p.open || !(n >= 1 && n <= p.options.length)) return;
    const prev = p.voters.get(m.login);
    if (prev === n - 1) return;
    if (prev != null) p.options[prev].votes--;
    p.voters.set(m.login, n - 1);
    p.options[n - 1].votes++;
    this.changed();
  }
  pollEnd(silent) {
    const p = this.poll;
    clearTimeout(this.pollTimer);
    if (!p || !p.open) return;
    p.open = false;
    p.endsAt = Date.now();
    const total = p.options.reduce((a, o) => a + o.votes, 0);
    const best = p.options.reduce((a, o) => (o.votes > a.votes ? o : a), p.options[0]);
    p.winner = total ? p.options.indexOf(best) : -1;
    if (!silent && this.cfg().poll.announce) {
      this.reply(total ? this.t('📊 Result: {answer} ({p} %, {n} votes)', { answer: best.text, p: Math.round((best.votes / total) * 100), n: total }) : this.t('📊 Nobody voted.'));
    }
    this.o.broadcast('lab-event', { type: 'poll-end' });
    this.changed();
  }
  pollClear() { this.pollEnd(true); this.poll = null; this.changed(); }

  // ---------- Counters ----------
  bumpCounter(id, delta, fromChat) {
    const list = this.cfg().counters.map((x) => Object.assign({}, x));
    const ct = list.find((x) => x.id === id || x.name.toLowerCase() === String(id).toLowerCase());
    if (!ct) throw new Error('Unknown counter');
    ct.value = delta === 'reset' ? 0 : Math.max(-1e6, Math.min(1e6, ct.value + Number(delta || 0)));
    this.o.setCounters(list);
    this.o.broadcast('lab-event', { type: 'counter', id: ct.id, value: ct.value });
    if (fromChat && this.cooled('counter:' + ct.id + ':say', 5)) this.reply(`${ct.name} : ${ct.value}`);
    return ct;
  }

  // ---------- Viewer queue ----------
  queueJoin(m) {
    const q = this.queue, c = this.cfg().queue;
    if (!q.open || q.list.some((x) => x.login === m.login)) return;
    if (q.list.length >= c.max) { if (this.cooled('qfull', 30)) this.reply(this.t('The queue is full.')); return; }
    q.list.push({ login: m.login, display: m.display || m.login, sub: !!m.sub, at: Date.now() });
    if (c.announce && this.cooled('qjoin:' + m.login, 60)) this.reply(this.t('{name} joins the queue (#{n})', { name: m.display || m.login, n: q.list.length }));
    this.changed();
  }
  queueLeave(m) { const q = this.queue, i = q.list.findIndex((x) => x.login === m.login); if (i >= 0) { q.list.splice(i, 1); this.changed(); } }
  queueWhere(m) {
    if (!this.cooled('qwhere:' + m.login, 20)) return;
    const i = this.queue.list.findIndex((x) => x.login === m.login);
    this.reply(i >= 0 ? this.t('{name}: you are #{n} in the queue', { name: m.display, n: i + 1 }) : this.t('{n} in the queue. Type !{cmd} to join.', { n: this.queue.list.length, cmd: this.cfg().queue.joinCmd }));
  }
  queueOp(op, login) {
    const q = this.queue;
    if (op === 'next') {
      const nx = q.list.shift();
      if (!nx) throw new Error('The queue is empty');
      this.reply(this.t('{name}, your turn! 🎮', { name: nx.display }));
      this.o.broadcast('lab-event', { type: 'queue-next', name: nx.display });
    } else if (op === 'remove') q.list = q.list.filter((x) => x.login !== login);
    else if (op === 'clear') q.list = [];
    else if (op === 'open') q.open = true;
    else if (op === 'close') q.open = false;
    else throw new Error('Unknown action');
    this.changed();
  }

  // ---------- Twitch events, timers, session ----------
  onEvent(e) {
    const s = this.session;
    if (e.type === 'follow') s.follows++;
    else if (e.type === 'sub' && !e.bundled) { if (e.kind === 'gift') s.gifts += e.count || 1; else s.subs++; }
    else if (e.type === 'bits') s.bits += e.amount || 0;
    else if (e.type === 'raid') { s.raids++; s.raiders += e.count || 0; }
    else return;
    this.changed();
  }
  /** Called when your live starts or stops (stream-stats). */
  onLive(live, was) {
    if (live && (!was || was.startedAt !== live.startedAt)) { this.session = newSession(live.startedAt); this.timerState = []; this.changed(); }
    if (!live && was) {
      const text = this.summaryText();
      this.lastSummary = { text, at: Date.now() };
      if (this.cfg().summary) this.o.notify(this.t('Stream over: well done! 🎉'), text.split('\n').slice(1, 5).join(' · '));
      this.changed();
    }
  }
  tick() {
    const live = this.o.live();
    if (live && live.viewers > this.session.peak) { this.session.peak = live.viewers; this.changed(); }
    const b = this.cfg().chatbot;
    if (!b.enabled || !live) return;
    const now = Date.now();
    b.timers.forEach((tm, i) => {
      const st = this.timerState[i] || (this.timerState[i] = { at: now - (i * 60000), lines: this.lines });
      if (now - st.at >= tm.minutes * 60000 && this.lines - st.lines >= b.timerLines) { st.at = now; st.lines = this.lines; this.reply(fill(tm.text, { channel: this.o.api.login || '', uptime: fmtDur(now - Date.parse(live.startedAt)), game: live.game, title: live.title })); }
    });
  }
  summaryText() {
    const s = this.session;
    const dur = s.startedAt ? fmtDur(Date.now() - Date.parse(s.startedAt)) : fmtDur(Date.now() - s.since);
    return [this.t('Stream summary ({d})', { d: dur }),
      this.t('{n} messages from {c} chatters ({f} for the first time)', { n: s.messages, c: s.chatters.size, f: s.firsts }),
      this.t('{n} new followers', { n: s.follows }), this.t('{n} subs, {g} gifted subs', { n: s.subs, g: s.gifts }),
      this.t('{n} bits', { n: s.bits }), this.t('{n} raids ({v} viewers)', { n: s.raids, v: s.raiders }), this.t('Viewer peak: {n}', { n: s.peak })].join('\n');
  }

  snapshot() {
    const g = this.giveaway, p = this.poll, s = this.session, c = this.cfg();
    return {
      giveaway: { open: g.open, keyword: c.giveaway.keyword, count: g.entries.size, tickets: [...g.entries.values()].reduce((a, e) => a + e.tickets, 0), recent: g.recent.slice(), winner: g.winner, entries: [...g.entries.values()].slice(-60).map((e) => e.display) },
      poll: p ? { question: p.question, options: p.options.map((o) => ({ text: o.text, votes: o.votes })), open: p.open, endsAt: p.endsAt, seconds: p.seconds, winner: p.winner == null ? -1 : p.winner, total: p.voters.size } : null,
      queue: { open: this.queue.open, size: this.queue.list.length, list: this.queue.list.slice(0, 30).map((x) => ({ login: x.login, display: x.display, sub: x.sub })) },
      session: { startedAt: s.startedAt, since: s.since, messages: s.messages, chatters: s.chatters.size, firsts: s.firsts, follows: s.follows, subs: s.subs, gifts: s.gifts, bits: s.bits, raids: s.raids, raiders: s.raiders, peak: s.peak, sounds: s.sounds },
      lastSummary: this.lastSummary,
    };
  }
  stop() { clearInterval(this.timer); clearTimeout(this.pollTimer); clearTimeout(this.chTimer); }
}

module.exports = { LabChat, fill, fmtDur };
