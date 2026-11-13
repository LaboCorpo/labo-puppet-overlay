# CLAUDE.md — Puppet Overlay (handoff for Claude Code)

This file is everything needed to continue the project exactly where the previous conversation stopped. Read it fully before touching code.

---

## 1. Working with the maintainer

- **Language**: always answer the maintainer in **French**. Code, comments, commit messages, the README and English UI strings are in **English**. Every user-facing string must also get a **French** translation in `web/shared/i18n.js` (see §6).
- **Style**:
  - direct and precise; no marketing tone;
  - technical docs must be short, factual and concise ("approche doc technique factuelle plutôt que vendeuse");
  - end each delivery with a short summary of what changed, what was tested, and what the maintainer must do.
- **Autonomy**: the maintainer often answers from a phone.
  - Work autonomously.
  - Only ask questions that can be answered quickly: multiple choice, one decision per question.
  - Never block on questions you can resolve with sensible defaults; state the default you picked.
- **Honesty about limits**:
  - Discord's RPC exposes very little. Research (web search the official docs) before promising a Discord-dependent feature, and say plainly what is impossible.
  - Examples: other people's stream previews are not available; reactions and Go Live are not documented over RPC.
- **Delivery loop for every feature batch**: implement → test (§8) → bump version → commit → tag → push (§3).
  - GitHub Actions builds the Windows binaries.
  - The maintainer checks the build and tests on Windows with real Discord.
- **Tokens**: the maintainer gives short-lived fine-grained GitHub PATs in chat.
  - Never write them to files, configs, logs, git remotes or commit messages.
  - Use them only inline via `http.extraheader` (§3).
  - Remind the maintainer to delete each token once it's no longer needed.

## 2. Project summary

> **Current state (v0.8.1)**: screen-share display and voice effects removed (Discord RPC doesn't expose them). Clean-up/hardening pass done: large files split into modules, central settings validation, hardened API/RPC/IRC inputs, `npm test` check script run in CI, lower CPU use (idle overlay sleeps, preview capped at 30 fps, state pushes without avatars/viewers). Next: the friends release (§9).

The app is a Windows desktop overlay that shows people in your **Discord voice channel** as animated cut-paper puppets: the top half of the head hinges open when the person speaks. It is meant for a group of friends first, possibly a wider public later.

**Features (v0.8.0)**
- **Overlay**: transparent, click-through, always-on-top Electron window. It has a tray icon and a taskbar presence: status badge, thumbnail buttons, update progress.
- **Same scene in OBS/Streamlabs**: browser source at `http://localhost:47800/overlay.html` (`?scene=discord|twitch`).
- **Avatar creator** (`web/creator.html`, also works from `file://`):
  - drawn ("from scratch") or photo-based puppets;
  - many parts, colours and sliders, including offsets for every add-on;
  - tabs, per-tab randomise, undo/redo;
  - photo adjustments: rotate, mirror, brightness, contrast, saturation, black & white, cartoon.
- **Avatar sharing**: `.puppet` files (JSON) or `PUP1.` codes (base64url JSON, drawn avatars only), plus an optional shared sync file read every 2 minutes. The sync accepts a Gist page URL or a raw URL, containing either one code per line or JSON.
- **Discord voice data** comes from the local Discord client via RPC (named pipe). Covered: mute/deaf, speaking, nicknames, avatars.
- **Puppet behaviour**:
  - lively: blink, look at the speaker, intensity grows with talk time, falls asleep after N minutes;
  - mute shows tape over the mouth, deafen shows earmuffs;
  - entrance/exit VFX: walk, drop, pop, portal, teleport beam, feathers, smoke;
  - layouts: horizontal or vertical (separately for Discord and Twitch); placement mode (drag + wheel); per-member settings (hide, nickname, size, order).
- **Twitch**:
  - anonymous IRC chat; viewers as deterministic puppets with chat bubbles;
  - chat commands (`!jump`, `!hat crown`…), stored persistently per viewer;
  - raid, sub and bits effects;
  - chat sound: none / gibberish (WebAudio, one voice per viewer) / TTS (speechSynthesis).
- **App-wide**:
  - English + French UI with Auto language detection;
  - global hotkeys; launch with Windows (off by default); auto-update from GitHub Releases;
  - performance modes (performance / normal / eco), with an idle pause whenever nothing is on screen.

## 3. Repository, build, release

- **Repository**: `https://github.com/LaboCorpo/labo-puppet-overlay` (organization LaboCorpo; formerly `F4ilortrue/labo-puppet-overlay`). Default branch `main`.
- **Discord application ID**: `1570204741982756965`, baked into `electron/app-config.json`. The CI overrides it only if the repo variable `DISCORD_CLIENT_ID` is set.
- **CI** (`.github/workflows/build.yml`, runs on `windows-latest`):
  - `npm ci`, then `electron-builder --win portable nsis`;
  - uploads the binaries as Actions artifacts;
  - on `v*` tags, publishes a GitHub Release with `*.exe`, `latest.yml` and `*.blockmap` (the auto-updater needs the last two).
- **Release procedure**:
  1. Bump `"version"` in `package.json`.
  2. Commit, using the attribution trailer your session instructions provide.
  3. Run `git tag vX.Y.Z`.
  4. Push `main` and the tag.
- **Push without storing the token**:
  ```bash
  T='<PAT from the maintainer>'; AUTH=$(printf 'x-access-token:%s' "$T" | base64 -w0)
  git -c http.extraheader="Authorization: Basic $AUTH" push https://github.com/LaboCorpo/labo-puppet-overlay.git main vX.Y.Z
  ```
  - Never force-push, and never move existing tags: create a new patch version instead.
  - The GitHub REST API was not reachable from the previous environment, so build status had to be confirmed by the maintainer.
- **Updater**: `electron/updater.js`, with OWNER/REPO = LaboCorpo/labo-puppet-overlay.
  - The installed (NSIS) build uses `electron-updater`.
  - The portable build only checks `releases/latest` and opens the download page.
  - The repo must be public for friends to download releases and for updates to work.
- **Versions so far**:
  - v0.1.0 initial; v0.1.1 YAML fix;
  - v0.2.0 English UI, alive puppets, placement, hotkeys, auto-update, Twitch commands;
  - v0.3.0 i18n FR/EN; v0.4.0 rich creator, members, perf modes;
  - v0.5.0 fine sliders, entrance/exit VFX, taskbar; v0.6.0 org repo, chat sound, sync formats, README;
  - v0.7.0 vertical layouts, glasses height/spacing, held item in front;
  - v0.8.0 add-on offsets, new outfits/hats/items (hi-vis vest…), screen-share display, experimental voice effects;
  - v0.8.1 screen-share display and voice effects removed; clean-up/hardening pass, module split, `npm test`.

## 4. Architecture

```
electron/
  main.js          boot and wiring, appState(), applySettings(), actions dispatcher
  windows.js       overlay window (+ placement mode, crash rebuild), panel, creator
  desktop.js       tray menu, taskbar (badge, thumbnail buttons, progress, title), global hotkeys, login item;
                   refreshes coalesced (150 ms) and skipped when nothing changed
  server.js        http://127.0.0.1:<port> (47800, +1 if busy): static web/ + JSON API + SSE (/api/events)
  settings.js      DEFAULTS + sanitize() (enums, ranges, patterns, special maps/arrays) + deepMerge
  store.js         %APPDATA%/Puppet Overlay/config.json — validated load, migrate(), atomic debounced writes (retry on lock)
  avatars.js       cleanAvatar()/cleanAvatarMap(): normalize + Discord ID check, for API, sync and saved config
  sync.js          AvatarSync: shared avatar file (Gist/raw URL), parseSyncFile()
  discord-rpc.js   Discord IPC client (\\?\pipe\discord-ipc-N): handshake, AUTHORIZE (PKCE, Public Client),
                   AUTHENTICATE, voice channel subscriptions, speaking
  twitch.js        anonymous IRC over WebSocket (justinfan), commands, raids/subs/bits, watchdog, simulate()
  updater.js       electron-updater (installer) / GitHub latest-release check (portable)
  log.js           %APPDATA%/Puppet Overlay/logs/main.log (1 MB rotation)
  app-config.json  bundled defaults (Discord client ID)
web/
  overlay.html/.js scene host: SSE, chat sound, render loop (sleeps when nothing is on screen)
  overlay/         fx.js (entrances/exits, particles), discord.js (DiscordGroup), twitch.js (TwitchCrowd), placement.js
  panel.html/.js   settings & status UI (tabs: Status, Overlay, Avatars, Members, Twitch, OBS, Settings, Discord setup)
  creator.html/.js avatar creator (standalone-capable)
  shared/puppet/   window.Puppet, loaded in this order: avatar.js (format; also require()-d by the main process),
                   gfx.js (primitives, head geometry), animator.js, body.js, face.js, hair.js (parts), render.js (draw, bubbles)
  shared/chatsound.js  ChatSound (gibberish synth + TTS queue)
  shared/i18n.js   I18N.t/apply/resolve (keys = English strings) — also require()-d by main.js
  shared/ui.css    shared dark UI styles
build/             icon.png/.ico, taskbar badges (badge-*.png), thumbnail icons (thumb-*.png)
tools/check.js     automated checks (`npm test`, also in CI)
tools/mock-discord.js   fake Discord IPC server for tests (Windows named pipe or $XDG_RUNTIME_DIR)
```

**Data flow**: main process ⇄ pages over **HTTP + Server-Sent Events only**. There is no preload and no Electron IPC; pages are plain web pages, so OBS can load them too.

- **SSE events** (server → pages):

| Event | Content / when |
|---|---|
| `state` | settings, discord snapshot, known, syncStatus, twitchStatus, app info (version, placement, lang, update, displays, hotkeyErrors). `avatars` and `viewers` are only in the first event of a connection; later pushes carry `avatars` only when they changed (`pushState({avatars:true})`). Pages merge, they don't replace. |
| `speaking` | `{id, speaking}` |
| `chat` | Twitch message |
| `twitch-event` | `action`, `restyle`, `raid`, `sub`, `bits` |
| `viewer` | per-viewer change |
| `viewers-reset` | viewers cleared |
| `fx-test` | "replay entrances" |

- **API**:
  - `GET /api/state`, `POST /api/settings` (deep-merge patch), `POST /api/avatars`, `DELETE /api/avatars/:id`;
  - `POST /api/action {name, …}`:

| Action | Purpose |
|---|---|
| `reconnect` | reconnect / re-authorize Discord |
| `open-creator` | open the avatar creator |
| `placement` | placement mode on/off |
| `update-check` / `update-install` | updates |
| `open-logs` | open the logs folder |
| `open-url` | open a link |
| `twitch-test` | simulate a Twitch event |
| `clear-viewers` | reset viewer looks |
| `export-config` | back up settings & avatars |
| `fx-test` | replay entrances |
| `forget-member` | remove a known member |
| `sync-now` | re-read the sync file |

  - Non-GET requests are rejected unless the Origin is localhost or absent. Any request whose `Host` isn't `localhost`/`127.0.0.1` gets 421 (DNS rebinding).
  - Body limits: settings 200 KB, avatars 4 MB, actions 10 KB (413 above). Settings go through `sanitize()`, avatars through `cleanAvatar()`.
- **Exactly one page plays chat sound**: the desktop overlay (`host=desktop`) when output = `app`, or the OBS source when output = `obs`.
- **Overlay URL params**: `scene`, `host=desktop` (enables placement + app sound), `test=1` (panel preview: live settings + fake members/chat when empty), `demo=1` (fully offline). Demo-only extras: `fx=<entrance>`, `exit=`, `layout=vertical`. `window.puppetFxTest()` replays exits.

## 5. Discord constraints (verified against the official docs)

- **Access**: RPC voice data (`rpc`, `rpc.voice.read`) works only for the app owner and **App Testers (max 50)**, unless Discord approves the app. Every person who **runs** the app must be an accepted tester; people who only appear in the channel need nothing.
- **Auth**: AUTHORIZE over RPC with PKCE (requires *Public Client* enabled + redirect `http://localhost`). A client-secret fallback field exists in the panel. On auth failure the client halts (no popup loop) until the user clicks *Reconnect*; a stale stored token triggers one automatic re-authorization.
- **Tested and abandoned (v0.8.0)**: on the maintainer's real Discord client, `self_stream` (Go Live) is **not** reported in RPC voice states, and SUBSCRIBE to `VOICE_CHANNEL_EFFECT_SEND` (emoji reactions/soundboard) is **refused**. Both features were removed. Don't re-add them over RPC; the only path would be a hosted bot connected to the voice channel (gateway).
- **Wider public release** needs one of:
  - Discord approval (uncertain);
  - a "bring your own Discord app" onboarding wizard (most realistic; the panel already accepts a custom Application ID);
  - a hosted bot (heavy).

## 6. Code guidelines

- **Stack**: plain JavaScript, no framework, no bundler, no TypeScript.
  - Runtime dependencies: only `electron-updater`; dev: `electron`, `electron-builder`.
  - Don't add dependencies unless clearly necessary.
- **`web/` files are classic scripts** (no ES modules), so `creator.html` works from `file://`. Shared modules attach to `window` (`Puppet`, `I18N`, `ChatSound`); `shared/puppet/avatar.js` and `i18n.js` are also `require()`-able in Node via `globalThis`. Puppet modules share helpers through `Puppet.gfx` and `Puppet.parts`; overlay modules are factories (`OverlayFx(scene)`, `DiscordGroup(scene, fx)`, `TwitchCrowd(scene, fx)`, `Placement(...)`) sharing one `scene` object.
- **Renderer conventions (`shared/puppet/`)**:
  - Local units: feet at (0,0), puppet ≈ 210 units tall, `HEAD = {cx:0, cy:-132, rx:60, ry:54}`, `NECK_Y = -84`.
  - Thick dark outline (`OUTLINE`, `stroke(ctx, w)`) and flat colours: the cut-paper look.
  - The head is split at the mouth line (`mouthHeight` for drawn heads, `photoSplit` for photos). The upper half rotates around `pivotX` at the back of the head, by `open * 0.6` rad.
  - Use `around(ctx, px, py, scale, rot, dx, dy)` for size/offset sliders.
  - `headTransform`/`headY`/`headTopLocal` handle head size/width/height and body height; use `headTopLocal(avatar)` to position bubbles/effects.
- **Avatar format**: `defaultAvatar()` (v3) contains every option and slider default.
  - `normalize()` keeps only known keys, clamps sliders, validates options, hex colours, `kind` and the photo (data:image URL, ≤1.5 MB), and maps legacy French values (`LEGACY`) and old `eyes:'glasses'`.
  - `SHARE_KEYS` = basic keys + all `OPTIONS` + all `SLIDERS`.
  - Always keep old codes/files loadable.
- **Adding a new part or option**: add it to `OPTIONS[...]` (`avatar.js`) → draw it in the matching `draw*` switch (`body.js`/`face.js`/`hair.js`) → (sliders) add to `SLIDERS` → expose in `creator.js` `TABS` (`photo: true` if it applies to photo puppets) → add the pretty label to `i18n.js` FR (`prettyLabel(v)` capitalises the value, e.g. `hivis` → `Hivis`). Twitch commands pick up new option values automatically (`twitch.js` reads `Puppet.OPTIONS`).
- **Adding a setting**: add it to `DEFAULTS` in `settings.js`, with its rule in `ENUMS`/`RANGES`/`PATTERNS` (otherwise only the type is checked; unknown keys are dropped) → add a panel control with `data-key="section.key"` (auto-bound; `data-number` for numeric selects) → read it where needed → add FR strings. Settings patches are deep-merged; arrays are replaced wholesale.
- **i18n**:
  - Keys are the exact English strings; `t('… {name} …', {name})` handles placeholders.
  - Static HTML is translated by walking text nodes. Use `data-i18n-html` on elements whose text contains inline markup (key = normalised innerHTML), and `data-no-i18n` on dynamic containers.
  - Every new UI string needs its FR entry.
- **Performance**:
  - The overlay loop honours `app.performance` (fps cap 0/60/30, DPR cap; panel preview capped at 30). When nothing is on screen it sleeps (1 s poll) and SSE events wake it at once: call `scene.wake()` from any new event source.
  - The panel unloads its preview iframe outside the Status tab.
  - Avoid per-frame allocations in hot paths, cap particle counts (600, eco 300 and fewer per burst), cache measured text (bubble wrapping), and keep any capture/polling low-rate and conditional.
  - Measured on Windows (fake Discord, 4 members, panel open): ~42 % of one core in Normal vs ~68 % before v0.8.1; overlay hidden + panel open ~17 % vs ~40 %. Most of the remaining cost is the GPU process compositing the full-screen transparent window. Next step if needed: size the overlay window to its content.
- **Robustness**:
  - Store writes are atomic and debounced (retried if the file is locked), and a corrupted config is kept as `.broken`.
  - The overlay renderer is rebuilt on crash; an exception in one frame is caught and the loop keeps running.
  - Discord RPC: bad frames are dropped, a pending restart is cancelled by `stop()`, only the latest channel selection wins. Twitch: watchdog reconnects after 6 min of silence; texts capped at 500 chars.
  - Log through `log.info/warn/error`.
  - Never let a feature failure break the overlay.
- **Security**:
  - The server binds to 127.0.0.1, with a Host check on every request and an Origin check on mutations.
  - Every avatar entering the store goes through `cleanAvatar()` (ID 15–22 digits; photo must be a data:image URL).
  - Known gap: the Discord token is stored in plain text in `config.json` (backlog: Electron `safeStorage`).
- **IP**: the art style is original (cut-paper marionettes). Never reference or reproduce South Park or other copyrighted characters in code, assets or docs.
- **Comments**: in English, short; explain the *why* for non-obvious code.

## 7. Settings reference (defaults and rules in `electron/settings.js`)

| Section | Settings |
|---|---|
| `app` | `language` (auto/en/fr), `performance`, `launchAtStartup` (false), `taskbarIcon` (true), `autoUpdate`, `hotkeys` |
| `overlay` | `enabled`, `layout`, `anchor` (corner or `custom` + `pos {x,y}` ratios), `scale`, `spacing`, `margin`, `display`, `maxVisible`, `entrance`, `exit`, `statusStyle` (props/badges/both), `sleepMinutes`, `lookAtSpeaker`, `showNames`, `showSelf`, `hideIdle`, `glow` |
| `twitch` | `enabled`, `channel`, `layout`, `anchor`/`pos`, `widthRatio`, `scale`, `maxViewers`, `bubbleSeconds`, `idleMinutes`, style (`palette`, `colors`, `hats`, `beards`, `showNames`, `useChatColor`, `bubbleBg`/`bubbleFg`), `ignore`, commands (`commandsEnabled`, `commandPrefix`, `hideCommands`, `disabledCommands`, cooldowns), effects (`raidEffects`, `raidMax`, `subEffects`, `bitsEffects`), `showOnDesktop`, `sound` (below) |
| `members` | `{ [discordId]: { hidden, alias, scale } }` |
| `memberOrder` | array of Discord IDs |
| `sync` | `url`, `intervalSec` |
| `discord` | `clientId`, `clientSecret`, `redirectUri` |

- `app.hotkeys` defaults: `toggleOverlay` Ctrl+Shift+O, `placement` Ctrl+Shift+P, `muteChat` Ctrl+Shift+M.
- `twitch.sound` fields: `mode`, `output` (app/obs), `volume`, `speed`, `pitch`, `voice`, `varyVoices`, `readNames`, `maxChars`, `maxQueue`, `muted`.
- Other top-level data in `config.json`: `avatars`, `syncedAvatars`, `viewers` (Twitch looks), `known` (members seen), `token`.

## 8. Testing (no Windows/Discord in the cloud sandbox)

1. **`npm test`** (`tools/check.js`, no dependencies, also run in CI before the build): syntax of every script, script order in the pages, avatar format, render smoke test of every option on a recording canvas, overlay frames (Discord/Twitch/effects/placement), settings validation, store, sync parsing, Twitch IRC parsing, server API (origin, host, limits, traversal), missing FR strings. Add a case there for every new feature.
2. **Offline scene**: open `web/overlay.html?demo=1[&fx=portal&layout=vertical]` with Playwright/Chrome and take screenshots (serve `web/` over HTTP; `file://` works too). Galleries of parts can be rendered by a small HTML page that loads `web/shared/puppet/*.js` and calls `Puppet.draw` in a grid; this is the fastest way to check new parts and sliders visually.
3. **Full app against a fake Discord** (on Windows: `node tools/mock-discord.js 0` then `node_modules\electron\dist\electron.exe --user-data-dir=<dir> .`, only when no real Discord owns `discord-ipc-0`):
   ```bash
   mkdir -p /tmp/run /tmp/ud
   echo '{"settings":{"discord":{"clientId":"123456789012345678"}},"token":{"clientId":"123456789012345678","access_token":"AT","refresh_token":"RT","expires_at":9999999999999}}' > /tmp/ud/config.json
   XDG_RUNTIME_DIR=/tmp/run node tools/mock-discord.js &          # 4 users, speaking events
   XDG_RUNTIME_DIR=/tmp/run xvfb-run -a ./node_modules/electron/dist/electron --no-sandbox --user-data-dir=/tmp/ud . &
   # then drive http://localhost:47800/panel.html and /overlay.html with Playwright; check /api/state
   ```
   - The `reconnect` action deletes the token, and the mock can't complete a real token exchange: rewrite `config.json` to recover.
   - The app takes ~10 s to boot under xvfb.
4. **Twitch**: `POST /api/action {name:'twitch-test', kind:'chat'|'command'|'sub'|'bits'|'raid'}`.
5. **Translations**: `npm test` lists missing FR strings; strings identical in French go in its `SAME` list.
6. **Still to verify on Windows by the maintainer**:
   - taskbar badge/thumbnail buttons;
   - global hotkeys;
   - login item;
   - auto-update;
   - TTS inside OBS (likely unsupported there → recommend output = app);
   - TTS chat sound with a real Twitch channel.

## 9. Backlog / next steps (agreed or proposed, not done)

**Done in v0.8.1**: clean-up/hardening pass (dead code removed, module split, `settings.js` validation, hardened API/RPC/IRC, `npm test` in CI, CPU reductions). Keep FR translations complete, old avatar codes/files loadable (`normalize()`) and old configs readable (`migrate()` + `sanitize()`).

**Optional follow-ups**
- [ ] Size the overlay window to its content instead of the full work area (the GPU process compositing the transparent full-screen window is now the main cost).
- [ ] Vertical Twitch crowd anchored bottom-left flips its growth direction once moved in placement mode (custom anchors always grow leftwards).

**For the friends release**
- [ ] Bake the default sync URL into `app-config.json` once the maintainer gives it. Suggested: a public repo `LaboCorpo/labo-puppet-avatars` with `avatars.txt` (one `PUP1.` code per line, raw URL).
- [ ] French welcome message for friends (install `setup.exe`, SmartScreen "Run anyway", authorize Discord, create & share the avatar, hotkeys).
- [ ] First-run wizard: detect the Discord ID, open the creator pre-filled, show hotkeys.
- [ ] "Copy diagnostics" button (logs + state). Also a "What's new" window after an update, and "Share my avatar" (open the file location / copy the code).

**For a public release**
- [ ] "Bring your own Discord app" onboarding.
- [ ] Encrypt the token with `safeStorage`.
- [ ] Code signing (Azure Trusted Signing or SignPath for OSS).
- [ ] Licence + privacy note.
- [ ] Landing page with a demo GIF + the online creator.
- [ ] Issue templates.
- [ ] Multi-monitor / DPI tests.

**Ideas mentioned earlier (not started)**
- Twitch badges as accessories (mod/VIP/sub); real Twitch emotes in bubbles (incl. 7TV/BTTV); viewer interactions (`!hug`, `!tomato @user`).
- Personal emotion hotkeys; mic-driven lip-sync for self.
- Puppet PNG/GIF export.
- OBS backdrops/scenes.
- Settings profiles.
- A relay server for real-time sync and shared reactions.

## 10. Original brief (for context)

The goal was a shareable executable for a group of friends:
1. A Discord voice visualizer with puppets whose heads split in two like a marionette, using profile pictures or custom avatars.
2. A Mii/Sims-like 2D avatar creator, from scratch or from a photo, with output shareable as a code or file and linked to the Discord ID.
3. Twitch viewers shown as random/unique avatars with chat bubbles, usable in OBS/Streamlabs.

Deliverables: the overlay `.exe` with a collapsible settings/status window in the taskbar plus OBS integration; the creator as a page or exe; and the Twitch module inside the main app with customisable viewer visuals.
