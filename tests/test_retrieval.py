"""RRF merge and end-to-end hybrid retrieval over an in-tmp db."""
from __future__ import annotations

from app import retrieval
from app.ingest import ingest_document
from app.retrieval import rrf_merge

from .conftest import fake_embed


def test_rrf_merge_orders_by_fused_rank():
    a = [1, 2, 3]
    b = [3, 2, 1]
    merged = rrf_merge([a, b])
    assert set(merged) == {1, 2, 3}
    # Items ranked #1 in one list (1 and 3) narrowly beat the always-middle 2.
    assert merged[0] in (1, 3)
    assert merged[-1] == 2


def test_rrf_merge_rewards_agreement():
    # item 5 appears high in both lists -> should win
    merged = rrf_merge([[5, 1, 2], [5, 3, 4]])
    assert merged[0] == 5


def test_rrf_empty():
    assert rrf_merge([]) == []
    assert rrf_merge([[], []]) == []


def _make_doc(db, cfg):
    retrieval.invalidate_all()
    cur = db.execute(
        "INSERT INTO documents(name, source_path, format, content_hash, status) "
        "VALUES ('Doc','/x.md','md','hash1','pending')",
    )
    doc_id = cur.lastrowid
    # Write a small markdown file to ingest.
    p = cfg.data_dir / "x.md"
    p.write_text(
        "# Animals\n\nThe cat sat on the mat.\n\n## Dogs\n\nThe dog ran in the park.\n\n"
        "## Birds\n\nThe bird flew over the ocean and the sea.\n",
        encoding="utf-8",
    )
    ingest_document(
        db, doc_id, str(p), "md", "Doc",
        host="x", embed_model="m", chunk_chars=cfg.retrieval.chunk_chars,
        overlap=cfg.retrieval.chunk_overlap,
        embed_fn=fake_embed, invalidate=retrieval.invalidate_doc,
    )
    return doc_id


def test_ingest_and_keyword_search(db, cfg):
    doc_id = _make_doc(db, cfg)
    row = db.query_one("SELECT status FROM documents WHERE id=?", (doc_id,))
    assert row["status"] == "ready"

    hits = retrieval.keyword_search(db, "dog park", [doc_id], k=5)
    assert hits, "expected keyword hits"
    top_chunk = db.query_one("SELECT text FROM chunks WHERE id=?", (hits[0][0],))
    assert "dog" in top_chunk["text"].lower()


def test_hybrid_returns_citations(db, cfg):
    doc_id = _make_doc(db, cfg)
    results = retrieval.hybrid(
        db, "bird ocean", [doc_id], 5,
        host="x", embed_model="m", embed_fn=fake_embed,
    )
    assert results
    assert all("citation" in r and r["citation"].startswith("[") for r in results)


def test_vector_search_cache_invalidation(db, cfg):
    doc_id = _make_doc(db, cfg)
    emb = fake_embed("x", "m", ["cat mat"])[0]
    hits = retrieval.vector_search(db, emb, [doc_id], 3)
    assert hits
    retrieval.invalidate_doc(doc_id)
    # still works after invalidation (reloads from db)
    hits2 = retrieval.vector_search(db, emb, [doc_id], 3)
    assert hits2
