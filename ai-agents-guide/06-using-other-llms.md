# Chapter 6 — Using Other LLMs with Claude Code

Short answer: **yes, mechanically — with real caveats.** Claude Code is a client of the
Anthropic **Messages API**. Anything that speaks that API (natively or via a
translating proxy) can sit on the other end. Anthropic officially supports alternate
*hosting* of Claude models and enterprise gateways; the community additionally uses the
same seams to point Claude Code at entirely different models. This chapter explains
each seam, then the trade-offs.

## 6.1 The seams: where the backend is configurable

Claude Code reads a handful of environment variables / settings that control where API
calls go:

| Variable | Effect |
|---|---|
| `ANTHROPIC_BASE_URL` | Send API traffic to this URL instead of `api.anthropic.com` |
| `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_API_KEY` | Credential sent to that endpoint |
| `ANTHROPIC_MODEL` / `--model` / `/model` | Model ID requested for the main loop |
| `ANTHROPIC_SMALL_FAST_MODEL` (and similar) | Model used for background/helper calls |
| `CLAUDE_CODE_USE_BEDROCK=1` | Route to AWS Bedrock (Claude on AWS, AWS auth/IAM) |
| `CLAUDE_CODE_USE_VERTEX=1` | Route to Google Vertex AI (Claude on GCP) |

These can live in your shell, or in `settings.json` under `env` so they apply
per-project.

## 6.2 Officially supported: same Claude, different pipes

- **Amazon Bedrock / Google Vertex AI** — first-class support. Same Claude models,
  hosted in your cloud account: your billing, your region, your compliance boundary.
  Model IDs change to provider-specific forms (e.g.
  `us.anthropic.claude-sonnet-...-v1:0` on Bedrock) and auth becomes IAM/gcloud, but
  the agent behaves identically because the model is identical.
- **Enterprise LLM gateways** (LiteLLM proxy, corporate API gateways) — point
  `ANTHROPIC_BASE_URL` at a gateway that fronts Anthropic/Bedrock/Vertex. The gateway
  centralizes keys, quotas, audit logs, and cost attribution. Still Claude under the
  hood; the gateway just forwards Messages-API traffic.

## 6.3 Unofficial but common: genuinely different models

Two mechanisms:

**a) Anthropic-compatible endpoints.** Several model providers implement the Messages
API directly because Claude Code compatibility is commercially valuable — e.g.
DeepSeek, Moonshot (Kimi), Z.ai (GLM), and others expose a base URL you can drop in:

```bash
export ANTHROPIC_BASE_URL="https://api.<provider>.com/anthropic"
export ANTHROPIC_AUTH_TOKEN="<their key>"
export ANTHROPIC_MODEL="<their model id>"
claude
```

**b) Translating proxies.** A local proxy (LiteLLM and several purpose-built
"claude-code-proxy" projects) accepts Messages-API requests, converts them to another
provider's format (OpenAI-style chat completions, Gemini, or a local runtime like
Ollama/vLLM), converts responses back — including mapping `tool_use` blocks to/from the
other side's function-calling format. This is how people run Claude Code against GPT,
Gemini, Qwen, or a local open-weights model on their own GPU.

```
Claude Code ──Messages API──► proxy ──OpenAI API──► any model
            ◄──tool_use blocks── ◄──function_call──
```

Since the tool protocol on both sides is "JSON schemas in, structured calls out," the
translation is mostly mechanical — the *format* converts fine. What doesn't convert is
covered next.

## 6.4 The honest trade-offs

1. **The harness is tuned for Claude.** System prompt phrasing, tool descriptions,
   agentic conventions (parallel calls, Read-before-Edit discipline, interleaved
   thinking between tool calls) are developed and evaluated against Claude models.
   Another model receives instructions optimized for someone else's brain.
2. **Agentic RL is model-specific** (Chapter 7). Long-horizon reliability — recovering
   from failed edits, not looping, knowing when to verify — comes from training on
   agent trajectories. Models without comparable agentic training degrade
   disproportionately on *long* tasks even if single-shot coding quality looks similar
   on benchmarks.
3. **Feature gaps.** Prompt caching semantics, extended thinking, fine-grained
   streaming, 200k+ windows, image inputs, parallel tool calls — a proxy target may
   lack any of these. Missing prompt caching alone can multiply cost and latency of
   loop-heavy sessions several-fold. Proxies silently drop what they can't map.
4. **Support and terms.** Unofficial setups are unsupported; behavior can break on any
   harness update. Check both Anthropic's and the target provider's terms.

A useful decision rule: if your motivation is **where the model runs** (cloud, region,
compliance, billing) → Bedrock/Vertex/gateway, fully supported, zero quality loss. If
your motivation is **running a different model** — expect a meaningful quality drop on
exactly the agentic behaviors that make Claude Code feel magical, and prefer
harnesses/models designed together.

## 6.5 The other direction: Claude Code's brain in *your* app

If your actual goal is "an agent, but different" rather than "Claude Code with a
different model," the **Claude Agent SDK** (Python/TypeScript) exposes the whole
harness — loop, tools, permissions, MCP, subagents, hooks — as a library. You define
the system prompt, restrict tools, add MCP servers, and embed it in services or CI.
That's usually the better seam for customization than swapping the model underneath the
stock CLI.
