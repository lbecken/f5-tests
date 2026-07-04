"""Hybrid retrieval: numpy vector search + FTS5 keyword search, RRF-merged.

Per-document embedding matrices are lazily loaded from SQLite and cached in
memory (normalized float32). The cache is invalidated on ingest/delete.
"""
from __future__ import annotations

import re
import threading
from typing import Callable, Iterable

import numpy as np

# doc_id -> (matrix [n, d] float32 L2-normalized, chunk_ids int64 [n])
_CACHE: dict[int, tuple[np.ndarray, np.ndarray]] = {}
_CACHE_LOCK = threading.Lock()

RRF_K = 60


def invalidate_doc(doc_id: int) -> None:
    with _CACHE_LOCK:
        _CACHE.pop(doc_id, None)


def invalidate_all() -> None:
    with _CACHE_LOCK:
        _CACHE.clear()


def _normalize(mat: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return mat / norms


def _load_doc_matrix(db, doc_id: int) -> tuple[np.ndarray, np.ndarray]:
    with _CACHE_LOCK:
        cached = _CACHE.get(doc_id)
    if cached is not None:
        return cached

    rows = db.query(
        "SELECT id, embedding FROM chunks WHERE doc_id=? AND embedding IS NOT NULL ORDER BY id",
        (doc_id,),
    )
    if not rows:
        empty = (np.zeros((0, 0), dtype="float32"), np.zeros((0,), dtype="int64"))
        with _CACHE_LOCK:
            _CACHE[doc_id] = empty
        return empty

    ids = np.array([r["id"] for r in rows], dtype="int64")
    vecs = np.stack([np.frombuffer(r["embedding"], dtype="<f4") for r in rows]).astype("float32")
    mat = _normalize(vecs)
    result = (mat, ids)
    with _CACHE_LOCK:
        _CACHE[doc_id] = result
    return result


def _resolve_doc_ids(db, doc_ids: Iterable[int] | None) -> list[int]:
    if doc_ids:
        return list(doc_ids)
    rows = db.query("SELECT id FROM documents WHERE status='ready'")
    return [r["id"] for r in rows]


# ---------------------------------------------------------------------------
# Vector search
# ---------------------------------------------------------------------------
def vector_search(db, query_emb: list[float] | np.ndarray, doc_ids: Iterable[int] | None, k: int) -> list[tuple[int, float]]:
    """Return up to ``k`` (chunk_id, cosine_score) sorted by descending score."""
    q = np.asarray(query_emb, dtype="float32").ravel()
    qn = np.linalg.norm(q)
    if qn == 0:
        return []
    q = q / qn

    all_ids: list[np.ndarray] = []
    all_scores: list[np.ndarray] = []
    for doc_id in _resolve_doc_ids(db, doc_ids):
        mat, ids = _load_doc_matrix(db, doc_id)
        if mat.shape[0] == 0 or mat.shape[1] != q.shape[0]:
            continue
        scores = mat @ q
        all_ids.append(ids)
        all_scores.append(scores)

    if not all_ids:
        return []

    ids = np.concatenate(all_ids)
    scores = np.concatenate(all_scores)
    top = np.argsort(-scores)[:k]
    return [(int(ids[i]), float(scores[i])) for i in top]


# ---------------------------------------------------------------------------
# Keyword search (FTS5 bm25)
# ---------------------------------------------------------------------------
def _fts_query(query: str) -> str:
    terms = re.findall(r"\w+", query.lower())
    if not terms:
        return ""
    return " OR ".join(f'"{t}"' for t in terms)


def keyword_search(db, query: str, doc_ids: Iterable[int] | None, k: int) -> list[tuple[int, float]]:
    match = _fts_query(query)
    if not match:
        return []
    ids = _resolve_doc_ids(db, doc_ids)
    if not ids:
        return []
    placeholders = ",".join("?" for _ in ids)
    sql = (
        "SELECT c.id AS id, bm25(chunks_fts) AS score "
        "FROM chunks_fts JOIN chunks c ON c.id = chunks_fts.rowid "
        f"WHERE chunks_fts MATCH ? AND c.doc_id IN ({placeholders}) "
        "ORDER BY score LIMIT ?"
    )
    rows = db.query(sql, [match, *ids, k])
    # bm25: more negative == better; return in ranked order.
    return [(int(r["id"]), float(r["score"])) for r in rows]


# ---------------------------------------------------------------------------
# Reciprocal Rank Fusion
# ---------------------------------------------------------------------------
def rrf_merge(rankings: list[list[int]], k: int = RRF_K) -> list[int]:
    """Fuse several ranked id lists into one, by summed reciprocal rank."""
    scores: dict[int, float] = {}
    for ranking in rankings:
        for rank, item in enumerate(ranking):
            scores[item] = scores.get(item, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores, key=lambda i: -scores[i])


# ---------------------------------------------------------------------------
# Citation / detail hydration
# ---------------------------------------------------------------------------
def hydrate_chunks(db, chunk_ids: list[int]) -> list[dict]:
    if not chunk_ids:
        return []
    placeholders = ",".join("?" for _ in chunk_ids)
    rows = db.query(
        "SELECT c.id AS chunk_id, c.doc_id, c.section_id, c.seq, c.text, "
        "       d.name AS doc_name, s.path AS section_path, s.title AS section_title "
        "FROM chunks c "
        "JOIN documents d ON d.id = c.doc_id "
        "LEFT JOIN sections s ON s.id = c.section_id "
        f"WHERE c.id IN ({placeholders})",
        chunk_ids,
    )
    by_id = {r["chunk_id"]: r for r in rows}
    out = []
    for cid in chunk_ids:  # preserve fused order
        r = by_id.get(cid)
        if r is None:
            continue
        out.append(
            {
                "chunk_id": r["chunk_id"],
                "doc_id": r["doc_id"],
                "doc_name": r["doc_name"],
                "section_id": r["section_id"],
                "section_path": r["section_path"],
                "section_title": r["section_title"],
                "seq": r["seq"],
                "text": r["text"],
                "citation": _citation(r["doc_name"], r["section_path"], r["section_title"]),
            }
        )
    return out


def _citation(doc_name: str, path: str | None, title: str | None) -> str:
    parts = [doc_name]
    if path:
        parts.append(f"§{path}")
    if title:
        parts.append(title)
    return f"[{' '.join(parts)}]"


# ---------------------------------------------------------------------------
# High-level entry points
# ---------------------------------------------------------------------------
EmbedFn = Callable[[str, str, list[str]], list[list[float]]]


def _embed_query(host: str, model: str, text: str, embed_fn: EmbedFn | None) -> list[float]:
    if embed_fn is None:
        from .ingest import embed_texts

        embed_fn = embed_texts
    return embed_fn(host, model, [text])[0]


def hybrid(
    db,
    query: str,
    doc_ids: Iterable[int] | None,
    k: int,
    *,
    host: str,
    embed_model: str,
    embed_fn: EmbedFn | None = None,
) -> list[dict]:
    """Embed query, run vector + keyword search, RRF-merge, hydrate citations."""
    query_emb = _embed_query(host, embed_model, query, embed_fn)
    vec = vector_search(db, query_emb, doc_ids, k * 2)
    kw = keyword_search(db, query, doc_ids, k * 2)
    fused = rrf_merge([[cid for cid, _ in vec], [cid for cid, _ in kw]])
    return hydrate_chunks(db, fused[:k])


def similar(
    db,
    text: str,
    doc_ids: Iterable[int] | None,
    k: int,
    *,
    host: str,
    embed_model: str,
    exclude_chunk_id: int | None = None,
    embed_fn: EmbedFn | None = None,
) -> list[dict]:
    query_emb = _embed_query(host, embed_model, text, embed_fn)
    vec = vector_search(db, query_emb, doc_ids, k + (1 if exclude_chunk_id else 0))
    ids = [cid for cid, _ in vec if cid != exclude_chunk_id][:k]
    return hydrate_chunks(db, ids)
