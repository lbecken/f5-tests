"""Measurement and line breaking: Blocks -> LaidBlocks -> Atoms.

All geometry is in millimetres (fpdf2's default unit). Line breaking is
greedy first-fit per paragraph; page breaking (the interesting problem) is
handled by paginate.py over the Atom stream produced here.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from fpdf import FPDF

from .fonts import FontSet
from .model import (
    A_IMAGE, A_LINE, A_SPACE, Atom, Block, Chapter, LaidBlock, Line, Span, Word,
)

PT_TO_MM = 25.4 / 72.0

PAGE_SIZES = {          # (width mm, height mm)
    "a4": (210.0, 297.0),
    "a5": (148.0, 210.0),
    "letter": (215.9, 279.4),
    "6x9": (152.4, 228.6),   # common trade book size
    "5x8": (127.0, 203.2),
}


@dataclass
class PageSpec:
    width: float
    height: float
    margin_top: float
    margin_right: float
    margin_bottom: float
    margin_left: float

    @property
    def text_width(self) -> float:
        return self.width - self.margin_left - self.margin_right

    @property
    def text_height(self) -> float:
        return self.height - self.margin_top - self.margin_bottom


@dataclass
class Style:
    font_size: float = 11.0        # pt, body text
    line_height: float = 1.45      # multiple of font size
    justify: bool = True
    first_indent: float = 5.0      # mm, paragraph first-line indent
    para_spacing: float = 0.0      # mm between paragraphs (book style: 0 + indent)
    hyphenate: bool = False        # reserved
    heading_scale: Dict[int, float] = field(default_factory=lambda: {
        1: 1.9, 2: 1.5, 3: 1.25, 4: 1.1, 5: 1.0, 6: 1.0,
    })


class Measurer:
    """Registers fonts on an FPDF instance and measures strings with a cache."""

    FAMILY = "book"
    MONO = "bookmono"

    def __init__(self, fonts: FontSet):
        self.fonts = fonts
        self.pdf = FPDF(unit="mm")
        self.register(self.pdf)
        self._cache: Dict[Tuple[str, float, str], float] = {}

    def register(self, pdf: FPDF) -> None:
        """Register the discovered fonts on any FPDF instance."""
        if self.fonts.embedded:
            for style, path in self.fonts.paths.items():
                pdf.add_font(self.FAMILY, style, path)
            if self.fonts.mono_path:
                pdf.add_font(self.MONO, "", self.fonts.mono_path)

    def family(self, mono: bool) -> str:
        if self.fonts.embedded:
            if mono:
                return self.MONO if self.fonts.mono_path else "courier"
            return self.FAMILY
        return "courier" if mono else "times"

    def sanitize(self, text: str) -> str:
        """Core PDF fonts only cover Latin-1; degrade gracefully."""
        if self.fonts.embedded:
            return text
        return text.encode("latin-1", "replace").decode("latin-1")

    def width(self, text: str, style_key: str, size: float) -> float:
        key = (text, size, style_key)
        w = self._cache.get(key)
        if w is None:
            mono = "M" in style_key
            fpdf_style = style_key.replace("M", "")
            if mono and not (self.fonts.embedded and self.fonts.mono_path):
                fpdf_style = ""
            self.pdf.set_font(self.family(mono), fpdf_style, size)
            w = self.pdf.get_string_width(self.sanitize(text))
            self._cache[key] = w
        return w


# --------------------------------------------------------------- breaking --

def _spans_to_words(spans: List[Span]) -> List[Tuple[str, str]]:
    """-> [(word_or_marker, style_key)]; "\n" words are forced breaks."""
    out: List[Tuple[str, str]] = []
    for sp in spans:
        if sp.text == "\n":
            out.append(("\n", ""))
            continue
        for w in sp.text.split(" "):
            if w:
                out.append((w, sp.style_key))
    return out


def _break_lines(words: List[Tuple[str, str]], avail: float, m: Measurer,
                 size: float) -> List[Line]:
    space_w = m.width(" ", "", size)
    lines: List[Line] = []
    cur: List[Word] = []
    cur_w = 0.0

    def close(last: bool) -> None:
        nonlocal cur, cur_w
        if cur:
            lines.append(Line(words=cur, natural_width=cur_w, space_width=space_w, is_last=last))
        cur, cur_w = [], 0.0

    for text, style in words:
        if text == "\n":
            close(True)
            continue
        w = m.width(text, style, size)
        if w > avail:
            # word longer than the line: hard character wrap
            close(False)
            piece = ""
            for ch in text:
                if m.width(piece + ch, style, size) > avail and piece:
                    lines.append(Line([Word(piece, style, m.width(piece, style, size))],
                                      m.width(piece, style, size), space_w, False))
                    piece = ch
                else:
                    piece += ch
            if piece:
                cur = [Word(piece, style, m.width(piece, style, size))]
                cur_w = cur[0].width
            continue
        add = w if not cur else cur_w + space_w + w
        if cur and add > avail:
            close(False)
            cur = [Word(text, style, w)]
            cur_w = w
        else:
            cur.append(Word(text, style, w))
            cur_w = add
    close(True)
    if lines:
        lines[-1].is_last = True
    return lines


# ----------------------------------------------------------------- laying --

def lay_block(blk: Block, spec: PageSpec, style: Style, m: Measurer) -> LaidBlock:
    lb = LaidBlock(block=blk)
    size = style.font_size
    kind = blk.kind

    if kind == "heading":
        size = style.font_size * style.heading_scale.get(blk.level, 1.0)
        lb.space_before = size * PT_TO_MM * (1.6 if blk.level <= 2 else 1.1)
        lb.space_after = size * PT_TO_MM * 0.7
        lb.align = blk.align or "left"
        for sp in blk.spans:            # headings render bold
            sp.bold = True
    elif kind == "quote":
        lb.indent_left = 7.0 * max(blk.level, 1)
        lb.indent_right = 7.0
        lb.space_before = lb.space_after = 2.0
        lb.align = blk.align or ("justify" if style.justify else "left")
    elif kind == "item":
        lb.indent_left = 6.0 * max(blk.level, 1)
        lb.align = blk.align or "left"
        lb.space_before = lb.space_after = 0.8
    elif kind == "code":
        size = style.font_size * 0.85
        lb.indent_left = 4.0
        lb.align = "left"
    elif kind == "caption":
        size = style.font_size * 0.9
        lb.align = blk.align or "center"
        lb.space_before = 1.5
        lb.space_after = 3.0
    elif kind == "rule":
        lb.space_before = lb.space_after = 4.0
        lb.line_height = 1.0
    elif kind == "para":
        lb.align = blk.align or ("justify" if style.justify else "left")
        lb.space_before = lb.space_after = style.para_spacing / 2.0
        if not blk.no_indent and style.first_indent > 0 and lb.align == "justify":
            lb.first_indent = style.first_indent

    lb.font_size = size
    if kind != "rule":
        lb.line_height = size * PT_TO_MM * style.line_height

    if kind == "image" and blk.image is not None:
        img = blk.image
        # 96 dpi nominal, capped to the text area (leave headroom so a big
        # image still shares its page with a couple of text lines)
        nat_w = img.px_w / 96.0 * 25.4
        nat_h = img.px_h / 96.0 * 25.4
        max_w = spec.text_width
        max_h = spec.text_height * 0.88
        scale = min(1.0, max_w / nat_w, max_h / nat_h)
        lb.image_w = nat_w * scale
        lb.image_h = nat_h * scale
        lb.space_before = lb.space_after = 3.0
        return lb

    if kind == "item":
        lb.marker_width = m.width(blk.marker + " ", "", size)

    avail = spec.text_width - lb.indent_left - lb.indent_right - lb.marker_width
    first_avail = avail - lb.first_indent
    words = _spans_to_words(blk.spans)
    if kind == "rule":
        lb.lines = []
        return lb
    if lb.first_indent > 0 and words:
        # break the first line against the narrower measure, the rest full
        all_lines = _break_lines(words, first_avail, m, size)
        if len(all_lines) > 1:
            first = all_lines[0]
            rest_words = [(w.text, w.style_key) for ln in all_lines[1:] for w in ln.words]
            lb.lines = [first] + _break_lines(rest_words, avail, m, size)
            lb.lines[0].is_last = False
            lb.lines[-1].is_last = True
        else:
            lb.lines = all_lines
    else:
        lb.lines = _break_lines(words, avail, m, size)
    return lb


def lay_chapter(ch: Chapter, spec: PageSpec, style: Style, m: Measurer) -> List[LaidBlock]:
    return [lay_block(b, spec, style, m) for b in ch.blocks]


# ------------------------------------------------------------------ atoms --

RULE_HEIGHT = 2.0


def build_atoms(laid: List[LaidBlock], allow_image_shrink: bool,
                min_image_scale: float = 0.6) -> List[Atom]:
    """Flatten laid blocks into the paginatable atom stream.

    Inter-block vertical space becomes discardable A_SPACE glue. Image atoms
    optionally carry shrink capacity so the optimizer can trade image size
    against page breaks.
    """
    atoms: List[Atom] = []
    pending_space = 0.0

    def push_space(mm: float) -> None:
        nonlocal pending_space
        pending_space = max(pending_space, mm)

    def flush_space() -> None:
        nonlocal pending_space
        if pending_space > 0 and atoms:
            atoms.append(Atom(kind=A_SPACE, height=pending_space))
        pending_space = 0.0

    for pid, lb in enumerate(laid):
        push_space(lb.space_before)
        flush_space()
        kind = lb.block.kind
        if kind == "image":
            shrink = lb.image_h * (1.0 - min_image_scale) if allow_image_shrink else 0.0
            atoms.append(Atom(kind=A_IMAGE, height=lb.image_h, shrink=shrink,
                              laid=lb, para_id=pid, line_count=1, line_idx=0,
                              keep_with_next=_caption_follows(laid, pid)))
        elif kind == "rule":
            atoms.append(Atom(kind=A_LINE, height=RULE_HEIGHT, laid=lb,
                              para_id=pid, line_idx=0, line_count=1))
        else:
            n = len(lb.lines)
            for i in range(n):
                keep = lb.block.keep_with_next and i == n - 1
                atoms.append(Atom(kind=A_LINE, height=lb.line_height, laid=lb,
                                  para_id=pid, line_idx=i, line_count=n,
                                  keep_with_next=keep))
        push_space(lb.space_after)
    return atoms


def _caption_follows(laid: List[LaidBlock], pid: int) -> bool:
    return pid + 1 < len(laid) and laid[pid + 1].block.kind == "caption"
