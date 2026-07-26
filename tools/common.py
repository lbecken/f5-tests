"""Shared plumbing: paths, content-hash caching, ffmpeg helpers, PCM I/O."""
import hashlib
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, "game")
AUDIO = os.path.join(GAME, "assets", "audio")
IMG = os.path.join(GAME, "assets", "img")
WORK = os.path.join(ROOT, ".build")          # intermediate, git-ignored
RAW = os.path.join(WORK, "raw")              # unprocessed API output
CACHE = os.path.join(WORK, "cache.json")

SR = 44100

for d in (GAME, AUDIO, IMG, WORK, RAW):
    os.makedirs(d, exist_ok=True)


# ── cache ──────────────────────────────────────────────────────────────────
def _load_cache():
    if os.path.exists(CACHE):
        with open(CACHE) as f:
            return json.load(f)
    return {}


_cache = _load_cache()


_cache_lock = __import__("threading").Lock()


def save_cache():
    with open(CACHE + ".tmp", "w") as f:
        json.dump(_cache, f, indent=1, sort_keys=True)
    os.replace(CACHE + ".tmp", CACHE)   # atomic; generation runs concurrently


def digest(*parts):
    h = hashlib.sha256()
    for p in parts:
        h.update(repr(p).encode())
    return h.hexdigest()[:16]


def cached(key, sig, path):
    """True if `path` exists and was built from this exact signature."""
    return _cache.get(key) == sig and os.path.exists(path)


def mark(key, sig):
    with _cache_lock:
        _cache[key] = sig
        save_cache()


def log(*a):
    print(*a, file=sys.stderr, flush=True)


# ── ffmpeg ─────────────────────────────────────────────────────────────────
def run(cmd, **kw):
    p = subprocess.run(cmd, capture_output=True, **kw)
    if p.returncode != 0:
        raise RuntimeError(
            "command failed: %s\n%s" % (" ".join(cmd[:12]), p.stderr.decode()[-2500:]))
    return p


def decode(path, filters=None, sr=SR):
    """Decode any audio file to a float32 (n, 2) numpy array, optionally
    running an ffmpeg filter chain first."""
    cmd = ["ffmpeg", "-v", "error", "-i", path]
    if filters:
        cmd += ["-af", filters]
    cmd += ["-f", "f32le", "-acodec", "pcm_f32le", "-ac", "2", "-ar", str(sr), "-"]
    out = run(cmd).stdout
    a = np.frombuffer(out, dtype="<f4")
    if a.size % 2:
        a = a[:-1]
    return a.reshape(-1, 2).astype(np.float32).copy()


def encode(arr, path, bitrate="112k", full_stereo=False, sr=SR):
    """Write a float32 (n, 2) array to mp3."""
    arr = np.clip(arr, -1.0, 1.0).astype("<f4")
    cmd = ["ffmpeg", "-v", "error", "-y",
           "-f", "f32le", "-ar", str(sr), "-ac", "2", "-i", "-"]
    if full_stereo:
        # preserve hard-panned channel independence for the stereo puzzles
        cmd += ["-joint_stereo", "0"]
    cmd += ["-c:a", "libmp3lame", "-b:a", bitrate, path]
    run(cmd, input=arr.tobytes())
    return path


def filter_to_file(src, dst, filters, bitrate="112k"):
    run(["ffmpeg", "-v", "error", "-y", "-i", src, "-af", filters,
         "-c:a", "libmp3lame", "-b:a", bitrate, dst])
    return dst


def duration(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "csv=p=0", path]).stdout.decode().strip()
    return float(out)


# ── small dsp helpers ──────────────────────────────────────────────────────
def db(x):
    return 10.0 ** (x / 20.0)


def stereo(mono):
    return np.repeat(mono.reshape(-1, 1), 2, axis=1).astype(np.float32)


def pan_gains(p):
    """Constant-power pan. p in [-1, 1]."""
    p = float(np.clip(p, -1.0, 1.0))
    ang = (p + 1.0) * (np.pi / 4.0)
    return float(np.cos(ang)), float(np.sin(ang))


def tile_to(arr, n):
    if len(arr) == 0:
        return np.zeros((n, 2), np.float32)
    reps = int(np.ceil(n / len(arr)))
    return np.tile(arr, (reps, 1))[:n]


def normalise(arr, peak=0.89):
    m = float(np.max(np.abs(arr))) if arr.size else 0.0
    if m > 1e-6:
        arr = arr * (peak / m)
    return arr
