# Puppet Overlay

> [Version française](README.fr.md)

Puppet Overlay shows the people in your **Discord voice channel** as little paper puppets on your screen. When someone talks, their puppet's head opens and closes like a marionette.

You can also put the puppets in your **OBS / Streamlabs** stream and show your **Twitch** chat viewers as puppets with speech bubbles.

Windows only.

---

## 1. Install

1. Go to the [**Releases** page](https://github.com/LaboCorpo/labo-puppet-overlay/releases/latest).
2. Download **`PuppetOverlay-…-setup.exe`**.
3. Run it. Windows will show a blue "Windows protected your PC" screen. This is normal because the app isn't signed. Click **More info → Run anyway**.

The app updates itself when a new version comes out.

> Prefer not to install anything? Download `PuppetOverlay-…-portable.exe` instead. It runs as-is, but it won't update itself.

## 2. Before your first launch

The app reads your voice channel from Discord, and Discord only allows this for approved people.
**Ask the person who shared the app with you to add you as a tester**, then accept the invite you receive from Discord.

You only need this if *you* run the app. Friends who are just in the voice channel with you don't need anything.

## 3. First launch

1. Make sure the **Discord desktop app** is open. The browser version of Discord doesn't work.
2. Start Puppet Overlay.
3. Discord shows a window asking for permission. Click **Authorize**.
4. Join a voice channel. The puppets appear in the bottom-left corner of your screen.

The settings window opens from the **puppet icon** next to the clock (system tray) or from the taskbar.

## 4. Make your avatar

Without an avatar, you appear as a puppet made from your Discord profile picture. To make your own:

1. In the settings window, open **Avatars → Create / edit my avatar**.
2. Build it **from scratch** or **from a photo**. The **🎲 Random** button gives you ideas.
3. Fill in your **Discord user ID**. To find it, go to Discord Settings → Advanced, turn on **Developer Mode**, then right-click your name → **Copy User ID**.
4. Click **✔ Save to my overlay**.
5. **Share it with your friends** so they see it too: click **Copy code** and send the code, or download the **.puppet file**.

To add a friend's avatar: **Avatars** tab → paste their code and click **Import**, or drop their `.puppet` file into the window.

## 5. Keyboard shortcuts

| Shortcut | What it does |
Windows desktop overlay that shows the members of your current Discord voice channel as animated paper puppets. Twitch chat viewers can be shown as well. The same scene is exposed to OBS/Streamlabs as a browser source.

- Electron app with a tray icon, a settings panel and a transparent, click-through overlay window.
- Voice data comes from the local Discord client over RPC. There is no bot and no server.
- Twitch chat is read anonymously (read-only IRC).
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
3. Follow the first-run guide: it checks the Discord connection, opens the creator with your Discord ID, and lists the shortcuts.
4. **Share my avatar** copies your code (or saves the `.puppet` file for photo avatars). Send it to the maintainer of the shared avatar file.

A ready-to-paste French welcome message for friends is in [`docs/welcome-fr.md`](docs/welcome-fr.md).

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
- **Hover fade** (Overlay tab): on the desktop, puppets turn semi-transparent when the mouse comes near. Opacity (%) and distance (px) are adjustable; OBS is not affected.
- **Closing the window** (Settings): minimize to the taskbar (default), hide to the system tray, or quit the app.

### Avatars and sync
- Precedence: manual imports (`.puppet` file or code) override synced avatars. Members without an avatar are drawn with their Discord profile picture.
- **Shared sync** (Avatars tab): paste a GitHub Gist link or any raw file URL. The file is re-read every 2 minutes.
  - Default: `avatars.txt` in the public repository `LaboCorpo/labo-puppet-avatars` (set in `electron/app-config.json`). The maintainer adds each friend's `PUP1.` code there, one per line.
  - Clearing the field turns sync off; it stays off.
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

- Raids, subs and bits trigger effects (each can be toggled).
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
| `Ctrl+Shift+O` | Show / hide the puppets |
| `Ctrl+Shift+P` | Move the puppets: drag them with the mouse, use the wheel to resize them, press `Esc` when done |
| `Ctrl+Shift+M` | Mute / unmute the Twitch chat sound |

You can change these in **Settings**.

## 6. Use it in OBS / Streamlabs

1. Keep Puppet Overlay running.
2. In OBS, add a **Browser** source.
3. Paste the address shown in the app's **OBS / Streamlabs** tab (usually `http://localhost:47800/overlay.html`).
4. Set the size to **1920 × 1080**.

## 7. Twitch (optional)

1. Open the **Twitch** tab, turn it on and type your channel name.
2. Your chat viewers appear as puppets, and their messages show up as bubbles.
3. Viewers can customise their puppet from the chat. They can type **`!puppet`** to see the commands, for example `!jump`, `!dance` or `!hat crown`.

Raids, subs and bits trigger effects. Chat messages can also be read aloud or turned into funny gibberish (in the Twitch tab).

## 8. LaboHub: the tabs

LaboHub has five tabs. At install (or in **Settings → Tabs**) you keep only the ones you use, and you can rename them (double-click a tab). The first time you open a tab, a short tour shows you around; **?** at the top right (or **F1**) replays it. Each tab also has a **Guide** page: tick the steps as you go.

- **Puppet Overlay**: the Discord puppets (sections 3 to 7) and the Discord bot (`/puppet create` in Discord).
- **Widget Twitch**: one OBS **Browser** source per widget: followers, subs, latest follower / sub, the song playing (Spotify), live chat, **game counters** and the alerts.
  - Each widget has its page: themes, colours, text, icon, animations, **your pictures** (background, icon) and **your own CSS**. *Save this look* keeps it in **My templates** for the other widgets.
  - **Game counters**: deaths, wins, losses… Give each one a shortcut (e.g. `Alt+1` = one more loss): it works in game. Viewers see it with `!command`; mods change it with `!command+` / `!command-`. One OBS link per counter, or two side by side.
  - **Friends' cams**: add a friend, click **Their link** and send it to them. They open it, choose their camera and click *Start*: their camera becomes an OBS source (alone, or all together in one scene you lay out with the mouse). Free VDO.Ninja service, nothing to install for them.
  - **Alert sounds**: put your sounds and GIFs in the **Son Twitch** folder (📂 button), then choose them for each event (follow, sub, Prime, gifts, bits, raid), with a GIF if you like. Add the *Alerts (GIF + sound)* widget to OBS to see the GIFs.
  - **Scenes**: several widgets in one OBS source.
- **Hub Labo**
  - **My stream**: your live with its category picture, title & category (with presets), giveaway and chat poll (each with its OBS overlay), stream health from OBS (with a warning when it struggles), ad warning, “I'm live” on Discord, summary, checklist.
  - **Friends' streams**: who is live in the crew (shown at the top of every Hub page, with their game), raid, Stream Together, chat. **Multi-stream**: videos and merged chats. **Clips**: mark the moments to clip, even in game.
- **BabaDeck**: your Stream Deck without the hardware. Connect OBS (*Tools → WebSocket Server Settings* in OBS, then **OBS connection**). Click an empty slot to make a button, **right-click** a button to edit it, drag it to move it. Each button can run several actions and have a shortcut (combinations work).
  - **Shortcuts** lists every shortcut and the **recommended keys** for QWERTY and AZERTY keyboards (on AZERTY avoid `Ctrl+Alt+digit`: it is AltGr).
  - The **shortcut strip** shows your shortcuts and their state (muted mic, live, counters) on top of your game, without catching clicks. Move and resize it in Shortcuts.
- **Baba Bot**: a chat bot that answers with your Twitch account while LaboHub is open: your commands, timers, welcome for newcomers, thanks for raids, sound commands (`!airhorn`) with files from the Son Twitch folder.

Counters, follows, the bot, My stream and the Hub need you to **log in with Twitch** (Widget Twitch → Stream widgets). Twitch shows a code to confirm on its website; you never type your password in the app. **Updates**: *Settings → Check for updates* downloads only the new version (a few MB).

## 9. Other things you can tweak

- **Overlay** tab: layout (row or column), size, entrance and exit effects, names, and more.
- **Members** tab: hide someone, give them a nickname, make them bigger or smaller, change the order.
- **Settings** tab: language (English / French), performance, launch with Windows, updates.

## Problems?

| Problem | What to do |
|---|---|
| "Discord not found" | Open the Discord **desktop** app (not the browser version) |
| Error about "tester" or "authorization" | Check that you accepted the tester invite, then click **Reconnect / re-authorize Discord** in the Status tab |
| I can't see the puppets in my game | Set the game to **borderless window** mode. Exclusive fullscreen hides the overlay |
| Nothing shows in OBS | Puppet Overlay must be running. Check the address in the **OBS / Streamlabs** tab |
| “Log in with Twitch” asks for a Client ID | Ask the person who shared the app for the Twitch Client ID and paste it |
| No alert sound or GIF in OBS | In **Alert sounds**, “Played by” must match: *This app* (OBS hears it through Desktop Audio) or *OBS*. The GIFs always need the *Alerts (GIF + sound)* widget source |
| A friend's camera stays black | They must keep the page of their link open, with *Start* clicked. A new password (Security) cancels the old links |
| The Spotify widget stays empty | Open the Spotify **desktop** app (not the web player) and keep its window open or minimized |
| Something else | **Settings → Open logs folder** and send the `main.log` file to the person who shared the app |

---

Technical details (Discord application setup, releases, sync file formats, development): [docs/MAINTAINER.md](docs/MAINTAINER.md).
