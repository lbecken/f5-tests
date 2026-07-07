# Chapter 1 — First Principles of AI Agents

Before touching Claude Code, we need to build the concept of an "AI agent" from the
ground up. Almost every confusion people have about agents ("does it remember me?",
"why did it forget what it was doing?", "how does it *run* commands?") dissolves once
you understand three layers:

1. What an LLM actually is (a stateless text-completion function)
2. What tool use actually is (structured text that a program executes)
3. What an agent actually is (a loop)

## 1.1 The base layer: an LLM is a next-token function

A large language model is, mathematically, a function:

```
P(next_token | all_previous_tokens)
```

You give it a sequence of tokens (roughly: word fragments), and it outputs a probability
distribution over what token comes next. Sampling from that distribution repeatedly
produces text. That's the whole interface. Crucially:

- **It is stateless.** The model has no memory between calls. Every single call receives
  the *entire* conversation so far as input and computes a fresh answer. What feels like
  a "conversation with memory" is the client re-sending the full transcript every turn.
- **It is text-in, text-out.** The model cannot open files, run commands, browse the
  web, or touch a database. It can only emit tokens.
- **Its knowledge is frozen.** Everything it "knows" was baked in during training. Any
  fact about *your* code, *your* system, *today's* date must be placed into its input.

This input — the transcript the model sees on each call — lives in the **context
window**: a hard maximum on how many tokens can be fed in (hundreds of thousands of
tokens for modern Claude models). The context window is the agent's entire perceptual
universe. If something isn't in the context, the model does not know it, period.

### Chat is already a small illusion

A "chat" API like Anthropic's Messages API accepts a structured list:

```json
{
  "system": "You are a helpful coding assistant...",
  "messages": [
    {"role": "user", "content": "What does this function do?"},
    {"role": "assistant", "content": "It parses the config file..."},
    {"role": "user", "content": "Can you refactor it?"}
  ]
}
```

Under the hood this is serialized into one long token sequence with special delimiter
tokens marking who said what, and the model completes the next assistant turn. The
"roles" are a training-time convention, not an architectural feature. Keep this in mind:
**everything an agent does is ultimately manipulation of this one growing list of
messages.**

## 1.2 The second layer: tool use

If the model can only emit text, how does it ever *do* anything? Answer: we agree on a
protocol.

1. In the request, the client declares a set of **tools**, each with a name, a natural
   language description, and a machine-readable parameter schema (JSON Schema):

   ```json
   {
     "name": "read_file",
     "description": "Read a file from the local filesystem.",
     "input_schema": {
       "type": "object",
       "properties": {"path": {"type": "string", "description": "Absolute path"}},
       "required": ["path"]
     }
   }
   ```

2. The model, when it decides a tool would help, emits a **structured block** instead of
   (or in addition to) prose. In Anthropic's API this is a `tool_use` content block:

   ```json
   {"type": "tool_use", "id": "toolu_123", "name": "read_file",
    "input": {"path": "/src/main.py"}}
   ```

   The API signals `stop_reason: "tool_use"` — meaning "I'm pausing; I want this
   executed."

3. The **client program** — not the model — validates the input against the schema,
   actually reads the file, and sends a new user-role message containing a
   `tool_result` block with the file's contents (and the matching `id` so the model
   knows which call it answers).

4. The model is called again with the grown transcript, sees the result, and continues —
   possibly emitting more tool calls, possibly answering in prose.

Three things to burn into memory:

- **The model never executes anything.** It *requests*. A boring, deterministic program
  executes. This is why permission systems are even possible: the harness sits between
  intent and effect.
- **Tool calls and results are just messages.** They occupy context-window space like
  any other text. A tool that returns a 50,000-line log file just ate a huge chunk of
  the agent's brain.
- **The model learned this protocol during training** (Chapter 7 covers how). Tool use
  is not a bolt-on parser trick in modern models; the model was trained on millions of
  examples of emitting well-formed calls, reading results, recovering from errors, and
  chaining calls toward goals.

## 1.3 The third layer: the agent loop

An **agent** is what you get when you wrap tool use in a loop and give the model a goal
instead of a question:

```
transcript = [system_prompt, user_goal]
loop:
    response = LLM(transcript, tools)
    transcript += response
    if response contains tool calls:
        for each call:
            result = execute(call)          # the environment responds
            transcript += tool_result(result)
        continue                            # go around again
    else:
        break                               # model produced a final answer
```

That's it. That is the entire secret. Claude Code, at its core, is this loop plus a
great deal of engineering around each line of it.

This loop implements the classic agent abstraction from AI textbooks — an entity that
perceives an **environment** through **observations** and acts on it through
**actions**, in pursuit of a **goal**:

| Classic agent concept | LLM-agent realization |
|---|---|
| Environment | Your filesystem, shell, git repo, the internet, APIs |
| Action space | The set of tools exposed to the model |
| Observation | Tool results appended to the transcript |
| State / memory | The context window (plus external files it chooses to write) |
| Policy (decides next action) | The LLM itself, conditioned on the whole transcript |
| Goal | The user's prompt + system prompt |

### Reasoning and acting are interleaved

Early research framed this as **ReAct** ("Reason + Act"): the model alternates between
thinking in natural language ("the test failed with ImportError, so the module path must
be wrong; let me check the package layout") and acting (calling a tool). Modern models do
this natively, often with an explicit *thinking* phase (extended thinking / chain of
thought) before each action. The reasoning text serves two purposes:

- It improves decision quality — verbalizing intermediate steps is effectively extra
  computation the model spends on the problem.
- It leaves a trail in the transcript that conditions future steps, functioning as
  working memory ("I already checked X, it wasn't the cause").

### What makes agents hard

The loop is trivial; making it *work* is not. The recurring engineering problems, all of
which Claude Code has specific machinery for:

1. **Context exhaustion.** Every action and observation grows the transcript. Long tasks
   overflow the window. → Compaction, subagents, careful tool-output truncation
   (Chapter 3).
2. **Error recovery.** Tools fail; commands error; edits don't apply. The agent must
   read the failure and adapt rather than loop on the same broken call. This is largely
   a model-quality property, trained via RL (Chapter 7).
3. **Grounding / hallucination.** The model may "remember" an API that doesn't exist in
   your codebase. Agents fix this by *checking* — reading real files before editing
   them. A good agent verifies claims against the environment instead of trusting its
   priors.
4. **Safety and control.** An agent with shell access can delete files or exfiltrate
   secrets. → Permission systems, sandboxes, allow/deny rules, human-in-the-loop
   prompts (Chapter 2).
5. **Planning over long horizons.** Multi-hour tasks need decomposition, progress
   tracking, and the discipline not to wander. → Todo/task lists, plan modes,
   checkpoint files.

### What an agent is *not*

- **Not a persistent mind.** When the session ends, nothing survives unless it was
  written to disk. Memory is an engineered feature (files re-read at startup), not an
  intrinsic one.
- **Not a workflow engine.** A pipeline with hardcoded steps ("call the summarizer,
  then the classifier") is automation, not agency. The defining property of an agent is
  that the *model chooses the next action* based on what it just observed. The control
  flow is data-dependent and open-ended.
- **Not guaranteed to be correct.** The loop amplifies capability and error alike. An
  agent that verifies its own work (running tests, re-reading diffs) converts model
  fallibility into reliability — which is why "give the agent a feedback signal" is the
  single highest-leverage design principle in this whole field.

## 1.4 The harness: the other half of the system

Everything wrapped around the model deserves a name: the **harness** (also "scaffold" or
"agent runtime"). Claude Code is a harness. Its responsibilities:

- Assemble the system prompt (instructions, environment info, memory files)
- Declare tools and **execute** the model's tool calls against the real world
- Enforce **permissions** — decide which calls run automatically, which ask the user,
  which are refused
- Manage the **context budget** — truncate huge tool outputs, compact old history
- Handle the session lifecycle — streaming output to the UI, interrupts, resumption
- Provide extension points — user-defined tools (MCP), hooks, custom subagents

A useful mental split: **the model supplies judgment; the harness supplies hands, eyes,
guardrails, and a filing system.** The same model in a better harness is a dramatically
better agent, and vice versa. When Claude Code behaves in some particular way, always
ask: is this the model's behavior, or the harness's? The next chapter dissects the
harness.
