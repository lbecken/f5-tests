"""Beat-aware quantization.

Note times are mapped into *beat space* via the detected beat positions
(which follows tempo drift in the performance), snapped to a subdivision
grid, and re-emitted on a constant-BPM timeline. The result lines up with
bars and beats when opened in a DAW or notation software.
"""

from __future__ import annotations

from typing import Iterable, List

import numpy as np

from .events import ChordSegment, NoteEvent


class Quantizer:
    def __init__(self, beat_times: np.ndarray, bpm: float, grid: int = 16):
        """grid: note value of the grid (16 = sixteenth notes). 0 disables."""
        self.bpm = bpm
        self.grid = grid
        self.div = grid / 4.0 if grid else 0  # subdivisions per beat
        beat_times = np.asarray(beat_times, dtype=float)
        if len(beat_times) < 2:
            period = 60.0 / bpm
            beat_times = np.array([0.0, period])
        self.beat_times = beat_times
        self.beat_idx = np.arange(len(beat_times), dtype=float)
        self.period = 60.0 / bpm

    def _time_to_beat(self, t: float) -> float:
        bt = self.beat_times
        if t <= bt[0]:
            return (t - bt[0]) / self.period
        if t >= bt[-1]:
            last_period = bt[-1] - bt[-2]
            return (len(bt) - 1) + (t - bt[-1]) / last_period
        return float(np.interp(t, bt, self.beat_idx))

    def map_time(self, t: float, snap: bool = True) -> float:
        """Map an audio time to the constant-tempo output timeline."""
        beat = self._time_to_beat(t)
        if snap and self.div:
            beat = round(beat * self.div) / self.div
        return max(beat * self.period, 0.0)

    def apply_notes(self, notes: Iterable[NoteEvent]) -> List[NoteEvent]:
        out: List[NoteEvent] = []
        min_len = (self.period / self.div) * 0.9 if self.div else 0.05
        for n in notes:
            start = self.map_time(n.start)
            end = self.map_time(n.end)
            if end - start < 1e-3:
                end = start + max(min_len, 0.05)
            out.append(NoteEvent(start, end, n.pitch, n.amplitude, n.bends))
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
        # Keep segments contiguous where they were contiguous before.
        for prev, cur in zip(out, out[1:]):
            if 0 < cur.start - prev.end < self.period / 2:
                prev.end = cur.start
        return out
