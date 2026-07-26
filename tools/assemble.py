"""Assemble the composite evidence tapes.

Layers are decoded through their own ffmpeg chain (speed / band / reverse /
the Archivist disguise), positioned on a sample-exact timeline, mixed in numpy,
then given tape colour as a whole.

Timeline DSL for a layer's `at`:
    3.5                  absolute seconds
    "after:ID+0.4"       0.4s after layer ID ends
    "after:ID-0.3"       0.3s before layer ID ends (overlap)
    "sync:ID+1.0"        1.0s after layer ID starts
    "sync:ID-1.2"        1.2s before layer ID starts
    "sync:ID+end"        exactly when layer ID ends
"""
import os
import re
import numpy as np

import fx
from common import (AUDIO, WORK, SR, decode, encode, run, digest, cached, mark,
                    log, db, pan_gains, tile_to, normalise)

RNG = np.random.default_rng(1103)
AT_RE = re.compile(r"^(after|sync):([A-Za-z0-9_]+)([+-])(end|[0-9.]+)$")

# these two carry the stereo puzzles — keep the channels fully independent
FULL_STEREO = {"tape_broadcast", "tape_partyline"}


def _resolve(at, starts, ends, lid):
    if isinstance(at, (int, float)):
        return float(at)
    m = AT_RE.match(at)
    if not m:
        raise ValueError("bad `at` on layer %s: %r" % (lid, at))
    mode, ref, sign, amt = m.groups()
    if ref not in starts:
        raise ValueError("layer %s references %r before it is positioned" % (lid, ref))
    base = ends[ref] if mode == "after" else starts[ref]
    if amt == "end":
        return ends[ref]
    d = float(amt) * (1 if sign == "+" else -1)
    return max(0.0, base + d)


def _layer_audio(src, layer, sources, speakers):
    """Decode one layer through its own processing chain."""
    path = sources.get(src)
    if path is None:
        raise KeyError("composite references unknown source %r" % src)
    chain = fx.layer_chain(
        band=layer.get("band"),
        speed=layer.get("speed"),
        rev=layer.get("rev", False),
        archivist=(speakers.get(src) == "ARCHIVIST"),
    )
    return decode(path, chain)


def build_composite(cid, spec, sources, speakers):
    layers = spec["layers"]
    audio = {}
    for L in layers:
        audio[L["src"]] = _layer_audio(L["src"], L, sources, speakers)

    # position everything that is not a loop bed
    starts, ends = {}, {}
    for L in layers:
        if L.get("loop"):
            continue
        s = _resolve(L["at"], starts, ends, L["src"])
        starts[L["src"]] = s
        ends[L["src"]] = s + len(audio[L["src"]]) / SR

    total = max(ends.values()) if ends else 4.0
    total += float(spec.get("pad_out", 1.0))
    n = int(total * SR)
    mix = np.zeros((n, 2), np.float32)

    for L in layers:
        a = audio[L["src"]]
        g = db(L.get("gain", 0))
        gl, gr = pan_gains(L.get("pan", 0.0))
        # constant-power pan is -3dB at centre; compensate so gains read as written
        gl, gr = gl * 1.414 * g, gr * 1.414 * g
        if L.get("loop"):
            a = tile_to(a, n)
            seg, off = a, 0
        else:
            off = int(starts[L["src"]] * SR)
            seg = a[:max(0, n - off)]
        if len(seg) == 0:
            continue
        mix[off:off + len(seg), 0] += seg[:, 0] * gl
        mix[off:off + len(seg), 1] += seg[:, 1] * gr

    mix = normalise(mix, 0.82)
    mix = fx.add_noise(mix, spec.get("tape", "worn"), RNG)

    tmp = os.path.join(WORK, "_%s.wav" % cid)
    run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2",
         "-i", "-", "-c:a", "pcm_f32le", tmp],
        input=np.clip(mix, -1, 1).astype("<f4").tobytes())
    out = os.path.join(AUDIO, cid + ".mp3")
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", tmp,
           "-af", fx.tape_chain(spec.get("tape", "worn"))]
    if cid in FULL_STEREO:
        cmd += ["-joint_stereo", "0", "-b:a", "144k"]
    else:
        cmd += ["-b:a", "112k"]
    cmd += ["-c:a", "libmp3lame", out]
    run(cmd)
    os.remove(tmp)
    return out, total


def build_simple(cid, line_id, tape, bed, sources, speakers):
    """Narration: one voice, optional music bed underneath."""
    spec = dict(tape=tape, pad_out=1.4, layers=[dict(src=line_id, at=0.6, gain=0)])
    if bed:
        spec["layers"].insert(0, dict(src=bed, at=0.0, gain=-25, loop=True))
    return build_composite(cid, spec, sources, speakers)


def export_library(foley, sources):
    """The Foley object cards. Same source files the montages use."""
    out = {}
    for aid in list(foley) + ["crash"]:
        dst = os.path.join(AUDIO, aid + ".mp3")
        sig = digest("lib-v2", sources[aid], os.path.getsize(sources[aid]))
        if not cached("lib_" + aid, sig, dst):
            a = decode(sources[aid])
            a = normalise(a, 0.85)
            a = fx.add_noise(a, "worn", RNG)
            tmp = os.path.join(WORK, "_lib.wav")
            run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR),
                 "-ac", "2", "-i", "-", "-c:a", "pcm_f32le", tmp],
                input=np.clip(a, -1, 1).astype("<f4").tobytes())
            run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", fx.tape_chain("worn"),
                 "-c:a", "libmp3lame", "-b:a", "112k", dst])
            os.remove(tmp)
            mark("lib_" + aid, sig)
        out[aid] = dst
    return out


def _order(composites):
    """Composites may nest — tape_scene88x contains cat17, which is itself a
    composite. Build dependencies first."""
    done, out, pending = set(), [], dict(composites)
    while pending:
        progressed = False
        for cid, spec in list(pending.items()):
            deps = {L["src"] for L in spec["layers"]} & set(composites)
            if deps <= done:
                out.append((cid, spec))
                done.add(cid)
                del pending[cid]
                progressed = True
        if not progressed:
            raise RuntimeError("circular composite dependency: %s" % list(pending))
    return out


def build_all(composites, simple_tapes, sources, speakers):
    from common import duration
    durations = {}
    log("── assembling composites")
    for cid, spec in _order(composites):
        path = os.path.join(AUDIO, cid + ".mp3")
        sig = digest("comp-v3", spec, [os.path.getsize(sources[L["src"]])
                                       for L in spec["layers"]])
        if cached("comp_" + cid, sig, path):
            durations[cid] = duration(path)
        else:
            _, total = build_composite(cid, spec, sources, speakers)
            mark("comp_" + cid, sig)
            durations[cid] = total
            log("   + %-24s %6.1fs" % (cid, total))
        sources[cid] = path                      # composites can nest (cat17)

    log("── assembling narration")
    for cid, (line_id, tape, bed) in simple_tapes.items():
        sig = digest("simp-v3", line_id, tape, bed, os.path.getsize(sources[line_id]))
        path = os.path.join(AUDIO, cid + ".mp3")
        if cached("simp_" + cid, sig, path):
            from common import duration
            durations[cid] = duration(path)
            continue
        _, total = build_simple(cid, line_id, tape, bed, sources, speakers)
        mark("simp_" + cid, sig)
        durations[cid] = total
        log("   + %-24s %6.1fs" % (cid, total))
    return durations
