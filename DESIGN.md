# DocStudy — local document study assistant

An agentic RAG app: a local LLM (via Ollama) with tools to search, read, and
compare passages across large documents (books, technical docs). Users create
**topics** (persistent conversations bound to documents), ask questions, get
cited answers, and can export/import topics with their full history.

**No model training.** Documents are indexed (chunked + embedded); adding or
removing a document only touches the index, never the model.

## Stack

- Python 3.12, `uv` for env/deps, FastAPI + uvicorn.
- SQLite (single file `data/docstudy.db`): FTS5 for keyword search, embeddings
  stored as float32 BLOBs, brute-force cosine search over an in-memory numpy
  matrix (lazy-loaded per document, cached). **No sqlite-vec** — numpy
  brute-force is fast enough (<100k chunks) and has zero extension risk.
- Ollama for chat + embeddings (`ollama` Python package).
- Frontend: static single-page app (vanilla JS, no build step), served by
  FastAPI from `app/static/`. Vendored libs in `app/static/vendor/`:
  `marked.min.js` (markdown), `mermaid.min.js` (diagrams). No CDN at runtime.

## Layout

```
pyproject.toml
config.yaml              # user-editable settings
app/
  main.py                # FastAPI app, routes, SSE
  config.py              # loads config.yaml (+ env overrides OLLAMA_HOST etc.)
  db.py                  # schema, connection, migrations-on-startup
  ingest.py              # md/pdf -> sections -> chunks -> embeddings
  retrieval.py           # hybrid search (vector + FTS5, RRF merge), similar()
  agent.py               # agent loop: chat w/ tool-calling against Ollama
  tools.py               # tool implementations + JSON schemas
  topics.py              # topic CRUD, export/import
  static/                # frontend (index.html, app.js, style.css, vendor/)
tests/                   # pytest; small fixture docs, no Ollama required
data/                    # runtime: sqlite db (gitignored)
```

## Config (`config.yaml`)

```yaml
ollama_host: http://localhost:11434   # point at DGX Spark to offload
profile: quality                      # which profile to use
profiles:
  quality:   { chat_model: qwen2.5:32b,  num_ctx: 16384 }
  portable:  { chat_model: llama3.1:8b,  num_ctx: 8192 }
embed_model: nomic-embed-text
retrieval: { top_k: 8, chunk_chars: 1600, chunk_overlap: 200 }
```

`OLLAMA_HOST` / `DOCSTUDY_PROFILE` env vars override.

## Database schema

```sql
documents(id PK, name, source_path, format, content_hash UNIQUE, status, error,
          added_at)               -- status: pending|indexing|ready|failed
sections(id PK, doc_id FK, parent_id FK NULL, level INT, title, path TEXT,
         ord INT)                 -- path e.g. "3" or "3.2"; tree for TOC
chunks(id PK, doc_id FK, section_id FK, seq INT, text, embedding BLOB)
chunks_fts(text)                  -- FTS5 contentless-delete or external content
topics(id PK, name, created_at, updated_at)
topic_documents(topic_id FK, doc_id FK)
messages(id PK, topic_id FK, role, content, tool_calls TEXT NULL /*JSON*/,
         created_at)
```

## Ingestion (`ingest.py`)

- **Markdown**: split on headings. IMPORTANT: real-world files mix `#` markdown
  headings and inline HTML `<h1>`–`<h6>` tags (the sample book in `documents/`
  uses `<h1 align="center">…</h1>` etc.) — handle both. Strip HTML tags from
  chunk text (keep the text content). Build the section tree from heading
  levels.
- **PDF**: PyMuPDF (`pymupdf`). Use the PDF outline/bookmarks for sections when
  present; fall back to page-range pseudo-sections ("Pages 1–20") otherwise.
- If the same content exists as both md and pdf, they're just two documents;
  dedup by content_hash only for identical files. (Users should prefer md.)
- Chunking: within a section, split to ~`chunk_chars` with `chunk_overlap`,
  never splitting mid-paragraph when avoidable. Each chunk stores its
  section_id so citations resolve to "Doc, §3.2 Title".
- Embeddings: batch calls to Ollama `embed` (e.g. 64 texts/call). Ingestion
  runs as a FastAPI background task; progress (chunks embedded / total) stored
  in memory, exposed via status endpoint. A 7 MB book will produce roughly
  5–8k chunks; must survive that scale.
- Re-adding a changed file with same path: new content_hash → replace old doc.

## Retrieval (`retrieval.py`)

- `vector_search(query_emb, doc_ids, k)`: numpy cosine over cached matrix.
- `keyword_search(query, doc_ids, k)`: FTS5 `bm25`.
- `hybrid(query, doc_ids, k)`: embed query, run both, merge with Reciprocal
  Rank Fusion, return chunks + (doc name, section path/title) for citations.
- `similar(text, doc_ids, k, exclude_chunk_id)`: embed passage, vector search.

## Agent (`agent.py`, `tools.py`)

Loop: send messages + tool schemas to Ollama chat; while the model returns
tool_calls, execute them, append results, re-send; cap at 12 tool rounds; then
stream the final answer. Emit SSE events throughout (see API).

Tools (JSON-schema for Ollama tool calling):
- `list_documents()` → id, name, status, top-level sections count
- `get_toc(doc_id, max_depth=2)` → section tree (path, title)
- `search(query, doc_id=None, top_k=8)` → chunks w/ text + citation info
- `read_section(doc_id, section_path, page=1)` → section text, paginated to
  ~6000 chars/page with `total_pages` so the model can continue
- `find_similar(text, doc_id=None, top_k=8)` → passages similar to given text
  (for "is this idea restated elsewhere?")

System prompt: study assistant; always cite sources as `[DocName §path Title]`;
use tools rather than answering from prior knowledge about the document; for
"explain at depth levels", structure beginner/intermediate/advanced; may output
Mermaid diagrams in ```mermaid fences; may propose exercises/questions.
Conversation history: last N messages (fit num_ctx); tool_calls of *past*
turns are not replayed to the model, only role/content.

## API

- `GET  /api/config` → active profile, models, ollama reachable?
- `GET  /api/documents` | `POST /api/documents {path}` (server-local path;
  also accept multipart upload) → starts ingestion
- `GET  /api/documents/{id}` → incl. indexing progress; `DELETE` too
- `GET  /api/documents/{id}/toc`
- `GET/POST /api/topics`, `GET/PATCH/DELETE /api/topics/{id}`
  (topic: name + document ids; GET includes messages)
- `POST /api/topics/{id}/messages {content}` → **SSE stream**, events:
  `tool_call {name, args}`, `tool_result {name, summary}`, `token {text}`,
  `done {message_id}`, `error {detail}`. Persist user msg + final assistant
  msg (with tool-call trace JSON) on completion.
- `GET  /api/topics/{id}/export` → JSON bundle download:
  `{version, topic:{name}, documents:[{name, content_hash}], messages:[...]}`
- `POST /api/topics/import` (JSON body) → recreates topic; re-links documents
  by content_hash, warns about missing ones.

## Frontend (`app/static/`)

Single page, three areas:
- **Left sidebar**: topic list (+ new / rename / delete), export/import
  buttons, documents manager (list w/ indexing progress bar, add by path or
  upload, delete).
- **Main pane**: chat for active topic. Markdown-rendered assistant messages
  (marked.js), mermaid blocks rendered as diagrams, citations styled as badges.
  While the agent works, show collapsible activity lines ("🔍 search: …",
  "📖 read §3.2 …") from SSE tool events, then the streamed answer.
- **Composer**: textarea, Enter to send, Shift+Enter newline; disabled while
  streaming; stop button aborts the SSE request.

Clean, readable, light/dark via `prefers-color-scheme`. No framework.

## Testing / run

- `uv run uvicorn app.main:app` (README documents setup: uv sync, ollama
  models needed, adding the sample book from `documents/`).
- pytest unit tests for: md heading parsing (incl. HTML `<hN>`), chunking
  boundaries, RRF merge, export/import round-trip, topic CRUD (in-tmp sqlite).
  Mock Ollama (no network in tests).
