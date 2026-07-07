"""Text-to-speech with Piper, fed sentence-by-sentence.

The key idea is the **sentence chunker**: LLM tokens stream in, and the
moment a sentence boundary appears we hand that sentence to TTS and start
playback — while the LLM is still generating the rest of the reply.
Perceived latency is therefore governed by the *first sentence*, not the
whole answer.

Piper is a small ONNX TTS that synthesizes several times faster than
realtime on a laptop CPU, which is exactly what this overlap trick needs:
each sentence must be ready before the previous one finishes playing.
"""

import re

import numpy as np

# A sentence ends at . ! ? or : followed by whitespace/end. Commas are
# deliberately NOT boundaries — splitting there sounds choppy.
_BOUNDARY = re.compile(r"([.!?:])(\s+|$)")
_MIN_CHUNK_CHARS = 12  # don't ship "Hi." alone if more text is coming fast


def sentence_chunker(token_stream):
    """Re-chunk a stream of text fragments into complete sentences.

    Yields each sentence as soon as its boundary arrives; flushes any
    trailing text when the stream ends.
    """
    buf = ""
    for token in token_stream:
        buf += token
        while True:
            m = _BOUNDARY.search(buf)
            if not m or m.end(1) < _MIN_CHUNK_CHARS:
                break
            yield buf[: m.end(1)].strip()
            buf = buf[m.end():]
    tail = buf.strip()
    if tail:
        yield tail


class Speaker:
    """Wraps a Piper voice; returns int16 PCM for a sentence."""

    def __init__(self, voice_path):
        from piper import PiperVoice
        self.voice = PiperVoice.load(voice_path)
        self.sample_rate = self.voice.config.sample_rate

    def synthesize(self, text: str) -> np.ndarray:
        # piper-tts changed its API at 1.3; support both.
        if hasattr(self.voice, "synthesize_stream_raw"):  # <= 1.2
            raw = b"".join(self.voice.synthesize_stream_raw(text))
            return np.frombuffer(raw, dtype=np.int16)
        chunks = [np.frombuffer(c.audio_int16_bytes, dtype=np.int16)
                  for c in self.voice.synthesize(text)]  # >= 1.3
        if not chunks:
            return np.zeros(0, dtype=np.int16)
        return np.concatenate(chunks)
