"""Audio loading helpers."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Tuple

import numpy as np
import soundfile as sf

log = logging.getLogger(__name__)

WORK_SR = 44100  # everything runs at 44.1 kHz internally (Demucs native rate)


def load_audio(path: str | Path, sr: int = WORK_SR) -> Tuple[np.ndarray, int]:
    """Load an audio file as float32 stereo (2, n_samples) at the given rate.

    Mono files are duplicated to two channels so Demucs can consume them.
    """
    import librosa

    y, file_sr = librosa.load(str(path), sr=sr, mono=False)
    if y.ndim == 1:
        y = np.stack([y, y])
    elif y.shape[0] > 2:
        y = y[:2]
    return np.ascontiguousarray(y.astype(np.float32)), sr


def to_mono(y: np.ndarray) -> np.ndarray:
    """Collapse (channels, n) or (n,) audio to mono (n,)."""
    if y.ndim == 1:
        return y
    return y.mean(axis=0)


def save_wav(path: str | Path, y: np.ndarray, sr: int) -> None:
    """Write audio (channels, n) or (n,) to a wav file."""
    data = y.T if y.ndim == 2 else y
    sf.write(str(path), data, sr)


def energy_ratio(stem: np.ndarray, total: np.ndarray) -> float:
    """RMS energy of a stem relative to the full mix (both mono or stereo)."""
    e_stem = float(np.sqrt(np.mean(to_mono(stem) ** 2)))
    e_total = float(np.sqrt(np.mean(to_mono(total) ** 2)))
    if e_total <= 1e-9:
        return 0.0
    return e_stem / e_total
