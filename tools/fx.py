"""Processing chains: per-layer bands, the Archivist's disguise, tape colour.

Two rules govern everything here:
  * The Archivist transform is a real resample, so the console's SPEED control
    genuinely undoes it. Nothing about the endgame is faked.
  * Tape colour must never cut above 5.2 kHz, because the Morse in reel four
    lives up there and has to survive the chain.
"""
import numpy as np

from common import SR, db

# ── the Archivist disguise ─────────────────────────────────────────────────
# Resampling to 0.78x drops pitch and stretches time exactly as a tape machine
# running slow does. The player restores it at 1/0.78 = 1.282x.
ARCHIVIST_RATE = 0.78


def archivist_chain():
    return "asetrate=%d,aresample=%d,aresample=%d" % (
        int(SR * ARCHIVIST_RATE), SR, SR)


# ── per-layer bands ────────────────────────────────────────────────────────
BANDS = {
    # A 1957 telephone line. The high-pass sits at 430 rather than the textbook
    # 300 so that the party-line puzzle has a clean band below it belonging to
    # nobody but the voices behind the wall.
    "telephone": "highpass=f=430,highpass=f=430,lowpass=f=3400,lowpass=f=3400,"
                 "acompressor=threshold=0.12:ratio=6:attack=5:release=90",
    # the other party on a shared line: close, full, but out of the wall band
    "neighbour": "highpass=f=430,highpass=f=430,lowpass=f=6500",
    # heard through a wall / off a talkback mic in another room
    "muffled": "lowpass=f=950,lowpass=f=950,volume=2.2",
    # a conversation on the far side of a studio wall. Lives under everything
    # else, so a low-pass sweep brings it — and only it — forward.
    "wall": "lowpass=f=600,lowpass=f=600,lowpass=f=600,volume=3.4",
    # AM broadcast chain
    "broadcast": "highpass=f=160,lowpass=f=5200,"
                 "acompressor=threshold=0.1:ratio=4:attack=8:release=140",
}


def layer_chain(band=None, speed=None, rev=False, archivist=False):
    """Build the ffmpeg -af chain for one layer of a composite."""
    parts = []
    if archivist:
        parts.append(archivist_chain())
    if speed and abs(speed - 1.0) > 1e-6:
        # tape-accurate: pitch follows speed
        parts.append("asetrate=%d,aresample=%d" % (int(SR / speed), SR))
    if band:
        parts.append(BANDS[band])
    if rev:
        parts.append("areverse")
    return ",".join(parts) if parts else None


# ── tape colour ────────────────────────────────────────────────────────────
# Applied to the finished mix. `hiss`/`crackle` are added in numpy (see below)
# because ffmpeg's noise sources are awkward to level precisely.
TAPE = {
    "clean":     dict(eq="highpass=f=45,lowpass=f=15000",
                      wobble=None, hiss=0.0018, crackle=0.0, sat=1.0),
    "worn":      dict(eq="highpass=f=90,lowpass=f=9000,equalizer=f=3000:t=q:w=1.4:g=2",
                      wobble="vibrato=f=0.7:d=0.06", hiss=0.0075, crackle=0.0, sat=1.5),
    "broadcast": dict(eq="highpass=f=170,lowpass=f=6200,equalizer=f=1800:t=q:w=1.2:g=3",
                      wobble="vibrato=f=1.1:d=0.035", hiss=0.006, crackle=0.0, sat=2.0),
    "wire":      dict(eq="highpass=f=260,lowpass=f=5600,equalizer=f=1200:t=q:w=1.0:g=2",
                      wobble="vibrato=f=2.3:d=0.09", hiss=0.013, crackle=0.0, sat=2.4),
    "disc":      dict(eq="highpass=f=190,lowpass=f=6000,equalizer=f=2500:t=q:w=1.5:g=2",
                      wobble="vibrato=f=0.55:d=0.05", hiss=0.005, crackle=0.020, sat=1.8),
    # reel four's "blank" tape: nothing may touch the 5.2 kHz Morse carrier
    "opentop":   dict(eq="highpass=f=60,lowpass=f=12000",
                      wobble=None, hiss=0.004, crackle=0.0, sat=1.0),
    # reel 1's damaged 4B. Sounds ruined, but the content is only slowed — the
    # chain stays gentle enough that 1.75x recovers clean speech.
    "warped":    dict(eq="highpass=f=55,lowpass=f=5000,equalizer=f=400:t=q:w=1.0:g=3",
                      wobble="vibrato=f=0.35:d=0.11", hiss=0.010, crackle=0.0, sat=1.6),
}


def tape_chain(name):
    t = TAPE[name]
    parts = [t["eq"]]
    if t["wobble"]:
        parts.append(t["wobble"])
    if t["sat"] > 1.01:
        # gentle valve-ish soft clip
        parts.append("acompressor=threshold=0.25:ratio=%0.1f:attack=12:release=200"
                     % t["sat"])
    parts.append("alimiter=limit=0.94")
    return ",".join(parts)


def add_noise(arr, name, rng):
    """Hiss and (for acetate) surface crackle, added before the ffmpeg chain."""
    t = TAPE[name]
    n = len(arr)
    if t["hiss"] > 0:
        arr = arr + rng.standard_normal((n, 2)).astype(np.float32) * t["hiss"]
    if t["crackle"] > 0:
        pops = rng.random(n) < 0.00035
        idx = np.flatnonzero(pops)
        for i in idx:
            ln = min(70, n - i)
            e = np.exp(-np.arange(ln) / 9.0).astype(np.float32)
            amp = t["crackle"] * (0.4 + rng.random() * 2.2)
            arr[i:i + ln, 0] += e * amp
            arr[i:i + ln, 1] += e * amp * 0.85
    return arr.astype(np.float32)
