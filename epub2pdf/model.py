"""Shared data model for the conversion pipeline.

The pipeline transforms an EPUB through these representations:

    EPUB file
      -> Book (metadata + Chapters)             epub.py
      -> Chapter.blocks: list[Block]            content.py  (semantic blocks)
      -> LaidBlock / Line                       layout.py   (measured lines)
      -> list[Atom]                             layout.py   (paginatable units)
      -> list[Page]                             paginate.py (fixed pages)
      -> PDF                                    render.py
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


# ---------------------------------------------------------------- semantic --

@dataclass
class Span:
    """A run of text with a single style."""
    text: str
    bold: bool = False
    italic: bool = False
    mono: bool = False

    @property
    def style_key(self) -> str:
        return ("B" if self.bold else "") + ("I" if self.italic else "") + ("M" if self.mono else "")


@dataclass
class ImageRef:
    """A raster image extracted from the EPUB, normalized to PNG/JPEG bytes."""
    name: str            # unique name within the book
    data: bytes
    fmt: str             # "PNG" or "JPEG"
    px_w: int
    px_h: int


@dataclass
class Block:
    """A block-level element in reading order."""
    kind: str                       # heading | para | quote | item | code | image | caption | rule
    spans: List[Span] = field(default_factory=list)
    level: int = 0                  # heading level (1-6) or list nesting depth
    align: str = ""                 # "" = default for kind; left | center | right | justify
    marker: str = ""                # list item marker ("•", "3.")
    image: Optional[ImageRef] = None
    no_indent: bool = False         # suppress first-line indent (first para after heading)
    keep_with_next: bool = False    # avoid page break right after this block

    def text(self) -> str:
        return "".join(s.text for s in self.spans)


@dataclass
class Chapter:
    title: str                      # from EPUB nav/NCX, may be ""
    blocks: List[Block] = field(default_factory=list)
    src: str = ""                   # spine href, for diagnostics


@dataclass
class Book:
    title: str
    author: str
    language: str
    chapters: List[Chapter]
    cover: Optional[ImageRef] = None


# ---------------------------------------------------------------- measured --

@dataclass
class Word:
    text: str
    style_key: str
    width: float                    # mm


@dataclass
class Line:
    words: List[Word]
    natural_width: float            # mm, including inter-word spaces at natural width
    space_width: float              # mm, natural width of one inter-word space
    is_last: bool                   # last line of its paragraph (never justified)


@dataclass
class LaidBlock:
    """A Block after line breaking: geometry attached."""
    block: Block
    lines: List[Line] = field(default_factory=list)
    line_height: float = 0.0        # mm per line
    font_size: float = 0.0          # pt
    indent_left: float = 0.0        # mm
    indent_right: float = 0.0       # mm
    first_indent: float = 0.0       # mm, extra indent of first line
    space_before: float = 0.0       # mm
    space_after: float = 0.0        # mm
    align: str = "justify"
    image_w: float = 0.0            # mm, display size for image blocks
    image_h: float = 0.0
    marker_width: float = 0.0       # mm reserved for the list marker


# ------------------------------------------------------------- paginatable --

# Atom kinds
A_LINE = "line"
A_IMAGE = "image"
A_SPACE = "space"     # inter-block glue: dropped when it falls at a page top


@dataclass
class Atom:
    kind: str
    height: float                   # mm at natural size
    shrink: float = 0.0             # mm the atom may lose (images under shrink policy)
    laid: Optional[LaidBlock] = None
    line_idx: int = -1              # index of the line within its block
    line_count: int = 0             # total lines in its block
    para_id: int = -1               # id of the owning block
    keep_with_next: bool = False    # forbid a page break right after this atom


@dataclass
class Page:
    """One output page: atoms plus the display height chosen for each."""
    atoms: List[Atom] = field(default_factory=list)
    heights: List[float] = field(default_factory=list)  # actual height used per atom
    used: float = 0.0               # mm consumed

    def add(self, atom: Atom, height: Optional[float] = None) -> None:
        h = atom.height if height is None else height
        self.atoms.append(atom)
        self.heights.append(h)
        self.used += h


@dataclass
class CandidateLayout:
    """The result of one pagination strategy applied to one chapter."""
    strategy: str
    pages: List[Page]
    score: float = 0.0
    issues: List[str] = field(default_factory=list)   # human-readable problems found by the scorer
