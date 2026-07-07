# Chapter 5 — Exploring Very Large Codebases

A 2-million-line monorepo is maybe 100M tokens — two orders of magnitude beyond any
context window. Yet Claude Code works well on such repos. How? The same way *you* do:
nobody holds a monorepo in their head. You hold a **map**, you **search**, you read
**only what matters**, and you take **notes**. This chapter turns Chapter 3's context
economics into concrete workflows.

## 5.1 The core insight: navigation beats ingestion

The naive mental model — "the AI reads the whole codebase" — is wrong and would be bad
even if possible (attention degrades over huge contexts; 99% of the repo is irrelevant
to any given task). The correct model:

> The agent maintains a small working set of *actually relevant* code in context, found
> via cheap search operations over the full repo.

Grep over millions of lines costs milliseconds and, crucially, **returns only matches**
— a few hundred tokens buys evidence about a hundred-million-token corpus. The agent's
standard funnel:

```
Glob (what files exist / where)          ~ 50–500 tokens per probe
  → Grep files-with-matches (which files mention X)
    → Grep with context lines (what do those mentions look like)
      → Read specific ranges (the actual code)         ← the only expensive step
```

Watch a good session and you'll see this funnel over and over: hypothesis → cheap probe
→ narrower probe → targeted read → edit.

## 5.2 Give the agent a map: CLAUDE.md as codebase atlas

Search finds *mentions*; it can't tell the agent that "everything under `legacy/` is
deprecated" or "services communicate only via protobuf definitions in `proto/`."
That's map knowledge, and it belongs in CLAUDE.md:

```markdown
# Repo layout
- services/     40 microservices, one dir each. Entry point: cmd/main.go
- pkg/          shared libraries. NEVER import from services/ into pkg/
- proto/        source of truth for all service APIs (buf generate)
- legacy/       frozen; do not modify without a migration ticket

# Finding things
- HTTP routes are registered in services/*/internal/routes.go
- Feature flags: grep for `ff.Enabled("` — definitions in pkg/flags/registry.go
- DB schema: migrations/ is authoritative, not the ORM structs

# Commands
- Test one service: make test SVC=payments
- Full build is slow (~20m): don't run it; CI does.
```

Then push detail down the tree with **subdirectory CLAUDE.md files** — each subsystem
documents itself, loaded only when the agent works there. In a monorepo this is the
single highest-leverage investment: minutes to write, saves every future session
minutes of re-discovery. Run `/init` for a first draft, then curate — and when the agent
learns something the hard way mid-session ("turns out codegen must run before tests"),
tell it to add that to the relevant CLAUDE.md. That's how the map compounds.

## 5.3 Subagents: exploration without context damage

For any question whose answer requires *broad* reading — "how does authentication work
across these services?", "find every place we construct S3 clients" — delegate to an
**Explore subagent**. It burns its own disposable context on the wide sweep and returns
a distilled report (file paths, call chains, conclusions) costing the parent a few
hundred tokens.

Patterns that work:

- **Fan-out**: "Spawn three subagents: one to map how requests enter the system, one to
  trace the payment flow end-to-end, one to inventory our kafka consumers. Then combine
  the reports." Parallel, isolated, cheap.
- **Scout-then-execute**: first a read-only exploration pass producing a written brief
  (file paths! exact symbols!), then the main agent implements from the brief, reading
  only the named files. This keeps the *implementation* context pristine.
- **Ask for paths, not prose**: instruct subagents to report concrete `file:line`
  anchors. A report of "auth is handled by middleware" is nearly useless; a report of
  "JWT validation: pkg/authmw/jwt.go:88, called from services/*/internal/routes.go" is
  gold.

## 5.4 Plan mode and the research/act split

For nontrivial changes in a big repo, start in **plan mode** (read-only). The agent
researches freely — it cannot break anything — and produces a plan you approve. Benefits
specific to large codebases: the research phase surfaces the *blast radius* (call sites,
downstream consumers, tests) before any edit; and the approved plan acts as an anchor
document that survives compaction. For multi-hour tasks, have the plan written to a file
(`PLAN.md`) and updated as work proceeds — externalized state again.

## 5.5 Practical tactics, in rough order of impact

1. **Scope the task in your prompt.** "Fix the retry logic in the payments client
   (`pkg/clients/payments/`)" outperforms "fix retries" by skipping the discovery the
   agent would otherwise do. You know where things are; front-load that knowledge.
2. **Name your entry points.** Point at one exemplar ("make it work like the refunds
   endpoint does") — the agent generalizes superbly from a concrete pattern in-repo.
3. **Let the compiler/tests be the guide.** In statically-typed repos, a change +
   `build` loop lets the type-checker enumerate every affected site — the agent chases
   errors instead of guessing. Tell it which narrow test command to use (full suites
   are context- and time-expensive).
4. **Use git as a knowledge base.** The agent can `git log -S symbol`, `git blame`, and
   read old PRs to learn *why* code is the way it is. History is documentation.
5. **`/clear` between tasks; `/compact` mid-task at natural checkpoints** (e.g. after
   landing a milestone), when you still control what matters, rather than letting
   auto-compaction fire mid-thought.
6. **Keep sessions single-purpose.** One task per session keeps the working set
   coherent; interleaving two features doubles the irrelevant context each carries.
7. **For repeated deep dives, mint a skill.** If "trace a request through the gateway"
   is a monthly need, encode the procedure (which files, which greps, which dashboards)
   as a skill — institutional knowledge, on demand.

## 5.6 A worked example

Task: *"Users report double-charging when they retry a failed checkout. Find and fix."*
A well-run session on a huge repo looks like:

1. Plan mode. Agent greps `checkout` under `services/` → finds `services/checkout/`;
   reads its `CLAUDE.md` (idempotency conventions are documented there).
2. Spawns an Explore subagent: "trace the payment path from checkout HTTP handler to
   the charge call; report file:line for each hop and any idempotency-key handling."
3. Report comes back: handler → orchestrator → `pkg/clients/payments/client.go:142`;
   idempotency key generated per-*attempt*, not per-*order* — smoking gun, ~600 tokens.
4. Agent reads the two implicated files (only now paying real read cost), confirms,
   presents a plan: derive key from order ID; add regression test; check the refunds
   client for the same bug (pattern-search: one grep).
5. You approve; it edits, runs `make test SVC=payments`, iterates on one failure,
   updates the checkout CLAUDE.md with the idempotency rule, commits.

Total context consumed: a tiny slice of one window. Codebase size: irrelevant. That's
the point — **with search, maps, delegation, and externalized state, repo size stops
being the limiting factor; task clarity does.**
