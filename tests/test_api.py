"""API smoke tests via TestClient (no Ollama needed)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import config as config_mod


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DOCSTUDY_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OLLAMA_HOST", "http://127.0.0.1:59999")  # nothing listening
    config_mod.get_config.cache_clear()
    from app.main import app

    with TestClient(app) as c:
        yield c
    config_mod.get_config.cache_clear()


def test_config_does_not_500_when_ollama_unreachable(client):
    r = client.get("/api/config")
    assert r.status_code == 200
    body = r.json()
    assert body["ollama_reachable"] is False
    assert "chat_model" in body
    assert "embed_model" in body


def test_documents_empty(client):
    r = client.get("/api/documents")
    assert r.status_code == 200
    assert r.json() == {"documents": []}


def test_topic_lifecycle(client):
    r = client.post("/api/topics", json={"name": "T", "document_ids": []})
    assert r.status_code == 201
    tid = r.json()["id"]

    r = client.get(f"/api/topics/{tid}")
    assert r.status_code == 200
    assert r.json()["messages"] == []

    r = client.patch(f"/api/topics/{tid}", json={"name": "T2"})
    assert r.json()["name"] == "T2"

    r = client.get("/api/topics")
    assert any(t["id"] == tid for t in r.json()["topics"])

    r = client.get(f"/api/topics/{tid}/export")
    assert r.status_code == 200
    assert r.json()["version"] == "1"

    r = client.delete(f"/api/topics/{tid}")
    assert r.status_code == 200
    assert client.get(f"/api/topics/{tid}").status_code == 404


def test_add_document_missing_path(client):
    r = client.post("/api/documents", json={"path": "/does/not/exist.md"})
    assert r.status_code == 400
