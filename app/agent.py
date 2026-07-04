"""Agent loop: chat with tool-calling against Ollama, streaming the answer.

``run`` is a generator of event dicts (``{"event": name, "data": {...}}``) that
``main`` renders as SSE. It resolves tool calls with non-streaming calls (up to
12 rounds), then streams the final answer token by token.
"""
from __future__ import annotations

import json
from typing import Any, Callable, Iterator

MAX_TOOL_ROUNDS = 12

SYSTEM_PROMPT = """You are DocStudy, a study assistant for a specific set of documents.

Rules:
- Use the provided tools (search, read_section, get_toc, find_similar, list_documents) to ground every claim in the documents. Do NOT answer from prior knowledge about the document's contents.
- ALWAYS cite sources inline as [DocName §path Title] using the citation strings returned by the tools.
- When asked to "explain at depth levels", structure the answer as Beginner / Intermediate / Advanced.
- You may include diagrams using ```mermaid fenced code blocks.
- You may propose exercises or study questions when helpful.
- Be precise and concise; quote sparingly and cite what you quote."""


# ChatFn(model, messages, tools, stream, options) -> response | iterator
ChatFn = Callable[..., Any]


def _default_chat_fn(host: str) -> ChatFn:
    import ollama

    client = ollama.Client(host=host)

    def _chat(model, messages, tools=None, stream=False, options=None):
        return client.chat(
            model=model,
            messages=messages,
            tools=tools or None,
            stream=stream,
            options=options or {},
        )

    return _chat


# ---------------------------------------------------------------------------
# Response normalization (ollama returns objects or dicts)
# ---------------------------------------------------------------------------
def _get(obj: Any, key: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _message(resp: Any) -> Any:
    return _get(resp, "message", resp)


def _content(msg: Any) -> str:
    return _get(msg, "content", "") or ""


def parse_tool_call(tc: Any) -> tuple[str, dict[str, Any]]:
    """Extract (name, args_dict) from a tool call; args may be dict or JSON str."""
    fn = _get(tc, "function", tc)
    name = _get(fn, "name", "")
    args = _get(fn, "arguments", {})
    if isinstance(args, str):
        try:
            args = json.loads(args) if args.strip() else {}
        except json.JSONDecodeError:
            args = {}
    if not isinstance(args, dict):
        args = {}
    return name, args


def _assistant_msg_for_convo(msg: Any) -> dict[str, Any]:
    """Serialize a returned assistant message (with tool_calls) for replay."""
    tcs = _get(msg, "tool_calls", None)
    serial_tcs = []
    for tc in tcs or []:
        name, args = parse_tool_call(tc)
        serial_tcs.append({"function": {"name": name, "arguments": args}})
    out: dict[str, Any] = {"role": "assistant", "content": _content(msg)}
    if serial_tcs:
        out["tool_calls"] = serial_tcs
    return out


# ---------------------------------------------------------------------------
# History trimming
# ---------------------------------------------------------------------------
def trim_history(history: list[dict[str, str]], num_ctx: int) -> list[dict[str, str]]:
    """Keep the most recent messages that fit a rough char budget for num_ctx.

    Only role/content is kept; past tool-call traces are not replayed.
    """
    budget = max(2000, num_ctx * 3)  # ~3 chars/token, leave room for tools+answer
    kept: list[dict[str, str]] = []
    used = 0
    for msg in reversed(history):
        content = msg.get("content", "") or ""
        cost = len(content) + 16
        if kept and used + cost > budget:
            break
        kept.append({"role": msg["role"], "content": content})
        used += cost
    kept.reverse()
    return kept


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
def run(
    cfg,
    tools,
    history: list[dict[str, str]],
    *,
    chat_fn: ChatFn | None = None,
    should_stop: Callable[[], bool] | None = None,
) -> Iterator[dict[str, Any]]:
    chat_fn = chat_fn or _default_chat_fn(cfg.ollama_host)
    should_stop = should_stop or (lambda: False)
    options = {"num_ctx": cfg.num_ctx}
    model = cfg.chat_model

    convo: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    convo.extend(trim_history(history, cfg.num_ctx))

    # --- tool-resolution rounds -------------------------------------------
    for _round in range(MAX_TOOL_ROUNDS):
        if should_stop():
            return
        resp = chat_fn(model, convo, tools=tools.schemas, stream=False, options=options)
        msg = _message(resp)
        tcs = _get(msg, "tool_calls", None)
        if not tcs:
            # The model already answered; don't pay for a second generation.
            content = _content(msg)
            if content.strip():
                yield {"event": "token", "data": {"text": content}}
                yield {"event": "final", "data": {"content": content}}
                return
            break
        convo.append(_assistant_msg_for_convo(msg))
        for tc in tcs:
            if should_stop():
                return
            name, args = parse_tool_call(tc)
            yield {"event": "tool_call", "data": {"name": name, "args": args}}
            result, summary = tools.dispatch(name, args)
            yield {"event": "tool_result", "data": {"name": name, "summary": summary}}
            convo.append({"role": "tool", "name": name, "content": json.dumps(result, ensure_ascii=False)})

    # --- final streamed answer (no tools) ---------------------------------
    if should_stop():
        return
    full_parts: list[str] = []
    try:
        stream = chat_fn(model, convo, tools=None, stream=True, options=options)
        for chunk in stream:
            if should_stop():
                break
            token = _content(_message(chunk))
            if token:
                full_parts.append(token)
                yield {"event": "token", "data": {"text": token}}
    except Exception as exc:  # noqa: BLE001
        yield {"event": "error", "data": {"detail": f"{type(exc).__name__}: {exc}"}}
        return

    yield {"event": "final", "data": {"content": "".join(full_parts)}}
