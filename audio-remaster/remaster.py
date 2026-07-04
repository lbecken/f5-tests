#!/usr/bin/env python3
"""
remaster.py — speech-focused audio remastering for old videos and recordings.

Extracts the audio track from a video (mp4/mkv/avi/...) or takes an audio file
(mp3/wav/...), runs it through a speech-enhancement backend, normalizes
loudness, and muxes the enhanced audio back into the original video without
re-encoding the video stream.

Backends (pick with --backend):
  ffmpeg        Classic DSP (afftdn spectral denoise + filters). No ML deps,
                fast, conservative. Good baseline / fallback.
  deepfilternet DeepFilterNet3. Fast (realtime on CPU), faithful denoiser.
                pip install deepfilternet
  clearvoice    ClearerVoice-Studio MossFormer2_SE_48K (48 kHz speech
                enhancement, Adobe-Podcast-like quality).
                pip install clearvoice
  resemble      Resemble Enhance (denoise + generative enhancement /
                bandwidth extension). Closest to Adobe Podcast "v2" behavior,
                slowest, can hallucinate on very degraded speech.
                pip install resemble-enhance

Examples:
  # Quick preview of a 30 s slice starting at 5 min, to tune settings fast:
  python remaster.py lecture.mp4 --backend clearvoice --start 300 --duration 30

  # Full run, best quality:
  python remaster.py lecture.mp4 --backend clearvoice

  # No ML dependencies at all:
  python remaster.py lecture.mp4 --backend ffmpeg
"""

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

VIDEO_EXTS = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".mpg", ".mpeg", ".ts"}

CHUNK_SECONDS = 30.0   # ML backends process the file in chunks this long
OVERLAP_SECONDS = 1.0  # crossfaded overlap between chunks


def run(cmd, **kw):
    """Run a command, raising with its stderr on failure."""
    res = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if res.returncode != 0:
        sys.exit(f"command failed: {' '.join(map(str, cmd))}\n{res.stderr[-2000:]}")
    return res


def ffprobe(path):
    res = run(["ffprobe", "-v", "quiet", "-print_format", "json",
               "-show_streams", "-show_format", str(path)])
    info = json.loads(res.stdout)
    streams = info.get("streams", [])
    return {
        "has_video": any(s["codec_type"] == "video" for s in streams),
        "has_audio": any(s["codec_type"] == "audio" for s in streams),
        "duration": float(info.get("format", {}).get("duration", 0) or 0),
    }


def extract_audio(src, wav_path, sr, start=None, duration=None):
    """Extract/convert audio to mono PCM wav at the backend's sample rate."""
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    if start is not None:
        cmd += ["-ss", str(start)]
    cmd += ["-i", str(src)]
    if duration is not None:
        cmd += ["-t", str(duration)]
    cmd += ["-vn", "-sn", "-ac", "1", "-ar", str(sr), "-c:a", "pcm_f32le", str(wav_path)]
    run(cmd)


def loudnorm(in_wav, out_wav, sr):
    """EBU R128 loudness normalization to a speech-friendly -16 LUFS."""
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(in_wav),
         "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", str(sr),
         "-c:a", "pcm_s16le", str(out_wav)])


def mux(original, wav, output, is_video, start=None, duration=None):
    """Put the enhanced audio back. Video streams are copied, never re-encoded."""
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    if is_video:
        if start is not None:
            cmd += ["-ss", str(start)]
        if duration is not None:
            cmd += ["-t", str(duration)]
        cmd += ["-i", str(original)]
        cmd += ["-i", str(wav), "-map", "0:v:0", "-map", "1:a:0",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest"]
        if output.suffix.lower() == ".mkv":
            cmd += ["-map", "0:s?", "-c:s", "copy"]
        if output.suffix.lower() in (".mp4", ".m4v", ".mov"):
            cmd += ["-movflags", "+faststart"]
        cmd += [str(output)]
    else:
        ext = output.suffix.lower()
        if ext == ".mp3":
            codec = ["-c:a", "libmp3lame", "-b:a", "192k"]
        elif ext in (".m4a", ".aac", ".mp4"):
            codec = ["-c:a", "aac", "-b:a", "192k"]
        elif ext in (".flac",):
            codec = ["-c:a", "flac"]
        else:  # wav or anything else: keep PCM
            codec = ["-c:a", "pcm_s16le"]
        cmd += ["-i", str(wav)] + codec + [str(output)]
    run(cmd)


# ---------------------------------------------------------------------------
# Chunked enhancement scaffolding (shared by all ML backends)
# ---------------------------------------------------------------------------

def fix_length(y, n):
    import numpy as np
    if len(y) > n:
        return y[:n]
    if len(y) < n:
        return np.pad(y, (0, n - len(y)))
    return y


def chunked_enhance(x, sr, fn, label):
    """Run fn over overlapping chunks of x and crossfade the results."""
    import numpy as np
    n = len(x)
    chunk = int(CHUNK_SECONDS * sr)
    ov = int(OVERLAP_SECONDS * sr)
    hop = chunk - ov
    if n <= chunk:
        return fix_length(fn(x), n)

    out = np.zeros(n, dtype=np.float32)
    weight = np.zeros(n, dtype=np.float32)
    pos = 0
    total = (n - ov + hop - 1) // hop
    i = 0
    while pos < n:
        seg = x[pos:pos + chunk]
        i += 1
        print(f"  [{label}] chunk {i}/{total} "
              f"({pos / sr:7.1f}s – {(pos + len(seg)) / sr:7.1f}s)", flush=True)
        y = fix_length(fn(seg), len(seg))
        w = np.ones(len(seg), dtype=np.float32)
        ramp = min(ov, len(seg))
        if pos > 0:
            w[:ramp] = np.linspace(0.0, 1.0, ramp, dtype=np.float32)
        if pos + chunk < n and len(seg) > ramp:
            w[-ramp:] *= np.linspace(1.0, 0.0, ramp, dtype=np.float32)
        out[pos:pos + len(seg)] += y * w
        weight[pos:pos + len(seg)] += w
        if pos + chunk >= n:
            break
        pos += hop
    return out / np.maximum(weight, 1e-8)


def pick_device(requested):
    import torch
    if requested != "auto":
        return requested
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


# ---------------------------------------------------------------------------
# Backends. Each returns (enhance_fn, model_sample_rate); enhance_fn maps a
# mono float32 numpy array to a mono float32 numpy array at the same rate.
# ---------------------------------------------------------------------------

def make_backend_deepfilternet(args):
    import torch
    from df.enhance import enhance, init_df
    model, df_state, _ = init_df()  # downloads DeepFilterNet3 on first run

    def fn(seg):
        with torch.no_grad():
            t = torch.from_numpy(seg).unsqueeze(0)
            kw = {}
            if args.atten_lim is not None:
                kw["atten_lim_db"] = args.atten_lim
            y = enhance(model, df_state, t, **kw)
        return y.squeeze(0).cpu().numpy()

    return fn, df_state.sr()  # 48000


def make_backend_clearvoice(args):
    import soundfile as sf
    from clearvoice import ClearVoice
    cv = ClearVoice(task="speech_enhancement", model_names=["MossFormer2_SE_48K"])
    tmpdir = Path(tempfile.mkdtemp(prefix="cv_"))

    def fn(seg):
        import numpy as np
        p = tmpdir / "chunk.wav"
        sf.write(p, seg, 48000, subtype="FLOAT")
        out = cv(input_path=str(p), online_write=False)
        out = np.asarray(out, dtype=np.float32).squeeze()
        return out

    return fn, 48000


def make_backend_resemble(args):
    import torch
    from resemble_enhance.enhancer.inference import denoise, enhance
    device = pick_device(args.device)
    print(f"  [resemble] device: {device}")

    def fn(seg):
        dwav = torch.from_numpy(seg)
        if args.denoise_only:
            y, _ = denoise(dwav, 44100, device)
        else:
            y, _ = enhance(dwav, 44100, device, nfe=args.nfe,
                           solver="midpoint", lambd=args.lambd, tau=args.tau)
        return y.cpu().float().numpy()

    return fn, 44100


def enhance_ml(in_wav, out_wav, args):
    import numpy as np
    import soundfile as sf
    x, sr = sf.read(in_wav, dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)
    make = {
        "deepfilternet": make_backend_deepfilternet,
        "clearvoice": make_backend_clearvoice,
        "resemble": make_backend_resemble,
    }[args.backend]
    fn, model_sr = make(args)
    assert sr == model_sr, f"expected {model_sr} Hz wav, got {sr}"
    y = chunked_enhance(x, sr, fn, args.backend)
    peak = float(np.max(np.abs(y)) or 1.0)
    if peak > 1.0:
        y = y / peak
    sf.write(out_wav, y, sr, subtype="FLOAT")


def enhance_ffmpeg(in_wav, out_wav, args):
    """Pure-DSP fallback: spectral denoise + gentle band shaping."""
    filters = []
    if args.highpass:
        filters.append(f"highpass=f={args.highpass}")
    filters.append(f"afftdn=nr={args.nr}:nf=-30:tn=1")
    if args.lowpass:
        filters.append(f"lowpass=f={args.lowpass}")
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(in_wav),
         "-af", ",".join(filters), "-c:a", "pcm_f32le", str(out_wav)])


BACKEND_SR = {"ffmpeg": 48000, "deepfilternet": 48000,
              "clearvoice": 48000, "resemble": 44100}


def main():
    p = argparse.ArgumentParser(
        description="Enhance speech clarity and reduce background noise in "
                    "videos and audio files.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    p.add_argument("input", type=Path, help="video (mp4/mkv/avi/...) or audio (mp3/wav/...)")
    p.add_argument("-o", "--output", type=Path, default=None,
                   help="output path (default: <input>.remastered.<ext>)")
    p.add_argument("--backend", default="deepfilternet",
                   choices=["ffmpeg", "deepfilternet", "clearvoice", "resemble"])
    p.add_argument("--start", type=float, default=None, metavar="SECONDS",
                   help="process only a slice starting here (preview mode)")
    p.add_argument("--duration", type=float, default=None, metavar="SECONDS",
                   help="length of the preview slice")
    p.add_argument("--audio-only", action="store_true",
                   help="write enhanced audio as .wav, skip muxing into video")
    p.add_argument("--no-loudnorm", action="store_true",
                   help="skip final loudness normalization")
    p.add_argument("--keep-wav", action="store_true",
                   help="also keep the intermediate enhanced .wav next to the output")
    p.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda", "mps"],
                   help="compute device for ML backends")
    # ffmpeg backend knobs
    p.add_argument("--nr", type=float, default=18,
                   help="[ffmpeg] afftdn noise reduction in dB")
    p.add_argument("--highpass", type=float, default=70,
                   help="[ffmpeg] high-pass cutoff Hz (0 = off)")
    p.add_argument("--lowpass", type=float, default=0,
                   help="[ffmpeg] low-pass cutoff Hz (0 = off)")
    # deepfilternet knobs
    p.add_argument("--atten-lim", type=float, default=None,
                   help="[deepfilternet] limit max noise attenuation in dB "
                        "(e.g. 24 keeps a natural noise floor)")
    # resemble knobs
    p.add_argument("--denoise-only", action="store_true",
                   help="[resemble] denoise without generative enhancement")
    p.add_argument("--lambd", type=float, default=0.9,
                   help="[resemble] denoise strength 0..1")
    p.add_argument("--tau", type=float, default=0.5,
                   help="[resemble] CFM prior temperature")
    p.add_argument("--nfe", type=int, default=64,
                   help="[resemble] CFM function evaluations (quality vs speed)")
    args = p.parse_args()

    if not args.input.exists():
        sys.exit(f"input not found: {args.input}")
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        sys.exit("ffmpeg/ffprobe not found on PATH")

    info = ffprobe(args.input)
    if not info["has_audio"]:
        sys.exit("input has no audio stream")
    is_video = info["has_video"] and args.input.suffix.lower() in VIDEO_EXTS
    preview = args.start is not None or args.duration is not None

    out = args.output
    if out is None:
        stem = args.input.stem + (".preview" if preview else "") + ".remastered"
        if args.audio_only or not is_video:
            ext = ".wav" if args.audio_only else (args.input.suffix or ".wav")
        else:
            # aac-in-avi is a bad idea; move avi output to mkv
            ext = ".mkv" if args.input.suffix.lower() == ".avi" else args.input.suffix
        out = args.input.with_name(stem + ext)

    sr = BACKEND_SR[args.backend]
    with tempfile.TemporaryDirectory(prefix="remaster_") as td:
        td = Path(td)
        raw = td / "raw.wav"
        enhanced = td / "enhanced.wav"
        final = td / "final.wav"

        print(f"[1/4] extracting audio ({sr} Hz mono) ...", flush=True)
        extract_audio(args.input, raw, sr, args.start, args.duration)

        print(f"[2/4] enhancing with backend '{args.backend}' ...", flush=True)
        if args.backend == "ffmpeg":
            enhance_ffmpeg(raw, enhanced, args)
        else:
            enhance_ml(raw, enhanced, args)

        if args.no_loudnorm:
            final = enhanced
            print("[3/4] loudness normalization skipped")
        else:
            print("[3/4] normalizing loudness (-16 LUFS) ...", flush=True)
            loudnorm(enhanced, final, sr)

        print(f"[4/4] writing {out} ...", flush=True)
        if args.audio_only or not is_video:
            mux(args.input, final, out, is_video=False)
        else:
            mux(args.input, final, out, is_video=True,
                start=args.start, duration=args.duration)
        if args.keep_wav:
            kept = out.with_suffix(".enhanced.wav")
            shutil.copy2(final, kept)
            print(f"      kept intermediate wav: {kept}")

    print(f"done: {out}")


if __name__ == "__main__":
    main()
