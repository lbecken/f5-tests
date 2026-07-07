# Local Voice-to-Voice Assistant (POC)

A fully local, low-latency voice assistant: you speak, a local LLM answers
out loud. No cloud, no API keys. Built to *learn the principles* of
conversational voice pipelines, so every latency trick is small, visible,
and instrumented.

```
mic ─► VAD endpointing ─► faster-whisper ─► Ollama LLM ─► sentence ─► Piper ─► speaker
       (500 ms silence     (STT)             (token        chunker     (TTS)    (playback
        = your turn ends)                     stream)                            queue)
```

## Cascaded vs. native voice-to-voice — why this design

There are two ways to build voice-to-voice:

| | Cascaded (this POC) | Native speech-to-speech |
|---|---|---|
| How | STT → text LLM → TTS | one model consumes and emits audio tokens (e.g. Kyutai **Moshi**, GPT-4o realtime) |
| Latency floor | ~500–1500 ms locally, dominated by endpointing + first LLM sentence | ~200 ms; can even speak *while* listening (full duplex) |
| Runs locally on a laptop | yes, comfortably, on CPU | barely — Moshi needs a big GPU and is hard to steer |
| Swap/inspect parts | every stage is a separate, swappable component | monolithic |
| What you learn | endpointing, streaming, chunking, overlap — the fundamentals every voice product uses | mostly "how to run one big model" |
| Preserves paralinguistics (tone, emotion) | no — text bottleneck | yes |

For a POC on local hardware, **cascaded is the right choice**: it reaches
sub-second *perceived* latency with tiny models, and the principles
transfer directly to production systems (most shipping voice agents are
still cascaded). When you outgrow it, try [Moshi](https://github.com/kyutai-labs/moshi)
to feel the native-model difference.

## The latency principles (what this code demonstrates)

Perceived delay = time between *you stop speaking* and *you hear the reply
start* (**time-to-first-audio**, printed after every turn). Budget:

```
you stop speaking
  ├─ endpointing wait      ~500 ms   VAD must see silence before deciding you're done
  ├─ STT                   ~100–300 ms   faster-whisper base.en, int8, greedy decode
  ├─ LLM first sentence    ~150–600 ms   1B model, streaming, prompted to be brief
  ├─ TTS first sentence    ~100–300 ms   Piper, several× faster than realtime on CPU
  └─ audio out             ~10 ms
                           ≈ 0.9–1.7 s time-to-first-audio on a laptop CPU
```

1. **Endpointing is a latency lever, not a detail** (`vtv/vad.py`). The
   pipeline can't start until it decides your sentence is over. That
   decision *is* the silence timeout: 500 ms of quiet. Shorter feels
   snappier but cuts you off between words. This is an irreducible cost of
   half-duplex turn-taking — the thing native full-duplex models eliminate.
2. **Stream everything; never wait for a full response** (`vtv/llm.py`).
   LLM tokens are consumed as they arrive. Waiting for the complete reply
   would add the *entire* generation time to the delay.
3. **Chunk at sentence boundaries and overlap the stages** (`vtv/tts.py`,
   `vtv/audio_io.py`). The first finished sentence goes to TTS and starts
   playing immediately; while it plays, the LLM writes sentence 2 and TTS
   synthesizes it. After the first sentence, generation time is *hidden
   behind playback* — the reply's total length stops mattering.
4. **Small models beat big models at conversation feel.** Whisper
   `base.en` (int8) + a 1B LLM respond in ~1 s; a 8B LLM + `small` model
   might be "smarter" but feels sluggish. Match model size to the job.
5. **Brevity is a latency feature** (system prompt). A reply that takes
   30 s to speak feels broken even if it starts instantly.
6. **Warm-up before the first turn.** Model load (Ollama cold start,
   whisper init) is paid once at startup, not on your first question.

## Setup (Linux/macOS, CPU is fine)

1. **Ollama + a small model** — https://ollama.com/download
   ```bash
   ollama pull llama3.2:1b        # or qwen2.5:1.5b, gemma3:1b
   ```
2. **Python deps** (PortAudio needed by sounddevice):
   ```bash
   # Debian/Ubuntu: sudo apt install libportaudio2   |  macOS: brew install portaudio
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. **A Piper voice** (~60 MB, one-time):
   ```bash
   python -m piper.download_voices en_US-lessac-medium
   ```
   (piper-tts ≤ 1.2: download the `.onnx` + `.onnx.json` pair from
   https://huggingface.co/rhasspy/piper-voices instead.)

## Run

```bash
python app.py --voice en_US-lessac-medium.onnx
```

Speak, pause, listen. After each turn you get the breakdown:

```
you> what is the tallest mountain on earth
bot> Mount Everest, at about 8,849 meters above sea level.
  latency (since you stopped speaking):
    transcription ready          +   210 ms  (stage: 210 ms)
    first LLM token              +   380 ms  (stage: 170 ms)
    first sentence synthesized   +   790 ms  (stage: 410 ms)
    first audio audible          +   800 ms  (stage: 10 ms)
    >>> time-to-first-audio: 800 ms
```

### Debug modes — test each stage in isolation

```bash
python app.py --text --no-tts --fake-llm   # pure plumbing, no audio/models
python app.py --text --fake-llm            # test TTS + playback only
python app.py --text                       # test LLM + TTS (no mic)
python app.py --no-tts                     # test mic + VAD + STT (no speaker)
```

### Knobs to experiment with

| Flag | Effect on latency |
|---|---|
| `--silence-ms 300` | snappier turn-taking, more risk of being cut off |
| `--whisper-model tiny.en` | ~2× faster STT, slightly worse accuracy |
| `--llm-model qwen2.5:1.5b` | try different small models |
| `--system-prompt "..."` | verbosity directly controls speaking time |

## Where to take it next

- **Barge-in**: keep the mic open during playback and stop speaking when
  the user interrupts. Needs acoustic echo cancellation (or a headset) so
  the assistant doesn't hear itself — try `speexdsp` or WebRTC AEC.
- **Streaming STT**: transcribe *while* the user is still talking
  (whisper on a sliding window, or NVIDIA Nemo/Vosk streaming models) —
  removes STT from the critical path entirely.
- **Speculative endpointing**: start STT+LLM at 250 ms of silence, cancel
  if the user resumes — trades compute for latency.
- **Better voices**: Kokoro-82M is a big quality jump, still local and
  near-realtime on CPU.
- **Native speech-to-speech**: run Kyutai Moshi (GPU) and compare the
  full-duplex feel against this pipeline.
