"""Sound effects and score, from ElevenLabs. Cached by prompt hash.

None of this is puzzle-critical — the montages are assembled from these exact
files, so Echo-style matching stays fair no matter how any one effect reads.
"""
import os
import json
import time
import urllib.request
import urllib.error

from common import RAW, digest, cached, mark, log

API = "https://api.elevenlabs.io/v1"
KEY = os.environ.get("ELEVENLABS_API_KEY", "")


def _post(url, payload, tries=5):
    body = json.dumps(payload).encode()
    last = None
    for attempt in range(tries):
        req = urllib.request.Request(
            url, data=body,
            headers={"xi-api-key": KEY, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=420) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = "HTTP %s %s" % (e.code, e.read().decode()[:300])
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(last)
        except Exception as e:
            last = str(e)
            time.sleep(2 ** attempt)
    raise RuntimeError("giving up: %s" % last)


def sfx(aid, prompt, dur, influence=0.55):
    path = os.path.join(RAW, "sfx_%s.mp3" % aid)
    sig = digest("sfx-v1", prompt, dur, influence)
    if cached("sfx_" + aid, sig, path):
        return path, False
    data = _post(API + "/sound-generation", {
        "text": prompt,
        "duration_seconds": float(dur),
        "prompt_influence": influence,
    })
    with open(path, "wb") as f:
        f.write(data)
    mark("sfx_" + aid, sig)
    return path, True


def music(aid, prompt, ms):
    path = os.path.join(RAW, "mus_%s.mp3" % aid)
    sig = digest("mus-v1", prompt, ms)
    if cached("mus_" + aid, sig, path):
        return path, False
    data = _post(API + "/music", {"prompt": prompt, "music_length_ms": int(ms)})
    with open(path, "wb") as f:
        f.write(data)
    mark("mus_" + aid, sig)
    return path, True


def generate(foley, extra_sfx, crash17, music_spec):
    paths = {}
    log("── sound effects")
    for aid, s in list(foley.items()):
        p, new = sfx(aid, s["prompt"], s["dur"])
        paths[aid] = p
        if new:
            log("   +", aid)
    for aid, s in extra_sfx.items():
        p, new = sfx(aid, s["prompt"], s["dur"])
        paths[aid] = p
        if new:
            log("   +", aid)
    p, new = sfx("crash", crash17["prompt"], crash17["dur"], influence=0.7)
    paths["crash"] = p
    if new:
        log("   + crash (#17)")

    log("── score")
    for aid, s in music_spec.items():
        p, new = music(aid, s["prompt"], s["ms"])
        paths[aid] = p
        if new:
            log("   +", aid)
    return paths


if __name__ == "__main__":
    import case
    generate(case.FOLEY, case.SFX, case.CRASH_17, case.MUSIC)
    log("sfx done")
