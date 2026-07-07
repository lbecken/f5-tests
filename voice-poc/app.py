#!/usr/bin/env python3
"""Local low-latency voice-to-voice assistant (POC).

Pipeline:  mic -> VAD endpointing -> faster-whisper (STT)
               -> Ollama LLM (token streaming) -> sentence chunker
               -> Piper (TTS) -> speaker (playback queue)

Everything runs locally. See README.md for setup and the latency
principles this demonstrates.

Quick start:
    ollama pull llama3.2:1b
    python -m piper.download_voices en_US-lessac-medium   # piper >= 1.3
    python app.py --voice en_US-lessac-medium.onnx

Debug modes (each stage can be swapped for a stub):
    --text       type instead of talking (skips mic + VAD + STT)
    --no-tts     print the reply instead of speaking it
    --fake-llm   canned streaming reply (no Ollama needed)
"""

import argparse
import sys

from vtv.llm import OllamaChat, FakeChat, DEFAULT_SYSTEM_PROMPT
from vtv.metrics import TurnMetrics
from vtv.tts import sentence_chunker


def parse_args():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--llm-model", default="llama3.2:1b",
                   help="Ollama model tag (default: llama3.2:1b)")
    p.add_argument("--ollama-url", default="http://localhost:11434")
    p.add_argument("--whisper-model", default="base.en",
                   help="faster-whisper size: tiny.en/base.en/small.en/...")
    p.add_argument("--voice", default="en_US-lessac-medium.onnx",
                   help="path to a Piper voice .onnx file")
    p.add_argument("--system-prompt", default=DEFAULT_SYSTEM_PROMPT)
    p.add_argument("--silence-ms", type=int, default=500,
                   help="trailing silence that ends your turn")
    p.add_argument("--text", action="store_true",
                   help="type input instead of speaking")
    p.add_argument("--no-tts", action="store_true",
                   help="print replies instead of speaking them")
    p.add_argument("--fake-llm", action="store_true",
                   help="use a canned reply stream instead of Ollama")
    return p.parse_args()


def main():
    args = parse_args()

    # --- LLM ---------------------------------------------------------
    if args.fake_llm:
        llm = FakeChat()
    else:
        llm = OllamaChat(model=args.llm_model, url=args.ollama_url,
                         system_prompt=args.system_prompt)
        print(f"* warming up LLM ({args.llm_model})...", flush=True)
        llm.warm_up()

    # --- STT + mic (unless --text) ------------------------------------
    transcriber = segmenter = None
    if not args.text:
        import numpy as np
        from vtv.stt import Transcriber
        from vtv.vad import UtteranceSegmenter
        print(f"* loading whisper ({args.whisper_model})...", flush=True)
        transcriber = Transcriber(args.whisper_model)
        transcriber.transcribe(np.zeros(16000, "float32"))  # warm-up
        segmenter = UtteranceSegmenter(silence_ms=args.silence_ms)

    # --- TTS + speaker (unless --no-tts) -------------------------------
    speaker = playback = None
    metrics_holder = {}
    if not args.no_tts:
        from vtv.tts import Speaker
        from vtv.audio_io import PlaybackQueue
        print(f"* loading voice ({args.voice})...", flush=True)
        speaker = Speaker(args.voice)
        playback = PlaybackQueue(
            speaker.sample_rate,
            on_first_chunk=lambda: metrics_holder["m"].mark("audio_start"))

    print("\nReady. Ctrl+C to quit."
          + ("" if args.text else "  Speak, then pause — I answer after "
             f"{args.silence_ms} ms of silence."))

    while True:
        m = TurnMetrics()
        metrics_holder["m"] = m

        # 1. Get the user's words
        if args.text:
            try:
                user_text = input("\nyou> ").strip()
            except EOFError:
                return
            if not user_text:
                continue
            m.mark("speech_end")
        else:
            from vtv.audio_io import capture_utterance
            print("\n[listening...]", flush=True)
            audio = capture_utterance(
                segmenter,
                on_speech_start=lambda: print("[hearing you...]", flush=True))
            m.mark("speech_end")
            user_text = transcriber.transcribe(audio)
            m.mark("stt_done")
            if not user_text:
                continue
            print(f"you> {user_text}")

        # 2. Stream the reply; speak each sentence as soon as it exists
        print("bot> ", end="", flush=True)

        def tokens():
            for tok in llm.stream(user_text):
                m.mark("llm_first_token")
                print(tok, end="", flush=True)
                yield tok

        for sentence in sentence_chunker(tokens()):
            if speaker:
                pcm = speaker.synthesize(sentence)
                m.mark("tts_first_chunk")
                playback.put(pcm)
        print()

        # 3. Wait for playback so the mic doesn't hear the assistant
        if playback:
            playback.end_turn_and_wait()
        print(m.report())


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nbye")
        sys.exit(0)
