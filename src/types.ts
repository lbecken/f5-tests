export type Staff = 'treble' | 'bass';

/** Visual/practice state of a note. */
export type NoteState = 'idle' | 'active' | 'hit' | 'missed';

export type Accidental = 'sharp' | 'flat' | 'natural';

export interface ScoreNote {
  id: number;
  midi: number;
  velocity: number; // 0..1
  ticks: number;
  durationTicks: number;
  /** Start time in seconds at the file's own tempo (100%). */
  time: number;
  /** Duration in seconds at the file's own tempo. */
  duration: number;
  staff: Staff;
  /** Diatonic step index: octave * 7 + letter (C=0 … B=6). Determines vertical position. */
  step: number;
  /** Accidental to draw in front of the note, if any. */
  accidental: Accidental | null;
  state: NoteState;
}

export interface TimeSigEvent {
  ticks: number;
  numerator: number;
  denominator: number;
}

export interface Measure {
  ticks: number;
  number: number;
}

export interface Score {
  name: string;
  ppq: number;
  notes: ScoreNote[]; // sorted by ticks, then midi
  durationTicks: number;
  /** Total duration in seconds at 100% tempo. */
  duration: number;
  /** Key signature as position on the circle of fifths: -7 (7 flats) … +7 (7 sharps). */
  keyFifths: number;
  keyName: string;
  timeSignatures: TimeSigEvent[];
  measures: Measure[];
  /** First tempo of the piece, for display. */
  bpm: number;
  ticksToSeconds(ticks: number): number;
  secondsToTicks(seconds: number): number;
}
