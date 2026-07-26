"""Evidence card art, from Recraft. Cached by prompt hash.

Rendered as black-and-white period photographs; the deck's amber cast lives in
CSS so the cards stay tonally identical to each other.
"""
import os
import json
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

import case
from common import IMG, WORK, digest, cached, mark, log, run

API = "https://external.api.recraft.ai/v1/images/generations"
KEY = os.environ.get("RECRAFT_API_KEY", "")
STYLE, SUBSTYLE = "realistic_image", "b_and_w"
SIZE = 512          # cards are small; 512 keeps the repo sane


def _generate(prompt, tries=6):
    payload = json.dumps({
        "prompt": prompt, "style": STYLE, "substyle": SUBSTYLE,
        "size": "1024x1024", "n": 1,
    }).encode()
    last = None
    for attempt in range(tries):
        req = urllib.request.Request(
            API, data=payload,
            headers={"Authorization": "Bearer " + KEY,
                     "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.loads(r.read())["data"][0]["url"]
        except urllib.error.HTTPError as e:
            last = "HTTP %s %s" % (e.code, e.read().decode()[:200])
            # Recraft answers concurrent bursts with 403 rather than 429, so
            # that has to be treated as back-pressure and retried.
            if e.code in (403, 429, 500, 502, 503, 504):
                time.sleep(1.5 * (attempt + 1) ** 2)
                continue
            raise RuntimeError(last)
        except Exception as e:
            last = str(e)
            time.sleep(2 ** attempt)
    raise RuntimeError("giving up: %s" % last)


# Generated image URLs, kept so that a failed *download* never costs a second
# generation. Recraft bills on generation, not on fetching the result.
URLS = os.path.join(WORK, "art_urls.json")
_urls = json.load(open(URLS)) if os.path.exists(URLS) else {}
_ulock = __import__("threading").Lock()

# The image CDN rejects the default Python-urllib User-Agent with a 403.
UA = "Mozilla/5.0 (X11; Linux x86_64) nocturne-tapes-build/1.0"


def art(aid, prompt):
    dst = os.path.join(IMG, aid + ".webp")
    sig = digest("art-v2", STYLE, SUBSTYLE, SIZE, prompt)
    if cached("art_" + aid, sig, dst):
        return dst, False

    key = aid + ":" + sig
    url = _urls.get(key)
    if not url:
        url = _generate(prompt)
        with _ulock:
            _urls[key] = url
            with open(URLS, "w") as f:
                json.dump(_urls, f, indent=1)

    tmp = os.path.join(WORK, "_art_%s.png" % aid)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
        f.write(r.read())
    run(["ffmpeg", "-v", "error", "-y", "-i", tmp,
         "-vf", "scale=%d:%d" % (SIZE, SIZE), "-quality", "80", dst])
    os.remove(tmp)
    mark("art_" + aid, sig)
    return dst, True


def main():
    jobs = {}
    for c in case.CARDS:
        jobs[c["id"]] = c["art"]
    jobs.update(case.FOLEY_ART)
    log("── card art: %d images" % len(jobs))

    todo = [(a, p) for a, p in jobs.items()
            if not cached("art_" + a, digest("art-v2", STYLE, SUBSTYLE, SIZE, p),
                          os.path.join(IMG, a + ".webp"))]
    log("   %d to generate (%d cached), ~%d recraft credits"
        % (len(todo), len(jobs) - len(todo), len(todo) * 40))

    fails = []
    with ThreadPoolExecutor(max_workers=2) as pool:
        futs = {pool.submit(art, a, p): a for a, p in todo}
        for i, fut in enumerate(as_completed(futs), 1):
            aid = futs[fut]
            try:
                fut.result()
                log("   [%2d/%d] %s" % (i, len(todo), aid))
            except Exception as e:
                fails.append((aid, str(e)[:120]))
                log("   [%2d/%d] %s  FAILED: %s" % (i, len(todo), aid, str(e)[:120]))
    if fails:
        log("!! %d images failed; the game falls back to a typographic card for these"
            % len(fails))
    mb = sum(os.path.getsize(os.path.join(IMG, f)) for f in os.listdir(IMG)) / 1e6
    log("   %d images, %.1f MB" % (len(os.listdir(IMG)), mb))


if __name__ == "__main__":
    main()
