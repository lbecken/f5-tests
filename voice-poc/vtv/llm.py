"""Streaming LLM client (Ollama) + a fake for plumbing tests.

Two latency principles live here:

1. **Stream tokens.** We never wait for the full reply. Tokens are yielded
   as they arrive so TTS can start on the first finished sentence while
   the model is still writing the rest.
2. **Prompt for brevity.** A voice reply that takes 30 s to speak feels
   broken no matter how fast it started. The system prompt asks for short,
   spoken-style answers — this is a latency optimization, not a style one.
"""

import json
import time

import requests

DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful voice assistant. Your answers are spoken aloud, so "
    "reply in 1-3 short conversational sentences. No markdown, no lists, "
    "no emoji. Get to the point immediately."
)


class OllamaChat:
    """Streams a chat completion from a local Ollama server."""

    def __init__(self, model="llama3.2:1b", url="http://localhost:11434",
                 system_prompt=DEFAULT_SYSTEM_PROMPT, keep_alive="10m"):
        self.model = model
        self.endpoint = url.rstrip("/") + "/api/chat"
        self.keep_alive = keep_alive
        self.messages = [{"role": "system", "content": system_prompt}]

    def warm_up(self):
        """Load the model into memory before the first real turn, so the
        first response doesn't pay multi-second model-load time."""
        for _ in self.stream("Say the word ready."):
            pass
        # Drop the warm-up exchange from history.
        self.messages = self.messages[:1]

    def stream(self, user_text: str):
        """Send one user turn; yield reply text chunks as they stream in."""
        self.messages.append({"role": "user", "content": user_text})
        reply_parts = []
        with requests.post(
            self.endpoint,
            json={
                "model": self.model,
                "messages": self.messages,
                "stream": True,
                "keep_alive": self.keep_alive,
            },
            stream=True,
            timeout=120,
        ) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines():
                if not line:
                    continue
                data = json.loads(line)
                if "error" in data:
                    raise RuntimeError(f"Ollama error: {data['error']}")
                chunk = data.get("message", {}).get("content", "")
                if chunk:
                    reply_parts.append(chunk)
                    yield chunk
                if data.get("done"):
                    break
        self.messages.append({"role": "assistant",
                              "content": "".join(reply_parts)})


class FakeChat:
    """Offline stand-in that 'streams' a canned reply word by word.

    Lets you exercise the whole pipeline (VAD, STT, sentence chunking,
    TTS, playback, metrics) with no Ollama running.
    """

    def __init__(self, delay_per_token=0.03):
        self.delay = delay_per_token

    def warm_up(self):
        pass

    def stream(self, user_text: str):
        reply = (f"You said: {user_text}. This is a canned reply from the "
                 "fake language model. It streams word by word, so the "
                 "sentence chunker and speech synthesis behave exactly "
                 "like they would with a real model.")
        for word in reply.split(" "):
            time.sleep(self.delay)
            yield word + " "
