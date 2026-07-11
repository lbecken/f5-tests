"""Source separation via Demucs (htdemucs).

Splits a mix into four stems: vocals, drums, bass, other. Model weights are
downloaded automatically on first use (to the torch hub cache).
"""

from __future__ import annotations

import logging
from typing import Dict

import numpy as np

log = logging.getLogger(__name__)

STEM_NAMES = ("drums", "bass", "other", "vocals")


def resolve_device(device: str = "auto") -> str:
    import torch

    if device == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"
    return device


def _load_model(model_name: str):
    """Load a pretrained Demucs model (weights download on first use)."""
    from demucs.pretrained import get_model

    return get_model(model_name)


def separate(
    y_stereo: np.ndarray,
    sr: int,
    model_name: str = "htdemucs",
    device: str = "auto",
    model=None,
) -> Dict[str, np.ndarray]:
    """Run Demucs on (2, n) float32 audio, returning stem name -> (2, n) audio.

    The input must already be at the model's sample rate (44100 for htdemucs).
    ``model`` lets callers/tests inject an already-loaded model.
    """
    import torch
    from demucs.apply import apply_model

    dev = resolve_device(device)
    if model is None:
        log.info("Loading Demucs model '%s' (device=%s)...", model_name, dev)
        model = _load_model(model_name)
    model.eval()

    if sr != model.samplerate:
        raise ValueError(
            f"Demucs expects {model.samplerate} Hz audio, got {sr}"
        )

    wav = torch.from_numpy(y_stereo)
    # Normalize as demucs.separate does, then restore scale afterwards.
    ref = wav.mean(0)
    mean, std = ref.mean(), ref.std() + 1e-8
    wav_norm = (wav - mean) / std

    with torch.no_grad():
        sources = apply_model(
            model,
            wav_norm[None],
            device=dev,
            shifts=1,
            split=True,
            overlap=0.25,
            progress=False,
        )[0]
    sources = sources * std + mean

    stems = {
        name: sources[i].cpu().numpy().astype(np.float32)
        for i, name in enumerate(model.sources)
    }
    log.info("Separation done: %s", ", ".join(stems))
    return stems


def mix_stems(stems: Dict[str, np.ndarray], names) -> np.ndarray:
    """Sum a subset of stems back into one signal."""
    selected = [stems[n] for n in names if n in stems]
    if not selected:
        raise KeyError(f"None of {names} present in stems {list(stems)}")
    return np.sum(selected, axis=0).astype(np.float32)
