"""Ingestion: md/pdf -> sections -> chunks -> embeddings.

Parsing is linear/streaming-friendly (the sample book is ~7 MB). Markdown
handles both ``#`` headings and inline HTML ``<h1>``–``<h6>`` tags. Embeddings
are batched through Ollama. Indexing runs on a background thread and reports
progress into an in-memory dict keyed by ``doc_id``.
"""
from __future__ import annotations

import hashlib
import html
import re
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

# ---------------------------------------------------------------------------
# In-memory ingestion progress: {doc_id: {"done": int, "total": int, "phase": str}}
# ---------------------------------------------------------------------------
PROGRESS: dict[int, dict[str, Any]] = {}
_PROGRESS_LOCK = threading.Lock()


def set_progress(doc_id: int, *, done: int, total: int, phase: str) -> None:
    with _PROGRESS_LOCK:
        PROGRESS[doc_id] = {"done": done, "total": total, "phase": phase}


def get_progress(doc_id: int) -> dict[str, Any] | None:
    with _PROGRESS_LOCK:
        p = PROGRESS.get(doc_id)
        return dict(p) if p else None


def clear_progress(doc_id: int) -> None:
    with _PROGRESS_LOCK:
        PROGRESS.pop(doc_id, None)


# ---------------------------------------------------------------------------
# Parsing data structures
# ---------------------------------------------------------------------------
@dataclass
class ParsedSection:
    level: int
    title: str
    path: str
    parent_idx: int | None
    ord: int
    body: str = ""


@dataclass
class ParsedChunk:
    section_idx: int
    seq: int
    text: str


@dataclass
class ParsedDocument:
    sections: list[ParsedSection] = field(default_factory=list)
    chunks: list[ParsedChunk] = field(default_factory=list)


# ---------------------------------------------------------------------------
# HTML / text helpers
# ---------------------------------------------------------------------------
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"[ \t\f\v]+")
_MD_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*\S)\s*$")
# Opening HTML heading tag; capture level so we can find the matching close.
_HTML_HOPEN_RE = re.compile(r"<h([1-6])\b[^>]*>", re.IGNORECASE)
# Just the start of an opening heading tag (attributes/close may be on later lines).
_HTML_HSTART_RE = re.compile(r"<h([1-6])\b", re.IGNORECASE)


def strip_html(text: str) -> str:
    """Remove HTML tags and unescape entities; collapse intra-line whitespace."""
    text = _TAG_RE.sub(" ", text)
    text = html.unescape(text)
    # collapse runs of spaces/tabs but preserve newlines (paragraph structure)
    lines = [_WS_RE.sub(" ", ln).strip() for ln in text.split("\n")]
    return "\n".join(lines)


def _clean_title(raw: str) -> str:
    return _WS_RE.sub(" ", html.unescape(_TAG_RE.sub(" ", raw))).strip()


# ---------------------------------------------------------------------------
# Markdown parsing
# ---------------------------------------------------------------------------
def _iter_markdown_headings(text: str):
    """Yield ``(level, title, is_heading, raw_line)`` for each logical line.

    Handles ``#`` headings and single- or multi-line HTML ``<hN>`` blocks. For
    a heading, ``is_heading`` is True and body is empty. Multi-line HTML heading
    tags are joined so the title is complete.
    """
    lines = text.split("\n")
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        md = _MD_HEADING_RE.match(line)
        if md:
            yield (len(md.group(1)), _clean_title(md.group(2)), True, line)
            i += 1
            continue

        start = _HTML_HSTART_RE.search(line)
        if start:
            level = int(start.group(1))
            close_re = re.compile(rf"</h{level}\s*>", re.IGNORECASE)
            # Accumulate lines until we have the full <hN ...>...</hN> block
            # (the opening tag and/or the close tag may span multiple lines).
            buf = line
            j = i
            while close_re.search(buf) is None and j + 1 < n:
                j += 1
                buf += "\n" + lines[j]
            opening = _HTML_HOPEN_RE.search(buf)
            close = close_re.search(buf)
            if opening is not None:
                inner_start = opening.end()
                inner = buf[inner_start : close.start()] if close else buf[inner_start:]
            else:  # malformed: fall back to the whole buffer
                inner = buf
            yield (level, _clean_title(inner), True, line)
            i = j + 1
            continue

        yield (0, "", False, line)
        i += 1


def parse_markdown(text: str, doc_name: str, chunk_chars: int, overlap: int) -> ParsedDocument:
    # Build a flat sequence of (level, title, body_lines).
    raw: list[tuple[int, str, list[str]]] = []
    lead: list[str] = []
    cur: tuple[int, str, list[str]] | None = None

    for level, title, is_heading, line in _iter_markdown_headings(text):
        if is_heading:
            if cur is not None:
                raw.append(cur)
            cur = (level, title or "(untitled)", [])
        else:
            if cur is None:
                lead.append(line)
            else:
                cur[2].append(line)
    if cur is not None:
        raw.append(cur)

    if lead and any(ln.strip() for ln in lead):
        raw.insert(0, (1, "Front Matter" if raw else doc_name, lead))

    return _build_document(
        [(lvl, ttl, "\n".join(body)) for lvl, ttl, body in raw],
        chunk_chars,
        overlap,
        strip=True,
    )


# ---------------------------------------------------------------------------
# Shared tree + chunk building
# ---------------------------------------------------------------------------
def _build_document(
    flat: list[tuple[int, str, str]],
    chunk_chars: int,
    overlap: int,
    *,
    strip: bool,
) -> ParsedDocument:
    """Turn a flat ``[(level, title, body)]`` list into sections+chunks."""
    doc = ParsedDocument()
    # stack of (level, section_idx, child_count)
    stack: list[list[Any]] = []
    seq = 0

    for level, title, body in flat:
        while stack and stack[-1][0] >= level:
            stack.pop()
        parent_idx = stack[-1][1] if stack else None
        if stack:
            stack[-1][2] += 1
            ord_ = stack[-1][2]
            path = f"{doc.sections[parent_idx].path}.{ord_}"
        else:
            # top-level ordinal
            ord_ = sum(1 for s in doc.sections if s.parent_idx is None) + 1
            path = str(ord_)

        idx = len(doc.sections)
        text = strip_html(body) if strip else body
        section = ParsedSection(
            level=level, title=title, path=path, parent_idx=parent_idx, ord=ord_, body=text
        )
        doc.sections.append(section)
        stack.append([level, idx, 0])

        for ctext in chunk_text(text, chunk_chars, overlap):
            doc.chunks.append(ParsedChunk(section_idx=idx, seq=seq, text=ctext))
            seq += 1

    return doc


def chunk_text(text: str, chunk_chars: int, overlap: int) -> list[str]:
    """Split ``text`` into ~``chunk_chars`` chunks, preferring paragraph breaks.

    Paragraphs are kept whole when possible; over-long paragraphs are hard-split.
    Consecutive chunks share up to ``overlap`` characters of tail context.
    """
    text = text.strip()
    if not text:
        return []
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]

    units: list[str] = []
    for p in paras:
        if len(p) <= chunk_chars:
            units.append(p)
        else:
            for i in range(0, len(p), chunk_chars):
                units.append(p[i : i + chunk_chars])

    chunks: list[str] = []
    cur = ""
    for u in units:
        if cur and len(cur) + 2 + len(u) > chunk_chars:
            chunks.append(cur)
            tail = cur[-overlap:] if overlap > 0 else ""
            cur = (tail + "\n\n" + u).strip() if tail else u
        else:
            cur = (cur + "\n\n" + u).strip() if cur else u
    if cur.strip():
        chunks.append(cur)
    return chunks


# ---------------------------------------------------------------------------
# PDF parsing
# ---------------------------------------------------------------------------
def parse_pdf(path: str | Path, chunk_chars: int, overlap: int) -> ParsedDocument:
    import fitz  # pymupdf, imported lazily

    doc = fitz.open(str(path))
    try:
        n_pages = doc.page_count
        page_texts = [doc.load_page(i).get_text() for i in range(n_pages)]
        toc = doc.get_toc(simple=True)  # [[level, title, page(1-based)], ...]
    finally:
        doc.close()

    flat: list[tuple[int, str, str]] = []
    if toc:
        # Determine each entry's page span: from its page to the page before the
        # next entry whose level <= this one is not needed; text runs to the
        # next entry's start page regardless of level (sequential outline).
        starts = [max(1, entry[2]) for entry in toc]
        for i, (level, title, _page) in enumerate(toc):
            start = starts[i]
            end = starts[i + 1] if i + 1 < len(toc) else n_pages + 1
            body = "\n".join(page_texts[start - 1 : max(start - 1, end - 1)])
            flat.append((max(1, level), _clean_title(title), body))
    else:
        page_span = 20
        for start in range(0, n_pages, page_span):
            end = min(start + page_span, n_pages)
            title = f"Pages {start + 1}–{end}"
            body = "\n".join(page_texts[start:end])
            flat.append((1, title, body))

    # PDF text is already plain; no HTML stripping needed.
    return _build_document(flat, chunk_chars, overlap, strip=False)


# ---------------------------------------------------------------------------
# File helpers
# ---------------------------------------------------------------------------
def compute_hash(path: str | Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def detect_format(path: str | Path) -> str:
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        return "pdf"
    return "md"


def parse_file(path: str | Path, fmt: str, doc_name: str, chunk_chars: int, overlap: int) -> ParsedDocument:
    if fmt == "pdf":
        return parse_pdf(path, chunk_chars, overlap)
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    return parse_markdown(text, doc_name, chunk_chars, overlap)


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------
def embed_texts(host: str, model: str, texts: list[str], batch: int = 64) -> list[list[float]]:
    """Embed ``texts`` through Ollama in batches. Imported lazily for testability."""
    import ollama

    client = ollama.Client(host=host)
    out: list[list[float]] = []
    for i in range(0, len(texts), batch):
        chunk = texts[i : i + batch]
        resp = client.embed(model=model, input=chunk)
        embs = resp["embeddings"] if isinstance(resp, dict) else resp.embeddings
        out.extend(embs)
    return out


# ---------------------------------------------------------------------------
# Full ingestion pipeline (runs on a background thread)
# ---------------------------------------------------------------------------
def ingest_document(
    db,
    doc_id: int,
    path: str,
    fmt: str,
    doc_name: str,
    *,
    host: str,
    embed_model: str,
    chunk_chars: int,
    overlap: int,
    embed_fn: Callable[[str, str, list[str]], list[list[float]]] | None = None,
    invalidate: Callable[[int], None] | None = None,
) -> None:
    """Parse, chunk, embed, and store a document. Updates status + progress."""
    import numpy as np

    embed_fn = embed_fn or (lambda h, m, t: embed_texts(h, m, t))
    set_progress(doc_id, done=0, total=0, phase="parsing")
    db.execute("UPDATE documents SET status='indexing', error=NULL WHERE id=?", (doc_id,))

    try:
        parsed = parse_file(path, fmt, doc_name, chunk_chars, overlap)

        # Insert sections, mapping parse index -> db id.
        idmap: dict[int, int] = {}
        with db.transaction() as conn:
            for idx, sec in enumerate(parsed.sections):
                parent_id = idmap.get(sec.parent_idx) if sec.parent_idx is not None else None
                cur = conn.execute(
                    "INSERT INTO sections(doc_id, parent_id, level, title, path, ord)"
                    " VALUES (?,?,?,?,?,?)",
                    (doc_id, parent_id, sec.level, sec.title, sec.path, sec.ord),
                )
                idmap[idx] = cur.lastrowid

        total = len(parsed.chunks)
        set_progress(doc_id, done=0, total=total, phase="embedding")

        # Insert chunks first (without embeddings), collecting their db ids.
        chunk_ids: list[int] = []
        with db.transaction() as conn:
            for ch in parsed.chunks:
                cur = conn.execute(
                    "INSERT INTO chunks(doc_id, section_id, seq, text) VALUES (?,?,?,?)",
                    (doc_id, idmap[ch.section_idx], ch.seq, ch.text),
                )
                chunk_ids.append(cur.lastrowid)

        # Embed in batches and write back as float32 little-endian blobs.
        batch = 64
        for i in range(0, total, batch):
            texts = [parsed.chunks[j].text for j in range(i, min(i + batch, total))]
            embs = embed_fn(host, embed_model, texts)
            with db.transaction() as conn:
                for k, emb in enumerate(embs):
                    vec = np.asarray(emb, dtype="<f4").tobytes()
                    conn.execute(
                        "UPDATE chunks SET embedding=? WHERE id=?",
                        (vec, chunk_ids[i + k]),
                    )
            set_progress(doc_id, done=min(i + batch, total), total=total, phase="embedding")

        db.execute("UPDATE documents SET status='ready', error=NULL WHERE id=?", (doc_id,))
        set_progress(doc_id, done=total, total=total, phase="ready")
    except Exception as exc:  # noqa: BLE001 - surface any failure to the UI
        db.execute(
            "UPDATE documents SET status='failed', error=? WHERE id=?",
            (f"{type(exc).__name__}: {exc}", doc_id),
        )
        set_progress(doc_id, done=0, total=0, phase="failed")
    finally:
        if invalidate is not None:
            invalidate(doc_id)


def start_ingestion(db, doc_id: int, path: str, fmt: str, doc_name: str, cfg, invalidate=None) -> threading.Thread:
    """Kick off ingestion on a daemon thread and return it."""
    t = threading.Thread(
        target=ingest_document,
        args=(db, doc_id, path, fmt, doc_name),
        kwargs=dict(
            host=cfg.ollama_host,
            embed_model=cfg.embed_model,
            chunk_chars=cfg.retrieval.chunk_chars,
            overlap=cfg.retrieval.chunk_overlap,
            invalidate=invalidate,
        ),
        daemon=True,
    )
    t.start()
    return t
