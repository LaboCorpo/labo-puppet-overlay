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
    for (const page of ['web/overlay.html', 'web/panel.html', 'web/creator.html']) {
      const srcs = [...read(page).matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
      for (const s of srcs) assert.ok(fs.existsSync(rel('web', s)), `${page}: missing ${s}`);
      const puppet = srcs.filter((s) => s.startsWith('shared/puppet/'));
      assert.deepEqual(puppet, PUPPET_FILES.map((f) => f.replace('web/', '')), `${page}: puppet modules missing or out of order`);
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
      'OK', 'Monocle', 'Long', 'Afro', 'Cowboy', 'Bandana', 'Pirate', 'Cape', 'Kimono', 'Pizza']);
    // JS: literal arguments of t(), creator tab/item labels, panel command help.
    for (const f of ['web/panel.js', 'web/creator.js', 'web/overlay.js', 'web/overlay/placement.js', 'electron/main.js', 'electron/windows.js', 'electron/desktop.js']) {
      const src = read(f);
      for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)+)'/g)) need(m[1].replace(/\\'/g, "'"));
      for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)+)"/g)) need(m[1]);
      if (f === 'web/creator.js') for (const m of src.matchAll(/label: '([^']+)'/g)) need(m[1]);
      if (f === 'web/panel.js') for (const m of src.match(/const COMMANDS = (.*);/)[1].matchAll(/\['\w+', '([^']+)'\]/g)) need(m[1]);
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
