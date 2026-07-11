"""Assemble and write the final MIDI file (format 1, DAW/notation friendly).

Events are placed at their *beat* position (via the tempo map built from the
detected beats), and the conductor track carries the tempo changes measured
from the performance. With ``static_tempo=True`` a single average tempo is
written instead — the note ticks are identical, only playback pacing differs.
"""

from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import List, Tuple

import mido

from .events import AnalysisResult, Part, amplitude_to_velocity, normalize_amplitudes
from .tempomap import TempoMap

log = logging.getLogger(__name__)

TICKS_PER_BEAT = 480
DRUM_CHANNEL = 9


def write_midi(
    result: AnalysisResult,
    path: str | Path,
    time_signature: Tuple[int, int] = (4, 4),
    separate_files: bool = False,
    static_tempo: bool = False,
) -> List[Path]:
    """Write the analysis to `path`. Returns the list of files written."""
    tmap = TempoMap(result.beat_times, result.bpm)
    written = [Path(path)]
    _build(result, result.parts, tmap, time_signature, static_tempo).save(str(path))
    log.info(
        "Wrote %s (%d tracks, %s tempo)",
        path,
        len(result.parts),
        "static" if static_tempo else "mapped",
    )

    if separate_files:
        base = Path(path)
        for part in result.parts:
            if not part.notes:
                continue
            slug = (
                part.name.lower().replace(" ", "-").replace("(", "").replace(")", "")
            )
            out = base.with_name(f"{base.stem}.{slug}{base.suffix}")
            chords = result.chords if part.name == "Harmony" else []
            sub = AnalysisResult(
                bpm=result.bpm,
                beat_times=result.beat_times,
                parts=[part],
                chords=chords,
            )
            _build(sub, [part], tmap, time_signature, static_tempo).save(str(out))
            written.append(out)
            log.info("Wrote %s", out)
    return written


def _build(
    result: AnalysisResult,
    parts: List[Part],
    tmap: TempoMap,
    time_signature: Tuple[int, int],
    static_tempo: bool,
) -> mido.MidiFile:
    # Pickup notes before the first detected beat get negative beat
    # positions; shift everything right by whole beats so ticks stay >= 0.
    starts = [n.start for p in parts for n in p.notes]
    starts += [c.start for c in result.chords]
    min_beat = min((tmap.time_to_beat(t) for t in starts), default=0.0)
    beat_offset = float(math.ceil(-min_beat)) if min_beat < 0 else 0.0

    def to_tick(t: float) -> int:
        return max(0, int(round((tmap.time_to_beat(t) + beat_offset) * TICKS_PER_BEAT)))

    mid = mido.MidiFile(ticks_per_beat=TICKS_PER_BEAT, type=1)

    # Conductor track: time signature, tempo map, chord labels.
    conductor: List[Tuple[int, int, mido.Message]] = []
    conductor.append(
        (0, 0, mido.MetaMessage(
            "time_signature",
            numerator=time_signature[0],
            denominator=time_signature[1],
            time=0,
        ))
    )
    if static_tempo:
        conductor.append(
            (0, 0, mido.MetaMessage(
                "set_tempo", tempo=mido.bpm2tempo(tmap.average_bpm), time=0
            ))
        )
    else:
        for beat_pos, sec_per_beat in tmap.tempo_events():
            tick = max(0, int(round((beat_pos + beat_offset) * TICKS_PER_BEAT)))
            tempo = min(int(round(sec_per_beat * 1_000_000)), 0xFFFFFF)
            conductor.append(
                (tick, 0, mido.MetaMessage("set_tempo", tempo=tempo, time=0))
            )
    for seg in result.chords:
        tick = to_tick(seg.start)
        # Lyric events are widely displayed by notation apps, markers by DAWs.
        conductor.append(
            (tick, 1, mido.MetaMessage("lyrics", text=seg.label, time=0))
        )
        conductor.append(
            (tick, 1, mido.MetaMessage("marker", text=seg.label, time=0))
        )
    mid.tracks.append(_to_track(conductor, name="conductor"))

    # One track per part.
    next_channel = 0
    for part in parts:
        if not part.notes:
            continue
        if part.is_drum:
            channel = DRUM_CHANNEL
        else:
            if next_channel == DRUM_CHANNEL:
                next_channel += 1
            channel = min(next_channel, 15)
            next_channel += 1

        events: List[Tuple[int, int, mido.Message]] = []
        events.append(
            (0, 0, mido.Message(
                "program_change", program=part.program, channel=channel, time=0
            ))
        )
        normalize_amplitudes(part.notes)
        for n in part.notes:
            on = to_tick(n.start)
            off = max(to_tick(n.end), on + 1)
            vel = amplitude_to_velocity(n.amplitude)
            events.append(
                (on, 3, mido.Message(
                    "note_on", note=int(n.pitch), velocity=vel, channel=channel, time=0
                ))
            )
            events.append(
                (off, 2, mido.Message(
                    "note_off", note=int(n.pitch), velocity=0, channel=channel, time=0
                ))
            )
        mid.tracks.append(_to_track(events, name=part.name))

    return mid


def _to_track(events: List[Tuple[int, int, mido.Message]], name: str) -> mido.MidiTrack:
    """Delta-encode (abs_tick, priority, message) into a track."""
    track = mido.MidiTrack()
    track.append(mido.MetaMessage("track_name", name=name, time=0))
    prev = 0
    for tick, _, msg in sorted(events, key=lambda e: (e[0], e[1])):
        msg.time = tick - prev
        prev = tick
        track.append(msg)
    track.append(mido.MetaMessage("end_of_track", time=0))
    return track
