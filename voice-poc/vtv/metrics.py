"""Per-turn latency instrumentation.

The single number that matters for conversational feel is
*time-to-first-audio*: how long between the moment you stop speaking and
the moment you hear the reply start. Everything in this POC is organized
around minimizing it, so we measure every stage that contributes.
"""

import time
import threading


class TurnMetrics:
    """Collects monotonic timestamps for one conversation turn."""

    STAGES = [
        ("speech_end", "you stopped speaking"),
        ("stt_done", "transcription ready"),
        ("llm_first_token", "first LLM token"),
        ("tts_first_chunk", "first sentence synthesized"),
        ("audio_start", "first audio audible"),
    ]

    def __init__(self):
        self._t = {}
        self._lock = threading.Lock()

    def mark(self, name):
        """Record a stage timestamp (first call wins; safe across threads)."""
        with self._lock:
            self._t.setdefault(name, time.monotonic())

    def get(self, name):
        return self._t.get(name)

    def report(self):
        """Human-readable latency breakdown relative to end of speech."""
        t0 = self._t.get("speech_end")
        if t0 is None:
            return "  (no speech timing captured this turn)"
        lines = ["  latency (since you stopped speaking):"]
        prev = t0
        for name, label in self.STAGES[1:]:
            t = self._t.get(name)
            if t is None:
                continue
            lines.append(
                f"    {label:<28} +{(t - t0) * 1000:7.0f} ms"
                f"  (stage: {(t - prev) * 1000:.0f} ms)"
            )
            prev = t
        ttfa = self._t.get("audio_start")
        if ttfa is not None:
            lines.append(f"    >>> time-to-first-audio: {(ttfa - t0) * 1000:.0f} ms")
        return "\n".join(lines)
