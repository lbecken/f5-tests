# Chapter 2 — Claude Code: Architecture & Internals

Claude Code is Anthropic's coding agent. It ships as a terminal CLI, a desktop app, a
web app (claude.ai/code), and IDE extensions — all of which are front-ends over the same
core: **a harness implementing the agent loop from Chapter 1, driving a Claude model
against your local machine.** The same core is also published as the **Claude Agent
SDK** (TypeScript and Python), so you can embed the identical loop in your own programs.

This chapter walks through one full turn — from you pressing Enter to the final answer —
and then covers each subsystem.

## 2.1 The anatomy of one turn

```
┌──────────────────────────────────────────────────────────────────┐
│  You type: "fix the failing test in auth_test.py"                │
└───────────────┬──────────────────────────────────────────────────┘
                ▼
   1. Harness assembles the API request:
      • system prompt  (identity, rules, environment info, git status)
      • memory files   (CLAUDE.md hierarchy — Chapter 3)
      • tool definitions (Read, Edit, Bash, Grep, ... — Chapter 4)
      • full conversation so far + your new message
                ▼
   2. Streaming call to the Claude API (Messages API)
                ▼
   3. Model streams back: thinking, prose, and/or tool_use blocks
                ▼
   4. For each tool call:
      a. permission check (allow rules / ask user / deny)
      b. hooks fire (PreToolUse)
      c. harness executes the tool (reads file, runs command...)
      d. hooks fire (PostToolUse)
      e. result (possibly truncated) appended as a tool_result message
                ▼
   5. GOTO 2 — the model sees the results and continues
                ▼
   6. Model stops emitting tool calls → its final text is your answer.
      The turn ends. The transcript is saved to disk for resumption.
```

Steps 2–5 may repeat dozens or hundreds of times in a single turn. When people say
Claude Code "worked autonomously for an hour," they mean this inner loop ran that long
under one user message.

## 2.2 The system prompt: the harness's standing orders

Every API call begins with a large system prompt the harness assembles. You never write
it, but understanding what's in it explains much of the behavior you observe:

- **Identity and behavioral rules** — "You are Claude Code…", conventions about
  conciseness, when to commit, security policy (assist with defensive security, refuse
  malware), how to format output for a terminal.
- **Tool usage guidance** — e.g. "prefer the dedicated Grep tool over shelling out to
  `grep`", "make independent tool calls in parallel", "reference code as
  `file:line`".
- **Environment snapshot** — working directory, OS/platform, whether it's a git repo,
  today's date, the model's own ID. This is how the model knows "today's date"
  despite a frozen training cutoff: the harness injects it as text.
- **Memory files** — the contents of your `CLAUDE.md` files (Chapter 3).
- **Dynamic reminders** — the harness injects `<system-reminder>` notes mid-conversation
  (e.g. "the user's todo list is empty", "this file changed on disk since you read
  it"). These are harness→model messages that render as if part of the conversation but
  originate from code, not the user.

Because system-prompt tokens are re-sent on *every* call, the harness relies heavily on
**prompt caching**: the Anthropic API can cache the long stable prefix (system prompt +
old messages) server-side, so each loop iteration only pays full price for the new
suffix. This is invisible to you but is what makes hundred-iteration loops economically
and latency-wise feasible.

## 2.3 The model layer

Claude Code drives Claude models with a few features that matter for agent quality:

- **Extended / interleaved thinking.** The model can emit private reasoning tokens
  before and *between* tool calls — deciding what to do with a test failure before
  acting on it. The harness controls the thinking budget.
- **Parallel tool calls.** The model may emit several independent `tool_use` blocks in
  one response (read three files at once); the harness executes them concurrently and
  returns all results together.
- **Fine-grained streaming.** Output streams token-by-token so the UI can show progress,
  and the user can interrupt (Esc) mid-generation — the harness aborts the stream and
  injects the interruption into the transcript.
- **Model tiers.** The harness can route different work to different models — a heavy
  model for the main loop, a fast cheap model (e.g. Haiku) for background chores like
  summarizing shell output for permission UIs or generating conversation titles.
  Subagents can also pin their own model (Chapter 4).

## 2.4 The permission system: the line between intent and effect

Because the model only *requests* actions, the harness can interpose policy. This is
Claude Code's central safety mechanism.

**Per-call evaluation.** Every tool call is matched against rules from a settings
hierarchy (see 2.6). A rule names a tool and optionally a pattern over its arguments:

```json
{
  "permissions": {
    "allow": ["Bash(npm run test:*)", "Read(./src/**)"],
    "ask":   ["Bash(git push:*)"],
    "deny":  ["Read(./.env)", "Bash(curl:*)", "WebFetch"]
  }
}
```

- `allow` → runs without prompting
- `ask` → user sees a confirmation dialog first
- `deny` → refused outright; the model receives a denial message as the tool result
  (and should adapt rather than retry)
- No matching rule → tool-specific default. Read-only tools (Read, Grep, Glob) run
  freely; mutating tools (Edit, Write, Bash) prompt.

**Permission modes** change the whole posture at once:

| Mode | Behavior |
|---|---|
| `default` | Prompt on first use of each mutating action |
| `acceptEdits` | File edits auto-approved; shell still prompts |
| `plan` | Read-only: the agent may explore but not modify anything; it produces a plan you approve before execution |
| `bypassPermissions` / `--dangerously-skip-permissions` | Everything auto-approved — for sandboxed/containerized use |

**Sandboxing.** On supporting platforms the harness can run shell commands inside an
OS-level sandbox (filesystem/network isolation) so that "allow" doesn't mean "trust
completely." Denied-by-sandbox operations surface as errors the model can react to.

The deep point: permissioning is only possible because of the harness/model split.
You cannot "permission" a model's thoughts, but you can gate the single choke point
where thoughts become actions.

## 2.5 Hooks: deterministic code around the loop

Hooks let you attach **your own shell commands** to lifecycle events, turning the agent
loop into an extensible pipeline:

| Event | Fires | Typical use |
|---|---|---|
| `SessionStart` | new/resumed session | inject env info, start services |
| `UserPromptSubmit` | you send a message | add context, validate/block prompts |
| `PreToolUse` | before a tool executes | block dangerous calls, rewrite inputs |
| `PostToolUse` | after a tool executes | auto-run formatters/linters after edits |
| `Stop` | agent finishes its turn | verify work, force continuation if tests fail |
| `PreCompact` | before context compaction | save state |
| `Notification` | agent needs attention | desktop/Slack pings |

A hook receives the event as JSON on stdin and can return JSON deciding the outcome
(e.g. exit code 2 from a `PreToolUse` hook blocks the call and feeds its stderr back to
the model as feedback). Hooks are *deterministic guarantees* — unlike instructions in a
prompt, which the model follows probabilistically, a hook always runs. Rule of thumb:
**preferences go in CLAUDE.md; invariants go in hooks.**

## 2.6 Configuration: the settings hierarchy

Settings merge from broadest to narrowest, later overriding earlier:

1. Enterprise managed policy (IT-controlled, cannot be overridden)
2. `~/.claude/settings.json` — your user-wide settings
3. `<repo>/.claude/settings.json` — project settings, checked into git, shared with team
4. `<repo>/.claude/settings.local.json` — personal per-project settings, gitignored

Settings cover permission rules, environment variables, hooks, model selection, and
more. The same directory scheme holds the other extension surfaces: `.claude/agents/`
(subagents), `.claude/skills/` (skills), `.claude/commands/` (slash commands), and
`.mcp.json` (project MCP servers) — all shareable via git, which is how a *team*
encodes "how our agent behaves in this repo."

## 2.7 Sessions, transcripts, and the UI layer

- Every session's full transcript (every message, tool call, and result) is persisted
  as JSONL under `~/.claude/projects/`. `claude --continue` reloads the most recent
  session; `claude --resume` lets you pick one. Resumption literally means "re-feed the
  saved transcript" — consistent with the stateless-model principle.
- The terminal UI is a rendering layer over the streaming API responses: markdown
  rendering, diff views for edits, permission dialogs, a background-task monitor.
- **Slash commands** (`/help`, `/compact`, `/clear`, `/model`, user-defined ones) are
  interpreted by the harness. Some never touch the model (`/clear` just empties the
  transcript); user-defined ones expand into prompts.
- Non-interactive mode (`claude -p "query"`) runs one turn headlessly and prints the
  result — this is how people wire Claude Code into CI pipelines and scripts. The Agent
  SDK generalizes this into a full programmatic API.

## 2.8 What is genuinely "the model" vs "the harness" — a cheat sheet

| Behavior you observe | Lives in |
|---|---|
| Choosing which file to read next | Model |
| The file's contents appearing in context | Harness (tool execution) |
| "Permission required for Bash command" | Harness |
| Deciding to run tests after an edit | Model (nudged by system prompt) |
| Prettier running automatically after edits | Harness (PostToolUse hook) |
| Knowing today's date and your OS | Harness (injected env info) |
| Knowing your team's coding conventions | Harness (injects CLAUDE.md) → Model (follows it) |
| Recovering from a failed edit | Model |
| The context "never quite filling up" | Harness (compaction, truncation) |

Next: the resource every one of these subsystems is really managing — **context**.
