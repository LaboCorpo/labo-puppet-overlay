/*
 * Discord bot "create your puppet without installing anything".
 * Runs inside one LaboHub (the host's): connects to the Discord gateway with the bot token of the LaboHub
 * Discord application, registers /puppet, and answers with an interactive editor (only you see it):
 * a picture of your puppet + menus (part, choice, colours) + buttons (random, save).
 * Saving stores the avatar for your Discord ID on the host and, if a GitHub token is set, adds it to the
 * crew's shared avatars file, which every LaboHub reads every 2 minutes.
 */
const { EventEmitter } = require('events');

const API = 'https://discord.com/api/v10';
const EPHEMERAL = 64;
const COMMANDS = [{
  name: 'puppet', description: 'Your LaboHub puppet', description_localizations: { fr: 'Ta marionnette LaboHub' },
  options: [
    { type: 1, name: 'create', description: 'Create or edit your puppet', description_localizations: { fr: 'Créer ou modifier ta marionnette' } },
    { type: 1, name: 'show', description: 'Show your puppet to everyone', description_localizations: { fr: 'Montrer ta marionnette à tout le monde' } },
    { type: 1, name: 'code', description: 'Get your puppet code', description_localizations: { fr: 'Obtenir le code de ta marionnette' } },
    { type: 1, name: 'import', description: 'Use a PUP1 code (from the creator)', description_localizations: { fr: 'Utiliser un code PUP1 (du créateur)' } },
  ],
}];
// Editor menu: [key, English label, French label]; colour keys pick from the palettes.
const PARTS = [
  ['headShape', 'Head shape', 'Forme de tête'], ['skin', 'Skin colour', 'Couleur de peau'], ['eyes', 'Eyes', 'Yeux'], ['eyeColor', 'Eye colour', 'Couleur des yeux'],
  ['brows', 'Eyebrows', 'Sourcils'], ['glasses', 'Glasses', 'Lunettes'], ['nose', 'Nose', 'Nez'], ['cheeks', 'Cheeks', 'Joues'], ['teeth', 'Teeth', 'Dents'],
  ['hair', 'Hair', 'Cheveux'], ['hairColor', 'Hair colour', 'Couleur des cheveux'], ['beard', 'Beard', 'Barbe'], ['hat', 'Hat', 'Chapeau'], ['hatColor', 'Hat colour', 'Couleur du chapeau'],
  ['outfit', 'Outfit', 'Tenue'], ['clothColor', 'Outfit colour', 'Couleur de la tenue'], ['pattern', 'Pattern', 'Motif'], ['neckwear', 'Neck', 'Cou'], ['held', 'In hand', 'Dans la main'],
  ['faceExtra', 'Face extras', 'Visage (extras)'], ['back', 'On the back', 'Dans le dos'],
];
const COLOR_PAL = { skin: 'skin', eyeColor: 'eye', hairColor: 'hair', hatColor: 'cloth', clothColor: 'cloth' };

class DiscordBot extends EventEmitter {
  /** o: { getToken(), getAppId(), Puppet, render(avatar) -> Promise<Buffer png>, getAvatar(id), saveAvatar(avatar) -> Promise<{published}>, log } */
  constructor(o) {
    super();
    this.o = o;
    this.ws = null;
    this.seq = null;
    this.hb = 0;
    this.sessions = new Map(); // userId -> { avatar, part, at }
    this.status = 'off';
    this.detail = '';
    this.user = null;
  }
  snapshot() { return { status: this.status, detail: this.detail, user: this.user }; }
  set(status, detail) { this.status = status; this.detail = detail || ''; this.emit('change'); }

  async rest(method, path, body, form) {
    const headers = { Authorization: 'Bot ' + this.o.getToken() };
    let payload;
    if (form) payload = form; else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(API + path, { method, headers, body: payload, signal: AbortSignal.timeout(15000) });
    if (res.status === 204) return null;
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error((j && j.message) || 'Discord answered ' + res.status), { status: res.status });
    return j;
  }

  async start() {
    this.stop();
    if (!this.o.getToken()) { this.set('off'); return; }
    this.stopped = false;
    this.set('connecting');
    try {
      const me = await this.rest('GET', '/users/@me');
      this.user = { id: me.id, name: me.username };
      const appId = this.o.getAppId();
      if (appId !== me.id) this.o.log.warn('[bot] the bot token is not from the LaboHub Discord application; commands are registered for the bot anyway');
      await this.rest('PUT', `/applications/${me.id}/commands`, COMMANDS);
      const gw = await this.rest('GET', '/gateway/bot');
      this.connect((gw && gw.url) || 'wss://gateway.discord.gg');
    } catch (e) {
      this.set('error', e.status === 401 ? 'Invalid bot token' : e.message);
      if (e.status !== 401) this.retry();
    }
  }
  stop() { this.stopped = true; clearInterval(this.hb); clearTimeout(this.timer); const w = this.ws; this.ws = null; if (w) try { w.close(); } catch (e) { /* closed */ } }
  retry() { clearTimeout(this.timer); if (!this.stopped) this.timer = setTimeout(() => this.start(), 30000); }

  connect(url) {
    const ws = new WebSocket(url + '/?v=10&encoding=json');
    this.ws = ws;
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(String(ev.data)); } catch (e) { return; }
      if (m.s != null) this.seq = m.s;
      if (m.op === 10) {
        clearInterval(this.hb);
        this.hb = setInterval(() => this.send(1, this.seq), m.d.heartbeat_interval);
        this.send(2, { token: this.o.getToken(), intents: 0, properties: { os: 'windows', browser: 'labohub', device: 'labohub' } });
      } else if (m.op === 0 && m.t === 'READY') this.set('connected');
      else if (m.op === 0 && m.t === 'INTERACTION_CREATE') this.onInteraction(m.d).catch((e) => this.o.log.warn('[bot] ' + e.message));
      else if (m.op === 7 || m.op === 9) { try { ws.close(); } catch (e) { /* closed */ } }
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      clearInterval(this.hb);
      if (ev && ev.code === 4004) { this.set('error', 'Invalid bot token'); return; }
      this.set('connecting', 'reconnecting');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { if (!this.stopped) this.connect(url); }, 5000);
    };
    ws.onerror = () => {};
  }
  send(op, d) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ op, d })); }

  // ---------- Interactions ----------
  fr(it) { return /^fr/.test(it.locale || ''); }
  async reply(it, type, data, png) {
    const path = `/interactions/${it.id}/${it.token}/callback`;
    if (!png) return this.rest('POST', path, { type, data });
    const form = new FormData();
    data.attachments = [{ id: 0, filename: 'puppet.png' }];
    form.append('payload_json', JSON.stringify({ type, data }));
    form.append('files[0]', new Blob([png], { type: 'image/png' }), 'puppet.png');
    return this.rest('POST', path, null, form);
  }
  async onInteraction(it) {
    const user = (it.member && it.member.user) || it.user;
    if (!user) return;
    const fr = this.fr(it);
    const P = this.o.Puppet;
    if (it.type === 2) {
      const sub = it.data.options && it.data.options[0] && it.data.options[0].name;
      const mine = this.o.getAvatar(user.id);
      if (sub === 'create') {
        const a = P.normalize(Object.assign({}, mine && mine.kind !== 'photo' ? mine : P.randomAvatar(user.id), { id: user.id, name: user.global_name || user.username }));
        this.sessions.set(user.id, { avatar: a, part: 'headShape', at: Date.now() });
        return this.reply(it, 4, Object.assign(this.editor(user.id, fr), { flags: EPHEMERAL }), await this.o.render(a));
      }
      if (sub === 'show') {
        if (!mine) return this.reply(it, 4, { content: fr ? 'Tu n’as pas encore de marionnette : `/puppet create`.' : 'No puppet yet: `/puppet create`.', flags: EPHEMERAL });
        return this.reply(it, 4, { content: `**${mine.name || user.username}**`, embeds: [{ image: { url: 'attachment://puppet.png' }, color: 0xa970ff }] }, await this.o.render(mine));
      }
      if (sub === 'code') {
        if (!mine || mine.kind === 'photo') return this.reply(it, 4, { content: fr ? 'Pas de code pour toi (pas de marionnette dessinée).' : 'No code for you (no drawn puppet).', flags: EPHEMERAL });
        return this.reply(it, 4, { content: '```' + P.encodeCode(mine) + '```', flags: EPHEMERAL });
      }
      if (sub === 'import') {
        return this.reply(it, 9, { custom_id: 'pup:import', title: fr ? 'Importer un code' : 'Import a code', components: [{ type: 1, components: [{ type: 4, custom_id: 'code', label: 'PUP1…', style: 2, required: true, max_length: 4000 }] }] });
      }
      return;
    }
    if (it.type === 5 && it.data.custom_id === 'pup:import') {
      const code = (it.data.components[0].components[0].value || '').trim();
      let a = null;
      try { a = P.decodeAny(code); } catch (e) { a = null; }
      if (!a) return this.reply(it, 4, { content: fr ? 'Code invalide.' : 'Invalid code.', flags: EPHEMERAL });
      a = P.normalize(Object.assign(a, { id: user.id, name: user.global_name || user.username }));
      this.sessions.set(user.id, { avatar: a, part: 'headShape', at: Date.now() });
      return this.reply(it, 4, Object.assign(this.editor(user.id, fr), { flags: EPHEMERAL }), await this.o.render(a));
    }
    if (it.type === 3) {
      const s = this.sessions.get(user.id);
      if (!s) return this.reply(it, 7, { content: fr ? 'Session expirée : relance `/puppet create`.' : 'Session expired: run `/puppet create` again.', components: [], embeds: [], attachments: [] });
      s.at = Date.now();
      const id = it.data.custom_id, v = (it.data.values || [])[0];
      if (id === 'pup:part') { s.part = v; return this.reply(it, 7, this.editor(user.id, fr)); }
      if (id === 'pup:val') this.setPart(s, v);
      if (id === 'pup:prev' || id === 'pup:next') this.step(s, id === 'pup:next' ? 1 : -1);
      if (id === 'pup:rand') s.avatar = P.normalize(Object.assign(P.randomAvatar(user.id + Date.now()), { id: s.avatar.id, name: s.avatar.name }));
      if (id === 'pup:save') {
        const r = await this.o.saveAvatar(s.avatar).catch((e) => ({ error: e.message }));
        this.sessions.delete(user.id);
        const msg = r.error ? (fr ? 'Pas enregistrée : ' : 'Not saved: ') + r.error
          : fr ? `Enregistrée ✅${r.published ? ' — partagée avec le Labo (visible chez tout le monde d’ici 2 min).' : ' — visible chez l’hôte du bot. Pour la partager, envoie ton code : `/puppet code`.'}`
            : `Saved ✅${r.published ? ' — shared with the crew (everyone sees it within 2 min).' : ' — visible on the bot host. To share it, send your code: `/puppet code`.'}`;
        return this.reply(it, 7, { content: msg, components: [], embeds: [{ image: { url: 'attachment://puppet.png' }, color: 0x2fd4a3 }] }, await this.o.render(s.avatar));
      }
      return this.reply(it, 7, this.editor(user.id, fr), await this.o.render(s.avatar));
    }
  }
  values(part) {
    const P = this.o.Puppet;
    if (COLOR_PAL[part]) return P.PALETTES[COLOR_PAL[part]].slice(0, 25);
    return (P.OPTIONS[part] || []).slice(0, 25);
  }
  setPart(s, v) { if (this.values(s.part).includes(v)) s.avatar = this.o.Puppet.normalize(Object.assign({}, s.avatar, { [s.part]: v })); }
  step(s, d) { const vals = this.values(s.part); const i = vals.indexOf(s.avatar[s.part]); this.setPart(s, vals[(i + d + vals.length) % vals.length]); }
  editor(userId, fr) {
    const P = this.o.Puppet;
    const s = this.sessions.get(userId);
    const label = (k) => { const p = PARTS.find((x) => x[0] === k); return p ? (fr ? p[2] : p[1]) : k; };
    const colorName = (hex) => { const n = Object.entries(P.COLOR_NAMES || {}).find(([, h]) => h.toLowerCase() === hex.toLowerCase()); return n ? n[0] : hex; };
    const parts = PARTS.filter(([k]) => this.values(k).length);
    const vals = this.values(s.part);
    return {
      content: fr ? `🎨 **Ta marionnette** — choisis une partie puis une option. ✅ pour enregistrer.` : '🎨 **Your puppet** — pick a part, then an option. ✅ to save.',
      embeds: [{ image: { url: 'attachment://puppet.png' }, color: 0xa970ff, footer: { text: `${label(s.part)} : ${COLOR_PAL[s.part] ? colorName(s.avatar[s.part]) : P.prettyLabel(s.avatar[s.part])}` } }],
      components: [
        { type: 1, components: [{ type: 3, custom_id: 'pup:part', options: parts.map(([k]) => ({ label: label(k), value: k, default: k === s.part })) }] },
        { type: 1, components: [{ type: 3, custom_id: 'pup:val', placeholder: label(s.part), options: vals.map((v) => ({ label: COLOR_PAL[s.part] ? colorName(v) : (fr ? frLabel(P, v) : P.prettyLabel(v)), value: v, default: s.avatar[s.part] === v })) }] },
        { type: 1, components: [
          { type: 2, style: 2, custom_id: 'pup:prev', label: '◀' }, { type: 2, style: 2, custom_id: 'pup:next', label: '▶' },
          { type: 2, style: 1, custom_id: 'pup:rand', label: fr ? '🎲 Au hasard' : '🎲 Random' }, { type: 2, style: 3, custom_id: 'pup:save', label: fr ? '✅ Enregistrer' : '✅ Save' },
        ] },
      ],
    };
  }
}
const I18N = require('../web/shared/i18n.js');
function frLabel(P, v) { return I18N.fr(P.prettyLabel(v)).slice(0, 100); }

// Adds or replaces one person's code in the crew's avatars.txt on GitHub (contents API).
async function publishToGitHub({ token, repo, path, code, id, name, Puppet }) {
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo || '')) return false;
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path || 'avatars.txt')}`;
  const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  let sha = null, lines = [];
  const cur = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (cur.ok) { const j = await cur.json(); sha = j.sha; lines = Buffer.from(j.content || '', 'base64').toString('utf8').split(/\r?\n/); }
  else if (cur.status !== 404) throw new Error('GitHub answered ' + cur.status);
  const keep = lines.filter((l) => { const s = l.trim(); if (!s.startsWith('PUP1.')) return !!s; try { const a = Puppet.decodeAny(s); return !(a && a.id === id); } catch (e) { return true; } });
  keep.push(code);
  const body = { message: `Puppet of ${String(name || id).slice(0, 40)} (LaboHub Discord bot)`, content: Buffer.from(keep.join('\n') + '\n', 'utf8').toString('base64') };
  if (sha) body.sha = sha;
  const put = await fetch(url, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  if (!put.ok) throw new Error(put.status === 404 || put.status === 403 ? 'GitHub refused (token rights on the avatars repository?)' : 'GitHub answered ' + put.status);
  return true;
}

module.exports = { DiscordBot, publishToGitHub, COMMANDS, PARTS };
