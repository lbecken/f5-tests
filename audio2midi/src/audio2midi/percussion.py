"""Percussion transcription: drum-stem onsets to General MIDI drum notes.

Onsets are detected on a combined envelope, then each onset is classified by
the onset-flux profile across three frequency bands (low/mid/high). An onset
may emit several drums at once (kick + hi-hat together is the norm in real
patterns).
"""

from __future__ import annotations

import logging
from typing import List

import numpy as np
from scipy.signal import butter, sosfilt

from .audio_io import to_mono
from .events import NoteEvent

log = logging.getLogger(__name__)

# General MIDI drum map
KICK = 36
SNARE = 38
CLOSED_HAT = 42
CRASH = 49

BANDS = {
    KICK: (20.0, 150.0),
    SNARE: (200.0, 2500.0),
    CLOSED_HAT: (5000.0, 15000.0),
}

HOP = 256


def _bandpass(y: np.ndarray, sr: int, lo: float, hi: float) -> np.ndarray:
    hi = min(hi, sr / 2 - 100)
    sos = butter(4, [lo, hi], btype="band", fs=sr, output="sos")
    return sosfilt(sos, y)


def transcribe_drums(
    y: np.ndarray,
    sr: int,
    band_threshold: float = 0.25,
    merge_window: float = 0.03,
) -> List[NoteEvent]:
    """Detect drum hits in a (drums) stem and map them to GM drum pitches."""
    import librosa

    mono = to_mono(y)
    peak = float(np.max(np.abs(mono), initial=0.0))
    if peak < 1e-4:
        return []
    mono = mono / peak

    # Per-band onset flux from a single mel spectrogram, so band boundaries
    # are exact (no filter roll-off bleed between drums).
    n_mels = 128
    fmax = sr / 2
    S = librosa.feature.melspectrogram(
        y=mono, sr=sr, hop_length=HOP, n_mels=n_mels, fmax=fmax
    )
    mel_f = librosa.mel_frequencies(n_mels=n_mels, fmax=fmax)
    channels = []
    pitches = list(BANDS)
    for pitch in pitches:
        lo, hi = BANDS[pitch]
        idx = np.where((mel_f >= lo) & (mel_f <= hi))[0]
        channels.append(slice(int(idx[0]), int(idx[-1]) + 1))
    multi = librosa.onset.onset_strength_multi(
        S=librosa.power_to_db(S), sr=sr, hop_length=HOP, channels=channels
    )
    envs = {pitch: multi[i] for i, pitch in enumerate(pitches)}

    n_frames = min(len(e) for e in envs.values())
    refs = {}
    all_onsets: List[int] = []
    for pitch, env in envs.items():
        env = env[:n_frames]
        envs[pitch] = env
        # Per-band reference level: a high percentile of the envelope peaks,
        # so one very loud hit doesn't mask the rest of the band.
        peaks = env[env > 0.1 * env.max()] if env.max() > 0 else env
        refs[pitch] = float(np.percentile(peaks, 90)) if len(peaks) else 0.0
        if refs[pitch] <= 0:
            continue
        frames = librosa.onset.onset_detect(
            onset_envelope=env / refs[pitch],
            sr=sr,
            hop_length=HOP,
            backtrack=False,
            delta=0.15,
            normalize=False,
            wait=int(0.05 * sr / HOP),
        )
        all_onsets.extend(int(f) for f in frames)

    if not all_onsets:
        return []

    # Union of the per-band onsets, merging near-coincident candidates.
    merge_frames = max(int(merge_window * sr / HOP), 1)
    onset_frames = []
    for f in sorted(all_onsets):
        if onset_frames and f - onset_frames[-1] <= merge_frames:
            continue
        onset_frames.append(f)

    notes: List[NoteEvent] = []
    onset_times = []
    for f in onset_frames:
        t = float(librosa.frames_to_time(f, sr=sr, hop_length=HOP))
        onset_times.append(t)
        a, b = max(f - 1, 0), min(f + 3, n_frames)
        fluxes = {
            pitch: (float(env[a:b].max()) / refs[pitch] if refs[pitch] > 0 else 0.0)
            for pitch, env in envs.items()
        }
        top = max(fluxes.values())
        if top < band_threshold:
            continue
        for pitch, flux in fluxes.items():
            # Emit the dominant drum, plus any other band that is nearly as
            # strong (real patterns layer kick/snare with hats).
            if flux < band_threshold or flux < 0.6 * top:
                continue
            notes.append(NoteEvent(t, t + 0.1, pitch, min(flux, 1.0)))

    # Crash detection: strong high-band onsets with a long, sustained decay.
    crash_band = None
    for n in notes:
        if n.pitch != CLOSED_HAT or n.amplitude < 0.85:
            continue
        # A decay tail is only meaningful if no other hit lands inside it.
        if any(n.start + 0.12 < t < n.start + 0.62 for t in onset_times):
            continue
        if crash_band is None:
            crash_band = _bandpass(mono, sr, 3000, 12000)
        a = int(n.start * sr)
        head_b = min(a + int(0.05 * sr), len(crash_band))
        tail_a = min(a + int(0.30 * sr), len(crash_band))
        tail_b = min(a + int(0.60 * sr), len(crash_band))
        if head_b <= a or tail_b <= tail_a:
            continue
        head = float(np.sqrt(np.mean(crash_band[a:head_b] ** 2) + 1e-12))
        tail = float(np.sqrt(np.mean(crash_band[tail_a:tail_b] ** 2) + 1e-12))
        if head > 0.02 and tail / head > 0.35:
            n.pitch = CRASH

    # De-duplicate near-coincident hits of the same drum.
    notes.sort(key=lambda n: (n.pitch, n.start))
    deduped: List[NoteEvent] = []
    for n in notes:
        if (
            deduped
            and deduped[-1].pitch == n.pitch
            and n.start - deduped[-1].start < merge_window
        ):
            deduped[-1].amplitude = max(deduped[-1].amplitude, n.amplitude)
            continue
        deduped.append(n)
    deduped.sort(key=lambda n: n.start)
    log.info("Detected %d drum hits", len(deduped))
    return deduped
