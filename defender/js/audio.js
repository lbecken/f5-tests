// audio.js — WebAudio playback of ElevenLabs-generated mp3 assets.
// All sounds decode to AudioBuffers; every play() spawns a throwaway
// BufferSource so effects can overlap freely (arcade machines never
// wait for a sound to finish).

const SFX_FILES = [
  'shoot', 'explosion', 'bigboom', 'thrust', 'abduct', 'rescue',
  'smartbomb', 'mutant', 'materialize', 'hyperspace', 'humandie', 'baiter',
  'flyby', 'enemyshoot',
  'vo_defend', 'vo_abduct', 'vo_wave', 'vo_gameover', 'vo_mutant',
  'wing_incoming', 'wing_watchback', 'wing_nicecatch', 'wing_goodshot', 'wing_humanoids',
];

class AudioMan {
  constructor(basePath = 'assets/sfx') {
    this.basePath = basePath;
    this.ctx = null;
    this.buffers = {};
    this.master = null;
    this.sfxGain = null;   // ducked while a voice line plays
    this.muted = false;
    this.thrustNode = null;
    this.thrustGain = null;
    this.ready = false;
  }

  // Must be called from a user gesture (browser autoplay policy).
  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);

    await Promise.all(SFX_FILES.map(async (name) => {
      try {
        const res = await fetch(`${this.basePath}/${name}.mp3`);
        const buf = await res.arrayBuffer();
        this.buffers[name] = await this.ctx.decodeAudioData(buf);
      } catch (e) {
        console.warn(`sfx "${name}" failed to load`, e);
      }
    }));
    this.ready = true;
  }

  play(name, { vol = 1, rate = 1, pan = 0 } = {}) {
    if (!this.ready || this.muted || !this.buffers[name]) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p); p.connect(this.sfxGain);
    } else {
      g.connect(this.sfxGain);
    }
    src.start();
  }

  // Voice lines duck the effects bed so the announcer cuts through.
  say(name) {
    if (!this.ready || this.muted || !this.buffers[name]) return;
    const t = this.ctx.currentTime;
    const dur = this.buffers[name].duration;
    this.sfxGain.gain.cancelScheduledValues(t);
    this.sfxGain.gain.setValueAtTime(this.sfxGain.gain.value, t);
    this.sfxGain.gain.linearRampToValueAtTime(0.35, t + 0.08);
    this.sfxGain.gain.setValueAtTime(0.35, t + dur - 0.1);
    this.sfxGain.gain.linearRampToValueAtTime(1.0, t + dur + 0.2);
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    const g = this.ctx.createGain();
    g.gain.value = 1.0;
    src.connect(g); g.connect(this.master);
    src.start();
  }

  // Engine loop: a single looping source whose gain ramps with the
  // thrust key, so the burn swells in and fades out without clicks.
  setThrust(on) {
    if (!this.ready || this.muted) { if (!on) this._stopThrust(); return; }
    const t = this.ctx.currentTime;
    if (on) {
      if (!this.thrustNode) {
        if (!this.buffers.thrust) return;
        this.thrustNode = this.ctx.createBufferSource();
        this.thrustNode.buffer = this.buffers.thrust;
        this.thrustNode.loop = true;
        this.thrustNode.loopStart = 0.15;
        this.thrustNode.loopEnd = this.buffers.thrust.duration - 0.15;
        this.thrustGain = this.ctx.createGain();
        this.thrustGain.gain.value = 0;
        this.thrustNode.connect(this.thrustGain);
        this.thrustGain.connect(this.sfxGain);
        this.thrustNode.start();
      }
      this.thrustGain.gain.cancelScheduledValues(t);
      this.thrustGain.gain.setTargetAtTime(0.55, t, 0.06);
    } else if (this.thrustGain) {
      this.thrustGain.gain.cancelScheduledValues(t);
      this.thrustGain.gain.setTargetAtTime(0, t, 0.09);
    }
  }

  _stopThrust() {
    if (this.thrustNode) {
      try { this.thrustNode.stop(); } catch (e) { /* already stopped */ }
      this.thrustNode = null; this.thrustGain = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    return this.muted;
  }
}
