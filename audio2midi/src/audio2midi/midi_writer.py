"""Assemble and write the final MIDI file (format 1, DAW/notation friendly)."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional, Tuple

import pretty_midi

from .events import AnalysisResult, amplitude_to_velocity, normalize_amplitudes

log = logging.getLogger(__name__)


def write_midi(
    result: AnalysisResult,
    path: str | Path,
    time_signature: Tuple[int, int] = (4, 4),
    separate_files: bool = False,
) -> list:
    """Write the analysis to `path`. Returns the list of files written."""
    written = []
    pm = _build(result, time_signature)
    pm.write(str(path))
    written.append(Path(path))
    log.info("Wrote %s (%d tracks)", path, len(pm.instruments))

    if separate_files:
        base = Path(path)
        for part in result.parts:
            if not part.notes:
                continue
            single = AnalysisResult(
                bpm=result.bpm,
                beat_times=result.beat_times,
                parts=[part],
                chords=result.chords if "harmony" in part.name.lower() else [],
            )
            slug = part.name.lower().replace(" ", "-").replace("(", "").replace(")", "")
            out = base.with_name(f"{base.stem}.{slug}{base.suffix}")
            _build(single, time_signature).write(str(out))
            written.append(out)
            log.info("Wrote %s", out)
    return written


def _build(
    result: AnalysisResult, time_signature: Tuple[int, int]
) -> pretty_midi.PrettyMIDI:
    pm = pretty_midi.PrettyMIDI(initial_tempo=result.bpm)
    pm.time_signature_changes.append(
        pretty_midi.TimeSignature(time_signature[0], time_signature[1], 0.0)
    )

    for part in result.parts:
        if not part.notes:
            continue
        inst = pretty_midi.Instrument(
            program=part.program, is_drum=part.is_drum, name=part.name
        )
        normalize_amplitudes(part.notes)
        for n in part.notes:
            inst.notes.append(
                pretty_midi.Note(
                    velocity=amplitude_to_velocity(n.amplitude),
                    pitch=int(n.pitch),
                    start=float(n.start),
                    end=float(max(n.end, n.start + 0.02)),
                )
            )
        pm.instruments.append(inst)

    # Chord labels ride along as lyric events so DAWs/notation apps that
    # display lyrics/markers show the harmonic analysis.
    for seg in result.chords:
        pm.lyrics.append(pretty_midi.Lyric(text=seg.label, time=float(seg.start)))

    return pm
