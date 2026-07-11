"""Core data structures shared across the pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

import numpy as np


@dataclass
class NoteEvent:
    """A single transcribed note in absolute time (seconds)."""

    start: float
    end: float
    pitch: int          # MIDI note number
    amplitude: float    # 0..1 salience/energy from the transcriber
    bends: Optional[np.ndarray] = None  # per-frame pitch bend, in semitone cents/100

    @property
    def duration(self) -> float:
        return self.end - self.start


@dataclass
class Part:
    """One output MIDI track."""

    name: str
    program: int = 0            # General MIDI program number
    is_drum: bool = False
    notes: List[NoteEvent] = field(default_factory=list)
    pedal: List[tuple] = field(default_factory=list)  # (start, end) sustain


@dataclass
class ChordSegment:
    """A detected chord spanning a time interval."""

    start: float
    end: float
    label: str          # e.g. "Cm", "F", "G7", "N" for no-chord
    pitches: List[int] = field(default_factory=list)  # MIDI pitches of the voicing
    strength: float = 1.0


@dataclass
class AnalysisResult:
    """Everything the pipeline produces before MIDI assembly."""

    bpm: float
    beat_times: np.ndarray
    parts: List[Part] = field(default_factory=list)
    chords: List[ChordSegment] = field(default_factory=list)


def amplitude_to_velocity(amp: float, lo: int = 32, hi: int = 112) -> int:
    """Map a 0..1 amplitude to a MIDI velocity."""
    amp = float(np.clip(amp, 0.0, 1.0))
    return int(round(lo + amp * (hi - lo)))


def normalize_amplitudes(notes: List[NoteEvent]) -> None:
    """Rescale note amplitudes in-place so the 95th percentile maps to 1.0."""
    if not notes:
        return
    amps = np.array([n.amplitude for n in notes], dtype=float)
    ref = np.percentile(amps, 95)
    if ref <= 1e-9:
        return
    for n in notes:
        n.amplitude = float(np.clip(n.amplitude / ref, 0.0, 1.0))
