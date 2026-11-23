/*
 * LaboHub — Electron main process.
 * Wires the local server, Discord RPC, Twitch chat, avatar sync, updater, windows and shell integration.
 */
const { app, screen, shell, dialog, globalShortcut, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { Store } = require('./store');
const { createServer } = require('./server');
const { DiscordVoiceRPC } = require('./discord-rpc');
const { TwitchChat } = require('./twitch');
const { TwitchApi } = require('./twitch-api');
const { StreamStats } = require('./stream-stats');
const { NowPlaying } = require('./nowplaying');
const { Hub } = require('./hub');
const { Markers, vodTime } = require('./markers');
const { deepMerge, isObj } = require('./settings');
const { alertKey, amountOf, AlertPicker } = require('./alerts');
const { AvatarSync } = require('./sync');
const { Updater, cmpVersion } = require('./updater');
const { Obs } = require('./obs');
const { Deck } = require('./deck');
const { Lab } = require('./lab');
const { LabChat } = require('./lab-chat');
const { LabTools, WEBHOOK_RE } = require('./lab-tools');
const { DiscordBot, publishToGitHub } = require('./discord-bot');
const secrets = require('./secrets');
const { buildDiagnostics } = require('./diagnostics');
const { createWindows } = require('./windows');
const { createDesktop } = require('./desktop');
const { cleanAvatarMap, cleanAvatar, Puppet } = require('./avatars');
const { createLogger } = require('./log');
const I18N = require('../web/shared/i18n.js');

const t = I18N.t;

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
// Overlay windows have no user gesture: let them play chat sounds anyway.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const WEB_DIR = path.join(__dirname, '..', 'web');
const ICON = path.join(__dirname, '..', 'build', 'icon.png');
const START_HIDDEN = process.argv.includes('--hidden');

let log, store, srv, rpc, twitch, sync, updater, windows, desktop, obs, deck;
// La savane: who is in the room, reported by the room window every few seconds (kept 25 s).
let savanePresence = { list: [], at: 0 };
let lab = null, bot = null, renderWin = null, labChat = null, labTools = null, lastLive = null;

// Puppet picture for the Discord bot: a hidden window draws it with the same renderer as the overlay.
async function renderPuppet(avatar) {
  const { BrowserWindow } = require('electron');
  if (!renderWin || renderWin.isDestroyed()) {
    renderWin = new BrowserWindow({ show: false, width: 420, height: 480, webPreferences: { offscreen: true, backgroundThrottling: false } });
    await renderWin.loadURL(`${base()}/render.html`);
  }
  const url = await renderWin.webContents.executeJavaScript(`renderPng(${JSON.stringify(avatar)})`);
  return Buffer.from(String(url).split(',')[1] || '', 'base64');
}
function startBot() {
  bot = new DiscordBot({
    getToken: () => secrets.open(store.getSecret('botToken')), getAppId: () => store.settings.discord.clientId, Puppet, log,
    render: renderPuppet,
    getAvatar: (id) => store.allAvatars()[id] || null,
    saveAvatar: async (a) => {
      const clean = cleanAvatar(a);
      store.setAvatar(clean);
      push({ avatars: true });
      const token = secrets.open(store.getSecret('githubToken'));
      const published = token ? await publishToGitHub({ token, repo: store.settings.bot.githubRepo, path: store.settings.bot.githubPath, code: Puppet.encodeCode(clean), id: clean.id, name: clean.name, Puppet }) : false;
      log.info(`[bot] puppet saved for ${clean.id}${published ? ' and published' : ''}`);
      return { published };
    },
  });
  bot.on('change', () => push());
  if (store.settings.bot.enabled) bot.start();
}
let twitchApi, stats, nowPlaying, hub, markers;
const alertPicker = new AlertPicker();
let port;
let quitting = false;

const base = () => `http://127.0.0.1:${port}`;
const notify = (title, body) => { if (log) log.info('[notify] ' + String(title).slice(0, 80)); if (desktop) desktop.notify(title, body); };
// Diagnostics: every sound LaboHub makes is written to the log with its cause (throttled).
let lastSoundLog = 0;
function logSound(what) { const now = Date.now(); if (now - lastSoundLog < 1000) return; lastSoundLog = now; if (log) log.info('[sound] ' + what); }
const syncLang = () => I18N.setLang(I18N.resolve(store.settings.app.language, app.getLocale()));

process.on('uncaughtException', (e) => { if (log) log.error('uncaught: ' + ((e && e.stack) || e)); });
process.on('unhandledRejection', (e) => { if (log) log.error('unhandled rejection: ' + ((e && e.stack) || e)); });

// First LaboHub launch on a PC that has Puppet Overlay: bring its avatars, Discord login, viewers and settings along, once.
// LaboHub's own data (Twitch account, timestamps, its settings) wins over Puppet Overlay's.
function importPuppetOverlay() {
  const mineFile = path.join(app.getPath('userData'), 'config.json');
  const read = (f) => { try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return isObj(j) ? j : null; } catch (e) { return null; } };
  const mine = read(mineFile) || {};
  if (typeof mine.importedPuppetOverlay === 'boolean') return;
  const theirs = read(path.join(app.getPath('appData'), 'Puppet Overlay', 'config.json'));
  const out = Object.assign({}, theirs || {}, mine, { importedPuppetOverlay: !!theirs });
  if (theirs) {
    out.settings = deepMerge(isObj(theirs.settings) ? theirs.settings : {}, isObj(mine.settings) ? mine.settings : {});
    for (const k of ['avatars', 'syncedAvatars', 'viewers', 'known']) out[k] = Object.assign({}, theirs[k], mine[k]);
    if (!mine.token && theirs.token) out.token = theirs.token; // Discord login: no new authorization popup
  }
  try {
    fs.mkdirSync(path.dirname(mineFile), { recursive: true });
    if (fs.existsSync(mineFile)) fs.copyFileSync(mineFile, mineFile + '.before-import');
    fs.writeFileSync(mineFile, JSON.stringify(out, null, 2));
  } catch (e) { /* the app still starts with its own config */ }
}

function readBundledConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'app-config.json'), 'utf8')); } catch (e) { return {}; }
}

// ---------- State exposed to pages ----------
function appState() {
  const primary = screen.getPrimaryDisplay().id;
  return {
    discord: rpc ? rpc.snapshot() : { status: 'starting', members: [] },
    known: store.data.known,
    syncStatus: sync ? sync.status : { status: 'off' },
    twitchStatus: twitch ? twitch.snapshot() : { status: 'off' },
    twitchAccount: twitchApi ? twitchApi.snapshot() : { status: 'off' },
    stats: stats ? stats.snapshot() : null,
    nowPlaying: nowPlaying ? nowPlaying.snapshot() : null,
    hub: hub ? hub.snapshot() : null,
    obs: obs ? Object.assign({}, obs.snapshot(), { hasPassword: !!store.getSecret('obs') }) : null,
    savane: { presence: Date.now() - savanePresence.at < 25000 ? savanePresence.list : [] },
    lab: lab ? Object.assign({}, lab.snapshot(), { play: labChat ? labChat.snapshot() : null, tools: labTools ? Object.assign(labTools.snapshot(), { hasWebhook: !!store.getSecret('discordWebhook') }) : null }) : null,
    bot: bot ? Object.assign(bot.snapshot(), { hasToken: !!store.getSecret('botToken'), hasGithub: !!store.getSecret('githubToken') }) : null,
    markers: markers ? markers.snapshot() : [],
    app: {
      version: app.getVersion(), placement: windows ? windows.placement : false, lang: I18N.lang,
      hotkeyErrors: desktop ? desktop.hotkeyErrors : {},
      update: updater ? updater.state : null,
      portable: !!process.env.PORTABLE_EXECUTABLE_FILE,
      whatsNew: whatsNewFrom(),
      displays: screen.getAllDisplays().map((d, i) => ({ index: i, label: `${d.id === primary ? 'Primary — ' : ''}${d.size.width}×${d.size.height}`, primary: d.id === primary })),
    },
  };
}
// "What's new" is pending after an update until the panel acknowledges it.
// Returns the previously acknowledged version ('' = unknown, show the current notes only), or null.
function whatsNewFrom() {
  const last = store.data.lastVersion;
  if (last === null) return null;
  return last === '' || cmpVersion(app.getVersion(), last) > 0 ? last : null;
}
function push(opts) {
  if (srv) srv.pushState(opts);
  if (desktop) desktop.refresh();
}

// ---------- Discord ----------
function startDiscord() {
  if (rpc) { rpc.removeAllListeners(); rpc.stop(); }
  const d = store.settings.discord;
  rpc = new DiscordVoiceRPC({
    clientId: d.clientId, clientSecret: d.clientSecret, redirectUri: d.redirectUri,
    getToken: () => (store.data.token && store.data.token.clientId === d.clientId ? store.data.token : null),
    saveToken: (tok) => { store.data.token = tok ? Object.assign({ clientId: d.clientId }, tok) : null; store.save(); },
  });
  rpc.on('status', (s, detail) => { log.info(`[discord] ${s}${detail ? ' — ' + detail : ''}`); push(); });
  rpc.on('channel', () => { store.rememberMembers(rpc.snapshot().members); push(); });
  rpc.on('speaking', (id, speaking) => srv.broadcast('speaking', { id, speaking }));
  rpc.on('error', (e) => log.error('[discord] ' + e.message));
  rpc.on('warn', (e) => log.warn('[discord] ' + e.message));
  rpc.start();
}

// ---------- Twitch ----------
// Labo test features that read your chat keep the anonymous chat connection open.
function labNeedsChat() {
  const l = store.settings.lab;
  const play = labChat ? labChat.snapshot() : null;
  return !!(l.chatbot.enabled || l.sounds.enabled || l.queue.enabled || l.emotes.enabled || l.counters.length || l.hype.enabled
    || (play && (play.giveaway.open || (play.poll && play.poll.open))));
}
function startTwitch() {
  twitch = new TwitchChat({
    getSettings: () => store.settings.twitch,
    setOverride: (login, patch) => { store.setViewer(login, patch); srv.broadcast('viewer', { login, override: store.getViewer(login) }); },
    // Alert sounds and "!clip" need your chat even when viewer puppets are off; the channel defaults to your Twitch account.
    getExtra: () => ({
      active: store.settings.alerts.enabled || store.settings.markers.chatCommand || labNeedsChat(),
      channel: twitchApi && twitchApi.connected ? twitchApi.login : '',
      marker: { enabled: store.settings.markers.chatCommand, name: store.settings.markers.commandName },
    }),
  });
  twitch.on('marker', (m) => addMarker('chat', m.note, m.by).catch(() => {}));
  twitch.on('status', () => { log.info(`[twitch] ${twitch.status} ${twitch.detail || ''}`); push(); });
  twitch.on('chat', (m) => {
    srv.broadcast('chat', m);
    if (lab) lab.onChat(m);
    // The chat bot and games only act on your own channel (the puppets may watch another one).
    if (labChat && (!twitchApi || !twitchApi.login || twitch.channel === twitchApi.login.toLowerCase())) labChat.onChat(m);
    const snd = store.settings.twitch.sound;
    if (snd.mode !== 'none' && !snd.muted && !(snd.skipSelf && m.self)) logSound(`chat ${snd.mode} (${snd.output}) for a Twitch message from ${m.login}`);
  });
  twitch.on('event', onTwitchEvent);
  twitch.sync();
}

// Every Twitch event (IRC or Helix follow): overlay effects, alert sounds, latest-sub widget.
function onTwitchEvent(e) {
  srv.broadcast('twitch-event', e);
  if (lab) lab.onTwitchEvent(e);
  if (labChat) labChat.onEvent(e);
  if (e.type === 'sub' && stats) stats.onSub(e);
  playAlert(e);
}
function playAlert(e) {
  const key = alertKey(e);
  if (!key) return;
  const sounds = alertPicker.pick(store.settings.alerts, key, amountOf(e, key));
  if (sounds.length) { srv.broadcast('alert-sound', { key, sounds, output: store.settings.alerts.output }); logSound(`alert "${key}" (${store.settings.alerts.output}) from Twitch ${e.type || ''} ${e.login || ''}`); }
}

// ---------- Twitch account, counters, now playing, hub ----------
function startStreamTools() {
  twitchApi = new TwitchApi({
    getClientId: () => store.settings.twitchApi.clientId,
    getToken: () => store.data.twitchToken,
    saveToken: (tok) => { store.data.twitchToken = tok; store.save(); },
    log,
  });
  stats = new StreamStats({ api: twitchApi, log });
  hub = new Hub({ api: twitchApi, getSettings: () => store.settings.hub, log });
  markers = new Markers({ api: twitchApi, store, log, getSettings: () => store.settings.markers });
  markers.on('change', () => push());
  twitchApi.on('status', () => { stats.sync(); hub.schedule(); twitch.sync(); if (lab) lab.syncPoints(); push(); });
  lab = new Lab({
    getSettings: () => store.settings.lab, isLive: () => !!(stats && stats.data.live), api: twitchApi, log, t,
    addMarker: (note) => addMarker('hotkey', note, 'Labo test'), notify, say: (text) => hub.say(twitchApi.login, text),
    obsStats: () => (obs && obs.state.status === 'connected' ? obs.state.stats : null),
    pressDeck: (id) => deck.press(id).catch((e) => log.warn('[lab] deck: ' + e.message)),
  });
  lab.on('change', () => push());
  lab.syncPoints();
  labChat = new LabChat({
    getSettings: () => store.settings.lab, live: () => (stats ? stats.data.live : null), api: twitchApi, log, t, notify,
    say: (text) => (twitchApi.login ? hub.say(twitchApi.login, text) : Promise.reject(new Error('Log in with Twitch first'))),
    userIdOf: (login) => hub.userId(login),
    playSound: (snd) => srv.broadcast('alert-sound', { key: 'viewer', sounds: [{ file: snd.file, volume: snd.volume }], output: store.settings.alerts.output }),
    setCounters: (list) => applySettings({ lab: { counters: list } }),
    broadcast: (ev, data) => srv.broadcast(ev, data),
  });
  labChat.on('change', () => push());
  labTools = new LabTools({
    getSettings: () => store.settings.lab, api: twitchApi, live: () => (stats ? stats.data.live : null), log, t, notify,
    say: (text) => (twitchApi.login ? hub.say(twitchApi.login, text) : Promise.reject(new Error('Log in with Twitch first'))),
    getWebhook: () => secrets.open(store.getSecret('discordWebhook')),
    broadcast: (ev, data) => srv.broadcast(ev, data),
  });
  labTools.on('change', () => push());
  stats.on('change', () => {
    // Live start/stop: session summary, Discord go-live message.
    const live = stats.data.live;
    if (JSON.stringify(live && live.startedAt) !== JSON.stringify(lastLive && lastLive.startedAt)) {
      const was = lastLive;
      lastLive = live;
      labChat.onLive(live, was);
      labTools.onLive(live, was).catch(() => {});
    } else lastLive = live;
    push();
  });
  stats.on('follow', (e) => onTwitchEvent(e));
  hub.on('change', () => push());
  hub.on('live', (s) => {
    if (store.settings.hub.notify) notify(t('{name} is live on Twitch', { name: s.display }), [s.game, s.title].filter(Boolean).join(' — ').slice(0, 200));
  });
  nowPlaying = new NowPlaying({ log, coversDir: path.join(app.getPath('userData'), 'covers'), getSettings: () => ({ showCover: store.settings.widgets.spotify.fetchCovers !== false && (store.settings.widgets.looks.spotify.cover !== 'none' || store.settings.widgets.looks.spotify.coverColors) }) });
  nowPlaying.on('change', () => push());
  nowPlaying.setEnabled(store.settings.widgets.spotify.enabled, store.settings.widgets.spotify.source === 'any');
  twitchApi.start();
  hub.schedule();
  markers.start();
}

// Stream timestamp (hotkey, panel button or "!clip" in chat): confirmation as a Windows notification.
async function addMarker(source, note, by) {
  if (!markers) throw new Error('Log in with Twitch to create timestamps.');
  try {
    const m = await markers.add({ source, note, by });
    notify(t('Timestamp added'), `${vodTime(m.offset)}${m.note ? ' — ' + m.note : ''}${m.markerError ? ' ' + t('(Twitch marker refused)') : ''}`);
    return m;
  } catch (e) {
    if (source !== 'button') notify(t('No timestamp created'), t(e.message));
    throw e;
  }
}

// ---------- Settings & actions ----------
const toggleOverlay = () => applySettings({ overlay: { enabled: !store.settings.overlay.enabled } });
const togglePlacement = () => windows.setPlacement(!windows.placement);
const toggleChatMute = () => applySettings({ twitch: { sound: { muted: !store.settings.twitch.sound.muted } } });
const replayFx = () => srv.broadcast('fx-test', {});

const deckKeys = (d) => d.pages.map((p) => p.buttons.map((x) => (x ? x.id + '=' + x.hotkey : ''))).join();

// One BabaDeck action (OBS, LaboHub, Twitch, link).
async function runDeckAction(a) {
  if (!a || !a.type) throw new Error('Unknown action');
  if (a.type.startsWith('obs.')) return obs.run(a);
  switch (a.type) {
    case 'app.marker': return addMarker('button', a.note || '');
    case 'app.overlay': return toggleOverlay();
    case 'app.muteChat': return toggleChatMute();
    case 'app.fx': return replayFx();
    case 'app.savane': return windows.openSavane && windows.openSavane();
    case 'app.alert': {
      const sounds = alertPicker.pick(Object.assign({}, store.settings.alerts, { enabled: true }), a.key, 1e7);
      if (!sounds.length) throw new Error('No sound for this event yet');
      return srv.broadcast('alert-sound', { key: a.key, sounds, output: store.settings.alerts.output, test: true });
    }
    case 'twitch.say': if (!twitchApi || !twitchApi.login) throw new Error('Log in with Twitch first'); return hub.say(twitchApi.login, a.text);
    case 'twitch.clip': {
      const c = await twitchApi.helix('POST', 'clips', { broadcaster_id: twitchApi.userId });
      const id = c.data && c.data[0] && c.data[0].id;
      if (!id) throw new Error('Twitch did not create the clip');
      clipboard.writeText('https://clips.twitch.tv/' + id);
      notify(t('Clip created'), t('Link copied: {url}', { url: 'clips.twitch.tv/' + id }));
      return;
    }
    case 'twitch.title': if (!a.text) throw new Error('Empty title'); return twitchApi.helix('PATCH', 'channels', { broadcaster_id: twitchApi.userId }, { title: a.text.slice(0, 140) });
    // Labo test
    case 'lab.giveaway': return labChat.giveawayOp(a.op);
    case 'lab.poll': return labChat.pollEnd();
    case 'lab.counter': return labChat.bumpCounter(a.name, a.delta === 'reset' ? 'reset' : Number(a.delta) || 1);
    case 'lab.queue': return labChat.queueOp(a.op);
    case 'lab.ad': return labTools.snooze();
    case 'lab.profile': return labTools.applyProfile(a.name);
    case 'lab.sound': return labChat.playByName(a.name);
    case 'url': if (a.url) shell.openExternal(a.url); return;
    default: throw new Error('Unknown action');
  }
}

function applySettings(patch) {
  const prev = store.settings;
  const s = store.updateSettings(patch);
  const changed = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
  if (changed(prev.discord, s.discord)) startDiscord();
  if (prev.overlay.display !== s.overlay.display || prev.twitch.showOnDesktop !== s.twitch.showOnDesktop) windows.rebuildOverlay();
  else windows.updateOverlayVisibility();
  if (changed(prev.sync, s.sync)) sync.schedule();
  if (changed(prev.twitch, s.twitch)) twitch.sync();
  if (changed(prev.alerts.enabled, s.alerts.enabled) || changed(prev.markers, s.markers)) twitch.sync();
  if (twitchApi) {
    if (prev.twitchApi.clientId !== s.twitchApi.clientId) twitchApi.start();
    if (changed(prev.hub, s.hub)) hub.schedule();
    nowPlaying.setEnabled(s.widgets.spotify.enabled, s.widgets.spotify.source === 'any');
  }
  if (changed(prev.app.hotkeys, s.app.hotkeys) || changed(deckKeys(prev.deck), deckKeys(s.deck))) desktop.registerHotkeys();
  if (changed(prev.obs, s.obs)) obs.restart();
  if (lab && changed(prev.lab.points, s.lab.points)) lab.syncPoints();
  if (changed(prev.lab, s.lab)) twitch.sync(); // chat bot / games may need the chat connection
  if (bot && prev.bot.enabled !== s.bot.enabled) { if (s.bot.enabled) bot.start(); else { bot.stop(); bot.set('off'); } }
  if (prev.deck.onTop !== s.deck.onTop) windows.setDeckOnTop(s.deck.onTop);
  if (prev.app.launchAtStartup !== s.app.launchAtStartup) desktop.applyLoginItem();
  if (prev.app.language !== s.app.language) syncLang();
  if (prev.app.taskbarIcon && !s.app.taskbarIcon) windows.hidePanelIfMinimized();
  push();
}

async function exportConfig() {
  const r = await dialog.showSaveDialog(windows.panel, { defaultPath: 'puppet-overlay-backup.json' });
  if (r.canceled || !r.filePath) return;
  const settings = Object.assign({}, store.settings, { discord: Object.assign({}, store.settings.discord, { clientSecret: '' }) });
  await fs.promises.writeFile(r.filePath, JSON.stringify({ settings, avatars: store.data.avatars }, null, 2));
}

// Saves one avatar as a .puppet file and shows it in Explorer, ready to be sent.
async function exportAvatar(id) {
  const av = store.allAvatars()[id];
  if (!av) throw new Error('No avatar for this member yet');
  const file = (av.name || av.id).replace(/[^\w-]+/g, '_') + '.puppet';
  const r = await dialog.showSaveDialog(windows.panel, { defaultPath: path.join(app.getPath('documents'), file), filters: [{ name: 'Puppet', extensions: ['puppet'] }] });
  if (r.canceled || !r.filePath) return;
  await fs.promises.writeFile(r.filePath, Puppet.toFileContent(av));
  shell.showItemInFolder(r.filePath);
}

function copyDiagnostics() {
  clipboard.writeText(buildDiagnostics({
    version: app.getVersion(), portable: !!process.env.PORTABLE_EXECUTABLE_FILE, versions: process.versions,
    locale: app.getLocale(), state: appState(), store, logFile: log.file,
  }));
}

async function onAction(name, b) {
  switch (name) {
    case 'reconnect': store.data.token = null; store.save(); startDiscord(); return;
    case 'open-creator': windows.openCreator(`${base()}/creator.html${/^\d{15,22}$/.test(b.id || '') ? '?id=' + b.id : ''}`); return;
    case 'placement': windows.setPlacement(!!b.on); return;
    case 'update-check': await updater.check(); return;
    case 'update-install': updater.install(); return;
    case 'open-logs': shell.openPath(log.dir); return;
    case 'open-url': if (/^https:\/\/\S+$/.test(b.url || '')) shell.openExternal(b.url); return;
    case 'open-url-local': if (/^[\w.-]+\.html(\?[\w=&%.-]*)?$/.test(b.path || '')) shell.openExternal(`http://localhost:${port}/${b.path}`); return;
    case 'twitch-test':
      if (b.kind === 'follow') { onTwitchEvent({ type: 'follow', login: 'pixelcat', display: 'pixelcat', color: null }); return; }
      twitch.simulate(String(b.kind || 'chat')); return;
    // Alert sound test: plays where the alerts play (app or OBS), with a fake amount high enough for every tier.
    case 'alert-test': {
      const key = String(b.key || '');
      const sounds = alertPicker.pick(Object.assign({}, store.settings.alerts, { enabled: true }), key, 1e7);
      if (!sounds.length) throw new Error('No sound for this event yet');
      srv.broadcast('alert-sound', { key, sounds, output: store.settings.alerts.output, test: true });
      return;
    }
    case 'twitch-login': return { login: await twitchApi.beginLogin() };
    case 'twitch-login-cancel': twitchApi.cancelLogin(); return;
    case 'twitch-logout': await twitchApi.logout(); return;
    case 'stats-refresh': await stats.poll(); return;
    case 'hub-refresh': await hub.poll(); return;
    case 'hub-raid': await hub.startRaid(String(b.login || '')); return;
    case 'hub-raid-cancel': await hub.cancelRaid(); return;
    case 'hub-invite': await hub.inviteStreamTogether(String(b.login || '')); return;
    case 'hub-say': await hub.say(String(b.login || ''), String(b.text || '')); return;
    case 'mod': await hub.moderate(b); return;
    // ---------- OBS + BabaDeck ----------
    case 'obs-password': store.setSecret('obs', b.password ? secrets.seal(String(b.password).slice(0, 200)) : ''); obs.restart(); push(); return;
    case 'obs-reconnect': obs.restart(); return;
    case 'obs-sources': return { sources: await obs.sources(String(b.scene || '')) };
    case 'deck-press': return await deck.press(String(b.id || ''));
    case 'deck-test': await runDeckAction(require('./deck').cleanAction(b.action) || {}); return;
    case 'deck-window': windows.openDeck(); return;
    // ---------- La savane ----------
    case 'savane-open': windows.openSavane(); return;
    // ---------- Discord bot ----------
    case 'bot-token': store.setSecret('botToken', b.token ? secrets.seal(String(b.token).trim().slice(0, 200)) : ''); if (store.settings.bot.enabled) bot.start(); else bot.stop(); push(); return;
    case 'bot-github-token': store.setSecret('githubToken', b.token ? secrets.seal(String(b.token).trim().slice(0, 300)) : ''); push(); return;
    case 'bot-restart': if (store.settings.bot.enabled) await bot.start(); else bot.stop(); return;
    case 'savane-presence': {
      const list = (Array.isArray(b.ids) ? b.ids : []).filter((x) => x && /^[A-Za-z0-9_]{3,60}$/.test(x.id || '')).slice(0, 30).map((x) => ({ id: x.id, label: String(x.label || '').slice(0, 24), me: !!x.me }));
      const same = JSON.stringify(list) === JSON.stringify(savanePresence.list) && Date.now() - savanePresence.at < 25000;
      savanePresence = { list, at: Date.now() };
      if (!same) push(); // the room window repeats the list every 8 s: only real changes reach the pages
      return;
    }
    case 'savane-speaking': srv.broadcast('savane-speaking', { ids: (Array.isArray(b.ids) ? b.ids : []).map(String).filter((x) => /^[A-Za-z0-9_]{3,60}$/.test(x)).slice(0, 30) }); return;
    case 'chat-badges': return { badges: await hub.badges(Array.isArray(b.rooms) ? b.rooms : []) };
    // ---------- Labo test v2 ----------
    case 'lab-giveaway': { const winner = labChat.giveawayOp(String(b.op || '')); twitch.sync(); return { winner }; }
    case 'lab-poll':
      if (b.op === 'start') labChat.pollStart(b); else if (b.op === 'end') labChat.pollEnd(); else labChat.pollClear();
      twitch.sync();
      return;
    case 'lab-counter': labChat.bumpCounter(String(b.id || ''), b.delta === 'reset' ? 'reset' : Math.round(Number(b.delta) || 0)); return;
    case 'lab-queue': labChat.queueOp(String(b.op || ''), String(b.login || '')); return;
    case 'lab-sound-test': labChat.playByName(String(b.name || '')); return;
    case 'lab-summary': return { text: labChat.summaryText() };
    case 'lab-info': return { info: await labTools.info() };
    case 'lab-info-set': await labTools.setInfo(b); return;
    case 'lab-games': return { games: await labTools.searchGames(b.query) };
    case 'lab-profile': await labTools.applyProfile(String(b.name || '')); return;
    case 'lab-ad-snooze': return { ad: await labTools.snooze() };
    case 'lab-ad-refresh': await labTools.readAds(); return;
    case 'lab-webhook': {
      const url = String(b.url || '').trim();
      if (url && !WEBHOOK_RE.test(url)) throw new Error('This is not a Discord webhook link');
      store.setSecret('discordWebhook', url ? secrets.seal(url) : '');
      push();
      return;
    }
    case 'lab-webhook-test': await labTools.postDiscord(stats && stats.data.live, true); return;
    case 'marker-add': return { marker: await addMarker('button', String(b.note || '')) };
    case 'marker-update': markers.update(String(b.id || ''), { note: b.note, done: b.done }); return;
    case 'marker-delete': markers.remove(String(b.id || '')); return;
    case 'marker-delete-day': markers.removeDay(String(b.day || '')); return;
    case 'markers-refresh': await markers.resolveVideos(); return;
    case 'fx-test': replayFx(); return;
    case 'sync-now': await sync.now(); return;
    case 'forget-member': store.forgetMember(String(b.id || '')); push(); return;
    case 'clear-viewers': store.clearViewers(); srv.broadcast('viewers-reset', {}); push(); return;
    case 'export-config': await exportConfig(); return;
    case 'export-avatar': await exportAvatar(String(b.id || '')); return;
    case 'copy-diagnostics': copyDiagnostics(); return;
    case 'whats-new-seen': store.data.lastVersion = app.getVersion(); store.save(); push(); return;
    default: throw new Error('Unknown action');
  }
}

// ---------- Boot ----------
function listen(first) {
  port = first;
  return new Promise((resolve, reject) => {
    let tries = 0;
    srv.server.on('error', (e) => {
      if (e.code === 'EADDRINUSE' && tries++ < 10) { port += 1; srv.server.listen(port, '127.0.0.1'); } else reject(e);
    });
    srv.server.once('listening', resolve);
    srv.server.listen(port, '127.0.0.1');
  });
}

app.on('second-instance', () => windows && windows.openPanel());
app.on('window-all-closed', () => { /* keep running in the tray */ });
app.on('before-quit', () => {
  quitting = true;
  if (rpc) rpc.stop();
  if (twitch) twitch.close();
  if (twitchApi) twitchApi.stop();
  if (stats) stats.stop();
  if (hub) hub.stop();
  if (markers) markers.stop();
  if (nowPlaying) nowPlaying.setEnabled(false);
  if (sync) sync.stop();
  if (srv) srv.close();
  if (store) store.flush();
});
app.on('will-quit', () => globalShortcut.unregisterAll());

app.whenReady().then(async () => {
  app.setAppUserModelId('fr.labo.hub');
  log = createLogger(path.join(app.getPath('userData'), 'logs'));
  log.info(`LaboHub ${app.getVersion()} starting${START_HIDDEN ? ' (hidden)' : ''}`);
  importPuppetOverlay();
  store = new Store(app.getPath('userData'), readBundledConfig(), log);
  store.data.avatars = cleanAvatarMap(store.data.avatars);
  store.data.syncedAvatars = cleanAvatarMap(store.data.syncedAvatars);
  if (store.data.lastVersion === null) { store.data.lastVersion = app.getVersion(); store.save(); } // fresh install: nothing new to show
  syncLang();

  srv = createServer({ webDir: WEB_DIR, soundsDir: path.join(app.getPath('userData'), 'sounds'), coversDir: path.join(app.getPath('userData'), 'covers'), bgDir: path.join(app.getPath('userData'), 'backgrounds'), store, getState: appState, onSettings: applySettings, onAction, onAvatarsChanged: () => push({ avatars: true }) });
  try { await listen(store.settings.port); } catch (e) {
    dialog.showErrorBox('LaboHub', 'Could not start the local server: ' + e.message);
    app.exit(1);
    return;
  }
  log.info('server on ' + base());

  updater = new Updater(log, { getSource: () => store.settings.updates });
  updater.on('change', (st) => {
    push();
    if (st.status === 'ready') notify(t('Update ready'), t('LaboHub {v} will install when you restart the app.', { v: st.latest }));
  });

  windows = createWindows({
    store, log, t, icon: ICON, base,
    isQuitting: () => quitting, notify,
    quit: () => { quitting = true; app.quit(); },
    onChange: push,
    onPanelShown: () => desktop.onPanelShown(),
  });
  desktop = createDesktop({
    store, t, windows, icon: ICON,
    discord: () => (rpc ? rpc.snapshot() : { status: 'starting', members: [] }),
    update: () => updater.state,
    actions: {
      openPanel: () => windows.openPanel(), openCreator: (u) => windows.openCreator(u),
      toggleOverlay, togglePlacement, toggleChatMute, replayFx,
      addMarker: () => { if (markers) addMarker('hotkey').catch(() => {}); },
      deckHotkeys: () => (deck ? deck.hotkeys() : []),
      pressDeck: (id) => deck.press(id).catch((e) => notify('BabaDeck', t(e.message))),
      reconnect: () => rpc && rpc.restart(),
      installUpdate: () => updater.install(),
      quit: () => { quitting = true; app.quit(); },
    },
  });
  sync = new AvatarSync({
    getSettings: () => store.settings.sync,
    onAvatars: (map) => { store.setSyncedAvatars(map); push({ avatars: true }); },
    log,
  });
  sync.on('status', () => push());

  obs = new Obs({ getSettings: () => store.settings.obs, getPassword: () => secrets.open(store.getSecret('obs')), log });
  obs.on('change', () => push());
  obs.restart();
  deck = new Deck({ getSettings: () => store.settings.deck, run: runDeckAction, log });
  // Expire La savane's presence when the room window stopped reporting.
  setInterval(() => { if (savanePresence.list.length && Date.now() - savanePresence.at > 25000) { savanePresence = { list: [], at: 0 }; push(); } }, 10000);

  startBot();
  desktop.createTray();
  startDiscord();
  startTwitch();
  startStreamTools();
  windows.createOverlay();
  sync.schedule();
  desktop.registerHotkeys();
  desktop.applyLoginItem();
  updater.start(4, () => store.settings.app.autoUpdate);
  if (!START_HIDDEN) windows.openPanel();
  else if (store.settings.app.taskbarIcon) windows.openPanel({ minimized: true }); // hidden start still gets its taskbar button
  for (const ev of ['display-removed', 'display-added', 'display-metrics-changed']) screen.on(ev, () => windows.rebuildOverlay());
  push();
});
