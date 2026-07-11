import type { Accidental } from './types';

/** Semitone offset of each letter (C D E F G A B) from C. */
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

/** Order in which sharps appear in a key signature (letter indices: F C G D A E B). */
export const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6];
/** Order in which flats appear (B E A D G C F). */
export const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];

const MAJOR_KEY_NAMES: Record<number, string> = {
  [-7]: 'C♭ major', [-6]: 'G♭ major', [-5]: 'D♭ major', [-4]: 'A♭ major',
  [-3]: 'E♭ major', [-2]: 'B♭ major', [-1]: 'F major', 0: 'C major',
  1: 'G major', 2: 'D major', 3: 'A major', 4: 'E major',
  5: 'B major', 6: 'F♯ major', 7: 'C♯ major',
};

export function keyName(fifths: number): string {
  return MAJOR_KEY_NAMES[fifths] ?? 'C major';
}

/** Map a MIDI meta key signature (e.g. "G", "Eb", scale) to circle-of-fifths position. */
export function fifthsFromMeta(key: string, scale: string): number | null {
  const majors: Record<string, number> = {
    Cb: -7, Gb: -6, Db: -5, Ab: -4, Eb: -3, Bb: -2, F: -1, C: 0,
    G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
  };
  const minors: Record<string, number> = {
    Ab: -7, Eb: -6, Bb: -5, F: -4, C: -3, G: -2, D: -1, A: 0,
    E: 1, B: 2, 'F#': 3, 'C#': 4, 'G#': 5, 'D#': 6, 'A#': 7,
  };
  const table = /min/i.test(scale) ? minors : majors;
  return table[key.trim()] ?? null;
}

/**
 * Guess a key signature from the pitch content: pick the circle-of-fifths
 * position whose major scale covers the most notes (ties go to fewer
 * sharps/flats).
 */
export function detectKeyFifths(midiNotes: number[]): number {
  if (midiNotes.length === 0) return 0;
  const histogram = new Array(12).fill(0);
  for (const m of midiNotes) histogram[m % 12]++;
  let best = 0;
  let bestScore = -1;
  for (let fifths = -6; fifths <= 6; fifths++) {
    const tonic = ((fifths * 7) % 12 + 12) % 12;
    let score = 0;
    for (const deg of [0, 2, 4, 5, 7, 9, 11]) score += histogram[(tonic + deg) % 12];
    if (score > bestScore || (score === bestScore && Math.abs(fifths) < Math.abs(best))) {
      bestScore = score;
      best = fifths;
    }
  }
  return best;
}

/** Alteration (-1, 0, +1) that the key signature applies to a letter. */
export function keyAlterationForLetter(fifths: number, letter: number): number {
  if (fifths > 0 && SHARP_ORDER.slice(0, fifths).includes(letter)) return 1;
  if (fifths < 0 && FLAT_ORDER.slice(0, -fifths).includes(letter)) return -1;
  return 0;
}

export interface Spelling {
  letter: number; // 0..6 = C..B
  alteration: number; // -1, 0, +1
  step: number; // octave * 7 + letter
}

/**
 * Spell a MIDI pitch in the given key: diatonic notes keep the key's
 * spelling; chromatic notes use sharps in sharp keys and flats in flat keys.
 */
export function spellPitch(midi: number, fifths: number): Spelling {
  const pc = midi % 12;
  // letter + alteration for each pitch class
  const SHARP_SPELL: Array<[number, number]> = [
    [0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0],
    [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0],
  ];
  const FLAT_SPELL: Array<[number, number]> = [
    [0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0],
    [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0],
  ];
  let [letter, alteration] = (fifths < 0 ? FLAT_SPELL : SHARP_SPELL)[pc];
  // If the key signature itself alters this letter to produce this pitch
  // class, prefer that spelling (e.g. F# in G major stays F#, not Gb).
  for (let l = 0; l < 7; l++) {
    const ka = keyAlterationForLetter(fifths, l);
    if (ka !== 0 && (LETTER_PC[l] + ka + 12) % 12 === pc) {
      letter = l;
      alteration = ka;
      break;
    }
  }
  const octave = Math.floor((midi - alteration) / 12) - 1;
  return { letter, alteration, step: octave * 7 + letter };
}

/**
 * Decide which accidental (if any) to draw, tracking what is already in
 * force from the key signature and from earlier accidentals in the measure.
 * `inForce` maps "letter:octave" -> alteration currently applying on a staff;
 * it must be reset at every barline.
 */
export function accidentalToDraw(
  spelling: Spelling,
  fifths: number,
  inForce: Map<string, number>,
): Accidental | null {
  const octave = Math.floor(spelling.step / 7);
  const key = `${spelling.letter}:${octave}`;
  const current = inForce.has(key)
    ? inForce.get(key)!
    : keyAlterationForLetter(fifths, spelling.letter);
  if (current === spelling.alteration) return null;
  inForce.set(key, spelling.alteration);
  if (spelling.alteration === 1) return 'sharp';
  if (spelling.alteration === -1) return 'flat';
  return 'natural';
}
