"""Part 6 - dissecting the real GPT-2 (124M).

Cash every check written in Parts 3-5 against the actual checkpoint:
  act 1: the state dict -- every tensor named, mapped to its chapter
  act 2: tokenization (BPE) in the wild
  act 3: one forward pass, shapes narrated
  act 4: the next-token distribution for a prompt
  act 5: real attention maps -> ../diagrams/gpt2-attention-heads.png
  act 6: embedding geometry: nearest neighbors in wte
  act 7: generation: greedy vs temperature vs top-k vs top-p
  act 8 (optional): --finetune yourfile.txt

Needs:  pip install transformers   (first run downloads ~500 MB, cached)
Run:    python 07_gpt2_explore.py
        python 07_gpt2_explore.py --finetune mytext.txt --steps 200
"""

import argparse
import os

import torch
import torch.nn.functional as F

ap = argparse.ArgumentParser()
ap.add_argument("--finetune", type=str, default=None)
ap.add_argument("--steps", type=int, default=200)
ap.add_argument("--skip-plots", action="store_true")
args = ap.parse_args()

from transformers import GPT2LMHeadModel, GPT2TokenizerFast

tok = GPT2TokenizerFast.from_pretrained("gpt2")
model = GPT2LMHeadModel.from_pretrained("gpt2", attn_implementation="eager")
model.eval()
torch.manual_seed(0)


def banner(s):
    print("\n" + "=" * 72 + f"\n{s}\n" + "=" * 72)


# ========================================================================
banner("act 1: the state dict -- it is exactly the Part 3-5 architecture")
# ========================================================================
total = 0
for name, t in model.state_dict().items():
    if name.startswith("transformer.h.") and not name.startswith("transformer.h.0."):
        continue  # blocks 1..11 are identical in shape to block 0
    print(f"  {name:44s} {str(tuple(t.shape)):>16s}")
    total += t.numel()
print("  ... (blocks h.1 - h.11 have the same shapes as h.0)")
# count each storage once: lm_head shares its tensor with wte (tying, 5.5)
seen, real_total = set(), 0
for t in model.parameters():
    if t.data_ptr() not in seen:
        seen.add(t.data_ptr())
        real_total += t.numel()
tied = model.lm_head.weight.data_ptr() == model.transformer.wte.weight.data_ptr()
print(f"\ntotal parameters: {real_total/1e6:.1f}M   "
      f"(lm_head tied to wte: {tied})")

# the audit from exercise 5.7, in code:
d, V, Tmax, L = 768, 50257, 1024, 12
emb = V * d + Tmax * d
attn = L * (d * 3 * d + 3 * d + d * d + d)         # fused qkv + proj, with biases
mlp = L * (d * 4 * d + 4 * d + 4 * d * d + d)      # up + down, with biases
ln = L * 2 * 2 * d + 2 * d                          # 2 LN per block + final
print(f"paper audit : emb {emb/1e6:.1f}M + attn {attn/1e6:.1f}M + "
      f"mlp {mlp/1e6:.1f}M + ln {ln/1e6:.2f}M = {(emb+attn+mlp+ln)/1e6:.1f}M")

# ========================================================================
banner("act 2: BPE tokenization in the wild (3.1)")
# ========================================================================
for s in ["The transformer architecture",
          "The Transformer architecture",
          "unbelievable antidisestablishmentarianism"]:
    ids = tok(s)["input_ids"]
    print(f"  {s!r}\n    -> {ids}\n    -> {[tok.decode([i]) for i in ids]}")

# ========================================================================
banner("act 3: one forward pass, shapes narrated (Shift 1)")
# ========================================================================
prompt = "The capital of France is"
ids = tok(prompt, return_tensors="pt")["input_ids"]
print(f"  ids                  : {tuple(ids.shape)}   {ids.tolist()[0]}")
with torch.no_grad():
    out = model(ids, output_hidden_states=True, output_attentions=True)
print(f"  embedding output     : {tuple(out.hidden_states[0].shape)}   (B, T, 768)")
print(f"  after block 6        : {tuple(out.hidden_states[6].shape)}   same shape -- the residual stream")
print(f"  after block 12       : {tuple(out.hidden_states[12].shape)}")
print(f"  logits               : {tuple(out.logits.shape)}   (B, T, 50257)")
print(f"  attentions, per layer: {tuple(out.attentions[0].shape)}   (B, 12 heads, T, T)")
a = out.attentions[0][0, 0]
print(f"  attention rows sum to 1: {a.sum(-1).tolist()}")
print(f"  strictly causal (upper triangle all zero): "
      f"{bool(torch.allclose(a.triu(1), torch.zeros_like(a)))}")

# ========================================================================
banner("act 4: the next-token distribution (1.5 meets 5.6)")
# ========================================================================
probs = F.softmax(out.logits[0, -1], dim=-1)
top = torch.topk(probs, 10)
print(f"  after {prompt!r}:")
for pr, i in zip(top.values, top.indices):
    print(f"    {tok.decode([i])!r:>12s}  p = {pr.item():.3f}  {'#' * int(pr * 60)}")

# ========================================================================
banner("act 5: real attention heads on an ambiguous 'it'")
# ========================================================================
sent = "The cat sat on the mat because it was tired"
ids2 = tok(sent, return_tensors="pt")["input_ids"]
toks2 = [tok.decode([i]) for i in ids2[0]]
with torch.no_grad():
    att = model(ids2, output_attentions=True).attentions  # 12 x (1,12,T,T)
it_pos = toks2.index(" it")
cat_pos = toks2.index(" cat")
print(f"  tokens: {toks2}")
print(f"  attention mass  ' it' -> ' cat', best heads:")
scores = [(l, h, att[l][0, h, it_pos, cat_pos].item())
          for l in range(12) for h in range(12)]
for l, h, s in sorted(scores, key=lambda x: -x[2])[:5]:
    print(f"    layer {l:2d} head {h:2d}: {s:.2f}")

if not args.skip_plots:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    best = sorted(scores, key=lambda x: -x[2])[0]
    show = [(0, 3, "a lower-layer head (L0 H3):\nmostly local/diagonal"),
            (4, 11, "a 'previous token' head (L4 H11):\nthe specialization of section 4.6"),
            (best[0], best[1],
             f"best 'it -> cat' head (L{best[0]} H{best[1]}):\ncoreference, learned")]
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.6))
    for ax, (l, h, title) in zip(axes, show):
        m = att[l][0, h].numpy()
        ax.imshow(m, cmap="Blues", vmin=0, vmax=1)
        ax.set_xticks(range(len(toks2))); ax.set_yticks(range(len(toks2)))
        ax.set_xticklabels(toks2, rotation=90, fontsize=7)
        ax.set_yticklabels(toks2, fontsize=7)
        ax.set_title(f"{title}", fontsize=10)
    fig.suptitle(f"real GPT-2 attention, sentence: {sent!r}")
    fig.tight_layout()
    outp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                        "diagrams", "gpt2-attention-heads.png")
    fig.savefig(outp, dpi=120)
    print(f"  saved {os.path.normpath(outp)}")

# ========================================================================
banner("act 6: embedding geometry in the real wte (3.4)")
# ========================================================================
E = model.transformer.wte.weight.detach()
E_norm = F.normalize(E, dim=1)


def neighbors(word, k=8):
    i = tok(word)["input_ids"][0]
    sims = E_norm @ E_norm[i]
    top = torch.topk(sims, k + 1)
    return [(tok.decode([j]), f"{s.item():.2f}")
            for s, j in zip(top.values[1:], top.indices[1:])]


for w in [" cat", " king", " Paris", " seven"]:
    print(f"  {w!r:>8s} ~ {neighbors(w)}")

# ========================================================================
banner("act 7: the sampling knobs, same prompt (5.7)")
# ========================================================================
prompt = "Once upon a time, in a small village,"
ids3 = tok(prompt, return_tensors="pt")["input_ids"]
settings = [
    dict(do_sample=False, name="greedy"),
    dict(do_sample=True, temperature=0.7, top_k=0, top_p=1.0, name="temp 0.7"),
    dict(do_sample=True, temperature=1.0, top_k=40, top_p=1.0, name="top-k 40"),
    dict(do_sample=True, temperature=1.0, top_k=0, top_p=0.9, name="top-p 0.9"),
]
for s in settings:
    name = s.pop("name")
    with torch.no_grad():
        g = model.generate(ids3, max_new_tokens=40,
                           pad_token_id=tok.eos_token_id, **s)
    print(f"\n  [{name}]\n  {tok.decode(g[0])}")

# ========================================================================
if args.finetune:
    banner(f"act 8: fine-tuning on {args.finetune} (exercise 6.6)")
    # It is the five-line loop from 1.8, one last time.
    text = open(args.finetune, encoding="utf-8").read()
    ids = torch.tensor(tok(text)["input_ids"])
    T = 256
    opt = torch.optim.AdamW(model.parameters(), lr=3e-5)
    model.train()
    for step in range(args.steps):
        ix = torch.randint(len(ids) - T - 1, (4,))
        x = torch.stack([ids[i:i + T] for i in ix])
        y = torch.stack([ids[i + 1:i + T + 1] for i in ix])
        opt.zero_grad()
        loss = model(x, labels=y).loss   # HF shifts labels internally
        loss.backward()
        opt.step()
        if step % 20 == 0:
            print(f"  step {step:4d}  loss {loss.item():.3f}")
    model.eval()
    with torch.no_grad():
        g = model.generate(ids3, max_new_tokens=60, do_sample=True,
                           temperature=0.8, pad_token_id=tok.eos_token_id)
    print("\n  after fine-tuning:\n  " + tok.decode(g[0]))
