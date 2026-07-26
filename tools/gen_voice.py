"""Text-to-speech generation, content-hash cached.

Re-running costs nothing unless a line's text, voice or settings actually
changed. Credit spend is reported per run and in total.
"""
import os
import re
import sys
import time
import json
import threading
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

from common import RAW, digest, cached, mark, log
from voices import VOICES, MODEL_PERF

_lock = threading.Lock()

API = "https://api.elevenlabs.io/v1"
KEY = os.environ.get("ELEVENLABS_API_KEY", "")
TAG_RE = re.compile(r"\[[^\]]*\]")


def clean(text):
    """Collapse the script's soft wrapping into one paragraph."""
    return re.sub(r"\s+", " ", text).strip()


def billable(text):
    return len(clean(text))


def _post(url, payload, tries=5):
    body = json.dumps(payload).encode()
    last = None
    for attempt in range(tries):
        req = urllib.request.Request(
            url, data=body,
            headers={"xi-api-key": KEY, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            detail = e.read().decode()[:400]
            last = "HTTP %s %s" % (e.code, detail)
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(last)
        except Exception as e:                      # transient network
            last = str(e)
            time.sleep(2 ** attempt)
    raise RuntimeError("giving up: %s" % last)


def credits_used():
    req = urllib.request.Request(API + "/user/subscription",
                                 headers={"xi-api-key": KEY})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.loads(r.read())
    return d["character_count"], d["character_limit"]


def speak(line_id, speaker, text):
    """Generate one line. Returns (path, chars_spent_now)."""
    v = VOICES[speaker]
    txt = clean(text)
    model = v.get("model", MODEL_PERF)
    path = os.path.join(RAW, "vo_%s.mp3" % line_id)
    sig = digest("tts-v1", v["vid"], model, v["settings"], txt)
    if cached("vo_" + line_id, sig, path):
        return path, 0

    payload = {
        "text": txt,
        "model_id": model,
        "voice_settings": v["settings"],
    }
    data = _post("%s/text-to-speech/%s?output_format=mp3_44100_128" % (API, v["vid"]),
                 payload)
    with open(path, "wb") as f:
        f.write(data)
    mark("vo_" + line_id, sig)
    return path, len(txt)


def generate(lines, budget=None):
    """lines: {id: (speaker, text)} -> {id: path}"""
    total = sum(billable(t) for _, t in lines.values())
    start_used, limit = credits_used()
    log("── TTS: %d lines, %d characters in script" % (len(lines), total))
    log("   account: %d/%d used, %d available" % (start_used, limit, limit - start_used))
    if budget and total > budget:
        raise SystemExit("script exceeds budget: %d > %d" % (total, budget))
    if total > (limit - start_used):
        raise SystemExit("script exceeds remaining credits: %d > %d"
                         % (total, limit - start_used))

    paths, spent, n_new = {}, 0, 0
    items = sorted(lines.items())
    done = [0]
    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = {pool.submit(speak, lid, sp, tx): lid for lid, (sp, tx) in items}
        for fut in as_completed(futs):
            lid = futs[fut]
            p, c = fut.result()
            with _lock:
                paths[lid] = p
                spent += c
                done[0] += 1
                if c:
                    n_new += 1
                    log("  [%3d/%d] %-28s %-10s %5d chars"
                        % (done[0], len(items), lid, lines[lid][0], c))
    end_used, _ = credits_used()
    log("── TTS done: %d new lines, %d characters spent this run" % (n_new, spent))
    log("   account now: %d/%d  (%d remaining)" % (end_used, limit, limit - end_used))
    return paths


if __name__ == "__main__":
    from script_text import LINES
    if not KEY:
        sys.exit("ELEVENLABS_API_KEY not set")
    generate(LINES)
