# Part 2 — From Neurons to Transformers: The Bridge

> **Goal of this chapter.** No new code yet — this is the conceptual chapter
> that resolves the feeling you described: *"it's all built from neural-net
> elements, but it feels like a different species."* We identify exactly
> **four mental shifts** that separate the classic MLP from the transformer.
> Everything in Parts 3–5 is one of these four shifts, worked out in detail.

---

## 2.1 You are right: it *is* all neural-net elements

Look at any transformer architecture diagram and inventory the boxes:

| Box in the diagram | What it actually is |
|---|---|
| Embedding | a matrix of learned weights (a `Linear` layer in disguise — Part 3) |
| Multi-Head Attention | a few `Linear` layers + softmax, arranged cleverly (Part 4) |
| Feed Forward | literally the MLP from Part 1: `Linear → nonlinearity → Linear` |
| Add & Norm | addition, and a normalization with two small learned vectors |
| Linear + Softmax (output) | the classifier head from your digit recognizer |

There is **no new mathematical ingredient**. Matrix multiplies, element-wise
nonlinearities, softmax, learned parameters, trained end-to-end with
cross-entropy + Adam + backprop — all of it from Part 1. Your instinct
("connected in more sophisticated ways?") is precisely correct. So the real
question is not *what* the parts are, but *why they are wired this way*.
The answer is: **because the input is a sequence.**

## 2.2 Why sequences break the classic MLP

Your digit MLP consumed **one fixed-size vector** (784 pixels) and emitted
**one answer**. Language does not fit that mold, for three stubborn reasons:

1. **Variable length.** Sentences have 3 words or 3,000. An MLP's first
   weight matrix has a fixed input width — there is no slot layout that fits
   all sentences.
2. **No sharing across positions.** Suppose you pad every sentence to 1,000
   words and concatenate. Now the weights that process word #1 are entirely
   different parameters from those that process word #2 — the network would
   have to *re-learn* what "dog" means at every position separately.
   Wasteful, and it generalizes terribly.
3. **Relationships are content-dependent, not position-dependent.** In
   "The cat that chased the mouse **was** hungry", the verb *was* must agree
   with *cat*, seven words away. Which earlier word matters is determined by
   *meaning*, not by a fixed offset. An MLP's connectivity is frozen at
   design time; it cannot "decide at runtime" to route information from
   position 2 to position 9 for this sentence but 5 → 9 for the next.

Keep these three failures in mind; the transformer is a point-by-point
answer to them.

## 2.3 The four mental shifts

### Shift 1 — The unit of processing is a *stream of vectors*, not one vector

An MLP transforms one vector through layers:
`vector → vector → vector → answer`.

A transformer transforms a **sequence of vectors in parallel**. If the input
is `T` tokens, then *every* layer consumes a `(T, d)` matrix — one row of
dimension `d` per token — and produces a new `(T, d)` matrix, same shape:

```
MLP:          (d,)   →  (d,)   →  (d,)    → answer
Transformer:  (T, d) →  (T, d) →  (T, d)  → T answers (one per position)
```

Picture `T` parallel conveyor belts, one per token, running through the
network side by side. Each token has its own vector being progressively
refined. This running `(T, d)` matrix is called the **residual stream** —
remember the name, it becomes central in Part 5.

### Shift 2 — Weight sharing: one network, applied at every position

Here is the resolution to failure #2, and maybe the single most clarifying
fact in this whole guide:

> **The same weights are applied to every token position.** The Feed-Forward
> block is *one* MLP (with one set of weights) that is run independently on
> each of the `T` token vectors. The attention block likewise uses one set
> of Q/K/V matrices for all positions.

Consequences: the model's parameter count is **independent of sequence
length** (failure #1 solved — the same transformer processes 3 tokens or
3,000); and what the network learns about "dog" is available wherever "dog"
appears (failure #2 solved). If you know convolutional networks: this is the
same weight-sharing trick that made CNNs win at vision, applied to sequences.

### Shift 3 — Attention: connectivity computed *from the data* at runtime

This is the genuinely new wiring idea — the one thing with no analogue in
your MLP experience, and the answer to failure #3.

In an MLP, *which* neurons influence which is fixed forever by the
architecture; only the *strengths* (weights) are learned. Attention makes
the connectivity itself **input-dependent**: for each token, the network
computes — fresh, for every input sequence — a set of scores saying "how
much should this token look at each other token?", then mixes token vectors
according to those scores.

The profound part: those scores are produced by (you guessed it) matrix
multiplies with learned weights. So attention is *a neural network deciding,
per input, how to wire a second network*. When processing "…the mouse
**was**…", the model can route *cat*'s vector into *was*'s position — for
that sentence — with weights on the routes summing to 1. Part 4 builds this
mechanism from scratch and it will turn out to be ~10 lines of code.

A slogan worth keeping:

> **MLP weights are fixed knowledge. Attention weights are computed on the
> fly.** `W` matrices store *what the model knows*; attention scores express
> *what this input needs right now*.

### Shift 4 — Depth means *alternating* two kinds of computation

An MLP alternates `Linear` and nonlinearity. A transformer alternates at a
coarser grain, stacking the same two-beat block dozens of times:

- **Attention** — tokens *communicate*: each position gathers information
  from other positions. (The only place where information crosses between
  the conveyor belts.)
- **Feed-Forward** — tokens *compute*: each position independently digests
  what it gathered, through a plain MLP.

Karpathy's summary is the best one: **attention is communication,
feed-forward is computation.** A 12-layer GPT is: communicate, compute,
communicate, compute… ×12. Each round lets tokens exchange more refined
information: early layers resolve local grammar; later layers, with many
rounds of gathering behind them, handle long-range meaning.

## 2.4 The decoder-only transformer at a glance

Here is the machine we will build across Parts 3–5 — the GPT variant you
asked about. Skim it now; by the end of Part 5 every box will be yours:

![Decoder-only architecture](diagrams/decoder-only-architecture.svg)

Reading bottom-up: token IDs → **embeddings** (+ positional information)
→ N× [**masked self-attention** → **feed-forward**, each wrapped in
residual-add & normalization] → a final **linear + softmax** producing, at
each position, a probability distribution over the next token.

And the punchline that connects it all the way back to Part 1: the training
objective of this whole tower is **cross-entropy on "predict the next
token"** — your digit classifier's loss, where the classes are ~50,000
vocabulary entries and the "image" is the text so far. A transformer is a
universal function approximator pointed at the function *"text so far ↦
distribution over the next token"*.

## 2.5 Encoder? Decoder? Decoder-only? (naming, briefly)

The 2017 paper introduced a two-tower machine for translation: an
**encoder** reads the source sentence (every token may look at every other —
bidirectional attention), a **decoder** writes the target sentence one token
at a time (each token may look only *backwards* — causal attention — plus
"cross-attention" glances at the encoder). The families that followed:

- **Encoder-only** (BERT, 2018): understanding tasks; sees whole text at once.
- **Decoder-only** (GPT, 2018 →): generation; causal attention only, no
  encoder, no cross-attention. *Strictly simpler than the full diagram* —
  when GPT papers say "transformer decoder" they mean the decoder tower with
  the cross-attention block deleted.
- **Encoder–decoder** (T5, original Transformer): translation/summarization.

Decoder-only won the scale race largely because its training signal is
embarrassingly abundant: *any* text trains it (predict each next token), no
labels, no paired data. We cover the attention-type distinctions properly in
Part 4.

> **Historical note — the road to 2017.** Before transformers, sequence
> models were **recurrent** (RNNs; LSTM, Hochreiter & Schmidhuber 1997):
> read tokens one at a time, left to right, squeezing everything seen so far
> into one fixed-size hidden vector. Two chronic ailments: long-range
> information faded (one vector is a narrow bottleneck), and the strict
> one-at-a-time recurrence could not exploit parallel hardware.
> **Attention** was invented by Bahdanau, Cho & Bengio (2014) as a *patch*
> for RNN translation — let the decoder peek back at all source words
> instead of relying on the bottleneck vector. It worked embarrassingly
> well. Three years later, Vaswani et al. asked the radical question in
> their title — *Attention Is All You Need* (2017): delete the recurrence
> entirely, keep only attention (plus MLPs). Trained in parallel across all
> positions, on GPUs, at scale. GPT-1 (2018), GPT-2 (2019), GPT-3 (2020)
> then showed that this architecture + more data + more parameters kept
> getting better — the "scaling" era you are living in.

## 2.6 Exercises (conceptual — no code)

**2.1** Your digit MLP had fixed connectivity. State, in one sentence each,
how the transformer answers the three failures of §2.2. (If you can do this
without re-reading, the bridge is built.)

**2.2** A friend says: "so a transformer is an MLP applied to each word,
plus a mixing step between words." What is right about this? What does it
leave out? (Two things: where the mixing weights come from, and what
ordering information requires — Part 3 spoils the second.)

**2.3** Why does weight-sharing across positions make it *necessary* to add
positional information to the input? *Hint: if the same function is applied
at every position, and attention scores depend only on token vectors, what
happens if you shuffle the input tokens?* (This is the setup for Part 3's
positional embeddings — try to predict the problem before reading it.)

**2.4** In "the cat sat on the mat because **it** was tired": which earlier
token should *it* attend to strongly? What about "...because **it** was
soft"? What does this pair tell you about why attention must be computed
from *content* rather than *position*?

→ [Part 3 — Embeddings](part-3-embeddings.md)
