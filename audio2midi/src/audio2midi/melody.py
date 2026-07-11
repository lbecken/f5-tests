"""Melody extraction: reduce a polyphonic transcription to a single voice.

The polyphonic note events from Basic Pitch are rasterized onto a fine time
grid; in every frame the most salient active note wins, with a continuity
bonus that keeps the line from jumping between voices. Winning frames are
then merged back into notes.
"""

from __future__ import annotations

import logging
from typing import List, Optional

import numpy as np

from .events import NoteEvent

log = logging.getLogger(__name__)

FRAME = 0.01  # seconds


def monophonic_reduction(
    notes: List[NoteEvent],
    min_pitch: int = 43,   # G2 — below this is almost never the melody
    max_pitch: int = 96,   # C7
    min_duration: float = 0.06,
    max_gap: float = 0.09,  # merge same-pitch fragments across gaps this small
) -> List[NoteEvent]:
    """Pick the single most salient melodic line out of polyphonic notes."""
    cand = [n for n in notes if min_pitch <= n.pitch <= max_pitch]
    if not cand:
        return []

    t_end = max(n.end for n in cand)
    n_frames = int(np.ceil(t_end / FRAME)) + 1
    winner_pitch = np.full(n_frames, -1, dtype=int)
    winner_amp = np.zeros(n_frames)

    # Salience favors louder notes and, mildly, higher pitch (melodies tend
    # to sit on top of the texture).
    order = sorted(cand, key=lambda n: n.start)
    frame_notes: List[List[NoteEvent]] = [[] for _ in range(n_frames)]
    for n in order:
        a = int(n.start / FRAME)
        b = min(int(np.ceil(n.end / FRAME)), n_frames)
        for f in range(a, b):
            frame_notes[f].append(n)

    prev_pitch = -1
    for f in range(n_frames):
        best, best_score = None, -1.0
        for n in frame_notes[f]:
            score = n.amplitude + 0.004 * n.pitch
            if prev_pitch >= 0:
                dp = abs(n.pitch - prev_pitch)
                if dp == 0:
                    score += 0.15
                elif dp <= 2:
                    score += 0.08
                else:
                    # Large leaps are rare in a single melodic voice.
                    score -= min(0.012 * max(dp - 7, 0), 0.30)
            if score > best_score:
                best, best_score = n, score
        if best is not None:
            winner_pitch[f] = best.pitch
            winner_amp[f] = best.amplitude
            prev_pitch = best.pitch

    # Merge consecutive frames into notes.
    out: List[NoteEvent] = []
    f = 0
    while f < n_frames:
        p = winner_pitch[f]
        if p < 0:
            f += 1
            continue
        g = f
        amps = []
        while g < n_frames and winner_pitch[g] == p:
            amps.append(winner_amp[g])
            g += 1
        start, end = f * FRAME, g * FRAME
        # Extend across a short silence if the same pitch resumes.
        out.append(NoteEvent(start, end, int(p), float(np.mean(amps))))
        f = g

    # Merge same-pitch neighbors separated by tiny gaps, then drop fragments.
    merged: List[NoteEvent] = []
    for n in out:
        if (
            merged
            and merged[-1].pitch == n.pitch
            and n.start - merged[-1].end <= max_gap
        ):
            merged[-1].end = n.end
            merged[-1].amplitude = max(merged[-1].amplitude, n.amplitude)
        else:
            merged.append(n)
    result = [n for n in merged if n.duration >= min_duration]
    log.info("Melody reduction: %d -> %d notes", len(notes), len(result))
    return result


def pick_melody_source(
    stems: dict,
    source: str = "auto",
    vocal_ratio_threshold: float = 0.10,
) -> tuple[np.ndarray, str]:
    """Choose which separated stem carries the melody.

    Returns (audio, description). "auto" uses the vocal stem when it holds a
    meaningful share of the mix energy, otherwise the lead falls back to the
    'other' (instruments) stem.
    """
    from .audio_io import energy_ratio
    from .separation import mix_stems

    total = np.sum(list(stems.values()), axis=0)
    if source == "vocals":
        return stems["vocals"], "vocals"
    if source == "instrumental":
        return stems["other"], "other (instrumental lead)"

    v_ratio = energy_ratio(stems["vocals"], total)
    log.info("Vocal energy ratio: %.3f", v_ratio)
    if v_ratio >= vocal_ratio_threshold:
        return stems["vocals"], "vocals"
    return mix_stems(stems, ["other"]), "other (instrumental lead)"
