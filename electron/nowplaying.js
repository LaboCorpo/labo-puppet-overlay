/*
 * "Now playing" for the Spotify widget, without a Spotify account or API key.
 * One long-lived hidden PowerShell process reads the Windows media session (the one shown in the volume flyout):
 * title, artist, album, play/pause, position and the real album cover published by Spotify.
 * Fallback when the Windows media API is unavailable: the Spotify window title ("Artist - Title"), with the cover
 * looked up on the public iTunes Search API. Windows only.
 *
 * Lines from the script:  J:{json}  media session state | C:<base64>  cover of the current track
 *                         T:<title> window title (fallback) | E:<message>  media API unavailable
 */
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const readline = require('readline');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_COVERS = 40;

function psScript(parentPid, anyPlayer) {
  return `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$parent = ${Number(parentPid) || 0}
$anyPlayer = $${anyPlayer ? 'true' : 'false'}
function Out($s) { [Console]::Out.WriteLine($s); [Console]::Out.Flush() }
$smtc = $false
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
  function Await($op, [Type]$type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $null = $t.Wait(-1); $t.Result }
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  $smtc = $true
} catch { Out ('E:' + $_.Exception.Message) }
$last = ''; $lastTrack = ''; $thumb = ''; $sent = $true; $tries = 0; $lastT = $null
while ($true) {
  if (-not (Get-Process -Id $parent -ErrorAction SilentlyContinue)) { exit }
  if ($smtc) {
    try {
      $s = $null
      foreach ($x in $mgr.GetSessions()) { if ($x.SourceAppUserModelId -match 'spotify') { $s = $x; break } }
      if (-not $s -and $anyPlayer) { $s = $mgr.GetCurrentSession() }
      if ($s) {
        $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $pb = $s.GetPlaybackInfo(); $tl = $s.GetTimelineProperties()
        $track = "$($p.Artist)|$($p.Title)|$($p.AlbumTitle)"
        if ($track -ne $lastTrack) { $lastTrack = $track; $thumb = ''; $sent = $true; $tries = 0 }
        if (-not $thumb -and $p.Thumbnail -and $tries -lt 4) {
          $tries++
          try {
            $ras = Await ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
            $st = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($ras)
            $ms = New-Object System.IO.MemoryStream; $st.CopyTo($ms); $st.Dispose()
            if ($ms.Length -gt 0) { $thumb = [Convert]::ToBase64String($ms.ToArray()); $sent = $false }
          } catch { }
        }
        $o = [ordered]@{ app = [string]$s.SourceAppUserModelId; title = [string]$p.Title; artist = [string]$p.Artist; album = [string]$p.AlbumTitle;
          status = [int]$pb.PlaybackStatus; pos = [math]::Round($tl.Position.TotalSeconds, 1); dur = [math]::Round($tl.EndTime.TotalSeconds, 1);
          upd = $tl.LastUpdatedTime.ToUnixTimeMilliseconds() }
      } else { $o = [ordered]@{ status = 0 } }
      $j = $o | ConvertTo-Json -Compress
      if ($j -ne $last) { Out ('J:' + $j); $last = $j }
      if (-not $sent) { Out ('C:' + $thumb); $sent = $true }
    } catch { }
  } else {
    $t = ''
    $w = Get-Process -Name Spotify -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
    if ($w) { $t = $w.MainWindowTitle }
    if ($t -ne $lastT) { Out ('T:' + $t); $lastT = $t }
  }
  Start-Sleep -Milliseconds 1000
}
`;
}
// Proven minimal script (window title only), used if the media script keeps failing to start on this PC.
const legacyScript = (parentPid) => [
  '[Console]::OutputEncoding=[Text.Encoding]::UTF8',
  '$l=$null',
  'while($true){',
  ` if(-not (Get-Process -Id ${Number(parentPid) || 0} -ErrorAction SilentlyContinue)){exit}`,
  " $t=''",
  ' $p=Get-Process -Name Spotify -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1',
  ' if($p){$t=$p.MainWindowTitle}',
  " if($t -ne $l){[Console]::Out.WriteLine('T:'+$t);[Console]::Out.Flush();$l=$t}",
  ' Start-Sleep -Milliseconds 1500',
  '}',
].join('\n');
// -EncodedCommand (UTF-16LE base64): no quoting problems with a multi-line script.
const encodeCommand = (script) => Buffer.from(script, 'utf16le').toString('base64');

// Window-title fallback: "Artist - Title" while playing; "Spotify", "Spotify Premium", "Spotify Free" when paused or idle.
function parseTitle(raw) {
  const t = String(raw || '').trim();
  if (!t || /^spotify( premium| free)?$/i.test(t)) return { playing: false, artist: '', title: '' };
  const i = t.indexOf(' - ');
  if (i < 0) return { playing: true, artist: '', title: t.slice(0, 200) }; // podcasts, ads
  return { playing: true, artist: t.slice(0, i).slice(0, 200), title: t.slice(i + 3).slice(0, 200) };
}

// Media session JSON -> widget state. status 4 = playing (GlobalSystemMediaTransportControlsSessionPlaybackStatus).
function parseSession(j, now) {
  if (!j || !j.status || (!j.title && !j.artist)) return { playing: false, artist: '', title: '', album: '', app: '', pos: 0, dur: 0, posAt: now };
  const app = /spotify/i.test(j.app || '') ? 'Spotify' : String(j.app || '').replace(/^.*[\\!]/, '').replace(/\.exe$/i, '').slice(0, 40);
  const dur = Number(j.dur) > 0 && Number(j.dur) < 36000 ? Number(j.dur) : 0;
  return {
    playing: Number(j.status) === 4, title: String(j.title || '').slice(0, 200), artist: String(j.artist || '').slice(0, 200), album: String(j.album || '').slice(0, 200),
    app, pos: Math.max(0, Number(j.pos) || 0), dur, posAt: Number(j.upd) > 0 ? Number(j.upd) : now,
  };
}

function imageType(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.length > 8 && buf.slice(1, 4).toString('latin1') === 'PNG') return 'png';
  return null;
}

class NowPlaying extends EventEmitter {
  /** opts: { log, fetch, spawn, platform, coversDir, getSettings() -> { showCover, anyPlayer } } */
  constructor(opts) {
    super();
    this.o = opts;
    this.spawn = opts.spawn || spawn;
    this.fetch = opts.fetch || ((...a) => globalThis.fetch(...a));
    this.platform = opts.platform || process.platform;
    this.proc = null;
    this.enabled = false;
    this.anyPlayer = false;
    this.retry = null;
    this.retryMs = 2000;
    this.legacy = false; // true after the media script failed to start twice
    this.fastFails = 0;
    this.lookups = new Map();
    this.lookupTimer = null;
    this.state = { status: 'off', source: null, playing: false, artist: '', title: '', album: '', app: '', pos: 0, dur: 0, posAt: 0, cover: null };
  }

  snapshot() { return this.state; }

  update(patch) {
    const next = Object.assign({}, this.state, patch);
    if (JSON.stringify(next) === JSON.stringify(this.state)) return;
    this.state = next;
    this.emit('change');
  }

  setEnabled(on, anyPlayer) {
    const any = !!anyPlayer;
    if (on === this.enabled && any === this.anyPlayer) return;
    const restart = this.enabled && on && any !== this.anyPlayer;
    this.enabled = on;
    this.anyPlayer = any;
    if (restart) this.stop(true);
    if (on) this.start(); else this.stop();
  }

  start() {
    if (this.platform !== 'win32') return this.update({ status: 'unsupported' });
    if (this.proc) return;
    let proc;
    try {
      const script = this.legacy ? legacyScript(process.pid) : psScript(process.pid, this.anyPlayer);
      proc = this.spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodeCommand(script)], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) {
      if (this.o.log) this.o.log.warn('[nowplaying] ' + e.message);
      return this.update({ status: 'error' });
    }
    this.proc = proc;
    const startedAt = Date.now();
    let gotLine = false;
    this.update({ status: 'waiting' });
    readline.createInterface({ input: proc.stdout }).on('line', (line) => { gotLine = true; this.fastFails = 0; this.onLine(line); });
    proc.on('error', (e) => { if (this.o.log) this.o.log.warn('[nowplaying] ' + e.message); });
    proc.on('exit', () => {
      if (this.proc !== proc) return;
      this.proc = null;
      if (!this.enabled) return;
      if (!gotLine && Date.now() - startedAt < 10000 && !this.legacy && ++this.fastFails >= 2) {
        this.legacy = true;
        if (this.o.log) this.o.log.warn('[nowplaying] media script failed to start twice: using the Spotify window title');
      }
      // Restart with backoff: PowerShell blocked by policy would otherwise loop fast.
      this.update({ status: 'error' });
      clearTimeout(this.retry);
      this.retry = setTimeout(() => this.enabled && this.start(), this.retryMs);
      this.retryMs = Math.min(60000, this.retryMs * 2);
    });
  }

  stop(keepState) {
    clearTimeout(this.retry);
    clearTimeout(this.lookupTimer);
    const p = this.proc;
    this.proc = null;
    if (p) { try { p.kill(); } catch (e) { /* already gone */ } }
    if (!keepState) this.update({ status: 'off', source: null, playing: false, artist: '', title: '', album: '', app: '', pos: 0, dur: 0, cover: null });
  }

  onLine(line) {
    this.retryMs = 2000;
    const kind = line.slice(0, 2), data = line.slice(2);
    if (kind === 'J:') { let j = null; try { j = JSON.parse(data); } catch (e) { return; } this.onSession(j); }
    else if (kind === 'C:') this.onCover(data);
    else if (kind === 'T:') this.onTitle(data);
    else if (kind === 'E:' && this.o.log) this.o.log.warn('[nowplaying] Windows media unavailable, using the Spotify window title: ' + data.slice(0, 200));
  }

  onSession(j) {
    const now = Date.now();
    const s = parseSession(j, now);
    const same = s.artist === this.state.artist && s.title === this.state.title && s.album === this.state.album;
    // Small timeline corrections are not worth a state push to every page: keep the previous anchor
    // while the position the pages extrapolate stays within 1.5 s of the real one.
    if (same && s.playing === this.state.playing && s.dur === this.state.dur) {
      const expected = this.state.pos + (s.playing ? (now - this.state.posAt) / 1000 : 0);
      const actual = s.pos + (s.playing ? (now - s.posAt) / 1000 : 0);
      if (Math.abs(expected - actual) < 1.5) { s.pos = this.state.pos; s.posAt = this.state.posAt; }
    }
    this.update(Object.assign({ status: s.title || s.artist ? 'running' : 'waiting', source: 'media' }, s, same ? {} : { cover: null }));
    // The session usually sends the cover right after; if it doesn't, look it up online.
    if (!same && s.title) { clearTimeout(this.lookupTimer); this.lookupTimer = setTimeout(() => { if (!this.state.cover) this.lookupCover(s.artist, s.title); }, 3000); }
  }

  onCover(b64) {
    const st = this.o.getSettings ? this.o.getSettings() : {};
    if (st && st.showCover === false) return;
    let buf;
    try { buf = Buffer.from(b64, 'base64'); } catch (e) { return; }
    const type = imageType(buf);
    const dir = this.o.coversDir;
    if (!type || !dir || buf.length > 5 * 1024 * 1024) return;
    const name = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12) + '.' + type;
    try {
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, name);
      if (!fs.existsSync(file)) { fs.writeFileSync(file, buf); this.pruneCovers(dir); }
    } catch (e) { return; }
    clearTimeout(this.lookupTimer);
    this.update({ cover: '/covers/' + name });
  }

  // Keep the cover folder small: only the most recent covers.
  pruneCovers(dir) {
    try {
      const files = fs.readdirSync(dir).filter((f) => /^[a-f0-9]{12}\.(jpg|png)$/.test(f)).map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
      for (const x of files.slice(MAX_COVERS)) fs.unlinkSync(path.join(dir, x.f));
    } catch (e) { /* not important */ }
  }

  onTitle(raw) {
    const t = parseTitle(raw);
    const same = t.artist === this.state.artist && t.title === this.state.title;
    this.update(Object.assign({ status: raw ? 'running' : 'waiting', source: 'window', album: '', app: t.title ? 'Spotify' : '', pos: 0, dur: 0, posAt: 0 }, t, same ? {} : { cover: null }));
    if (t.playing && t.artist && !same) this.lookupCover(t.artist, t.title);
  }

  async lookupCover(artist, title) {
    const s = this.o.getSettings ? this.o.getSettings() : {};
    if (!artist || (s && s.showCover === false)) return;
    const key = (artist + '\n' + title).toLowerCase();
    let url = this.lookups.get(key);
    if (url === undefined) {
      // Online catalogues, no key needed: iTunes first, then Deezer.
      url = null;
      try {
        const q = new URLSearchParams({ term: artist + ' ' + title, entity: 'song', limit: '1' });
        const res = await this.fetch('https://itunes.apple.com/search?' + q);
        const j = res.ok ? await res.json() : {};
        const art = j.results && j.results[0] && j.results[0].artworkUrl100;
        if (typeof art === 'string' && /^https:\/\//.test(art)) url = art.replace('100x100', '600x600');
      } catch (e) { /* try the next one */ }
      if (!url) {
        try {
          const q = new URLSearchParams({ q: `artist:"${artist}" track:"${title}"`, limit: '1' });
          const res = await this.fetch('https://api.deezer.com/search?' + q);
          const j = res.ok ? await res.json() : {};
          const art = j.data && j.data[0] && j.data[0].album && (j.data[0].album.cover_big || j.data[0].album.cover_medium);
          if (typeof art === 'string' && /^https:\/\//.test(art)) url = art;
        } catch (e) { /* no cover */ }
      }
      if (this.lookups.size > 300) this.lookups.clear();
      this.lookups.set(key, url);
    }
    // Still the same song, and no real cover arrived meanwhile?
    if (this.state.artist === artist && this.state.title === title && !this.state.cover) this.update({ cover: url });
  }
}

module.exports = { NowPlaying, parseTitle, parseSession, psScript, legacyScript, encodeCommand };
