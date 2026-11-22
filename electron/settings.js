/*
 * Settings schema: defaults and validation in one place.
 * sanitize() returns a clean copy: unknown keys dropped, numbers clamped, enums checked,
 * strings length-capped. An invalid value falls back to the previous valid one (or the default).
 */

const DEFAULTS = {
  port: 47800,
  app: {
    language: 'auto', // 'auto' follows Windows, or 'en' / 'fr'
    performance: 'normal', // 'performance' | 'normal' | 'eco'
    launchAtStartup: false,
    taskbarIcon: true, // give the hidden-at-startup panel a taskbar button
    closeAction: 'minimize', // closing the panel window: 'minimize' (stays in the taskbar) | 'tray' | 'quit'
    autoUpdate: true,
    hotkeys: { toggleOverlay: 'CommandOrControl+Shift+O', placement: 'CommandOrControl+Shift+P', muteChat: 'CommandOrControl+Shift+M' },
    firstRunDone: false, // tray notification shown once, on the first panel close
    welcomeDone: false, // first-run guide finished or skipped
  },
  discord: { clientId: '', clientSecret: '', redirectUri: 'http://localhost' },
  overlay: {
    enabled: true, layout: 'horizontal', anchor: 'bottom-left', pos: { x: 0.15, y: 0.92 }, scale: 0.8, spacing: 120, margin: 30,
    showNames: true, hideIdle: false, showSelf: true, glow: false, maxVisible: 12, display: 0,
    entrance: 'random', exit: 'random', statusStyle: 'props', sleepMinutes: 10, lookAtSpeaker: true,
    // Desktop overlay only: puppets fade when the mouse comes near, so they never hide what you're pointing at.
    hoverFade: true, hoverOpacity: 25, hoverRadius: 80,
  },
  twitch: {
    enabled: false, channel: '', scale: 0.5, maxViewers: 20, bubbleSeconds: 7, idleMinutes: 10,
    palette: 'vivid', colors: [], hats: true, beards: true, showNames: true, useChatColor: false,
    layout: 'horizontal', anchor: 'bottom-right', pos: { x: 0.75, y: 0.95 }, widthRatio: 0.55,
    ignore: 'nightbot, streamelements, streamlabs, moobot, fossabot',
    bubbleBg: '#ffffff', bubbleFg: '#1d1a1f', showOnDesktop: false,
    commandsEnabled: true, commandPrefix: '!', hideCommands: true, disabledCommands: [],
    actionCooldown: 5, styleCooldown: 10,
    raidEffects: true, raidMax: 15, subEffects: true, bitsEffects: true, followEffects: true,
    // Chat sounds: played by the desktop app ('app') or by the OBS browser source ('obs'), never both.
    sound: { mode: 'none', output: 'app', volume: 0.6, speed: 1, pitch: 1, voice: '', varyVoices: true, readNames: false, maxChars: 120, maxQueue: 4, muted: false },
  },
  // Per-member overrides keyed by Discord user ID: { hidden, alias, scale }
  members: {},
  memberOrder: [],
  // Shared avatar file (e.g. a GitHub Gist) that every app reads periodically.
  sync: { url: '', intervalSec: 120 },
  // Twitch account (optional, Device Code login): follower/sub counts, raids, Stream Together invites, sending chat.
  twitchApi: { clientId: '' },
  // Alert sounds: several audio files per event. mode: 'random' (never the same twice in a row) | 'sequence' | 'all' (layered).
  // Each sound: { file, name, volume 0..1, min } — min = bits / raiders / gifted subs needed (tiers: the highest reached wins).
  alerts: {
    enabled: true, output: 'app', volume: 0.8,
    follow: { mode: 'random', sounds: [] }, sub: { mode: 'random', sounds: [] }, prime: { mode: 'random', sounds: [] },
    gift: { mode: 'random', sounds: [] }, bits: { mode: 'random', sounds: [] }, raid: { mode: 'random', sounds: [] },
  },
  // OBS widgets (one browser source each). Empty labels use the translated default.
  widgets: {
    font: 'Segoe UI', size: 42, color: '#ffffff', accent: '#ff7a45', style: 'pill', align: 'left', shadow: true,
    followers: { label: '', goal: 0 }, subs: { label: '', goal: 0 },
    latestFollower: { label: '' }, latestSub: { label: '' },
    spotify: { enabled: false, showCover: true, hideWhenPaused: true },
  },
  // Streaming hub: the crew's Twitch channels (logins).
  hub: { members: [], notify: true, pollSec: 60 },
};

const CORNERS = ['bottom-left', 'bottom-center', 'bottom-right', 'top-left', 'top-center', 'top-right', 'custom'];
const ENUMS = {
  'app.language': ['auto', 'en', 'fr'],
  'app.performance': ['performance', 'normal', 'eco'],
  'app.closeAction': ['minimize', 'tray', 'quit'],
  'overlay.layout': ['horizontal', 'vertical'],
  'overlay.anchor': CORNERS,
  'overlay.entrance': ['random', 'walk', 'drop', 'pop', 'portal', 'beam', 'feathers', 'smoke', 'none'],
  'overlay.exit': ['random', 'poof', 'portal', 'beam', 'feathers', 'none'],
  'overlay.statusStyle': ['props', 'badges', 'both'],
  'twitch.layout': ['horizontal', 'vertical'],
  'twitch.anchor': ['bottom-right', 'bottom-left', 'custom'],
  'twitch.palette': ['vivid', 'pastel', 'mono', 'custom'],
  'twitch.sound.mode': ['none', 'gibberish', 'tts'],
  'twitch.sound.output': ['app', 'obs'],
  'alerts.output': ['app', 'obs'],
  'widgets.style': ['plain', 'pill', 'card'],
  'widgets.align': ['left', 'center', 'right'],
};
const ALERT_KEYS = ['follow', 'sub', 'prime', 'gift', 'bits', 'raid'];
for (const k of ALERT_KEYS) ENUMS[`alerts.${k}.mode`] = ['random', 'sequence', 'all'];
// [min, max, integer?]
const RANGES = {
  port: [1024, 65535, true],
  'overlay.pos.x': [0, 1], 'overlay.pos.y': [0, 1],
  'overlay.scale': [0.3, 1.6], 'overlay.spacing': [70, 260], 'overlay.margin': [0, 200],
  'overlay.hoverOpacity': [0, 100, true], 'overlay.hoverRadius': [0, 400, true],
  'overlay.maxVisible': [1, 30, true], 'overlay.display': [0, 15, true], 'overlay.sleepMinutes': [0, 120],
  'twitch.pos.x': [0, 1], 'twitch.pos.y': [0, 1],
  'twitch.scale': [0.25, 1], 'twitch.maxViewers': [1, 80, true], 'twitch.bubbleSeconds': [2, 30], 'twitch.idleMinutes': [1, 120],
  'twitch.widthRatio': [0.2, 1], 'twitch.actionCooldown': [0, 120], 'twitch.styleCooldown': [0, 300], 'twitch.raidMax': [1, 40, true],
  'twitch.sound.volume': [0, 1], 'twitch.sound.speed': [0.5, 2], 'twitch.sound.pitch': [0.5, 2],
  'twitch.sound.maxChars': [10, 400, true], 'twitch.sound.maxQueue': [1, 20, true],
  'sync.intervalSec': [30, 3600, true],
  'alerts.volume': [0, 1],
  'widgets.size': [12, 200, true], 'widgets.followers.goal': [0, 10000000, true], 'widgets.subs.goal': [0, 1000000, true],
  'hub.pollSec': [30, 600, true],
};
const PATTERNS = {
  'discord.clientId': /^(\d{15,22})?$/,
  'discord.redirectUri': /^https?:\/\/\S+$/,
  'sync.url': /^(https?:\/\/\S+)?$/,
  'twitch.bubbleBg': /^#[0-9a-f]{6}$/i,
  'twitch.bubbleFg': /^#[0-9a-f]{6}$/i,
  'twitch.commandPrefix': /^\S{1,3}$/,
  'twitchApi.clientId': /^([a-z0-9]{20,40})?$/,
  'widgets.color': /^#[0-9a-f]{6}$/i,
  'widgets.accent': /^#[0-9a-f]{6}$/i,
  'widgets.font': /^[\w .,'-]{0,60}$/, // goes into CSS font-family: no quotes, braces or semicolons
};
const MAX_LEN = { 'twitch.ignore': 1000, 'sync.url': 500, 'discord.redirectUri': 200, 'discord.clientSecret': 200 };
const SOUND_FILE_RE = /^[a-f0-9]{16}\.(mp3|wav|ogg)$/;
const LOGIN_RE = /^[a-z0-9_]{3,25}$/;
const HOTKEY_RE = /^[\x21-\x7e]{0,60}$/; // Electron accelerator: printable ASCII, no spaces
const ID_RE = /^\d{15,22}$/;
const COMMAND_NAMES = ['jump', 'dance', 'wave', 'hat', 'hair', 'outfit', 'eyes', 'glasses', 'item', 'neck', 'pattern', 'color', 'hatcolor', 'reroll', 'reset', 'puppet'];

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  if (!isObj(over)) return out;
  for (const k of Object.keys(over)) {
    if (FORBIDDEN.has(k)) continue;
    const v = over[k];
    out[k] = isObj(v) && isObj(base && base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

function leaf(path, value, fallback, def) {
  switch (typeof def) {
    case 'boolean': return typeof value === 'boolean' ? value : fallback;
    case 'number': {
      const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
      const r = RANGES[path];
      if (!r) return n;
      const c = Math.min(r[1], Math.max(r[0], n));
      return r[2] ? Math.round(c) : c;
    }
    case 'string': {
      if (typeof value !== 'string') return fallback;
      const v = path === 'discord.clientId' ? value.trim() : value;
      if (ENUMS[path] && !ENUMS[path].includes(v)) return fallback;
      if (PATTERNS[path] && !PATTERNS[path].test(v)) return fallback;
      if (path.startsWith('app.hotkeys.') && !HOTKEY_RE.test(v)) return fallback;
      return v.slice(0, MAX_LEN[path] || 100);
    }
    default: return fallback;
  }
}

function sanitizeMembers(value, fallback) {
  if (!isObj(value)) return fallback;
  const out = {};
  for (const [id, m] of Object.entries(value).slice(0, 500)) {
    if (!ID_RE.test(id) || !isObj(m)) continue;
    const e = {};
    if (typeof m.hidden === 'boolean') e.hidden = m.hidden;
    if (typeof m.alias === 'string') e.alias = m.alias.trim().slice(0, 32);
    if (Number.isFinite(Number(m.scale)) && m.scale !== null && m.scale !== '') e.scale = Math.min(1.8, Math.max(0.5, Number(m.scale)));
    out[id] = e;
  }
  return out;
}

// Alert sound lists: files must be ones the app stored (random hex names), other fields clamped.
function sanitizeSounds(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const out = [];
  for (const x of value.slice(0, 30)) {
    if (!isObj(x) || typeof x.file !== 'string' || !SOUND_FILE_RE.test(x.file)) continue;
    const vol = Number(x.volume), min = Number(x.min);
    out.push({
      file: x.file,
      name: typeof x.name === 'string' ? x.name.slice(0, 80) : x.file,
      volume: Number.isFinite(vol) && x.volume !== null && x.volume !== '' ? Math.min(1, Math.max(0, vol)) : 1,
      min: Number.isFinite(min) ? Math.min(10000000, Math.max(0, Math.round(min))) : 0,
    });
  }
  return out;
}

// Special-cased paths: free-form maps and arrays.
const SPECIAL = {
  members: sanitizeMembers,
  memberOrder: (v, fb) => (Array.isArray(v) ? [...new Set(v.map(String).filter((id) => ID_RE.test(id)))].slice(0, 500) : fb),
  'twitch.colors': (v, fb) => (Array.isArray(v) ? v.filter((c) => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c)).slice(0, 24) : fb),
  'twitch.disabledCommands': (v, fb) => (Array.isArray(v) ? [...new Set(v.map((c) => String(c).toLowerCase()).filter((c) => COMMAND_NAMES.includes(c)))] : fb),
  'hub.members': (v, fb) => (Array.isArray(v) ? [...new Set(v.map((c) => String(c).trim().toLowerCase().replace(/^@/, '')).filter((c) => LOGIN_RE.test(c)))].slice(0, 100) : fb),
};
for (const k of ALERT_KEYS) SPECIAL[`alerts.${k}.sounds`] = sanitizeSounds;

function walk(value, fallback, def, path) {
  if (SPECIAL[path]) return SPECIAL[path](value, fallback);
  if (isObj(def)) {
    const v = isObj(value) ? value : {};
    const fb = isObj(fallback) ? fallback : def;
    const out = {};
    for (const k of Object.keys(def)) out[k] = walk(v[k], fb[k], def[k], path ? path + '.' + k : k);
    return out;
  }
  return leaf(path, value, fallback === undefined ? def : fallback, def);
}

/** Validates a full settings object. `previous` (already valid) supplies fallbacks for invalid values. */
function sanitize(settings, previous) {
  return walk(settings, previous || DEFAULTS, DEFAULTS, '');
}

module.exports = { DEFAULTS, sanitize, deepMerge, isObj, ALERT_KEYS, SOUND_FILE_RE };
