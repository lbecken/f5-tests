// ============================================================================
// LHC SIMULATOR — AUDIO
// Three layers:
//  · ambient music loop (generated file)
//  · contextual voice narration (generated clips) with captions + ducking
//  · WebAudio-synthesised UI/machine sounds (work with no assets at all)
// ============================================================================

// Narration clips: file key → transcript (shown as caption) + play-once flag.
// Clips marked once:true fire the first time their moment happens per session.
export const NARRATIONS = {
  welcome: {
    once: true,
    text: 'Welcome to the Large Hadron Collider. One hundred metres beneath the Franco-Swiss border, two beams of protons race around a 27 km ring, 11,000 times per second… You are now in the control room. The machine is yours.',
  },
  control: {
    once: true,
    text: 'Welcome to the CERN Control Centre. Configure your fill on the left, then inject the beam. The machine will take you through injection, ramp, squeeze — and finally, stable beams.',
  },
  inject: {
    once: true,
    text: 'Injection: the SPS is delivering proton bunch trains at 450 GeV. Watch both rings fill, train by train. Blue circulates clockwise; red, counter-clockwise.',
  },
  ramp: {
    once: true,
    text: 'Energy ramp: nearly 12,000 A flow through the dipoles while the RF cavities push the protons harder on every turn. Each beam climbs to 6.8 TeV.',
  },
  squeeze: {
    once: true,
    text: 'The squeeze: quadrupoles around the experiments compress each beam to the width of a human hair. Smaller beams collide more often — luminosity is everything.',
  },
  stable: {
    once: true,
    text: 'Stable beams. The experiments are recording more than a billion collisions per second. Open the event display and see what the physics looks like.',
  },
  dump: {
    once: true,
    text: 'Beam dump: both beams extracted into graphite absorbers at Point 6 — the only objects on Earth built to survive a full LHC beam.',
  },
  atlas: {
    once: true,
    text: 'ATLAS: the largest particle detector ever built — 46 m long, yet lighter than CMS, because much of it is field-filled empty space. Muons (red) are measured twice: in the inner tracker and again in the air-core toroids.',
  },
  cms: {
    once: true,
    text: 'CMS: 14,000 tonnes around the most powerful solenoid ever built. Notice how tightly tracks curl — 3.8 T bends everything. Its PbWO₄ crystals were a 20-year bet on H → γγ. The bet paid off.',
  },
  alice: {
    once: true,
    text: 'ALICE, the heavy-ion specialist: lead collisions briefly create quark–gluon plasma at 5 trillion kelvin. Thousands of tracks flood the TPC — their elliptical asymmetry shows the plasma flowing as a near-perfect liquid.',
  },
  lhcb: {
    once: true,
    text: 'LHCb hunts beauty quarks to ask why the universe is matter and not antimatter. Watch the vertex zoom: a B meson flies a few millimetres before decaying — that displaced vertex is the whole trick.',
  },
  analysis: {
    once: true,
    text: 'Discoveries happen in statistics, not single events. Plot the invariant mass of millions of pairs and every particle that decays that way rises as a peak. Start with the dimuon spectrum: fifty years of physics in one histogram.',
  },
  learn: {
    once: true,
    text: 'Everything here is written for a physics student: the lab, the accelerator chain, the magnets, the four experiments — and how people actually end up working at CERN.',
  },
};

export class AudioEngine {
  constructor() {
    this.enabled = false;        // master sound
    this.voiceEnabled = true;    // narration layer (only audible when master is on)
    this.ctx = null;
    this.ambient = document.getElementById('ambient-audio');
    if (this.ambient) this.ambient.volume = 0.35;
    this.current = null;         // currently playing narration <audio>
    this.played = new Set();
    this.onCaption = null;       // (text|null) => void — wired by main.js
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
      this.stopNarration();
    }
    return this.enabled;
  }

  toggleVoice() {
    this.voiceEnabled = !this.voiceEnabled;
    if (!this.voiceEnabled) this.stopNarration();
    return this.voiceEnabled;
  }

  // ---- narration -----------------------------------------------------------
  narrate(key, { force = false } = {}) {
    const n = NARRATIONS[key];
    if (!n || !this.enabled || !this.voiceEnabled) return;
    if (n.once && this.played.has(key) && !force) return;
    this.played.add(key);
    this.stopNarration();
    const a = new Audio(`assets/audio/narr/${key}.mp3`);
    a.volume = 0.95;
    this.current = a;
    if (this.ambient) this.ambient.volume = 0.10;          // duck the music
    if (this.onCaption) this.onCaption(n.text);
    const done = () => {
      if (this.current === a) this.current = null;
      if (this.ambient) this.ambient.volume = 0.35;
      if (this.onCaption) this.onCaption(null);
    };
    a.onended = done;
    a.onerror = done;
    a.play().catch(done);
  }

  stopNarration() {
    if (this.current) {
      this.current.pause();
      this.current = null;
      if (this.ambient) this.ambient.volume = 0.35;
      if (this.onCaption) this.onCaption(null);
    }
  }

  // ---- synthesised sounds ---------------------------------------------------
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
