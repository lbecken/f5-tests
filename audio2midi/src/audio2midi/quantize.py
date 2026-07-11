"""Beat-aware quantization.

Note times are mapped into *beat space* via the tempo map (which follows
tempo drift in the performance), snapped to a subdivision grid, and mapped
back to audio time. The MIDI writer performs the same time->beat conversion
when placing events, so snapped notes land exactly on grid ticks while
playback timing still matches the recording.
"""

from __future__ import annotations

from typing import Iterable, List

import numpy as np

from .events import ChordSegment, NoteEvent
from .tempomap import TempoMap


class Quantizer:
    def __init__(self, beat_times: np.ndarray, bpm: float, grid: int = 16):
        """grid: note value of the grid (16 = sixteenth notes). 0 disables."""
        self.tmap = TempoMap(np.asarray(beat_times, dtype=float), bpm)
        self.grid = grid
        self.div = grid / 4.0 if grid else 0  # subdivisions per beat

    def _snap_beat(self, t: float) -> float:
        beat = self.tmap.time_to_beat(t)
        if self.div:
            beat = round(beat * self.div) / self.div
        return beat

    def map_time(self, t: float) -> float:
        return self.tmap.beat_to_time(self._snap_beat(t))

    def apply_notes(self, notes: Iterable[NoteEvent]) -> List[NoteEvent]:
        out: List[NoteEvent] = []
        for n in notes:
            b_start = self._snap_beat(n.start)
            b_end = self._snap_beat(n.end)
            if b_end <= b_start:
                b_end = b_start + (1.0 / self.div if self.div else 0.25)
            out.append(
                NoteEvent(
                    self.tmap.beat_to_time(b_start),
                    self.tmap.beat_to_time(b_end),
                    n.pitch,
                    n.amplitude,
                    n.bends,
                )
            )
        # Trim overlaps created by snapping same-pitch neighbors together.
        out.sort(key=lambda n: (n.pitch, n.start))
        for prev, cur in zip(out, out[1:]):
            if prev.pitch == cur.pitch and prev.end > cur.start:
                prev.end = cur.start
        out = [n for n in out if n.duration > 1e-3]
        out.sort(key=lambda n: (n.start, n.pitch))
        return out

    def apply_chords(self, chords: Iterable[ChordSegment]) -> List[ChordSegment]:
        out: List[ChordSegment] = []
        for c in chords:
            start = self.map_time(c.start)
            end = self.map_time(c.end)
            if end - start < 1e-3:
                continue
            out.append(ChordSegment(start, end, c.label, list(c.pitches), c.strength))
        # Keep segments contiguous where snapping opened small gaps.
        for prev, cur in zip(out, out[1:]):
            if 0 < self.tmap.time_to_beat(cur.start) - self.tmap.time_to_beat(prev.end) < 0.5:
                prev.end = cur.start
        return out
