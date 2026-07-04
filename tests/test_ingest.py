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
