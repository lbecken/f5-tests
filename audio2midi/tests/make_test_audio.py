"""Generate synthetic test audio with known ground truth.

Produces a 16-bar "song" at 120 BPM: a saw-wave melody, triangle-wave pad
chords (C - Am - F - G), a sine-kick / noise-snare / noise-hat drum pattern
and a simple bass line. Used by the smoke tests to validate the pipeline
end to end without shipping copyrighted audio.
"""

from __future__ import annotations

import sys

import numpy as np
import soundfile as sf

SR = 44100
BPM = 120.0
BEAT = 60.0 / BPM

# C major / A minor progression, one chord per bar (4 beats)
PROGRESSION = [
    ("C", [48, 60, 64, 67]),
    ("Am", [45, 57, 60, 64]),
    ("F", [41, 53, 57, 60]),
    ("G", [43, 55, 59, 62]),
]

# Melody: quarter notes, staying in-key above the pads
MELODY = [72, 74, 76, 79, 76, 74, 72, 69, 69, 72, 74, 77, 74, 72, 71, 67]


def midi_hz(p):
    return 440.0 * 2 ** ((p - 69) / 12)


def adsr(n, sr, a=0.01, d=0.08, s=0.7, r=0.05):
    env = np.ones(n) * s
    na, nd, nr = int(a * sr), int(d * sr), int(r * sr)
    na, nd, nr = min(na, n), min(nd, max(n - na, 0)), min(nr, n)
    env[:na] = np.linspace(0, 1, na, endpoint=False)
    env[na : na + nd] = np.linspace(1, s, nd, endpoint=False)
    if nr:
        env[-nr:] *= np.linspace(1, 0, nr)
    return env


def saw(f, t):
    return 2 * (t * f - np.floor(0.5 + t * f))


def tri(f, t):
    return 2 * np.abs(saw(f, t)) - 1


def render(n_bars=4, with_drums=True, with_vocal_band=False):
    total = int(n_bars * 4 * BEAT * SR)
    mix = np.zeros(total)

    # Pads (chords), one per bar
    for bar in range(n_bars):
        _, pitches = PROGRESSION[bar % len(PROGRESSION)]
        start = int(bar * 4 * BEAT * SR)
        n = int(4 * BEAT * SR)
        t = np.arange(n) / SR
        seg = sum(tri(midi_hz(p), t) for p in pitches[1:]) / len(pitches)
        seg += 0.6 * np.sin(2 * np.pi * midi_hz(pitches[0]) * t) / len(pitches)
        mix[start : start + n] += 0.35 * seg * adsr(n, SR, a=0.02, r=0.2)

    # Melody: one note per beat
    for i, pitch in enumerate(MELODY[: n_bars * 4]):
        start = int(i * BEAT * SR)
        n = int(BEAT * 0.9 * SR)
        t = np.arange(n) / SR
        vib = 1 + 0.003 * np.sin(2 * np.pi * 5.5 * t)
        seg = saw(midi_hz(pitch) * vib, t)
        mix[start : start + n] += 0.30 * seg * adsr(n, SR, a=0.015, r=0.08)

    if with_drums:
        for beat in range(n_bars * 4):
            start = int(beat * BEAT * SR)
            # Kick on 1 and 3
            if beat % 2 == 0:
                n = int(0.12 * SR)
                t = np.arange(n) / SR
                f = 110 * np.exp(-t * 30) + 45
                mix[start : start + n] += 0.9 * np.sin(
                    2 * np.pi * np.cumsum(f) / SR
                ) * np.exp(-t * 22)
            # Snare on 2 and 4
            else:
                n = int(0.10 * SR)
                t = np.arange(n) / SR
                noise = np.random.default_rng(beat).normal(0, 1, n)
                tone = np.sin(2 * np.pi * 190 * t)
                mix[start : start + n] += 0.5 * (0.6 * noise + 0.4 * tone) * np.exp(
                    -t * 35
                )
            # Hats on eighth notes
            for sub in (0, 0.5):
                hstart = int((beat + sub) * BEAT * SR)
                n = int(0.03 * SR)
                noise = np.random.default_rng(1000 + beat).normal(0, 1, n)
                # crude highpass: difference
                noise = np.diff(noise, prepend=0.0)
                if hstart + n < total:
                    mix[hstart : hstart + n] += 0.18 * noise * np.exp(
                        -np.arange(n) / SR * 90
                    )

    mix /= max(np.max(np.abs(mix)), 1e-9) / 0.85
    return mix.astype(np.float32)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "test_song.wav"
    bars = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    audio = render(n_bars=bars)
    sf.write(out, audio, SR)
    print(f"Wrote {out}: {len(audio)/SR:.1f}s at {BPM:.0f} BPM, {bars} bars")
