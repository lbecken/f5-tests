/**
 * Sampled piano built on the Salamander Grand Piano (Alexander Holm, CC-BY).
 * One velocity layer sampled every minor third from A0 to C8; pitches in
 * between are derived by resampling the nearest sample.
 */

const SAMPLE_BASE = 'samples/salamander/';

/** MIDI numbers of the available samples: A0 (21) up to C8 (108), step 3. */
const SAMPLE_MIDIS: number[] = [];
for (let m = 21; m <= 108; m += 3) SAMPLE_MIDIS.push(m);

const NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
function fileForMidi(midi: number): string {
  return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}.mp3`;
}

export interface VoiceHandle {
  /** Silence the voice quickly (used on pause/seek). */
  cancel(): void;
}

export class PianoSampler {
  readonly ctx: AudioContext;
  private buffers = new Map<number, AudioBuffer>();
  private master: GainNode;
  private live = new Set<{ src: AudioBufferSourceNode; gain: GainNode }>();
  loaded = false;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(compressor);
    compressor.connect(this.ctx.destination);
  }

  async load(onProgress?: (done: number, total: number) => void): Promise<void> {
    if (this.loaded) return;
    let done = 0;
    await Promise.all(
      SAMPLE_MIDIS.map(async (midi) => {
        const res = await fetch(SAMPLE_BASE + fileForMidi(midi));
        if (!res.ok) throw new Error(`Failed to load piano sample ${fileForMidi(midi)}`);
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(midi, buf);
        onProgress?.(++done, SAMPLE_MIDIS.length);
      }),
    );
    this.loaded = true;
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  /**
   * Schedule a note at absolute AudioContext time `when`, held for
   * `duration` seconds, then released with a short tail.
   */
  play(midi: number, velocity: number, when: number, duration: number): VoiceHandle {
    let nearest = SAMPLE_MIDIS[0];
    for (const s of SAMPLE_MIDIS) {
      if (Math.abs(s - midi) < Math.abs(nearest - midi)) nearest = s;
    }
    const buffer = this.buffers.get(nearest);
    if (!buffer) return { cancel: () => {} };

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = Math.pow(2, (midi - nearest) / 12);

    const gain = this.ctx.createGain();
    gain.gain.value = Math.pow(Math.max(0.05, velocity), 1.6);
    src.connect(gain);
    gain.connect(this.master);

    const releaseAt = when + Math.max(0.06, duration);
    gain.gain.setValueAtTime(gain.gain.value, releaseAt);
    gain.gain.setTargetAtTime(0, releaseAt, 0.09);
    src.start(when);
    src.stop(releaseAt + 0.6);

    const voice = { src, gain };
    this.live.add(voice);
    src.onended = () => this.live.delete(voice);
    return {
      cancel: () => {
        try {
          const t = this.ctx.currentTime;
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(gain.gain.value, t);
          gain.gain.setTargetAtTime(0, t, 0.03);
          src.stop(t + 0.15);
        } catch {
          /* voice may already have ended */
        }
      },
    };
  }

  /** Decode an audio file (for the backing-track feature). */
  decode(data: ArrayBuffer): Promise<AudioBuffer> {
    return this.ctx.decodeAudioData(data);
  }

  /**
   * Start a backing-track buffer at absolute context time `when`, from
   * `offset` seconds into the buffer, at the given playback rate. The rate
   * can be changed live without a position glitch.
   */
  playBacking(
    buffer: AudioBuffer,
    when: number,
    offset: number,
    rate: number,
  ): { setRate(rate: number): void } & VoiceHandle {
    if (offset >= buffer.duration || offset < 0) return { setRate: () => {}, cancel: () => {} };
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    src.connect(gain);
    gain.connect(this.master);
    src.start(Math.max(when, this.ctx.currentTime), offset);

    const voice = { src, gain };
    this.live.add(voice);
    src.onended = () => this.live.delete(voice);
    return {
      setRate: (r: number) => src.playbackRate.setValueAtTime(r, this.ctx.currentTime),
      cancel: () => {
        try {
          const t = this.ctx.currentTime;
          gain.gain.setTargetAtTime(0, t, 0.02);
          src.stop(t + 0.1);
        } catch {
          /* already ended */
        }
      },
    };
  }

  /** Fade out and stop everything currently sounding or scheduled. */
  stopAll(): void {
    for (const { src, gain } of this.live) {
      try {
        const t = this.ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.setTargetAtTime(0, t, 0.03);
        src.stop(t + 0.15);
      } catch {
        /* ignore */
      }
    }
    this.live.clear();
  }
}
