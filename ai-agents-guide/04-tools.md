# Chapter 4 — The Tool System

Tools are the agent's action space: the complete set of things it *can do*. This chapter
catalogs Claude Code's built-in tools, explains how they're presented to the model, and
covers the three extension mechanisms — MCP servers, subagents, and skills.

## 4.1 How a tool looks from the model's side

Each tool is declared in the API request as `{name, description, input_schema}`. The
description is not documentation for humans — **it is the primary interface for the
model**, and its wording materially changes behavior. Claude Code's tool descriptions
are long and prescriptive: they include usage rules ("you must Read a file before
editing it"), anti-patterns ("avoid using Bash for find/grep — use the dedicated
tools"), and output-format notes. Prompt engineering of tool descriptions is a real and
underrated discipline: a vague description yields misuse; a crisp one yields reliable
call patterns.

The harness enforces some rules *mechanically* too — e.g. an `Edit` on a file that was
never `Read` in this session fails with an error, which the model sees and corrects.
Good harness design pairs every prompt-level rule with a hard check where possible.

## 4.2 The built-in tools

### Filesystem

| Tool | What it does | Design notes |
|---|---|---|
| **Read** | Read a file (text, images, PDFs, notebooks), returned with line numbers | Caps lines read by default; supports offset/limit so the model can window into big files. Line numbers enable precise edit targeting and `file:line` references. |
| **Write** | Create or fully overwrite a file | Overwriting an unread existing file is rejected — forces look-before-you-clobber. |
| **Edit** | Exact string replacement in a file | The model supplies `old_string`/`new_string`; the harness requires `old_string` to match uniquely. This is much more reliable for LLMs than line-number patching (numbers drift) or regenerating whole files (wasteful, error-prone). Failed matches return errors the model reacts to by re-reading. |
| **NotebookEdit** | Cell-level edits to Jupyter notebooks | Structured .ipynb awareness. |

### Search

| Tool | What it does | Design notes |
|---|---|---|
| **Glob** | Filename pattern matching (`src/**/*.ts`) | Returns paths sorted by modification time — recency is signal. |
| **Grep** | Content regex search (built on ripgrep) | Modes: files-with-matches / matching lines with context / counts. Fast enough for million-line repos; the primary exploration instrument. |

### Execution

| Tool | What it does | Design notes |
|---|---|---|
| **Bash** | Run a shell command | The escape hatch that makes the agent general: git, package managers, compilers, test runners, curl, docker — anything. Output is truncated beyond a limit (context protection). Supports background execution for servers/long builds, with separate tools to monitor output. Persistent working directory across calls. The permission system scrutinizes this tool most heavily, with pattern rules per command. |

### Web

| Tool | What it does |
|---|---|
| **WebFetch** | Fetch a URL and extract/summarize its content |
| **WebSearch** | Search the web — how the agent gets post-training-cutoff facts |

### Orchestration & interaction

| Tool | What it does | Design notes |
|---|---|---|
| **Task / Agent** | Spawn a subagent with its own context and toolset | Context quarantine (Chapter 3), parallelism (multiple subagents at once), role specialization. |
| **TodoWrite / task tracking** | Maintain a structured task list | Externalized plan state; also renders as UI progress for the user. Combats long-horizon drift: the list is re-shown to the model, keeping it anchored. |
| **AskUserQuestion** | Pose a structured multiple-choice question | For genuine decision points; blocks until you answer. |
| **Skill** | Invoke a skill (load its instructions into context) | Progressive disclosure of procedures. |
| **ExitPlanMode / plan tools** | Present a plan for approval when in plan mode | Human gate between research and mutation. |

### The tool-choice hierarchy

Note the deliberate redundancy: the model *could* do everything through Bash (`cat`,
`sed`, `grep`). The harness pushes it toward dedicated tools instead because they are:
safer to permission (a `Read` is provably read-only; a `bash cat` is a string), easier
to render in the UI (diff views for edits), more reliable (structured errors), and
cheaper (tuned output formats). **General principle: the narrower the tool, the more of
the stack can reason about it.**

## 4.3 MCP: the Model Context Protocol — user-defined tools

MCP is an open, JSON-RPC-based protocol (originated by Anthropic, now industry-wide)
that lets external processes serve tools to any compatible agent. An **MCP server**
advertises tools (plus optionally resources and prompt templates); the harness connects
as a client, merges those tools into the model's toolset (namespaced like
`mcp__github__create_pull_request`), and proxies calls.

Transports: **stdio** (harness spawns a local process), or **HTTP/SSE** (remote
servers, with OAuth support). Configuration is scoped like everything else: user-wide,
per-project (a checked-in `.mcp.json` so the whole team gets the same servers), or
local.

```json
// .mcp.json
{
  "mcpServers": {
    "github": {"command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"]},
    "postgres": {"command": "npx", "args": ["-y", "mcp-postgres", "postgresql://..."]}
  }
}
```

Why it matters conceptually: MCP decouples *tool authorship* from *harness authorship*.
Anyone can wrap a database, an issue tracker, a browser, or an internal API as a server,
and every MCP-capable agent gains that capability with zero harness changes. It is the
USB standard of the agent ecosystem. Two costs to know: every connected tool's schema
occupies context permanently (harnesses mitigate with deferred/searchable tool loading),
and third-party tool *results* are untrusted input (prompt-injection surface — treat
data from the world as data, not instructions).

## 4.4 Subagents in depth

A subagent definition is a markdown file with frontmatter:

```markdown
---
name: code-reviewer
description: Reviews diffs for correctness and style. Use after completing a feature.
tools: Read, Grep, Glob, Bash
model: sonnet
---
You are a meticulous code reviewer. For the diff you are given...
```

Placed in `.claude/agents/` (project) or `~/.claude/agents/` (user). The main agent
sees each subagent's `description` and delegates matching work — or you invoke one
explicitly. Each delegation runs the full agent loop in isolation with the subagent's
own system prompt, restricted tools, and chosen model, then returns a single report.

Uses in practice: **exploration** (burn a disposable context searching a huge repo),
**parallel fan-out** (five subagents each investigating one module simultaneously),
**specialization** (a security-reviewer with read-only tools; a test-runner that only
runs and summarizes), and **cost routing** (send grunt work to a cheaper model).

## 4.5 Skills and slash commands in depth

A **skill** is a directory: `SKILL.md` (frontmatter `name` + `description`, then
instructions) plus any supporting files — reference docs, executable scripts, templates.
Only name+description are always in context; the body loads on trigger. Skills can carry
*executable* payloads: instructions like "run `scripts/validate.py` to check the
palette" let the model combine learned procedure with deterministic code.

A **slash command** (`.claude/commands/review.md` → `/review`) is a prompt template,
optionally with `$ARGUMENTS` substitution, frontmatter-declared allowed tools, and even
inline `!bash` execution to inject fresh data into the prompt. Where CLAUDE.md is
*always-on knowledge*, commands are *on-demand playbooks* you trigger deliberately.

## 4.6 Choosing the right extension mechanism

| You want to… | Use |
|---|---|
| State a fact/convention the agent should always know | CLAUDE.md |
| Package a repeatable procedure invoked on demand | Skill or slash command |
| Give the agent a new *capability* (external system) | MCP server |
| Run big/parallel/specialized work without polluting context | Subagent |
| Guarantee something always/never happens | Hook + permission rules |

These compose: a skill can instruct the use of MCP tools; a subagent can be granted a
skill; a hook can enforce what all of them may do. That composability — small orthogonal
mechanisms over one simple loop — *is* the architecture of Claude Code.
