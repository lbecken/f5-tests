# Chapter 3 — Context & Memory

If Chapter 1 had one idea (an agent is a loop), this chapter has one too:

> **Context is the scarcest resource in the entire system. Every part of Claude Code's
> "memory" is an engineered strategy for spending a fixed token budget well.**

## 3.1 What actually occupies the context window

On every single API call, the model receives (and must fit within its window, hundreds
of thousands of tokens):

```
┌─────────────────────────────────────────────┐
│ System prompt (harness instructions)         │  ~ fixed overhead
│ Tool definitions (schemas + descriptions)    │  ~ fixed overhead
│ Memory: CLAUDE.md files                      │  you control this
├─────────────────────────────────────────────┤
│ Conversation history:                        │
│   your messages                              │
│   model prose + thinking                     │  grows every
│   every tool call it made                    │  loop iteration
│   every tool result (file contents, command  │
│   output, search hits...)                    │
├─────────────────────────────────────────────┤
│ Reserved headroom for the model's output     │
└─────────────────────────────────────────────┘
```

Run `/context` inside Claude Code and it shows you this breakdown live. Two practical
consequences:

- **Reading is spending.** When the agent reads a 3,000-line file, those tokens are now
  carried in *every subsequent call* of the session. This is why the Read tool reads at
  most ~2,000 lines by default, supports offset/limit windows, and why the system prompt
  tells the model to read only the parts it needs.
- **Old irrelevant detail crowds out new relevant detail.** Beyond raw overflow, very
  long contexts measurably degrade attention quality ("context rot") — another reason
  the harness works to keep transcripts lean.

## 3.2 Memory type 1: CLAUDE.md — durable, declarative memory

`CLAUDE.md` files are markdown files the harness automatically loads into the system
prompt at session start. They are the mechanism for "things Claude should always know
here." The hierarchy, from broadest to narrowest:

| File | Scope | Typical contents |
|---|---|---|
| Enterprise policy CLAUDE.md | whole org | mandated standards |
| `~/.claude/CLAUDE.md` | you, all projects | personal style ("I prefer pytest", "answer tersely") |
| `<repo>/CLAUDE.md` | project, checked in | build/test commands, architecture map, conventions, gotchas |
| `<repo>/CLAUDE.local.md` or imports | project, personal | your local paths, sandbox URLs |
| `<subdir>/CLAUDE.md` | one subtree | module-specific rules — loaded **on demand** when the agent works with files in that subtree |

Notes on mechanics:

- Files support `@path/to/file` **imports**, so a CLAUDE.md can pull in other docs
  (e.g. `@docs/architecture.md`) without duplicating them.
- The subdirectory behavior is the important scaling trick: a monorepo can carry dozens
  of scoped CLAUDE.md files, and each session pays only for the ones relevant to where
  it's working — *progressive disclosure* of memory.
- The `/init` command bootstraps a project CLAUDE.md by having the agent survey the
  repo. The `#` shortcut ("# remember: our CI uses node 20") appends a memory to the
  appropriate file mid-session.
- Because CLAUDE.md is re-sent constantly, treat it like a hot cache line: short,
  factual, high-value. A bloated CLAUDE.md taxes every request and dilutes attention.
  Prefer pointers ("auth logic lives in `services/auth/`; see its CLAUDE.md") over
  pasted essays.

This is "memory" in the only sense an LLM can have it: **text a program faithfully
re-injects.** Claude doesn't remember your conventions between sessions — the harness
re-reads the file and the model re-learns them in milliseconds, every time.

## 3.3 Memory type 2: the transcript — working memory

Within a session, the conversation itself is the working memory: everything observed and
concluded so far conditions the next action. Its properties:

- Perfect within the window (the model can quote a file it read an hour ago verbatim),
  until it isn't (compaction, below).
- Ephemeral by default across sessions, but recoverable: transcripts persist on disk
  (`~/.claude/projects/…`) and `--continue` / `--resume` reload them.

## 3.4 Compaction: surviving long tasks

What happens when the transcript approaches the window limit? Claude Code **compacts**:

1. As the context nears capacity, the harness (automatically, or when you run
   `/compact`) makes a special model call: *"summarize this conversation, preserving
   the task state, key decisions, file paths, and what remains to be done."*
2. The old transcript is replaced by the summary (recent messages and recently-read file
   state may be preserved verbatim), and work continues in the freed space.

Compaction is **lossy**. The summary keeps the plot but drops details — exact code the
agent read, subtle constraints mentioned in passing. Symptoms of a bad compaction: the
agent re-reads files it already read, or forgets a requirement from early in the
session. Mitigations you control:

- `/compact focus on the database migration work` — steer what the summary preserves.
- Ask the agent to **write state to disk before long hauls**: a `NOTES.md` or plan file
  with decisions and progress. Files survive compaction perfectly; context doesn't.
  (This is also what the built-in todo/task tracking is for — externalized plan state
  that gets re-injected.)
- `/clear` between unrelated tasks — starting fresh beats dragging an irrelevant
  compacted history into a new problem.

The general principle is worth naming: **externalize state**. The filesystem is the
agent's unlimited, lossless, persistent memory; the context window is its small, lossy,
expensive one. Skilled agents (and skilled users) shuttle state between them
deliberately.

## 3.5 Memory type 3: subagents — context quarantine

The `Task`/`Agent` tool lets the main agent spawn a **subagent**: a *fresh* agent loop
with its own empty context, its own (possibly restricted) toolset, given a one-shot
mission brief. The subagent runs its own iterations — reading files, grepping, whatever
— and returns only its **final report** to the parent. The parent's transcript gains a
paragraph, not the 80,000 tokens of exploration the subagent burned.

This is the second great context weapon after compaction, and the core trick for large
codebases (Chapter 5):

```
Parent context cost of exploring a subsystem directly:   ~80k tokens
Parent context cost of delegating to an Explore subagent: ~500 tokens (the summary)
```

Trade-offs: the subagent starts cold (no conversation context — the brief must contain
everything it needs), can't ask you questions mid-flight, and its detailed findings are
lost except for what it chose to report. Custom subagents can be defined as markdown
files in `.claude/agents/` with their own system prompt, tool allowlist, and model
choice (e.g. a cheap fast model for search grunt work).

## 3.6 Memory type 4: skills — on-demand procedural memory

Skills (`.claude/skills/<name>/SKILL.md`) are folders of instructions + optional scripts
that load **only when triggered**. Only each skill's short description sits in context
permanently (via the skill list); the full body — potentially pages of procedure, plus
reference files it links — is read when the model invokes it. Same progressive-
disclosure economics as subdirectory CLAUDE.md: pay a one-line index cost always, pay
the full cost only when relevant. Slash commands (`.claude/commands/*.md`) are the
manual-trigger cousin: prompt templates you invoke by name.

## 3.7 Prompt caching: why all this re-sending is affordable

Since the model is stateless, iteration N of the loop re-sends everything from
iterations 1..N-1. Anthropic's **prompt caching** makes this cheap: the API caches the
key/value attention state of a stable prefix (with a short TTL), so a follow-up call
that extends the same prefix pays a small fraction of the cost and latency for the
cached part. The harness arranges the request precisely to maximize prefix stability —
one reason the system prompt and tool definitions come first and stay byte-identical
across calls. Cache-friendliness is also why appending to the transcript is cheap but
*editing* the middle of it (which invalidates the prefix) is something harnesses avoid.

## 3.8 Mental model summary

| "Memory" | Mechanism | Persistence | Cost profile |
|---|---|---|---|
| Model weights | training | forever, but frozen & generic | free at runtime |
| CLAUDE.md | re-injected file | durable, versioned in git | paid every request — keep small |
| Transcript | growing message list | one session (resumable) | grows until compaction |
| Compaction summary | model-written précis | replaces transcript | lossy |
| Files on disk (notes, plans) | agent reads/writes them | unlimited | paid only when read |
| Subagent context | separate loop | discarded after report | quarantined |
| Skills | lazy-loaded instructions | durable | index always, body on demand |

If you remember one heuristic: **put it in CLAUDE.md if it's always true, in a file if
it's task state, in a subagent if it's a big exploration, and in the transcript only if
it's needed right now.**
