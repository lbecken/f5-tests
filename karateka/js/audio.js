/* audio.js — all sound effects synthesized with the Web Audio API (no assets). */
const AudioFX = (() => {
  let ctx = null;
  let master = null;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Reusable white-noise buffer (1s), created lazily.
  let noiseBuf = null;
  function noise() {
    ensure();
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    return src;
  }

  function env(gainNode, t0, attack, peak, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(peak, t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  function tone(type, f0, f1, dur, peak, when = 0) {
    ensure();
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    const g = ctx.createGain();
    env(g, t0, 0.005, peak, dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(freq, q, dur, peak, sweepTo = null, when = 0) {
    ensure();
    const t0 = ctx.currentTime + when;
    const src = noise();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(freq, t0);
    if (sweepTo) bp.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    bp.Q.value = q;
    const g = ctx.createGain();
    env(g, t0, 0.005, peak, dur);
    src.connect(bp).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  return {
    unlock() { ensure(); },

    whoosh() {                       // an attack slicing the air
      noiseBurst(500, 2.5, 0.13, 0.25, 1600);
    },
    hit() {                          // a strike landing: low thud + slap
      tone("sine", 160, 55, 0.14, 0.9);
      noiseBurst(900, 1.2, 0.07, 0.5);
    },
    hurt() {                         // the player taking a hit — darker thud
      tone("sine", 120, 40, 0.2, 1.0);
      noiseBurst(500, 1.0, 0.1, 0.5);
    },
    clash() {                        // two same-height attacks cancelling
      noiseBurst(2400, 6, 0.06, 0.4);
      tone("square", 700, 500, 0.06, 0.12);
    },
    step() {                         // footstep tick
      noiseBurst(300, 1.5, 0.04, 0.12);
    },
    ko() {                           // a fighter falling
      tone("sawtooth", 300, 45, 0.55, 0.35);
      tone("sine", 90, 35, 0.5, 0.8, 0.25);
      noiseBurst(200, 1, 0.25, 0.5, null, 0.3);
    },
    gong() {                         // a new opponent appears
      tone("sine", 220, 190, 1.6, 0.5);
      tone("sine", 331, 300, 1.4, 0.25);
      tone("triangle", 555, 520, 1.0, 0.12);
      noiseBurst(3000, 8, 0.1, 0.15);
    },
    fanfare() {                      // victory melody (pentatonic motif)
      const notes = [392, 440, 523, 587, 784];
      notes.forEach((f, i) => tone("square", f, f, 0.22, 0.14, i * 0.16));
      tone("square", 784, 784, 0.6, 0.16, notes.length * 0.16);
    },
    heartbeat() {                    // low vitality warning
      tone("sine", 70, 50, 0.1, 0.7);
      tone("sine", 65, 45, 0.1, 0.55, 0.18);
    },
  };
})();
