"""End-to-end conversion: EPUB file -> PDF file, with a per-chapter report
of which pagination strategy won and why."""

from __future__ import annotations

import os
import sys
import time
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from .epub import load_epub
from .fonts import discover_fonts, FontSet
from .judge import OllamaJudge
from .layout import Measurer, PageSpec, Style, build_atoms, lay_chapter, PAGE_SIZES
from .model import Book, CandidateLayout, Chapter, Page
from .paginate import paginate_chapter, STRATEGIES
from .render import Renderer


@dataclass
class Options:
    page_size: str = "6x9"
    margins: Tuple[float, float, float, float] = (16.0, 14.0, 16.0, 14.0)  # T R B L
    font_size: float = 11.0
    line_height: float = 1.45
    font_family: str = ""            # substring match, e.g. "georgia"
    font_dirs: List[str] = field(default_factory=list)
    justify: bool = True
    first_indent: float = 5.0
    para_spacing: float = 0.0
    strategy: str = "auto"           # auto | one of paginate.STRATEGIES
    toc: bool = True
    page_numbers: bool = True
    min_image_scale: float = 0.6
    judge: str = ""                  # "" | "ollama" | "ollama:<model>"
    judge_url: str = "http://localhost:11434"
    judge_max_calls: int = 24
    verbose: bool = False


@dataclass
class ChapterReport:
    title: str
    src: str
    pages: int
    strategy: str
    score: float
    issues: List[str]
    candidates: List[Tuple[str, float]]
    judged: bool = False


@dataclass
class Report:
    input: str
    output: str
    title: str
    pages: int = 0
    seconds: float = 0.0
    font: str = ""
    chapters: List[ChapterReport] = field(default_factory=list)

    def summary(self) -> str:
        lines = [f"{self.input} -> {self.output}",
                 f"  '{self.title}': {self.pages} pages in {self.seconds:.1f}s "
                 f"(font: {self.font or 'PDF core fonts'})"]
        by_strategy: dict = {}
        for ch in self.chapters:
            by_strategy[ch.strategy] = by_strategy.get(ch.strategy, 0) + 1
        picks = ", ".join(f"{k}×{v}" for k, v in sorted(by_strategy.items()))
        lines.append(f"  strategy wins per chapter: {picks}")
        return "\n".join(lines)

    def detail(self) -> str:
        lines = []
        for i, ch in enumerate(self.chapters):
            name = ch.title or os.path.basename(ch.src)
            cand = ", ".join(f"{s}={v:.0f}" for s, v in ch.candidates)
            mark = " [judge]" if ch.judged else ""
            lines.append(f"  ch{i + 1:02d} '{name[:40]}': {ch.pages}p "
                         f"via {ch.strategy}{mark} (scores: {cand})")
            for issue in ch.issues[:4]:
                lines.append(f"       ! {issue}")
        return "\n".join(lines)


def make_page_spec(opts: Options) -> PageSpec:
    if "x" in opts.page_size and opts.page_size not in PAGE_SIZES:
        try:
            w, h = (float(v) for v in opts.page_size.split("x", 1))
        except ValueError:
            raise ValueError(f"bad page size {opts.page_size!r}")
    else:
        try:
            w, h = PAGE_SIZES[opts.page_size.lower()]
        except KeyError:
            raise ValueError(
                f"unknown page size {opts.page_size!r}; known: "
                + ", ".join(PAGE_SIZES) + " or WIDTHxHEIGHT in mm")
    t, r, b, l = opts.margins
    return PageSpec(width=w, height=h, margin_top=t, margin_right=r,
                    margin_bottom=b, margin_left=l)


def convert(input_path: str, output_path: str, opts: Optional[Options] = None) -> Report:
    opts = opts or Options()
    t0 = time.time()

    book = load_epub(input_path)
    spec = make_page_spec(opts)
    style = Style(font_size=opts.font_size, line_height=opts.line_height,
                  justify=opts.justify, first_indent=opts.first_indent,
                  para_spacing=opts.para_spacing)
    fonts = discover_fonts(opts.font_family, opts.font_dirs)
    m = Measurer(fonts)
    renderer = Renderer(spec, style, m, page_numbers=opts.page_numbers)

    judge = None
    if opts.judge:
        model = opts.judge.split(":", 1)[1] if ":" in opts.judge else ""
        oj = OllamaJudge(model=model, url=opts.judge_url,
                         max_calls=opts.judge_max_calls, verbose=opts.verbose)
        oj.renderer = lambda cand, n: renderer.render_pages_png(cand.pages, n)
        judge = oj

    report = Report(input=input_path, output=output_path, title=book.title,
                    font=fonts.name)
    chapter_pages: List[Tuple[Chapter, List[Page]]] = []

    for ch in book.chapters:
        laid = lay_chapter(ch, spec, style, m)
        atoms_plain = build_atoms(laid, allow_image_shrink=False)
        atoms_shrink = build_atoms(laid, allow_image_shrink=True,
                                   min_image_scale=opts.min_image_scale)
        judge_cb = judge.pick if judge is not None else None
        winner, candidates = paginate_chapter(
            atoms_plain, atoms_shrink, spec.text_height,
            strategy=opts.strategy, judge=judge_cb)
        chapter_pages.append((ch, winner.pages))
        report.chapters.append(ChapterReport(
            title=ch.title, src=ch.src, pages=len(winner.pages),
            strategy=winner.strategy, score=winner.score, issues=winner.issues,
            candidates=[(c.strategy, c.score) for c in candidates],
            judged=judge is not None and bool(judge.decisions)
            and winner.strategy == judge.decisions[-1]))
        if opts.verbose:
            name = ch.title or os.path.basename(ch.src)
            print(f"  [{winner.strategy:>14}] {len(winner.pages):>3}p "
                  f"score={winner.score:6.0f}  {name[:50]}", file=sys.stderr)

    pdf = renderer.render_book(book, chapter_pages, toc=opts.toc)
    pdf.output(output_path)
    report.pages = pdf.pages_count
    report.seconds = time.time() - t0
    return report
