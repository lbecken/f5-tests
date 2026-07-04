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
from collections import Counter
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


# A heading whose exact (level, title) repeats this many times is a page
# banner (e.g. the book title re-printed at the top of every chapter), not
# real structure.
BANNER_MIN_REPEATS = 5
# "Paper 92" / "Chapter 7" style headings: structural number, usually followed
# by a sibling heading carrying the actual title.
_NUMBERED_UNIT_RE = re.compile(r"^(?:Paper|Chapter|Part)\s+0*(\d{1,4})\s*$", re.IGNORECASE)
# Titles like "4. The Gift of Revelation" / "5․ The Great Religious Leaders"
# (the one-dot-leader ․ appears in HTML-derived markdown).
_LEADING_NUM_RE = re.compile(r"^0*(\d{1,3})\s*[.․·:)]\s*\S")


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

    # Collapse repeated banner headings: drop the heading, keep its body with
    # the preceding section (usually just inter-page navigation cruft).
    counts = Counter((lvl, ttl) for lvl, ttl, _ in raw)
    collapsed: list[tuple[int, str, list[str]]] = []
    for lvl, ttl, body in raw:
        if counts[(lvl, ttl)] >= BANNER_MIN_REPEATS:
            (collapsed[-1][2] if collapsed else lead).extend(body)
        else:
            collapsed.append((lvl, ttl, body))

    if lead and any(ln.strip() for ln in lead):
        # Same level as the shallowest real heading, so front matter is a
        # sibling of the top sections, never their parent (banner collapse can
        # leave the whole document at level 2+).
        top_level = min((lvl for lvl, _, _ in collapsed), default=1)
        collapsed.insert(0, (top_level, "Front Matter" if collapsed else doc_name, lead))

    # Merge "Paper N" + following same-level title heading into one section
    # whose explicit path component is N, so citations match the document's
    # own numbering.
    entries = [(lvl, ttl, "\n".join(body)) for lvl, ttl, body in collapsed]
    flat: list[tuple[int, str, str, int | None]] = []
    i = 0
    while i < len(entries):
        lvl, ttl, body = entries[i]
        m = _NUMBERED_UNIT_RE.match(ttl)
        if m and not body.strip() and i + 1 < len(entries) and entries[i + 1][0] == lvl:
            num = int(m.group(1))
            _, nxt_title, nxt_body = entries[i + 1]
            flat.append((lvl, f"{ttl}: {nxt_title}", nxt_body, num))
            i += 2
            continue
        flat.append((lvl, ttl, body, int(m.group(1)) if m else None))
        i += 1

    return _build_document(flat, chunk_chars, overlap, strip=True)


# ---------------------------------------------------------------------------
# Shared tree + chunk building
# ---------------------------------------------------------------------------
def _assign_ordinals(flat: list[tuple]) -> tuple[list[int | None], list[int]]:
    """Compute each entry's parent index and path component.

    The path component is the document's own number when known (an explicit
    "Paper N" merge or a "4. Title" prefix); other siblings get the lowest
    free sequential ordinals. Explicit numbers are reserved first across the
    whole sibling group so an unnumbered section appearing earlier in the file
    can never steal a numbered sibling's slot.
    """
    parents: list[int | None] = []
    stack: list[tuple[int, int]] = []  # (level, entry_index)
    for i, tup in enumerate(flat):
        level = tup[0]
        while stack and stack[-1][0] >= level:
            stack.pop()
        parents.append(stack[-1][1] if stack else None)
        stack.append((level, i))

    def explicit_of(tup) -> int | None:
        if len(tup) > 3 and tup[3] is not None:
            return tup[3]
        m = _LEADING_NUM_RE.match(tup[1])
        return int(m.group(1)) if m else None

    groups: dict[int | None, list[int]] = {}
    for i, p in enumerate(parents):
        groups.setdefault(p, []).append(i)

    ords = [0] * len(flat)
    for kids in groups.values():
        used: set[int] = set()
        chosen: dict[int, int] = {}
        for i in kids:
            e = explicit_of(flat[i])
            if e is not None and e not in used:
                used.add(e)
                chosen[i] = e
        nxt = 1
        for i in kids:
            if i in chosen:
                ords[i] = chosen[i]
                continue
            while nxt in used:
                nxt += 1
            used.add(nxt)
            ords[i] = nxt
    return parents, ords


def _build_document(
    flat: list[tuple],
    chunk_chars: int,
    overlap: int,
    *,
    strip: bool,
) -> ParsedDocument:
    """Turn a flat ``[(level, title, body[, explicit_num])]`` list into sections+chunks."""
    doc = ParsedDocument()
    parents, ords = _assign_ordinals(flat)
    seq = 0

    for idx, tup in enumerate(flat):
        level, title, body = tup[0], tup[1], tup[2]
        parent_idx = parents[idx]
        ord_ = ords[idx]
        path = f"{doc.sections[parent_idx].path}.{ord_}" if parent_idx is not None else str(ord_)

        text = strip_html(body) if strip else body
        section = ParsedSection(
            level=level, title=title, path=path, parent_idx=parent_idx, ord=ord_, body=text
        )
        doc.sections.append(section)

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
    cur: list[str] = []
    cur_len = 0
    for u in units:
        if cur and cur_len + 2 + len(u) > chunk_chars:
            # Never end a chunk on a paragraph that introduces what follows
            # (ends with ':'): carry it into the next chunk so a list is never
            # separated from its lead-in.
            carry: list[str] = []
            if len(cur) > 1 and cur[-1].rstrip().endswith(":"):
                carry = [cur.pop()]
            chunks.append("\n\n".join(cur))
            if carry:
                cur = carry + [u]
            else:
                tail = chunks[-1][-overlap:] if overlap > 0 else ""
                cur = ([tail] if tail else []) + [u]
        else:
            cur.append(u)
        cur_len = sum(len(x) for x in cur) + 2 * (len(cur) - 1)
    if cur and "\n\n".join(cur).strip():
        chunks.append("\n\n".join(cur))
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
