# Puppet Overlay — maintainer & technical reference

> User guide: [README.md](../README.md) · [Français](../README.fr.md)

Windows desktop overlay that shows the members of your current Discord voice channel as animated paper puppets. Twitch chat viewers can be shown as well. The same scene is exposed to OBS/Streamlabs as a browser source.

- Electron app with a tray icon, a settings panel and a transparent, click-through overlay window.
- Voice data comes from the local Discord client over RPC. There is no bot and no server.
- Twitch chat is read anonymously (read-only IRC). An optional Twitch account login (Device Code flow) adds counters, follows, raids, Stream Together invites and sending chat messages.
- Avatars are created in the built-in creator and shared as `.puppet` files, `PUP1.…` codes, or a shared sync file.

## Setup

### 1. Discord application (once, by the maintainer)
1. In the [Discord Developer Portal](https://discord.com/developers/applications), use the application `1570204741982756965`. That ID is already built into the app (`electron/app-config.json`).
2. **OAuth2**:
   - add the redirect `http://localhost`;
   - enable **Public Client** (authorization uses PKCE, so no client secret ships with the app).
3. **App Testers**: add every person who will **run** the app (max 50). Each tester must accept the invite.
   - Discord only exposes voice data over RPC to approved testers of the application.
   - People who only appear in someone else's channel need nothing.

### 1b. Twitch application (once, by the maintainer — only for the Twitch account features)
1. In the [Twitch Developer Console](https://dev.twitch.tv/console/apps) (two-factor authentication must be on), **Register Your Application**:
   - OAuth Redirect URL: `http://localhost` (required by the form, not used);
   - Category: *Application Integration*;
   - Client Type: **Public** (the app logs in with the Device Code flow: no client secret ships with it).
2. Copy the **Client ID** and either:
   - put it in `electron/app-config.json` as `"twitchApi": { "clientId": "…" }`, or
   - set the repository variable `TWITCH_CLIENT_ID` (merged into `app-config.json` at build time), or
   - give it to users, who paste it in the panel (Stream widgets / Streaming hub tabs).
3. Scopes requested at login: `moderator:read:followers`, `channel:read:subscriptions`, `channel:manage:raids`, `channel:manage:guest_star`, `user:write:chat`.
   - Public-client refresh tokens expire after 30 days without use: users then simply log in again.

### 2. Release
- Every push to `main` builds Windows binaries; they appear under *Actions → Build Windows → Artifacts*.
- Pushing a tag `vX.Y.Z` also publishes a GitHub Release with:
  - `PuppetOverlay-X.Y.Z-setup.exe`: per-user installer, auto-updates;
  - `PuppetOverlay-X.Y.Z-portable.exe`: no install; only notifies when a new version exists;
  - `latest.yml` and the `.blockmap` file, which the auto-updater uses.
- The repository must be public, so that releases can be downloaded and installed copies can update.
- Optional: set the repository variable `DISCORD_CLIENT_ID` to override the built-in ID at build time.

### 3. Per user
1. Install `setup.exe`. The exe is not code-signed, so SmartScreen asks for confirmation: *More info → Run anyway*.
2. Start the Discord desktop app. On first launch, click **Authorize** in the Discord popup.
3. In the panel, go to **Avatars → Create / edit my avatar**, then share the `.puppet` file or the code.

## Usage

| Item | Location |
|---|---|
| Panel | Tray icon (click) or taskbar button |
| Show / hide overlay | `Ctrl+Shift+O` |
| Placement mode (drag to move, mouse wheel to resize, `Esc` to finish) | `Ctrl+Shift+P` |
| Mute / unmute Twitch chat sound | `Ctrl+Shift+M` |
| OBS browser source (1920×1080, transparent) | `http://localhost:47800/overlay.html` |
| Discord-only / Twitch-only source | append `?scene=discord` / `?scene=twitch` |

- Shortcuts can be changed in **Settings**.
- If port 47800 is busy, the app uses the next free one; the panel's OBS tab shows the actual URL.
- Games running in exclusive fullscreen hide the overlay. Use borderless windowed mode instead.

### Avatars and sync
- Precedence: manual imports (`.puppet` file or code) override synced avatars. Members without an avatar are drawn with their Discord profile picture.
- **Shared sync** (Avatars tab): paste a GitHub Gist link or any raw file URL. The file is re-read every 2 minutes.
- Accepted file formats:
  - one `PUP1.…` code per line (other lines are ignored);
  - `{"avatars": [ … ]}` or a JSON array of avatar objects;
  - the content of a single `.puppet` file.
- Photo avatars are too large for codes. Include them in a JSON file instead.

### Twitch
- Enable it in the Twitch tab and enter the channel name.
- Each viewer gets a deterministic puppet generated from their login. Chat commands override it persistently.
- Commands (prefix `!`, configurable; each can be disabled; cooldown per viewer):

| Command | Effect |
|---|---|
| `jump` `dance` `wave` | Animation |
| `hat` `hair` `outfit` `eyes` `glasses` `item` `neck` `pattern` `<value>` | Change that part (values match the creator) |
| `color` `hatcolor` `<name or #hex>` | Change clothes / hat colour |
| `reroll` / `reset` | New random look / back to the original |
| `puppet` | List the commands |

- Raids, subs, bits and follows trigger effects (each can be toggled). Follows need the Twitch account (polled every 20 s).
- **Alert sounds** (`alerts` settings): up to 30 files per event (`follow`, `sub`, `prime`, `gift`, `bits`, `raid`), uploaded to `%APPDATA%\Puppet Overlay\sounds\` under random names (MP3/WAV/Ogg checked by content, 20 MB max).
  - Modes: `random` (no immediate repeat), `sequence`, `all` (layered). Each sound has a volume and a `min` threshold (bits, raiders, gifted subs); only the highest threshold reached plays.
  - Prime and gifted subs fall back to the sub sounds when they have none. A "gift N subs" plays once (the N single-gift notices that follow are ignored).
  - Picked in the main process, played by the desktop overlay (`output: app`) or by the `widget.html?w=alerts` OBS source (`output: obs`). One alert at a time, queue of 10.
- **Stream widgets**: `widget.html?w=followers|subs|latest-follower|latest-sub|spotify|alerts`, one OBS browser source each. Counters come from Helix (Get Channel Followers / Get Broadcaster Subscriptions, every 20 s; sub count needs Affiliate/Partner). Latest sub comes from chat.
  - Spotify: a long-lived hidden PowerShell process reads the Spotify window title (“Artist - Title”) every 1.5 s, only while the widget is enabled. Cover art from the public iTunes Search API (optional). Windows only.
- **Streaming hub** (`hub.members`): Helix Get Streams every 60 s, desktop notification when a member goes live, raid (Start/Cancel a raid), Stream Together invite (Guest Star API, beta: reuses or creates the session; the host must have Stream Together open on Twitch, otherwise Twitch ends the session), chat read by the panel over anonymous IRC (4 chats max) and sent with Send Chat Message.
- **Chat sound**: `None`, `Gibberish` (synthesised, with a distinct voice per viewer) or `Text-to-speech` (installed Windows voices).
  - Settings: volume, speed, pitch, voice, a different voice per viewer, reading the name first, maximum characters, queue length.
  - Played by the app (captured by OBS Desktop Audio) **or** by the OBS source (enable *Control audio via OBS*), never both.
  - Commands and links are not read.

### Layout
- **Settings → Overlay → Layout** and **Twitch → Layout**: `Horizontal` (a row) or `Vertical` (a column). In vertical layout, Twitch bubbles open sideways.
- Placement mode works with both.

### Members
The Members tab lists everyone you've shared a voice channel with. For each person you can set:
- hidden or shown;
- a nickname;
- a size (50–180 %);
- their position in the row.

These settings persist when the person is offline.

## Files
| Path | Content |
|---|---|
| `%APPDATA%\Puppet Overlay\config.json` | Settings, avatars, known members, Twitch viewer looks, Discord token, Twitch account token |
| `%APPDATA%\Puppet Overlay\sounds\` | Uploaded alert sounds |
| `%APPDATA%\Puppet Overlay\logs\main.log` | Log (rotated at 1 MB); Settings → *Open logs folder* |

## Troubleshooting
| Symptom | Fix |
|---|---|
| Status `Discord not found` | Run the Discord desktop app (the browser version has no RPC) |
| Status `error` mentioning tester / authorization | Check that the account is an accepted App Tester, then click *Reconnect / re-authorize* |
| Overlay not visible in game | Use borderless windowed mode |
| Update says the repository must be public | Make the repository public |
| Nothing in OBS | The app must be running; check the URL in the panel's OBS tab |

## Development
```bash
npm install
npm start                    # run from source
npm run dist                 # Windows build (on Windows)
```
- `web/overlay.html?demo=1` shows the scene offline. `&fx=portal` forces an entrance effect; `&layout=vertical` switches to a column.
- `tools/mock-discord.js` is a fake Discord IPC server for testing without Discord (see `CLAUDE.md`).
- Source layout:
  - `electron/`: main process (`main.js`), Discord RPC, Twitch IRC, updater, local server (127.0.0.1, SSE + JSON API).
  - `web/`: overlay, panel, creator, and shared files (`shared/puppet.js` renderer, `chatsound.js`, `i18n.js`).
- Translations live in `web/shared/i18n.js`. Keys are the English strings.
