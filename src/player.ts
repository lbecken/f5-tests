import type { Score } from './types';
import type { PianoSampler, VoiceHandle } from './sampler';

const LOOKAHEAD_WALL = 0.15; // seconds of audio scheduled ahead of the clock
const TICK_MS = 30;

/**
 * Transport + scheduler. All positions are expressed in "score seconds":
 * time at the file's own tempo (so the MIDI tempo map, including mid-piece
 * tempo changes, is the 100% baseline). The user tempo factor only affects
 * the mapping to wall-clock time, which keeps the score layout, cursor and
 * practice matching independent of the chosen practice speed.
 */
export class Player {
  private sampler: PianoSampler;
  private score: Score | null = null;
  private posSec = 0; // position when paused
  private anchorCtx = 0; // AudioContext time of the anchor
  private anchorPos = 0; // score seconds at the anchor
  private playing = false;
  private schedIndex = 0;
  private timer: number | null = null;
  private voices: VoiceHandle[] = [];

  tempoFactor = 1;
  /** When false (practice without guide audio), notes are not sounded. */
  guideAudio = true;
  onEnded: (() => void) | null = null;

  constructor(sampler: PianoSampler) {
    this.sampler = sampler;
  }

  setScore(score: Score | null): void {
    this.pause();
    this.score = score;
    this.posSec = 0;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get duration(): number {
    return this.score?.duration ?? 0;
  }

  /** Current position in score seconds. */
  get position(): number {
    if (!this.playing) return this.posSec;
    return this.anchorPos + (this.sampler.now - this.anchorCtx) * this.tempoFactor;
  }

  async play(): Promise<void> {
    if (!this.score || this.playing) return;
    await this.sampler.resume();
    if (this.posSec >= this.duration) this.posSec = 0;
    this.anchorCtx = this.sampler.now + 0.05;
    this.anchorPos = this.posSec;
    this.schedIndex = this.firstNoteAtOrAfter(this.posSec);
    this.playing = true;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  pause(): void {
    if (!this.playing) return;
    this.posSec = this.position;
    this.playing = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.voices = [];
    this.sampler.stopAll();
  }

  seek(seconds: number): void {
    const wasPlaying = this.playing;
    this.pause();
    this.posSec = Math.min(Math.max(0, seconds), this.duration);
    if (wasPlaying) void this.play();
  }

  setTempo(factor: number): void {
    if (this.playing) {
      // Re-anchor so the transition is seamless; the few notes already
      // scheduled inside the lookahead keep their old timing (≤150 ms).
      this.anchorPos = this.position;
      this.anchorCtx = this.sampler.now;
    }
    this.tempoFactor = factor;
  }

  private firstNoteAtOrAfter(sec: number): number {
    const notes = this.score!.notes;
    let lo = 0;
    let hi = notes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (notes[mid].time < sec) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private tick(): void {
    if (!this.playing || !this.score) return;
    const pos = this.position;
    const horizon = pos + LOOKAHEAD_WALL * this.tempoFactor;
    const notes = this.score.notes;
    while (this.schedIndex < notes.length && notes[this.schedIndex].time < horizon) {
      const note = notes[this.schedIndex++];
      if (this.guideAudio) {
        const when = this.anchorCtx + (note.time - this.anchorPos) / this.tempoFactor;
        this.voices.push(
          this.sampler.play(note.midi, note.velocity, when, note.duration / this.tempoFactor),
        );
      }
    }
    if (pos >= this.duration + 0.4) {
      this.pause();
      this.posSec = this.duration;
      this.onEnded?.();
    }
  }
}
