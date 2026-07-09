"""XHTML content document -> semantic Block stream.

EPUB CSS is deliberately ignored except for a few inline hints (text-align,
font-style/weight): publisher stylesheets vary wildly and the whole point of
this converter is to re-typeset the book consistently.
"""

from __future__ import annotations

import re
from typing import Callable, List, Optional

from bs4 import BeautifulSoup, NavigableString, Tag

from .model import Block, ImageRef, Span

BLOCK_TAGS = {
    "p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "ul", "ol", "li",
    "pre", "div", "figure", "figcaption", "table", "hr", "section", "article",
    "aside", "header", "footer", "main", "img", "svg", "dl", "dt", "dd",
}
SKIP_TAGS = {"script", "style", "head", "title", "meta", "link", "nav", "template"}
BOLD_TAGS = {"b", "strong"}
ITALIC_TAGS = {"i", "em", "cite", "dfn", "q"}
MONO_TAGS = {"code", "tt", "kbd", "samp", "var"}

_WS = re.compile(r"[ \t\r\n\f\v]+")

ImageLoader = Callable[[str], Optional[ImageRef]]


def _style_hints(tag: Tag) -> dict:
    """Extract the few inline-CSS hints we honor."""
    out = {}
    style = tag.get("style") or ""
    m = re.search(r"text-align\s*:\s*(left|right|center|justify)", style)
    if m:
        out["align"] = m.group(1)
    if re.search(r"font-style\s*:\s*italic", style):
        out["italic"] = True
    if re.search(r"font-weight\s*:\s*(bold|[7-9]00)", style):
        out["bold"] = True
    return out


class _Collector:
    """Accumulates inline content, flushing it into Blocks at block boundaries."""

    def __init__(self, load_image: ImageLoader):
        self.load_image = load_image
        self.blocks: List[Block] = []
        self.spans: List[Span] = []
        self.list_stack: List[dict] = []   # {"ordered": bool, "n": int}
        self.after_heading = False

    # -- inline ------------------------------------------------------------

    def add_text(self, text: str, bold: bool, italic: bool, mono: bool) -> None:
        if mono:
            text = _WS.sub(" ", text)
        else:
            text = _WS.sub(" ", text)
        if not text:
            return
        if text == " " and not self.spans:
            return
        last = self.spans[-1] if self.spans else None
        if last and last.bold == bold and last.italic == italic and last.mono == mono:
            last.text += text
        else:
            self.spans.append(Span(text, bold=bold, italic=italic, mono=mono))

    def add_break(self) -> None:
        # Forced line break inside a paragraph, honored by the line breaker.
        self.spans.append(Span("\n"))

    def _take_spans(self) -> List[Span]:
        spans = self.spans
        self.spans = []
        # trim leading/trailing whitespace of the block
        while spans and not spans[0].text.strip():
            spans.pop(0)
        while spans and not spans[-1].text.strip():
            spans.pop()
        if spans:
            spans[0].text = spans[0].text.lstrip()
            spans[-1].text = spans[-1].text.rstrip()
        return [s for s in spans if s.text]

    # -- blocks ------------------------------------------------------------

    def flush(self, kind: str = "para", **kw) -> None:
        spans = self._take_spans()
        if not spans:
            return
        blk = Block(kind=kind, spans=spans, **kw)
        if kind == "heading":
            blk.keep_with_next = True
            self.after_heading = True
        elif kind in ("para", "quote", "item"):
            blk.no_indent = self.after_heading
            self.after_heading = False
        self.blocks.append(blk)

    def emit_image(self, src: str) -> None:
        self.flush()
        ref = self.load_image(src) if src else None
        if ref is not None:
            self.blocks.append(Block(kind="image", image=ref, align="center"))
            self.after_heading = False

    def emit_rule(self) -> None:
        self.flush()
        self.blocks.append(Block(kind="rule"))


def _walk(node: Tag, col: _Collector, bold: bool, italic: bool, mono: bool,
          align: str, quote_depth: int) -> None:
    for child in node.children:
        if isinstance(child, NavigableString):
            if child.parent and child.parent.name in SKIP_TAGS:
                continue
            col.add_text(str(child), bold, italic, mono)
            continue
        if not isinstance(child, Tag):
            continue
        name = (child.name or "").lower()
        if name in SKIP_TAGS:
            continue

        hints = _style_hints(child)
        c_bold = bold or name in BOLD_TAGS or hints.get("bold", False)
        c_italic = italic or name in ITALIC_TAGS or hints.get("italic", False)
        c_mono = mono or name in MONO_TAGS
        c_align = hints.get("align", align)

        if name == "br":
            col.add_break()
        elif name in ("img", "image"):
            src = child.get("src") or child.get("href") or child.get("xlink:href") or ""
            col.emit_image(src)
        elif name == "svg":
            img = child.find(["image", "img"])
            if img is not None:
                src = img.get("href") or img.get("xlink:href") or ""
                col.emit_image(src)
        elif name == "hr":
            col.emit_rule()
        elif name in ("h1", "h2", "h3", "h4", "h5", "h6"):
            col.flush()
            _walk(child, col, True, c_italic, c_mono, c_align, quote_depth)
            col.flush("heading", level=int(name[1]), align=c_align or ("center" if name == "h1" else ""))
        elif name == "p":
            col.flush()
            _walk(child, col, c_bold, c_italic, c_mono, c_align, quote_depth)
            if quote_depth > 0:
                col.flush("quote", level=quote_depth, align=c_align)
            else:
                col.flush("para", align=c_align)
        elif name == "blockquote":
            col.flush()
            _walk(child, col, c_bold, c_italic, c_mono, c_align, quote_depth + 1)
            col.flush("quote", level=quote_depth + 1, align=c_align)
        elif name == "pre":
            col.flush()
            text = child.get_text()
            for ln in text.rstrip("\n").split("\n"):
                # leading spaces become NBSP so the word splitter keeps them
                stripped = ln.lstrip(" ")
                ln = "\u00a0" * (len(ln) - len(stripped)) + stripped
                col.blocks.append(Block(kind="code", spans=[Span(ln or " ", mono=True)]))
            col.after_heading = False
        elif name in ("ul", "ol"):
            col.flush()
            col.list_stack.append({"ordered": name == "ol", "n": 0})
            _walk(child, col, c_bold, c_italic, c_mono, c_align, quote_depth)
            col.flush()
            col.list_stack.pop()
        elif name == "li":
            col.flush()
            depth = len(col.list_stack)
            marker = "•"
            if col.list_stack:
                col.list_stack[-1]["n"] += 1
                if col.list_stack[-1]["ordered"]:
                    marker = f"{col.list_stack[-1]['n']}."
                elif depth > 1:
                    marker = "◦"
            _walk(child, col, c_bold, c_italic, c_mono, c_align, quote_depth)
            col.flush("item", level=max(depth, 1), marker=marker, align=c_align)
        elif name == "figcaption":
            col.flush()
            _walk(child, col, c_bold, True, c_mono, "center", quote_depth)
            col.flush("caption", align="center")
        elif name == "table":
            col.flush()
            for tr in child.find_all("tr"):
                cells = [_WS.sub(" ", td.get_text()).strip() for td in tr.find_all(["td", "th"])]
                cells = [c for c in cells if c]
                if cells:
                    col.blocks.append(Block(kind="para", align="left",
                                            spans=[Span("   |   ".join(cells))],
                                            no_indent=True))
            col.after_heading = False
        elif name in ("dt",):
            col.flush()
            _walk(child, col, True, c_italic, c_mono, c_align, quote_depth)
            col.flush("para", align=c_align)
        elif name in ("dd",):
            col.flush()
            _walk(child, col, c_bold, c_italic, c_mono, c_align, quote_depth)
            col.flush("quote", level=1, align=c_align)
        elif name in BLOCK_TAGS:
            # Generic container (div, section, figure...): flush around it so
            # its stray inline text forms its own paragraph.
            col.flush(align=c_align)
            _walk(child, col, c_bold, c_italic, c_mono, c_align, quote_depth)
            col.flush("para", align=c_align)
        else:
            # Inline element (span, a, sup...)
            _walk(child, col, c_bold, c_italic, c_mono, c_align, quote_depth)


def parse_document(data: bytes, load_image: ImageLoader) -> List[Block]:
    soup = BeautifulSoup(data, "html.parser")
    body = soup.find("body") or soup
    col = _Collector(load_image)
    _walk(body, col, False, False, False, "", 0)
    col.flush()
    return col.blocks
