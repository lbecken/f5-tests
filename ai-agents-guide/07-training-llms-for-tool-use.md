# Chapter 7 — How LLMs Are Trained to Use Tools

Tool use feels like a product feature, but it is fundamentally a **trained capability**:
a raw language model completes text; a tool-using model must *decide* to act, emit
schema-valid structured calls, interpret results, recover from failures, and chain
dozens of actions toward a goal. This chapter walks the full training pipeline —
pretraining → supervised fine-tuning → reinforcement learning — with emphasis on the
agentic stages, and closes with what you'd actually do to teach tool use to an open
model yourself.

## 7.1 Stage 0: Pretraining — the raw material

Pretraining is next-token prediction over trillions of tokens of text and code. No tool
use is taught here, but everything tool use *rests on* is:

- **Code and JSON fluency** — emitting syntactically valid structured output is just
  language modeling over a corpus full of JSON, APIs, and shell sessions.
- **World/API knowledge** — what `git rebase` does, what an HTTP 404 means, what
  pytest output looks like.
- **In-context learning** — the emergent ability to pick up a novel pattern (like an
  unfamiliar tool schema) from examples or descriptions in the prompt. This is why
  models can use tools they've *never seen*: the schema in context + trained generic
  tool-calling behavior generalizes.

A base model already "knows how" in a weak sense: prompted with few-shot examples of a
tool-call transcript format, it will imitate it (this was the insight of early work like
Toolformer and ReAct-style prompting). But imitation from prompting alone is brittle —
wrong argument types, hallucinated tool names, no error recovery. The next stages make
it *reliable*.

## 7.2 Stage 1: Supervised fine-tuning — learning the protocol

SFT trains the model on curated conversations rendered in the **chat template**: special
tokens delimit system/user/assistant turns, and — crucially — dedicated syntax delimits
**tool definitions, tool calls, and tool results**. A single training example,
schematically:

```
<|system|>  You are an assistant... 
<|tools|>   [{"name":"get_weather","input_schema":{...}}, ...]
<|user|>    What's the weather in Paris and Tokyo?
<|assistant|> I'll check both cities.
<|tool_call|> {"name":"get_weather","arguments":{"city":"Paris"}}
<|tool_call|> {"name":"get_weather","arguments":{"city":"Tokyo"}}
<|tool_result|> {"city":"Paris","temp_c":18,...}
<|tool_result|> {"city":"Tokyo","temp_c":26,...}
<|assistant|> Paris is 18°C and cloudy; Tokyo is 26°C and clear.
```

Training mechanics worth understanding:

- **Loss masking.** The loss is computed only on the tokens the *model* should produce
  (assistant prose and tool-call tokens) — not on user turns or tool results. The model
  learns to *generate* calls and to *condition on* results, which is exactly the
  asymmetry the agent loop requires.
- **What the examples teach**, beyond syntax: *when* to call a tool vs. answer directly
  (examples of both, including refusing to call tools for questions the model can
  answer itself); *parallel* calls for independent operations; *argument grounding*
  (copying exact values from context rather than inventing them); reacting to **error
  results** (examples where the tool returns an error and the assistant retries
  differently); and saying "I can't" when no tool fits.
- **Where the data comes from.** Human-written examples are expensive, so the field
  leans on **synthetic data**: sample real APIs (or generate plausible ones), have a
  strong model generate user requests plus tool-call solutions, **execute the calls
  against real or simulated implementations**, and keep the trajectories that succeed
  (rejection sampling / model distillation). Landmark recipes: Toolformer
  (self-labeling where API calls reduce perplexity), Gorilla/ToolLLM (large synthetic
  API corpora), and the now-standard "generate → execute → filter → train" loop. The
  execution step is vital — it grounds the data in *actual* API behavior instead of the
  generator's imagination.
- **Diversity is the generalization lever.** Train on thousands of *distinct* schemas
  and the model learns "read the schema, follow it" rather than memorizing particular
  tools — which is what makes user-defined tools and MCP servers work zero-shot.

After SFT you have a competent **function-calling model**: it emits well-formed calls in
its trained format. Harness-side **constrained decoding** (grammar-restricted sampling /
"JSON mode") can guarantee syntactic validity on top. But SFT-only models still show the
classic weakness: they imitate the *shape* of trajectories without robustly pursuing
*outcomes*. Multi-step reliability comes from RL.

## 7.3 Stage 2: Preference tuning — judgment

RLHF/RLAIF (reward models trained from human or AI preference comparisons, or direct
methods like DPO) shapes qualities that matter for agents even though they're not
tool-specific: honesty about uncertainty, instruction-following, asking for
clarification at real decision points, not fabricating tool outputs, and taste in
communication. In Anthropic's stack, Constitutional AI adds AI-generated critiques
against explicit principles. Think of this stage as tuning the *policy's judgment*;
the next stage tunes its *competence over long horizons*.

## 7.4 Stage 3: Agentic RL — learning to succeed, not to imitate

This is the stage that separates a "model with function calling" from a model like the
ones behind Claude Code. The recipe, conceptually:

1. **Build environments.** Thousands of sandboxed tasks where success is *machine-
   checkable*: a repo with a failing test and hidden reference fix (does the test pass
   afterward?); a bug-injection pipeline over real GitHub projects (SWE-bench-style);
   terminal tasks; browsing tasks; math with checkable answers. This is **RLVR** — RL
   from *verifiable rewards* — and the verifiability is what makes reward hacking
   containable and human labeling unnecessary at scale.
2. **Roll out.** The model runs the *actual agent loop* in the environment — real tool
   calls, real errors, real multi-turn trajectories, sometimes hundreds of steps.
3. **Score.** Reward at trajectory end (tests pass, task verified), possibly with
   shaping terms (penalize excessive steps, reward passing intermediate checks) and
   reward-model scores for unverifiable aspects.
4. **Update.** Policy-gradient methods (PPO/GRPO family): raise the probability of
   token sequences occurring in successful trajectories, lower failed ones. The unit of
   credit is the whole trajectory — the model is optimized for *outcomes*, not for
   matching reference actions.

What RL visibly teaches, that SFT couldn't:

- **Error recovery** — a failed edit or command produces a *different* next attempt;
  trajectories that loop on identical failing calls get zero reward and are trained
  away.
- **Verification behavior** — running the tests after a fix is *rewarded* (it
  correlates with success), so checking-your-work becomes a learned reflex. Same for
  reading a file before editing it.
- **Long-horizon coherence** — keeping a plan over hundreds of steps, because only
  coherent trajectories ever reach the reward.
- **Calibrated effort** — simple tasks get direct answers; hard ones get exploration;
  reward shaping penalizes both flailing and overkill.
- **Interleaved reasoning** — extended-thinking tokens before/between calls are part of
  the sampled trajectory, so RL simultaneously trains *how the model thinks about* tool
  results, not just which call comes next.

Failure modes the trainers fight: **reward hacking** (deleting the failing test instead
of fixing the bug; hardcoding expected outputs — countered with held-out tests,
hack-detection checks, and careful environment design), **environment overfitting**
(countered with task diversity), and plain **compute cost** (each rollout is a full
agent session; agentic RL is enormously more expensive per sample than SFT).

Note the loop closure: the harness (Chapter 2) defines the tool interface → training
uses that interface in its environments → the model gets better at that interface → the
harness is refined around the model's trained strengths. Claude Code and Claude models
co-evolve; this is why Chapter 6's caveat — "the harness is tuned for Claude" — runs
deeper than prompt phrasing.

## 7.5 How you'd actually do it (recipe for an open model)

Concretely, to teach tool use to an open-weights model:

1. **Pick a base** with strong code pretraining (e.g. a Qwen/Llama-class model) and
   adopt its chat template's tool syntax — or define your own and be *rigidly
   consistent*, since template mismatch is the #1 silent killer of function-calling
   fine-tunes.
2. **Assemble SFT data**: mix public function-calling sets (e.g. Glaive, xlam/APIGen,
   ToolBench-style) with synthetic trajectories generated by a strong model against
   *executed* tools; include no-tool-needed cases, multi-turn cases, parallel calls,
   error-recovery cases, and irrelevant-tool distractors. A few tens of thousands of
   high-quality, diverse examples beats millions of samey ones.
3. **Fine-tune** (full or LoRA) with loss masked to assistant tokens; hold out entire
   *tool schemas* (not just examples) to measure generalization to unseen tools.
4. **Evaluate**: BFCL (Berkeley Function-Calling Leaderboard) for single/parallel/
   irrelevance-detection call accuracy; τ-bench for multi-turn agent-with-rules;
   SWE-bench Verified / Terminal-Bench for end-to-end agentic coding.
5. **If you need long-horizon reliability, add RL**: wire the model into an agent
   harness against verifiable tasks (open frameworks: SWE-Gym-style environments,
   verifiers/GRPO trainers) and optimize trajectory reward. This step is expensive and
   fiddly — for many applications, great SFT + a well-designed harness (retries,
   validation, constrained decoding) gets you 90% of the way.
6. **Ship with harness-side guarantees regardless**: schema validation, constrained
   decoding for call syntax, argument sanity checks, and permission gates. Training
   makes good behavior *likely*; the harness makes bad behavior *non-fatal* — you need
   both, which is the same model/harness duality this guide opened with.
