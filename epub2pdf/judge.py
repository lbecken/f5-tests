"""Optional local-LLM layout judge (Ollama).

The heuristic scorer settles most chapters on its own. When two candidate
layouts score within a near-tie band, this judge — a small model running
locally via Ollama — gets the deciding vote. Two modes:

* vision: candidate pages are rendered to small PNGs and a vision model
  (qwen2.5vl, llava, gemma3, ...) is asked which set of pages looks better.
  Requires the `pymupdf` extra to rasterize.
* text: a compact structured description of each candidate (page fill,
  widows/orphans, image placement) is sent to any text model. Cheaper, but
  it only sees the same features the heuristic already scored, so treat it
  as a preference model, not new information.

Everything degrades gracefully: any error (Ollama not running, model
missing, timeout) falls back to the heuristic ranking with a warning.
"""

from __future__ import annotations

import base64
import json
import re
import sys
import urllib.request
from typing import Callable, List, Optional

from .model import CandidateLayout

DEFAULT_MODEL = "qwen2.5vl:7b"
DEFAULT_URL = "http://localhost:11434"

VISION_HINTS = ("vl", "llava", "vision", "moondream", "gemma3", "minicpm-v")

SYSTEM_PROMPT = (
    "You are a meticulous book typesetter. You compare candidate page layouts "
    "for the SAME chapter content and pick the one a reader would find most "
    "pleasant: pages evenly filled, no single lines stranded at page tops or "
    "bottoms, headings attached to their text, images well placed near their "
    "context and not overly shrunk. Answer with the candidate id only."
)


class OllamaJudge:
    def __init__(self, model: str = "", url: str = DEFAULT_URL,
                 renderer: Optional[Callable[[CandidateLayout, int], List[bytes]]] = None,
                 max_calls: int = 24, timeout: float = 120.0, verbose: bool = False):
        self.model = model or DEFAULT_MODEL
        self.url = (url or DEFAULT_URL).rstrip("/")
        self.renderer = renderer            # renders candidate pages -> PNGs
        self.max_calls = max_calls
        self.timeout = timeout
        self.verbose = verbose
        self.calls = 0
        self.failed = False
        self.decisions: List[str] = []
        self.vision = any(h in self.model.lower() for h in VISION_HINTS)

    # -- transport -----------------------------------------------------------

    def _chat(self, messages: List[dict]) -> Optional[str]:
        payload = json.dumps({
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.0, "num_predict": 64},
        }).encode()
        req = urllib.request.Request(
            f"{self.url}/api/chat", data=payload,
            headers={"Content-Type": "application/json"}, method="POST")
        # Ollama is local: bypass any configured HTTP(S) proxy.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        try:
            with opener.open(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode())
            return (data.get("message") or {}).get("content", "")
        except Exception as e:
            if not self.failed:
                print(f"[judge] Ollama unavailable ({e}); falling back to "
                      f"heuristic ranking", file=sys.stderr)
            self.failed = True
            return None

    # -- feature description (text mode) --------------------------------------

    @staticmethod
    def describe(c: CandidateLayout) -> str:
        pages = []
        for i, p in enumerate(c.pages):
            pages.append(f"page {i + 1}: {len(p.atoms)} elements, {p.used:.0f}mm used")
        issues = "; ".join(c.issues) if c.issues else "no detected issues"
        return (f"candidate '{c.strategy}': {len(c.pages)} pages. "
                f"Issues: {issues}. " + " | ".join(pages[:12]))

    # -- decision --------------------------------------------------------------

    def pick(self, contenders: List[CandidateLayout]) -> Optional[str]:
        if self.failed or self.calls >= self.max_calls:
            return None
        self.calls += 1

        ids = [c.strategy for c in contenders]
        if self.vision and self.renderer is not None:
            content = ("Below are page renderings of candidate layouts of the "
                       "same chapter, in order: "
                       + ", ".join(f"candidate '{i}'" for i in ids)
                       + ". Each candidate contributes up to 3 pages. "
                       "Which candidate id looks best typeset? "
                       "Answer with the id only.")
            images: List[str] = []
            for c in contenders:
                for png in self.renderer(c, 3):
                    images.append(base64.b64encode(png).decode())
            msg = {"role": "user", "content": content, "images": images}
        else:
            desc = "\n".join(self.describe(c) for c in contenders)
            msg = {"role": "user", "content":
                   f"Candidates:\n{desc}\n\nWhich candidate id is the best "
                   f"layout? Answer with the id only."}

        answer = self._chat([{"role": "system", "content": SYSTEM_PROMPT}, msg])
        if not answer:
            return None
        answer = answer.strip().lower()
        for cid in ids:
            if re.search(rf"\b{re.escape(cid.lower())}\b", answer):
                self.decisions.append(cid)
                if self.verbose:
                    print(f"[judge] picked '{cid}' among {ids}", file=sys.stderr)
                return cid
        return None
