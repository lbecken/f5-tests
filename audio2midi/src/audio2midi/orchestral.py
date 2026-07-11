"""Orchestral mode: partition a polyphonic transcription into sections.

There is currently no production-grade open pretrained model that separates
an orchestral recording into woodwind/brass/string/percussion stems (it is
an active research area — see SynthSOD / X-UMX family work). This module
therefore classifies each *transcribed note* into a section using a
combination of:

  * register priors (piccolo/flute territory vs. bass territory),
  * per-note timbre features measured on the spectrogram at the note's
    time-frequency location (harmonic centroid, odd/even harmonic balance,
    attack sharpness),
  * vibrato depth taken from Basic Pitch's per-note pitch-bend track
    (sustained vibrato is a strong string-section cue).

It is a heuristic, and is documented as such; the separation seam is kept
narrow so a dedicated orchestral separation model can be plugged in later.
"""

from __future__ import annotations

import logging
from typing import Dict, List

import numpy as np

from .audio_io import to_mono
from .events import NoteEvent, Part

log = logging.getLogger(__name__)

SECTIONS = {
    "Woodwinds": 73,      # Flute
    "Brass": 61,          # Brass Section
    "Strings (high)": 48, # String Ensemble 1
    "Strings (low)": 42,  # Cello
    "Basses": 43,         # Contrabass
}


class _TimbreAnalyzer:
    """Extracts per-note timbre features from one audio signal."""

    def __init__(self, y: np.ndarray, sr: int, n_fft: int = 4096, hop: int = 512):
        import librosa

        self.sr = sr
        self.n_fft = n_fft
        self.hop = hop
        mono = to_mono(y)
        self.S = np.abs(librosa.stft(mono, n_fft=n_fft, hop_length=hop))
        self.freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)

    def _harmonic_energies(self, f0: float, fa: int, fb: int, n_harm: int = 8):
        energies = []
        for k in range(1, n_harm + 1):
            f = f0 * k
            if f >= self.freqs[-1]:
                break
            bin_c = int(round(f / (self.sr / self.n_fft)))
            a, b = max(bin_c - 2, 0), min(bin_c + 3, self.S.shape[0])
            energies.append(float(self.S[a:b, fa:fb].max(axis=0).mean()))
        return np.array(energies)

    def features(self, note: NoteEvent) -> Dict[str, float]:
        import librosa

        f0 = librosa.midi_to_hz(note.pitch)
        fa = int(note.start * self.sr / self.hop)
        fb = max(fa + 2, int(note.end * self.sr / self.hop))
        fb = min(fb, self.S.shape[1])
        fa = min(fa, fb - 1)

        # Skip the attack transient when measuring the sustain spectrum.
        sustain_a = min(fa + max(1, int(0.04 * self.sr / self.hop)), fb - 1)
        h = self._harmonic_energies(f0, sustain_a, fb)
        if len(h) < 2 or h.sum() <= 1e-9:
            return {"centroid_ratio": 2.0, "odd_even": 1.0, "attack": 0.1}

        ks = np.arange(1, len(h) + 1)
        centroid_ratio = float((ks * h).sum() / h.sum())
        odd = h[0::2].sum()
        even = h[1::2].sum() + 1e-9
        odd_even = float(odd / even)

        # Attack time: how quickly the note's fundamental reaches its peak.
        bin_c = int(round(f0 / (self.sr / self.n_fft)))
        a, b = max(bin_c - 2, 0), min(bin_c + 3, self.S.shape[0])
        env = self.S[a:b, fa:fb].max(axis=0)
        peak_idx = int(env.argmax()) if len(env) else 0
        attack = peak_idx * self.hop / self.sr

        return {
            "centroid_ratio": centroid_ratio,
            "odd_even": odd_even,
            "attack": attack,
        }


def _vibrato_depth(note: NoteEvent) -> float:
    if note.bends is None or len(note.bends) < 8:
        return 0.0
    return float(np.std(np.asarray(note.bends, dtype=float)))


def classify_notes(
    notes: List[NoteEvent],
    y: np.ndarray,
    sr: int,
    strategy: str = "timbre",
) -> Dict[str, List[NoteEvent]]:
    """Assign each note to an orchestral section name."""
    sections: Dict[str, List[NoteEvent]] = {name: [] for name in SECTIONS}
    if not notes:
        return sections

    analyzer = _TimbreAnalyzer(y, sr) if strategy == "timbre" else None

    for n in notes:
        if n.pitch < 41:  # below F2
            sections["Basses"].append(n)
            continue
        if n.pitch >= 84 and strategy == "register":  # C6+
            sections["Woodwinds"].append(n)
            continue

        if strategy == "register":
            if n.pitch >= 60:
                sections["Strings (high)"].append(n)
            elif n.pitch >= 48:
                sections["Brass"].append(n)
            else:
                sections["Strings (low)"].append(n)
            continue

        f = analyzer.features(n)
        vib = _vibrato_depth(n)

        scores = {
            # Brass: bright sustain spectrum, fast-ish attack, little vibrato.
            "Brass": (
                1.2 * _sigmoid(f["centroid_ratio"] - 3.0)
                + 0.5 * _sigmoid(0.08 - f["attack"], scale=25)
                - 0.6 * _sigmoid(vib - 0.12, scale=15)
            ),
            # Woodwinds: darker spectrum (few strong harmonics) or clarinet-like
            # odd-harmonic dominance; favored in the top register.
            "Woodwinds": (
                1.0 * _sigmoid(2.2 - f["centroid_ratio"])
                + 0.5 * _sigmoid(f["odd_even"] - 2.5)
                + 0.6 * _sigmoid(n.pitch - 81, scale=0.4)
            ),
            # Strings: moderate brightness, slower attack, vibrato.
            "Strings (high)": (
                0.6 * _sigmoid(f["attack"] - 0.06, scale=25)
                + 0.9 * _sigmoid(vib - 0.08, scale=15)
                + 0.4 * _gauss(f["centroid_ratio"], 2.8, 1.2)
            ),
        }
        best = max(scores, key=scores.get)
        if best == "Strings (high)" and n.pitch < 55:  # below G3
            best = "Strings (low)"
        sections[best].append(n)

    for name, sec_notes in sections.items():
        log.info("Section %-14s %4d notes", name, len(sec_notes))
    return sections


def _sigmoid(x: float, scale: float = 2.0) -> float:
    return float(1.0 / (1.0 + np.exp(-scale * x)))


def _gauss(x: float, mu: float, sigma: float) -> float:
    return float(np.exp(-0.5 * ((x - mu) / sigma) ** 2))


def build_parts(sections: Dict[str, List[NoteEvent]]) -> List[Part]:
    parts = []
    for name, notes in sections.items():
        if not notes:
            continue
        parts.append(Part(name=name, program=SECTIONS[name], notes=notes))
    return parts
