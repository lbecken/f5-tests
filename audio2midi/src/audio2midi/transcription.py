"""Polyphonic note transcription.

Two local neural backends:

* ``basic-pitch`` (default) — Spotify's lightweight general-purpose model
  (ICASSP 2022). Outputs note events with onset/offset times, pitch,
  amplitude and per-frame pitch bends. Runs on the ONNX runtime.
* ``piano`` — TransKun v2 (Yan et al., "Skipping the Frame-Level"), a
  piano-specific model trained on MAESTRO with much higher accuracy on
  piano recordings, including per-note MIDI velocities. Installed via the
  ``audio2midi[piano]`` extra; weights ship inside the pip package.
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

BACKENDS = ("basic-pitch", "piano")

_MODEL = None
_PIANO_MODEL = None


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
    backend: str = "basic-pitch",
    device: str = "auto",
) -> List[NoteEvent]:
    """Transcribe (channels, n) or (n,) audio into note events."""
    if backend == "piano":
        return transcribe_piano(y, sr, min_note_len_ms, device)[0]

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


def _get_piano_model(device: str):
    global _PIANO_MODEL
    if _PIANO_MODEL is None:
        try:
            import moduleconf
            import torch
            from importlib import resources
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "The piano transcription backend needs the 'transkun' package. "
                "Install it with: pip install 'audio2midi[piano]'"
            ) from exc

        pretrained = resources.files("transkun") / "pretrained"
        conf = moduleconf.parseFromFile(str(pretrained / "2.0.conf"))
        TransKun = conf["Model"].module.TransKun
        checkpoint = torch.load(
            str(pretrained / "2.0.pt"), map_location=device
        )
        model = TransKun(conf=conf["Model"].config).to(device)
        state = checkpoint.get("best_state_dict") or checkpoint["state_dict"]
        model.load_state_dict(state, strict=False)
        model.eval()
        _PIANO_MODEL = model
        log.info("Loaded TransKun piano model (device=%s)", device)
    return _PIANO_MODEL


def transcribe_piano(
    y: np.ndarray,
    sr: int,
    min_note_len_ms: float = 30.0,
    device: str = "auto",
) -> tuple:
    """Transcribe with the TransKun piano-specific model.

    Returns (notes, pedal_segments) where pedal_segments is a list of
    (start, end) sustain-pedal intervals.
    """
    import torch

    from .separation import resolve_device

    mono = to_mono(y)
    if float(np.max(np.abs(mono), initial=0.0)) < 1e-4:
        return [], []

    dev = resolve_device(device)
    model = _get_piano_model(dev)

    if sr != model.fs:
        import librosa

        mono = librosa.resample(mono, orig_sr=sr, target_sr=model.fs)

    x = torch.from_numpy(np.ascontiguousarray(mono, dtype=np.float32))
    x = x.unsqueeze(-1).to(dev)  # (n_samples, 1) mono
    with torch.no_grad():
        est = model.transcribe(x, discardSecondHalf=False)

    notes: List[NoteEvent] = []
    pedal: List[tuple] = []
    min_len = min_note_len_ms / 1000.0
    for ev in est:
        # TransKun encodes pedals as negative "pitches" (-64 = sustain CC).
        if ev.pitch == -64:
            pedal.append((float(ev.start), float(ev.end)))
            continue
        pitch = int(ev.pitch)
        if not (21 <= pitch <= 108):
            continue
        if ev.end - ev.start < min_len:
            continue
        vel = int(getattr(ev, "velocity", 90)) or 90
        notes.append(
            NoteEvent(
                start=float(ev.start),
                end=float(ev.end),
                pitch=pitch,
                amplitude=float(np.clip(vel / 127.0, 0.0, 1.0)),
            )
        )
    notes.sort(key=lambda n: (n.start, n.pitch))
    pedal.sort()
    log.info(
        "Transcribed %d note events, %d pedal events (piano model)",
        len(notes),
        len(pedal),
    )
    return notes, pedal
