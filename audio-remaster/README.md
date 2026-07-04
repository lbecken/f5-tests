# audio-remaster

Speech-focused audio remastering for old videos and recordings: enhance
clarity, reduce background/audience noise, and mux the cleaned audio back into
the original video without touching the video stream.

Built for exactly the use case of the 1964 Feynman Messenger Lectures: great
content, rough audio (narrow bandwidth, tape hiss, room reverb, audience
noise).

```
python remaster.py lecture.mp4 --backend clearvoice
# -> lecture.remastered.mp4  (video untouched, audio enhanced)
```

---

## First: is an LLM the right tool for this? (Short answer: no — but the right models exist)

**"LLM" is the wrong category, and that matters practically.** Large Language
Models (the things Ollama runs — Llama, Mistral, Qwen, ...) map text to text.
Audio remastering is an *audio-to-audio* problem, solved by a different family
of neural networks called **speech enhancement** (SE) models. Adobe Podcast AI
Speech Enhancement — the tool that YouTube channel used — is a proprietary
speech-enhancement model, not an LLM. So:

- **Ollama can't help here.** It only serves text/vision LLMs.
- **You don't need to train anything.** Excellent pretrained open-source SE
  models exist and are downloaded automatically on first run.
- Your M4 Max with 64 GB is more than enough — these models are small
  (tens of MB to ~500 MB, vs. many GB for LLMs) and run fine on CPU or Apple
  Silicon (MPS).

### Open-source models that do what Adobe Podcast does (all on Hugging Face)

| Model | HF / source | Character | Speed on M-series |
|---|---|---|---|
| **MossFormer2_SE_48K** (ClearerVoice-Studio, Alibaba) | `alibabasglab/MossFormer2_SE_48K` | 48 kHz studio-quality SE; the closest open match to Adobe Podcast for lecture material | fast |
| **Resemble Enhance** | `ResembleAI/resemble-enhance` | Two stages: denoiser + *generative* enhancer that reconstructs/extends bandwidth — most "Adobe v2"-like, can make 1964 audio sound modern, but may hallucinate on very degraded segments | slow (diffusion-based) |
| **DeepFilterNet3** | `Rikorose/DeepFilterNet3` | Pure denoiser, very faithful (never invents speech), real-time on CPU | very fast |
| **VoiceFixer** | `haoheliu/voicefixer` | "Speech restoration": denoise + dereverb + bandwidth extension in one; older but designed exactly for historical recordings | medium |
| SpeechBrain MetricGAN+/SepFormer | `speechbrain/*` | Solid research baselines, but 16 kHz output — noticeably band-limited | fast |

**Recommendation for the Feynman lectures:** start with `clearvoice`
(MossFormer2_SE_48K) — best quality/faithfulness balance. If you want the
aggressive "sounds like a modern podcast" effect, try `resemble`. If you want
maximum speed or a subtle touch, `deepfilternet`.

### Would you ever train/fine-tune one?

Almost certainly not — pretrained SE models are trained on hundreds of hours
of noisy speech and generalize well to old recordings. Fine-tuning only makes
sense if, after trying all backends, a *specific* artifact (e.g. a particular
projector hum or the exact tape-transfer signature) consistently survives.
If you get there, the recipe is:

1. **Build paired data.** You never have "clean 1964 Feynman", so you simulate:
   take clean speech corpora (LibriTTS-R, VCTK, DNS-Challenge clean set) and
   *degrade* it to sound like your recordings — band-limit to ~5 kHz, add tape
   hiss, wow/flutter, room impulse responses, and audience noise (e.g. from
   AudioSet/FSD50K crowd categories, or noise-only segments cut from the
   lectures themselves). The degraded version is the input, the original is
   the target.
2. **Fine-tune** an existing checkpoint (DeepFilterNet and ClearerVoice both
   publish training code) for a few epochs on those pairs — not train from
   scratch.
3. **Evaluate** with DNSMOS/PESQ/STOI plus your own ears on held-out lecture
   segments.

That's a weekend-scale project on your Mac (or a rented GPU), but try the
pretrained models first — they'll likely get you 95% of the way.

### Where LLMs *could* actually fit (optional, later)

Not in the signal path — but a speech-to-text model (Whisper) can give you
accurate subtitles for the enhanced lectures, and an LLM could clean up the
transcripts or generate chapter markers. That's a separate, complementary
pipeline.

---

## The tool

`remaster.py` is a single-file CLI. Pipeline:

1. **Extract** audio from the video with ffmpeg (mono PCM at the backend's
   native rate; the video file is only read).
2. **Enhance** with the chosen backend. ML backends process the file in 30 s
   chunks with 1 s crossfaded overlap, so a 2-hour lecture uses bounded memory.
3. **Normalize loudness** to -16 LUFS (EBU R128 via ffmpeg `loudnorm`) so all
   lectures end up at consistent, speech-appropriate volume.
4. **Mux** the enhanced audio back: video stream is stream-copied
   (`-c:v copy`, zero quality loss, fast), audio encoded as AAC 192k.
   Audio-only inputs (mp3 etc.) come back in their original format.

### Install (macOS, native — recommended over Docker for speed)

```bash
python3 -m venv .venv && source .venv/bin/activate

# Pick the backend(s) you want:
pip install deepfilternet soundfile          # DeepFilterNet3
pip install clearvoice soundfile             # ClearerVoice / MossFormer2 (recommended)
pip install resemble-enhance soundfile       # Resemble Enhance (see note below)
```

ffmpeg must be on PATH (you have it). Model weights download automatically
from Hugging Face on first run.

> **Resemble Enhance on macOS:** its pip package depends on `deepspeed`, which
> sometimes fails to build on macOS. If so:
> `pip install resemble-enhance --no-deps` then
> `pip install torch torchaudio librosa celluloid matplotlib omegaconf pandas ptflops rich resampy tabulate gradio`.
> Use `--device mps` (or fall back to `--device cpu` if you hit an unsupported
> MPS op).

### Usage

```bash
# 1. ALWAYS preview first: process 30 s starting at 5:00 to tune settings
#    (takes seconds instead of an hour, produces lecture.preview.remastered.mp4)
python remaster.py lecture.mp4 --backend clearvoice --start 300 --duration 30
python remaster.py lecture.mp4 --backend resemble   --start 300 --duration 30
python remaster.py lecture.mp4 --backend deepfilternet --start 300 --duration 30

# 2. Pick the winner by ear, then run the full lecture
python remaster.py lecture.mp4 --backend clearvoice

# Audio files work too
python remaster.py interview.mp3 --backend deepfilternet   # -> interview.remastered.mp3

# Useful flags
#   -o out.mkv          explicit output path
#   --audio-only        write enhanced .wav, skip muxing
#   --keep-wav          also keep the enhanced wav next to the video output
#   --no-loudnorm       skip loudness normalization
#   --atten-lim 24      [deepfilternet] cap noise reduction (more natural)
#   --lambd 0.7         [resemble] lower = gentler denoising
#   --denoise-only      [resemble] skip the generative stage (no hallucination risk)
#   --nr 24 --highpass 90  [ffmpeg] stronger classic denoise
```

### Docker (optional)

If you'd rather not manage Python environments:

```bash
docker build -t audio-remaster .
docker run --rm -v "$PWD:/data" -v remaster-models:/root/.cache \
    audio-remaster /data/lecture.mp4 --backend deepfilternet
```

Note: on your Mac, Docker runs CPU-only (no MPS inside containers), so native
is faster for the heavy backends. The `remaster-models` volume caches model
downloads between runs.

---

## Expectations & tips for 1964-era lecture audio

- **Steady noise (hiss, hum, projector) reduces very well.** All backends
  handle this.
- **Audience noise is the hard case.** Coughs and chair squeaks *between*
  sentences go away cleanly. Laughter and murmur *overlapping* Feynman's
  speech is speech-like, so denoisers keep some of it — expect strong
  reduction, not total removal. (Adobe Podcast has the same limitation.)
- **Bandwidth:** 1964 optical/tape audio rolls off around 5 kHz. Only the
  generative backends (`resemble`, and to a degree `clearvoice`) can
  reconstruct the missing brightness; `deepfilternet` cleans but keeps the
  vintage timbre. Some people prefer that — preview both.
- **Always A/B against the original** at several timestamps, including the
  worst segments. Generative enhancement can occasionally garble a syllable in
  heavily degraded passages; if you hear that, drop to `--denoise-only` or
  `deepfilternet` for those files.
- A 1-hour lecture takes roughly: `deepfilternet` minutes on CPU;
  `clearvoice` ~10–20 min on M4 Max; `resemble` up to a few hours on
  CPU/MPS (use `--nfe 32` to speed it up).

---

## Development notes

Verified in CI-like sandbox testing:

- Full pipeline (extract → enhance → loudnorm → mux) end-to-end with the
  `ffmpeg` backend on synthetic noisy mp4/mp3, including preview mode,
  `--audio-only`, `--keep-wav`; output durations and stream codecs checked
  (video stream is bit-identical stream copy, audio AAC 192k).
- `deepfilternet` backend import verified against **latest** torch
  (2.12) / torchaudio (2.11): the PyPI `deepfilternet` release still imports
  the removed `torchaudio.backend.common`, so `remaster.py` ships a small
  compatibility shim (`_shim_torchaudio_backend`) — no need to pin old torch.
- Chunk/crossfade logic unit-tested: identity enhancer reconstructs input to
  <1e-5, wrong-length model outputs are tolerated, single-chunk path works.
- Actual model inference (weight downloads) could not run in the sandbox
  (no network access to GitHub/HF model hosts); first run on your machine
  downloads weights automatically. Smoke-test with a 30 s preview slice:
  `python remaster.py lecture.mp4 --backend deepfilternet --start 300 --duration 30`
