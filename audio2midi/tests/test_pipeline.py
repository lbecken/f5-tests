"""Smoke/accuracy tests against synthetic audio with known ground truth.

Run with pytest, or directly:  python tests/test_pipeline.py

The Demucs test injects an *untrained* HTDemucs instance so the full
separation code path is exercised without downloading pretrained weights
(useful on sandboxed CI). Real separation quality is only observable with
the pretrained model, which downloads automatically on normal machines.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import make_test_audio as synth  # noqa: E402

SR = synth.SR
BPM = synth.BPM


def _f1(detected, truth, tol=0.08):
    used, tp = set(), 0
    for t, p in detected:
        for j, (gt, gp) in enumerate(truth):
            if j not in used and gp == p and abs(t - gt) < tol:
                used.add(j)
                tp += 1
                break
    prec = tp / len(detected) if detected else 0.0
    rec = tp / len(truth) if truth else 0.0
    return 2 * prec * rec / (prec + rec) if prec + rec else 0.0


def test_tempo():
    from audio2midi.tempo import detect_tempo

    audio = synth.render(n_bars=8)
    bpm, beats = detect_tempo(audio, SR)
    assert abs(bpm - BPM) < 3, f"expected ~{BPM}, got {bpm}"
    assert len(beats) > 20
    print(f"  tempo: {bpm:.1f} BPM ok")


def test_chords():
    from audio2midi.harmony import detect_chords
    from audio2midi.tempo import detect_tempo

    audio = synth.render(n_bars=8, with_drums=False)
    bpm, beats = detect_tempo(audio, SR)
    segs = detect_chords(audio, SR, beats)
    labels = [s.label for s in segs]
    expected = ["C", "Am", "F", "G"] * 2
    matches = sum(1 for a, b in zip(labels, expected) if a == b)
    assert matches >= 6, f"chords {labels} vs {expected}"
    print(f"  chords: {labels} ok")


def test_melody():
    from audio2midi.melody import monophonic_reduction
    from audio2midi.transcription import transcribe

    audio = synth.render(n_bars=4, with_drums=False)
    notes = transcribe(audio, SR)
    line = monophonic_reduction(notes)
    truth = [(i * synth.BEAT, p) for i, p in enumerate(synth.MELODY[:16])]
    detected = [(n.start, n.pitch) for n in line]
    score = _f1(detected, truth, tol=0.15)
    assert score >= 0.6, f"melody F1 {score:.2f} too low: {detected}"
    print(f"  melody: F1={score:.2f} ({len(line)} notes) ok")


def test_drums():
    from audio2midi.percussion import transcribe_drums

    full = synth.render(n_bars=8)
    drums_only = full - synth.render(n_bars=8, with_drums=False)
    hits = transcribe_drums(drums_only, SR)
    kick_truth = [(i * 1.0, 36) for i in range(16)]
    hat_truth = [(i * 0.25, 42) for i in range(64)]
    kick_f1 = _f1([(h.start, h.pitch) for h in hits if h.pitch == 36], kick_truth)
    hat_f1 = _f1([(h.start, h.pitch) for h in hits if h.pitch == 42], hat_truth)
    assert kick_f1 >= 0.7, f"kick F1 {kick_f1:.2f}"
    assert hat_f1 >= 0.6, f"hat F1 {hat_f1:.2f}"
    print(f"  drums: kick F1={kick_f1:.2f} hat F1={hat_f1:.2f} ok")


def test_demucs_plumbing():
    """Exercise the separation code path with an untrained model."""
    from demucs.htdemucs import HTDemucs

    from audio2midi.separation import separate

    model = HTDemucs(sources=["drums", "bass", "other", "vocals"])
    audio = synth.render(n_bars=2)
    stereo = np.stack([audio, audio])
    stems = separate(stereo, SR, model=model, device="cpu")
    assert set(stems) == {"drums", "bass", "other", "vocals"}
    for name, stem in stems.items():
        assert stem.shape == stereo.shape, f"{name}: {stem.shape}"
    print("  demucs plumbing: 4 stems, shapes ok")


def test_full_pipeline_modes():
    from audio2midi.pipeline import Config, transcribe_file

    audio = synth.render(n_bars=4)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "song.wav"
        import soundfile as sf

        sf.write(wav, audio, SR)
        for mode in ("melody", "harmony", "2section", "3section", "orchestral"):
            out = Path(tmp) / f"{mode}.mid"
            cfg = Config(mode=mode, no_separation=True)
            result, files = transcribe_file(wav, out, cfg)
            assert out.exists()
            import pretty_midi

            pm = pretty_midi.PrettyMIDI(str(out))
            _, tempi = pm.get_tempo_changes()
            assert abs(tempi[0] - BPM) < 3
            assert pm.time_signature_changes
            n_notes = sum(len(i.notes) for i in pm.instruments)
            assert n_notes > 0, f"{mode}: empty MIDI"
            print(f"  mode {mode}: {len(pm.instruments)} tracks, {n_notes} notes ok")


def test_tempo_map():
    """A 100->135 BPM piece must yield a MIDI tempo map covering both."""
    import pretty_midi
    import soundfile as sf

    from audio2midi.pipeline import Config, transcribe_file

    audio = np.concatenate(
        [synth.render(n_bars=4, bpm=100), synth.render(n_bars=4, bpm=135)]
    )
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "ramp.wav"
        sf.write(wav, audio, SR)
        out = Path(tmp) / "ramp.mid"
        cfg = Config(mode="melody", no_separation=True)
        transcribe_file(wav, out, cfg)
        pm = pretty_midi.PrettyMIDI(str(out))
        _, tempi = pm.get_tempo_changes()
        assert len(tempi) >= 2, f"expected a tempo map, got {tempi}"
        assert any(abs(t - 100) < 8 for t in tempi), f"no ~100 BPM region: {tempi}"
        assert any(abs(t - 135) < 8 for t in tempi), f"no ~135 BPM region: {tempi}"

        # Playback fidelity: quantized note times must stay close to the
        # audio-domain truth (one melody note per beat).
        b1, b2 = 60.0 / 100, 60.0 / 135
        truth = [i * b1 for i in range(16)] + [16 * b1 + i * b2 for i in range(16)]
        starts = [n.start for inst in pm.instruments for n in inst.notes]
        hits = sum(1 for t in truth if any(abs(s - t) < 0.12 for s in starts))
        assert hits >= 22, f"only {hits}/32 melody onsets near truth"

        # Static mode: same content, single tempo event.
        out2 = Path(tmp) / "static.mid"
        cfg2 = Config(mode="melody", no_separation=True, static_tempo=True)
        transcribe_file(wav, out2, cfg2)
        _, tempi2 = pretty_midi.PrettyMIDI(str(out2)).get_tempo_changes()
        assert len(tempi2) == 1
    print(f"  tempo map: {len(tempi)} changes, spans 100->135 BPM, "
          f"{hits}/32 onsets aligned ok")


def test_piano_transcriber():
    """Full mode with the TransKun piano model on a synthetic piano piece."""
    try:
        import transkun  # noqa: F401
    except ImportError:
        print("  piano: transkun not installed, skipping (pip install "
              "'audio2midi[piano]')")
        return

    import pretty_midi
    import soundfile as sf

    from audio2midi.pipeline import Config, transcribe_file

    audio, truth = synth.render_piano()
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "piano.wav"
        sf.write(wav, audio, SR)
        out = Path(tmp) / "piano.mid"
        cfg = Config(
            mode="full",
            transcriber="piano",
            no_separation=True,
            quantize=0,          # compare raw timings against truth
            min_note_len_ms=30.0,
            device="cpu",
        )
        transcribe_file(wav, out, cfg)
        pm = pretty_midi.PrettyMIDI(str(out))
        assert len(pm.instruments) == 1 and pm.instruments[0].name == "Piano"
        det = [(n.start, n.pitch) for n in pm.instruments[0].notes]
        score = _f1(det, truth, tol=0.12)
        assert score >= 0.85, f"piano F1 {score:.2f} too low"
        # Dynamics must survive: the LH (vel 0.4) should be quieter than RH.
        vels = [n.velocity for n in pm.instruments[0].notes]
        assert max(vels) - min(vels) >= 10, "velocities look flat"
    print(f"  piano: F1={score:.2f} over {len(det)} notes, dynamic range "
          f"{min(vels)}-{max(vels)} ok")


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            print(f"{name}:")
            fn()
    print("ALL TESTS PASSED")
