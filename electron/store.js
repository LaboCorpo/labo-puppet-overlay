/* JSON persistence in %APPDATA%/Puppet Overlay/config.json (atomic writes, debounced). */
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  port: 47800,
  app: {
    language: 'auto', // 'auto' follows Windows, or 'en' / 'fr'
    launchAtStartup: false,
    autoUpdate: true,
    hotkeys: { toggleOverlay: 'CommandOrControl+Shift+O', placement: 'CommandOrControl+Shift+P' },
    firstRunDone: false,
  },
  discord: { clientId: '', clientSecret: '', redirectUri: 'http://localhost' },
  overlay: {
    enabled: true, anchor: 'bottom-left', pos: { x: 0.15, y: 0.92 }, scale: 0.8, spacing: 120, margin: 30,
    showNames: true, hideIdle: false, showSelf: true, glow: false, maxVisible: 12, display: 0,
    entrance: 'random', statusStyle: 'props', sleepMinutes: 10, lookAtSpeaker: true,
  },
  twitch: {
    enabled: false, channel: '', scale: 0.5, maxViewers: 20, bubbleSeconds: 7, idleMinutes: 10,
    palette: 'vivid', colors: [], hats: true, beards: true, showNames: true, useChatColor: false,
    anchor: 'bottom-right', pos: { x: 0.75, y: 0.95 }, widthRatio: 0.55,
    ignore: 'nightbot, streamelements, streamlabs, moobot, fossabot',
    bubbleBg: '#ffffff', bubbleFg: '#1d1a1f', showOnDesktop: false,
    commandsEnabled: true, commandPrefix: '!', hideCommands: true, disabledCommands: [],
    actionCooldown: 5, styleCooldown: 10,
    raidEffects: true, raidMax: 15, subEffects: true, bitsEffects: true,
  },
  // Shared JSON (e.g. a GitHub Gist raw URL) that every app reads periodically.
  sync: { url: '', intervalSec: 120 },
};

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over || {})) {
    const v = over[k];
    out[k] = isObj(v) && isObj(base && base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

function migrate(saved) {
  const s = saved.settings;
  if (s && s.twitch && s.twitch.palette === 'vif') s.twitch.palette = 'vivid';
  return saved;
}

class Store {
  constructor(dir, bundledDefaults) {
    this.file = path.join(dir, 'config.json');
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) {
      // Corrupted file: keep a copy instead of silently losing avatars.
      if (fs.existsSync(this.file)) try { fs.copyFileSync(this.file, this.file + '.broken'); } catch (err) {}
    }
    migrate(saved);
    this.data = deepMerge({ settings: deepMerge(DEFAULTS, bundledDefaults || {}), avatars: {}, syncedAvatars: {}, viewers: {}, token: null }, saved);
    if (!this.data.settings.discord.clientId && bundledDefaults && bundledDefaults.discord) this.data.settings.discord.clientId = bundledDefaults.discord.clientId || '';
    this.timer = null;
  }
  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 200);
  }
  flush() {
    clearTimeout(this.timer);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
  get settings() { return this.data.settings; }
  updateSettings(patch) { this.data.settings = deepMerge(this.data.settings, patch); this.save(); return this.data.settings; }
  allAvatars() { return Object.assign({}, this.data.syncedAvatars, this.data.avatars); } // local overrides synced
  setAvatar(a) { if (!a.id) throw new Error('Avatar has no Discord ID'); this.data.avatars[a.id] = a; this.save(); }
  deleteAvatar(id) { delete this.data.avatars[id]; this.save(); }

  // Twitch viewer customisations (from chat commands). Capped to the most recent 3000.
  getViewer(login) { return this.data.viewers[login] || null; }
  setViewer(login, patch) {
    if (patch === null) delete this.data.viewers[login];
    else this.data.viewers[login] = Object.assign({}, this.data.viewers[login], patch, { t: Date.now() });
    const keys = Object.keys(this.data.viewers);
    if (keys.length > 3000) keys.sort((a, b) => this.data.viewers[a].t - this.data.viewers[b].t).slice(0, keys.length - 3000).forEach((k) => delete this.data.viewers[k]);
    this.save();
  }
  clearViewers() { this.data.viewers = {}; this.save(); }
}

module.exports = { Store, DEFAULTS };
