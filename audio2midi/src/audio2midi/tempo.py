"""Tempo (BPM) and beat detection."""

from __future__ import annotations

import logging
from typing import Optional, Tuple

import numpy as np

log = logging.getLogger(__name__)


def detect_tempo(
    y_mono: np.ndarray,
    sr: int,
    bpm_override: Optional[float] = None,
) -> Tuple[float, np.ndarray]:
    """Estimate the global tempo and beat positions of a recording.

    Returns (bpm, beat_times). When ``bpm_override`` is given the detected
    beat grid is still used to anchor the first beat, but the BPM value is
    the caller's.
    """
    import librosa

    onset_env = librosa.onset.onset_strength(y=y_mono, sr=sr, aggregate=np.median)
    # tightness=25 lets the tracker follow tempo changes/rubato; at steady
    # tempo it stays as stable as the rigid default.
    tempo, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_env, sr=sr, trim=False, tightness=25
    )
    tempo = float(np.atleast_1d(tempo)[0])
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    if len(beat_times) < 2:
        # Degenerate input (silence / very short) — fall back to a flat grid.
        bpm = bpm_override or (tempo if tempo > 0 else 120.0)
        duration = len(y_mono) / sr
        beat_times = np.arange(0.0, max(duration, 1.0), 60.0 / bpm)
        log.warning("Too few beats detected; using a uniform %.1f BPM grid", bpm)
        return bpm, beat_times

    if bpm_override:
        # Rebuild a uniform grid at the requested tempo anchored on the
        # first detected beat.
        period = 60.0 / bpm_override
        duration = len(y_mono) / sr
        start = float(beat_times[0]) % period
        beat_times = np.arange(start, duration + period, period)
        return float(bpm_override), beat_times

    # Refine the BPM from the median inter-beat interval, which is more
    # stable than the raw tempo estimate.
    ibis = np.diff(beat_times)
    if len(ibis) >= 4:
        refined = 60.0 / float(np.median(ibis))
        if 0.9 < refined / tempo < 1.1 or tempo <= 0:
            tempo = refined

    return round(tempo, 2), beat_times
