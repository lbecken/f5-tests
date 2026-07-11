"""Tempo map: bidirectional mapping between audio time and beat position.

Built from the detected beat times, which follow the performance's tempo
drift. The MIDI writer places events at their *beat* position and emits
``set_tempo`` changes per beat (deduplicated), so the output plays back at
the recording's actual pace while bars stay aligned to the grid.
"""

from __future__ import annotations

from typing import List, Tuple

import numpy as np


class TempoMap:
    def __init__(self, beat_times: np.ndarray, fallback_bpm: float = 120.0):
        beat_times = np.asarray(beat_times, dtype=float)
        if len(beat_times) < 2:
            period = 60.0 / fallback_bpm
            start = float(beat_times[0]) if len(beat_times) else 0.0
            beat_times = np.array([start, start + period])
        self.beat_times = beat_times
        self.beat_idx = np.arange(len(beat_times), dtype=float)
        self.fallback_bpm = fallback_bpm

    @classmethod
    def constant(cls, bpm: float, duration: float) -> "TempoMap":
        period = 60.0 / bpm
        n = max(int(np.ceil(duration / period)) + 1, 2)
        return cls(np.arange(n) * period, bpm)

    @property
    def average_bpm(self) -> float:
        span = self.beat_times[-1] - self.beat_times[0]
        if span <= 0:
            return self.fallback_bpm
        return 60.0 * (len(self.beat_times) - 1) / span

    def time_to_beat(self, t: float) -> float:
        bt = self.beat_times
        if t <= bt[0]:
            return (t - bt[0]) / (bt[1] - bt[0])
        if t >= bt[-1]:
            return (len(bt) - 1) + (t - bt[-1]) / (bt[-1] - bt[-2])
        return float(np.interp(t, bt, self.beat_idx))

    def beat_to_time(self, b: float) -> float:
        bt = self.beat_times
        if b <= 0:
            return float(bt[0] + b * (bt[1] - bt[0]))
        if b >= len(bt) - 1:
            return float(bt[-1] + (b - (len(bt) - 1)) * (bt[-1] - bt[-2]))
        return float(np.interp(b, self.beat_idx, bt))

    def tempo_events(
        self, smooth: int = 5, threshold: float = 0.03
    ) -> List[Tuple[float, float]]:
        """Tempo change points as (beat_position, seconds_per_beat).

        Inter-beat intervals are median-smoothed, and a new event is emitted
        only when the tempo moves more than ``threshold`` (relative) — so
        beat-tracker jitter doesn't become hundreds of micro tempo changes.
        Each event's tempo is the median of the beats ahead of it, which
        keeps single outlier intervals (edge effects, fill bars) from
        becoming tempo levels of their own.
        """
        import scipy.ndimage

        ibis = np.diff(self.beat_times)
        ibis = ibis[ibis > 0]
        if len(ibis) == 0:
            return [(0.0, 60.0 / self.fallback_bpm)]
        if len(ibis) >= smooth:
            ibis = scipy.ndimage.median_filter(ibis, size=smooth, mode="nearest")

        def level(i: int) -> float:
            return float(np.median(ibis[i : i + max(smooth, 3)]))

        events: List[Tuple[float, float]] = [(0.0, level(0))]
        current = events[0][1]
        for i, ibi in enumerate(ibis):
            if abs(ibi - current) / current > threshold:
                new = level(i)
                if abs(new - current) / current > threshold:
                    events.append((float(i), new))
                    current = new
        return events
