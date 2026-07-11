// ============================================================================
// LHC SIMULATOR — AUDIO
// Ambient music (generated file, if present) + WebAudio-synthesised UI/machine
// sounds so the app works fully even without the audio assets.
// ============================================================================

export class AudioEngine {
  constructor() {
    this.enabled = false;
    this.ctx = null;
    this.ambient = document.getElementById('ambient-audio');
    this.narration = document.getElementById('narration-audio');
    if (this.ambient) this.ambient.volume = 0.35;
    if (this.narration) this.narration.volume = 0.9;
  }

  ensureCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.ensureCtx();
      if (this.ambient) this.ambient.play().catch(() => {});
    } else {
      if (this.ambient) this.ambient.pause();
      if (this.narration) this.narration.pause();
    }
    return this.enabled;
  }

  playNarration() {
    if (!this.enabled || !this.narration) return;
    this.narration.currentTime = 0;
    this.narration.play().catch(() => {});
  }

  beep(freq = 880, dur = 0.08, type = 'sine', gain = 0.06) {
    if (!this.enabled) return;
    this.ensureCtx();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  click()        { this.beep(1400, 0.03, 'square', 0.025); }
  inject()       { this.beep(220, 0.25, 'sawtooth', 0.04); }
  phaseChange()  { this.beep(660, 0.12); this.beep(990, 0.12); }
  stableBeams()  { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.beep(f, 0.22, 'triangle', 0.07), i * 120)); }
  collision()    { if (Math.random() < 0.6) this.beep(2200 + Math.random() * 1500, 0.02, 'square', 0.012); }
  dump()         { this.beep(180, 0.5, 'sawtooth', 0.08); }

  // rising sweep during the ramp
  rampTick(frac) {
    if (!this.enabled || Math.random() > 0.12) return;
    this.beep(200 + 700 * frac, 0.05, 'sine', 0.02);
  }
}
