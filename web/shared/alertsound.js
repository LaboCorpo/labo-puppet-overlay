/*
 * Alert sound player: plays the files picked by the app for a Twitch alert ('alert-sound' event).
 * Alerts are queued (one alert at a time, all its sounds together), so a raid right after a sub
 * doesn't talk over it. Files: uploads before v1.7 (16 hex chars) in /sounds/, the rest in the Son Twitch folder (/media/).
 * opts.onStart(sounds) / opts.onEnd(): the OBS alerts source shows the GIF of the alert while it plays.
 * opts.silent: the timing without the sound (the GIF shows in OBS while the app plays the sound).
 * Exposes window.AlertSound.
 */
(function (global) {
  'use strict';
  const MAX_QUEUE = 10;
  const MAX_MS = 30000; // a stuck or very long file never blocks the queue for more than this

  class AlertSound {
    constructor(base, opts) {
      this.base = base || '';
      this.opts = opts || {};
      this.queue = [];
      this.busy = false;
      this.current = [];
    }

    play(alert, silent) {
      if (!alert || !Array.isArray(alert.sounds) || !alert.sounds.length) return;
      if (this.queue.length >= MAX_QUEUE) this.queue.shift();
      this.queue.push({ sounds: alert.sounds, silent: !!silent });
      this.next();
    }
    static url(file, base) {
      return (base || '') + (/^[a-f0-9]{16}\.(mp3|wav|ogg)$/.test(file) ? '/sounds/' : '/media/') + encodeURIComponent(file);
    }

    stop() { this.queue = []; this.current.forEach((a) => { try { a.pause(); } catch (e) {} }); this.current = []; this.busy = false; }

    next() {
      if (this.busy || !this.queue.length) return;
      this.busy = true;
      const { sounds, silent } = this.queue.shift();
      let left = sounds.length;
      let timer = 0;
      if (this.opts.onStart) try { this.opts.onStart(sounds); } catch (e) { /* display only */ }
      const done = () => {
        if (--left > 0) return;
        clearTimeout(timer);
        this.current = [];
        this.busy = false;
        if (this.opts.onEnd) try { this.opts.onEnd(); } catch (e) { /* display only */ }
        this.next();
      };
      timer = setTimeout(() => { this.current.forEach((a) => { try { a.pause(); } catch (e) {} }); left = 1; done(); }, MAX_MS);
      this.current = sounds.map((s) => {
        const a = new Audio(AlertSound.url(s.file, this.base));
        a.volume = silent ? 0 : Math.max(0, Math.min(1, Number(s.volume) || 0));
        let finished = false;
        const end = () => { if (!finished) { finished = true; done(); } };
        a.addEventListener('ended', end);
        a.addEventListener('error', end);
        const p = a.play();
        if (p && p.catch) p.catch(end); // autoplay refused or file missing
        return a;
      });
    }
  }

  global.AlertSound = AlertSound;
})(typeof window !== 'undefined' ? window : globalThis);
