"""Procedurally synthesised, sample-exact audio.

Every sound the player has to *count* or *decode* is made here rather than by a
generative model, because a puzzle answer must be a fact about the file, not a
hope about a prompt. See DESIGN.md §6.
"""
import os

import numpy as np

from common import AUDIO, SR, digest, cached, mark, encode, log, normalise, stereo

RNG = np.random.default_rng(19571031)


def _env(n, attack=0.002, release=0.05):
    e = np.ones(n, np.float32)
    a = max(1, int(attack * SR))
    r = max(1, int(release * SR))
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e


def _sil(sec):
    return np.zeros(int(sec * SR), np.float32)


# ── rotary telephone ───────────────────────────────────────────────────────
def _click(strength=1.0, bright=True):
    """One pulse: the governor-driven contact opening and closing the line."""
    n = int(0.030 * SR)
    t = np.arange(n) / SR
    # a sharp broadband transient with a short metallic ring on top
    noise = RNG.standard_normal(n).astype(np.float32)
    decay = np.exp(-t * (260 if bright else 150)).astype(np.float32)
    ring = np.sin(2 * np.pi * 2100 * t).astype(np.float32) * np.exp(-t * 190)
    body = np.sin(2 * np.pi * 430 * t).astype(np.float32) * np.exp(-t * 90)
    s = (noise * decay * 0.55 + ring * 0.32 + body * 0.28) * strength
    return (s * _env(n, 0.0004, 0.006)).astype(np.float32)


def rotary(digits, pulse_hz=10.0, interdigit=0.78):
    """Pulse dialling. N pulses for digit N, ten pulses for 0.

    Intra-digit spacing is 100 ms and the gap between digits is 780 ms, so the
    grouping is unambiguous by ear even for 9 vs 0.
    """
    out = [_sil(0.35)]
    for d in digits:
        count = 10 if d == "0" else int(d)
        # the finger wheel being wound round, then released
        wind = int(0.11 * SR * count)
        t = np.arange(wind) / SR
        whirr = (RNG.standard_normal(wind).astype(np.float32) * 0.02
                 * np.exp(-t * 1.2)
                 * (0.5 + 0.5 * np.sin(2 * np.pi * 38 * t)))
        out.append(whirr.astype(np.float32))
        out.append(_sil(0.12))
        step = int(SR / pulse_hz)
        seg = np.zeros(step * count + int(0.05 * SR), np.float32)
        for i in range(count):
            c = _click(1.0 if i else 1.12)
            seg[i * step:i * step + len(c)] += c
        out.append(seg)
        out.append(_sil(interdigit))
    out.append(_sil(0.5))
    return np.concatenate(out)


# ── morse ──────────────────────────────────────────────────────────────────
MORSE = {
    "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
    "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
    "A": ".-", "B": "-...", "C": "-.-.", "D": "-..", "E": ".", "F": "..-.",
    "G": "--.", "H": "....", "I": "..", "J": ".---", "K": "-.-", "L": ".-..",
    "M": "--", "N": "-.", "O": "---", "P": ".--.", "Q": "--.-", "R": ".-.",
    "S": "...", "T": "-", "U": "..-", "V": "...-", "W": ".--", "X": "-..-",
    "Y": "-.--", "Z": "--..",
}


def morse(text, wpm=9, freq=5200, repeats=2):
    dot = 1.2 / wpm
    out = [_sil(0.6)]
    for _ in range(repeats):
        for ch in text.upper():
            for sym in MORSE[ch]:
                d = dot * (3 if sym == "-" else 1)
                n = int(d * SR)
                t = np.arange(n) / SR
                tone = np.sin(2 * np.pi * freq * t).astype(np.float32)
                out.append(tone * _env(n, 0.004, 0.008))
                out.append(_sil(dot))          # intra-character gap
            out.append(_sil(dot * 2))          # inter-character gap
        out.append(_sil(dot * 6))              # word gap between repeats
    out.append(_sil(0.6))
    return np.concatenate(out)


# ── misc ───────────────────────────────────────────────────────────────────
def beep(freq=1000, dur=0.45):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * freq * t).astype(np.float32) * _env(n, 0.005, 0.02))


def linenoise(dur=12):
    """Open telephone line: mains hum, a little crosstalk fizz, slow drift."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    hum = (np.sin(2 * np.pi * 60 * t) * 0.5 + np.sin(2 * np.pi * 180 * t) * 0.25
           + np.sin(2 * np.pi * 300 * t) * 0.1).astype(np.float32)
    fizz = RNG.standard_normal(n).astype(np.float32) * 0.35
    # band-limit the fizz to the telephone band with a cheap one-pole pair
    fizz = _onepole_hp(_onepole_lp(fizz, 3200), 320)
    drift = (0.8 + 0.2 * np.sin(2 * np.pi * 0.17 * t)).astype(np.float32)
    return ((hum * 0.12 + fizz * 0.5) * drift).astype(np.float32)


def hiss(dur=12, tilt=6500):
    n = int(dur * SR)
    s = RNG.standard_normal(n).astype(np.float32)
    return _onepole_lp(s, tilt) * 0.6


def _onepole_lp(x, fc):
    """One-pole lowpass as a truncated exponential FIR.

    tau is well under a millisecond at these corner frequencies, so the kernel
    is a few dozen taps and convolution is both exact enough and far quicker
    than an per-sample recurrence in Python.
    """
    a = float(np.exp(-2.0 * np.pi * fc / SR))
    taps = max(2, min(2048, int(np.ceil(-9.0 / np.log(max(a, 1e-9))))))
    k = (1 - a) * a ** np.arange(taps, dtype=np.float32)
    k /= k.sum()
    return np.convolve(x, k, mode="same").astype(np.float32)


def _onepole_hp(x, fc):
    return x - _onepole_lp(x, fc)


# ── build ──────────────────────────────────────────────────────────────────
BUILDERS = {
    "rotary": lambda s: rotary(s["digits"]),
    "morse": lambda s: morse(s["text"], s.get("wpm", 9), s.get("freq", 5200)),
    "beep": lambda s: beep(s.get("freq", 1000), s.get("dur", 0.45)),
    "linenoise": lambda s: linenoise(s.get("dur", 12)),
    "hiss": lambda s: hiss(s.get("dur", 12)),
}


def build_all(spec):
    """spec: {asset_id: {kind: ..., ...}} -> {asset_id: path}"""
    paths = {}
    for aid, s in spec.items():
        path = os.path.join(AUDIO, aid + ".mp3")
        sig = digest("synth-v2", s)
        if not cached(aid, sig, path):
            log("  synth", aid, s["kind"])
            mono = BUILDERS[s["kind"]](s)
            arr = stereo(normalise(mono, 0.85))
            encode(arr, path, bitrate="128k")
            mark(aid, sig)
        paths[aid] = path
    return paths


if __name__ == "__main__":
    import case
    build_all(case.SYNTH)
    log("synth done")
