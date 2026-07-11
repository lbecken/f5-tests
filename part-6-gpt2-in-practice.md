# Part 6 — GPT-2 in Practice: Dissecting the Real Thing

> **Goal of this chapter.** Cash every check written in Parts 3–5 against a
> real model. We load the actual GPT-2 (124M) weights, verify with our own
> eyes that they are exactly the tensors we've been describing, watch real
> attention heads at work on real sentences, and generate text with all the
> sampling knobs. This is the shortest chapter, because — this is the
> point — **there is nothing new left to explain.**

---

## 6.1 Getting the model

```python
from transformers import GPT2LMHeadModel, GPT2Tokenizer
tok   = GPT2Tokenizer.from_pretrained("gpt2")     # the BPE from §3.1
model = GPT2LMHeadModel.from_pretrained("gpt2")   # 124M params, ~500 MB download
```

The Hugging Face `transformers` library is the standard way to obtain
pretrained checkpoints. Treat it as a *weights delivery service*: the
architecture inside is the one from Part 5, and we will prove that rather
than assume it. (On Colab it's preinstalled; the download is cached in
`~/.cache/huggingface`.)

## 6.2 The audit — matching every tensor to a chapter

`code/07_gpt2_explore.py` starts by printing the model's **state dict** —
every parameter tensor, name and shape. Annotated excerpt (the full 148-row
version comes from the script; `h.0` … `h.11` are the 12 blocks):

| tensor | shape | that's… |
|---|---|---|
| `wte.weight` | (50257, 768) | token embedding table `E` — §3.3 |
| `wpe.weight` | (1024, 768) | learned position table `P` — §3.5 |
| `h.0.ln_1.weight/.bias` | (768,) | pre-attention LayerNorm γ, β — §5.3 |
| `h.0.attn.c_attn.weight` | (768, 2304) | `W_Q,W_K,W_V` fused: 2304 = 3×768 — §4.3 |
| `h.0.attn.c_proj.weight` | (768, 768) | output projection `W_O` — §4.6 |
| `h.0.ln_2.weight/.bias` | (768,) | pre-MLP LayerNorm — §5.3 |
| `h.0.mlp.c_fc.weight` | (768, 3072) | MLP up-projection `W₁`: 4×768 — §5.4 |
| `h.0.mlp.c_proj.weight` | (3072, 768) | MLP down-projection `W₂` — §5.4 |
| `ln_f.weight/.bias` | (768,) | final LayerNorm — §5.5 |
| `lm_head.weight` | (50257, 768) | …the same storage as `wte.weight`: **tied** — §5.5 |

The script sums it all and prints the audit from Exercise 5.7 next to the
real counts. When your paper arithmetic matches a 124,439,808-parameter
checkpoint tensor for tensor, the architecture is *yours*.

Two GPT-2 trivia the audit surfaces (so they don't confuse you elsewhere):
the original TF code used `Conv1D` naming for what are plain `Linear`
layers (hence transposed-looking shapes), and Q,K,V are computed as **one**
fused 768→2304 matmul then split — an efficiency detail, mathematically
identical to three matrices.

## 6.3 Watching the machine think

The script then walks through, printing everything:

1. **Tokenization** (§3.1): `"The transformer architecture"` →
   `[464, 47385, 10959]` → note `" transformer"` with leading space is one
   token while `"Transformer"` splits; BPE quirks in the wild.
2. **One forward pass, shapes narrated**: `(1, T)` ids → `(1, T, 768)`
   stream → 12 blocks, same shape in and out (Shift 1!) → `(1, T, 50257)`
   logits.
3. **Next-token distribution**: top-10 continuations of "The capital of
   France is" with probabilities — cross-entropy's `p_correct` (§1.5) made
   tangible.
4. **Real attention maps** (`output_attentions=True`): attention tensors
   are `(1, 12 heads, T, T)`, lower-triangular (the mask! §4.5). For
   "The cat sat on the mat because it was tired", the script renders
   selected heads to `diagrams/gpt2-attention-heads.png` — go find which
   head routes `it` → `cat`/`mat` (Exercise 2.4, answered by a real model),
   plus a previous-token head and a first-token "sink" head (Exercise 4.3).
5. **Embedding geometry** (§3.4): nearest neighbors of ` cat`, ` king`,
   ` Paris` in `wte` by cosine similarity — trained-for-real versions of
   the toy clusters from `04_embeddings_toy.py`.
6. **Generation** with greedy / temperature / top-k / top-p side by side
   (§5.7), same prompt, so the knobs' personalities are directly
   comparable.

## 6.4 Where to go next

You now hold the full stack: neuron → backprop → embedding → attention →
GPT. Natural continuations, in rough order:

- **Karpathy, now with full comprehension**: the *Zero to Hero* series
  (especially "Let's build GPT from scratch" — you have effectively done
  it, his micrograd/makemore episodes fill in delicious details) and
  [nanoGPT](https://github.com/karpathy/nanoGPT) — read `model.py`
  line-by-line against Part 5; then `train.py`'s pragmatics (mixed
  precision, gradient accumulation, schedules) are the production layer
  this course deliberately skipped. His
  [`llm.c`](https://github.com/karpathy/llm.c) re-does it in raw C/CUDA.
- **Fine-tuning**: [Part 7](part-7-fine-tuning.md) does it properly —
  full, frozen-layers, and LoRA from scratch — and [Part 8](part-8-kv-cache.md)
  follows with the KV cache that makes generation fast.
- **The modern deltas** (each a bounded read now): RoPE (§3.5), GQA (§4.7),
  RMSNorm & SwiGLU (§5.3–5.4 variants), mixture-of-experts (many MLPs, a
  learned router), RLHF/instruction tuning (§5.9's history note).
- **Interpretability**: the residual-stream view (§5.2) is your entry
  point — look up "logit lens", then Anthropic's *A Mathematical Framework
  for Transformer Circuits* and induction heads.

## 6.5 Exercises

**6.1** Close the loop on Exercise 3.3/5.7: from the printed state dict,
compute what fraction of the 124M parameters are (a) embeddings,
(b) attention, (c) MLPs, (d) LayerNorms. (Expect roughly: MLPs ≈ 57M,
attention ≈ 28M, embeddings ≈ 39M shared with the head, LN ≈ peanuts.)

**6.2** Verify the tie: `model.lm_head.weight.data_ptr() ==
model.transformer.wte.weight.data_ptr()`. Then compute the top-10 nearest
tokens to `wte[" queen"]` and check whether `king − man + woman` lands
near ` queen` in *real* GPT-2 space. (Result is fuzzier than the word2vec
legend — report what you actually find.)

**6.3** Hunt heads: loop over all 12×12 heads on 20 sentences containing an
ambiguous "it"; score each head by attention mass from "it" to the correct
noun. Is coreference localized in a few heads or smeared? (You are doing
real interpretability research methodology at toy scale.)

**6.4** Measure GPT-2's perplexity (§5.6) on (a) a Wikipedia paragraph,
(b) your own English prose, (c) the same paragraph word-shuffled,
(d) Portuguese text. Rank first, then measure. What does (d) tell you about
the training data?

**6.5** Break the mask: feed "My password is hunter2. My password is" and
inspect the top-5 next-token predictions. Then explain precisely — using
§4.5 and §5.7 — why in-context *copying* like this is not a violation of
causal masking. (Bonus: this behavior is the "induction head" phenomenon.)

**6.6 (capstone)** Fine-tune GPT-2 on a text you like (a favorite author,
your own notes) for 200 steps on Colab GPU: `07_gpt2_explore.py --finetune
yourfile.txt`. Generate before/after samples from identical prompts.
Total new concepts required: zero. That is the punchline of the course.

---

→ [Part 7 — Fine-tuning](part-7-fine-tuning.md)
