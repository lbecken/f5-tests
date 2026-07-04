"""FastAPI application: REST routes, SSE chat streaming, static frontend."""
from __future__ import annotations

import asyncio
import json
import threading
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import ingest, retrieval, topics
from .agent import run as agent_run
from .config import REPO_ROOT, get_config
from .db import Database
from .tools import Tools

STATIC_DIR = REPO_ROOT / "app" / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = get_config()
    db = Database(cfg.db_path)
    db.migrate()
    app.state.cfg = cfg
    app.state.db = db
    try:
        yield
    finally:
        db.close()


app = FastAPI(title="DocStudy", lifespan=lifespan)


def get_db(request: Request) -> Database:
    return request.app.state.db


def get_cfg(request: Request):
    return request.app.state.cfg


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
def _ollama_reachable(host: str, timeout: float = 1.5) -> bool:
    try:
        req = urllib.request.Request(host.rstrip("/") + "/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return 200 <= resp.status < 500
    except Exception:
        return False


@app.get("/api/config")
def api_config(request: Request):
    cfg = get_cfg(request)
    return {
        "profile": cfg.profile,
        "profiles": {name: p for name, p in cfg.profiles.items()},
        "chat_model": cfg.chat_model,
        "embed_model": cfg.embed_model,
        "num_ctx": cfg.num_ctx,
        "ollama_host": cfg.ollama_host,
        "retrieval": {
            "top_k": cfg.retrieval.top_k,
            "chunk_chars": cfg.retrieval.chunk_chars,
            "chunk_overlap": cfg.retrieval.chunk_overlap,
        },
        "ollama_reachable": _ollama_reachable(cfg.ollama_host),
    }


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------
def _doc_dict(db: Database, row) -> dict:
    d = {
        "id": row["id"],
        "name": row["name"],
        "source_path": row["source_path"],
        "format": row["format"],
        "content_hash": row["content_hash"],
        "status": row["status"],
        "error": row["error"],
        "added_at": row["added_at"],
    }
    prog = ingest.get_progress(row["id"])
    if prog is not None:
        d["progress"] = prog
    return d


def _register_document(db: Database, cfg, path: str) -> dict:
    p = Path(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=400, detail=f"file not found: {path}")

    fmt = ingest.detect_format(p)
    content_hash = ingest.compute_hash(p)

    # Dedup: identical file already present.
    same = db.query_one("SELECT * FROM documents WHERE content_hash=?", (content_hash,))
    if same is not None:
        return _doc_dict(db, same)

    # Replace an older version at the same source path (changed content).
    old = db.query_one("SELECT id FROM documents WHERE source_path=?", (str(p),))
    if old is not None:
        db.execute("DELETE FROM documents WHERE id=?", (old["id"],))
        retrieval.invalidate_doc(old["id"])

    cur = db.execute(
        "INSERT INTO documents(name, source_path, format, content_hash, status) VALUES (?,?,?,?, 'pending')",
        (p.name, str(p), fmt, content_hash),
    )
    doc_id = cur.lastrowid
    ingest.start_ingestion(db, doc_id, str(p), fmt, p.name, cfg, invalidate=retrieval.invalidate_doc)
    row = db.query_one("SELECT * FROM documents WHERE id=?", (doc_id,))
    return _doc_dict(db, row)


@app.get("/api/documents")
def list_documents(request: Request):
    db = get_db(request)
    rows = db.query("SELECT * FROM documents ORDER BY id")
    return {"documents": [_doc_dict(db, r) for r in rows]}


@app.post("/api/documents")
async def add_document(request: Request):
    db = get_db(request)
    cfg = get_cfg(request)
    ctype = request.headers.get("content-type", "")

    if "multipart/form-data" in ctype:
        form = await request.form()
        upload = form.get("file")
        if upload is None or not hasattr(upload, "filename"):
            raise HTTPException(status_code=400, detail="no file uploaded")
        uploads = cfg.data_dir / "uploads"
        uploads.mkdir(parents=True, exist_ok=True)
        dest = uploads / Path(upload.filename).name
        data = await upload.read()
        dest.write_bytes(data)
        doc = _register_document(db, cfg, str(dest))
    else:
        body = await request.json()
        path = (body or {}).get("path")
        if not path:
            raise HTTPException(status_code=400, detail="missing 'path'")
        doc = _register_document(db, cfg, path)

    return JSONResponse(doc, status_code=201)


@app.get("/api/documents/{doc_id}")
def get_document(doc_id: int, request: Request):
    db = get_db(request)
    row = db.query_one("SELECT * FROM documents WHERE id=?", (doc_id,))
    if row is None:
        raise HTTPException(status_code=404, detail="document not found")
    return _doc_dict(db, row)


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: int, request: Request):
    db = get_db(request)
    row = db.query_one("SELECT id FROM documents WHERE id=?", (doc_id,))
    if row is None:
        raise HTTPException(status_code=404, detail="document not found")
    db.execute("DELETE FROM documents WHERE id=?", (doc_id,))
    retrieval.invalidate_doc(doc_id)
    ingest.clear_progress(doc_id)
    return {"ok": True}


@app.get("/api/documents/{doc_id}/toc")
def get_toc(doc_id: int, request: Request, max_depth: int = 6):
    db = get_db(request)
    row = db.query_one("SELECT id FROM documents WHERE id=?", (doc_id,))
    if row is None:
        raise HTTPException(status_code=404, detail="document not found")
    rows = db.query("SELECT id, parent_id, level, title, path FROM sections WHERE doc_id=? ORDER BY id", (doc_id,))
    toc = [
        {"id": r["id"], "parent_id": r["parent_id"], "level": r["level"], "title": r["title"], "path": r["path"]}
        for r in rows
        if r["path"] and r["path"].count(".") + 1 <= max_depth
    ]
    return {"doc_id": doc_id, "toc": toc}


# ---------------------------------------------------------------------------
# Topics
# ---------------------------------------------------------------------------
@app.get("/api/topics")
def api_list_topics(request: Request):
    return {"topics": topics.list_topics(get_db(request))}


@app.post("/api/topics")
async def api_create_topic(request: Request):
    db = get_db(request)
    body = await request.json()
    name = (body or {}).get("name") or "New topic"
    doc_ids = (body or {}).get("document_ids") or (body or {}).get("doc_ids") or []
    return JSONResponse(topics.create_topic(db, name, [int(x) for x in doc_ids]), status_code=201)


@app.get("/api/topics/{topic_id}")
def api_get_topic(topic_id: int, request: Request):
    t = topics.get_topic(get_db(request), topic_id)
    if t is None:
        raise HTTPException(status_code=404, detail="topic not found")
    return t


@app.patch("/api/topics/{topic_id}")
async def api_update_topic(topic_id: int, request: Request):
    db = get_db(request)
    body = await request.json() or {}
    name = body.get("name")
    doc_ids = body.get("document_ids")
    if doc_ids is None:
        doc_ids = body.get("doc_ids")
    if doc_ids is not None:
        doc_ids = [int(x) for x in doc_ids]
    t = topics.update_topic(db, topic_id, name=name, doc_ids=doc_ids)
    if t is None:
        raise HTTPException(status_code=404, detail="topic not found")
    return t


@app.delete("/api/topics/{topic_id}")
def api_delete_topic(topic_id: int, request: Request):
    if not topics.delete_topic(get_db(request), topic_id):
        raise HTTPException(status_code=404, detail="topic not found")
    return {"ok": True}


@app.get("/api/topics/{topic_id}/export")
def api_export_topic(topic_id: int, request: Request):
    bundle = topics.export_topic(get_db(request), topic_id)
    if bundle is None:
        raise HTTPException(status_code=404, detail="topic not found")
    headers = {"Content-Disposition": f'attachment; filename="topic-{topic_id}.json"'}
    return JSONResponse(bundle, headers=headers)


@app.post("/api/topics/import")
async def api_import_topic(request: Request):
    db = get_db(request)
    bundle = await request.json()
    try:
        result = topics.import_topic(db, bundle)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return JSONResponse(result, status_code=201)


# ---------------------------------------------------------------------------
# SSE chat
# ---------------------------------------------------------------------------
def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.post("/api/topics/{topic_id}/messages")
async def api_post_message(topic_id: int, request: Request):
    db = get_db(request)
    cfg = get_cfg(request)

    topic = topics.get_topic(db, topic_id, with_messages=False)
    if topic is None:
        raise HTTPException(status_code=404, detail="topic not found")

    body = await request.json()
    content = (body or {}).get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="empty message")

    topics.add_message(db, topic_id, "user", content)

    doc_ids = [d["id"] for d in topic["documents"]] or None
    history = topics.history_for_agent(db, topic_id)
    tools = Tools(db, cfg, scope_doc_ids=doc_ids)

    async def event_stream():
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue()
        stop = threading.Event()
        tool_trace: list[dict] = []

        def worker():
            try:
                for ev in agent_run(cfg, tools, history, should_stop=stop.is_set):
                    loop.call_soon_threadsafe(queue.put_nowait, ev)
            except Exception as exc:  # noqa: BLE001
                loop.call_soon_threadsafe(
                    queue.put_nowait, {"event": "error", "data": {"detail": str(exc)}}
                )
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        threading.Thread(target=worker, daemon=True).start()

        try:
            while True:
                ev = await queue.get()
                if ev is None:
                    break
                name = ev["event"]
                data = ev["data"]
                if name == "tool_call":
                    tool_trace.append(data)
                    yield _sse("tool_call", data)
                elif name == "tool_result":
                    yield _sse("tool_result", data)
                elif name == "token":
                    yield _sse("token", data)
                elif name == "final":
                    mid = topics.add_message(
                        db, topic_id, "assistant", data["content"],
                        tool_calls=tool_trace or None,
                    )
                    yield _sse("done", {"message_id": mid})
                elif name == "error":
                    yield _sse("error", data)
        finally:
            stop.set()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Static frontend (mounted last so /api/* wins). Tolerates a missing/empty dir.
# ---------------------------------------------------------------------------
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True, check_dir=False), name="static")
