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

## 8. Other things you can tweak

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
| Something else | **Settings → Open logs folder** and send the `main.log` file to the person who shared the app |

---

Technical details (Discord application setup, releases, sync file formats, development): [docs/MAINTAINER.md](docs/MAINTAINER.md).
