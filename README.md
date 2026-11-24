# LaboHub

> [Version française](README.fr.md)

LaboHub (formerly **Puppet Overlay**) shows the people in your **Discord voice channel** as little paper puppets on your screen. When someone talks, their puppet's head opens and closes like a marionette. Your **Twitch** chat viewers can be puppets too, and everything also works in **OBS / Streamlabs**.

For streamers, LaboHub also has optional tools: stream widgets and alerts, your stream and the crew's, a Stream Deck on your screen, a chat bot. **You choose what you use**: the rest stays hidden and doesn't run.

Windows only.

---

## 1. Install

1. Go to the [**Releases** page](https://github.com/LaboCorpo/labo-puppet-overlay/releases/latest).
2. Download **`LaboHub-…-setup.exe`**.
3. Run it. Windows will show a blue "Windows protected your PC" screen. This is normal because the app isn't signed. Click **More info → Run anyway**.

The app updates itself when a new version comes out, and shows what's new after each update. If you had **Puppet Overlay**, it updates to LaboHub on its own and keeps your avatars, Discord login and settings.

> Prefer not to install anything? Download `LaboHub-…-portable.exe` instead. It runs as-is, but it won't update itself.

## 2. Before your first launch (Discord puppets)

The app reads your voice channel from Discord, and Discord only allows this for approved people.
**Ask the person who shared the app with you to add you as a tester**, then accept the invite you receive from Discord.

You only need this if *you* run the app with Discord puppets. Friends who are just in the voice channel with you don't need anything.

## 3. First launch: choose what you use

1. Pick your language.
2. Tick what you want to use:
   - **Discord puppets**: your voice channel on your screen and in OBS;
   - **Twitch viewer puppets**: your chat viewers with speech bubbles (type your channel name);
   - **Stream widgets & alerts**, **My stream & the crew**, **BabaDeck**, **Baba Bot**: the streaming tools (see section 8).
3. The last page lists your next steps. With Discord puppets: keep the **Discord desktop app** open (the browser version doesn't work) and click **Authorize** in the window Discord shows.

Change your choice any time in **Settings → Features**. The first time you open a tab, a short tour shows you around; **?** at the top right (or **F1**) replays it.

The settings window opens from the **icon** next to the clock (system tray) or from the taskbar.

## 4. Make your avatar

Without an avatar, you appear as a puppet made from your Discord profile picture. To make your own:

1. In **Puppet Overlay → Avatars**, click **Create / edit my avatar**.
2. Build it **from scratch** or **from a photo**. The **🎲 Random** button gives you ideas.
3. Your **Discord user ID** is filled in for you when Discord is connected. Otherwise: Discord Settings → Advanced, turn on **Developer Mode**, then right-click your name → **Copy User ID**.
4. Click **✔ Save to my overlay**.
5. **Share it** so your friends see it too: **Avatars → Share my avatar** copies your code (photo avatars are saved as a `.puppet` file instead). Send it to the person who manages the shared avatar file; your puppet then shows up for everyone.

Friends' avatars are downloaded automatically from the shared file. You can also add one by hand: **Avatars** → paste their code and click **Import**, or drop their `.puppet` file into the window.

## 5. Keyboard shortcuts

| Shortcut | What it does |
|---|---|
| `Ctrl+Shift+O` | Show / hide the puppets |
| `Ctrl+Shift+P` | Move the puppets: drag them with the mouse, use the wheel to resize them, press `Esc` when done |
| `Ctrl+Shift+M` | Mute / unmute the Twitch chat sound |

You can change these in **Settings**.

## 6. Use it in OBS / Streamlabs

1. Keep LaboHub running.
2. In OBS, add a **Browser** source.
3. Paste the address shown in **Puppet Overlay → OBS / Streamlabs** (usually `http://localhost:47800/overlay.html`).
4. Set the size to **1920 × 1080**.

## 7. Twitch viewer puppets

1. In **Puppet Overlay → Twitch viewers**, turn it on and type your channel name (no Twitch login needed).
2. Your chat viewers appear as puppets, and their messages show up as bubbles.
3. Viewers can customise their puppet from the chat. They can type **`!puppet`** to see the commands, for example `!jump`, `!dance` or `!hat crown`.

Raids, subs and bits trigger effects. Chat messages can also be read aloud or turned into funny gibberish.

## 8. The streaming tools (optional)

Each one is a tab, shown only if you ticked it. Rename a tab with a double-click. Each tab has a **Guide** page: tick the steps as you go.

- **Widget Twitch**: one OBS **Browser** source per widget: followers, subs, latest follower / sub, the song playing (Spotify), live chat, **game counters** and the alerts.
  - Each widget has its page: themes, colours, text, icon, animations, **your pictures** and **your own CSS**. *Save this look* keeps it in **My templates**.
  - **Game counters**: deaths, wins, losses… Give each one a shortcut (e.g. `Alt+1`): it works in game. Viewers see it with `!command`; mods change it with `!command+` / `!command-`.
  - **Friends' cams**: add a friend, send them **Their link**. They open it, choose their camera and click *Start*: their camera becomes an OBS source. Free VDO.Ninja service, nothing to install for them.
  - **Alert sounds**: put your sounds and GIFs in the **Son Twitch** folder (📂 button), then choose them for each event (follow, sub, Prime, gifts, bits, raid).
  - **Scenes**: several widgets in one OBS source.
- **Hub Labo**
  - **My stream**: your live with its category picture, title & category (with presets), giveaway and chat poll (each with its OBS overlay), stream health from OBS, ad warning, "I'm live" on Discord, summary, checklist.
  - **Friends' streams**: who is live in the crew, raid, Stream Together, chat. **Multi-stream**: videos and merged chats. **Clips**: mark the moments to clip, even in game.
- **BabaDeck**: your Stream Deck without the hardware. Connect OBS (*Tools → WebSocket Server Settings* in OBS, then **OBS connection**). Click an empty slot to make a button, **right-click** a button to edit it, drag it to move it. Each button can run several actions and have a shortcut.
  - **Shortcuts** lists every shortcut and the **recommended keys** for QWERTY and AZERTY keyboards.
  - The **shortcut strip** shows your shortcuts and their state on top of your game, without catching clicks.
- **Baba Bot**: a chat bot that answers with your Twitch account while LaboHub is open: your commands, timers, welcome for newcomers, thanks for raids, sound commands (`!airhorn`).

Counters, follows, the bot, My stream and the Hub need you to **log in with Twitch** (Widget Twitch → Stream widgets). Twitch shows a code to confirm on its website; you never type your password in the app.

## 9. Other things you can tweak

- **Overlay**: layout (row or column), size, entrance and exit effects, names, fading the puppets when your mouse comes near.
- **Members**: hide someone, give them a nickname, make them bigger or smaller, change the order.
- **Settings**: language (English / French), features, performance, what closing the window does (stay in the taskbar, hide in the tray, or quit), launch with Windows, updates.

## Problems?

| Problem | What to do |
|---|---|
| "Discord not found" | Open the Discord **desktop** app (not the browser version) |
| Error about "tester" or "authorization" | Check that you accepted the tester invite, then click **Reconnect / re-authorize Discord** in the Status page |
| I can't see the puppets in my game | Set the game to **borderless window** mode. Exclusive fullscreen hides the overlay |
| Nothing shows in OBS | LaboHub must be running. Check the address in **OBS / Streamlabs** |
| "Shared file not found (404)" in Avatars | The shared avatar file isn't set up yet. Tell the person who shared the app |
| "Log in with Twitch" asks for a Client ID | Ask the person who shared the app for the Twitch Client ID and paste it |
| No alert sound or GIF in OBS | In **Alert sounds**, "Played by" must match: *This app* (OBS hears it through Desktop Audio) or *OBS*. The GIFs need the *Alerts (GIF + sound)* widget source |
| A friend's camera stays black | They must keep the page of their link open, with *Start* clicked |
| The Spotify widget stays empty | Open the Spotify **desktop** app (not the web player) |
| Something else | **Settings → Copy diagnostics** and paste the text to the person who shared the app (it contains no password or token) |

---

Technical details (Discord and Twitch application setup, releases, sync file formats, development): [docs/MAINTAINER.md](docs/MAINTAINER.md).
