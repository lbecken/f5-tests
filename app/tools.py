"""Agent tools: JSON schemas for Ollama tool-calling + implementations.

A :class:`Tools` instance binds the database + config and exposes:
  - ``schemas``            list of Ollama tool definitions
  - ``dispatch(name, args)`` run a tool, returning ``(result, summary)``
"""
from __future__ import annotations

import math
from typing import Any

from . import retrieval

READ_PAGE_CHARS = 6000


class Tools:
    def __init__(self, db, cfg, embed_fn=None, scope_doc_ids: list[int] | None = None) -> None:
        self.db = db
        self.cfg = cfg
        self.embed_fn = embed_fn
        # When a tool omits doc_id, searches are restricted to this scope
        # (the active topic's documents). None means "all ready documents".
        self.scope_doc_ids = scope_doc_ids

    def _scope(self, doc_id) -> list[int] | None:
        if doc_id:
            return [int(doc_id)]
        return list(self.scope_doc_ids) if self.scope_doc_ids else None

    # -- schemas -------------------------------------------------------------
    @property
    def schemas(self) -> list[dict[str, Any]]:
        return [
            _fn(
                "list_documents",
                "List indexed documents with their status and section counts.",
                {"type": "object", "properties": {}, "required": []},
            ),
            _fn(
                "get_toc",
                "Get the table of contents (section tree) for a document.",
                {
                    "type": "object",
                    "properties": {
                        "doc_id": {"type": "integer", "description": "Document id."},
                        "max_depth": {"type": "integer", "description": "Max tree depth (default 2).", "default": 2},
                    },
                    "required": ["doc_id"],
                },
            ),
            _fn(
                "search",
                "Hybrid keyword+semantic search over document chunks. Returns passages with citations.",
                {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query."},
                        "doc_id": {"type": "integer", "description": "Restrict to one document (optional)."},
                        "top_k": {"type": "integer", "description": "Max results (default 8).", "default": 8},
                    },
                    "required": ["query"],
                },
            ),
            _fn(
                "read_section",
                "Read the full text of a section by path (e.g. '3.2'), paginated ~6000 chars/page.",
                {
                    "type": "object",
                    "properties": {
                        "doc_id": {"type": "integer"},
                        "section_path": {"type": "string", "description": "Section path such as '3' or '3.2'."},
                        "page": {"type": "integer", "description": "1-based page (default 1).", "default": 1},
                    },
                    "required": ["doc_id", "section_path"],
                },
            ),
            _fn(
                "find_similar",
                "Find passages similar to a given text (e.g. to check if an idea is restated elsewhere).",
                {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "description": "Passage to compare against."},
                        "doc_id": {"type": "integer", "description": "Restrict to one document (optional)."},
                        "top_k": {"type": "integer", "description": "Max results (default 8).", "default": 8},
                    },
                    "required": ["text"],
                },
            ),
        ]

    # -- dispatch ------------------------------------------------------------
    def dispatch(self, name: str, args: dict[str, Any]) -> tuple[Any, str]:
        fn = getattr(self, f"_tool_{name}", None)
        if fn is None:
            return {"error": f"unknown tool: {name}"}, f"unknown tool {name}"
        try:
            return fn(args or {})
        except Exception as exc:  # noqa: BLE001 - report tool errors to the model
            return {"error": f"{type(exc).__name__}: {exc}"}, f"{name} error: {exc}"

    # -- implementations -----------------------------------------------------
    def _tool_list_documents(self, args: dict) -> tuple[Any, str]:
        if self.scope_doc_ids:
            placeholders = ",".join("?" for _ in self.scope_doc_ids)
            rows = self.db.query(
                f"SELECT id, name, status FROM documents WHERE id IN ({placeholders}) ORDER BY id",
                list(self.scope_doc_ids),
            )
        else:
            rows = self.db.query("SELECT id, name, status FROM documents ORDER BY id")
        out = []
        for r in rows:
            n = self.db.query_one(
                "SELECT COUNT(*) AS c FROM sections WHERE doc_id=? AND parent_id IS NULL",
                (r["id"],),
            )
            out.append(
                {
                    "id": r["id"],
                    "name": r["name"],
                    "status": r["status"],
                    "top_level_sections": n["c"] if n else 0,
                }
            )
        return {"documents": out}, f"{len(out)} document(s)"

    def _tool_get_toc(self, args: dict) -> tuple[Any, str]:
        doc_id = int(args["doc_id"])
        max_depth = int(args.get("max_depth", 2) or 2)
        rows = self.db.query(
            "SELECT path, title, level FROM sections WHERE doc_id=? ORDER BY id",
            (doc_id,),
        )
        toc = [
            {"path": r["path"], "title": r["title"], "level": r["level"]}
            for r in rows
            if r["path"] and r["path"].count(".") + 1 <= max_depth
        ]
        return {"doc_id": doc_id, "toc": toc}, f"TOC: {len(toc)} entries"

    def _tool_search(self, args: dict) -> tuple[Any, str]:
        query = str(args["query"])
        doc_id = args.get("doc_id")
        top_k = int(args.get("top_k", self.cfg.retrieval.top_k) or self.cfg.retrieval.top_k)
        doc_ids = self._scope(doc_id)
        hits = retrieval.hybrid(
            self.db, query, doc_ids, top_k,
            host=self.cfg.ollama_host, embed_model=self.cfg.embed_model, embed_fn=self.embed_fn,
        )
        results = [
            {
                "citation": h["citation"],
                "doc_id": h["doc_id"],
                "doc_name": h["doc_name"],
                "section_path": h["section_path"],
                "section_title": h["section_title"],
                "text": h["text"],
            }
            for h in hits
        ]
        return {"query": query, "results": results}, f"search '{_truncate(query, 40)}' → {len(results)} hit(s)"

    def _tool_find_similar(self, args: dict) -> tuple[Any, str]:
        text = str(args["text"])
        doc_id = args.get("doc_id")
        top_k = int(args.get("top_k", self.cfg.retrieval.top_k) or self.cfg.retrieval.top_k)
        doc_ids = self._scope(doc_id)
        hits = retrieval.similar(
            self.db, text, doc_ids, top_k,
            host=self.cfg.ollama_host, embed_model=self.cfg.embed_model, embed_fn=self.embed_fn,
        )
        results = [
            {
                "citation": h["citation"],
                "doc_id": h["doc_id"],
                "doc_name": h["doc_name"],
                "section_path": h["section_path"],
                "section_title": h["section_title"],
                "text": h["text"],
            }
            for h in hits
        ]
        return {"results": results}, f"find_similar → {len(results)} hit(s)"

    def _tool_read_section(self, args: dict) -> tuple[Any, str]:
        doc_id = int(args["doc_id"])
        section_path = str(args["section_path"])
        page = int(args.get("page", 1) or 1)

        sec = self.db.query_one(
            "SELECT s.id, s.title, s.path, d.name AS doc_name FROM sections s "
            "JOIN documents d ON d.id = s.doc_id WHERE s.doc_id=? AND s.path=?",
            (doc_id, section_path),
        )
        if sec is None:
            return {"error": f"no section {section_path} in doc {doc_id}"}, f"read §{section_path}: not found"

        # Include descendant sections: a chapter's text mostly lives in its
        # subsections, and their chunks carry the subsection's section_id.
        rows = self.db.query(
            "SELECT s.path AS spath, s.title AS stitle, c.text AS text "
            "FROM chunks c JOIN sections s ON s.id = c.section_id "
            "WHERE s.doc_id=? AND (s.path=? OR s.path LIKE ?) "
            "ORDER BY s.id, c.seq",
            (doc_id, section_path, section_path + ".%"),
        )
        parts: list[str] = []
        current_path = None
        for r in rows:
            if r["spath"] != current_path:
                current_path = r["spath"]
                if current_path != section_path:
                    parts.append(f"## §{r['spath']} {r['stitle'] or ''}".rstrip())
            parts.append(r["text"])
        full = "\n\n".join(parts)
        total_pages = max(1, math.ceil(len(full) / READ_PAGE_CHARS)) if full else 1
        page = max(1, min(page, total_pages))
        start = (page - 1) * READ_PAGE_CHARS
        text = full[start : start + READ_PAGE_CHARS]

        result = {
            "doc_id": doc_id,
            "doc_name": sec["doc_name"],
            "section_path": sec["path"],
            "section_title": sec["title"],
            "page": page,
            "total_pages": total_pages,
            "text": text,
        }
        return result, f"read §{section_path} {sec['title'] or ''} (page {page}/{total_pages})"


def _fn(name: str, description: str, parameters: dict) -> dict:
    return {"type": "function", "function": {"name": name, "description": description, "parameters": parameters}}


def _truncate(s: str, n: int) -> str:
    return s if len(s) <= n else s[: n - 1] + "…"
