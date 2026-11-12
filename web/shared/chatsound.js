/*
 * Chat sounds for Twitch messages: 'gibberish' (synthesised blips, one voice per viewer) or 'tts' (speechSynthesis).
 * Messages are queued and played one at a time. Exposes window.ChatSound.
 *
 * cfg: { mode: 'none'|'gibberish'|'tts', volume 0..1, speed 0.5..2, pitch 0.5..2, voice: name, varyVoices,
 *        readNames, maxChars, maxQueue, muted }
 */
(function (global) {
  'use strict';

  function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // Message clean-up shared by both modes.
  function clean(text, cfg, forTts) {
    let s = String(text || '');
    s = s.replace(/https?:\/\/\S+/gi, forTts ? ' link ' : ' ');
    s = s.replace(/(.)\1{3,}/g, '$1$1$1');            // "loooooool" -> "looool"
    s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' '); // emoji
    s = s.replace(/\s+/g, ' ').trim();
    const max = cfg.maxChars || 120;
    if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, '') + (forTts ? '…' : '');
    return s;
  }

  class ChatSound {
    constructor() {
      this.cfg = { mode: 'none' };
      this.queue = [];
      this.busy = false;
      this.ac = null;
      this.voices = [];
      if (global.speechSynthesis) {
        const load = () => (this.voices = global.speechSynthesis.getVoices() || []);
        load();
        try { global.speechSynthesis.addEventListener('voiceschanged', load); } catch (e) {}
      }
    }

    configure(cfg) {
      const prevMode = this.cfg.mode;
      this.cfg = Object.assign({ mode: 'none', volume: 0.6, speed: 1, pitch: 1, maxChars: 120, maxQueue: 4 }, cfg || {});
      if (this.cfg.mode !== prevMode || this.cfg.muted) this.stop();
    }

    enabled() { return this.cfg.mode && this.cfg.mode !== 'none' && !this.cfg.muted; }

    // item: { login, display, text, onStart(seconds), onEnd() }
    say(item) {
      if (!this.enabled() || !item || !item.text) return;
      const max = Math.max(1, this.cfg.maxQueue || 4);
      if (this.queue.length >= max) this.queue.shift(); // drop the oldest waiting message when chat is fast
      this.queue.push(item);
      this.next();
    }

    stop() {
      this.queue = [];
      if (global.speechSynthesis) try { global.speechSynthesis.cancel(); } catch (e) {}
      if (this.current && this.current.stop) this.current.stop();
      this.busy = false;
    }

    next() {
      if (this.busy || !this.queue.length) return;
      const it = this.queue.shift();
      this.busy = true;
      const done = () => { if (!this.busy) return; this.busy = false; this.current = null; it.onEnd && it.onEnd(); setTimeout(() => this.next(), 120); };
      try {
        if (this.cfg.mode === 'tts') this.playTts(it, done);
        else this.playGibberish(it, done);
      } catch (e) { done(); }
    }

    // ---------- Gibberish ----------
    audio() {
      if (!this.ac) {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        this.ac = new AC();
      }
      if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
      return this.ac;
    }

    playGibberish(it, done) {
      const ac = this.audio();
      const text = clean(it.text, this.cfg, false);
      if (!ac || !text) return done();
      const h = hash(String(it.login || 'x'));
      const types = ['triangle', 'square', 'triangle', 'sawtooth', 'sine'];
      const base = (140 + (h % 230)) * (this.cfg.pitch || 1); // each viewer has their own voice
      const type = types[(h >>> 8) % types.length];
      const speed = Math.max(0.4, this.cfg.speed || 1);
      const vol = Math.max(0, Math.min(1, this.cfg.volume == null ? 0.6 : this.cfg.volume)) * (type === 'square' || type === 'sawtooth' ? 0.25 : 0.45);

      const out = ac.createGain(); out.gain.value = vol;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.7;
      lp.connect(out); out.connect(ac.destination);

      let tt = ac.currentTime + 0.03;
      const nodes = [];
      const question = /\?\s*$/.test(text), shout = /!\s*$/.test(text) || (text.length > 4 && text === text.toUpperCase() && /[A-Z]/.test(text));
      const chars = [...text];
      chars.forEach((ch, i) => {
        if (/\s/.test(ch)) { tt += 0.055 / speed; return; }
        if (!/[\p{L}\p{N}]/u.test(ch)) { tt += 0.025 / speed; return; }
        const code = ch.toLowerCase().charCodeAt(0);
        const vowel = /[aeiouyàâéèêëîïôöùûü]/i.test(ch);
        const dur = (vowel ? 0.075 : 0.05) / speed;
        let f = base * (1 + (((code * 7) % 13) - 6) * 0.03) * (vowel ? 1.12 : 1);
        if (question && i > chars.length - 5) f *= 1 + (i - (chars.length - 5)) * 0.06;
        const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, tt);
        o.frequency.exponentialRampToValueAtTime(f * (vowel ? 0.94 : 1.04), tt + dur);
        const g = ac.createGain();
        const peak = shout ? 1 : 0.8;
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(peak, tt + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
        o.connect(g); g.connect(lp);
        o.start(tt); o.stop(tt + dur + 0.02);
        nodes.push(o);
        tt += dur * 0.92;
      });
      const total = Math.max(0.1, tt - ac.currentTime);
      it.onStart && it.onStart(total);
      const timer = setTimeout(() => { out.disconnect(); done(); }, total * 1000 + 40);
      this.current = { stop: () => { clearTimeout(timer); nodes.forEach((n) => { try { n.stop(); } catch (e) {} }); out.disconnect(); } };
    }

    // ---------- Text to speech ----------
    pickVoice(login) {
      const vs = this.voices.length ? this.voices : (global.speechSynthesis ? global.speechSynthesis.getVoices() : []);
      if (!vs.length) return null;
      const chosen = vs.find((v) => v.name === this.cfg.voice) || null;
      if (!this.cfg.varyVoices) return chosen;
      // Vary among voices of the same language as the chosen one (or the UI language).
      const lang = (chosen ? chosen.lang : (global.navigator && navigator.language) || 'en').slice(0, 2);
      const pool = vs.filter((v) => v.lang && v.lang.slice(0, 2) === lang);
      const list = pool.length ? pool : vs;
      return list[hash(String(login)) % list.length];
    }

    playTts(it, done) {
      const synth = global.speechSynthesis;
      const text = clean(it.text, this.cfg, true);
      if (!synth || !text) return done();
      const say = this.cfg.readNames && it.display ? (this.cfg.namePattern || '{name}: ').replace('{name}', it.display) + text : text;
      const u = new SpeechSynthesisUtterance(say);
      const v = this.pickVoice(it.login);
      if (v) { u.voice = v; u.lang = v.lang; }
      u.volume = Math.max(0, Math.min(1, this.cfg.volume == null ? 0.6 : this.cfg.volume));
      u.rate = Math.max(0.5, Math.min(2, this.cfg.speed || 1));
      let pitch = this.cfg.pitch || 1;
      if (this.cfg.varyVoices) pitch *= 0.85 + (hash(String(it.login) + 'p') % 40) / 100; // 0.85..1.25
      u.pitch = Math.max(0.1, Math.min(2, pitch));
      const guard = setTimeout(done, 4000 + say.length * 120); // some engines never fire onend
      u.onstart = () => it.onStart && it.onStart(say.length * 0.065 / u.rate);
      u.onend = u.onerror = () => { clearTimeout(guard); done(); };
      this.current = { stop: () => { clearTimeout(guard); synth.cancel(); } };
      synth.speak(u);
    }

    voiceList() {
      const vs = this.voices.length ? this.voices : (global.speechSynthesis ? global.speechSynthesis.getVoices() : []);
      return vs.map((v) => ({ name: v.name, lang: v.lang }));
    }
  }

  global.ChatSound = ChatSound;
})(typeof window !== 'undefined' ? window : globalThis);
