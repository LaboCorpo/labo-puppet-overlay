/*
 * Automated checks, run with `npm test` (locally and in CI before the build). No dependencies.
 * - syntax of every script
 * - avatar format (normalize, share codes, legacy values)
 * - render smoke test: every part drawn on a recording 2D context, plus overlay frames (Discord, Twitch, effects)
 * - settings validation, store load/save, avatar sync parsing, Twitch IRC parsing, local server API
 * - French translations for UI strings
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const ROOT = path.join(__dirname, '..');
const rel = (...p) => path.join(ROOT, ...p);
const read = (...p) => fs.readFileSync(rel(...p), 'utf8');
const results = [];
async function test(name, fn) {
  try { await fn(); results.push([true, name]); } catch (e) { results.push([false, name, e]); }
}

function listJs(dir) {
  const out = [];
  for (const ent of fs.readdirSync(rel(dir), { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listJs(p));
    else if (ent.name.endsWith('.js')) out.push(p);
  }
  return out;
}

// ---------- Browser-like globals for the web/ scripts ----------
// Recording 2D context: every method is a no-op, text width is approximated, properties are stored.
function mockContext(w = 1920, h = 1080) {
  const calls = { n: 0 };
  const target = {
    canvas: { width: w, height: h },
    measureText: (s) => ({ width: String(s).length * 7 }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    getImageData: (x, y, cw, ch) => ({ data: new Uint8ClampedArray(cw * ch * 4) }),
  };
  return new Proxy(target, {
    get(t, k) { if (k === '__calls') return calls.n; if (k in t) return t[k]; return () => { calls.n++; }; },
    set(t, k, v) { t[k] = v; return true; },
  });
}
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.Image = class { constructor() { this.onload = null; this.onerror = null; } set src(v) { this._src = v; } get src() { return this._src; } };
const loadWeb = (file) => vm.runInThisContext(read(file), { filename: file });

const PUPPET_FILES = ['avatar', 'gfx', 'animator', 'body', 'face', 'hair', 'extras', 'render'].map((f) => `web/shared/puppet/${f}.js`);

(async () => {
  // ---------- Syntax ----------
  // Windows (CI build, users' checkouts) rejects names with quotes, backslashes, ':' '*' '?' '<' '>' '|' etc.
  await test('repository file names are Windows-safe', () => {
    let files = [];
    try { files = require('child_process').execFileSync('git', ['ls-files', '-z'], { cwd: ROOT }).toString().split('\0').filter(Boolean); } catch (e) { return; } // not a git checkout
    const bad = files.filter((f) => !/^[A-Za-z0-9._/ -]+$/.test(f) || /[. ]$/.test(f));
    assert.equal(bad.length, 0, 'Non-portable file names:\n       ' + bad.join('\n       '));
  });

  await test('syntax of every script', () => {
    const files = [...listJs('electron'), ...listJs('web'), ...listJs('tools')];
    const bad = [];
    for (const f of files) { try { new vm.Script(read(f), { filename: f }); } catch (e) { bad.push(`${f}: ${e.message}`); } }
    assert.deepEqual(bad, []);
  });

  // Every web page loads scripts that exist, in an order where dependencies come first.
  await test('pages reference existing scripts', () => {
    for (const page of ['web/overlay.html', 'web/panel.html', 'web/creator.html', 'web/widget.html']) {
      const srcs = [...read(page).matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
      for (const s of srcs) assert.ok(fs.existsSync(rel('web', s)), `${page}: missing ${s}`);
      const puppet = srcs.filter((s) => s.startsWith('shared/puppet/'));
      if (page !== 'web/widget.html') assert.deepEqual(puppet, PUPPET_FILES.map((f) => f.replace('web/', '')), `${page}: puppet modules missing or out of order`);
      // panel-*.js and widget.js use shared modules: those must load first.
      const at = (f) => srcs.indexOf(f);
      for (const extra of srcs.filter((f) => /^(panel-|widget\.js)/.test(f))) assert.ok(at('shared/i18n.js') < at(extra) && (extra === 'widget.js' || at('panel.js') < at(extra)), `${page}: ${extra} loads too early`);
    }
  });

  PUPPET_FILES.forEach(loadWeb);
  loadWeb('web/shared/i18n.js');
  const P = globalThis.Puppet;

  // ---------- Avatar format ----------
  await test('avatar: defaults survive normalize', () => {
    const d = P.defaultAvatar();
    assert.deepEqual(P.normalize(d), Object.assign(d, { photo: null }));
  });
  await test('avatar: share code round trip', () => {
    const a = Object.assign(P.randomAvatar('roundtrip'), { id: '123456789012345678', name: 'Test' });
    const b = P.decodeAny(P.encodeCode(a));
    for (const k of Object.keys(a)) if (k !== 'photo') assert.deepEqual(b[k], a[k], k);
  });
  await test('avatar: .puppet file round trip', () => {
    const a = Object.assign(P.randomAvatar('file'), { id: '123456789012345678' });
    assert.equal(P.decodeAny(P.toFileContent(a)).hair, a.hair);
  });
  await test('avatar: legacy values stay loadable', () => {
    const a = P.normalize({ headShape: 'carré', eyes: 'lunettes', hair: 'crête', hat: 'casque audio', outfit: 'costume' });
    assert.equal(a.headShape, 'square'); assert.equal(a.hair, 'mohawk'); assert.equal(a.hat, 'headphones'); assert.equal(a.outfit, 'suit');
    assert.equal(a.eyes, 'round'); assert.equal(a.glasses, 'round');
    assert.equal(P.normalize({ eyes: 'glasses', glasses: 'sunglasses' }).glasses, 'sunglasses');
  });
  await test('avatar: invalid input is cleaned', () => {
    const a = P.normalize({ headSize: 99, eyeSize: 'x', skin: 'url(evil)', hat: 'rocket', kind: 'alien', photo: 'https://example.com/a.png', name: 'x'.repeat(100), id: ' 12-34 ', extra: 1, __proto__: { polluted: true } });
    assert.equal(a.headSize, P.SLIDERS.headSize[1]); assert.equal(a.eyeSize, 1); assert.equal(a.skin, P.defaultAvatar().skin);
    assert.equal(a.hat, 'none'); assert.equal(a.kind, 'drawn'); assert.equal(a.photo, null); assert.equal(a.name.length, 32); assert.equal(a.id, '1234');
    assert.equal('extra' in a, false);
    assert.equal(P.normalize({ photo: 'data:image/png;base64,iVBORw0KGgo=' }).photo, 'data:image/png;base64,iVBORw0KGgo=');
    assert.throws(() => P.decodeAny('PUP1.!!!'));
    assert.throws(() => P.encodeCode({ kind: 'photo' }));
  });
  await test('avatar: random looks are deterministic', () => {
    assert.deepEqual(P.randomAvatar('Viewer_1'), P.randomAvatar('viewer_1'));
    assert.notDeepEqual(P.randomAvatar('a'), P.randomAvatar('b'));
  });

  // ---------- Render smoke test ----------
  await test('render: every option, kind and status draws', () => {
    const ctx = mockContext();
    const anim = new P.Animator('smoke');
    anim.talking = true;
    for (let i = 0; i < 30; i++) anim.update(0.05, i * 0.05);
    const st = anim.state(1.5);
    for (const [key, values] of Object.entries(P.OPTIONS)) {
      for (const v of values) P.draw(ctx, Object.assign(P.defaultAvatar(), { [key]: v, beard: key === 'beard' ? v : 'full', held: key === 'held' ? v : 'balloon' }), st, { x: 100, y: 300, scale: 1, name: key + ':' + v });
    }
    for (const statusStyle of ['props', 'badges', 'both']) P.draw(ctx, P.defaultAvatar(), Object.assign({}, st, { asleep: true }), { x: 1, y: 1, muted: true, deaf: true, glow: true, statusStyle, flip: true });
    P.draw(ctx, Object.assign(P.defaultAvatar(), { kind: 'photo', photo: 'data:image/png;base64,AAAA' }), st, { x: 1, y: 1 });
    P.draw(ctx, Object.assign(P.defaultAvatar(), { kind: 'discord' }), st, { discordAvatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png' });
    for (const [k, [min, max]] of Object.entries(P.SLIDERS)) for (const v of [min, max]) P.draw(ctx, Object.assign(P.defaultAvatar(), { [k]: v }), st, {});
    P.drawBubble(ctx, 'hello https://example.com/' + 'x'.repeat(300), 500, 200, 1, { maxLines: 3 });
    P.drawBubble(ctx, 'side bubble', 500, 200, 1, { side: 'left', viewW: 1920 });
    P.drawPoof(ctx, 10, 10, 1, 0.5);
    assert.ok(ctx.__calls > 1000, 'nothing was drawn');
  });

  // ---------- Overlay logic (Discord group, Twitch crowd, effects) ----------
  const { DEFAULTS, sanitize } = require('../electron/settings');
  await test('overlay: frames with members, chat, raids and exits', () => {
    for (const f of ['web/overlay/fx.js', 'web/overlay/discord.js', 'web/overlay/twitch.js', 'web/overlay/placement.js']) loadWeb(f);
    for (const layout of ['horizontal', 'vertical']) {
      for (const anchor of ['bottom-left', 'top-right', 'custom']) {
        const settings = sanitize({ overlay: { layout, anchor, entrance: 'random', exit: 'random', hideIdle: false }, twitch: { enabled: true, layout, anchor: anchor === 'top-right' ? 'bottom-right' : anchor } });
        const scene = { canvas: { addEventListener() {} }, ctx: mockContext(), W: 1920, H: 1080, settings, placement: false, t: (s) => s, perfMode: () => 'eco', useFake: () => true, saveSettings() {}, finishPlacement() {}, wake() {} };
        const fx = globalThis.OverlayFx(scene);
        const discord = globalThis.DiscordGroup(scene, fx);
        const twitch = globalThis.TwitchCrowd(scene, fx);
        const placement = globalThis.Placement(scene, discord, twitch, 'all');
        discord.setMembers([{ id: '123456789012345678', name: 'Ana', speaking: true }, { id: '223456789012345678', name: 'Bo', mute: true, deaf: true }]);
        twitch.onChat({ login: 'viewer', display: 'Viewer', text: 'hello there' }, false);
        for (const type of ['sub', 'bits', 'raid', 'restyle']) twitch.onEvent({ type, login: 'viewer2', display: 'V2', count: 30, amount: 500, text: 'yay' });
        twitch.onEvent({ type: 'action', action: 'dance', login: 'viewer3', display: 'V3' });
        let t = 0;
        const step = (n) => { for (let i = 0; i < n; i++) { t += 1 / 30; discord.update(1 / 30, t); twitch.update(1 / 30, t); discord.draw(t); twitch.draw(t); fx.drawParticles(1 / 30, t); } };
        step(90);
        assert.equal(discord.size, 2);
        assert.ok(twitch.size >= 3);
        assert.ok(fx.particles.length <= 300, 'eco particle cap');
        scene.placement = true; placement.draw();
        discord.replay(); discord.setMembers([]); scene.placement = false; scene.useFake = () => false;
        step(60);
        assert.equal(discord.size, 0, 'members leave after their exit effect');
      }
    }
  });

  // ---------- Settings ----------
  await test('settings: defaults are valid and stable', () => {
    assert.deepEqual(sanitize(DEFAULTS), DEFAULTS);
  });
  await test('settings: invalid values fall back, ranges clamp, unknown keys drop', () => {
    const prev = sanitize({ overlay: { scale: 1.2 } });
    const s = sanitize({
      port: 'abc', overlay: { scale: 'big', margin: -50, maxVisible: 3.7, layout: 'diagonal', pos: { x: 3, y: 'a' }, screenShare: true },
      twitch: { colors: ['#fff', 'red', 42], disabledCommands: ['JUMP', 'nope'], commandPrefix: '', sound: { volume: 9, mode: 'opera' } },
      app: { hotkeys: { toggleOverlay: 'Ctrl+Shift+ O', placement: 'Alt+F4', shareScreen: 'X' }, launchAtStartup: 'yes' },
      members: { '123456789012345678': { alias: ' Bob ', scale: 9, hidden: true, x: 1 }, notanid: { alias: 'x' } },
      memberOrder: ['123456789012345678', 'bad', '123456789012345678'],
      sync: { url: 'javascript:alert(1)' }, discord: { clientId: ' 1570204741982756965 ' },
    }, prev);
    assert.equal(s.port, 47800); assert.equal(s.overlay.scale, 1.2); assert.equal(s.overlay.margin, 0); assert.equal(s.overlay.maxVisible, 4);
    assert.equal(s.overlay.layout, 'horizontal'); assert.deepEqual(s.overlay.pos, { x: 1, y: 0.92 }); assert.equal('screenShare' in s.overlay, false);
    assert.deepEqual(s.twitch.colors, ['#fff']); assert.deepEqual(s.twitch.disabledCommands, ['jump']); assert.equal(s.twitch.commandPrefix, '!');
    assert.equal(s.twitch.sound.volume, 1); assert.equal(s.twitch.sound.mode, 'none');
    assert.equal(s.app.hotkeys.toggleOverlay, DEFAULTS.app.hotkeys.toggleOverlay); assert.equal(s.app.hotkeys.placement, 'Alt+F4'); assert.equal('shareScreen' in s.app.hotkeys, false);
    assert.equal(s.app.launchAtStartup, false);
    assert.deepEqual(s.members, { '123456789012345678': { alias: 'Bob', scale: 1.8, hidden: true } });
    assert.deepEqual(s.memberOrder, ['123456789012345678']);
    assert.equal(s.sync.url, ''); assert.equal(s.discord.clientId, '1570204741982756965');
  });
  await test('settings: command list matches the Twitch module', () => {
    const { COMMANDS } = require('../electron/twitch');
    const src = read('electron/settings.js');
    for (const name of Object.keys(COMMANDS)) assert.ok(src.includes(`'${name}'`), `settings.js COMMAND_NAMES misses ${name}`);
  });

  // ---------- Store ----------
  const { Store } = require('../electron/store');
  await test('store: corrupted config is kept aside, old config migrated', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'po-store-'));
    fs.writeFileSync(path.join(dir, 'config.json'), '{ not json');
    const s1 = new Store(dir, { discord: { clientId: '1570204741982756965' } });
    assert.ok(fs.existsSync(path.join(dir, 'config.json.broken')));
    assert.equal(s1.settings.discord.clientId, '1570204741982756965');
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ settings: { twitch: { palette: 'vif' }, overlay: { voiceEffects: true } }, avatars: { a: 1 }, token: 'x' }));
    const s2 = new Store(dir, {});
    assert.equal(s2.settings.twitch.palette, 'vivid'); assert.equal('voiceEffects' in s2.settings.overlay, false); assert.equal(s2.data.token, null);
    assert.equal(s2.settings.app.welcomeDone, true, 'existing installs skip the first-run guide'); assert.equal(s2.data.lastVersion, '');
    s2.updateSettings({ overlay: { scale: 1.1 } });
    s2.rememberMembers([{ id: '123456789012345678', name: 'Ana' }]);
    s2.flush();
    assert.equal(new Store(dir, {}).settings.overlay.scale, 1.1);
    s2.forgetMember('123456789012345678');
    assert.equal(s2.data.known['123456789012345678'], undefined);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test('store: fresh install starts the first-run guide, bundled sync URL is valid', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'po-store-'));
    const bundled = JSON.parse(read('electron/app-config.json'));
    const s = new Store(dir, bundled);
    assert.equal(s.settings.app.welcomeDone, false);
    assert.equal(s.data.lastVersion, null);
    assert.ok(/^https:\/\/\S+$/.test(bundled.sync.url), 'bundled sync URL');
    assert.equal(s.settings.sync.url, bundled.sync.url);
    s.data.lastVersion = '0.9.0'; // set by main.js at boot
    s.updateSettings({ sync: { url: '' } }); // clearing it by hand sticks
    s.flush();
    assert.equal(new Store(dir, bundled).settings.sync.url, '');
    // A pre-0.9.0 config (no lastVersion) with no sync URL gets the bundled one.
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ settings: { sync: { url: '' } } }));
    assert.equal(new Store(dir, bundled).settings.sync.url, bundled.sync.url);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test('changelog: current version listed, every entry in English and French', () => {
    loadWeb('web/shared/changelog.js');
    const log = globalThis.CHANGELOG;
    const version = JSON.parse(read('package.json')).version;
    assert.equal(log[0].version, version, 'newest changelog entry must match package.json');
    for (const e of log) {
      assert.ok(/^\d+\.\d+\.\d+$/.test(e.version), e.version);
      assert.ok(e.en.length > 0 && e.en.length === e.fr.length, 'v' + e.version + ': en/fr entries differ');
    }
  });

  await test('diagnostics: no secrets, log tail included', () => {
    const { buildDiagnostics } = require('../electron/diagnostics');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'po-diag-'));
    const store = new Store(dir, {});
    store.updateSettings({ discord: { clientSecret: 'SECRET123' }, members: { '123456789012345678': { alias: 'Ana' } } });
    store.data.token = { access_token: 'TOKEN123' };
    const logFile = path.join(dir, 'main.log');
    fs.writeFileSync(logFile, 'line one\nlast line\n');
    const text = buildDiagnostics({ version: '1.0.0', portable: false, versions: {}, locale: 'fr', logFile, store,
      state: { discord: { status: 'connected', members: [] }, twitchStatus: { status: 'off' }, syncStatus: { status: 'off' }, app: { lang: 'fr', displays: [], update: null } } });
    assert.ok(!/SECRET123|TOKEN123|Ana/.test(text), 'secret or member data leaked');
    assert.ok(text.includes('last line') && text.includes('Discord: connected'));
    store.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // ---------- Avatar sync ----------
  const { parseSyncFile, rawSyncUrl } = require('../electron/sync');
  await test('sync: accepted file formats', () => {
    const a = Object.assign(P.defaultAvatar(), { id: '123456789012345678', name: 'Ana' });
    const code = P.encodeCode(a);
    assert.equal(parseSyncFile(`first line\n${code}\ngarbage PUP1.@@\n`).length, 1);
    assert.equal(parseSyncFile(JSON.stringify({ avatars: [a, { id: 'bad' }] })).length, 1);
    assert.equal(parseSyncFile(JSON.stringify([a])).length, 1);
    assert.equal(parseSyncFile(P.toFileContent(a)).length, 1);
    assert.equal(parseSyncFile('null').length, 0);
    assert.equal(rawSyncUrl('https://gist.github.com/user/0123abcd'), 'https://gist.githubusercontent.com/user/0123abcd/raw');
  });

  // ---------- Twitch IRC ----------
  const { TwitchChat } = require('../electron/twitch');
  await test('twitch: chat, commands, cooldowns, events', () => {
    const cfg = sanitize({ twitch: { enabled: true, channel: 'test', ignore: 'nightbot', actionCooldown: 0 } }).twitch;
    const overrides = {};
    const chat = [], events = [];
    const tc = new TwitchChat({ getSettings: () => cfg, setOverride: (login, patch) => { overrides[login] = patch; } });
    tc.on('chat', (m) => chat.push(m)); tc.on('event', (e) => events.push(e));
    const msg = (login, text, tags = '') => tc.handle(`@display-name=${login.toUpperCase()};color=#FF0000${tags} :${login}!${login}@${login}.tmi.twitch.tv PRIVMSG #test :${text}`);
    msg('alice', 'hello world');
    assert.deepEqual(chat.pop(), { text: 'hello world', login: 'alice', display: 'ALICE', color: '#FF0000' });
    msg('nightbot', 'spam'); assert.equal(chat.length, 0);
    msg('bob', '!hat crown'); assert.deepEqual(overrides.bob, { hat: 'crown' }); assert.equal(chat.pop().text, null); assert.equal(events.pop().type, 'restyle');
    msg('bob', '!hat wizard'); assert.deepEqual(overrides.bob, { hat: 'crown' }, 'style cooldown');
    msg('bob', '!color #abc'); assert.deepEqual(overrides.bob, { clothColor: '#aabbcc' });
    msg('bob', '!jump'); msg('bob', '!jump'); assert.equal(events.filter((e) => e.action === 'jump').length, 2, 'cooldown 0 allowed');
    msg('carol', '!hat rocket'); assert.ok(chat.some((m) => m.system && m.login === 'carol'), 'usage help for a bad value');
    msg('dave', 'cheer100', ';bits=100'); assert.equal(events.find((e) => e.type === 'bits').amount, 100);
    tc.handle('@msg-id=raid;login=raider;display-name=Raider;msg-param-viewerCount=42;system-msg=42\\sraiders :tmi.twitch.tv USERNOTICE #test');
    assert.equal(events.pop().count, 42);
    tc.handle('@msg-id=resub;login=subber;display-name=Subber :tmi.twitch.tv USERNOTICE #test :great stream');
    assert.equal(events.pop().text, 'great stream');
    msg('eve', 'x'.repeat(2000)); assert.equal(chat.pop().text.length, 500);
    tc.channel = 'test'; msg('test', 'my own message'); assert.equal(chat.pop().self, true, 'streamer messages are flagged (no chat sound)');
    tc.handle('garbage line'); tc.handle('');
    tc.close();
  });

  // ---------- Local server ----------
  const { createServer } = require('../electron/server');
  await test('server: API, origin and host checks, static files', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'po-srv-'));
    const store = new Store(dir, {});
    const seen = [];
    const srv = createServer({ webDir: rel('web'), store, getState: () => ({ app: {} }), onSettings: (p) => seen.push(p), onAction: async (name) => { if (name !== 'ok') throw new Error('Unknown action'); }, onAvatarsChanged() {} });
    await new Promise((r) => srv.server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.server.address().port}`;
    const req = (p, o = {}) => fetch(base + p, o);
    const post = (p, body, headers = {}) => req(p, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: typeof body === 'string' ? body : JSON.stringify(body) });
    try {
      assert.equal((await req('/overlay.html')).status, 200);
      assert.equal((await req('/nope.html')).status, 404);
      const state = await (await req('/api/state')).json();
      assert.ok(state.settings && state.avatars && state.viewers);
      assert.equal((await post('/api/settings', { overlay: { scale: 1 } })).status, 200); assert.equal(seen.length, 1);
      assert.equal((await post('/api/settings', [1, 2])).status, 400);
      assert.equal((await post('/api/settings', '{bad')).status, 400);
      assert.equal((await post('/api/settings', {}, { Origin: 'https://evil.example' })).status, 403);
      assert.equal((await post('/api/avatars', { id: 'x' })).status, 400);
      assert.equal((await post('/api/avatars', { id: '123456789012345678', photo: 'https://x/y.png' })).status, 400);
      assert.equal((await post('/api/avatars', { id: '123456789012345678', name: 'Ana', extra: 'dropped' })).status, 200);
      assert.equal(store.data.avatars['123456789012345678'].extra, undefined);
      assert.equal((await post('/api/action', { name: 'ok' })).status, 200);
      assert.equal((await post('/api/action', { name: 'nope' })).status, 400);
      assert.equal((await post('/api/action', 'x'.repeat(20000))).status, 413);
      assert.equal((await req('/api/avatars/123456789012345678', { method: 'DELETE' })).status, 200);
      assert.equal(store.data.avatars['123456789012345678'], undefined);
      // Raw requests (fetch would normalise these paths/headers).
      const http = require('http');
      const raw = (p, headers) => new Promise((resolve) => http.get({ host: '127.0.0.1', port: srv.server.address().port, path: p, headers }, (res) => { res.resume(); resolve(res.statusCode); }));
      assert.equal(await raw('/..%2fpackage.json'), 403, 'path traversal');
      assert.equal(await raw('/api/state', { Host: 'evil.example' }), 421, 'DNS rebinding');
    } finally {
      srv.close();
      store.flush();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ---------- Alerts, Twitch account, widgets, hub ----------
  await test('settings: alert sounds, widgets and hub lists are validated', () => {
    const f = '0123456789abcdef.mp3';
    const s = sanitize({
      alerts: { output: 'nope', volume: 3, bits: { mode: 'all', sounds: [{ file: f, name: 'x'.repeat(200), volume: -1, min: '250' }, { file: '../../evil.mp3' }, { file: 'abc.exe' }, 'junk'] }, sub: { mode: 'weird' } },
      widgets: { looks: { followers: { font: 'Comic"; } body{', size: 999, textColor: 'red', frame: 'pill', layout: 'gallery' }, spotify: { layout: 'gallery', cover: 'vinyl' } } },
      hub: { members: ['@LaboCorpo', 'https://twitch.tv/x', 'ok_name', 'ok_name', 'a b'], pollSec: 1 },
      twitchApi: { clientId: 'NOT VALID' },
    });
    assert.equal(s.alerts.output, 'app'); assert.equal(s.alerts.volume, 1);
    assert.deepEqual(s.alerts.bits, { mode: 'all', sounds: [{ file: f, name: 'x'.repeat(80), volume: 0, min: 250, gif: '' }] });
    // v1.7: files of the Son Twitch folder (their own names) and a GIF per sound.
    const media = sanitize({ alerts: { follow: { sounds: [{ file: 'Mon son (2).mp3', gif: 'boom.gif' }, { file: 'x.mp3', gif: '../a.gif' }, { file: 'img.gif' }, { file: 'con.mp3:evil' }] } } }).alerts.follow.sounds;
    assert.deepEqual(media.map((x) => [x.file, x.gif]), [['Mon son (2).mp3', 'boom.gif'], ['x.mp3', '']]);
    assert.equal(s.alerts.sub.mode, 'random');
    const fl = s.widgets.looks.followers;
    assert.equal(fl.font, 'Segoe UI'); assert.equal(fl.size, 200); assert.equal(fl.textColor, '#ffffff'); assert.equal(fl.layout, 'inline', 'spotify-only layout refused for a counter');
    assert.equal(s.widgets.looks.spotify.layout, 'gallery'); assert.equal(s.widgets.looks.spotify.cover, 'vinyl');
    assert.equal(fl.cover, undefined, 'cover only exists for the Spotify widget');
    assert.deepEqual(s.hub.members, ['labocorpo', 'ok_name']); assert.equal(s.hub.pollSec, 30);
    assert.equal(s.twitchApi.clientId, '');
    assert.deepEqual(sanitize({ alerts: { bits: { sounds: 'x' } } }).alerts.bits.sounds, [], 'non-array falls back');
  });

  const { alertKey, amountOf, AlertPicker } = require('../electron/alerts');
  await test('alerts: tiers, modes, fallbacks and gift bundles', () => {
    const snd = (file, min = 0, volume = 1) => ({ file: file.padEnd(16, '0') + '.mp3', name: file, volume, min });
    const cfg = sanitize({ alerts: {
      volume: 0.5,
      bits: { mode: 'random', sounds: [snd('a', 1), snd('b', 100), snd('c', 100), snd('d', 1000)] },
      sub: { mode: 'sequence', sounds: [snd('e1'), snd('e2')] },
      raid: { mode: 'all', sounds: [snd('f1', 0, 0.8), snd('f2', 0)] },
    } }).alerts;
    const pick = new AlertPicker(() => 0);
    const files = (l) => l.map((x) => x.file[0]);
    assert.deepEqual(files(pick.pick(cfg, 'bits', 50)), ['a']);
    assert.deepEqual(files(pick.pick(cfg, 'bits', 5000)), ['d'], 'highest tier wins');
    assert.deepEqual(files(pick.pick(cfg, 'bits', 0)), [], 'below every threshold');
    const tier = [pick.pick(cfg, 'bits', 150), pick.pick(cfg, 'bits', 150), pick.pick(cfg, 'bits', 150)].map((l) => l[0].file[0]);
    assert.deepEqual(tier, ['b', 'c', 'b'], 'random never repeats the last sound');
    assert.deepEqual([1, 2, 3].map(() => files(pick.pick(cfg, 'sub', 0))[0]), ['e', 'e', 'e']);
    const seq = new AlertPicker(); assert.deepEqual([1, 2, 3].map(() => seq.pick(cfg, 'sub', 0)[0].file.slice(0, 2)), ['e1', 'e2', 'e1']);
    assert.deepEqual(pick.pick(cfg, 'raid', 3).map((x) => x.volume), [0.4, 0.5], 'all together, master volume applied');
    assert.equal(seq.pick(cfg, 'prime', 0)[0].file.slice(0, 2), 'e2', 'prime falls back to sub sounds (same sequence)');
    assert.deepEqual(pick.pick(cfg, 'follow', 0), []);
    assert.deepEqual(pick.pick(Object.assign({}, cfg, { enabled: false }), 'raid', 3), []);
    assert.equal(alertKey({ type: 'sub', kind: 'gift', bundled: true }), null);
    assert.equal(alertKey({ type: 'sub', kind: 'prime' }), 'prime');
    assert.equal(alertKey({ type: 'chat' }), null);
    assert.equal(amountOf({ type: 'raid', count: 12 }, 'raid'), 12);
  });

  await test('twitch: Prime, gifted and bundled subs are told apart', () => {
    const cfg = sanitize({ twitch: { enabled: true, channel: 'test' } }).twitch;
    const events = [];
    const tc = new TwitchChat({ getSettings: () => cfg, setOverride() {} });
    tc.on('event', (e) => events.push(e));
    tc.handle('@msg-id=sub;login=a;msg-param-sub-plan=Prime :tmi.twitch.tv USERNOTICE #test');
    tc.handle('@msg-id=resub;login=b;msg-param-sub-plan=1000 :tmi.twitch.tv USERNOTICE #test :hi');
    tc.handle('@msg-id=submysterygift;login=c;msg-param-mass-gift-count=5 :tmi.twitch.tv USERNOTICE #test');
    tc.handle('@msg-id=subgift;login=c;msg-param-community-gift-id=123 :tmi.twitch.tv USERNOTICE #test');
    tc.handle('@msg-id=subgift;login=d :tmi.twitch.tv USERNOTICE #test');
    assert.deepEqual(events.map((e) => [e.kind, e.count || 0, !!e.bundled]), [['prime', 0, false], ['sub', 0, false], ['gift', 5, false], ['gift', 1, true], ['gift', 1, false]]);
    tc.close();
  });

  // Fake fetch: routes 'METHOD url-prefix' to handlers returning [status, json].
  function fakeFetch(routes, calls) {
    return async (url, opts = {}) => {
      const m = (opts.method || 'GET') + ' ' + url;
      calls && calls.push({ m, opts });
      const key = Object.keys(routes).find((k) => m.startsWith(k));
      if (!key) throw new Error('unexpected request ' + m);
      const [status, json] = await routes[key](opts, url);
      return { ok: status >= 200 && status < 300, status, json: async () => json };
    };
  }
  const { TwitchApi } = require('../electron/twitch-api');
  const CLIENT = 'abcdefghij0123456789abcd';
  await test('twitch account: device code login, validate, refresh on 401, logout', async () => {
    let tok = null, pending = 1, accessValid = 'AT1';
    const calls = [];
    const api = new TwitchApi({
      getClientId: () => CLIENT, getToken: () => tok, saveToken: (x) => { tok = x; },
      fetch: fakeFetch({
        'POST https://id.twitch.tv/oauth2/device': () => [200, { device_code: 'DC', user_code: 'ABCD-EFGH', verification_uri: 'https://www.twitch.tv/activate?device-code=ABCD-EFGH', interval: 0.001, expires_in: 1800 }],
        'POST https://id.twitch.tv/oauth2/token': (o) => {
          const b = new URLSearchParams(o.body);
          if (b.get('grant_type') === 'refresh_token') { accessValid = 'AT2'; return [200, { access_token: 'AT2', refresh_token: 'RT2', expires_in: 14000, scope: ['x'] }]; }
          return pending-- > 0 ? [400, { status: 400, message: 'authorization_pending' }] : [200, { access_token: 'AT1', refresh_token: 'RT1', expires_in: 14000, scope: ['moderator:read:followers'] }];
        },
        'GET https://id.twitch.tv/oauth2/validate': (o) => (o.headers.Authorization === 'OAuth ' + accessValid ? [200, { login: 'me', user_id: '42', scopes: ['moderator:read:followers'] }] : [401, {}]),
        'GET https://api.twitch.tv/helix/users': (o) => (o.headers.Authorization === 'Bearer ' + accessValid ? [200, { data: [{ id: '1' }] }] : [401, {}]),
        'POST https://id.twitch.tv/oauth2/revoke': () => [200, {}],
      }, calls),
    });
    await api.start();
    assert.equal(api.status, 'off');
    const r = await api.beginLogin();
    assert.equal(r.userCode, 'ABCD-EFGH'); assert.equal(api.snapshot().status, 'pending');
    for (let i = 0; i < 60 && api.status !== 'connected'; i++) await new Promise((res) => setTimeout(res, 100)); // 1 s minimum poll interval
    assert.equal(api.status, 'connected'); assert.equal(api.login, 'me'); assert.equal(api.userId, '42');
    assert.ok(api.snapshot().missingScopes.length > 0, 'missing scopes reported');
    accessValid = 'EXPIRED';
    const u = await api.helix('GET', 'users', { login: ['a', 'b'] });
    assert.equal(u.data[0].id, '1');
    assert.equal(tok.access_token, 'AT2'); assert.equal(tok.refresh_token, 'RT2');
    assert.ok(calls.some((c) => c.m.includes('users?login=a&login=b')), 'repeated query params');
    await api.logout();
    assert.equal(tok, null); assert.equal(api.status, 'off');
    await assert.rejects(api.helix('GET', 'users'), /Log in with Twitch first/);
    api.stop();
  });

  const { StreamStats } = require('../electron/stream-stats');
  await test('stream stats: counters, new follower detection, errors', async () => {
    let followers = { total: 10, data: [{ user_id: '1', user_login: 'old', user_name: 'Old', followed_at: '2026-01-01T00:00:00Z' }] };
    const fakeApi = { connected: true, userId: '42', helix: async (m, p, q) => {
      if (p === 'channels/followers') return followers;
      if (p === 'users') return { data: [{ login: q.login, profile_image_url: 'https://static-cdn.example/' + q.login + '-300x300.png' }] };
      const e = new Error('nope'); e.status = 400; throw e;
    } };
    const st = new StreamStats({ api: fakeApi, intervalMs: 1e9 });
    const follows = [];
    st.on('follow', (f) => follows.push(f));
    await st.poll();
    assert.equal(st.data.followers, 10); assert.equal(follows.length, 0, 'first poll is not a new follow');
    assert.equal(st.data.errors.subs, 'Sub count needs Twitch Affiliate or Partner');
    followers = { total: 11, data: [{ user_id: '2', user_login: 'new', user_name: 'New', followed_at: '2026-01-02T00:00:00Z' }] };
    await st.poll();
    assert.deepEqual(follows.map((f) => f.login), ['new']); assert.equal(st.data.latestFollower.display, 'New');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(st.data.latestFollower.avatar, 'https://static-cdn.example/new-300x300.png', 'profile picture added');
    st.onSub({ login: 'x', display: 'X', kind: 'prime' });
    assert.equal(st.data.latestSub.kind, 'prime');
    await new Promise((r) => setTimeout(r, 5));
    assert.match(st.data.latestSub.avatar, /\/x-300x300\.png$/);
    st.onSub({ login: 'y', display: 'Y', bundled: true });
    assert.equal(st.data.latestSub.display, 'X', 'bundled gift notices ignored');
    st.stop();
  });

  const { Hub } = require('../electron/hub');
  await test('hub: live list, go-live notice, raid, Stream Together, chat', async () => {
    const calls = [];
    let streams = [];
    let session = [];
    const fakeApi = {
      connected: true, userId: '42', login: 'myself',
      helix: async (m, p, q, b) => {
        calls.push([m, p, q, b]);
        if (p === 'users') return { data: [].concat(q.login).map((l, i) => ({ id: l === 'myself' ? '42' : String(100 + i), login: l, display_name: l.toUpperCase(), profile_image_url: 'https://x/' + l + '.png' })) };
        if (p === 'streams') return { data: streams };
        if (p === 'guest_star/session' && m === 'GET') return { data: session };
        if (p === 'guest_star/session' && m === 'POST') { session = [{ id: 'S1' }]; return { data: session }; }
        if (p === 'chat/messages') return { data: [{ is_sent: true }] };
        return {};
      },
    };
    const hub = new Hub({ api: fakeApi, getSettings: () => ({ members: ['ana', 'bob', 'myself'], notify: true, pollSec: 60 }) });
    const lives = [];
    hub.on('live', (x) => lives.push(x.login));
    await hub.poll();
    assert.equal(hub.list.length, 3); assert.equal(hub.list.find((m) => m.login === 'myself').me, true);
    streams = [{ user_login: 'ana', user_name: 'Ana', title: 'Hi', game_name: 'Chess', viewer_count: 7, started_at: new Date().toISOString(), thumbnail_url: 'https://t/{width}x{height}.jpg' }];
    await hub.poll();
    assert.deepEqual(lives, ['ana']);
    const ana = hub.list.find((m) => m.login === 'ana');
    assert.equal(ana.live, true); assert.equal(ana.thumb, 'https://t/320x180.jpg');
    await hub.startRaid('ana');
    assert.deepEqual(calls.find((c) => c[1] === 'raids').slice(0, 3), ['POST', 'raids', { from_broadcaster_id: '42', to_broadcaster_id: '100' }]);
    assert.equal(hub.snapshot().raid.login, 'ana');
    await assert.rejects(hub.startRaid('myself'), /raid yourself/);
    await hub.inviteStreamTogether('bob');
    const inv = calls.find((c) => c[1] === 'guest_star/invites');
    assert.deepEqual(inv[2], { broadcaster_id: '42', moderator_id: '42', session_id: 'S1', guest_id: '101' });
    await hub.say('ana', '  hello  ');
    assert.deepEqual(calls.find((c) => c[1] === 'chat/messages')[3], { broadcaster_id: '100', sender_id: '42', message: 'hello' });
    await assert.rejects(hub.say('ana', '   '), /Empty message/);
    await assert.rejects(hub.startRaid('bad name!'), /Invalid channel name/);
    hub.stop();
  });

  const { NowPlaying, parseTitle } = require('../electron/nowplaying');
  await test('now playing: Spotify window titles, process lifecycle, cover lookup', async () => {
    assert.deepEqual(parseTitle('Daft Punk - One More Time - Radio Edit'), { playing: true, artist: 'Daft Punk', title: 'One More Time - Radio Edit' });
    for (const idle of ['Spotify', 'Spotify Premium', 'Spotify Free', '']) assert.equal(parseTitle(idle).playing, false);
    assert.deepEqual(parseTitle('Advertisement'), { playing: true, artist: '', title: 'Advertisement' });
    const { EventEmitter } = require('events');
    const { PassThrough } = require('stream');
    let proc = null;
    const np = new NowPlaying({
      platform: 'win32', getSettings: () => ({ showCover: true }),
      spawn: (cmd, args) => { assert.equal(cmd, 'powershell.exe'); proc = new EventEmitter(); proc.stdout = new PassThrough(); proc.kill = () => proc.emit('exit'); return proc; },
      fetch: fakeFetch({ 'GET https://itunes.apple.com/search': () => [200, { results: [{ artworkUrl100: 'https://img/100x100bb.jpg' }] }] }),
    });
    np.setEnabled(true);
    assert.equal(np.state.status, 'waiting');
    proc.stdout.write('T:Artist - Song\n');
    for (let i = 0; i < 20 && !np.state.cover; i++) await new Promise((r) => setTimeout(r, 5));
    assert.equal(np.state.title, 'Song'); assert.equal(np.state.cover, 'https://img/600x600bb.jpg');
    proc.stdout.write('T:Spotify Premium\n');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(np.state.playing, false);
    np.setEnabled(false);
    assert.equal(np.state.status, 'off');
    const other = new NowPlaying({ platform: 'linux' }); other.setEnabled(true);
    assert.equal(other.state.status, 'unsupported');
  });

  await test('v1.5: OBS auth, BabaDeck, scenes, Twitch chat parsing, stream health alerts, Discord bot editor', async () => {
    const { authString } = require('../electron/obs');
    // Example from the obs-websocket v5 protocol documentation.
    assert.equal(authString('supersecretpassword', 'lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI=', '+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY='), '1Ct943GAT+6YQUUX47Ia/ncufilbe6+oD6lY+5kaCu4=');
    const { cleanDeck, Deck } = require('../electron/deck');
    const d = cleanDeck({ cols: 3, rows: 1, pages: [{ name: 'P', buttons: [{ id: 'abcd1', label: 'Go', actions: [{ type: 'obs.scene', scene: 'Game' }, { type: 'delay', ms: 5 }, { type: 'evil' }, { type: 'url', url: 'javascript:alert(1)' }] }] }] });
    assert.deepEqual(d.pages[0].buttons[0].actions.map((x) => x.type), ['obs.scene', 'delay', 'url']);
    assert.equal(d.pages[0].buttons[0].actions[2].url, '', 'only http(s) links');
    const ran = [];
    const deck = new Deck({ getSettings: () => d, run: async (a) => ran.push(a.type) });
    await deck.press('abcd1');
    assert.deepEqual(ran, ['obs.scene', 'url']);
    await assert.rejects(deck.press('nope'));
    const st = sanitize({ scenes: [{ id: 'abc123', name: 'Main', width: 99999, items: [{ w: 'chat', x: 1, y: 2, width: 3, height: 400 }, { w: 'evil' }] }, { id: '../x' }] }).scenes;
    assert.equal(st.length, 1); assert.equal(st[0].width, 3840); assert.equal(st[0].items.length, 1); assert.equal(st[0].items[0].width, 40);
    globalThis.window = globalThis;
    require('../web/shared/twitchchat.js');
    const TC = globalThis.TwitchChat;
    const chat = new TC(); chat.channels = new Set(['labo']);
    const got = [];
    chat.on('message', (m) => got.push(m)); chat.on('delete', (m) => got.push(m));
    chat.onLine('@badges=moderator/1;color=#FF0000;display-name=Kiwi;emotes=25:0-4;id=abc-123;room-id=42;user-id=7;first-msg=1 :kiwi!kiwi@kiwi.tmi.twitch.tv PRIVMSG #labo :Kappa <b>hi</b>');
    chat.onLine('@target-msg-id=abc-123 :tmi.twitch.tv CLEARMSG #labo :x');
    chat.onLine('@id=zzz :x!x@x PRIVMSG #other :not joined');
    assert.equal(got.length, 2); assert.equal(got[0].roomId, '42'); assert.equal(got[0].first, true); assert.equal(got[0].mod, true); assert.equal(got[1].id, 'abc-123');
    const html = TC.emoteHtml(got[0].text, got[0].emotes);
    assert.match(html, /emoticons\/v2\/25\//); assert.ok(!html.includes('<b>'), 'chat text is escaped');
    const { Lab } = require('../electron/lab');
    const notes = [], said = [];
    let obsSt = { outputTotal: 1000, outputSkipped: 120, congestion: 10 };
    const lab = new Lab({ getSettings: () => ({ healthAlerts: true, raidThanks: { enabled: true, text: 'Merci {name} ({viewers})' }, points: { enabled: false, map: [] } }),
      api: { connected: false }, log: { warn() {} }, t: (x) => x, notify: (a) => notes.push(a), say: async (x) => said.push(x), obsStats: () => obsSt, pressDeck() {} });
    clearInterval(lab.timer);
    lab.tick();
    lab.tick();
    assert.equal(notes.length, 1, 'stream health warns once (then waits 5 minutes)');
    obsSt = null; lab.lastHealth = 0; lab.tick();
    assert.equal(notes.length, 1, 'no OBS, no warning');
    const { DiscordBot } = require('../electron/discord-bot');
    const P = globalThis.Puppet;
    const bot = new DiscordBot({ getToken: () => '', getAppId: () => '1', Puppet: P, render: async () => Buffer.alloc(1), getAvatar: () => null, saveAvatar: async () => ({}), log: { warn() {} } });
    bot.sessions.set('1', { avatar: P.normalize(P.randomAvatar('x')), part: 'hat' });
    const ed = bot.editor('1', true);
    assert.equal(ed.components.length, 3);
    for (const row of ed.components) for (const c of row.components) if (c.options) assert.ok(c.options.length >= 1 && c.options.length <= 25, 'Discord allows 25 options');
    assert.ok(ed.components[1].components[0].options.some((o) => o.value === 'viking'));
  });

  await test('updater: release tags and versions; installs stay on the official update channel', () => {
    const { releaseVersion, cmpVersion } = require('../electron/updater');
    assert.equal(releaseVersion('v1.8.0'), '1.8.0');
    for (const tag of ['labohub-v1.9.0', 'v1.8', '1.8.0', 'v1.8.0-beta', null]) assert.equal(releaseVersion(tag), null, String(tag));
    assert.ok(cmpVersion('1.10.0', '1.9.9') > 0); assert.ok(cmpVersion('1.8.0', '0.10.1') > 0); assert.equal(cmpVersion('v1.2.3', '1.2.3'), 0);
    const pkg = JSON.parse(read('package.json'));
    // Same appId and publish target as Puppet Overlay: existing installs update in place (electron-updater + NSIS).
    assert.equal(pkg.build.appId, 'com.puppetoverlay.app');
    assert.deepEqual(pkg.build.publish, [{ provider: 'github', owner: 'LaboCorpo', repo: 'labo-puppet-overlay' }]);
    assert.ok(read('electron/main.js').includes("setAppUserModelId('com.puppetoverlay.app')"));
    assert.ok(!/updates\.repo|app\.asar/.test(read('electron/updater.js').split('*/')[1]), 'no self-replacing package updates');
  });

  await test('features: new installs start light, Discord only runs when its puppets are on', () => {
    assert.deepEqual(DEFAULTS.app.tabs, { puppet: true, hud: false, hub: false, deck: false, bababot: false });
    assert.equal(DEFAULTS.app.discordPuppets, true);
    const main = read('electron/main.js');
    assert.ok(/const discordOn = \(\) => tabOn\('puppet'\) && store\.settings\.app\.discordPuppets;/.test(main));
    assert.ok(main.split('\n').filter((l) => l.includes('startDiscord()') && !l.includes('function startDiscord')).every((l) => l.includes('discordOn()')), 'every startDiscord() call is gated by discordOn()');
    const tour = read('web/panel-tour.js');
    for (const id of ['discord', 'twitch', 'hud', 'hub', 'deck', 'bababot']) assert.ok(tour.includes(`{ id: '${id}'`), id);
  });

  await test('now playing: Windows media session, real cover file, timeline, legacy fallback', async () => {
    const { parseSession, psScript, encodeCommand } = require('../electron/nowplaying');
    assert.equal(parseSession({ status: 4, title: 'T', artist: 'A', album: 'B', app: 'Spotify.exe', pos: 12, dur: 200, upd: 1000 }, 5).playing, true);
    assert.equal(parseSession({ status: 5, title: 'T', artist: 'A', app: 'Chrome' }, 5).playing, false);
    assert.equal(parseSession({ status: 0 }, 5).title, '');
    assert.equal(parseSession({ status: 4, title: 'T', app: 'Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic' }, 5).app, 'Microsoft.ZuneMusic');
    assert.equal(parseSession({ status: 4, title: 'T', dur: 99999 }, 5).dur, 0, 'absurd duration ignored');
    assert.match(Buffer.from(encodeCommand(psScript(42, true)), 'base64').toString('utf16le'), /\$anyPlayer = \$true/);
    const { EventEmitter } = require('events');
    const { PassThrough } = require('stream');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'po-cov-'));
    let proc = null, spawned = 0, lookups = 0;
    const np = new NowPlaying({
      platform: 'win32', coversDir: dir, getSettings: () => ({ showCover: true }),
      spawn: () => { spawned++; proc = new EventEmitter(); proc.stdout = new PassThrough(); proc.kill = () => proc.emit('exit'); return proc; },
      fetch: async () => { lookups++; return { ok: false }; },
    });
    np.setEnabled(true);
    const now = Date.now();
    proc.stdout.write('J:' + JSON.stringify({ app: 'Spotify.exe', title: 'Song', artist: 'Artist', album: 'Album', status: 4, pos: 10, dur: 180, upd: now }) + '\n');
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
    proc.stdout.write('C:' + jpg.toString('base64') + '\n');
    for (let i = 0; i < 20 && !np.state.cover; i++) await new Promise((r) => setTimeout(r, 5));
    assert.equal(np.state.source, 'media'); assert.equal(np.state.album, 'Album'); assert.equal(np.state.dur, 180); assert.equal(np.state.playing, true);
    assert.match(np.state.cover, /^\/covers\/[a-f0-9]{12}\.jpg$/);
    assert.deepEqual(fs.readFileSync(path.join(dir, np.state.cover.slice(8))), jpg);
    // A timeline report that matches the extrapolated position does not push a new state.
    let changes = 0; np.on('change', () => changes++);
    proc.stdout.write('J:' + JSON.stringify({ app: 'Spotify.exe', title: 'Song', artist: 'Artist', album: 'Album', status: 4, pos: 10.5, dur: 180, upd: now + 500 }) + '\n');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(changes, 0);
    proc.stdout.write('J:' + JSON.stringify({ app: 'Spotify.exe', title: 'Song', artist: 'Artist', album: 'Album', status: 4, pos: 90, dur: 180, upd: now + 600 }) + '\n');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(np.state.pos, 90, 'seek pushed');
    proc.stdout.write('C:' + Buffer.from('not an image').toString('base64') + '\n');
    await new Promise((r) => setTimeout(r, 5));
    assert.match(np.state.cover, /\.jpg$/, 'invalid image ignored');
    assert.equal(lookups, 0, 'no online lookup when the real cover arrived');
    // The cover route only serves well-formed names.
    const store = new Store(dir, {});
    const srv = createServer({ webDir: rel('web'), coversDir: dir, store, getState: () => ({ app: {} }), onSettings() {}, onAction: async () => {}, onAvatarsChanged() {} });
    await new Promise((r) => srv.server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.server.address().port}`;
    try {
      const r = await fetch(base + np.state.cover);
      assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/jpeg');
      assert.equal((await fetch(base + '/covers/..%2fconfig.json')).status, 404);
      assert.equal((await fetch(base + '/covers/config.json')).status, 404);
    } finally { srv.close(); store.flush(); }
    np.setEnabled(false);
    // Media script dying at start twice -> window title script.
    np.retryMs = 1;
    spawned = 0;
    np.setEnabled(true);
    proc.emit('exit');
    await new Promise((r) => setTimeout(r, 20));
    proc.emit('exit');
    assert.equal(np.legacy, true);
    np.setEnabled(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test('server: alert sound upload, serving, deletion', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'po-snd-'));
    const store = new Store(dir, {});
    const srv = createServer({ webDir: rel('web'), soundsDir: path.join(dir, 'sounds'), store, getState: () => ({ app: {} }), onSettings() {}, onAction: async () => {}, onAvatarsChanged() {} });
    await new Promise((r) => srv.server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.server.address().port}`;
    try {
      const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(200, 1)]);
      let r = await fetch(base + '/api/sounds?name=Tada', { method: 'POST', body: mp3 });
      const j = await r.json();
      assert.equal(r.status, 200); assert.match(j.file, /^[a-f0-9]{16}\.mp3$/); assert.equal(j.name, 'Tada');
      r = await fetch(base + '/sounds/' + j.file);
      assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'audio/mpeg'); assert.equal((await r.arrayBuffer()).byteLength, mp3.length);
      assert.equal((await fetch(base + '/api/sounds', { method: 'POST', body: Buffer.from('MZ not audio at all') })).status, 400, 'not audio');
      assert.equal((await fetch(base + '/api/sounds', { method: 'POST', body: mp3, headers: { Origin: 'https://evil.example' } })).status, 403);
      assert.equal((await fetch(base + '/sounds/..%2fconfig.json')).status, 404);
      assert.equal((await fetch(base + '/api/sounds/' + j.file, { method: 'DELETE' })).status, 200);
      assert.equal((await fetch(base + '/sounds/' + j.file)).status, 404);
      assert.equal((await fetch(base + '/api/sounds/evil.exe', { method: 'DELETE' })).status, 400);
      assert.equal((await fetch(base + '/widget.html')).status, 200);
    } finally {
      srv.close(); store.flush();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('v1.7: Son Twitch folder, tabs, templates, game counter widget, shortcut strip, panel structure', async () => {
    // Son Twitch folder: files keep their name, pictures too; nothing outside the folder.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'po-media-'));
    const media = path.join(dir, 'Son Twitch');
    const store = new Store(dir, {});
    const srv = createServer({ webDir: rel('web'), soundsDir: path.join(dir, 'sounds'), getMediaDir: () => media, store, getState: () => ({ app: {} }), onSettings() {}, onAction: async () => {}, onAvatarsChanged() {} });
    await new Promise((r) => srv.server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.server.address().port}`;
    try {
      const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(200, 1)]);
      const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(100, 0)]);
      let r = await fetch(base + '/api/media?name=' + encodeURIComponent('Gros boom (2).mp3'), { method: 'POST', body: mp3 });
      let j = await r.json();
      assert.equal(j.file, 'Gros boom (2).mp3'); assert.equal(j.kind, 'audio');
      j = await (await fetch(base + '/api/media?name=' + encodeURIComponent('Gros boom (2).mp3'), { method: 'POST', body: mp3 })).json();
      assert.equal(j.file, 'Gros boom (2) (2).mp3', 'never overwrites');
      j = await (await fetch(base + '/api/media?name=../../evil.gif', { method: 'POST', body: gif })).json();
      assert.equal(j.kind, 'image'); assert.ok(!j.file.includes('/') && !j.file.includes('\\'), 'no folder in the name');
      assert.equal((await fetch(base + '/api/media?name=x.mp3', { method: 'POST', body: Buffer.from('MZ program') })).status, 400);
      fs.writeFileSync(path.join(media, 'notes.txt'), 'x');
      const list = await (await fetch(base + '/api/media')).json();
      assert.deepEqual(list.files.map((f) => f.kind).sort(), ['audio', 'audio', 'image']); assert.equal(list.dir, media);
      r = await fetch(base + '/media/' + encodeURIComponent('Gros boom (2).mp3'));
      assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'audio/mpeg');
      assert.equal((await fetch(base + '/media/..%2Fconfig.json')).status, 404);
      assert.equal((await fetch(base + '/media/notes.txt')).status, 404);
    } finally {
      srv.close(); store.flush();
      fs.rmSync(dir, { recursive: true, force: true });
    }
    // Alert sounds carry their GIF to the OBS source.
    const { AlertPicker } = require('../electron/alerts');
    const al = sanitize({ alerts: { follow: { sounds: [{ file: 'boom.mp3', gif: 'boom.gif', volume: 1 }] } } }).alerts;
    assert.deepEqual(new AlertPicker().pick(al, 'follow', 1), [{ file: 'boom.mp3', volume: 0.8, gif: 'boom.gif' }]);
    // Tabs kept / renamed, tours, shortcut strip.
    const a = sanitize({ app: { tabs: { hud: false, lab: false }, tabNames: { bababot: 'Mon <b>robot</b>', hud: '', nope: 'x' }, tours: ['hub', 'hub', 'evil'] }, deck: { hud: { enabled: true, w: 99999, h: 1, opacity: 5, x: 'a' } } });
    assert.equal(a.app.tabs.hud, false); assert.equal(a.app.tabs.puppet, true); assert.ok(!('lab' in a.app.tabs));
    assert.deepEqual(a.app.tabNames, { bababot: 'Mon brobot/b' }); assert.deepEqual(a.app.tours, ['hub']);
    assert.equal(a.deck.hud.w, 3000); assert.equal(a.deck.hud.h, 40); assert.equal(a.deck.hud.opacity, 20);
    // Templates: style only, pictures and CSS kept on this PC, checked like a look.
    const tp = sanitize({ widgets: { templates: [{ id: 'tpl12345', name: 'Neon', style: { accent: '#00ff00', label: 'not style', customCss: '.wg{color:red}', bgImage: '/media/a%20b.gif', iconImage: 'javascript:x', size: 9999 } }, 'junk'] } }).widgets.templates;
    assert.equal(tp.length, 1); assert.equal(tp[0].style.accent, '#00ff00'); assert.equal(tp[0].style.customCss, '.wg{color:red}'); assert.equal(tp[0].style.bgImage, '/media/a%20b.gif');
    assert.ok(!('label' in tp[0].style) && !('iconImage' in tp[0].style)); assert.equal(tp[0].style.size, 200);
    const WS = require('../web/shared/widget-schema.js');
    const code = WS.encodeStyle(Object.assign(WS.defaultLook('gameCounter'), { customCss: 'body{}', bgImage: '/media/x.gif' }));
    const back = WS.decodeStyle(code, WS.defaultLook('followers'), 'followers');
    assert.equal(back.customCss, '', 'share codes never carry CSS'); assert.equal(back.bgImage, '', 'nor pictures');
    assert.equal(WS.defaultLook('gameCounter').icon, 'skull');
    assert.equal(WS.sanitizeLook('gameCounter', { bgImage: '/media/a"b.gif' }).bgImage, '', 'no quote in a picture address');
    // Panel: every page link and every side entry has its page; removed tabs are gone.
    const html = read('web/panel.html');
    const tabs = [...html.matchAll(/data-tab="([\w-]+)"/g)].map((m) => m[1]);
    const pages = new Set([...html.matchAll(/data-panel="([\w-]+)"/g)].map((m) => m[1]).concat(...[...html.matchAll(/data-panels="([^"]+)"/g)].map((m) => m[1].split(' '))));
    for (const tb of tabs) assert.ok(pages.has(tb), 'page for tab ' + tb);
    const gotos = new Set([...html.matchAll(/data-goto="([\w-]+)"/g)].map((m) => m[1]));
    for (const f of ['web/panel-guides.js', 'web/panel-tour.js', 'web/panel-mystream.js', 'web/panel-deck.js']) for (const m of read(f).matchAll(/(?:go|goto|showTab)\('([\w-]+)'/g)) gotos.add(m[1]);
    for (const f of ['web/panel-tour.js']) for (const m of read(f).matchAll(/tab: '([\w-]+)'/g)) gotos.add(m[1]);
    for (const g of gotos) assert.ok(tabs.includes(g), 'link to a missing page: ' + g);
    for (const gone of ['savane', 'savane-scene', 'lab', 'lab-chat', 'lab-games', 'lab-tools', 'obsws']) assert.ok(!tabs.includes(gone), gone + ' removed');
    for (const g of ['puppet', 'hud', 'hub', 'deck', 'bababot']) assert.ok(html.includes(`data-group="${g}" role="tab"`), 'top tab ' + g);
    // Deck actions and the strip.
    const { cleanHud } = require('../electron/deck');
    assert.deepEqual(cleanHud({ enabled: true, x: 10.6, y: -5, w: 10, h: 999, opacity: 'x', labels: false, all: true }, sanitize({}).deck.hud), { enabled: true, x: 11, y: -5, w: 160, h: 999, opacity: 92, labels: false, all: true });
  });

  await test('twitch: !clip from broadcaster or mods only, chat kept for alerts without viewer puppets', () => {
    const cfg = sanitize({ twitch: { enabled: false, channel: '' } }).twitch;
    const extra = { active: true, channel: 'civi', marker: { enabled: true, name: 'clip' } };
    const tc = new TwitchChat({ getSettings: () => cfg, setOverride() {}, getExtra: () => extra });
    const marks = [];
    tc.on('marker', (m) => marks.push(m));
    tc.channel = 'civi';
    const msg = (login, text, tags = '') => tc.handle(`@display-name=${login}${tags} :${login}!${login}@x PRIVMSG #civi :${text}`);
    msg('viewer', '!clip nope'); msg('modo', '!clip 1v3', ';mod=1'); msg('civi', '!CLIP', ';badges=broadcaster/1'); msg('modo', '!clips x', ';mod=1');
    assert.deepEqual(marks, [{ by: 'modo', note: '1v3' }, { by: 'civi', note: '' }]);
    extra.marker.enabled = false; msg('civi', '!clip', ';badges=broadcaster/1');
    assert.equal(marks.length, 2);
    tc.close();
  });

  await test('v1.6/1.7: Baba Bot, giveaway, poll, game counters, ad warning, Discord go-live, friends\' cams settings', async () => {
    // Chat roles and emotes reach the chat event.
    const tcfg = sanitize({}).twitch;
    const tc = new TwitchChat({ getSettings: () => tcfg, setOverride() {}, getExtra: () => ({ active: true, channel: 'civi' }) });
    tc.channel = 'civi';
    const seen = [];
    tc.on('chat', (m) => seen.push(m));
    tc.handle('@badges=subscriber/12,vip/1;display-name=Kiwi;emotes=25:0-4,6-10;first-msg=1 :kiwi!kiwi@x PRIVMSG #civi :Kappa Kappa');
    assert.equal(seen[0].sub, true); assert.equal(seen[0].vip, true); assert.equal(seen[0].first, true); assert.equal(seen[0].emotes, '25:0-4,6-10'); assert.ok(!seen[0].mod);
    tc.close();

    const { LabChat, fill } = require('../electron/lab-chat');
    assert.equal(fill('Hi {name}, {nope}', { name: 'Kiwi' }), 'Hi Kiwi, {nope}');
    assert.ok(['a', 'b'].includes(fill('{random:a|b}', {})));
    let lab = sanitize({ lab: { chatbot: { enabled: true, welcome: true, timers: [{ text: 'Follow!', minutes: 1 }], timerLines: 1 }, sounds: { enabled: true, who: 'subs', cooldown: 0, userCooldown: 0, list: [{ name: 'airhorn', file: '0123456789abcdef.mp3', volume: 0.5 }] },
      counters: [{ id: 'cnt1', name: 'Morts', cmd: 'mort', value: 0, plusKey: 'Alt+1', minusKey: 'Bad key!' }] } }).lab;
    assert.equal(lab.counters[0].plusKey, 'Alt+1'); assert.equal(lab.counters[0].minusKey, '', 'invalid shortcut dropped');
    const said = [], played = [], events = [];
    const lc = new LabChat({ getSettings: () => lab, say: async (x) => { said.push(x); }, live: () => ({ startedAt: new Date(Date.now() - 65 * 60000).toISOString(), title: 'T', game: 'G', viewers: 5 }),
      api: { login: 'civi', userId: '1', helix: async () => ({ data: [] }) }, userIdOf: async () => '2', playSound: (x) => played.push(x), setCounters: (l) => { lab = Object.assign({}, lab, { counters: l }); },
      broadcast: (ev, d) => events.push(d.type), notify() {}, log: { info() {}, warn() {} }, t: (x, v) => x.replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m)) });
    clearInterval(lc.timer);
    const SAY_WAIT = () => new Promise((r) => setTimeout(r, 30));
    lc.onChat({ login: 'newbie', display: 'Newbie', text: 'hello', first: true });
    lc.onChat({ login: 'kiwi', display: 'Kiwi', text: '!discord' });
    lc.onChat({ login: 'kiwi', display: 'Kiwi', text: '!discord' }); // cooldown
    lc.onChat({ login: 'kiwi', display: 'Kiwi', text: '!uptime' });
    await SAY_WAIT();
    assert.equal(said.length, 1, 'one message at a time');
    lc.sayQ.length = 0;
    assert.match(said[0], /Bienvenue Newbie/);
    // Sounds: subs only.
    lc.onChat({ login: 'pleb', display: 'Pleb', text: '!airhorn' });
    lc.onChat({ login: 'subby', display: 'Subby', text: '!airhorn', sub: true });
    assert.deepEqual(played, [{ file: '0123456789abcdef.mp3', volume: 0.5 }]);
    // Counters: mods change, everyone reads.
    lc.onChat({ login: 'pleb', display: 'Pleb', text: '!mort+' });
    assert.equal(lab.counters[0].value, 0);
    lc.onChat({ login: 'modo', display: 'Modo', text: '!mort+', mod: true });
    lc.onChat({ login: 'modo', display: 'Modo', text: '!mort +3', mod: true });
    assert.equal(lab.counters[0].value, 4);
    lc.bumpCounter('cnt1', 'reset');
    assert.equal(lab.counters[0].value, 0);
    // Giveaway: only while open, subs get more tickets, a winner is never drawn twice.
    lc.onChat({ login: 'early', display: 'Early', text: '!join' });
    lc.giveawayOp('open');
    for (const [login, sub] of [['a', false], ['b', true], ['a', false]]) lc.onChat({ login, display: login.toUpperCase(), text: '!join', sub });
    let snap = lc.snapshot();
    assert.equal(snap.giveaway.count, 2); assert.equal(snap.giveaway.tickets, 1 + lab.giveaway.subLuck);
    const w1 = lc.giveawayOp('draw').login, w2 = lc.giveawayOp('draw').login;
    assert.notEqual(w1, w2);
    assert.throws(() => lc.giveawayOp('draw'), /Nobody/);
    assert.ok(events.includes('giveaway-winner'));
    // Poll: numbers vote, a voter can change their mind, results at the end.
    lc.pollStart({ question: 'Game?', options: ['A', 'B', ''], seconds: 30 });
    lc.onChat({ login: 'x', display: 'X', text: '1' }); lc.onChat({ login: 'y', display: 'Y', text: '!vote 2' }); lc.onChat({ login: 'x', display: 'X', text: '2' }); lc.onChat({ login: 'z', display: 'Z', text: '9' });
    snap = lc.snapshot();
    assert.deepEqual(snap.poll.options.map((o) => o.votes), [0, 2]);
    lc.pollEnd();
    assert.equal(lc.snapshot().poll.winner, 1); assert.equal(lc.snapshot().poll.open, false);
    assert.throws(() => lc.pollStart({ question: 'Q', options: ['only one'] }));
    // Tabs: without Baba Bot the bot stays quiet (sounds too), counters still answer while Widget Twitch is kept.
    const tabsOn = { bot: false, games: true, counters: true };
    const lc2 = new LabChat({ getSettings: () => lab, on: (w) => tabsOn[w], say: async (x) => { said.push(x); }, live: () => null, api: { login: 'civi' }, playSound: (x) => played.push(x), setCounters: (l) => { lab = Object.assign({}, lab, { counters: l }); }, broadcast() {}, notify() {}, log: { info() {}, warn() {} }, t: (x) => x });
    clearInterval(lc2.timer);
    const before = played.length;
    lc2.onChat({ login: 'subby2', display: 'Subby2', text: '!airhorn', sub: true });
    assert.equal(played.length, before, 'no sound commands without Baba Bot');
    lc2.onChat({ login: 'modo', display: 'Modo', text: '!mort+', mod: true });
    assert.equal(lab.counters[0].value, 1);
    lc2.bumpCounter('cnt1', 'reset');
    lc2.stop();
    // Session + timers
    lc.onEvent({ type: 'follow' }); lc.onEvent({ type: 'sub', kind: 'gift', count: 5 }); lc.onEvent({ type: 'sub', kind: 'gift', bundled: true }); lc.onEvent({ type: 'raid', count: 12 });
    snap = lc.snapshot().session;
    assert.equal(snap.follows, 1); assert.equal(snap.gifts, 5); assert.equal(snap.raiders, 12); assert.ok(snap.chatters >= 5);
    said.length = 0; lc.sayQ.length = 0;
    lc.timerState = [{ at: Date.now() - 2 * 60000, lines: 0 }];
    lc.tick();
    for (let i = 0; i < 60 && !said.length; i++) await SAY_WAIT(); // the sender waits 1.2 s between two messages
    assert.deepEqual(said, ['Follow!']);
    lc.onLive(null, { startedAt: 'x' }); // live ended: summary kept for the panel
    assert.match(lc.snapshot().lastSummary.text, /17 messages/);
    lc.onLive({ startedAt: new Date(Date.now() - 65 * 60000).toISOString() }, null); // new live: new session
    assert.equal(lc.snapshot().session.messages, 0);
    assert.match(lc.summaryText(), /1 h 05/);
    lc.stop();

    // Ads: warning once per ad, snooze.
    const { LabTools, WEBHOOK_RE } = require('../electron/lab-tools');
    const now = Math.floor(Date.now() / 1000);
    const posted = [], notes = [], tsaid = [];
    const tools = new LabTools({ getSettings: () => sanitize({ lab: { ads: { enabled: true, warnSec: 60 }, discordLive: { enabled: true } } }).lab,
      api: { connected: true, userId: '1', login: 'civi', helix: async (m, path) => (path === 'channels/ads' ? { data: [{ next_ad_at: now + 50, duration: 90, snooze_count: 2 }] } : { data: [{ next_ad_at: now + 350, snooze_count: 1 }] }) },
      live: () => ({ startedAt: new Date().toISOString(), title: 'Hi', game: 'G' }), say: async (x) => tsaid.push(x), notify: (a) => notes.push(a), broadcast() {}, log: { info() {}, warn() {} },
      t: (x, v) => x.replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m)), getWebhook: () => 'https://discord.com/api/webhooks/123456/abcdefghijklmnopqrstuvwxyz',
      fetch: async (url, o) => { posted.push([url, JSON.parse(o.body)]); return { ok: true, status: 204 }; } });
    clearInterval(tools.timer);
    await tools.tick(); await tools.tick();
    assert.equal(tsaid.length, 1); assert.match(tsaid[0], /dans \d+ s/); assert.equal(notes.length, 1);
    const sn = await tools.snooze();
    assert.equal(sn.snoozes, 1); assert.ok(sn.nextAt > Date.now() + 5 * 60000 - 2000);
    await tools.onLive({ startedAt: new Date().toISOString(), title: 'Ranked', game: 'Valorant' }, null);
    assert.equal(posted.length, 1); assert.match(posted[0][1].content, /civi est en live : \*\*Ranked\*\* \(Valorant\)/);
    await tools.onLive({ startedAt: new Date(Date.now() - 3600000).toISOString() }, null);
    assert.equal(posted.length, 1, 'no message when the app restarts mid-live');
    assert.ok(WEBHOOK_RE.test('https://discord.com/api/webhooks/123456/abcdefghijklmnopqrstuvwxyz')); assert.ok(!WEBHOOK_RE.test('https://evil.com/api/webhooks/1/abc'));
    tools.stop();

    // Deck actions (My stream, game counters), friends' cams settings.
    const { cleanAction } = require('../electron/deck');
    assert.deepEqual(cleanAction({ type: 'lab.counter', name: 'cnt1', delta: '99999' }), { type: 'lab.counter', name: 'cnt1', delta: '1000' });
    assert.equal(cleanAction({ type: 'lab.giveaway', op: 'rm -rf' }).op, 'draw');
    assert.equal(cleanAction({ type: 'lab.queue' }), null, 'removed in v1.7');
    assert.equal(cleanAction({ type: 'app.savane' }), null, 'removed in v1.7');
    const sv = sanitize({ savane: { layout: 'free', friends: [{ id: 'Fabcdefgh12', name: 'Kiwi <b>', on: true }, { id: 'Fabcdefgh12', name: 'dup' }, { id: '../x', name: 'bad' }, { id: 'Fzzzzzzzz9', name: '', on: false }],
      positions: [{ id: 'Fabcdefgh12', x: 0.1, y: 0.1, w: 0.4, h: 0.4 }, { id: 'Fabcdefgh12', x: 0.5, y: 0.5, w: 0.2, h: 0.2 }, { id: '<x>', x: 0 }], logo: '/etc/passwd', password: 'a b' } }).savane;
    assert.equal(sv.friends.length, 2); assert.equal(sv.friends[0].name, 'Kiwi b'); assert.equal(sv.friends[1].on, false);
    assert.equal(sv.positions.length, 1); assert.equal(sv.positions[0].x, 0.5); assert.equal(sv.logo, ''); assert.equal(sv.password, '');
    assert.ok(!('room' in sv) && !('labels' in sv), 'the room is gone');
  });

  const { Markers, vodTime, vodLink, dayKey } = require('../electron/markers');
  await test('timestamps: live only, offset, Twitch marker, VOD link, edit, delete by day', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'po-mk-'));
    const store = new Store(dir, {});
    let streams = { data: [] }, markerFails = false;
    const calls = [];
    const api = { connected: true, userId: '42', helix: async (m, p, q, b) => {
      calls.push([m, p, q, b]);
      if (p === 'streams') return streams;
      if (p === 'streams/markers') { if (markerFails) throw new Error('Past broadcasts disabled'); return { data: [{ id: 'MK1' }] }; }
      if (p === 'videos') return { data: [{ id: '999', stream_id: 'S1' }] };
      throw new Error('unexpected ' + p);
    } };
    const mk = new Markers({ api, store, getSettings: () => store.settings.markers });
    try {
      await assert.rejects(mk.add({ source: 'hotkey' }), /not live/);
      streams = { data: [{ id: 'S1', started_at: new Date(Date.now() - 3725 * 1000).toISOString(), title: 'Ranked', game_name: 'Deadlock' }] };
      const m = await mk.add({ source: 'hotkey', note: '  huge fail ' });
      assert.ok(Math.abs(m.offset - 3725) <= 1); assert.equal(m.note, 'huge fail'); assert.equal(m.twitchMarker, 'MK1');
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(m.videoId, '999');
      assert.equal(vodTime(3725), '1h02m05s');
      assert.equal(vodLink({ videoId: '999', offset: 3725 }, 30), 'https://www.twitch.tv/videos/999?t=1h01m35s');
      markerFails = true;
      const m2 = await mk.add({ source: 'chat', by: 'modo' });
      assert.equal(m2.twitchMarker, null); assert.equal(mk.list.length, 2, 'kept locally when Twitch refuses the marker');
      mk.update(m2.id, { note: 'clutch', done: true }); assert.equal(mk.list[1].done, true);
      mk.list[0].at = new Date(2026, 0, 5, 12).getTime();
      mk.removeDay('2026-01-05'); assert.deepEqual(store.data.markers.map((x) => x.id), [m2.id]);
      assert.equal(dayKey(new Date(2026, 10, 22, 0, 30).getTime()), '2026-11-22');
      store.flush();
      assert.equal(new Store(dir, {}).data.markers.length, 1, 'timestamps persist');
    } finally { mk.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await test('widget looks: validation, themes, share codes, migration of old widget settings', () => {
    const WS = require('../web/shared/widget-schema.js');
    for (const w of WS.WIDGETS) assert.deepEqual(WS.sanitizeLook(w, WS.defaultLook(w)), WS.defaultLook(w), w + ' defaults are valid');
    const bad = WS.sanitizeLook('spotify', { layout: 'inline', cover: 'vinyl', size: 999, font: 'x"}{', accent: '#ABCDEF', label: 'a\u0000b', speed: 33, letterSpacing: 1.3 });
    assert.equal(bad.layout, 'compact'); assert.equal(bad.cover, 'vinyl'); assert.equal(bad.size, 200); assert.equal(bad.font, 'Segoe UI');
    assert.equal(bad.accent, '#abcdef'); assert.equal(bad.label, 'ab'); assert.equal(bad.speed, 35, 'rounded to the step'); assert.equal(bad.letterSpacing, 1.5);
    const neon = WS.applyPreset(Object.assign(WS.defaultLook('subs'), { label: 'Mes subs', goal: 50 }), 'neon');
    assert.equal(neon.frame, 'neon'); assert.equal(neon.label, 'Mes subs'); assert.equal(neon.goal, 50, 'themes keep the content');
    for (const pr of WS.PRESETS) for (const w of WS.WIDGETS) assert.deepEqual(WS.sanitizeLook(w, WS.applyPreset(WS.defaultLook(w), pr.id)), WS.applyPreset(WS.defaultLook(w), pr.id), `${pr.id} is valid for ${w}`);
    const code = WS.encodeStyle(Object.assign(WS.defaultLook('spotify'), { frame: 'paper', accent: '#123456', layout: 'gallery' }));
    const got = WS.decodeStyle(code, WS.defaultLook('followers'), 'followers');
    assert.equal(got.frame, 'paper'); assert.equal(got.accent, '#123456'); assert.equal(got.layout, 'inline', 'layout is content, not shared');
    assert.equal(WS.decodeStyle('WID1.!!!', WS.defaultLook('subs'), 'subs'), null);
    // v1.4: album cover / profile picture menu, song progress; one editor page per widget.
    assert.equal(WS.defaultLook('latestSub').avatar, 'circle'); assert.equal(WS.defaultLook('spotify').progress, 'bar');
    assert.equal(WS.sanitizeLook('latestFollower', { avatar: 'hexagon', avatarSize: 999 }).avatar, 'circle');
    assert.equal(WS.sanitizeLook('latestFollower', { avatarSize: 999 }).avatarSize, 250);
    assert.ok(!('avatar' in WS.defaultLook('spotify')) && !('progress' in WS.defaultLook('followers')), 'props only where they apply');
    for (const w of WS.WIDGETS) for (const p of WS.propsFor(w)) assert.ok(WS.GROUPS.some(([g]) => g === p.group), p.key + ' has a menu');
    const panelHtml = read('web/panel.html');
    for (const w of WS.WIDGETS) {
      assert.ok(panelHtml.includes(`data-tab="w-${w}"`), 'sidebar entry for ' + w);
      assert.match(panelHtml, new RegExp(`data-panels="[^"]*\\bw-${w}\\b`), 'page for ' + w);
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'po-wmig-'));
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ settings: { widgets: { font: 'Georgia', size: 50, color: '#ff0000', style: 'plain', followers: { label: 'Fans', goal: 2000 }, spotify: { enabled: true, showCover: false, hideWhenPaused: false } } } }));
    const st = new Store(dir, {});
    const lk = st.settings.widgets.looks;
    assert.equal(lk.followers.font, 'Georgia'); assert.equal(lk.followers.label, 'Fans'); assert.equal(lk.followers.goal, 2000); assert.equal(lk.subs.frame, 'none');
    assert.equal(lk.spotify.cover, 'none'); assert.equal(lk.spotify.hideWhenPaused, false); assert.equal(st.settings.widgets.spotify.enabled, true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // ---------- Translations ----------
  await test('i18n: every UI string has a French translation', () => {
    const I = globalThis.I18N;
    I.setLang('fr');
    const missing = new Set();
    const need = (s) => {
      const raw = String(s), k = raw.replace(/\s+/g, ' ').trim();
      if (/[a-z]/i.test(k) && I.t(raw) === raw && I.t(k) === k && !SAME.has(k)) missing.add(k);
    };
    // Strings that are identical in French.
    const SAME = new Set(['owner/repo', 'Discord', 'Twitch', 'Overlay', 'Avatars', 'OBS / Streamlabs', 'Position', 'Pastel', 'Monochrome', 'Sub', 'Bits', 'Raid', 'Zoom', 'LaboHub',
      'English', 'Français', 'Application ID', 'Client Secret', 'Redirect URI', 'Public Client', 'Normal', 'portable', 'Puppet', 'Discord + Twitch', 'Version', 'Timo', 'PUP1.…', '🌐 Auto',
      'OK', 'Spotify', 'Stream Together', 'Segoe UI', 'Volume', 'Labo', 'Hub', 'Timestamps', 'Puppet Overlay', 'HUD Twitch', 'Hub Labo', 'Clips', 'LaboHub', '⚙', 'Ctrl+1', 'Ctrl+2', 'Ctrl+3', 'Ctrl+K', 'Ctrl K', 'Guide', 'Puppet Overlay — guide', 'HUD Twitch — guide', 'Hub Labo — guide', 'Raid, collab, chat', 'Badge', 'Compact', 'Boxy', 'Terminal', 'Note', 'Animations', 'Transparent', 'Accent', 'Mono', 'auto', 'Minimal', 'Labo', 'Neon', 'via {source}', 'chat', 'Followers', 'Subs', 'Follow', 'Chat', 'Chats', 'Style', '{n} min', '{h} h {m} min', '{n} viewers', 'Monocle', 'Long', 'Afro', 'Cowboy', 'Bandana', 'Pirate', 'Cape', 'Kimono', 'Pizza',
      'Ctrl+4', 'Ctrl+5', 'Ctrl+6', 'BabaDeck', 'BabaDeck — guide', 'labo_savane_…', 'github_pat_…', 'preview', 'Podcast du Labo', 'OBS', 'X', 'Y', 'Port', 'Sombrero', 'Piercing', 'Jetpack', 'Message', 'Multi-stream', 'Live', 'Mode', 'Scenes',
      '1920 × 1080 (Full HD)', '1280 × 720 (HD)', '2560 × 1440 (2K)', '📺 → OBS', 'Viking', 'Bubbles', 'Code', 'La savane — guide', 'Timeout 10 min', 'Source', 'Page {n}', 'Clip', '10 pages max', 'Timestamp (+ clip)', 'Centre', 'Labo test', 'Rectangle', '＋ Page', '1080 × 1920 (vertical)',
      'La savane', 'Just Chatting', 'Studio', 'Action', 'mods', 'min', 'Widget Twitch', 'Baba Bot', 'Widget Twitch — guide', 'QWERTY', 'AZERTY', 'GIF', 'Ctrl+1 · ', 'Shift', '{name} — guide', 'Page',
      'LaboHub — overlay', 'BabaDeck HUD', 'KB', 'Twitch account →', 'Son Twitch', 'Discord: “I\'m live”',
      '{n} votes', 'messages', 'subs', 'bits', 'raids', '{n} msg/min', 'GIVEAWAY', '{n} bits', '{n} raids ({v} viewers)', '🎉 Giveaway', 'HD (720p)', 'Full HD (1080p)', 'Labo test — overlay']);
    // JS: literal arguments of t(), creator tab/item labels, panel command help.
    for (const f of ['web/panel.js', 'web/creator.js', 'web/overlay.js', 'web/overlay/placement.js', 'electron/main.js', 'electron/windows.js', 'electron/desktop.js',
      'web/panel-alerts.js', 'web/panel-stream.js', 'web/panel-hub.js', 'web/panel-markers.js', 'web/panel-guides.js', 'web/panel-ui.js', 'web/panel-editor.js', 'web/widget.js',
      'web/panel-room.js', 'web/panel-scenes.js', 'web/panel-deck.js', 'web/panel-bot.js', 'web/widget-chat.js', 'electron/lab.js',
      'web/lab-widget.js', 'electron/lab-chat.js', 'electron/lab-tools.js', 'web/panel-media.js', 'web/panel-keys.js', 'web/panel-cams.js', 'web/panel-mystream.js',
      'web/panel-bababot.js', 'web/panel-counters.js', 'web/panel-tour.js', 'web/cams.js', 'web/deck-hud.html']) {
      const src = read(f);
      for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)+)'/g)) need(m[1].replace(/\\'/g, "'"));
      for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)+)"/g)) need(m[1]);
      if (f === 'web/creator.js') for (const m of src.matchAll(/label: '([^']+)'/g)) need(m[1]);
      // Errors the panel shows through t(e.message), background preset names.
      if (/electron\/lab-(chat|tools)\.js$/.test(f)) for (const m of src.matchAll(/new Error\('([^']+)'\)/g)) need(m[1]);
      if (f === 'electron/lab-tools.js') for (const m of src.matchAll(/error: [^?]+\? '([^']+)'/g)) need(m[1]);
      // Recommended keys, shortcut names, tab descriptions, CSS snippets.
      if (f === 'web/panel-keys.js') for (const m of src.matchAll(/\['(?:[^'\\]|\\.)+', '((?:[^'\\]|\\.)+)'(?:, '\w+')?\]/g)) need(m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
      if (f === 'web/panel-tour.js') for (const m of src.match(/const DESC = \{([\s\S]*?)\};/)[1].matchAll(/: '((?:[^'\\]|\\.)+)'/g)) need(m[1].replace(/\\'/g, "'"));
      if (f === 'web/panel-editor.js') for (const m of src.match(/const CSS_SNIPPETS = \[([\s\S]*?)\];/)[1].matchAll(/\['([^']+)', /g)) need(m[1]);
      if (f === 'web/panel-deck.js') for (const m of src.matchAll(/\['[\w.]+', '[^']+', '([^']+)'\]/g)) need(m[1]);
      if (f === 'web/panel.js') for (const m of src.match(/const COMMANDS = (.*);/)[1].matchAll(/\['\w+', '([^']+)'\]/g)) need(m[1]);
      // Labels in the new tabs' tables: ['key', 'Label', …]
      if (/panel-(alerts|stream)\.js$/.test(f)) for (const m of src.matchAll(/\['[\w-]+', '([^']+)'(?:, '([^']+)')?(?:, ('[^']+'|null))?\]/g)) { need(m[1]); if (m[2] && !/^\d/.test(m[2])) need(m[2]); if (m[3] && m[3] !== 'null') need(m[3].slice(1, -1)); }
      // Status texts and error messages shown through t(variable).
      if (/panel-(stream|hub|markers|keys|mystream)\.js$/.test(f)) for (const m of src.matchAll(/const (?:NP|STATUS|SOURCE|OBS_STATUS) = \{([^}]*)\}/g)) for (const v of m[1].matchAll(/: '([^']+)'/g)) need(v[1]);
    }
    for (const values of Object.values(P.OPTIONS)) for (const v of values) need(P.prettyLabel(v));
    // Widget editor: property labels, sections and theme names come from the schema.
    const WS = require('../web/shared/widget-schema.js');
    for (const p of WS.PROPS) need(p.label);
    for (const [, g] of WS.GROUPS) need(g);
    for (const pr of WS.PRESETS) need(pr.name);
    // HTML: text nodes and placeholders/titles outside data-no-i18n, rich blocks as a whole.
    const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    for (const page of ['web/panel.html', 'web/creator.html', 'web/cams.html', 'web/lab.html', 'web/deck-hud.html']) {
      let html = read(page).replace(/<(script|style)[\s\S]*?<\/\1>/g, '');
      html = html.replace(/<(\w+)([^>]*)\sdata-i18n-html([^>]*)>([\s\S]*?)<\/\1>/g, (m, tag, a, b, inner) => { need(inner); return ''; });
      html = html.replace(/<code>[\s\S]*?<\/code>/g, '').replace(/(placeholder|title)="(https?:|#)[^"]*"/g, '');
      html = html.replace(/<(\w+)[^>]*\sdata-no-i18n[^>]*>[\s\S]*?<\/\1>/g, '');
      for (const m of html.matchAll(/(?:placeholder|title)="([^"]+)"/g)) need(decode(m[1]));
      for (const m of html.matchAll(/>([^<>]+)</g)) need(decode(m[1]));
    }
    I.setLang('en');
    assert.equal(missing.size, 0, 'Missing French strings:\n       ' + [...missing].join('\n       '));
  });

  // ---------- Repository hygiene ----------
  // Files every tool (Git for Windows, the NSIS packer, Explorer) can handle: v0.10.0 failed to build on Windows
  // because of one badly named file.
  await test('repo: Windows-safe file names, no case clashes, no stray build output', () => {
    const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;
    const bad = [], seen = new Map();
    (function walk(dir) {
      for (const ent of fs.readdirSync(rel(dir), { withFileTypes: true })) {
        if (['.git', 'node_modules', 'dist'].includes(ent.name)) continue;
        const p = dir ? dir + '/' + ent.name : ent.name;
        if (/[<>:"|?*\u0000-\u001f\\]/.test(ent.name) || /[. ]$/.test(ent.name) || RESERVED.test(ent.name)) bad.push(p);
        const low = p.toLowerCase();
        if (seen.has(low)) bad.push(`${p} (same name as ${seen.get(low)})`); else seen.set(low, p);
        if (ent.isDirectory()) walk(p);
      }
    })('');
    assert.deepEqual(bad, []);
    for (const f of ['app-update.bin', 'electron/app-update.yml']) assert.ok(!fs.existsSync(rel(f)), f);
  });

  await test('repo: no debugger statements, no unused requires in the main process', () => {
    const problems = [];
    for (const f of [...listJs('electron'), ...listJs('web'), ...listJs('tools')]) {
      const src = read(f);
      if (/^\s*debugger\s*;?\s*$/m.test(src)) problems.push(`${f}: debugger`);
      if (!f.startsWith('electron')) continue;
      for (const m of src.matchAll(/^const (?:\{([^}]+)\}|(\w+)) = require\(/gm)) {
        const names = m[1] ? m[1].split(',').map((x) => x.split(':').pop().trim()).filter(Boolean) : [m[2]];
        for (const n of names) if ((src.match(new RegExp(`\\b${n}\\b`, 'g')) || []).length < 2) problems.push(`${f}: unused ${n}`);
      }
    }
    assert.deepEqual(problems, []);
  });

  await test('i18n: no duplicate keys in the French dictionary', () => {
    const src = read('web/shared/i18n.js');
    const body = src.slice(src.indexOf('const FR = {'), src.indexOf('\n  };', src.indexOf('const FR = {')));
    const keys = new Map(), dups = [];
    // A key is a string literal followed by ':' (values are followed by ',' or a line end).
    for (const m of body.matchAll(/('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")\s*:/g)) {
      const k = m[1];
      if (keys.has(k)) dups.push(k.slice(0, 80)); else keys.set(k, true);
    }
    assert.deepEqual(dups, []);
  });

  // ---------- Report ----------
  let failed = 0;
  for (const [ok, name, err] of results) {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
    if (!ok) { failed++; console.log('     ' + String((err && err.stack) || err).split('\n').slice(0, process.env.FULL ? 400 : 8).join('\n     ')); }
  }
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
