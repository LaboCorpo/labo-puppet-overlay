/*
 * "Now playing" for the Spotify widget, without a Spotify account or API key: the Spotify desktop app
 * shows "Artist - Title" as its window title while playing. One long-lived PowerShell process watches it
 * (no polling process per tick). The cover is looked up on the public iTunes Search API (optional).
 * Windows only; the Spotify window must exist (minimized is fine, closed to the tray is not).
 */
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const readline = require('readline');

const PS_SCRIPT = (parentPid) => [
  '[Console]::OutputEncoding=[Text.Encoding]::UTF8',
  '$l=$null',
  'while($true){',
  // Exit with the app, even if it was killed without a chance to stop us.
  ` if(-not (Get-Process -Id ${Number(parentPid) || 0} -ErrorAction SilentlyContinue)){exit}`,
  " $t=''",
  ' $p=Get-Process -Name Spotify -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1',
  ' if($p){$t=$p.MainWindowTitle}',
  " if($t -ne $l){[Console]::Out.WriteLine('T:'+$t);[Console]::Out.Flush();$l=$t}",
  ' Start-Sleep -Milliseconds 1500',
  '}',
].join('\n');

// "Artist - Title" while playing; "Spotify", "Spotify Premium", "Spotify Free" when paused or idle.
function parseTitle(raw) {
  const t = String(raw || '').trim();
  if (!t || /^spotify( premium| free)?$/i.test(t)) return { playing: false, artist: '', title: '' };
  const i = t.indexOf(' - ');
  if (i < 0) return { playing: true, artist: '', title: t.slice(0, 200) }; // podcasts, ads
  return { playing: true, artist: t.slice(0, i).slice(0, 200), title: t.slice(i + 3).slice(0, 200) };
}

class NowPlaying extends EventEmitter {
  /** opts: { log, fetch, spawn, platform, getSettings() -> widgets.spotify } */
  constructor(opts) {
    super();
    this.o = opts;
    this.spawn = opts.spawn || spawn;
    this.fetch = opts.fetch || ((...a) => globalThis.fetch(...a));
    this.platform = opts.platform || process.platform;
    this.proc = null;
    this.enabled = false;
    this.retry = null;
    this.retryMs = 2000;
    this.covers = new Map();
    this.state = { status: 'off', playing: false, artist: '', title: '', cover: null };
  }

  snapshot() { return this.state; }

  update(patch) {
    const next = Object.assign({}, this.state, patch);
    if (JSON.stringify(next) === JSON.stringify(this.state)) return;
    this.state = next;
    this.emit('change');
  }

  setEnabled(on) {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) this.start(); else this.stop();
  }

  start() {
    if (this.platform !== 'win32') return this.update({ status: 'unsupported' });
    if (this.proc) return;
    let proc;
    try {
      proc = this.spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_SCRIPT(process.pid)], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) {
      if (this.o.log) this.o.log.warn('[nowplaying] ' + e.message);
      return this.update({ status: 'error' });
    }
    this.proc = proc;
    this.update({ status: 'waiting' });
    readline.createInterface({ input: proc.stdout }).on('line', (line) => {
      if (line.startsWith('T:')) { this.retryMs = 2000; this.onTitle(line.slice(2)); }
    });
    proc.on('error', (e) => { if (this.o.log) this.o.log.warn('[nowplaying] ' + e.message); });
    proc.on('exit', () => {
      if (this.proc !== proc) return;
      this.proc = null;
      if (!this.enabled) return;
      // Restart with backoff: PowerShell blocked by policy would otherwise loop fast.
      this.update({ status: 'error' });
      clearTimeout(this.retry);
      this.retry = setTimeout(() => this.enabled && this.start(), this.retryMs);
      this.retryMs = Math.min(60000, this.retryMs * 2);
    });
  }

  stop() {
    clearTimeout(this.retry);
    const p = this.proc;
    this.proc = null;
    if (p) { try { p.kill(); } catch (e) { /* already gone */ } }
    this.update({ status: 'off', playing: false, artist: '', title: '', cover: null });
  }

  onTitle(raw) {
    const t = parseTitle(raw);
    const same = t.artist === this.state.artist && t.title === this.state.title;
    this.update(Object.assign({ status: raw ? 'running' : 'waiting' }, t, same ? {} : { cover: null }));
    if (t.playing && t.artist && !same) this.lookupCover(t.artist, t.title);
  }

  async lookupCover(artist, title) {
    const s = this.o.getSettings ? this.o.getSettings() : {};
    if (s && s.showCover === false) return;
    const key = (artist + '\n' + title).toLowerCase();
    let url = this.covers.get(key);
    if (url === undefined) {
      try {
        const q = new URLSearchParams({ term: artist + ' ' + title, entity: 'song', limit: '1' });
        const res = await this.fetch('https://itunes.apple.com/search?' + q);
        const j = res.ok ? await res.json() : {};
        const art = j.results && j.results[0] && j.results[0].artworkUrl100;
        url = typeof art === 'string' && /^https:\/\//.test(art) ? art.replace('100x100', '300x300') : null;
      } catch (e) { url = null; }
      if (this.covers.size > 300) this.covers.clear();
      this.covers.set(key, url);
    }
    // Still the same song? (it may have changed while we were looking)
    if (this.state.artist === artist && this.state.title === title) this.update({ cover: url });
  }
}

module.exports = { NowPlaying, parseTitle, PS_SCRIPT };
