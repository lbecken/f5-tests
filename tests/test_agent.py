"""Agent loop with a fake chat function (no Ollama)."""
from __future__ import annotations

from app import agent
from app.agent import parse_tool_call, trim_history
from app.tools import Tools


def _stream(tokens):
    return iter([{"message": {"content": t}} for t in tokens])


def test_parse_tool_call_handles_dict_and_json_string():
    assert parse_tool_call({"function": {"name": "search", "arguments": {"query": "x"}}}) == ("search", {"query": "x"})
    assert parse_tool_call({"function": {"name": "search", "arguments": '{"query": "x"}'}}) == ("search", {"query": "x"})
    assert parse_tool_call({"function": {"name": "s", "arguments": "not json"}}) == ("s", {})


def test_trim_history_keeps_recent():
    hist = [{"role": "user", "content": "x" * 100} for _ in range(50)]
    trimmed = trim_history(hist, num_ctx=200)  # budget ~ max(2000, 600)
    assert len(trimmed) < len(hist)
    assert trimmed[-1] == hist[-1]


def test_agent_runs_tool_then_streams(db, cfg):
    calls = {"n": 0}

    def chat_fn(model, messages, tools=None, stream=False, options=None):
        if stream:
            return _stream(["Hello ", "world"])
        calls["n"] += 1
        if calls["n"] == 1:
            return {"message": {"content": "", "tool_calls": [
                {"function": {"name": "list_documents", "arguments": {}}}
            ]}}
        return {"message": {"content": "final"}}

    tools = Tools(db, cfg)
    events = list(agent.run(cfg, tools, [{"role": "user", "content": "hi"}], chat_fn=chat_fn))
    names = [e["event"] for e in events]
    assert "tool_call" in names
    assert "tool_result" in names
    assert "token" in names
    # The answer produced right after the tool round is reused, not regenerated
    # by a second streamed call.
    final = [e for e in events if e["event"] == "final"][0]
    assert final["data"]["content"] == "final"
    assert calls["n"] == 2


def test_agent_caps_tool_rounds(db, cfg):
    def chat_fn(model, messages, tools=None, stream=False, options=None):
        if stream:
            return _stream(["done"])
        # Always ask for a tool -> would loop forever without the cap.
        return {"message": {"content": "", "tool_calls": [
            {"function": {"name": "list_documents", "arguments": {}}}
        ]}}

    tools = Tools(db, cfg)
    events = list(agent.run(cfg, tools, [{"role": "user", "content": "hi"}], chat_fn=chat_fn))
    tool_calls = [e for e in events if e["event"] == "tool_call"]
    assert len(tool_calls) == agent.MAX_TOOL_ROUNDS
    assert any(e["event"] == "final" for e in events)


def test_agent_stops_on_should_stop(db, cfg):
    def chat_fn(model, messages, tools=None, stream=False, options=None):
        if stream:
            return _stream(["a", "b", "c"])
        return {"message": {"content": "answer"}}

    tools = Tools(db, cfg)
    gen = agent.run(cfg, tools, [{"role": "user", "content": "hi"}], chat_fn=chat_fn, should_stop=lambda: True)
    assert list(gen) == []


def test_agent_retries_on_invented_citations(db, cfg):
    """A first answer citing a nonexistent section triggers one corrective round."""
    calls = {"n": 0}

    def chat_fn(model, messages, tools=None, stream=False, options=None):
        calls["n"] += 1
        if calls["n"] == 1:
            return {"message": {"content": "Fake answer [book.md §99.99 Invented Title]."}}
        # After the corrective user message, answer without citations.
        assert any("do NOT exist" in (m.get("content") or "") for m in messages if m.get("role") == "user")
        return {"message": {"content": "I could not find this in the documents."}}

    tools = Tools(db, cfg)
    events = list(agent.run(cfg, tools, [{"role": "user", "content": "q"}], chat_fn=chat_fn))
    names = [e["event"] for e in events]
    assert names.count("tool_call") == 1  # the check_citations event
    assert [e for e in events if e["event"] == "tool_call"][0]["data"]["name"] == "check_citations"
    final = [e for e in events if e["event"] == "final"][0]
    assert final["data"]["content"] == "I could not find this in the documents."
    assert calls["n"] == 2


def test_agent_accepts_valid_citations_without_retry(db, cfg):
    with db.transaction() as conn:
        conn.execute("INSERT INTO documents(name, source_path, format, content_hash, status) VALUES ('b.md','/x','md','h1','ready')")
        conn.execute("INSERT INTO sections(doc_id, parent_id, level, title, path, ord) VALUES (1, NULL, 1, 'T', '92.4', 4)")

    def chat_fn(model, messages, tools=None, stream=False, options=None):
        return {"message": {"content": "Grounded [b.md §92.4 T]."}}

    tools = Tools(db, cfg)
    events = list(agent.run(cfg, tools, [{"role": "user", "content": "q"}], chat_fn=chat_fn))
    assert [e["event"] for e in events if e["event"] == "tool_call"] == []
    assert [e for e in events if e["event"] == "final"][0]["data"]["content"] == "Grounded [b.md §92.4 T]."
