"""Topic CRUD, message persistence, and export/import bundles."""
from __future__ import annotations

import json
from typing import Any

EXPORT_VERSION = "1"


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------
def create_topic(db, name: str, doc_ids: list[int] | None = None) -> dict:
    cur = db.execute("INSERT INTO topics(name) VALUES (?)", (name,))
    topic_id = cur.lastrowid
    _set_documents(db, topic_id, doc_ids or [])
    return get_topic(db, topic_id)


def list_topics(db) -> list[dict]:
    rows = db.query("SELECT id, name, created_at, updated_at FROM topics ORDER BY updated_at DESC, id DESC")
    return [_topic_row(db, r) for r in rows]


def get_topic(db, topic_id: int, with_messages: bool = True) -> dict | None:
    row = db.query_one("SELECT id, name, created_at, updated_at FROM topics WHERE id=?", (topic_id,))
    if row is None:
        return None
    data = _topic_row(db, row)
    if with_messages:
        data["messages"] = get_messages(db, topic_id)
    return data


def update_topic(db, topic_id: int, name: str | None = None, doc_ids: list[int] | None = None) -> dict | None:
    if db.query_one("SELECT id FROM topics WHERE id=?", (topic_id,)) is None:
        return None
    if name is not None:
        db.execute("UPDATE topics SET name=?, updated_at=datetime('now') WHERE id=?", (name, topic_id))
    if doc_ids is not None:
        _set_documents(db, topic_id, doc_ids)
        db.execute("UPDATE topics SET updated_at=datetime('now') WHERE id=?", (topic_id,))
    return get_topic(db, topic_id)


def delete_topic(db, topic_id: int) -> bool:
    cur = db.execute("DELETE FROM topics WHERE id=?", (topic_id,))
    return cur.rowcount > 0


def _set_documents(db, topic_id: int, doc_ids: list[int]) -> None:
    with db.transaction() as conn:
        conn.execute("DELETE FROM topic_documents WHERE topic_id=?", (topic_id,))
        for doc_id in doc_ids:
            conn.execute(
                "INSERT OR IGNORE INTO topic_documents(topic_id, doc_id) VALUES (?,?)",
                (topic_id, doc_id),
            )


def _topic_row(db, row) -> dict:
    doc_rows = db.query(
        "SELECT d.id, d.name, d.status, d.content_hash FROM topic_documents td "
        "JOIN documents d ON d.id = td.doc_id WHERE td.topic_id=? ORDER BY d.id",
        (row["id"],),
    )
    return {
        "id": row["id"],
        "name": row["name"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "documents": [
            {"id": d["id"], "name": d["name"], "status": d["status"], "content_hash": d["content_hash"]}
            for d in doc_rows
        ],
    }


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------
def add_message(db, topic_id: int, role: str, content: str, tool_calls: Any = None) -> int:
    tc_json = json.dumps(tool_calls, ensure_ascii=False) if tool_calls is not None else None
    cur = db.execute(
        "INSERT INTO messages(topic_id, role, content, tool_calls) VALUES (?,?,?,?)",
        (topic_id, role, content, tc_json),
    )
    db.execute("UPDATE topics SET updated_at=datetime('now') WHERE id=?", (topic_id,))
    return cur.lastrowid


def get_messages(db, topic_id: int) -> list[dict]:
    rows = db.query(
        "SELECT id, role, content, tool_calls, created_at FROM messages WHERE topic_id=? ORDER BY id",
        (topic_id,),
    )
    out = []
    for r in rows:
        tc = json.loads(r["tool_calls"]) if r["tool_calls"] else None
        out.append(
            {
                "id": r["id"],
                "role": r["role"],
                "content": r["content"],
                "tool_calls": tc,
                "created_at": r["created_at"],
            }
        )
    return out


def history_for_agent(db, topic_id: int) -> list[dict[str, str]]:
    """Role/content pairs for the model (past tool-call traces excluded)."""
    rows = db.query(
        "SELECT role, content FROM messages WHERE topic_id=? AND role IN ('user','assistant') ORDER BY id",
        (topic_id,),
    )
    return [{"role": r["role"], "content": r["content"]} for r in rows]


# ---------------------------------------------------------------------------
# Export / import
# ---------------------------------------------------------------------------
def export_topic(db, topic_id: int) -> dict | None:
    topic = get_topic(db, topic_id)
    if topic is None:
        return None
    return {
        "version": EXPORT_VERSION,
        "topic": {"name": topic["name"]},
        "documents": [{"name": d["name"], "content_hash": d["content_hash"]} for d in topic["documents"]],
        "messages": [
            {"role": m["role"], "content": m["content"], "tool_calls": m["tool_calls"], "created_at": m["created_at"]}
            for m in topic["messages"]
        ],
    }


def import_topic(db, bundle: dict) -> dict:
    """Recreate a topic from a bundle, re-linking documents by content_hash."""
    if not isinstance(bundle, dict):
        raise ValueError("invalid bundle")
    name = (bundle.get("topic") or {}).get("name") or "Imported topic"

    warnings: list[str] = []
    doc_ids: list[int] = []
    for d in bundle.get("documents") or []:
        chash = d.get("content_hash")
        row = db.query_one("SELECT id FROM documents WHERE content_hash=?", (chash,)) if chash else None
        if row:
            doc_ids.append(row["id"])
        else:
            warnings.append(f"missing document: {d.get('name')!r} (hash {chash})")

    cur = db.execute("INSERT INTO topics(name) VALUES (?)", (name,))
    topic_id = cur.lastrowid
    _set_documents(db, topic_id, doc_ids)

    for m in bundle.get("messages") or []:
        add_message(db, topic_id, m.get("role", "user"), m.get("content", ""), m.get("tool_calls"))

    return {"topic_id": topic_id, "warnings": warnings, "topic": get_topic(db, topic_id)}
