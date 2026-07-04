"""Configuration loading for DocStudy.

Loads ``config.yaml`` and applies environment overrides:
  - ``OLLAMA_HOST``      overrides ``ollama_host``
  - ``DOCSTUDY_PROFILE`` overrides ``profile``
  - ``DOCSTUDY_CONFIG``  path to an alternate config file
  - ``DOCSTUDY_DATA_DIR``directory for the sqlite db (default ``data/``)
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = REPO_ROOT / "config.yaml"

DEFAULTS: dict[str, Any] = {
    "ollama_host": "http://localhost:11434",
    "profile": "quality",
    "profiles": {
        "quality": {"chat_model": "qwen2.5:32b", "num_ctx": 16384},
        "portable": {"chat_model": "llama3.1:8b", "num_ctx": 8192},
    },
    "embed_model": "nomic-embed-text",
    "retrieval": {"top_k": 8, "chunk_chars": 1600, "chunk_overlap": 200},
}


@dataclass
class RetrievalConfig:
    top_k: int = 8
    chunk_chars: int = 1600
    chunk_overlap: int = 200


@dataclass
class Config:
    ollama_host: str
    profile: str
    profiles: dict[str, dict[str, Any]]
    embed_model: str
    retrieval: RetrievalConfig
    data_dir: Path
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def active_profile(self) -> dict[str, Any]:
        if self.profile in self.profiles:
            return self.profiles[self.profile]
        # Fall back to the first defined profile rather than crashing.
        return next(iter(self.profiles.values()))

    @property
    def chat_model(self) -> str:
        return self.active_profile.get("chat_model", "llama3.1:8b")

    @property
    def num_ctx(self) -> int:
        return int(self.active_profile.get("num_ctx", 8192))

    @property
    def db_path(self) -> Path:
        return self.data_dir / "docstudy.db"


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, val in (override or {}).items():
        if isinstance(val, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], val)
        else:
            out[key] = val
    return out


def load_config(path: str | os.PathLike[str] | None = None) -> Config:
    """Load configuration, merging file over defaults, then env overrides."""
    cfg_path = Path(
        path
        or os.environ.get("DOCSTUDY_CONFIG")
        or DEFAULT_CONFIG_PATH
    )

    file_data: dict[str, Any] = {}
    if cfg_path.exists():
        loaded = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))
        if isinstance(loaded, dict):
            file_data = loaded

    data = _deep_merge(DEFAULTS, file_data)

    # Environment overrides.
    if os.environ.get("OLLAMA_HOST"):
        data["ollama_host"] = os.environ["OLLAMA_HOST"]
    if os.environ.get("DOCSTUDY_PROFILE"):
        data["profile"] = os.environ["DOCSTUDY_PROFILE"]

    data_dir = Path(
        os.environ.get("DOCSTUDY_DATA_DIR") or (REPO_ROOT / "data")
    )

    retrieval = _deep_merge(DEFAULTS["retrieval"], data.get("retrieval") or {})

    return Config(
        ollama_host=data["ollama_host"],
        profile=data["profile"],
        profiles=data["profiles"],
        embed_model=data["embed_model"],
        retrieval=RetrievalConfig(
            top_k=int(retrieval["top_k"]),
            chunk_chars=int(retrieval["chunk_chars"]),
            chunk_overlap=int(retrieval["chunk_overlap"]),
        ),
        data_dir=data_dir,
        raw=data,
    )


@lru_cache(maxsize=1)
def get_config() -> Config:
    """Cached singleton config for the running app."""
    return load_config()
