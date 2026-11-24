/*
 * Updates from GitHub Releases of LaboCorpo/labo-puppet-overlay (fixed here, not a setting).
 * - Installed build (NSIS setup, has resources/app-update.yml): electron-updater downloads in the background
 *   and installs on restart; it checks the installer against the sha512 published in latest.yml.
 * - Portable .exe and hand-made installs (tools/installer) cannot replace themselves: we only compare the
 *   latest release tag with our version and offer the download page.
 */
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
// Loaded lazily so the version helpers can be tested without Electron.
const electron = () => require('electron');

const OWNER = 'LaboCorpo';
const REPO = 'labo-puppet-overlay';
const RELEASES_URL = `https://github.com/${OWNER}/${REPO}/releases/latest`;

function cmpVersion(a, b) {
  const parse = (v) => String(v).replace(/^[^\d]*/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pa = parse(a), pb = parse(b);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

// Latest release tag ("v1.8.0") -> "1.8.0", or null when it is not a plain release version.
function releaseVersion(tag) {
  const m = /^v(\d+\.\d+\.\d+)$/.exec(String(tag || ''));
  return m ? m[1] : null;
}

class Updater extends EventEmitter {
  constructor(log) {
    super();
    const { app } = electron();
    this.log = log;
    this.portable = !!process.env.PORTABLE_EXECUTABLE_FILE;
    this.state = { status: 'idle', version: app.getVersion(), latest: null, progress: 0, portable: this.portable, error: '' };
    this.au = null;
    if (!app.isPackaged) { this.state.status = 'dev'; return; }
    // Only electron-builder installs ship app-update.yml; anything else gets the "download page" path.
    if (this.portable || !fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'))) return;
    try {
      this.au = require('electron-updater').autoUpdater;
      this.au.autoDownload = true;
      this.au.autoInstallOnAppQuit = true;
      this.au.logger = { info: (m) => log.info('[update] ' + m), warn: (m) => log.warn('[update] ' + m), error: (m) => log.error('[update] ' + m), debug: () => {} };
      this.au.on('checking-for-update', () => this.set({ status: 'checking', error: '' }));
      this.au.on('update-not-available', () => this.set({ status: 'up-to-date' }));
      this.au.on('update-available', (i) => this.set({ status: 'downloading', latest: i.version, progress: 0 }));
      this.au.on('download-progress', (p) => this.set({ status: 'downloading', progress: Math.round(p.percent || 0) }));
      this.au.on('update-downloaded', (i) => this.set({ status: 'ready', latest: i.version, progress: 100 }));
      this.au.on('error', (e) => this.set({ status: 'error', error: friendly(e) }));
    } catch (e) {
      log.error('[update] electron-updater unavailable: ' + e.message);
      this.au = null;
    }
  }

  set(patch) { Object.assign(this.state, patch); this.emit('change', this.state); }

  async check() {
    if (this.state.status === 'dev' || this.state.status === 'downloading' || this.state.status === 'ready') return;
    if (this.au) {
      try { await this.au.checkForUpdates(); } catch (e) { this.set({ status: 'error', error: friendly(e) }); }
      return;
    }
    this.set({ status: 'checking', error: '' });
    try {
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) });
      if (res.status === 404) throw new Error('No public release found (is the GitHub repository public?)');
      if (!res.ok) throw new Error('GitHub answered ' + res.status);
      const latest = releaseVersion((await res.json()).tag_name);
      if (latest && cmpVersion(latest, electron().app.getVersion()) > 0) this.set({ status: 'available', latest });
      else this.set({ status: 'up-to-date', latest });
    } catch (e) { this.set({ status: 'error', error: friendly(e) }); }
  }

  install() {
    if (this.au && this.state.status === 'ready') { setImmediate(() => this.au.quitAndInstall(true, true)); return true; }
    electron().shell.openExternal(RELEASES_URL);
    return false;
  }

  // enabled(): read on every tick so the setting can be toggled without restarting.
  start(intervalHours, enabled) {
    const tick = () => { if (!enabled || enabled()) this.check(); };
    setTimeout(tick, 8000);
    setInterval(tick, Math.max(1, intervalHours || 4) * 3600 * 1000);
  }
}

function friendly(e) {
  const m = String((e && e.message) || e);
  if (/404|Not Found|latest\.yml/i.test(m)) return 'No published update found yet (the GitHub repository must be public).';
  if (/ENOTFOUND|ECONNREFUSED|network|ETIMEDOUT|fetch failed|aborted/i.test(m)) return 'Offline — will retry later.';
  return m.split('\n')[0].slice(0, 200);
}

module.exports = { Updater, cmpVersion, releaseVersion };
