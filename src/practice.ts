import type { Score, ScoreNote } from './types';

/**
 * Practice-mode matching. Positions are in score seconds (see Player); the
 * timing window is configured in wall-clock milliseconds and converted with
 * the current tempo factor, so "±350 ms" feels the same at every speed.
 */
export class PracticeEngine {
  /** Timing tolerance in wall seconds (each side). */
  windowWall = 0.35;
  hits = 0;
  misses = 0;

  private score: Score | null = null;
  private missScanIndex = 0;
  onNoteJudged: ((note: ScoreNote) => void) | null = null;

  setScore(score: Score | null): void {
    this.score = score;
    this.reset(0);
  }

  /**
   * Clear judgements from `fromSec` on (0 = full reset), recount, and point
   * the miss scanner at the new position so notes skipped by a forward seek
   * are not judged.
   */
  reset(fromSec: number): void {
    this.missScanIndex = 0;
    this.hits = 0;
    this.misses = 0;
    if (!this.score) return;
    this.score.notes.forEach((note, i) => {
      if (note.time < fromSec && this.missScanIndex === i) this.missScanIndex = i + 1;
      if (note.time >= fromSec && (note.state === 'hit' || note.state === 'missed')) {
        note.state = 'idle';
        this.onNoteJudged?.(note);
      } else if (note.state === 'hit') this.hits++;
      else if (note.state === 'missed') this.misses++;
    });
  }

  /** Handle a note-on from the user's keyboard. */
  noteOn(midi: number, pos: number, tempoFactor: number): void {
    if (!this.score) return;
    const window = this.windowWall * tempoFactor;
    let best: ScoreNote | null = null;
    for (const note of this.score.notes) {
      if (note.time < pos - window) continue;
      if (note.time > pos + window) break;
      if (note.midi !== midi || note.state === 'hit' || note.state === 'missed') continue;
      if (!best || Math.abs(note.time - pos) < Math.abs(best.time - pos)) best = note;
    }
    if (best) {
      best.state = 'hit';
      this.hits++;
      this.onNoteJudged?.(best);
    }
  }

  /** Mark notes whose window has passed without being played. */
  tick(pos: number, tempoFactor: number): void {
    if (!this.score) return;
    const window = this.windowWall * tempoFactor;
    const notes = this.score.notes;
    while (this.missScanIndex < notes.length && notes[this.missScanIndex].time + window < pos) {
      const note = notes[this.missScanIndex++];
      if (note.state !== 'hit' && note.state !== 'missed') {
        note.state = 'missed';
        this.misses++;
        this.onNoteJudged?.(note);
      }
    }
  }

}
