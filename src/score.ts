import { Midi } from '@tonejs/midi';
import type { Measure, Score, ScoreNote, Staff, TimeSigEvent } from './types';
import { accidentalToDraw, detectKeyFifths, fifthsFromMeta, keyName, spellPitch } from './theory';

/** Parse a .mid file into the model the renderer and player consume. */
export function buildScore(data: ArrayBuffer, fileName: string): Score {
  const midi = new Midi(data);
  const ppq = midi.header.ppq;

  const noteTracks = midi.tracks.filter((t) => t.notes.length > 0);
  if (noteTracks.length === 0) throw new Error('This MIDI file contains no notes.');

  // Staff assignment: with two or more note tracks (typical piano MIDI:
  // one per hand) assign whole tracks by average pitch; with a single
  // track split around middle C.
  const staffOfTrack: Staff[] = noteTracks.map((t) => {
    const avg = t.notes.reduce((s, n) => s + n.midi, 0) / t.notes.length;
    return avg < 58 ? 'bass' : 'treble';
  });
  if (noteTracks.length >= 2 && new Set(staffOfTrack).size === 1) {
    // e.g. both hands hover around the same register: force lowest track to bass
    const avgs = noteTracks.map((t) => t.notes.reduce((s, n) => s + n.midi, 0) / t.notes.length);
    staffOfTrack[avgs.indexOf(Math.min(...avgs))] = 'bass';
    staffOfTrack[avgs.indexOf(Math.max(...avgs))] = 'treble';
  }
  const singleTrack = noteTracks.length === 1;

  let notes: ScoreNote[] = [];
  noteTracks.forEach((track, ti) => {
    for (const n of track.notes) {
      const staff: Staff = singleTrack ? (n.midi < 60 ? 'bass' : 'treble') : staffOfTrack[ti];
      notes.push({
        id: 0,
        midi: n.midi,
        velocity: n.velocity,
        ticks: n.ticks,
        durationTicks: Math.max(1, n.durationTicks),
        time: n.time,
        duration: Math.max(0.05, n.duration),
        staff,
        step: 0,
        accidental: null,
        state: 'idle',
      });
    }
  });
  notes.sort((a, b) => a.ticks - b.ticks || a.midi - b.midi);
  notes.forEach((n, i) => (n.id = i));

  // Key signature: MIDI meta if present, otherwise detect from the pitches.
  let keyFifths: number | null = null;
  const ks = midi.header.keySignatures[0];
  if (ks && typeof ks.key === 'string' && ks.key) {
    keyFifths = fifthsFromMeta(ks.key, ks.scale ?? 'major');
  }
  if (keyFifths === null) keyFifths = detectKeyFifths(notes.map((n) => n.midi));

  // Time signatures and barlines.
  const timeSignatures: TimeSigEvent[] = midi.header.timeSignatures.length
    ? midi.header.timeSignatures.map((ts) => ({
        ticks: ts.ticks,
        numerator: ts.timeSignature[0],
        denominator: ts.timeSignature[1],
      }))
    : [{ ticks: 0, numerator: 4, denominator: 4 }];

  const contentTicks = Math.max(
    midi.durationTicks,
    ...notes.map((n) => n.ticks + n.durationTicks),
  );
  // Extend to the end of the last measure so the final barline sits on a
  // measure boundary.
  const { measures, endTicks: durationTicks } = computeMeasures(timeSignatures, contentTicks, ppq);

  // Spell pitches and decide accidentals, resetting at each barline
  // (accidentals are tracked per staff, as in engraved music).
  const inForce: Record<Staff, Map<string, number>> = {
    treble: new Map(),
    bass: new Map(),
  };
  let measureIdx = 0;
  for (const n of notes) {
    while (measureIdx + 1 < measures.length && n.ticks >= measures[measureIdx + 1].ticks) {
      measureIdx++;
      inForce.treble.clear();
      inForce.bass.clear();
    }
    const spelling = spellPitch(n.midi, keyFifths);
    n.step = spelling.step;
    n.accidental = accidentalToDraw(spelling, keyFifths, inForce[n.staff]);
  }

  const header = midi.header;
  return {
    name: midi.name || fileName.replace(/\.midi?$/i, ''),
    ppq,
    notes,
    durationTicks,
    duration: header.ticksToSeconds(durationTicks),
    keyFifths,
    keyName: keyName(keyFifths),
    timeSignatures,
    measures,
    bpm: Math.round(header.tempos[0]?.bpm ?? 120),
    ticksToSeconds: (t) => header.ticksToSeconds(t),
    secondsToTicks: (s) => header.secondsToTicks(s),
  };
}

function computeMeasures(
  timeSignatures: TimeSigEvent[],
  contentTicks: number,
  ppq: number,
): { measures: Measure[]; endTicks: number } {
  const measures: Measure[] = [];
  let tick = 0;
  let number = 1;
  let tsIdx = 0;
  while (tick < contentTicks && measures.length < 10000) {
    while (tsIdx + 1 < timeSignatures.length && timeSignatures[tsIdx + 1].ticks <= tick) tsIdx++;
    const ts = timeSignatures[tsIdx];
    measures.push({ ticks: tick, number });
    tick += Math.round(ts.numerator * (4 / ts.denominator) * ppq);
    number++;
  }
  return { measures, endTicks: Math.max(tick, contentTicks) };
}
