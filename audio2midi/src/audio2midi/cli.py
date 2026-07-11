"""Command line interface."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

import click

from .pipeline import Config, transcribe_file

MODE_ALIASES = {
    "orchestral": "orchestral",
    "3-section": "3section",
    "3section": "3section",
    "2-section": "2section",
    "2section": "2section",
    "melody": "melody",
    "melody-only": "melody",
    "harmony": "harmony",
    "harmony-only": "harmony",
    "chords": "harmony",
}


@click.command(context_settings={"help_option_names": ["-h", "--help"]})
@click.argument("input_file", type=click.Path(exists=True, dir_okay=False))
@click.option(
    "-o",
    "--output",
    type=click.Path(dir_okay=False),
    default=None,
    help="Output MIDI path (default: <input>.<mode>.mid).",
)
@click.option(
    "-m",
    "--mode",
    type=click.Choice(sorted(set(MODE_ALIASES)), case_sensitive=False),
    default="3-section",
    show_default=True,
    help="Analysis mode.",
)
@click.option("--bpm", type=float, default=None, help="Override detected tempo.")
@click.option(
    "--quantize",
    type=click.Choice(["off", "4", "8", "16", "32"]),
    default="16",
    show_default=True,
    help="Snap notes to this grid (note value per beat subdivision).",
)
@click.option(
    "--melody-source",
    type=click.Choice(["auto", "vocals", "instrumental"]),
    default="auto",
    show_default=True,
    help="Which stem carries the melody.",
)
@click.option(
    "--chord-vocab",
    type=click.Choice(["triads", "sevenths"]),
    default="triads",
    show_default=True,
    help="Chord vocabulary for harmony detection.",
)
@click.option(
    "--orchestral-strategy",
    type=click.Choice(["timbre", "register"]),
    default="timbre",
    show_default=True,
    help="How orchestral notes are assigned to sections.",
)
@click.option(
    "--no-separation",
    is_flag=True,
    help="Skip Demucs source separation (use for already-isolated material).",
)
@click.option(
    "--device",
    type=click.Choice(["auto", "cpu", "cuda"]),
    default="auto",
    show_default=True,
    help="Compute device for the separation model.",
)
@click.option(
    "--onset-threshold",
    type=click.FloatRange(0.05, 0.95),
    default=0.5,
    show_default=True,
    help="Basic Pitch note onset sensitivity (lower = more notes).",
)
@click.option(
    "--frame-threshold",
    type=click.FloatRange(0.05, 0.95),
    default=0.3,
    show_default=True,
    help="Basic Pitch note sustain sensitivity.",
)
@click.option(
    "--min-note-len",
    type=float,
    default=80.0,
    show_default=True,
    help="Discard notes shorter than this (milliseconds).",
)
@click.option(
    "--time-signature",
    default="4/4",
    show_default=True,
    help="Time signature written to the MIDI file, e.g. 3/4.",
)
@click.option(
    "--stems-dir",
    type=click.Path(file_okay=False),
    default=None,
    help="Also export the separated audio stems (wav) to this directory.",
)
@click.option(
    "--separate-files",
    is_flag=True,
    help="Additionally write one MIDI file per part.",
)
@click.option("-v", "--verbose", is_flag=True, help="Verbose logging.")
def main(
    input_file,
    output,
    mode,
    bpm,
    quantize,
    melody_source,
    chord_vocab,
    orchestral_strategy,
    no_separation,
    device,
    onset_threshold,
    frame_threshold,
    min_note_len,
    time_signature,
    stems_dir,
    separate_files,
    verbose,
):
    """Transcribe an audio file (song or orchestral piece) into a MIDI file.

    \b
    Modes:
      orchestral   woodwinds / brass / strings / basses / percussion
      3-section    melody + harmony (chords) + rhythm (drums)
      2-section    melody + harmony
      melody       melody line only
      harmony      chords only (labels embedded as lyric events)
    """
    logging.basicConfig(
        level=logging.INFO if verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )

    canonical_mode = MODE_ALIASES[mode.lower()]

    try:
        num, den = (int(x) for x in time_signature.split("/"))
    except ValueError:
        raise click.BadParameter("time signature must look like 4/4 or 3/4")

    if output is None:
        output = str(Path(input_file).with_suffix(f".{canonical_mode}.mid"))

    cfg = Config(
        mode=canonical_mode,
        bpm=bpm,
        quantize=0 if quantize == "off" else int(quantize),
        melody_source=melody_source,
        chord_vocab=chord_vocab,
        orchestral_strategy=orchestral_strategy,
        no_separation=no_separation,
        device=device,
        onset_threshold=onset_threshold,
        frame_threshold=frame_threshold,
        min_note_len_ms=min_note_len,
        stems_dir=Path(stems_dir) if stems_dir else None,
        time_signature=(num, den),
        separate_files=separate_files,
    )

    click.echo(f"Analyzing {input_file} [mode={canonical_mode}]...")
    result, files = transcribe_file(input_file, output, cfg)

    click.echo(f"Tempo: {result.bpm:.1f} BPM")
    for part in result.parts:
        kind = "drum hits" if part.is_drum else "notes"
        click.echo(f"  {part.name}: {len(part.notes)} {kind}")
    if result.chords:
        preview = " ".join(seg.label for seg in result.chords[:12])
        more = " ..." if len(result.chords) > 12 else ""
        click.echo(f"  Chords: {preview}{more}")
    for f in files:
        click.echo(f"Wrote {f}")


if __name__ == "__main__":
    sys.exit(main())
