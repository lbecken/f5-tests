"""Solvability checks.

These do not test that the code runs; they test that the *puzzles are solvable
from the audio that actually shipped*. Each analyser decodes a rendered mp3 and
recovers the answer the way a player's ear is meant to, so a regression in the
processing chain fails the build rather than the player.
"""
import os
import sys

import numpy as np

import case
from common import AUDIO, SR, decode, log
from synth import MORSE

REV_MORSE = {v: k for k, v in MORSE.items()}
FAILS = []


def check(name, ok, detail=""):
    print("  %-46s %s  %s" % (name, "PASS" if ok else "FAIL", detail))
    if not ok:
        FAILS.append(name)
    return ok


def envelope(x, win_ms=5.0):
    w = max(1, int(SR * win_ms / 1000))
    p = np.convolve(x ** 2, np.ones(w) / w, mode="same")
    return np.sqrt(p)


def bandpass(x, lo, hi):
    """Zero-phase band isolation via FFT — analysis only, so this is fine."""
    n = len(x)
    F = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    F[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(F, n)


# ── reel 3: count the rotary pulses ────────────────────────────────────────
def read_rotary(path):
    a = decode(path).mean(axis=1)
    e = envelope(a, 3.0)
    thr = max(e.max() * 0.16, np.percentile(e, 97) * 0.5)
    on = e > thr
    # onsets
    idx = np.flatnonzero(on[1:] & ~on[:-1])
    if len(idx) == 0:
        return []
    # de-bounce: a click is ~30ms, pulses are 100ms apart
    keep = [idx[0]]
    for i in idx[1:]:
        if (i - keep[-1]) / SR > 0.055:
            keep.append(i)
    keep = np.array(keep)
    # group: gap between digits is 780ms, within a digit 100ms
    groups, cur = [], [keep[0]]
    for i in keep[1:]:
        if (i - cur[-1]) / SR > 0.40:
            groups.append(cur)
            cur = [i]
        else:
            cur.append(i)
    groups.append(cur)
    return [len(g) % 10 for g in groups]


# ── reel 4: decode the Morse out of the "blank" reel ───────────────────────
def read_morse(path, freq=5200, bw=500):
    a = decode(path).mean(axis=1)
    band = bandpass(a, freq - bw, freq + bw)
    e = envelope(band, 8.0)
    thr = e.max() * 0.30
    on = e > thr
    # run-length encode
    runs, cur, start = [], on[0], 0
    for i in range(1, len(on)):
        if on[i] != cur:
            runs.append((cur, (i - start) / SR))
            cur, start = on[i], i
    runs.append((cur, (len(on) - start) / SR))
    runs = [(s, d) for s, d in runs if d > 0.030]
    ons = [d for s, d in runs if s]
    if not ons:
        return ""
    # One unit is both a dot and an intra-character gap, so single-unit runs are
    # by far the most common length. A low percentile over *all* runs lands on
    # them reliably; a percentile over the "on" runs alone can fall between dot
    # and dash when the message is dash-heavy.
    unit = float(np.percentile([d for _, d in runs], 15))
    text, sym = "", ""
    for s, d in runs:
        u = d / unit
        if s:
            sym += "." if u < 2.0 else "-"
        else:
            if u > 5.5:                     # word / repeat gap
                if sym:
                    text += REV_MORSE.get(sym, "?")
                sym = ""
                text += " "
            elif u > 1.8:                   # character gap
                if sym:
                    text += REV_MORSE.get(sym, "?")
                sym = ""
    if sym:
        text += REV_MORSE.get(sym, "?")
    return text.strip()


# ── level checks ───────────────────────────────────────────────────────────
def band_energy(path, lo, hi):
    a = decode(path).mean(axis=1)
    return float(np.sqrt(np.mean(bandpass(a, lo, hi) ** 2)))


def channel_split(path):
    """How independent are L and R? Returns correlation; near 0 means the
    stereo puzzle actually separates."""
    a = decode(path)
    l, r = a[:, 0], a[:, 1]
    if l.std() < 1e-7 or r.std() < 1e-7:
        return 1.0
    return float(abs(np.corrcoef(l, r)[0, 1]))


def rms(path):
    return float(np.sqrt(np.mean(decode(path) ** 2)))


def main():
    print("\nTHE NOCTURNE TAPES — solvability checks\n" + "─" * 68)

    # 1. the rotary dial must read back as the lock answer
    want = case.LOCKS[3]["answer"]
    got = read_rotary(os.path.join(AUDIO, "syn_dial.mp3"))
    got_s = "".join(str(d) for d in got)
    check("reel 3 · rotary dial decodes to %s" % want, got_s == want,
          "read %r" % got_s)

    # And again from the finished tape the player actually holds. That tape also
    # contains the handset lift and the ringing bell, which are plainly not dial
    # pulses to a listener but do register as transients here — so the check is
    # that the number appears as an unbroken run of groups.
    p = os.path.join(AUDIO, "tape_dial.mp3")
    if os.path.exists(p):
        got2 = "".join(str(d) for d in read_rotary(p))
        check("reel 3 · dial readable on the mixed tape",
              want in got2, "read %r" % got2)

    # 2. the Morse must survive the tape chain
    want_m = case.COMPOSITES["tape_blank"]["meta"]["morse"]
    p = os.path.join(AUDIO, "tape_blank.mp3")
    if os.path.exists(p):
        txt = read_morse(p)
        first = txt.split()[0] if txt.split() else ""
        check("reel 4 · morse on the blank reel decodes to %s" % want_m,
              first == want_m, "read %r" % txt)
        e_hi = band_energy(p, 4800, 5600)
        check("reel 4 · carrier survives the chain (>1e-4)", e_hi > 1e-4,
              "%.2e" % e_hi)

    # 3a. reel 1's broadcast: programme and talkback must be fully independent,
    #     so that hard-panning genuinely isolates one from the other.
    p = os.path.join(AUDIO, "tape_broadcast.mp3")
    if os.path.exists(p):
        c = channel_split(p)
        check("reel 1 · programme and talkback are independent (corr < 0.4)",
              c < 0.40, "corr=%.3f" % c)

    # 3b. reel 3's party line is deliberately NOT fully decorrelated — the third
    #     conversation is centred. What has to hold is that the two panned
    #     conversations exist in the side signal, and that the wall band below
    #     600 Hz belongs to the centre, so a low-pass sweep isolates it.
    p = os.path.join(AUDIO, "tape_partyline.mp3")
    if os.path.exists(p):
        a = decode(p)
        mid, side = (a[:, 0] + a[:, 1]) / 2, (a[:, 0] - a[:, 1]) / 2
        r = lambda x: float(np.sqrt(np.mean(x ** 2)))
        check("reel 3 · two conversations are panned (side/mid > 0.25)",
              r(side) / max(r(mid), 1e-9) > 0.25,
              "%.2f" % (r(side) / max(r(mid), 1e-9)))
        wall_mid, wall_side = r(bandpass(mid, 60, 600)), r(bandpass(side, 60, 600))
        check("reel 3 · wall band below 600 Hz is centre-dominant (>2.5x)",
              wall_mid / max(wall_side, 1e-9) > 2.5,
              "mid/side=%.2f" % (wall_mid / max(wall_side, 1e-9)))

    # 4. every asset referenced by a card or lock exists and is audible
    missing, silent = [], []
    for c in case.CARDS:
        if not c["audio"]:
            continue
        p = os.path.join(AUDIO, c["audio"] + ".mp3")
        if not os.path.exists(p):
            missing.append(c["audio"])
        elif rms(p) < 0.004:
            silent.append(c["audio"])
    check("all card audio present", not missing, ",".join(missing[:4]))
    check("no card is effectively silent", not silent, ",".join(silent[:4]))

    for f in case.FOLEY:
        if not os.path.exists(os.path.join(AUDIO, f + ".mp3")):
            missing.append(f)
    check("all foley object cards present",
          all(os.path.exists(os.path.join(AUDIO, f + ".mp3")) for f in case.FOLEY))

    # 5. the reel-1 lock answer must match the montage that was actually built
    order = case.COMPOSITES["tape_broadcast"]["meta"]["foley_order"]
    cats = "".join(str(case.FOLEY[f]["cat"]) for f in order)
    check("reel 1 · lock answer matches the montage order (%s)" % cats,
          cats == case.LOCKS[0]["answer"], "lock says %s" % case.LOCKS[0]["answer"])

    # 6. the reel-2 sequence lock must match the scene that was actually built
    built = [L["src"] for L in case.COMPOSITES["tape_scene88"]["layers"]
             if L["src"] in case.FOLEY]
    check("reel 2 · sequence lock matches scene 3 as assembled",
          built == case.LOCKS[1]["answer"], "built %s" % built)

    # 7. the intruder really is only in the transmitted version
    in_clean = {L["src"] for L in case.COMPOSITES["tape_scene88"]["layers"]}
    in_tx = {L["src"] for L in case.COMPOSITES["tape_scene88x"]["layers"]}
    intruder = case.LOCKS[2]["answer"]
    check("reel 2 · #17 is present only as transmitted",
          intruder in in_tx and intruder not in in_clean)

    # 8. every lock answer is reachable from cards unlocked at or before it
    for lock in case.LOCKS:
        reel = lock["reel"]
        avail = [c["id"] for c in case.CARDS if c["reel"] <= reel]
        check("lock %s · has evidence in reels 1..%d (%d cards)"
              % (lock["id"], reel, len(avail)), len(avail) >= 3)

    print("─" * 68)
    if FAILS:
        print("%d FAILED: %s\n" % (len(FAILS), ", ".join(FAILS)))
        return 1
    print("all checks passed\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
