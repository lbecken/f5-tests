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
| Piano transcription (optional) | [TransKun v2](https://github.com/Yujia-Yan/Skipping-The-Frame-Level) (Yan et al., NeurIPS 2021) | Piano-specific model trained on MAESTRO; much higher accuracy on piano recordings, with per-note velocities and sustain-pedal capture |
| Tempo & beats | [librosa](https://librosa.org) beat tracker (flexible tightness) | Follows tempo changes/rubato; beat grid drives the tempo map and quantization |
| Chords | CQT chroma + template matching + Viterbi | Transparent, tunable, no extra model download |
| Drums | Per-band (low/mid/high) spectral onset flux | Handles simultaneous kick + hi-hat hits |

## Installation

Requires Python 3.9–3.11 (Basic Pitch does not support 3.12 yet).

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install ./audio2midi
pip install './audio2midi[piano]'   # optional: TransKun piano model
```

The first run downloads the Demucs weights (~80 MB) to the torch cache.
The Basic Pitch and TransKun models ship inside their pip packages.

## Usage

```bash
audio2midi song.mp3 -m 3-section          # melody + chords + drums
audio2midi piece.wav -m orchestral        # woodwinds/brass/strings/basses/percussion
audio2midi song.flac -m melody            # just the tune
audio2midi song.wav -m harmony            # just the chords
audio2midi song.wav -m 2-section -o out.mid

# solo piano: note-for-note transcription with the piano-specific model
audio2midi sonata.wav -m full --transcriber piano --no-separation
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
| `full` (alias `piano`) | Complete note-for-note transcription on one track, including sustain pedal (CC64) when the piano transcriber is used |

### Useful options

```
--bpm 128                  override tempo detection
--static-tempo             write one average BPM instead of a tempo-change map
--quantize off|4|8|16|32   snap to grid (default: 16th notes); quantization is
                           beat-aware, so it follows tempo drift in the recording
--melody-source auto|vocals|instrumental
                           auto uses vocals when they carry enough energy
--transcriber basic-pitch|piano
                           'piano' = TransKun, far more accurate on piano
                           recordings (real velocities, pedal); needs the
                           [piano] extra
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

* **Tempo** — a full tempo map is written on the conductor track: tempo
  changes measured from the performance (accelerando, section changes,
  rubato) appear as `set_tempo` events, so playback follows the recording's
  pace while bars/beats stay aligned to the grid. `--static-tempo` writes a
  single average BPM instead.
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

**Piano gets its own model.** General-purpose transcribers plateau on
piano's dense polyphony. The optional `--transcriber piano` backend runs
[TransKun v2](https://github.com/Yujia-Yan/Skipping-The-Frame-Level)
("Skipping the Frame-Level: Event-Based Piano Transcription With Neural
Semi-CRFs"), trained on the MAESTRO dataset — state-of-the-art-class
accuracy with genuine per-note MIDI velocities and sustain-pedal events
(written as CC64). It was chosen over ByteDance's high-resolution piano
model because its weights ship inside the pip package (no runtime
checkpoint download) and its benchmark results are as good or better. For
solo piano recordings use `-m full --transcriber piano --no-separation`:
the model sees the untouched signal, and the output is a single Piano
track with pedal, ready for notation software.

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

**Tempo map + beat-aware quantization.** Notes are placed at their *beat
position* (via interpolation over the detected beat times) rather than at
wall-clock seconds, and the conductor track carries the measured tempo
changes (median-smoothed, with hysteresis so beat-tracker jitter doesn't
become micro tempo events). Quantization snaps in beat space. The result:
notation stays aligned to barlines even for human performances with tempo
drift, and playback timing still matches the recording.

## Limitations

* Transcription quality tracks the chosen backend's: for Basic Pitch,
  dense polyphony, heavy distortion/reverb and extreme registers reduce
  accuracy; the piano backend is excellent on piano but wrong for other
  instruments.
* One global time signature is written (tempo changes are mapped, meter
  changes are not).
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
