"""End-to-end pipeline: audio file -> AnalysisResult -> MIDI."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional, Tuple

import numpy as np

from . import audio_io, harmony, melody, midi_writer, orchestral, percussion
from . import tempo as tempo_mod
from . import transcription
from .events import AnalysisResult, Part
from .quantize import Quantizer

log = logging.getLogger(__name__)

MODES = ("orchestral", "3section", "2section", "melody", "harmony", "full")

VOCAL_MELODY_PROGRAM = 52       # Choir Aahs
INSTRUMENTAL_MELODY_PROGRAM = 73  # Flute
HARMONY_PROGRAM = 0             # Acoustic Grand Piano


@dataclass
class Config:
    mode: str = "3section"
    bpm: Optional[float] = None
    quantize: int = 16               # grid note value; 0 = off
    melody_source: str = "auto"      # auto | vocals | instrumental
    chord_vocab: str = "triads"      # triads | sevenths
    no_separation: bool = False
    device: str = "auto"
    onset_threshold: float = 0.5
    frame_threshold: float = 0.3
    min_note_len_ms: float = 80.0
    transcriber: str = "basic-pitch"     # basic-pitch | piano
    orchestral_strategy: str = "timbre"  # timbre | register
    stems_dir: Optional[Path] = None
    time_signature: Tuple[int, int] = (4, 4)
    separate_files: bool = False
    static_tempo: bool = False  # single average BPM instead of a tempo map


@dataclass
class _Material:
    """Audio signals each analysis stage consumes."""

    melody: np.ndarray
    melody_desc: str
    harmony: np.ndarray
    percussion: Optional[np.ndarray]
    pitched: np.ndarray              # everything pitched (orchestral mode)
    raw: Optional[np.ndarray] = None  # untouched input (full mode, no sep.)
    bass: Optional[np.ndarray] = None
    stems: Dict[str, np.ndarray] = field(default_factory=dict)


def analyze(input_path: str | Path, cfg: Config) -> AnalysisResult:
    log.info("Loading %s", input_path)
    y, sr = audio_io.load_audio(input_path)
    mono = audio_io.to_mono(y)

    log.info("Detecting tempo...")
    bpm, beat_times = tempo_mod.detect_tempo(mono, sr, cfg.bpm)
    log.info("Tempo: %.1f BPM, %d beats", bpm, len(beat_times))

    material = _prepare_material(y, sr, cfg)
    if cfg.stems_dir and material.stems:
        cfg.stems_dir.mkdir(parents=True, exist_ok=True)
        for name, stem in material.stems.items():
            audio_io.save_wav(cfg.stems_dir / f"{name}.wav", stem, sr)
        log.info("Stems written to %s", cfg.stems_dir)

    result = AnalysisResult(bpm=bpm, beat_times=beat_times)

    if cfg.mode == "orchestral":
        _run_orchestral(result, material, sr, cfg)
    elif cfg.mode == "full":
        _run_full(result, material, sr, cfg)
    else:
        if cfg.mode in ("melody", "2section", "3section"):
            _run_melody(result, material, sr, cfg)
        if cfg.mode in ("harmony", "2section", "3section"):
            _run_harmony(result, material, sr, beat_times, cfg)
        if cfg.mode == "3section":
            _run_rhythm(result, material, sr)

    if cfg.quantize:
        q = Quantizer(beat_times, bpm, grid=cfg.quantize)
        for part in result.parts:
            part.notes = q.apply_notes(part.notes)
        result.chords = q.apply_chords(result.chords)
        _rebuild_harmony_notes(result)

    total_notes = sum(len(p.notes) for p in result.parts)
    if total_notes == 0:
        log.warning("No notes were transcribed — the output MIDI will be empty.")
    return result


def transcribe_file(input_path: str | Path, output_path: str | Path, cfg: Config):
    result = analyze(input_path, cfg)
    files = midi_writer.write_midi(
        result,
        output_path,
        time_signature=cfg.time_signature,
        separate_files=cfg.separate_files,
        static_tempo=cfg.static_tempo,
    )
    return result, files


# ---------------------------------------------------------------- material


def _prepare_material(y: np.ndarray, sr: int, cfg: Config) -> _Material:
    if cfg.no_separation:
        import librosa

        log.info("Separation disabled; using harmonic/percussive split (HPSS)")
        mono = audio_io.to_mono(y)
        harm, perc = librosa.effects.hpss(mono, margin=2.0)
        return _Material(
            melody=harm,
            melody_desc="full mix (harmonic)",
            harmony=harm,
            percussion=perc,
            pitched=harm,
            raw=mono,
        )

    from . import separation

    log.info("Separating sources with Demucs (this can take a while on CPU)...")
    stems = separation.separate(y, sr, device=cfg.device)

    melody_audio, melody_desc = melody.pick_melody_source(stems, cfg.melody_source)
    harmony_audio = separation.mix_stems(stems, ["bass", "other"])
    return _Material(
        melody=melody_audio,
        melody_desc=melody_desc,
        harmony=harmony_audio,
        percussion=stems.get("drums"),
        pitched=separation.mix_stems(stems, ["other", "vocals"]),
        bass=stems.get("bass"),
        stems=stems,
    )


# ------------------------------------------------------------------ stages


def _run_melody(result: AnalysisResult, m: _Material, sr: int, cfg: Config):
    log.info("Transcribing melody from %s...", m.melody_desc)
    notes = transcription.transcribe(
        m.melody,
        sr,
        onset_threshold=cfg.onset_threshold,
        frame_threshold=cfg.frame_threshold,
        min_note_len_ms=cfg.min_note_len_ms,
        backend=cfg.transcriber,
        device=cfg.device,
    )
    line = melody.monophonic_reduction(notes)
    program = (
        VOCAL_MELODY_PROGRAM
        if m.melody_desc.startswith("vocals")
        else INSTRUMENTAL_MELODY_PROGRAM
    )
    result.parts.append(Part(name="Melody", program=program, notes=line))


def _run_harmony(
    result: AnalysisResult,
    m: _Material,
    sr: int,
    beat_times: np.ndarray,
    cfg: Config,
):
    log.info("Detecting chords...")
    chords = harmony.detect_chords(
        m.harmony, sr, beat_times, vocab=cfg.chord_vocab
    )
    result.chords = chords
    part = Part(name="Harmony", program=HARMONY_PROGRAM)
    _fill_harmony_notes(part, chords)
    result.parts.append(part)


def _run_rhythm(result: AnalysisResult, m: _Material, sr: int):
    if m.percussion is None:
        return
    log.info("Transcribing percussion...")
    hits = percussion.transcribe_drums(m.percussion, sr)
    result.parts.append(Part(name="Rhythm", program=0, is_drum=True, notes=hits))


def _run_full(result: AnalysisResult, m: _Material, sr: int, cfg: Config):
    """Complete note-for-note transcription into a single track."""
    if m.raw is not None:
        audio = m.raw  # piano models want the untouched signal
    else:
        from . import separation

        audio = separation.mix_stems(m.stems, ["bass", "other", "vocals"])

    log.info("Transcribing full polyphony (%s backend)...", cfg.transcriber)
    pedal = []
    if cfg.transcriber == "piano":
        notes, pedal = transcription.transcribe_piano(
            audio, sr, min_note_len_ms=cfg.min_note_len_ms, device=cfg.device
        )
    else:
        notes = transcription.transcribe(
            audio,
            sr,
            onset_threshold=cfg.onset_threshold,
            frame_threshold=cfg.frame_threshold,
            min_note_len_ms=cfg.min_note_len_ms,
        )
    result.parts.append(Part(name="Piano", program=0, notes=notes, pedal=pedal))


def _run_orchestral(result: AnalysisResult, m: _Material, sr: int, cfg: Config):
    log.info("Transcribing orchestral body...")
    body_notes = transcription.transcribe(
        m.pitched,
        sr,
        onset_threshold=cfg.onset_threshold,
        frame_threshold=cfg.frame_threshold,
        min_note_len_ms=cfg.min_note_len_ms,
        backend=cfg.transcriber,
        device=cfg.device,
    )
    sections = orchestral.classify_notes(
        body_notes, m.pitched, sr, strategy=cfg.orchestral_strategy
    )

    if m.bass is not None:
        log.info("Transcribing bass register...")
        bass_notes = transcription.transcribe(
            m.bass,
            sr,
            onset_threshold=cfg.onset_threshold,
            frame_threshold=cfg.frame_threshold,
            min_note_len_ms=cfg.min_note_len_ms,
            max_freq=500.0,
        )
        sections["Basses"].extend(bass_notes)
        sections["Basses"].sort(key=lambda n: n.start)

    result.parts.extend(orchestral.build_parts(sections))

    if m.percussion is not None:
        hits = percussion.transcribe_drums(m.percussion, sr)
        if hits:
            result.parts.append(
                Part(name="Percussion", program=0, is_drum=True, notes=hits)
            )


# ------------------------------------------------------------------ helpers


def _fill_harmony_notes(part: Part, chords):
    from .events import NoteEvent

    part.notes = []
    for seg in chords:
        for p in seg.pitches:
            part.notes.append(
                NoteEvent(seg.start, seg.end, p, min(seg.strength, 1.0))
            )


def _rebuild_harmony_notes(result: AnalysisResult):
    """After quantization, regenerate chord block notes from the segments."""
    for part in result.parts:
        if part.name == "Harmony":
            _fill_harmony_notes(part, result.chords)
