# Chapter 8 — Build Your Own Mini Claude Code

Nothing cements the concepts like seeing that a working coding agent fits in ~150 lines.
This chapter builds one in Python against the Anthropic API: the agent loop, four tools
(read, list, edit, bash), a permission gate, and basic context hygiene. Every line maps
to a concept from earlier chapters.

> Prerequisites: `pip install anthropic`, an `ANTHROPIC_API_KEY` in your environment.
> Run it in a scratch directory — it executes real shell commands (after asking you).

## 8.1 The complete agent

```python
"""mini_agent.py — a ~150-line coding agent (Chapter 8 of the AI Agents guide)."""
import json, os, subprocess, sys
import anthropic

client = anthropic.Anthropic()
MODEL = "claude-sonnet-5"          # any current Claude model id works

# ---------------------------------------------------------------- tools ----
# 1. Each tool = name + description (the model's ONLY manual) + JSON Schema.
TOOLS = [
    {
        "name": "read_file",
        "description": ("Read a text file. Returns contents with line numbers. "
                        "Read a file before editing it."),
        "input_schema": {"type": "object",
                         "properties": {"path": {"type": "string"}},
                         "required": ["path"]},
    },
    {
        "name": "list_files",
        "description": "List files in a directory (non-recursive).",
        "input_schema": {"type": "object",
                         "properties": {"path": {"type": "string", "default": "."}},
                         "required": []},
    },
    {
        "name": "edit_file",
        "description": ("Replace old_str with new_str in a file (old_str must occur "
                        "exactly once). To create a new file, use empty old_str."),
        "input_schema": {"type": "object",
                         "properties": {"path": {"type": "string"},
                                        "old_str": {"type": "string"},
                                        "new_str": {"type": "string"}},
                         "required": ["path", "old_str", "new_str"]},
    },
    {
        "name": "bash",
        "description": "Run a shell command and return stdout+stderr (120s timeout).",
        "input_schema": {"type": "object",
                         "properties": {"command": {"type": "string"}},
                         "required": ["command"]},
    },
]

MAX_RESULT_CHARS = 20_000   # context hygiene: never let one result flood the window

def run_tool(name: str, args: dict) -> str:
    """The 'hands' of the agent. Deterministic code; the model never touches disk."""
    try:
        if name == "read_file":
            lines = open(args["path"], encoding="utf-8").read().splitlines()
            return "\n".join(f"{i+1:6}\t{l}" for i, l in enumerate(lines)) or "(empty)"
        if name == "list_files":
            return "\n".join(sorted(os.listdir(args.get("path") or ".")))
        if name == "edit_file":
            path, old, new = args["path"], args["old_str"], args["new_str"]
            if old == "":
                if os.path.exists(path):
                    return "ERROR: file exists; provide old_str to edit it"
                open(path, "w", encoding="utf-8").write(new)
                return f"Created {path}"
            src = open(path, encoding="utf-8").read()
            if src.count(old) != 1:                     # forces precise, unique anchors
                return f"ERROR: old_str occurs {src.count(old)} times; need exactly 1"
            open(path, "w", encoding="utf-8").write(src.replace(old, new, 1))
            return f"Edited {path}"
        if name == "bash":
            r = subprocess.run(args["command"], shell=True, capture_output=True,
                               text=True, timeout=120)
            return f"exit={r.returncode}\n{r.stdout}{r.stderr}" or "(no output)"
        return f"ERROR: unknown tool {name}"
    except Exception as e:                              # errors go BACK to the model
        return f"ERROR: {type(e).__name__}: {e}"

def gated(name: str, args: dict) -> str:
    """Permission system: the harness sits between intent and effect (Ch. 2)."""
    if name in ("bash", "edit_file"):                   # mutating tools prompt
        print(f"\n  ⚠  {name}: {json.dumps(args)[:200]}")
        if input("  allow? [y/N] ").strip().lower() != "y":
            return "User denied permission. Ask them how to proceed, or adapt."
    out = run_tool(name, args)
    if len(out) > MAX_RESULT_CHARS:                     # truncation = context defense
        out = out[:MAX_RESULT_CHARS] + f"\n...[truncated {len(out)} chars total]"
    return out

# ----------------------------------------------------------- the loop ----
SYSTEM = f"""You are a careful coding agent working in {os.getcwd()}.
Explore before acting: list/read relevant files first. After changing code, verify
your work (run the code or tests via bash). Keep answers concise. If a tool errors,
diagnose and try a different approach rather than repeating the call."""

def turn(messages: list) -> None:
    """One user turn = the inner loop from Chapter 2 until the model stops acting."""
    while True:
        resp = client.messages.create(model=MODEL, system=SYSTEM, tools=TOOLS,
                                      max_tokens=8000, messages=messages)
        messages.append({"role": "assistant", "content": resp.content})
        for block in resp.content:                      # show prose as it arrives
            if block.type == "text":
                print(f"\n{block.text}")
        if resp.stop_reason != "tool_use":              # no calls => turn is done
            return
        results = []                                    # execute EVERY requested call
        for block in resp.content:
            if block.type == "tool_use":
                print(f"→ {block.name}({json.dumps(block.input)[:120]})")
                results.append({"type": "tool_result", "tool_use_id": block.id,
                                "content": gated(block.name, block.input)})
        messages.append({"role": "user", "content": results})   # observations go back

if __name__ == "__main__":
    print("mini-agent — type a task, or 'quit'")
    history = []                                        # THE memory. Nothing else.
    while True:
        try:
            user = input("\n> ").strip()
        except EOFError:
            break
        if user in ("quit", "exit"):
            break
        history.append({"role": "user", "content": user})
        turn(history)
```

## 8.2 Try it

```
$ python mini_agent.py
> write a fizzbuzz in fizz.py and prove it works
→ list_files({})
→ edit_file({"path": "fizz.py", "old_str": "", "new_str": "for i in range(1, 16):..."})
  ⚠  edit_file: {"path": "fizz.py", ...}   allow? [y/N] y
→ bash({"command": "python fizz.py"})
  ⚠  bash: {"command": "python fizz.py"}   allow? [y/N] y

Created fizz.py and verified: it prints 1, 2, Fizz, 4, Buzz, ... as expected.
```

Watch what you did *not* write: no code decides "list first, then create, then verify."
That ordering is the model's trained policy (Chapter 7) operating through your loop.
Change the task and the control flow changes with it — that's the agency.

## 8.3 Map every line back to the big system

| In this toy | In Claude Code |
|---|---|
| `history` list | the session transcript, persisted as JSONL, resumable |
| `SYSTEM` string | the assembled system prompt + env info + CLAUDE.md hierarchy |
| `TOOLS` + descriptions | rich built-in toolset + MCP-served tools |
| `gated()` prompt | permission rules/modes, settings hierarchy, sandboxing |
| `MAX_RESULT_CHARS` | per-tool truncation, Read windowing |
| returning `ERROR:` to the model | structured tool errors → trained recovery |
| `while True` in `turn()` | the loop — same shape, plus streaming, parallelism, interrupts |
| (missing) | compaction, subagents, hooks, skills, prompt caching, IDE/UI layer |

The "(missing)" row is the honest gap: the toy dies at context overflow, has no
delegation, no deterministic guardrails, no caching economics. Each earlier chapter of
this guide is precisely the engineering that fills one of those gaps. Extend it in this
order and you'll re-derive Claude Code's architecture yourself:

1. **Grep/glob tools** — exploration becomes cheap (Chapter 5's funnel).
2. **Memory file** — read `AGENT.md` at startup into `SYSTEM` (Chapter 3).
3. **Compaction** — when `history` grows large, ask the model to summarize it, and
   replace old messages with the summary.
4. **A subagent tool** — a tool whose implementation is… calling `turn()` with a fresh
   history and returning the final text. (Really. That's all a subagent is.)
5. **Hooks** — shell out to user scripts before/after `run_tool`.
6. **Prompt caching** — add `cache_control` breakpoints to stable prefixes.

If you'd rather not re-derive it, this is exactly what the **Claude Agent SDK** gives
you off the shelf — the production version of this file.

---

*End of guide. The whole subject in one sentence: a stateless text-predictor, a loop
that lends it hands and eyes, a token budget managed like the scarce resource it is,
and training that turned imitation into competence.*
