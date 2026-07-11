// Generates public/demo/minuet-in-g.mid — the first 8 bars of the Minuet in G
// (Petzold, from the Anna Magdalena Bach notebook), used as the bundled demo.
import tonejsMidi from '@tonejs/midi';
import { writeFileSync, mkdirSync } from 'node:fs';

const { Midi } = tonejsMidi;

const midi = new Midi();
midi.header.setTempo(104);
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [3, 4] });
midi.header.keySignatures.push({ ticks: 0, key: 'G', scale: 'major' });
midi.header.name = 'Minuet in G (demo)';

const right = midi.addTrack();
right.name = 'Right hand';
const left = midi.addTrack();
left.name = 'Left hand';

const PPQ = midi.header.ppq;
const Q = PPQ; // quarter
const E = PPQ / 2; // eighth
const DH = PPQ * 3; // dotted half

function put(track, ticks, names, dur) {
  for (const name of Array.isArray(names) ? names : [names]) {
    track.addNote({ name, ticks, durationTicks: Math.round(dur * 0.92), velocity: 0.75 });
  }
  return ticks + dur;
}

// --- right hand (melody) ---
let t = 0;
t = put(right, t, 'D5', Q); t = put(right, t, 'G4', E); t = put(right, t, 'A4', E); t = put(right, t, 'B4', E); t = put(right, t, 'C5', E);
t = put(right, t, 'D5', Q); t = put(right, t, 'G4', Q); t = put(right, t, 'G4', Q);
t = put(right, t, 'E5', Q); t = put(right, t, 'C5', E); t = put(right, t, 'D5', E); t = put(right, t, 'E5', E); t = put(right, t, 'F#5', E);
t = put(right, t, 'G5', Q); t = put(right, t, 'G4', Q); t = put(right, t, 'G4', Q);
t = put(right, t, 'C5', Q); t = put(right, t, 'D5', E); t = put(right, t, 'C5', E); t = put(right, t, 'B4', E); t = put(right, t, 'A4', E);
t = put(right, t, 'B4', Q); t = put(right, t, 'C5', E); t = put(right, t, 'B4', E); t = put(right, t, 'A4', E); t = put(right, t, 'G4', E);
t = put(right, t, 'F#4', Q); t = put(right, t, 'G4', E); t = put(right, t, 'A4', E); t = put(right, t, 'B4', E); t = put(right, t, 'G4', E);
t = put(right, t, 'A4', DH);

// --- left hand (bass) ---
let b = 0;
b = put(left, b, ['G3', 'B3', 'D4'], DH); // opening chord
b = put(left, b, 'B2', Q); b = put(left, b, 'D3', Q); b = put(left, b, 'G3', Q);
b = put(left, b, 'C3', Q); b = put(left, b, 'E3', Q); b = put(left, b, 'G3', Q);
b = put(left, b, 'B2', Q); b = put(left, b, 'D3', Q); b = put(left, b, 'G3', Q);
b = put(left, b, 'A2', Q); b = put(left, b, 'C3', Q); b = put(left, b, 'E3', Q);
b = put(left, b, 'G2', Q); b = put(left, b, 'B2', Q); b = put(left, b, 'D3', Q);
b = put(left, b, 'D3', Q); b = put(left, b, 'F#3', Q); b = put(left, b, 'A3', Q);
b = put(left, b, ['D3', 'A3'], DH);

mkdirSync('public/demo', { recursive: true });
writeFileSync('public/demo/minuet-in-g.mid', Buffer.from(midi.toArray()));
console.log(`Wrote public/demo/minuet-in-g.mid (${right.notes.length + left.notes.length} notes, PPQ ${PPQ})`);
