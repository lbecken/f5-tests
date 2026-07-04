"""Markdown heading parsing (incl. HTML <hN>) and chunk boundaries."""
from __future__ import annotations

from app.ingest import chunk_text, parse_markdown, strip_html


def test_markdown_hash_headings_build_tree():
    md = """# Title

intro paragraph.

## Section A

Body of A.

### Sub A1

Body of A1.

## Section B

Body of B.
"""
    doc = parse_markdown(md, "Doc", chunk_chars=1000, overlap=100)
    titles = [(s.level, s.title, s.path) for s in doc.sections]
    assert titles[0] == (1, "Title", "1")
    assert (2, "Section A", "1.1") in titles
    assert (3, "Sub A1", "1.1.1") in titles
    assert (2, "Section B", "1.2") in titles


def test_markdown_html_headings():
    md = """<h1 align="center"><a name="x"></a>The Book</h1>

Front matter text with <em>emphasis</em> and &amp; entities.

<h2>Chapter One</h2>

Chapter one body.
"""
    doc = parse_markdown(md, "Doc", chunk_chars=1000, overlap=100)
    titles = {s.title for s in doc.sections}
    assert "The Book" in titles
    assert "Chapter One" in titles
    # HTML tags stripped, entities unescaped in body text
    body = "\n".join(s.body for s in doc.sections)
    assert "<em>" not in body
    assert "&amp;" not in body
    assert "emphasis" in body


def test_multiline_html_heading():
    md = """<h1
 align="center">Split Heading</h1>

body
"""
    doc = parse_markdown(md, "Doc", chunk_chars=1000, overlap=100)
    assert any(s.title == "Split Heading" for s in doc.sections)


def test_leading_content_before_heading_gets_front_matter():
    md = """some preamble before any heading

# Real Heading

body
"""
    doc = parse_markdown(md, "Doc", chunk_chars=1000, overlap=100)
    assert doc.sections[0].title == "Front Matter"
    assert doc.sections[1].title == "Real Heading"


def test_strip_html_unescapes_and_removes_tags():
    assert "hello world" in strip_html("<p>hello <b>world</b></p>")
    assert "&" in strip_html("a &amp; b")


def test_chunk_boundaries_respect_size_and_overlap():
    paras = "\n\n".join(f"Paragraph number {i} " * 10 for i in range(10))
    chunks = chunk_text(paras, chunk_chars=300, overlap=50)
    assert len(chunks) > 1
    # No chunk wildly exceeds the target (allowing overlap slack).
    for c in chunks:
        assert len(c) <= 300 + 50 + 400  # generous ceiling incl. one para
    # Consecutive chunks share overlapping tail/context.
    joined = " ".join(chunks)
    assert "Paragraph number 0" in joined
    assert "Paragraph number 9" in joined


def test_chunk_long_single_paragraph_is_split():
    big = "x" * 1000
    chunks = chunk_text(big, chunk_chars=300, overlap=0)
    assert len(chunks) >= 3


def test_empty_text_yields_no_chunks():
    assert chunk_text("   \n  ", 100, 10) == []


# ---------------------------------------------------------------------------
# Real-world structure: repeated banners, "Paper N" merges, numbered sections
# ---------------------------------------------------------------------------
def _book_like_md():
    # leading text before any heading, like a real title page
    parts = ["ISBN 978-0/000\n\nFirst published 1955."]
    for n, title, secs in [
        (91, "The Alter Ego Concept", ["1․ Primitive Prayer"]),
        (92, "The Later Evolution of Religion", ["3․ The Nature of Religion", "4․ The Gift of Revelation"]),
    ]:
        parts.append('<h1 align="center"><a name="PaperX"></a>The Urantia Book</h1>')
        parts.append(f"## Paper {n}")
        parts.append(f'## <a name="U{n}_0_0"></a>{title}')
        parts.append("Intro paragraph.")
        for s in secs:
            parts.append(f'### <a name="x"></a>{s}')
            parts.append("Section body text.")
    # 3 more banners to cross the repeat threshold
    for _ in range(3):
        parts.append('<h1 align="center">The Urantia Book</h1>')
        parts.append("nav cruft")
    return "\n\n".join(parts)


def test_banner_headings_are_collapsed():
    doc = parse_markdown(_book_like_md(), "book.md", 400, 80)
    titles = [s.title for s in doc.sections]
    assert "The Urantia Book" not in titles


def test_paper_numbers_become_paths():
    doc = parse_markdown(_book_like_md(), "book.md", 400, 80)
    by_path = {s.path: s.title for s in doc.sections}
    assert by_path["91"].startswith("Paper 91:")
    assert by_path["92"] == "Paper 92: The Later Evolution of Religion"
    # section number comes from the "4․" title prefix, not sibling order
    assert by_path["92.4"].endswith("The Gift of Revelation")
    assert by_path["92.3"].endswith("The Nature of Religion")


def test_unnumbered_sibling_cannot_steal_paper_number():
    md = "## Preface\n\ntext\n\n## Paper 1\n\n## <a name></a>The Universal Father\n\nbody"
    doc = parse_markdown(md, "b.md", 400, 80)
    by_path = {s.path: s.title for s in doc.sections}
    assert by_path["1"] == "Paper 1: The Universal Father"
    assert "Preface" in by_path.values()


def test_chunker_never_ends_on_list_introduction():
    intro = "x" * 300
    lead_in = "There have been many events but only five of significance. These were as follows:"
    items = [f"{i}. Item text {'y' * 120}" for i in range(1, 6)]
    text = "\n\n".join([intro, lead_in] + items)
    chunks = chunk_text(text, 400, 80)
    assert len(chunks) > 1
    for ch in chunks:
        assert not ch.rstrip().endswith(":")
    joined = "\n".join(chunks)
    assert "as follows:" in joined and "5. Item" in joined


def test_front_matter_is_sibling_of_papers_not_parent():
    doc = parse_markdown(_book_like_md(), "book.md", 400, 80)
    by_path = {s.path: s for s in doc.sections}
    assert by_path["92"].parent_idx is None
    fm = next(s for s in doc.sections if s.title == "Front Matter")
    assert fm.parent_idx is None and "." not in fm.path
