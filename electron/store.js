/* JSON persistence in %APPDATA%/Puppet Overlay/config.json (atomic writes, debounced). */
const fs = require('fs');
const path = require('path');
const { DEFAULTS, sanitize, deepMerge, isObj } = require('./settings');

const MAX_VIEWERS = 3000;
const MAX_KNOWN = 300;

// Old configs stay readable: rename/drop values from earlier versions before validation.
function migrate(saved) {
  const s = saved.settings;
  if (!isObj(s)) return saved;
  if (isObj(s.twitch) && s.twitch.palette === 'vif') s.twitch.palette = 'vivid';
  // Installs from before v0.9.0 are already set up: don't show them the first-run guide.
  if (!isObj(s.app)) s.app = {};
  if (s.app.welcomeDone === undefined) s.app.welcomeDone = true;
  // v0.10: the close behaviour used to follow the taskbar toggle.
  if (s.app.closeAction === undefined && s.app.taskbarIcon === false) s.app.closeAction = 'tray';
  return saved; // removed settings (e.g. v0.8.0 screen share) are dropped by sanitize()
}

class Store {
  /** dir: userData folder; bundled: defaults shipped with the build (app-config.json); log: optional logger */
  constructor(dir, bundled, log) {
    this.file = path.join(dir, 'config.json');
    this.log = log || null;
    this.timer = null;
    let saved = {};
    try {
      saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (!isObj(saved)) throw new Error('not an object');
    } catch (e) {
      saved = {};
      // Corrupted file: keep a copy instead of silently losing avatars.
      if (fs.existsSync(this.file)) {
        try { fs.copyFileSync(this.file, this.file + '.broken'); } catch (err) { /* read-only disk: nothing more to do */ }
        this.warn('config.json unreadable, kept as config.json.broken: ' + e.message);
      }
    }
    migrate(saved);
    const defaults = sanitize(deepMerge(DEFAULTS, bundled || {}));
    const obj = (v) => (isObj(v) ? v : {});
    this.data = {
      settings: sanitize(deepMerge(defaults, obj(saved.settings)), defaults),
      avatars: obj(saved.avatars),
      syncedAvatars: obj(saved.syncedAvatars),
      viewers: obj(saved.viewers),
      known: obj(saved.known),
      token: isObj(saved.token) ? saved.token : null,
      // Last version whose "What's new" was acknowledged ('' = installed before v0.9.0 tracked it).
      lastVersion: typeof saved.lastVersion === 'string' ? saved.lastVersion.slice(0, 20) : isObj(saved.settings) ? '' : null,
    };
    if (!this.data.settings.discord.clientId) this.data.settings.discord.clientId = defaults.discord.clientId;
    // Before v0.9.0 there was no bundled sync URL, so an empty one there means "never set": use the crew file.
    if (this.data.lastVersion === '' && !this.data.settings.sync.url) this.data.settings.sync.url = defaults.sync.url;
  }

  warn(msg) { if (this.log) this.log.warn('[store] ' + msg); }

  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 200);
  }
  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    const tmp = this.file + '.tmp';
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (e) {
      // Antivirus or a sync client can lock the file for a moment: retry later instead of crashing.
      this.warn('save failed, retrying: ' + e.message);
      this.timer = setTimeout(() => this.flush(), 2000);
    }
  }

  get settings() { return this.data.settings; }
  updateSettings(patch) {
    this.data.settings = sanitize(deepMerge(this.data.settings, patch), this.data.settings);
    this.save();
    return this.data.settings;
  }

  allAvatars() { return Object.assign({}, this.data.syncedAvatars, this.data.avatars); } // local ones override synced ones
  setAvatar(a) { this.data.avatars[a.id] = a; this.save(); }
  deleteAvatar(id) { delete this.data.avatars[id]; this.save(); }
  setSyncedAvatars(map) { this.data.syncedAvatars = map; this.save(); }

  // Twitch viewer customisations (from chat commands), capped to the most recent ones.
  getViewer(login) { return this.data.viewers[login] || null; }
  setViewer(login, patch) {
    if (patch === null) delete this.data.viewers[login];
    else this.data.viewers[login] = Object.assign({}, this.data.viewers[login], patch, { t: Date.now() });
    const keys = Object.keys(this.data.viewers);
    if (keys.length > MAX_VIEWERS) keys.sort((a, b) => this.data.viewers[a].t - this.data.viewers[b].t).slice(0, keys.length - MAX_VIEWERS).forEach((k) => delete this.data.viewers[k]);
    this.save();
  }
  clearViewers() { this.data.viewers = {}; this.save(); }

  // Everyone seen in a voice channel, so per-member settings work even when they're offline.
  rememberMembers(list) {
    let changed = false;
    const now = Date.now();
    for (const m of list) {
      const k = this.data.known[m.id];
      if (!k || k.name !== m.name || k.avatarHash !== (m.avatarHash || null) || now - k.lastSeen > 60000) {
        this.data.known[m.id] = { name: m.name, avatarHash: m.avatarHash || null, lastSeen: now };
        changed = true;
      }
    }
    const ids = Object.keys(this.data.known);
    if (ids.length > MAX_KNOWN) ids.sort((a, b) => this.data.known[a].lastSeen - this.data.known[b].lastSeen).slice(0, ids.length - MAX_KNOWN).forEach((id) => delete this.data.known[id]);
    if (changed) this.save();
    return changed;
  }
  forgetMember(id) {
    delete this.data.known[id];
    const s = this.data.settings;
    delete s.members[id];
    s.memberOrder = s.memberOrder.filter((x) => x !== id);
    this.save();
  }
}

module.exports = { Store };
