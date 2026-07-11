import { buildScore } from './score';
import { ScoreRenderer } from './renderer';
import { PianoSampler } from './sampler';
import { Player } from './player';
import { PracticeEngine } from './practice';
import { MidiInput } from './midiInput';
import type { Score, ScoreNote } from './types';

type Mode = 'listening' | 'practice';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const ui = {
  open: $<HTMLButtonElement>('btn-open'),
  file: $<HTMLInputElement>('file-input'),
  demo: $<HTMLButtonElement>('btn-demo'),
  audio: $<HTMLButtonElement>('btn-audio'),
  audioInput: $<HTMLInputElement>('audio-input'),
  audioGroup: $<HTMLDivElement>('audio-track-group'),
  audioName: $<HTMLSpanElement>('audio-track-name'),
  audioClear: $<HTMLButtonElement>('btn-audio-clear'),
  useBacking: $<HTMLInputElement>('use-backing'),
  modeListen: $<HTMLButtonElement>('mode-listen'),
  modePractice: $<HTMLButtonElement>('mode-practice'),
  restart: $<HTMLButtonElement>('btn-restart'),
  back: $<HTMLButtonElement>('btn-back'),
  play: $<HTMLButtonElement>('btn-play'),
  fwd: $<HTMLButtonElement>('btn-fwd'),
  tempo: $<HTMLInputElement>('tempo'),
  tempoLabel: $<HTMLSpanElement>('tempo-label'),
  tempoReset: $<HTMLButtonElement>('tempo-reset'),
  clock: $<HTMLSpanElement>('clock'),
  pieceInfo: $<HTMLSpanElement>('piece-info'),
  practiceSettings: $<HTMLDivElement>('practice-settings'),
  midiIn: $<HTMLSelectElement>('midi-in'),
  timingWindow: $<HTMLSelectElement>('timing-window'),
  guideAudio: $<HTMLInputElement>('guide-audio'),
  practiceStats: $<HTMLSpanElement>('practice-stats'),
  scoreEmpty: $<HTMLDivElement>('score-empty'),
  scorePanel: $<HTMLDivElement>('score-panel'),
  scoreHeader: $<HTMLDivElement>('score-header'),
  scoreScroll: $<HTMLDivElement>('score-scroll'),
  scoreContent: $<HTMLDivElement>('score-content'),
  status: $<HTMLSpanElement>('status-msg'),
};

const sampler = new PianoSampler();
const player = new Player(sampler);
const renderer = new ScoreRenderer(ui.scoreHeader, ui.scoreContent);
const practice = new PracticeEngine();
const midiInput = new MidiInput();

let score: Score | null = null;
let mode: Mode = 'listening';
let samplesReady = false;

// Notes currently sounding, for the listening-mode highlight.
let activeNotes = new Set<ScoreNote>();
let activeScanIndex = 0;
let lastPos = -1;

practice.onNoteJudged = (note) => renderer.applyNoteState(note);

function setStatus(msg: string, isError = false): void {
  ui.status.textContent = msg;
  ui.status.className = isError ? 'error' : '';
}

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ------------------------------------------------------------------
// Loading
// ------------------------------------------------------------------

async function ensureSamples(): Promise<void> {
  if (samplesReady) return;
  setStatus('Loading piano samples…');
  await sampler.load((done, total) => setStatus(`Loading piano samples… ${done}/${total}`));
  samplesReady = true;
  setStatus('Piano ready.');
}

async function loadMidi(data: ArrayBuffer, fileName: string): Promise<void> {
  try {
    const parsed = buildScore(data, fileName);
    player.setScore(null);
    score = parsed;
    await document.fonts.load('40px Bravura'); // engraving font before first render
    renderer.render(score);
    player.setScore(score);
    practice.setScore(score);
    resetHighlights();
    ui.scoreEmpty.hidden = true;
    ui.scorePanel.hidden = false;
    ui.play.disabled = false;
    ui.audio.disabled = false;
    ui.scoreScroll.scrollLeft = 0;
    const measures = score.measures.length;
    ui.pieceInfo.innerHTML =
      `<b>${escapeHtml(score.name || fileName)}</b> — ${escapeHtml(score.keyName)} · ` +
      `${score.timeSignatures[0].numerator}/${score.timeSignatures[0].denominator} · ` +
      `${score.bpm} bpm · ${measures} measures · ${score.notes.length} notes`;
    updateTransportUi();
    setStatus(`Loaded ${fileName}.`);
    void ensureSamples();
  } catch (err) {
    setStatus(`Could not load ${fileName}: ${err instanceof Error ? err.message : err}`, true);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

ui.open.addEventListener('click', () => ui.file.click());
ui.file.addEventListener('change', async () => {
  const file = ui.file.files?.[0];
  if (file) await loadMidi(await file.arrayBuffer(), file.name);
  ui.file.value = '';
});

// ------------------------------------------------------------------
// Backing audio track (optional, assumed in sync with the MIDI)
// ------------------------------------------------------------------

ui.audio.addEventListener('click', () => ui.audioInput.click());
ui.audioInput.addEventListener('change', async () => {
  const file = ui.audioInput.files?.[0];
  ui.audioInput.value = '';
  if (!file) return;
  try {
    setStatus(`Decoding ${file.name}…`);
    const buffer = await sampler.decode(await file.arrayBuffer());
    player.backingBuffer = buffer;
    player.setUseBacking(ui.useBacking.checked);
    ui.audioGroup.hidden = false;
    ui.audioName.textContent = `${file.name} (${fmtTime(buffer.duration)})`;
    setStatus(
      `Audio track loaded. It plays instead of the piano and follows the tempo slider ` +
        `(speed changes also shift its pitch).`,
    );
  } catch {
    setStatus(`Could not decode ${file.name} — not a supported audio format?`, true);
  }
});

ui.useBacking.addEventListener('change', () => player.setUseBacking(ui.useBacking.checked));

ui.audioClear.addEventListener('click', () => {
  player.backingBuffer = null;
  player.setUseBacking(false);
  ui.audioGroup.hidden = true;
  ui.audioName.textContent = '';
  setStatus('Audio track removed — using the sampled piano.');
});

ui.demo.addEventListener('click', async () => {
  try {
    const res = await fetch('demo/minuet-in-g.mid');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadMidi(await res.arrayBuffer(), 'Minuet in G (demo)');
  } catch (err) {
    setStatus(`Could not load demo: ${err}`, true);
  }
});

// ------------------------------------------------------------------
// Transport
// ------------------------------------------------------------------

function updateTransportUi(): void {
  ui.play.innerHTML = player.isPlaying ? '&#x23F8;&#xFE0E;' : '&#x25B6;&#xFE0E;';
  ui.play.title = player.isPlaying ? 'Pause (Space)' : 'Play (Space)';
}

async function togglePlay(): Promise<void> {
  if (!score) return;
  if (player.isPlaying) {
    player.pause();
  } else {
    await ensureSamples();
    if (player.position >= player.duration) resetForPosition(0);
    await player.play();
  }
  updateTransportUi();
}

function resetForPosition(sec: number): void {
  player.seek(sec);
  practice.reset(sec);
  resetHighlights();
  updatePracticeStats();
}

function resetHighlights(): void {
  for (const n of activeNotes) {
    if (n.state === 'active') {
      n.state = 'idle';
      renderer.applyNoteState(n);
    }
  }
  activeNotes = new Set();
  activeScanIndex = 0;
  lastPos = -1;
}

ui.play.addEventListener('click', () => void togglePlay());
ui.restart.addEventListener('click', () => resetForPosition(0));
ui.back.addEventListener('click', () => resetForPosition(player.position - 5));
ui.fwd.addEventListener('click', () => resetForPosition(player.position + 5));

player.onEnded = () => {
  updateTransportUi();
  setStatus('End of piece.');
};

// Click on the score to jump there.
ui.scoreContent.addEventListener('click', (e) => {
  if (!score) return;
  const svg = ui.scoreContent.querySelector('svg');
  if (!svg) return;
  const x = e.clientX - svg.getBoundingClientRect().left;
  const sec = score.ticksToSeconds(Math.min(renderer.ticksForX(x), score.durationTicks));
  resetForPosition(sec);
});

// Keyboard shortcuts.
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.code === 'Space') {
    e.preventDefault();
    void togglePlay();
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    resetForPosition(player.position - 5);
  } else if (e.code === 'ArrowRight') {
    e.preventDefault();
    resetForPosition(player.position + 5);
  } else if (e.code === 'Home') {
    e.preventDefault();
    resetForPosition(0);
  }
});

// ------------------------------------------------------------------
// Tempo
// ------------------------------------------------------------------

function applyTempo(percent: number): void {
  ui.tempo.value = String(percent);
  ui.tempoLabel.textContent = `${percent}%`;
  player.setTempo(percent / 100);
}

ui.tempo.addEventListener('input', () => applyTempo(Number(ui.tempo.value)));
ui.tempoReset.addEventListener('click', () => applyTempo(100));

// ------------------------------------------------------------------
// Zoom (horizontal note spacing)
// ------------------------------------------------------------------

function zoom(factor: number): void {
  if (!score) return;
  renderer.setZoom(Math.min(200, Math.max(24, renderer.pxPerQuarter * factor)));
  lastPos = -1; // force a cursor/scroll refresh on the rebuilt SVG
  const cursorX = renderer.setCursorTicks(score.secondsToTicks(player.position));
  ui.scoreScroll.scrollLeft = Math.max(0, cursorX - ui.scoreScroll.clientWidth * 0.3);
}

$<HTMLButtonElement>('zoom-in').addEventListener('click', () => zoom(1.25));
$<HTMLButtonElement>('zoom-out').addEventListener('click', () => zoom(0.8));

// ------------------------------------------------------------------
// Mode switching
// ------------------------------------------------------------------

function setMode(next: Mode): void {
  if (mode === next) return;
  mode = next;
  ui.modeListen.classList.toggle('active', mode === 'listening');
  ui.modePractice.classList.toggle('active', mode === 'practice');
  ui.practiceSettings.hidden = mode !== 'practice';
  player.guideAudio = mode === 'listening' || ui.guideAudio.checked;
  practice.reset(0);
  resetHighlights();
  renderer.refreshAllStates();
  updatePracticeStats();
  if (mode === 'practice') {
    void initMidiInput();
    if (!midiInput.supported) {
      setStatus('Web MIDI is not supported in this browser — use Chrome or Edge.', true);
    }
  }
}

ui.modeListen.addEventListener('click', () => setMode('listening'));
ui.modePractice.addEventListener('click', () => setMode('practice'));

ui.guideAudio.addEventListener('change', () => {
  player.guideAudio = mode === 'listening' || ui.guideAudio.checked;
  // Restart audio sources so an already-sounding backing track obeys the toggle.
  if (player.isPlaying) player.seek(player.position);
});

ui.timingWindow.addEventListener('change', () => {
  practice.windowWall = Number(ui.timingWindow.value) / 1000;
});

function updatePracticeStats(): void {
  ui.practiceStats.innerHTML =
    mode === 'practice'
      ? `<span class="ok">✓ ${practice.hits}</span> <span class="miss">✗ ${practice.misses}</span>`
      : '';
}

// ------------------------------------------------------------------
// MIDI input
// ------------------------------------------------------------------

let midiInitDone = false;

async function initMidiInput(): Promise<void> {
  if (midiInitDone) return;
  midiInitDone = true;
  const ok = await midiInput.init();
  if (!ok) return;
  midiInput.onDevicesChanged = refreshMidiInputs;
  refreshMidiInputs();
}

function refreshMidiInputs(): void {
  const inputs = midiInput.listInputs();
  const current = midiInput.selectedId;
  ui.midiIn.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = inputs.length ? '— select device —' : '— no device found —';
  ui.midiIn.appendChild(none);
  for (const input of inputs) {
    const opt = document.createElement('option');
    opt.value = input.id;
    opt.textContent = input.name;
    ui.midiIn.appendChild(opt);
  }
  // Keep the selection, or auto-select the only device.
  const pick = inputs.some((i) => i.id === current)
    ? current
    : inputs.length === 1
      ? inputs[0].id
      : '';
  ui.midiIn.value = pick;
  midiInput.select(pick);
}

ui.midiIn.addEventListener('change', () => midiInput.select(ui.midiIn.value));

midiInput.onNoteOn = (midi) => {
  if (mode !== 'practice' || !score || !player.isPlaying) return;
  practice.noteOn(midi, player.position, player.tempoFactor);
  updatePracticeStats();
};

// ------------------------------------------------------------------
// Animation loop: cursor, auto-scroll, highlights, miss detection
// ------------------------------------------------------------------

function frame(): void {
  requestAnimationFrame(frame);
  if (!score) return;
  const pos = player.position;
  if (pos === lastPos && !player.isPlaying) return;

  const ticks = score.secondsToTicks(pos);
  const cursorX = renderer.setCursorTicks(ticks);
  ui.clock.textContent = `${fmtTime(pos)} / ${fmtTime(score.duration)}`;

  if (player.isPlaying) {
    // Keep the cursor around the first third of the viewport.
    const scroll = ui.scoreScroll;
    const target = cursorX - scroll.clientWidth * 0.3;
    if (Math.abs(scroll.scrollLeft - target) > 2) {
      scroll.scrollLeft = Math.max(0, target);
    }
  }

  // Highlight sounding notes (listening mode only — practice uses hit/missed).
  if (pos < lastPos) resetHighlights();
  const notes = score.notes;
  if (player.isPlaying) {
    while (activeScanIndex < notes.length && notes[activeScanIndex].time <= pos) {
      const n = notes[activeScanIndex++];
      if (mode === 'listening' && n.state === 'idle' && pos < n.time + n.duration) {
        n.state = 'active';
        renderer.applyNoteState(n);
        activeNotes.add(n);
      }
    }
  }
  for (const n of activeNotes) {
    if (n.state === 'active' && pos >= n.time + n.duration) {
      n.state = 'idle';
      renderer.applyNoteState(n);
      activeNotes.delete(n);
    }
  }

  if (mode === 'practice' && player.isPlaying) {
    const missesBefore = practice.misses;
    practice.tick(pos, player.tempoFactor);
    if (practice.misses !== missesBefore) updatePracticeStats();
  }

  lastPos = pos;
}

requestAnimationFrame(frame);
setStatus('Open a MIDI file or load the demo to begin.');

// Console/testing hook: simulate a key press without a MIDI device, e.g.
//   __piano.noteOn(60)  // middle C
declare global {
  interface Window {
    __piano: { noteOn(midi: number): void; player: Player; score(): Score | null };
  }
}
window.__piano = {
  noteOn: (midi: number) => midiInput.onNoteOn?.(midi, 0.8),
  player,
  score: () => score,
};
