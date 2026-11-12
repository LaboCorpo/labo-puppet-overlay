/*
 * Updates from GitHub Releases.
 * - Installed build (NSIS setup): electron-updater downloads in the background, installs on restart.
 * - Portable .exe cannot replace itself: we only check the latest release and offer the download link.
 */
const { EventEmitter } = require('events');
const { app, shell } = require('electron');

const OWNER = 'LaboCorpo';
const REPO = 'labo-puppet-overlay';
const RELEASES_URL = `https://github.com/${OWNER}/${REPO}/releases/latest`;

function cmpVersion(a, b) {
  const pa = String(a).replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

class Updater extends EventEmitter {
  constructor(log) {
    super();
    this.log = log;
    this.portable = !!process.env.PORTABLE_EXECUTABLE_FILE;
    this.state = { status: 'idle', version: app.getVersion(), latest: null, progress: 0, portable: this.portable, error: '' };
    this.au = null;
    if (!app.isPackaged) { this.state.status = 'dev'; return; }
    if (!this.portable) {
      try {
        this.au = require('electron-updater').autoUpdater;
        this.au.autoDownload = true;
        this.au.autoInstallOnAppQuit = true;
        this.au.logger = { info: (m) => log.info('[update] ' + m), warn: (m) => log.warn('[update] ' + m), error: (m) => log.error('[update] ' + m), debug: () => {} };
        this.au.on('checking-for-update', () => this.set({ status: 'checking' }));
        this.au.on('update-not-available', () => this.set({ status: 'up-to-date' }));
        this.au.on('update-available', (i) => this.set({ status: 'downloading', latest: i.version, progress: 0 }));
        this.au.on('download-progress', (p) => this.set({ status: 'downloading', progress: Math.round(p.percent || 0) }));
        this.au.on('update-downloaded', (i) => this.set({ status: 'ready', latest: i.version, progress: 100 }));
        this.au.on('error', (e) => this.set({ status: 'error', error: friendly(e) }));
      } catch (e) { log.error('[update] electron-updater unavailable: ' + e.message); this.au = null; }
    }
  }

  set(patch) { Object.assign(this.state, patch); this.emit('change', this.state); }

  async check() {
    if (this.state.status === 'dev') return;
    if (this.au) { try { await this.au.checkForUpdates(); } catch (e) { this.set({ status: 'error', error: friendly(e) }); } return; }
    // Portable: ask GitHub for the latest release tag.
    this.set({ status: 'checking' });
    try {
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
      if (res.status === 404) throw new Error('No public release found (is the GitHub repository public?)');
      const j = await res.json();
      const latest = String(j.tag_name || '').replace(/^v/, '');
      if (latest && cmpVersion(latest, app.getVersion()) > 0) this.set({ status: 'available', latest });
      else this.set({ status: 'up-to-date', latest });
    } catch (e) { this.set({ status: 'error', error: friendly(e) }); }
  }

  install() {
    if (this.au && this.state.status === 'ready') { setImmediate(() => this.au.quitAndInstall(true, true)); return true; }
    shell.openExternal(RELEASES_URL);
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
  if (/ENOTFOUND|ECONNREFUSED|network|ETIMEDOUT/i.test(m)) return 'Offline — will retry later.';
  return m.split('\n')[0].slice(0, 200);
}

module.exports = { Updater, RELEASES_URL };
