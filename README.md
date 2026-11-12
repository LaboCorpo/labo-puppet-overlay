# Puppet Overlay

A Discord voice overlay where everyone in your call is a cut-paper puppet: the top of the head flaps open when they talk. It comes with an avatar creator (draw one from scratch or start from a photo) and Twitch viewers who show up as their own puppets, with speech bubbles and chat commands. Windows only.

| What | Where |
|---|---|
| App (tray icon + settings panel + desktop overlay) | `PuppetOverlay-x.y.z-setup.exe` (recommended, **auto-updates**) or `-portable.exe` |
| Avatar creator | Inside the app (Avatars → Create), or open `web/creator.html` in any browser |
| OBS / Streamlabs | Browser Source → `http://localhost:47800/overlay.html` |

## Features
- **Lively puppets**
  - entrances (walk in, drop from the sky, pop) and a puff of smoke when someone leaves
  - tape over the mouth when muted, earmuffs when deafened
  - puppets fall asleep (Zzz) after a configurable idle time
  - everyone turns to look at whoever is speaking
  - the longer someone talks, the more animated they get
- **Placement mode**: drag the Discord and Twitch groups with the mouse and use the scroll wheel to resize them. Positions are relative, so they carry over to OBS.
- **Global shortcuts** (configurable): `Ctrl+Shift+O` shows or hides the overlay, `Ctrl+Shift+P` turns placement mode on and off.
- **Launch with Windows**: off by default. When on, the app starts hidden in the tray.
- **Languages**: English and French (Settings → Language). *Auto* follows the Windows language. To add a language, add a dictionary in `web/shared/i18n.js`.
- **Auto-update** from GitHub Releases. The installed version updates itself; the portable version tells you when a new release is out.
- **Twitch viewers**
  - each viewer gets a stable random puppet, with chat bubbles
  - raids bring in a crowd; subs and bits trigger confetti
  - chat commands:
    - actions: `!jump`, `!dance`, `!wave`
    - customisation: `!hat`, `!hair`, `!outfit`, `!eyes`, `!color`, `!hatcolor`, `!reroll`, `!reset`
    - help: `!puppet` lists the commands
    - each command has a per-viewer cooldown and can be turned off individually
    - customisations are remembered across streams

---

## 1. One-time setup (whoever manages the project)

Voice data comes from Discord's local RPC. It only works for **testers** of a Discord application (up to 50).
Only people who **run** the app need to be testers. Friends who only appear in your channel don't need to do anything.

1. Go to https://discord.com/developers/applications and click **New Application**.
2. On the **OAuth2** tab, add the redirect `http://localhost` and turn on **Public Client**. That way no secret ships in the exe.
3. On the **App Testers** tab, invite everyone who will run the app. Each person must **accept the invite**.
4. Copy the **Application ID**, then do one of the following:
   - Recommended: in this GitHub repo, go to *Settings → Secrets and variables → Actions → Variables* and create `DISCORD_CLIENT_ID`. Every build will then include it.
   - Or: each user pastes it in the app under **Discord setup**.

## 2. Getting the app

Every push to `main` builds the app (under **Actions → Build Windows → Artifacts**).
To publish a release, push a tag like `v0.2.0`. The installers then appear under **Releases**.

> **The repository must be public** for friends to download releases and for auto-update to work.
> Windows SmartScreen may say "Unknown publisher" because the exe isn't code-signed. Click *More info → Run anyway*.

## 3. Using it
- The app lives in the system tray. Click the icon to open the panel; right-click it to show/hide the overlay, enter placement mode, reconnect Discord, install an update, or quit.
- The first time you connect, Discord shows an authorization popup. Click **Authorize**.
- Games in exclusive fullscreen hide the overlay. Switch them to **borderless windowed**.

### Avatars
- **Create**: panel → Avatars → *Create / edit my avatar*. You can build one from scratch or start from a photo: frame the face, then move the mouth line.
- **Share**: export a `.puppet` file (works for any avatar) or a `PUP1.…` code (drawn avatars only; easy to paste into Discord).
- **Receive**: drop `.puppet` files anywhere in the panel, or paste a code.
- If someone has no custom avatar, their Discord profile picture is cut into a puppet.
- **Shared sync (beta)**: put `{"avatars": [ …contents of .puppet files… ]}` in a GitHub Gist and paste its *Raw* URL in the panel.

### OBS / Streamlabs
Add a 1920×1080 **Browser Source** with one of these URLs:
- `http://localhost:47800/overlay.html` shows Discord and Twitch.
- `…/overlay.html?scene=discord` shows Discord only.
- `…/overlay.html?scene=twitch` shows Twitch only.

---

## Development
```bash
npm install
npm start          # run the app
npm run dist       # Windows build (run on Windows)
```
To preview without Discord, open `web/overlay.html?demo=1`.

| File | Role |
|---|---|
| `electron/main.js` | windows, tray, hotkeys, startup, placement, actions |
| `electron/discord-rpc.js` | Discord RPC client (named pipe, PKCE authorize, voice events) |
| `electron/twitch.js` | anonymous Twitch IRC, commands, raids/subs/bits |
| `electron/updater.js` | GitHub Releases updates |
| `electron/server.js` | local server (127.0.0.1): static `web/` + `/api/*`, pushed via SSE |
| `web/shared/puppet.js` | puppet renderer + animator, shared by every page |
| `web/overlay.*`, `web/panel.*`, `web/creator.*` | overlay, panel, creator |

Settings, avatars and viewer customisations are stored in `%APPDATA%/Puppet Overlay/config.json`. Logs are in `%APPDATA%/Puppet Overlay/logs/`.
