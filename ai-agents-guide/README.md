# AI Agents & Claude Code: An In-Depth Guide

A first-principles tutorial on what AI agents are, how they work internally, and a deep
dive into **Claude Code** specifically — its architecture, context management, memory,
tool system, and how to use it effectively on very large codebases. The final chapters
cover running Claude Code against non-Anthropic models and how LLMs are actually
*trained* to use tools.

## Table of contents

| Chapter | Topic |
|---|---|
| [01 — First Principles of AI Agents](01-first-principles.md) | From next-token prediction to autonomous agents: the agent loop, tools, observations, planning |
| [02 — Claude Code Architecture & Internals](02-claude-code-architecture.md) | The harness vs. the model, the core loop, system prompt assembly, permissions, hooks, streaming |
| [03 — Context & Memory](03-context-and-memory.md) | The context window, CLAUDE.md memory hierarchy, compaction, sessions, why "memory" is an illusion worth understanding |
| [04 — The Tool System](04-tools.md) | Every built-in tool explained, tool schemas, MCP servers, subagents, skills & slash commands |
| [05 — Exploring Very Large Codebases](05-exploring-large-codebases.md) | Strategies, workflows, and context-budget thinking for million-line repos |
| [06 — Using Other LLMs with Claude Code](06-using-other-llms.md) | Bedrock, Vertex, gateways/proxies, Anthropic-compatible endpoints, and the real trade-offs |
| [07 — Training LLMs for Tool Use](07-training-llms-for-tool-use.md) | Pretraining → SFT → RL: how a raw language model becomes a tool-calling agent |
| [08 — Build Your Own Mini Claude Code](08-build-your-own-agent.md) | A minimal working agent loop in ~150 lines of Python, to make everything concrete |

## How to read this guide

- If you want **intuition first**, read chapters 1 → 8 in order. Each chapter builds on
  the previous one.
- If you're a **practitioner who already uses Claude Code** and wants to get better at
  it, jump to chapters 3, 4, and 5.
- If you're an **engineer building agents**, chapters 1, 7, and 8 are the core.

## The single most important idea

Everything in this guide unfolds from one fact:

> **An LLM is a stateless function from text to text. An agent is a loop wrapped around
> that function, which feeds the model's requested *actions* into a real environment and
> feeds the environment's *results* back into the model's input.**

The model never "does" anything. It only *emits structured text saying what it wants
done*. A conventional program — the harness — parses that text, executes it, and appends
the outcome to the transcript. Intelligence lives in the model; agency lives in the loop.
Once you internalize this, every feature of Claude Code (context limits, compaction,
permission prompts, MCP, subagents) becomes an obvious engineering consequence rather
than magic.
