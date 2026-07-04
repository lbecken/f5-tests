# DocStudy

A local, agentic RAG study assistant. A local LLM (via [Ollama](https://ollama.com))
is given tools to **search, read, and compare** passages across large documents
(books, technical docs). You create **topics** (persistent conversations bound to
documents), ask questions, get **cited** answers, and can **export/import** topics
with their full history.

**No model training.** Documents are indexed (chunked + embedded). Adding or
removing a document only touches the SQLite index — never the model.

## Requirements

- Python **3.12+**
- [`uv`](https://docs.astral.sh/uv/)
- **Ollama**, with these models pulled (names configurable in `config.yaml`):

  ```sh
  ollama pull qwen2.5:32b        # "quality" profile chat model
  ollama pull llama3.1:8b        # "portable" profile chat model
  ollama pull nomic-embed-text   # embeddings (both profiles)
  ```

  You only need the chat model for the profile you actually run.

## Setup

```sh
uv sync                # install runtime deps
uv sync --extra dev    # ...plus pytest/httpx for the test suite
```

## Run

```sh
uv run uvicorn app.main:app --port 8577
```

Then open <http://localhost:8577>. The frontend (single-page app) is served from
`app/static/`. The API lives under `/api/*`.

The SQLite database is created on first start at `data/docstudy.db`
(override the directory with `DOCSTUDY_DATA_DIR`).

## Add the sample book

A sample book ships in `documents/` (both `.md` and `.pdf`). Prefer the Markdown
version — it carries real heading structure for better sectioning/citations.

Add it by server-local path:

```sh
curl -X POST http://localhost:8577/api/documents \
  -H 'content-type: application/json' \
  -d '{"path": "documents/uf-eng-1955-1.22.md"}'
```

...or upload a file:

```sh
curl -X POST http://localhost:8577/api/documents -F file=@documents/uf-eng-1955-1.22.md
```

Ingestion runs in the background (parse → chunk → embed). Poll progress:

```sh
curl http://localhost:8577/api/documents        # list, with status + progress
curl http://localhost:8577/api/documents/1       # one document
```

The ~7 MB sample produces roughly 5–8k chunks; embedding all of them takes a
while on first ingest (much faster if Ollama runs on a GPU box — see below).

## Configuration & profiles

`config.yaml`:

```yaml
ollama_host: http://localhost:11434   # point at a remote GPU box to offload
profile: quality                      # which profile to use
profiles:
  quality:   { chat_model: qwen2.5:32b,  num_ctx: 16384 }
  portable:  { chat_model: llama3.1:8b,  num_ctx: 8192 }
embed_model: nomic-embed-text
retrieval: { top_k: 8, chunk_chars: 1600, chunk_overlap: 200 }
```

Environment overrides:

- `OLLAMA_HOST` — overrides `ollama_host`
- `DOCSTUDY_PROFILE` — overrides `profile`
- `DOCSTUDY_CONFIG` — path to an alternate config file
- `DOCSTUDY_DATA_DIR` — directory for the SQLite db (default `data/`)

### Offloading to a remote machine (e.g. a DGX Spark)

Run Ollama on the powerful box and point DocStudy at it — the app itself stays
lightweight (it only does SQLite + numpy locally):

```sh
# on the GPU machine
OLLAMA_HOST=0.0.0.0:11434 ollama serve

# on your laptop
OLLAMA_HOST=http://gpu-box.local:11434 DOCSTUDY_PROFILE=quality \
  uv run uvicorn app.main:app --port 8577
```

`GET /api/config` reports the active profile, models, and whether Ollama is
reachable (it never errors if Ollama is down).

## Tests

```sh
uv run pytest
```

Tests use a throwaway SQLite db and a fake embedder — **no network / Ollama
required**.

## API overview

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/config` | active profile, models, ollama reachable? |
| GET / POST | `/api/documents` | list / add (server path or multipart upload) |
| GET / DELETE | `/api/documents/{id}` | fetch (incl. progress) / delete |
| GET | `/api/documents/{id}/toc` | section tree |
| GET / POST | `/api/topics` | list / create |
| GET / PATCH / DELETE | `/api/topics/{id}` | fetch (incl. messages) / update / delete |
| POST | `/api/topics/{id}/messages` | ask a question — **SSE** stream |
| GET | `/api/topics/{id}/export` | download topic bundle (JSON) |
| POST | `/api/topics/import` | recreate topic; re-links docs by content hash |

The chat endpoint streams Server-Sent Events: `tool_call`, `tool_result`,
`token`, `done`, `error`.
