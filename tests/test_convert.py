"""End-to-end and unit tests. Run with: pytest tests/ -v"""

import io
import os
import sys
import zipfile

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from epub2pdf import convert, Options
from epub2pdf.content import parse_document
from epub2pdf.model import Atom, A_LINE, A_IMAGE, A_SPACE
from epub2pdf.paginate import (
    paginate_greedy, paginate_optimal, paginate_float, score_layout,
)

from make_sample_epub import build  # noqa: E402  (same directory)


# ------------------------------------------------------------------ fixtures

@pytest.fixture(scope="session")
def sample_epub(tmp_path_factory):
    p = tmp_path_factory.mktemp("epub") / "sample.epub"
    build(str(p))
    return str(p)


@pytest.fixture(scope="session")
def epub3_unicode(tmp_path_factory):
    """Minimal EPUB3: nav doc, unicode text, nested list, svg image."""
    p = tmp_path_factory.mktemp("epub3") / "uni.epub"
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (200, 120), "#804040").save(buf, "PNG")
    png = buf.getvalue()

    ch = """<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Über älles</title></head><body>
<section><h1 style="text-align: center">Über die Bücher — «čitať» &amp; ‘quotes’</h1>
<p>Smörgåsbord naïve façade coöperate — em-dash… ellipsis, résumé.</p>
<div><p>Nested <span style="font-style: italic">styled span</span> and
<a href="#x">a link</a>, plus<br/>a forced break.</p>
<ol><li>Eins</li><li>Zwei<ul><li>zwei-a</li></ul></li></ol></div>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<image xlink:href="pic.png" width="200" height="120"/></svg>
<p></p><p>   </p>
</section></body></html>"""

    nav = """<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>nav</title></head><body>
<nav epub:type="toc"><ol><li><a href="ch1.xhtml">Über die Bücher</a></li></ol></nav>
</body></html>"""

    opf = """<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>Ünïcode Test</dc:title><dc:creator>Tëst</dc:creator>
<dc:language>de</dc:language><dc:identifier id="uid">uni-1</dc:identifier></metadata>
<manifest>
<item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>
<item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
<item id="pic" href="pic.png" media-type="image/png"/>
</manifest>
<spine><itemref idref="ch1"/></spine></package>"""

    zf = zipfile.ZipFile(str(p), "w")
    zf.writestr("mimetype", "application/epub+zip", zipfile.ZIP_STORED)
    zf.writestr("META-INF/container.xml", """<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="content.opf"
media-type="application/oebps-package+xml"/></rootfiles></container>""")
    zf.writestr("content.opf", opf)
    zf.writestr("nav.xhtml", nav)
    zf.writestr("ch1.xhtml", ch)
    zf.writestr("pic.png", png)
    zf.close()
    return str(p)


# ---------------------------------------------------------------- end-to-end

def _valid_pdf(path):
    from pypdf import PdfReader
    r = PdfReader(path)
    assert len(r.pages) > 0
    return r


def test_convert_auto(sample_epub, tmp_path):
    out = str(tmp_path / "out.pdf")
    report = convert(sample_epub, out, Options())
    r = _valid_pdf(out)
    assert report.pages == len(r.pages)
    assert report.title == "The Deliberate Counsel"
    assert len(report.chapters) == 5
    # auto mode must never lose to plain greedy on the shared score
    for ch in report.chapters:
        scores = dict(ch.candidates)
        assert ch.score <= scores["greedy"] + 1e-6


@pytest.mark.parametrize("strategy", ["greedy", "fixup", "optimal",
                                      "optimal-shrink", "float"])
def test_convert_each_strategy(sample_epub, tmp_path, strategy):
    out = str(tmp_path / f"{strategy}.pdf")
    report = convert(sample_epub, out, Options(strategy=strategy))
    _valid_pdf(out)
    assert all(ch.strategy == strategy for ch in report.chapters)


def test_convert_epub3_unicode(epub3_unicode, tmp_path):
    out = str(tmp_path / "uni.pdf")
    report = convert(epub3_unicode, out, Options(page_size="a5"))
    r = _valid_pdf(out)
    assert report.title == "Ünïcode Test"
    assert report.chapters[0].title == "Über die Bücher"
    text = "".join(p.extract_text() or "" for p in r.pages)
    assert "Smörgåsbord" in text
    assert "façade" in text


def test_outline_and_toc(sample_epub, tmp_path):
    out = str(tmp_path / "out.pdf")
    convert(sample_epub, out, Options())
    r = _valid_pdf(out)
    titles = [o.title for o in r.outline]
    assert "Chapter 1: The Salt City" in titles
    # printed TOC page exists (cover is page 1, TOC page 2)
    toc_text = r.pages[1].extract_text() or ""
    assert "Contents" in toc_text


def test_options(sample_epub, tmp_path):
    out = str(tmp_path / "opts.pdf")
    convert(sample_epub, out, Options(
        page_size="a4", margins=(20, 20, 20, 20), font_size=12,
        justify=False, toc=False, page_numbers=False))
    _valid_pdf(out)


# --------------------------------------------------------------------- units

def _lines(n, h=5.0, para_id=0, kinds=None):
    """n text lines of one paragraph."""
    out = []
    for i in range(n):
        a = Atom(kind=A_LINE, height=h, para_id=para_id, line_idx=i, line_count=n)
        a.laid = type("L", (), {"block": type("B", (), {"kind": "para"})()})()
        out.append(a)
    return out


def test_optimal_avoids_orphan():
    # page fits 10 lines; paragraphs of 9 + 5 lines: greedy strands the
    # second paragraph's first line at the bottom of page 1 (orphan)
    atoms = _lines(9, para_id=0) + _lines(5, para_id=1)
    for i, a in enumerate(atoms):
        a.para_id = 0 if i < 9 else 1
    H = 50.0
    g = paginate_greedy(atoms, H)
    o = paginate_optimal(atoms, H)
    gs, _ = score_layout(g, H)
    os_, _ = score_layout(o, H)
    assert os_ <= gs
    # optimal must not end page 1 with the orphan line
    last = o[0].atoms[-1]
    assert not (last.line_idx == 0 and last.line_count > 1)


def test_optimal_never_worse_than_greedy():
    import random
    rnd = random.Random(7)
    atoms = []
    pid = 0
    for _ in range(30):
        n = rnd.randint(1, 9)
        atoms += _lines(n, para_id=pid)
        atoms.append(Atom(kind=A_SPACE, height=1.5))
        pid += 1
    H = 47.0
    gs, _ = score_layout(paginate_greedy(atoms, H), H)
    os_, _ = score_layout(paginate_optimal(atoms, H), H)
    assert os_ <= gs + 1e-9


def test_float_moves_image_forward():
    atoms = _lines(8, para_id=0)
    img = Atom(kind=A_IMAGE, height=30.0, para_id=1, line_idx=0, line_count=1)
    atoms.append(img)
    atoms += _lines(6, para_id=2)
    H = 50.0
    pages, floats = paginate_float(atoms, H)
    assert floats == 1
    # image leads page 2 instead of leaving page 1 40% empty
    assert pages[1].atoms[0].kind == A_IMAGE
    assert pages[0].used > 45.0


def test_shrink_distributes():
    from epub2pdf.paginate import _materialize
    a1 = _lines(1, h=40.0)[0]
    img = Atom(kind=A_IMAGE, height=30.0, shrink=12.0)
    page = _materialize([a1, img], 60.0)
    assert abs(sum(page.heights) - 60.0) < 1e-6


# ------------------------------------------------------------------- content

def test_parse_basics():
    html = (b"<html><body><h2>T</h2><p>Hello <b>bold</b> and <i>it</i>.</p>"
            b"<pre>a\n  b</pre><ul><li>x</li></ul></body></html>")
    blocks = parse_document(html, lambda s: None)
    kinds = [b.kind for b in blocks]
    assert kinds == ["heading", "para", "code", "code", "item"]
    assert blocks[0].keep_with_next
    assert blocks[1].no_indent            # first para after heading
    para = blocks[1]
    assert any(s.bold for s in para.spans)
    assert any(s.italic for s in para.spans)
    assert blocks[3].spans[0].text.startswith("\u00a0\u00a0")  # pre indent kept (as NBSP)
