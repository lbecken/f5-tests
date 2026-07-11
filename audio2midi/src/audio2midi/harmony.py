"""Chord (harmony) detection.

CQT chroma features are computed on the harmonic component, aggregated per
beat, matched against chord templates and smoothed with Viterbi decoding so
labels don't flicker between frames.
"""

from __future__ import annotations

import logging
from typing import List

import numpy as np

from .audio_io import to_mono
from .events import ChordSegment

log = logging.getLogger(__name__)

PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def _build_templates(vocab: str):
    """Return (labels, template matrix, interval sets)."""
    qualities = {
        "": [0, 4, 7],        # major
        "m": [0, 3, 7],       # minor
    }
    if vocab == "sevenths":
        qualities.update(
            {
                "7": [0, 4, 7, 10],     # dominant 7
                "maj7": [0, 4, 7, 11],
                "m7": [0, 3, 7, 10],
            }
        )
    labels, templates, intervals = [], [], []
    for root in range(12):
        for suffix, ivs in qualities.items():
            vec = np.zeros(12)
            for k, iv in enumerate(ivs):
                # Root and fifth carry a bit more weight than color tones.
                vec[(root + iv) % 12] = 1.0 if k in (0, 2) else 0.85
            vec /= np.linalg.norm(vec)
            labels.append(PITCH_CLASSES[root] + suffix)
            templates.append(vec)
            intervals.append([(root + iv) % 12 for iv in ivs])
    # No-chord state.
    labels.append("N")
    templates.append(np.full(12, 1.0 / np.sqrt(12)))
    intervals.append([])
    return labels, np.array(templates), intervals


def _viterbi(log_obs: np.ndarray, self_bias: float = 8.0) -> np.ndarray:
    """Max-likelihood state path with a sticky self-transition prior.

    log_obs: (n_frames, n_states) log observation scores.
    """
    n_frames, n_states = log_obs.shape
    stay = np.log(self_bias)
    delta = log_obs[0].copy()
    psi = np.zeros((n_frames, n_states), dtype=int)
    for t in range(1, n_frames):
        # Transition score: staying earns +stay, moving earns 0.
        move_best = delta.max()
        move_from = int(delta.argmax())
        for s in range(n_states):
            stay_score = delta[s] + stay
            if stay_score >= move_best:
                psi[t, s] = s
                new = stay_score
            else:
                psi[t, s] = move_from
                new = move_best
            log_obs[t, s] += new
        delta = log_obs[t]
    path = np.zeros(n_frames, dtype=int)
    path[-1] = int(delta.argmax())
    for t in range(n_frames - 2, -1, -1):
        path[t] = psi[t + 1, path[t + 1]]
    return path


def detect_chords(
    y: np.ndarray,
    sr: int,
    beat_times: np.ndarray,
    vocab: str = "triads",
    subdivide: int = 2,
) -> List[ChordSegment]:
    """Detect a chord label per (half-)beat and merge repeats into segments."""
    import librosa

    mono = to_mono(y)
    if float(np.max(np.abs(mono), initial=0.0)) < 1e-4:
        return []

    hop = 512
    y_harm = librosa.effects.harmonic(mono, margin=4)
    chroma = librosa.feature.chroma_cqt(y=y_harm, sr=sr, hop_length=hop)
    import scipy.ndimage

    chroma = scipy.ndimage.median_filter(chroma, size=(1, 5))
    rms = librosa.feature.rms(y=y_harm, hop_length=hop)[0]

    # Build analysis boundaries at beat subdivisions.
    if len(beat_times) < 2:
        duration = len(mono) / sr
        beat_times = np.linspace(0, duration, max(int(duration * 2), 2))
    bounds = []
    for i in range(len(beat_times) - 1):
        for k in range(subdivide):
            bounds.append(
                beat_times[i] + (beat_times[i + 1] - beat_times[i]) * k / subdivide
            )
    bounds.append(beat_times[-1])
    duration = len(mono) / sr
    if duration > beat_times[-1] + 0.2:
        bounds.append(duration)
    bounds = np.array(bounds)

    labels, templates, intervals = _build_templates(vocab)
    frames = librosa.time_to_frames(bounds, sr=sr, hop_length=hop)
    frames = np.clip(frames, 0, chroma.shape[1])

    obs, seg_energy = [], []
    for i in range(len(bounds) - 1):
        a, b = frames[i], max(frames[i] + 1, frames[i + 1])
        v = chroma[:, a:b].mean(axis=1)
        e = float(rms[a : min(b, len(rms))].mean()) if a < len(rms) else 0.0
        seg_energy.append(e)
        norm = np.linalg.norm(v)
        v = v / norm if norm > 1e-9 else np.full(12, 1.0 / np.sqrt(12))
        sims = templates @ v  # cosine similarity per chord state
        obs.append(sims)
    obs = np.array(obs)

    # Silence should decode as no-chord: boost N where energy is negligible.
    energy_floor = max(np.max(seg_energy, initial=0.0) * 0.05, 1e-5)
    for i, e in enumerate(seg_energy):
        if e < energy_floor:
            obs[i, :-1] *= 0.5
            obs[i, -1] = 1.0

    log_obs = np.log(np.maximum(obs, 1e-6) ** 6)  # sharpen
    path = _viterbi(log_obs)

    segments: List[ChordSegment] = []
    for i, state in enumerate(path):
        label = labels[state]
        start, end = float(bounds[i]), float(bounds[i + 1])
        if segments and segments[-1].label == label:
            segments[-1].end = end
            continue
        segments.append(
            ChordSegment(start, end, label, strength=float(np.max(obs[i])))
        )

    segments = [s for s in segments if s.label != "N"]
    for seg in segments:
        seg.pitches = _voice_chord(seg.label, labels, intervals)
    log.info("Detected %d chord segments", len(segments))
    return segments


def _voice_chord(label: str, labels: list, intervals: list) -> List[int]:
    """Voice a chord label: bass root + close-position chord around middle C."""
    idx = labels.index(label)
    ivs = intervals[idx]
    if not ivs:
        return []
    root_pc = ivs[0]
    bass = 36 + root_pc          # C2..B2
    chord_root = 60 + root_pc - (12 if root_pc > 6 else 0)  # keep near C4
    pitches = [bass]
    prev = chord_root - 1
    for iv in ivs:
        p = chord_root + ((iv - ivs[0]) % 12)
        while p <= prev:
            p += 12
        pitches.append(p)
        prev = p
    return pitches
