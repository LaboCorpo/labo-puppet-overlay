/* JSON persistence in %APPDATA%/Puppet Overlay/config.json */
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  port: 47800,
  discord: { clientId: '', clientSecret: '', redirectUri: 'http://localhost' },
  overlay: {
    enabled: true, anchor: 'bottom-left', scale: 0.8, spacing: 120, margin: 30,
    showNames: true, hideIdle: false, showSelf: true, glow: true, maxVisible: 12, display: 0,
  },
  twitch: {
    enabled: false, channel: '', scale: 0.5, maxViewers: 20, bubbleSeconds: 7, idleMinutes: 10,
    palette: 'vif', colors: [], hats: true, beards: true, showNames: true, useChatColor: false,
    anchor: 'bottom-right', widthRatio: 0.55, ignore: 'nightbot, streamelements, streamlabs, moobot',
    bubbleBg: '#ffffff', bubbleFg: '#1d1a1f', showOnDesktop: false,
  },
  // V2: shared JSON (e.g. a GitHub Gist raw URL) that every app reads periodically.
  sync: { url: '', intervalSec: 120 },
};

function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over || {})) {
    const v = over[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' && !Array.isArray(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

class Store {
  constructor(dir, bundledDefaults) {
    this.file = path.join(dir, 'config.json');
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) {}
    this.data = deepMerge({ settings: deepMerge(DEFAULTS, bundledDefaults || {}), avatars: {}, syncedAvatars: {}, token: null }, saved);
    // Bundled client ID wins if the user never typed one.
    if (!this.data.settings.discord.clientId && bundledDefaults && bundledDefaults.discord) this.data.settings.discord.clientId = bundledDefaults.discord.clientId || '';
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }
  get settings() { return this.data.settings; }
  updateSettings(patch) { this.data.settings = deepMerge(this.data.settings, patch); this.save(); return this.data.settings; }
  allAvatars() { return Object.assign({}, this.data.syncedAvatars, this.data.avatars); } // local overrides synced
  setAvatar(a) { if (!a.id) throw new Error('Avatar sans ID Discord'); this.data.avatars[a.id] = a; this.save(); }
  deleteAvatar(id) { delete this.data.avatars[id]; this.save(); }
}

module.exports = { Store, DEFAULTS };
