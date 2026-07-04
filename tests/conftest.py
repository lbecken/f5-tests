"""Shared fixtures: an in-tmp SQLite database and a fake embedder.

No network / Ollama is required. Embeddings are deterministic hash-based vectors.
"""
from __future__ import annotations

import hashlib

import numpy as np
import pytest

from app.config import Config, RetrievalConfig
from app.db import Database

EMB_DIM = 32


def fake_embed(host, model, texts):
    """Deterministic pseudo-embeddings from text hashes (unit-ish vectors)."""
    out = []
    for t in texts:
        h = hashlib.sha256(t.encode("utf-8")).digest()
        # tile the 32 hash bytes to EMB_DIM floats in [-1, 1]
        vals = np.frombuffer((h * ((EMB_DIM // len(h)) + 1))[:EMB_DIM], dtype="uint8").astype("float32")
        vals = (vals / 127.5) - 1.0
        out.append(vals.tolist())
    return out


@pytest.fixture
def db(tmp_path):
    database = Database(tmp_path / "test.db")
    database.migrate()
    yield database
    database.close()


@pytest.fixture
def cfg(tmp_path):
    return Config(
        ollama_host="http://localhost:11434",
        profile="portable",
        profiles={"portable": {"chat_model": "llama3.1:8b", "num_ctx": 8192}},
        embed_model="nomic-embed-text",
        retrieval=RetrievalConfig(top_k=8, chunk_chars=400, chunk_overlap=80),
        data_dir=tmp_path,
        raw={},
    )
