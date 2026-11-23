/*
 * Settings schema: defaults and validation in one place.
 * sanitize() returns a clean copy: unknown keys dropped, numbers clamped, enums checked,
 * strings length-capped. An invalid value falls back to the previous valid one (or the default).
 */

const WidgetSchema = require('../web/shared/widget-schema.js');

const DEFAULTS = {
  port: 47800,
  app: {
    language: 'auto', // 'auto' follows Windows, or 'en' / 'fr'
    performance: 'normal', // 'performance' | 'normal' | 'eco'
    launchAtStartup: false,
    taskbarIcon: true, // give the hidden-at-startup panel a taskbar button
    closeAction: 'minimize', // closing the panel window: 'minimize' (stays in the taskbar) | 'tray' | 'quit'
    autoUpdate: true,
    hotkeys: { toggleOverlay: 'CommandOrControl+Shift+O', placement: 'CommandOrControl+Shift+P', muteChat: 'CommandOrControl+Shift+M', marker: 'CommandOrControl+Alt+M' },
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
    sound: { mode: 'none', output: 'app', volume: 0.6, speed: 1, pitch: 1, voice: '', varyVoices: true, readNames: false, maxChars: 120, maxQueue: 4, muted: false, skipSelf: true },
  },
  // Per-member overrides keyed by Discord user ID: { hidden, alias, scale }
  members: {},
  memberOrder: [],
  // Shared avatar file (e.g. a GitHub Gist) that every app reads periodically.
  sync: { url: '', intervalSec: 120 },
  // Twitch account (optional, Device Code login): follower/sub counts, raids, Stream Together invites, sending chat.
  twitchApi: { clientId: '' },
  // La savane: video room through VDO.Ninja (room + password shared by the crew) and its scene for OBS.
  savane: {
    room: '', password: '', name: '', audioInObs: true,
    layout: 'grid', shape: 'rounded', radius: 28, gap: 28, padding: 56, border: 5, borderColor: '#ffc93c', glow: true,
    names: true, nameBg: '#14110a', nameFg: '#ffffff', speaking: true,
    bg: 'gradient', bgColor1: '#2b1a4a', bgColor2: '#f0a83a', bgAngle: 135, bgAnimate: true, bgImage: '', bgBlur: 0, bgDim: 15,
    width: 1920, height: 1080, hidden: [], title: '', titleColor: '#ffffff',
    // Room window edits: free layout positions (ratios of the scene, last = on top), names shown instead of the real ones, order, logo.
    positions: [], labels: {}, order: [], logo: '', logoPos: 'tr', logoSize: 180,
  },
  // Discord bot for creating puppets in Discord (runs on the host's LaboHub). Tokens are kept encrypted outside the settings.
  bot: { enabled: false, githubRepo: 'LaboCorpo/labo-puppet-avatars', githubPath: 'avatars.txt' },
  // Labo test experiments (electron/lab.js).
  lab: {
    hype: { enabled: false, factor: 3, minPerMin: 15 },
    breakMinutes: 0,
    healthAlerts: true,
    raidThanks: { enabled: false, text: 'Merci pour le raid {name} ! Allez voir twitch.tv/{login} 💜' },
    points: { enabled: false, map: [] },
    // v1.6 — chat bot (electron/lab-chat.js). Replies are sent with your Twitch account.
    chatbot: {
      enabled: false,
      commands: [{ name: 'discord', reply: 'Le Discord du Labo : https://discord.gg/… 💜', cooldown: 30, modOnly: false }],
      timers: [], timerLines: 5,
      uptime: true, uptimeText: 'En live depuis {uptime} ⏱',
      so: true, soText: 'Allez voir {name} sur https://twitch.tv/{login} 💜 (dernier jeu : {game})',
      lurk: true, lurkText: '{name} passe en mode lurk, merci du soutien 💜',
      list: true,
      welcome: false, welcomeText: 'Bienvenue {name} ! 👋 Première fois ici, installe-toi.',
    },
    // Sound commands: !<name> plays the file where alert sounds play. who: all | vip (VIPs and subs) | subs | mods.
    sounds: { enabled: false, who: 'all', cooldown: 15, userCooldown: 60, list: [] },
    giveaway: { keyword: 'join', subLuck: 2, announce: true },
    poll: { announce: true, seconds: 60 },
    counters: [], // [{ id, name, cmd, value, modOnly }]
    queue: { enabled: false, joinCmd: 'play', leaveCmd: 'leave', max: 50, announce: true },
    emotes: { enabled: false, max: 40 }, // emote rain overlay (keeps your chat connected)
    ads: { enabled: false, warnSec: 60, chat: true, chatText: '📺 Petite pub dans {s} s : merci de rester, on revient vite ! 💜' },
    discordLive: { enabled: false, text: '🔴 {name} est en live : **{title}** ({game})\nhttps://twitch.tv/{login}' }, // the webhook URL is kept encrypted outside the settings
    profiles: [], // stream info presets: [{ name, title, gameId, gameName }]
    checklist: ['Micro allumé, au bon niveau', 'Bonne scène OBS', 'Titre et catégorie à jour', 'Alertes testées', 'Bouteille d\'eau 💧'],
    summary: true,
  },
  // OBS remote (obs-websocket v5). The password is kept encrypted outside the settings.
  obs: { enabled: false, host: '127.0.0.1', port: 4455 },
  // BabaDeck: pages of buttons (see electron/deck.js).
  deck: { cols: 5, rows: 3, pages: [{ name: 'Page 1', buttons: [] }], onTop: true },
  // OBS scenes made of several widgets: [{ id, name, width, height, items: [{ w, x, y, width, height }] }]
  scenes: [],
  // LaboHub updates: GitHub releases of this repo whose tag starts with tagPrefix and that carry an app.asar.
  updates: { repo: 'LaboCorpo/labo-puppet-overlay', tagPrefix: 'labohub-v' },
  // Alert sounds: several audio files per event. mode: 'random' (never the same twice in a row) | 'sequence' | 'all' (layered).
  // Each sound: { file, name, volume 0..1, min } — min = bits / raiders / gifted subs needed (tiers: the highest reached wins).
  alerts: {
    enabled: true, output: 'app', volume: 0.8,
    follow: { mode: 'random', sounds: [] }, sub: { mode: 'random', sounds: [] }, prime: { mode: 'random', sounds: [] },
    gift: { mode: 'random', sounds: [] }, bits: { mode: 'random', sounds: [] }, raid: { mode: 'random', sounds: [] },
  },
  // OBS widgets (one browser source each). `looks`: one complete look per widget, validated by web/shared/widget-schema.js.
  // spotify.enabled runs the "now playing" watcher; source: 'spotify' only, or 'any' player that shows in the Windows media controls.
  // chat.channels: channels of the OBS chat widget (empty = your own channel).
  widgets: { looks: WidgetSchema.sanitizeLooks({}), spotify: { enabled: false, source: 'spotify', fetchCovers: true }, chat: { channels: [] } },
  // Streaming hub: the crew's Twitch channels (logins).
  hub: { members: [], notify: true, pollSec: 60 },
  // Stream timestamps (hotkey in app.hotkeys.marker): "!clip [note]" by the broadcaster or a mod,
  // a Twitch stream marker too, and VOD links that start leadSeconds before the moment.
  markers: { chatCommand: true, commandName: 'clip', twitchMarker: true, leadSeconds: 30, createClip: true },
};

const CORNERS = ['bottom-left', 'bottom-center', 'bottom-right', 'top-left', 'top-center', 'top-right', 'custom'];
const ENUMS = {
  'savane.layout': ['grid', 'spotlight', 'side', 'podcast', 'stack', 'free'],
  'savane.logoPos': ['tl', 'tr', 'bl', 'br'],
  'savane.shape': ['rect', 'rounded', 'circle', 'squircle', 'hexagon', 'blob'],
  'savane.bg': ['gradient', 'radial', 'color', 'image', 'none'],
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
  'widgets.spotify.source': ['spotify', 'any'],
};
ENUMS['lab.sounds.who'] = ['all', 'vip', 'subs', 'mods'];
const ALERT_KEYS = ['follow', 'sub', 'prime', 'gift', 'bits', 'raid'];
for (const k of ALERT_KEYS) ENUMS[`alerts.${k}.mode`] = ['random', 'sequence', 'all'];
// [min, max, integer?]
const RANGES = {
  'lab.sounds.cooldown': [0, 600, true], 'lab.sounds.userCooldown': [0, 3600, true], 'lab.giveaway.subLuck': [1, 10, true], 'lab.poll.seconds': [10, 1800, true],
  'lab.queue.max': [1, 500, true], 'lab.emotes.max': [5, 150, true], 'lab.ads.warnSec': [10, 300, true], 'lab.chatbot.timerLines': [0, 200, true],
  'lab.hype.factor': [1.5, 10], 'lab.hype.minPerMin': [3, 500, true], 'lab.breakMinutes': [0, 600, true],
  'savane.radius': [0, 400, true], 'savane.gap': [0, 200, true], 'savane.padding': [0, 400, true], 'savane.border': [0, 30, true],
  'savane.bgAngle': [0, 360, true], 'savane.bgBlur': [0, 40, true], 'savane.bgDim': [0, 90, true], 'savane.width': [320, 3840, true], 'savane.height': [240, 3840, true], 'savane.logoSize': [40, 600, true],
  port: [1024, 65535, true],
  'obs.port': [1, 65535, true],
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
  'hub.pollSec': [30, 600, true],
  'markers.leadSeconds': [0, 600, true],
};
const PATTERNS = {
  'savane.room': /^([A-Za-z0-9_]{4,40})?$/, 'savane.password': /^([\w.-]{4,40})?$/, 'savane.name': /^[^<>"&]{0,24}$/, 'savane.title': /^[^<>"&]{0,60}$/,
  'savane.borderColor': /^#[0-9a-f]{6}$/i, 'savane.nameBg': /^#[0-9a-f]{6}$/i, 'savane.nameFg': /^#[0-9a-f]{6}$/i, 'savane.bgColor1': /^#[0-9a-f]{6}$/i,
  'savane.bgColor2': /^#[0-9a-f]{6}$/i, 'savane.titleColor': /^#[0-9a-f]{6}$/i, 'savane.bgImage': /^(\/backgrounds\/[a-f0-9]{16}\.(png|jpg|webp|gif))?$/,
  'savane.logo': /^(\/backgrounds\/[a-f0-9]{16}\.(png|jpg|webp|gif))?$/,
  'discord.clientId': /^(\d{15,22})?$/,
  'discord.redirectUri': /^https?:\/\/\S+$/,
  'sync.url': /^(https?:\/\/\S+)?$/,
  'twitch.bubbleBg': /^#[0-9a-f]{6}$/i,
  'twitch.bubbleFg': /^#[0-9a-f]{6}$/i,
  'twitch.commandPrefix': /^\S{1,3}$/,
  'twitchApi.clientId': /^([a-z0-9]{20,40})?$/,
  'updates.repo': /^([\w.-]{1,39}\/[\w.-]{1,100})?$/,
  'obs.host': /^[\w.-]{1,100}$/,
  'lab.raidThanks.text': /^[^\n]{1,400}$/,
  'lab.chatbot.uptimeText': /^[^\n]{1,400}$/, 'lab.chatbot.soText': /^[^\n]{1,400}$/, 'lab.chatbot.lurkText': /^[^\n]{1,400}$/, 'lab.chatbot.welcomeText': /^[^\n]{1,400}$/,
  'lab.ads.chatText': /^[^\n]{1,400}$/, 'lab.discordLive.text': /^[\s\S]{1,1500}$/,
  'lab.giveaway.keyword': /^[a-z0-9_]{1,25}$/, 'lab.queue.joinCmd': /^[a-z0-9_]{1,25}$/, 'lab.queue.leaveCmd': /^[a-z0-9_]{1,25}$/,
  'bot.githubRepo': /^([\w.-]{1,39}\/[\w.-]{1,100})?$/, 'bot.githubPath': /^[\w./-]{1,100}$/,
  'updates.tagPrefix': /^[\w.-]{1,20}$/,
  'markers.commandName': /^[a-z0-9_]{1,20}$/,
};
const MAX_LEN = { 'twitch.ignore': 1000, 'sync.url': 500, 'discord.redirectUri': 200, 'discord.clientSecret': 200, 'lab.raidThanks.text': 400,
  'lab.chatbot.uptimeText': 400, 'lab.chatbot.soText': 400, 'lab.chatbot.lurkText': 400, 'lab.chatbot.welcomeText': 400, 'lab.ads.chatText': 400, 'lab.discordLive.text': 1500 };
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
  'widgets.looks': (v, fb) => WidgetSchema.sanitizeLooks(v, fb),
  'hub.members': (v, fb) => (Array.isArray(v) ? [...new Set(v.map((c) => String(c).trim().toLowerCase().replace(/^@/, '')).filter((c) => LOGIN_RE.test(c)))].slice(0, 100) : fb),
  deck: (v, fb) => require('./deck').cleanDeck(v, fb),
  scenes: (v, fb) => (Array.isArray(v) ? v.filter(isObj).slice(0, 20).map(cleanScene).filter(Boolean) : fb),
  'savane.hidden': (v, fb) => (Array.isArray(v) ? v.map(String).filter((x) => SAV_ID.test(x)).slice(0, 30) : fb),
  'savane.order': (v, fb) => (Array.isArray(v) ? [...new Set(v.map(String).filter((x) => SAV_ID.test(x)))].slice(0, 30) : fb),
  'savane.positions': (v, fb) => (Array.isArray(v) ? cleanPositions(v) : fb),
  'savane.labels': (v, fb) => {
    if (!isObj(v)) return fb;
    const out = {};
    for (const [id, name] of Object.entries(v).slice(0, 60)) { const n = String(name == null ? '' : name).replace(/[<>"&]/g, '').trim().slice(0, 24); if (SAV_ID.test(id) && n) out[id] = n; }
    return out;
  },
  'lab.points.map': (v, fb) => (Array.isArray(v) ? v.filter(isObj).slice(0, 30).map((x) => ({ reward: String(x.reward || '').slice(0, 45), button: /^[a-z0-9]{4,16}$/.test(x.button || '') ? x.button : '' })).filter((x) => x.reward && x.button) : fb),
  'lab.chatbot.commands': (v, fb) => (Array.isArray(v) ? uniqBy(v.filter(isObj).map((x) => ({ name: cmdName(x.name), reply: line(x.reply, 400), cooldown: clampN(x.cooldown, 0, 3600, 30), modOnly: !!x.modOnly })).filter((x) => x.name && x.reply), 'name').slice(0, 50) : fb),
  'lab.chatbot.timers': (v, fb) => (Array.isArray(v) ? v.filter(isObj).map((x) => ({ text: line(x.text, 400), minutes: clampN(x.minutes, 1, 240, 15) })).filter((x) => x.text).slice(0, 10) : fb),
  'lab.sounds.list': (v, fb) => (Array.isArray(v) ? uniqBy(v.filter(isObj).filter((x) => SOUND_FILE_RE.test(String(x.file || ''))).map((x) => ({ name: cmdName(x.name), file: String(x.file), volume: Math.min(1, Math.max(0, Number.isFinite(Number(x.volume)) && x.volume !== null && x.volume !== '' ? Number(x.volume) : 1)) })).filter((x) => x.name), 'name').slice(0, 40) : fb),
  'lab.counters': (v, fb) => (Array.isArray(v) ? uniqBy(v.filter(isObj).map((x, i) => ({ id: /^[a-z0-9]{4,12}$/.test(String(x.id || '')) ? String(x.id) : 'c' + i + Math.random().toString(36).slice(2, 7).replace(/[^a-z0-9]/g, 'x'), name: line(x.name, 30) || 'Counter', cmd: cmdName(x.cmd), value: clampN(x.value, -1e6, 1e6, 0), modOnly: x.modOnly !== false })).filter((x) => x.cmd), 'cmd').slice(0, 12) : fb),
  'lab.profiles': (v, fb) => (Array.isArray(v) ? v.filter(isObj).map((x) => ({ name: line(x.name, 30), title: line(x.title, 140), gameId: /^\d{1,20}$/.test(String(x.gameId || '')) ? String(x.gameId) : '', gameName: line(x.gameName, 80) })).filter((x) => x.name && (x.title || x.gameId)).slice(0, 12) : fb),
  'lab.checklist': (v, fb) => (Array.isArray(v) ? v.map((x) => line(x, 80)).filter(Boolean).slice(0, 20) : fb),
  'widgets.chat.channels': (v, fb) => (Array.isArray(v) ? [...new Set(v.map((x) => String(x).toLowerCase()).filter((x) => /^[a-z0-9_]{3,25}$/.test(x)))].slice(0, 6) : fb),
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

// Labo test lists: one-line texts, chat command names (letters, digits, _), no duplicates.
const line = (v, n) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim().slice(0, n);
const cmdName = (v) => { const s = String(v || '').trim().toLowerCase().replace(/^!/, ''); return /^[a-z0-9_]{1,25}$/.test(s) ? s : ''; };
const uniqBy = (list, k) => { const seen = new Set(); return list.filter((x) => (seen.has(x[k]) ? false : seen.add(x[k]))); };

// La savane free layout: one entry per camera, ratios of the scene size; duplicates keep the last one (on top).
const SAV_ID = /^[A-Za-z0-9_]{3,60}$/;
function cleanPositions(v) {
  const r = (x, lo, hi) => { const n = Number(x); return Number.isFinite(n) ? Math.round(Math.min(hi, Math.max(lo, n)) * 10000) / 10000 : null; };
  const out = [];
  for (const p of v.filter(isObj).slice(-30)) {
    if (!SAV_ID.test(String(p.id || ''))) continue;
    const e = { id: String(p.id), x: r(p.x, -0.5, 1.5), y: r(p.y, -0.5, 1.5), w: r(p.w, 0.02, 2), h: r(p.h, 0.02, 2) };
    if ([e.x, e.y, e.w, e.h].includes(null)) continue;
    const i = out.findIndex((o) => o.id === e.id);
    if (i >= 0) out.splice(i, 1);
    out.push(e);
  }
  return out;
}

const SCENE_WIDGETS = ['followers', 'subs', 'latestFollower', 'latestSub', 'spotify', 'chat', 'alerts'];
const clampN = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
function cleanScene(sc) {
  const id = String(sc.id || '');
  if (!/^[a-z0-9]{6,16}$/.test(id)) return null;
  const width = clampN(sc.width, 200, 3840, 1920), height = clampN(sc.height, 200, 3840, 1080);
  const items = (Array.isArray(sc.items) ? sc.items : []).filter(isObj).filter((it) => SCENE_WIDGETS.includes(it.w)).slice(0, 24).map((it) => ({
    w: it.w, x: clampN(it.x, -2000, 3840, 0), y: clampN(it.y, -2000, 3840, 0), width: clampN(it.width, 40, 3840, 400), height: clampN(it.height, 40, 3840, 150),
  }));
  return { id, name: String(sc.name || 'Scene').slice(0, 40), width, height, items };
}
module.exports = { DEFAULTS, sanitize, deepMerge, isObj, ALERT_KEYS, SOUND_FILE_RE };
