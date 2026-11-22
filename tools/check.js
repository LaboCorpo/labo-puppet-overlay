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

const PUPPET_FILES = ['avatar', 'gfx', 'animator', 'body', 'face', 'hair', 'render'].map((f) => `web/shared/puppet/${f}.js`);

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
      widgets: { font: 'Comic"; } body{', size: 999, color: 'red', style: 'pill' },
      hub: { members: ['@LaboCorpo', 'https://twitch.tv/x', 'ok_name', 'ok_name', 'a b'], pollSec: 1 },
      twitchApi: { clientId: 'NOT VALID' },
    });
    assert.equal(s.alerts.output, 'app'); assert.equal(s.alerts.volume, 1);
    assert.deepEqual(s.alerts.bits, { mode: 'all', sounds: [{ file: f, name: 'x'.repeat(80), volume: 0, min: 250 }] });
    assert.equal(s.alerts.sub.mode, 'random');
    assert.equal(s.widgets.font, 'Segoe UI'); assert.equal(s.widgets.size, 200); assert.equal(s.widgets.color, '#ffffff');
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
    const fakeApi = { connected: true, userId: '42', helix: async (m, p) => { if (p === 'channels/followers') return followers; const e = new Error('nope'); e.status = 400; throw e; } };
    const st = new StreamStats({ api: fakeApi, intervalMs: 1e9 });
    const follows = [];
    st.on('follow', (f) => follows.push(f));
    await st.poll();
    assert.equal(st.data.followers, 10); assert.equal(follows.length, 0, 'first poll is not a new follow');
    assert.equal(st.data.errors.subs, 'Sub count needs Twitch Affiliate or Partner');
    followers = { total: 11, data: [{ user_id: '2', user_login: 'new', user_name: 'New', followed_at: '2026-01-02T00:00:00Z' }] };
    await st.poll();
    assert.deepEqual(follows.map((f) => f.login), ['new']); assert.equal(st.data.latestFollower.display, 'New');
    st.onSub({ login: 'x', display: 'X', kind: 'prime' });
    assert.equal(st.data.latestSub.kind, 'prime');
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
    assert.equal(np.state.title, 'Song'); assert.equal(np.state.cover, 'https://img/300x300bb.jpg');
    proc.stdout.write('T:Spotify Premium\n');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(np.state.playing, false);
    np.setEnabled(false);
    assert.equal(np.state.status, 'off');
    const other = new NowPlaying({ platform: 'linux' }); other.setEnabled(true);
    assert.equal(other.state.status, 'unsupported');
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
    const SAME = new Set(['Discord', 'Twitch', 'Overlay', 'Avatars', 'OBS / Streamlabs', 'Position', 'Pastel', 'Monochrome', 'Sub', 'Bits', 'Raid', 'Zoom', 'Puppet Overlay',
      'English', 'Français', 'Application ID', 'Client Secret', 'Redirect URI', 'Public Client', 'Normal', 'portable', 'Puppet', 'Discord + Twitch', 'Version', 'Timo', 'PUP1.…', '🌐 Auto',
      'OK', 'Spotify', 'Stream Together', 'Segoe UI', 'Volume', 'Followers', 'Subs', 'Follow', 'Chat', 'Chats', 'Style', '{n} min', '{h} h {m} min', '{n} viewers', 'Monocle', 'Long', 'Afro', 'Cowboy', 'Bandana', 'Pirate', 'Cape', 'Kimono', 'Pizza']);
    // JS: literal arguments of t(), creator tab/item labels, panel command help.
    for (const f of ['web/panel.js', 'web/creator.js', 'web/overlay.js', 'web/overlay/placement.js', 'electron/main.js', 'electron/windows.js', 'electron/desktop.js',
      'web/panel-alerts.js', 'web/panel-stream.js', 'web/panel-hub.js', 'web/widget.js']) {
      const src = read(f);
      for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)+)'/g)) need(m[1].replace(/\\'/g, "'"));
      for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)+)"/g)) need(m[1]);
      if (f === 'web/creator.js') for (const m of src.matchAll(/label: '([^']+)'/g)) need(m[1]);
      if (f === 'web/panel.js') for (const m of src.match(/const COMMANDS = (.*);/)[1].matchAll(/\['\w+', '([^']+)'\]/g)) need(m[1]);
      // Labels in the new tabs' tables: ['key', 'Label', …]
      if (/panel-(alerts|stream)\.js$/.test(f)) for (const m of src.matchAll(/\['[\w-]+', '([^']+)'(?:, '([^']+)')?(?:, ('[^']+'|null))?\]/g)) { need(m[1]); if (m[2] && !/^\d/.test(m[2])) need(m[2]); if (m[3] && m[3] !== 'null') need(m[3].slice(1, -1)); }
      // Status texts and error messages shown through t(variable).
      if (/panel-(stream|hub)\.js$/.test(f)) for (const m of src.matchAll(/const (?:NP|STATUS) = \{([^}]*)\}/g)) for (const v of m[1].matchAll(/: '([^']+)'/g)) need(v[1]);
    }
    for (const values of Object.values(P.OPTIONS)) for (const v of values) need(P.prettyLabel(v));
    // HTML: text nodes and placeholders/titles outside data-no-i18n, rich blocks as a whole.
    const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    for (const page of ['web/panel.html', 'web/creator.html']) {
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

  // ---------- Report ----------
  let failed = 0;
  for (const [ok, name, err] of results) {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
    if (!ok) { failed++; console.log('     ' + String((err && err.stack) || err).split('\n').slice(0, 8).join('\n     ')); }
  }
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
