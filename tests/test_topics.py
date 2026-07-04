"""Topic CRUD and export/import round-trip."""
from __future__ import annotations

from app import topics


def _make_doc(db, name, chash):
    cur = db.execute(
        "INSERT INTO documents(name, source_path, format, content_hash, status) VALUES (?,?,?,?,'ready')",
        (name, f"/{name}", "md", chash),
    )
    return cur.lastrowid


def test_topic_crud(db):
    d1 = _make_doc(db, "A.md", "h1")
    t = topics.create_topic(db, "Study 1", [d1])
    assert t["name"] == "Study 1"
    assert [d["id"] for d in t["documents"]] == [d1]

    got = topics.get_topic(db, t["id"])
    assert got["messages"] == []

    updated = topics.update_topic(db, t["id"], name="Renamed")
    assert updated["name"] == "Renamed"

    assert topics.list_topics(db)[0]["name"] == "Renamed"

    assert topics.delete_topic(db, t["id"]) is True
    assert topics.get_topic(db, t["id"]) is None


def test_update_documents(db):
    d1 = _make_doc(db, "A.md", "h1")
    d2 = _make_doc(db, "B.md", "h2")
    t = topics.create_topic(db, "T", [d1])
    updated = topics.update_topic(db, t["id"], doc_ids=[d1, d2])
    assert sorted(d["id"] for d in updated["documents"]) == sorted([d1, d2])


def test_messages_persist(db):
    t = topics.create_topic(db, "T", [])
    topics.add_message(db, t["id"], "user", "hi")
    mid = topics.add_message(db, t["id"], "assistant", "hello", tool_calls=[{"name": "search"}])
    msgs = topics.get_messages(db, t["id"])
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    assert msgs[1]["id"] == mid
    assert msgs[1]["tool_calls"] == [{"name": "search"}]
    # history for agent excludes tool trace, keeps role/content
    hist = topics.history_for_agent(db, t["id"])
    assert hist == [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]


def test_export_import_round_trip(db):
    d1 = _make_doc(db, "A.md", "hashA")
    t = topics.create_topic(db, "Original", [d1])
    topics.add_message(db, t["id"], "user", "question?")
    topics.add_message(db, t["id"], "assistant", "answer [A.md §1 X]", tool_calls=[{"name": "search"}])

    bundle = topics.export_topic(db, t["id"])
    assert bundle["version"] == "1"
    assert bundle["topic"]["name"] == "Original"
    assert bundle["documents"] == [{"name": "A.md", "content_hash": "hashA"}]
    assert len(bundle["messages"]) == 2

    result = topics.import_topic(db, bundle)
    assert result["warnings"] == []
    imported = topics.get_topic(db, result["topic_id"])
    assert imported["name"] == "Original"
    assert [d["content_hash"] for d in imported["documents"]] == ["hashA"]
    assert [m["content"] for m in imported["messages"]] == ["question?", "answer [A.md §1 X]"]


def test_import_warns_about_missing_documents(db):
    bundle = {
        "version": "1",
        "topic": {"name": "Ported"},
        "documents": [{"name": "Missing.md", "content_hash": "nope"}],
        "messages": [{"role": "user", "content": "hi", "tool_calls": None, "created_at": "x"}],
    }
    result = topics.import_topic(db, bundle)
    assert len(result["warnings"]) == 1
    assert "Missing.md" in result["warnings"][0]
    imported = topics.get_topic(db, result["topic_id"])
    assert imported["documents"] == []
    assert imported["messages"][0]["content"] == "hi"
