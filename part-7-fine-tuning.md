# Part 7 — Fine-Tuning: Someone Else's θ Is the Best Initialization

> **Goal of this chapter.** Demystify fine-tuning the same way Part 3
> demystified embeddings: by showing there is **no new algorithm**. Then
> derive **LoRA** from first principles and run all of it on the real
> GPT-2 in `code/08_finetune_gpt2.py`, turning a Reddit-flavored model
> Shakespearean in 40 steps on a laptop CPU.

---

## 7.1 The one-sentence definition

Training (Part 1, §1.6) is: start from parameters θ, repeatedly step
downhill on a loss. Nothing in that sentence says θ must start as random
noise.

> **Fine-tuning is gradient descent whose starting point is a pretrained
> model's θ instead of random initialization.** Same loss (next-token
> cross-entropy, if you're adapting a language model), same backprop, same
> Adam, same five-line loop from §1.8. What changes is *where in the loss
> landscape you begin* — and therefore where you plausibly end up.

Why is the starting point so powerful? Pretraining on trillions of tokens
already paid for grammar, facts, style machinery, world regularities — all
encoded in the weights. Your fine-tuning data doesn't have to teach
English; it only has to *steer* an existing English-speaker. This is why a
few hundred steps on ~300k tokens of Shakespeare visibly changes the voice
of a model that took weeks of GPU time to pretrain, and why fine-tuning is
the practical entry point for anyone who doesn't own a datacenter.

## 7.2 What actually changes, and the two knobs that matter

**Knob 1 — learning rate: small.** Pretrained weights are *good*. Big
steps (pretraining-sized, ~1e-3ish for small models) would stomp all over
them; the standard full-fine-tune lr is ~10–100× smaller (3e-5 in our
script). Think of it as *nudging* 124M good numbers, not searching from
scratch.

**Knob 2 — how much you train: little.** The risks are the twin failure
modes:

- **Overfitting** — your fine-tuning set is tiny (ours: 338k tokens vs
  GPT-2's ~9B). Train long enough and the model memorizes it.
- **Catastrophic forgetting** — the gradients only care about the new
  data. Nothing in the loss defends the old capabilities, so they can be
  overwritten: fine-tune hard on Shakespeare and the model gets *worse* at
  being generic GPT-2. (Exercise 7.2 makes you measure this, not just
  believe it.) Mitigations in practice: few steps, small lr, mixing in
  general data, or — next section — not touching most weights at all.

## 7.3 Strategy 1 and 2: full fine-tuning, and freezing

**Full fine-tuning** (`--mode full`): every parameter gets `requires_grad`
and moves. Most capable, most expensive: you need optimizer states for all
124M parameters (Adam keeps 2 extra numbers per parameter — the memory
cost triples), and every fine-tuned variant you keep is a full ~500 MB
checkpoint.

**Freezing** (`--mode freeze`): set `requires_grad_(False)` on everything,
then re-enable just the top blocks (our script: the last 2 of 12, plus the
final LayerNorm). Rationale from Part 5's residual-stream picture: early
blocks build generic representations; late blocks make output-flavored
decisions — for a *style* adaptation, late is where the action is. This is
the classic transfer-learning recipe inherited from vision (train only the
head on new classes), and it's your first taste of **parameter-efficient
fine-tuning (PEFT)**: 14% of the parameters move, so optimizer memory
shrinks accordingly, and the frozen 86% cannot forget anything.

In code, the entire difference between all three modes is *which
parameters keep `requires_grad=True`*. The training loop is untouched.

## 7.4 Strategy 3: LoRA, derived from first principles

Now the modern workhorse. Reason it out:

1. Whatever full fine-tuning would do to a weight matrix `W` (say c_attn's
   768×2304), the result is `W + ΔW` — the *update* is itself a matrix of
   the same shape. Fine-tuning "is" finding ΔW.
2. **The bet:** for a narrow adaptation (one style, one domain, one task),
   the useful ΔW is far from arbitrary — it has **low rank**. Intuition: a
   rank-r matrix can only read from r directions and write to r directions
   (linear algebra: ΔW = A·B with `A: 768×r`, `B: r×2304`); the bet says a
   style shift only needs to adjust a handful of directions in the
   residual stream, not all 768. Nobody proved this; Hu et al. (2021)
   *measured* it — r as low as 1–8 captures most of the benefit.
3. So: **freeze W entirely; learn only A and B**; forward pass becomes
   `x·W + (x·A)·B · (α/r)` (α a fixed scaling). With r=8, that's 24K new
   numbers instead of 1.8M per matrix — our script trains **0.29M
   parameters, 0.24% of the model**.
4. Two crucial initializations: `A` small-random, **`B` zero** — so at
   step 0, ΔW = A·B = 0 and the model *is exactly pretrained GPT-2*.
   Training grows the update smoothly out of nothing.

What this buys, beyond memory:

- **Adapters are files, not models.** Our Shakespeare adapter is 1.2 MB;
  the base 500 MB checkpoint is shared by every adapter you ever train.
  Swap personalities by swapping A,B pairs; "uninstall" by deleting them —
  `W` was never touched. (At serving time you can even merge:
  `W ← W + AB·α/r`, zero inference overhead.)
- **Forgetting is bounded by construction** — 99.76% of the parameters
  are physically unable to change.
- On our CPU it was also ~9× faster per step than full fine-tuning
  (measured: ~1.3s vs ~12s), since gradients for frozen weights are never
  computed and Adam's state is tiny.

One honest caveat: LoRA is not magically equal to full fine-tuning; for
*large* behavioral changes (new language, new capabilities) full tuning
still wins. For style/domain/task adapters it is the default for good
reason.

## 7.5 The zoo above this chapter (naming, briefly)

You'll meet these terms immediately when reading further; place them now.
All of them are *objectives/data recipes* on top of the same architecture
and the same descent — none introduces new math you don't have:

- **Instruction tuning (SFT)** — fine-tune on (instruction → good
  response) pairs so "predict next token" becomes "answer the user". Loss:
  still next-token cross-entropy, usually masked to the response tokens.
- **RLHF / preference tuning** — humans rank outputs; a reward model
  learns the ranking; the LM is optimized against it (PPO), or more
  directly via **DPO** (2023), which turns preferences back into a simple
  cross-entropy-shaped loss. This is the step that turned GPT-3-class
  next-token predictors into assistants (InstructGPT/ChatGPT, 2022).
- **Continued pretraining** — same objective, new domain corpus, longer
  training: between pretraining and fine-tuning in spirit.

> **Historical note.** Transfer learning ("pretrain on ImageNet, fine-tune
> on your 2,000 X-rays") carried computer vision from 2014 on; NLP lacked
> the pretrained backbone until **ULMFiT** (Howard & Ruder, Jan 2018)
> showed a pretrained LSTM language model fine-tunes into a top text
> classifier — with discriminative lrs and gradual unfreezing (§7.3's
> ideas). **GPT-1** (June 2018) is literally titled *"Improving Language
> Understanding by Generative Pre-Training"* — the pretrain-then-finetune
> recipe *is* the GPT thesis — and **BERT** (Oct 2018) made it universal.
> Then models outgrew the recipe's costs: storing a full fine-tune per
> task stopped scaling, driving PEFT research — adapter layers (2019),
> prompt/prefix tuning (2021), and **LoRA** (Hu et al., 2021, at
> Microsoft), which won on simplicity + mergeability. **QLoRA** (2023)
> pushed it further: LoRA on top of a 4-bit-quantized frozen base, putting
> 65B-parameter fine-tuning on one GPU. Meanwhile OpenAI's **InstructGPT**
> (2022) added the RLHF stage — fine-tuning not on *more text* but on
> *human preferences* — completing the modern pipeline: pretrain → SFT →
> preference-tune.

## 7.6 The code — `code/08_finetune_gpt2.py`

One script, three strategies, chosen by `--mode full|freeze|lora`. It
prints a sample **before** training (pure GPT-2 voice), the loss/perplexity
trajectory, a sample **after**, and — in LoRA mode — the size of the
adapter it just "shipped". Representative CPU run (`--mode lora --steps
40`, ~1 minute of training):

```
BEFORE: "...There has to be a better way than making life-long decisions
         and not spending a long time feeling guilty about it..."
AFTER : "...I cannot do with my life, and do not think that any man am I;
         and, I should say, I do not want for me any more; but if I do,
         I will give you a little more room of liberty..."
```

Forty gradient steps, 0.24% of the parameters, and the model speaks in
iambic-flavored clauses. On a Colab GPU, run `--mode full --steps 300` and
compare all three modes properly (Exercise 7.1).

The LoRA implementation is deliberately from scratch (~25 lines,
`LoRALinear`) rather than via the `peft` library — read it; it is nothing
but §7.4 transcribed. One GPT-2 quirk it handles: HF stores these
projections as `Conv1D` with weight shape (in, out), so the update is
`x @ A @ B` with no transposes.

## 7.7 Exercises

**7.1** Run all three modes for the same number of steps (Colab: 200+).
Compare: final loss, wall-clock per step, peak memory
(`torch.cuda.max_memory_allocated()` on GPU), and — subjectively — sample
quality. Make the table; own the trade-off.

**7.2 (forgetting, measured)** Before fine-tuning, compute the loss on a
fixed paragraph of modern English (act 8's code shows how to get a loss
from `model(x, labels=x)`). Re-measure after 40, 200, 1000 LoRA steps and
after the same schedule of full fine-tuning. Plot both forgetting curves.
Which strategy degrades the base model faster, and why did §7.4 predict
that?

**7.3** In LoRA mode, print `model.transformer.h[0].attn.c_attn.B.abs().max()`
at step 0 and every 10 steps. Why must it start at exactly 0, and what
would break if `A` *and* `B` were both zero-initialized? *Hint: write the
gradient of the loss w.r.t. A when B = 0.*

**7.4** Sweep the LoRA rank: r = 1, 4, 8, 32 for a fixed 100 steps. Plot
final loss vs r and parameter count vs r. Where does the curve flatten?
You are reproducing Figure-quality evidence for the low-rank bet on your
own corpus.

**7.5** Our script adapts only `c_attn` (the QKV projection). Try instead:
(a) only the MLP `c_fc`, (b) both. Given §5.4's claim that MLPs store most
of the model's knowledge while attention routes it, which do you *predict*
matters more for a style adaptation — and what do you find?

**7.6 (capstone)** Fine-tune on your own corpus — your emails, your notes,
your favorite author (a few hundred KB of plain text is plenty). LoRA,
r=8, 200 steps on Colab. Then implement `--merge`: fold `A@B·α/r` into the
base weight, verify outputs are identical, and save a standalone
checkpoint. You now hold the complete modern adapter workflow.

→ [Part 8 — The KV cache](part-8-kv-cache.md)
