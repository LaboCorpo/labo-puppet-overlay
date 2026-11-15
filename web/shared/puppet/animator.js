/*
 * Per-puppet animation state: mouth flap, blink, look, hop/dance/wave, intensity and sleep.
 */
(function (global) {
  'use strict';
  const P = (global.Puppet = global.Puppet || {});
  const { hashString, mulberry32 } = P;

  // ---------- Animation state per puppet ----------
  class Animator {
    constructor(seed) {
      const r = mulberry32(hashString(String(seed || Math.random())));
      this.phase = r() * 100;
      this.speed = 15 + r() * 6;
      this.open = 0;
      this.talking = false;
      this.hangover = 0;   // keeps the mouth moving briefly through short speaking gaps
      this.talkTime = 0;   // seconds of (mostly) continuous speech -> intensity
      this.idleTime = 0;   // seconds since last speech -> sleep
      this.nextBlink = 1 + r() * 3;
      this.blink = 0;
      this.hop = 0;        // 1 -> 0 jump arc
      this.hopHeight = 18;
      this.look = 0; this.lookTarget = 0;
      this.danceT = 0; this.waveT = 0;
      this.sleepAfter = 0; // seconds, 0 = never
    }
    jump(h) { this.hop = 1; this.hopHeight = h || 18; }
    dance(sec) { this.danceT = Math.max(this.danceT, sec || 3); }
    wave(sec) { this.waveT = Math.max(this.waveT, sec || 2.5); }
    update(dt, t) {
      if (this.talking) this.hangover = 0.18; else this.hangover = Math.max(0, this.hangover - dt);
      const speaking = this.talking || this.hangover > 0;
      if (speaking) { this.talkTime = Math.min(20, this.talkTime + dt); this.idleTime = 0; }
      else { this.talkTime = Math.max(0, this.talkTime - dt * 3); this.idleTime += dt; }
      const intensity = this.intensity();
      let target = 0;
      if (speaking) {
        const sp = this.speed * (1 + intensity * 0.45);
        const s = Math.sin((t + this.phase) * sp);
        const s2 = Math.sin((t + this.phase) * sp * 0.37);
        target = Math.max(0, 0.55 + 0.45 * s * (0.6 + 0.4 * s2)) * (0.85 + intensity * 0.3);
      }
      const k = target > this.open ? 30 : 18;
      this.open += (target - this.open) * Math.min(1, dt * k);
      this.nextBlink -= dt;
      if (this.nextBlink <= 0) { this.blink = 0.14; this.nextBlink = 2 + Math.random() * 4; }
      this.blink = Math.max(0, this.blink - dt);
      this.hop = Math.max(0, this.hop - dt * 2.6);
      this.danceT = Math.max(0, this.danceT - dt);
      this.waveT = Math.max(0, this.waveT - dt);
      this.look += (this.lookTarget - this.look) * Math.min(1, dt * 5);
    }
    intensity() { return Math.min(1, Math.max(0, (this.talkTime - 2) / 8)); }
    asleep() { return this.sleepAfter > 0 && this.idleTime > this.sleepAfter && !this.talking; }
    state(t) {
      const tt = t + this.phase;
      const asleep = this.asleep();
      const intensity = this.intensity();
      const speaking = this.talking || this.hangover > 0;
      let bob = Math.sin(tt * (asleep ? 1.2 : 2.2)) * (asleep ? 2.5 : 1.5);
      if (speaking) bob -= Math.abs(Math.sin(tt * 9)) * (2.5 + intensity * 4);
      bob -= Math.sin(this.hop * Math.PI) * this.hopHeight;
      let rock = speaking ? Math.sin(tt * 7) * 0.035 * intensity : 0;
      if (this.danceT > 0) { rock += Math.sin(tt * 10) * 0.22; bob -= Math.abs(Math.sin(tt * 10)) * 8; }
      return {
        open: this.open, blinking: this.blink > 0 || asleep, bob, rock, look: this.look,
        wave: this.waveT > 0 ? Math.min(1, this.waveT * 3, (2.5 - this.waveT) * 4 + 0.2) : 0,
        asleep, intensity, time: tt,
      };
    }
  }

  P.Animator = Animator;
})(typeof window !== 'undefined' ? window : globalThis);
