# audio2midi

A command-line tool that transcribes an audio recording (a song or an
instrumental/orchestral piece) into a standard MIDI file you can open in any
DAW or music notation application. Built as a study aid: it detects the
tempo, separates the music into its structural elements, and writes each
element to its own named MIDI track.

## How it works

```
                       ┌──────────────┐
 audio file ──────────►│ tempo/beat   │ librosa beat tracking ──► BPM + beat grid
     │                 └──────────────┘
     ▼
 ┌──────────────┐   vocals ┌────────────────┐
 │   Demucs     │──────────► melody         │ Basic Pitch (neural, local)
 │  (htdemucs)  │   other  │  transcription │ + monophonic "top line" reduction
 │  4-stem      │──────────► chord          │ CQT chroma + chord templates
 │  separation  │   bass   │  detection     │ + Viterbi smoothing
 │              │   drums  │                │ per-band onset flux
 │              │──────────► drum           │ → GM drum map
 └──────────────┘          └───────┬────────┘
                                   ▼
                        beat-aware quantization
                                   ▼
                        multi-track MIDI (format 1)
                        + chord labels as lyric events
```

Two local models do the heavy lifting; both download/ship automatically and
run offline on CPU (GPU used if available):

| Task | Model / algorithm | Why |
|------|-------------------|-----|
| Source separation | [Demucs v4 (htdemucs)](https://github.com/adefossez/demucs), Meta | Reference open-source model for vocals/drums/bass/other stems |
| Note transcription | [Basic Pitch](https://github.com/spotify/basic-pitch), Spotify (ICASSP 2022) | Lightweight polyphonic audio-to-MIDI network, runs via ONNX/TF locally, outputs onsets, offsets, amplitude and pitch bends |
| Tempo & beats | [librosa](https://librosa.org) beat tracker | Robust DSP baseline; beat grid also drives quantization |
| Chords | CQT chroma + template matching + Viterbi | Transparent, tunable, no extra model download |
| Drums | Per-band (low/mid/high) spectral onset flux | Handles simultaneous kick + hi-hat hits |

## Installation

Requires Python 3.9–3.11 (Basic Pitch does not support 3.12 yet).

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install ./audio2midi
```

The first run downloads the Demucs weights (~80 MB) to the torch cache.
The Basic Pitch model ships inside the pip package.

## Usage

```bash
audio2midi song.mp3 -m 3-section          # melody + chords + drums
audio2midi piece.wav -m orchestral        # woodwinds/brass/strings/basses/percussion
audio2midi song.flac -m melody            # just the tune
audio2midi song.wav -m harmony            # just the chords
audio2midi song.wav -m 2-section -o out.mid
```

Output defaults to `<input>.<mode>.mid`. The file is a format-1 MIDI with
the detected tempo, a time signature, one named track per element, and —
for modes with harmony — the chord labels (C, Am, G7, …) embedded as lyric
events, which most DAWs and notation apps display.

### Modes

| Mode | Tracks produced |
|------|-----------------|
| `orchestral` | Woodwinds, Brass, Strings (high), Strings (low), Basses, Percussion |
| `3-section` | Melody, Harmony (chord blocks), Rhythm (GM drums) |
| `2-section` | Melody, Harmony |
| `melody` | Melody only |
| `harmony` | Harmony only (chords) |

### Useful options

```
--bpm 128                  override tempo detection
--quantize off|4|8|16|32   snap to grid (default: 16th notes); quantization is
                           beat-aware, so it follows tempo drift in the recording
--melody-source auto|vocals|instrumental
                           auto uses vocals when they carry enough energy
--chord-vocab triads|sevenths
--orchestral-strategy timbre|register
--no-separation            skip Demucs (for already-isolated material);
                           falls back to harmonic/percussive splitting
--stems-dir stems/         also export the separated wav stems
--separate-files           additionally write one MIDI file per part
--onset-threshold 0.4      more sensitive note onsets (default 0.5)
--frame-threshold 0.3      note sustain sensitivity
--min-note-len 80          drop notes shorter than this (ms)
--time-signature 3/4
--device auto|cpu|cuda
-v                         verbose logging
```

### Reading the output

* **Tempo** — written into the MIDI header; bars/beats line up in your DAW.
* **Melody** — a strictly monophonic line. Extracted from the vocal stem
  when vocals dominate, otherwise from the lead instrument stem, then
  reduced to a single voice preferring louder notes and small intervals.
* **Harmony** — block chords (bass root + close voicing) per detected chord
  segment, plus the chord names as lyrics at each change.
* **Rhythm** — General MIDI drums (kick 36, snare 38, closed hat 42,
  crash 49) on the drum channel.
* **Velocities** — scaled from the model's note amplitudes, so dynamics
  survive the transcription.

## Design notes & research

**Why Demucs + Basic Pitch?** Transcribing a full mix with a single
polyphonic model conflates all voices. Separating first, then transcribing
each stem, gives far cleaner per-element results and is the same
architecture used by commercial tools. Demucs v4 (hybrid transformer) is
the strongest permissively-licensed separation model available offline;
alternatives considered: [Spleeter](https://github.com/deezer/spleeter)
(older, weaker), [Open-Unmix](https://github.com/sigsep/open-unmix-pytorch)
(weaker), [MVSEP/UVR model zoo](https://mvsep.com/) (strong but heavier
tooling). For note transcription, Google's
[MT3](https://arxiv.org/pdf/2111.03017) is the research reference for
multi-instrument transcription but is JAX-based and impractical to run
locally; Spotify's Basic Pitch is the best quality/weight trade-off and is
what several commercial converters build on.

**Orchestral mode is heuristic.** True orchestral *family* separation
(strings vs. woodwinds vs. brass) is an open research problem — datasets
and models exist ([SynthSOD](https://arxiv.org/html/2409.10995v1),
[EnsembleSet](https://arxiv.org/pdf/2209.14458), X-UMX family,
[score-informed separation](https://arxiv.org/html/2503.07352v1)) but no
production-grade pretrained checkpoint is publicly distributed. This tool
instead: (1) uses Demucs to isolate percussion and the bass register,
(2) transcribes the remaining polyphony with Basic Pitch, and (3) assigns
each note to a section using register priors plus per-note timbre features
(harmonic centroid, odd/even harmonic balance, attack sharpness) and
vibrato depth measured from the note's pitch-bend track. Expect section
assignment to be approximate; `--orchestral-strategy register` gives a
simpler, more predictable split. The separation seam is narrow
(`separation.py`), so a dedicated orchestral model can be plugged in when
one becomes available.

**Quantization is beat-aware.** Notes are mapped into beat space using the
*detected* beat times (which follow the performance's tempo drift), snapped
to the chosen subdivision, and re-emitted on a constant-BPM timeline — so
notation stays aligned to barlines even for human performances.

## Limitations

* Transcription quality tracks Basic Pitch's: dense polyphony, heavy
  distortion/reverb, and extreme registers reduce accuracy.
* One global tempo/time signature is written (no tempo-change map yet).
* Drum vocabulary is kick/snare/hat/crash; toms and cymbal nuances land on
  the nearest of those.
* Orchestral section assignment is heuristic (see above).
* Chord vocabulary is maj/min (+7ths with `--chord-vocab sevenths`); no
  inversions or extended jazz harmony.

## Development

```bash
pip install -e ./audio2midi
python audio2midi/tests/test_pipeline.py   # or: pytest audio2midi/tests
```

`tests/make_test_audio.py` synthesizes a 120 BPM test song (known melody,
C–Am–F–G progression, programmed drums) so accuracy is asserted against
ground truth without shipping copyrighted audio.
