"""Render paginated chapters to the final PDF (fpdf2).

Pagination decided *what* goes on each page; this module only draws:
words (with justification), images, rules, footers, cover, printed TOC and
the PDF outline.
"""

from __future__ import annotations

import io
from typing import List, Optional, Sequence, Tuple

from fpdf import FPDF

from .layout import Measurer, PageSpec, Style, PT_TO_MM
from .model import A_IMAGE, A_LINE, A_SPACE, Atom, Chapter, Line, Page

FOOTER_SIZE = 9.0
TOC_TITLE = "Contents"


def _roman(n: int) -> str:
    vals = [(1000, "m"), (900, "cm"), (500, "d"), (400, "cd"), (100, "c"),
            (90, "xc"), (50, "l"), (40, "xl"), (10, "x"), (9, "ix"),
            (5, "v"), (4, "iv"), (1, "i")]
    out = []
    for v, s in vals:
        while n >= v:
            out.append(s)
            n -= v
    return "".join(out)


class Renderer:
    def __init__(self, spec: PageSpec, style: Style, m: Measurer,
                 page_numbers: bool = True):
        self.spec = spec
        self.style = style
        self.m = m
        self.page_numbers = page_numbers

    # ------------------------------------------------------------- helpers --

    def _new_pdf(self) -> FPDF:
        pdf = FPDF(unit="mm", format=(self.spec.width, self.spec.height))
        pdf.set_auto_page_break(False)
        pdf.set_margins(self.spec.margin_left, self.spec.margin_top,
                        self.spec.margin_right)
        self.m.register(pdf)
        return pdf

    def _set_font(self, pdf: FPDF, style_key: str, size: float) -> None:
        mono = "M" in style_key
        fpdf_style = style_key.replace("M", "")
        if mono and not (self.m.fonts.embedded and self.m.fonts.mono_path):
            fpdf_style = ""
        pdf.set_font(self.m.family(mono), fpdf_style, size)

    def _draw_line(self, pdf: FPDF, line: Line, laid, y: float) -> None:
        spec = self.spec
        lb = laid
        first = lb.lines and line is lb.lines[0]
        indent = lb.indent_left + (lb.first_indent if first else 0.0)
        x0 = spec.margin_left + indent + lb.marker_width
        avail = spec.text_width - indent - lb.indent_right - lb.marker_width
        baseline = y + lb.line_height * 0.72

        if lb.marker_width > 0 and first:
            self._set_font(pdf, "", lb.font_size)
            pdf.text(spec.margin_left + lb.indent_left, baseline,
                     self.m.sanitize(lb.block.marker))

        gaps = len(line.words) - 1
        extra = 0.0
        align = lb.align
        if align == "justify":
            if line.is_last or gaps <= 0:
                align = "left"
            else:
                extra = (avail - line.natural_width) / gaps
                if extra > 2.5 * line.space_width or extra < 0:
                    align, extra = "left", 0.0
        if align == "center":
            x0 += max(0.0, (avail - line.natural_width) / 2.0)
        elif align == "right":
            x0 += max(0.0, avail - line.natural_width)

        x = x0
        cur_style: Optional[str] = None
        for w in line.words:
            if w.style_key != cur_style:
                self._set_font(pdf, w.style_key, lb.font_size)
                cur_style = w.style_key
            pdf.text(x, baseline, self.m.sanitize(w.text))
            x += w.width + line.space_width + extra

    def _draw_atom(self, pdf: FPDF, atom: Atom, y: float, h: float) -> None:
        lb = atom.laid
        if atom.kind == A_IMAGE and lb is not None and lb.block.image is not None:
            img = lb.block.image
            w = lb.image_w * (h / lb.image_h) if lb.image_h > 0 else lb.image_w
            x = self.spec.margin_left + (self.spec.text_width - w) / 2.0
            pdf.image(io.BytesIO(img.data), x=x, y=y, w=w, h=h)
        elif atom.kind == A_LINE and lb is not None:
            if lb.block.kind == "rule":
                cx = self.spec.margin_left + self.spec.text_width / 2.0
                half = self.spec.text_width * 0.15
                pdf.set_line_width(0.2)
                pdf.line(cx - half, y + h / 2.0, cx + half, y + h / 2.0)
            elif 0 <= atom.line_idx < len(lb.lines):
                self._draw_line(pdf, lb.lines[atom.line_idx], lb, y)

    def _draw_page(self, pdf: FPDF, page: Page, folio: str = "") -> None:
        pdf.add_page()
        self._finish_page(pdf, page, folio)

    def _draw_cover(self, pdf: FPDF, cover) -> None:
        pdf.add_page()
        iw, ih = cover.px_w, cover.px_h
        scale = min(self.spec.width / iw, self.spec.height / ih)
        w, h = iw * scale, ih * scale
        pdf.image(io.BytesIO(cover.data), x=(self.spec.width - w) / 2.0,
                  y=(self.spec.height - h) / 2.0, w=w, h=h)

    # ----------------------------------------------------------------- TOC --

    def _toc_entries(self, chapters: Sequence[Tuple[Chapter, List[Page]]]
                     ) -> List[Tuple[str, int]]:
        entries = []
        pageno = 1
        for ch, pages in chapters:
            if ch.title:
                entries.append((ch.title, pageno))
            pageno += len(pages)
        return entries

    def _toc_page_count(self, n_entries: int) -> int:
        line_h = self.style.font_size * PT_TO_MM * 1.7
        per_page = max(1, int((self.spec.text_height - 20) / line_h))
        import math
        return max(1, math.ceil(n_entries / per_page))

    def _draw_toc(self, pdf: FPDF, entries: List[Tuple[str, int]]) -> None:
        line_h = self.style.font_size * PT_TO_MM * 1.7
        per_page = max(1, int((self.spec.text_height - 20) / line_h))
        size = self.style.font_size
        for start in range(0, len(entries), per_page):
            pdf.add_page()
            y = self.spec.margin_top
            if start == 0:
                self._set_font(pdf, "B", size * 1.5)
                title = self.m.sanitize(TOC_TITLE)
                pdf.text(self.spec.margin_left, y + size * 1.5 * PT_TO_MM, title)
                y += 16
            for title, pageno in entries[start:start + per_page]:
                base = y + line_h * 0.72
                num = str(pageno)
                self._set_font(pdf, "", size)
                num_w = self.m.width(num, "", size)
                title_s = self.m.sanitize(title)
                max_title_w = self.spec.text_width - num_w - 10
                while title_s and self.m.width(title_s, "", size) > max_title_w:
                    title_s = title_s[:-1]
                pdf.text(self.spec.margin_left, base, title_s)
                # dot leader
                t_w = self.m.width(title_s, "", size)
                dots_x0 = self.spec.margin_left + t_w + 2
                dots_x1 = self.spec.margin_left + self.spec.text_width - num_w - 2
                if dots_x1 > dots_x0:
                    dot_w = self.m.width(" .", "", size)
                    n = int((dots_x1 - dots_x0) / dot_w)
                    pdf.text(dots_x0, base, " ." * n)
                pdf.text(self.spec.margin_left + self.spec.text_width - num_w,
                         base, num)
                y += line_h
            folio = _roman(start // per_page + 1)
            if self.page_numbers:
                self._set_font(pdf, "", FOOTER_SIZE)
                w = self.m.width(folio, "", FOOTER_SIZE)
                pdf.text((self.spec.width - w) / 2.0,
                         self.spec.height - self.spec.margin_bottom / 2.0, folio)

    # ---------------------------------------------------------------- book --

    def render_book(self, book, chapters: Sequence[Tuple[Chapter, List[Page]]],
                    toc: bool = True) -> FPDF:
        pdf = self._new_pdf()
        pdf.set_title(book.title)
        if book.author:
            pdf.set_author(book.author)
        pdf.set_creator("epub2pdf-smart")

        if book.cover is not None:
            self._draw_cover(pdf, book.cover)

        entries = self._toc_entries(chapters) if toc else []
        if len(entries) > 1:
            self._draw_toc(pdf, entries)

        pageno = 1
        for ch, pages in chapters:
            first = True
            for page in pages:
                pdf.add_page()
                if first and ch.title:
                    # outline entry anchored to the chapter's first page
                    pdf.start_section(ch.title, level=0)
                first = False
                self._finish_page(pdf, page, str(pageno))
                pageno += 1
        return pdf

    def _finish_page(self, pdf: FPDF, page: Page, folio: str) -> None:
        y = self.spec.margin_top
        for atom, h in zip(page.atoms, page.heights):
            self._draw_atom(pdf, atom, y, h)
            y += h
        if folio and self.page_numbers:
            self._set_font(pdf, "", FOOTER_SIZE)
            w = self.m.width(folio, "", FOOTER_SIZE)
            pdf.text((self.spec.width - w) / 2.0,
                     self.spec.height - self.spec.margin_bottom / 2.0, folio)

    # --------------------------------------------------------- judge assist --

    def render_pages_png(self, pages: List[Page], max_pages: int = 3,
                         dpi: int = 60) -> List[bytes]:
        """Rasterize the first pages of a candidate layout for the vision
        judge. Requires pymupdf; returns [] if it is not installed."""
        try:
            import fitz  # type: ignore
        except ImportError:
            return []
        pdf = self._new_pdf()
        for page in pages[:max_pages]:
            self._draw_page(pdf, page)
        data = bytes(pdf.output())
        out: List[bytes] = []
        doc = fitz.open(stream=data, filetype="pdf")
        zoom = dpi / 72.0
        for p in doc:
            pix = p.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
            out.append(pix.tobytes("png"))
        doc.close()
        return out
