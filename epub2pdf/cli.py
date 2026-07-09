"""Command line interface.

Single file:
    epub2pdf book.epub                      -> book.pdf next to the input
    epub2pdf book.epub -o out/nice.pdf

Batch:
    epub2pdf *.epub -o outdir/              -> one PDF per EPUB
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import List

from .convert import Options, convert
from .layout import PAGE_SIZES
from .paginate import STRATEGIES


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="epub2pdf",
        description="Re-typeset EPUB books as fixed-layout PDFs. Several "
                    "pagination algorithms compete per chapter and the best-"
                    "scoring layout wins; an optional local LLM (Ollama) can "
                    "arbitrate near-ties.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    p.add_argument("inputs", nargs="+", metavar="EPUB",
                   help="input .epub file(s)")
    p.add_argument("-o", "--output", default="",
                   help="output PDF path (single input) or directory (batch); "
                        "default: alongside each input")

    g = p.add_argument_group("page")
    g.add_argument("--page-size", default="6x9",
                   help="one of %s, or WIDTHxHEIGHT in mm (e.g. 140x216)"
                        % "/".join(PAGE_SIZES))
    g.add_argument("--margins", default="16,14,16,14", metavar="T,R,B,L",
                   help="page margins in mm")
    g.add_argument("--no-page-numbers", action="store_true",
                   help="omit page number footers")
    g.add_argument("--no-toc", action="store_true",
                   help="omit the printed table of contents")

    g = p.add_argument_group("type")
    g.add_argument("--font-size", type=float, default=11.0, help="body size in pt")
    g.add_argument("--line-height", type=float, default=1.45,
                   help="leading as a multiple of font size")
    g.add_argument("--font-family", default="",
                   help="preferred font family substring (e.g. georgia, "
                        "'times', dejavu); default: best serif found")
    g.add_argument("--font-dir", action="append", default=[], metavar="DIR",
                   help="extra directory to search for fonts (repeatable)")
    g.add_argument("--no-justify", action="store_true",
                   help="ragged-right instead of justified text")
    g.add_argument("--first-indent", type=float, default=5.0,
                   help="paragraph first-line indent in mm (0 disables)")
    g.add_argument("--para-spacing", type=float, default=0.0,
                   help="vertical space between paragraphs in mm")

    g = p.add_argument_group("pagination")
    g.add_argument("--strategy", default="auto",
                   choices=("auto",) + STRATEGIES,
                   help="force one pagination algorithm, or 'auto' to let "
                        "them compete per chapter")
    g.add_argument("--min-image-scale", type=float, default=0.6,
                   help="how far the optimizer may shrink images (0.6 = 60%%)")

    g = p.add_argument_group("AI judge (optional, local)")
    g.add_argument("--judge", default="", metavar="OLLAMA[:MODEL]",
                   help="use a local Ollama model to arbitrate layout "
                        "near-ties, e.g. --judge ollama or "
                        "--judge ollama:qwen2.5vl:7b (vision) or "
                        "--judge ollama:llama3.2:3b (text features)")
    g.add_argument("--judge-url", default="http://localhost:11434",
                   help="Ollama server URL")
    g.add_argument("--judge-max-calls", type=int, default=24,
                   help="cap on judge invocations per book")

    p.add_argument("-v", "--verbose", action="store_true",
                   help="per-chapter progress and strategy scores")
    p.add_argument("--report", action="store_true",
                   help="print the full per-chapter decision report")
    return p


def _parse_margins(s: str):
    parts = [float(v) for v in s.split(",")]
    if len(parts) == 1:
        parts = parts * 4
    if len(parts) != 4:
        raise ValueError("margins must be one value or T,R,B,L")
    return tuple(parts)


def _output_for(inp: str, output: str, batch: bool) -> str:
    stem = os.path.splitext(os.path.basename(inp))[0] + ".pdf"
    if not output:
        return os.path.join(os.path.dirname(os.path.abspath(inp)), stem)
    if batch or os.path.isdir(output) or output.endswith(os.sep):
        os.makedirs(output, exist_ok=True)
        return os.path.join(output, stem)
    parent = os.path.dirname(os.path.abspath(output))
    if parent:
        os.makedirs(parent, exist_ok=True)
    return output


def main(argv: List[str] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        margins = _parse_margins(args.margins)
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    judge_spec = args.judge
    if judge_spec and not judge_spec.startswith("ollama"):
        print("error: only 'ollama[:model]' judges are supported", file=sys.stderr)
        return 2
    if judge_spec.startswith("ollama:"):
        judge_spec = "ollama:" + args.judge.split(":", 1)[1]

    opts = Options(
        page_size=args.page_size, margins=margins,
        font_size=args.font_size, line_height=args.line_height,
        font_family=args.font_family, font_dirs=args.font_dir,
        justify=not args.no_justify, first_indent=args.first_indent,
        para_spacing=args.para_spacing, strategy=args.strategy,
        toc=not args.no_toc, page_numbers=not args.no_page_numbers,
        min_image_scale=args.min_image_scale,
        judge=judge_spec, judge_url=args.judge_url,
        judge_max_calls=args.judge_max_calls, verbose=args.verbose,
    )

    batch = len(args.inputs) > 1
    failures = 0
    for inp in args.inputs:
        out = _output_for(inp, args.output, batch)
        try:
            if args.verbose:
                print(f"converting {inp} ...", file=sys.stderr)
            report = convert(inp, out, opts)
        except Exception as e:
            failures += 1
            print(f"error: {inp}: {e}", file=sys.stderr)
            if args.verbose:
                import traceback
                traceback.print_exc()
            continue
        print(report.summary())
        if args.report:
            print(report.detail())
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
