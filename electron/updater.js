/*
 * LaboHub updates, without downloading the whole app again.
 * LaboHub runs on Puppet Overlay's Electron runtime; only resources\app.asar changes between versions.
 * Releases are GitHub releases whose tag starts with `updates.tagPrefix` (default "labohub-v") and that carry
 * an `app.asar` asset. The asset is downloaded next to the app as app-update.bin (sha256 checked when GitHub
 * gives a digest), then a small script swaps it in after LaboHub exits and starts the app again.
 */
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
// Loaded lazily so the release-picking helpers can be tested without Electron.
const electron = () => require('electron');

const MAX_ASAR = 200 * 1024 * 1024;

function cmpVersion(a, b) {
  const pa = String(a).replace(/^[^\d]*/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).replace(/^[^\d]*/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

// Newest release newer than `current` with an app.asar asset.
function pickRelease(releases, prefix, current) {
  let best = null;
  for (const r of Array.isArray(releases) ? releases : []) {
    if (!r || r.draft || typeof r.tag_name !== 'string' || !r.tag_name.startsWith(prefix)) continue;
    const version = r.tag_name.slice(prefix.length);
    if (!/^\d+\.\d+\.\d+/.test(version) || cmpVersion(version, current) <= 0) continue;
    const asset = (r.assets || []).find((x) => x && x.name === 'app.asar' && /^https:\/\/(github\.com|objects\.githubusercontent\.com|release-assets\.githubusercontent\.com)\//.test(x.browser_download_url || ''));
    if (!asset) continue;
    if (!best || cmpVersion(version, best.version) > 0) {
      const digest = typeof asset.digest === 'string' && /^sha256:[a-f0-9]{64}$/.test(asset.digest) ? asset.digest.slice(7) : null;
      best = { version, url: asset.browser_download_url, size: asset.size || 0, sha256: digest, notes: String(r.body || '').slice(0, 2000), page: r.html_url || '' };
    }
  }
  return best;
}

class Updater extends EventEmitter {
  constructor(log, opts) {
    super();
    this.log = log;
    this.o = Object.assign({ fetch: (...a) => fetch(...a), getSource: () => ({ repo: '', tagPrefix: 'labohub-v' }), resourcesDir: process.resourcesPath, exePath: process.execPath, platform: process.platform }, opts || {});
    const { app } = electron();
    this.state = { status: 'idle', version: app.getVersion(), latest: null, progress: 0, portable: false, error: '', notes: '' };
    this.release = null;
    if (!app.isPackaged && !this.o.allowDev) this.state.status = 'dev';
  }

  set(patch) { Object.assign(this.state, patch); this.emit('change', this.state); }
  file() { return path.join(this.o.resourcesDir, 'app-update.bin'); }

  async check() {
    if (this.state.status === 'dev' || this.state.status === 'downloading' || this.state.status === 'ready') return;
    const src = this.o.getSource();
    if (!/^[\w.-]+\/[\w.-]+$/.test(src.repo || '')) { this.set({ status: 'disabled', error: '' }); return; }
    this.set({ status: 'checking', error: '' });
    try {
      const res = await this.o.fetch(`https://api.github.com/repos/${src.repo}/releases?per_page=30`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) });
      if (res.status === 404) throw new Error('Update repository not found (it must be public).');
      if (!res.ok) throw new Error('GitHub answered ' + res.status);
      const rel = pickRelease(await res.json(), src.tagPrefix || 'labohub-v', electron().app.getVersion());
      this.release = rel;
      if (!rel) { this.set({ status: 'up-to-date', latest: null }); return; }
      this.set({ status: 'available', latest: rel.version, notes: rel.notes });
    } catch (e) { this.set({ status: 'error', error: friendly(e) }); }
  }

  // Download the new app.asar (also used by "Update now").
  async download() {
    const rel = this.release;
    if (!rel || this.state.status === 'downloading') return false;
    this.set({ status: 'downloading', progress: 0 });
    const tmp = this.file() + '.part';
    try {
      const res = await this.o.fetch(rel.url, { redirect: 'follow', signal: AbortSignal.timeout(10 * 60 * 1000) });
      if (!res.ok || !res.body) throw new Error('Download failed (' + res.status + ')');
      const total = Number(res.headers.get('content-length')) || rel.size || 0;
      const hash = crypto.createHash('sha256');
      const out = fs.createWriteStream(tmp);
      let got = 0, lastPct = -1;
      for await (const chunk of res.body) {
        got += chunk.length;
        if (got > MAX_ASAR) throw new Error('Update file too large');
        hash.update(chunk);
        if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
        const pct = total ? Math.floor((got / total) * 100) : 0;
        if (pct !== lastPct && pct % 5 === 0) { lastPct = pct; this.set({ progress: pct }); }
      }
      await new Promise((r, j) => out.end((e) => (e ? j(e) : r())));
      const sum = hash.digest('hex');
      if (rel.sha256 && sum !== rel.sha256) throw new Error('The downloaded file is damaged (checksum mismatch).');
      if (!isAsar(tmp)) throw new Error('The downloaded file is not a LaboHub package.');
      fs.renameSync(tmp, this.file());
      this.log.info(`[update] v${rel.version} downloaded (${got} bytes, sha256 ${sum.slice(0, 12)}…)`);
      this.set({ status: 'ready', progress: 100 });
      return true;
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch (x) { /* nothing to clean */ }
      this.set({ status: 'error', error: friendly(e) });
      return false;
    }
  }

  // Swap the package once LaboHub has exited, then start it again.
  install() {
    if (this.state.status === 'available') { this.download().then((ok) => { if (ok) this.install(); }); return true; }
    if (this.state.status !== 'ready' || this.o.platform !== 'win32') { if (this.release && this.release.page) electron().shell.openExternal(this.release.page); return false; }
    const dir = this.o.resourcesDir;
    const { app } = electron();
    const script = path.join(app.getPath('temp'), 'labohub-update.cmd');
    const q = (p) => '"' + p.replace(/"/g, '') + '"';
    fs.writeFileSync(script, [
      '@echo off',
      ':wait',
      `tasklist /FI "PID eq ${process.pid}" | find "${process.pid}" >nul && (timeout /t 1 /nobreak >nul & goto wait)`,
      `move /Y ${q(path.join(dir, 'app-update.bin'))} ${q(path.join(dir, 'app.asar'))} >nul`,
      `start "" ${q(this.o.exePath)}`,
      'del "%~f0"',
    ].join('\r\n'));
    spawn('cmd.exe', ['/c', script], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    this.log.info('[update] restarting to install v' + this.state.latest);
    setTimeout(() => app.quit(), 300);
    return true;
  }

  // enabled(): read on every tick so the setting can be toggled without restarting.
  start(intervalHours, enabled) {
    const tick = () => { if (!enabled || enabled()) this.check(); };
    setTimeout(tick, 8000);
    setInterval(tick, Math.max(1, intervalHours || 4) * 3600 * 1000);
  }
}

// An asar archive starts with a pickle header: uint32 4, then the header size.
function isAsar(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const b = Buffer.alloc(16);
    fs.readSync(fd, b, 0, 16, 0);
    fs.closeSync(fd);
    return b.readUInt32LE(0) === 4 && b.readUInt32LE(4) > 8 && b.readUInt32LE(4) < 64 * 1024 * 1024;
  } catch (e) { return false; }
}

function friendly(e) {
  const m = String((e && e.message) || e);
  if (/ENOTFOUND|ECONNREFUSED|network|ETIMEDOUT|fetch failed|aborted/i.test(m)) return 'Offline — will retry later.';
  return m.split('\n')[0].slice(0, 200);
}

module.exports = { Updater, cmpVersion, pickRelease, isAsar };
