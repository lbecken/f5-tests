"""Polyphonic note transcription using Spotify's Basic Pitch model.

Basic Pitch is a lightweight neural network (ICASSP 2022) that outputs note
events with onset/offset times, pitch, amplitude and per-frame pitch bends.
It runs locally; here we use the ONNX runtime backend.
"""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path
from typing import List

import numpy as np

from .audio_io import save_wav, to_mono
from .events import NoteEvent

log = logging.getLogger(__name__)

_MODEL = None


def _get_model():
    global _MODEL
    if _MODEL is None:
        from basic_pitch import ICASSP_2022_MODEL_PATH
        from basic_pitch.inference import Model

        _MODEL = Model(ICASSP_2022_MODEL_PATH)
    return _MODEL


def transcribe(
    y: np.ndarray,
    sr: int,
    onset_threshold: float = 0.5,
    frame_threshold: float = 0.3,
    min_note_len_ms: float = 80.0,
    min_freq: float | None = None,
    max_freq: float | None = None,
    include_bends: bool = True,
) -> List[NoteEvent]:
    """Transcribe (channels, n) or (n,) audio into note events."""
    from basic_pitch.inference import predict

    mono = to_mono(y)
    if float(np.max(np.abs(mono), initial=0.0)) < 1e-4:
        return []

    # basic-pitch's predict() consumes a file path, so round-trip via a
    # temporary wav.
    with tempfile.TemporaryDirectory(prefix="a2m_bp_") as tmp:
        wav_path = Path(tmp) / "stem.wav"
        save_wav(wav_path, mono, sr)
        _, _, note_events = predict(
            str(wav_path),
            _get_model(),
            onset_threshold=onset_threshold,
            frame_threshold=frame_threshold,
            minimum_note_length=min_note_len_ms,
            minimum_frequency=min_freq,
            maximum_frequency=max_freq,
            multiple_pitch_bends=False,
            melodia_trick=True,
        )

    notes: List[NoteEvent] = []
    for ev in note_events:
        start, end, pitch, amplitude = ev[0], ev[1], ev[2], ev[3]
        bends = None
        if include_bends and len(ev) > 4 and ev[4] is not None:
            bends = np.asarray(ev[4], dtype=float)
        if end <= start:
            continue
        notes.append(
            NoteEvent(
                start=float(start),
                end=float(end),
                pitch=int(pitch),
                amplitude=float(amplitude),
                bends=bends,
            )
        )
    notes.sort(key=lambda n: (n.start, n.pitch))
    log.info("Transcribed %d note events", len(notes))
    return notes
