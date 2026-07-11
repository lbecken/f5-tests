"""Part 7 - fine-tuning the real GPT-2, three ways.

Take the pretrained 124M checkpoint and push it toward Shakespeare with:

  --mode full     update all 124M parameters (the classic recipe)
  --mode freeze   update only the top 2 blocks + final LayerNorm
  --mode lora     LoRA, implemented from scratch in ~25 lines: freeze W,
                  learn a low-rank update  W + (alpha/r) * A @ B

In every mode the training loop is the five lines from Part 1, section 1.8.
Fine-tuning is not a new algorithm -- it is the same gradient descent,
starting from someone else's theta instead of random noise.

Run:   python 08_finetune_gpt2.py --mode lora --steps 40      (~10 min CPU)
       python 08_finetune_gpt2.py --mode full --steps 300     (Colab GPU)
Compare the before/after samples that the script prints.
"""

import argparse
import math
import time

import torch
import torch.nn as nn

ap = argparse.ArgumentParser()
ap.add_argument("--mode", choices=["full", "freeze", "lora"], default="lora")
ap.add_argument("--steps", type=int, default=40)
ap.add_argument("--batch", type=int, default=4)
ap.add_argument("--seq", type=int, default=128)
ap.add_argument("--lr", type=float, default=None)
ap.add_argument("--rank", type=int, default=8, help="LoRA rank r")
ap.add_argument("--data", type=str, default="../data/tinyshakespeare.txt")
args = ap.parse_args()

from transformers import GPT2LMHeadModel, GPT2TokenizerFast

device = "cuda" if torch.cuda.is_available() else "cpu"
torch.manual_seed(0)
tok = GPT2TokenizerFast.from_pretrained("gpt2")
model = GPT2LMHeadModel.from_pretrained("gpt2").to(device)

PROMPT = "What should I do with my life?"


def sample(label):
    model.eval()
    ids = tok(PROMPT, return_tensors="pt")["input_ids"].to(device)
    with torch.no_grad():
        out = model.generate(ids, max_new_tokens=60, do_sample=True,
                             temperature=0.8, top_k=40,
                             pad_token_id=tok.eos_token_id)
    print(f"\n[{label}]\n{tok.decode(out[0])}\n")
    model.train()


# ------------------------------------------------- the three strategies
class LoRALinear(nn.Module):
    """Wraps a frozen GPT-2 projection with a trainable low-rank update.

    First principles (7.4): a weight update found by fine-tuning is a
    matrix Delta-W of the same shape as W -- for c_attn, 768 x 2304 = 1.8M
    numbers. LoRA bets the useful part of Delta-W has low RANK: it can be
    written as A @ B with A (768, r) and B (r, 2304). With r=8 that is
    24K numbers -- a 72x saving -- and W itself never changes, so many
    adapters can share one frozen base model.

    Note: GPT-2 stores these projections as Conv1D with weight (in, out),
    so the forward is x @ W + b (no transpose).
    """

    def __init__(self, base, r, alpha=16):
        super().__init__()
        self.base = base                      # frozen Conv1D: weight (in, out)
        d_in, d_out = base.weight.shape
        self.A = nn.Parameter(torch.randn(d_in, r) * 0.01)  # small init
        self.B = nn.Parameter(torch.zeros(r, d_out))        # zero init =>
        self.scale = alpha / r                # update starts at exactly 0,
                                              # so step 0 IS pretrained GPT-2
    def forward(self, x):
        return self.base(x) + (x @ self.A @ self.B) * self.scale


if args.mode == "full":
    lr = args.lr or 3e-5          # low lr: we are NUDGING 124M good weights,
    for p in model.parameters():  # not searching from scratch (7.2)
        p.requires_grad_(True)
elif args.mode == "freeze":
    lr = args.lr or 1e-4
    for p in model.parameters():
        p.requires_grad_(False)
    for block in model.transformer.h[-2:]:   # top 2 of the 12 blocks
        for p in block.parameters():
            p.requires_grad_(True)
    for p in model.transformer.ln_f.parameters():
        p.requires_grad_(True)
else:  # lora
    lr = args.lr or 1e-3          # tiny adapters tolerate a bigger lr
    for p in model.parameters():
        p.requires_grad_(False)
    for block in model.transformer.h:        # adapt every attention c_attn
        block.attn.c_attn = LoRALinear(block.attn.c_attn, args.rank).to(device)

trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
total = sum(p.numel() for p in model.parameters())
print(f"mode={args.mode}  trainable {trainable/1e6:.2f}M of {total/1e6:.1f}M "
      f"parameters ({100*trainable/total:.2f}%)  lr={lr}")

# ------------------------------------------------------------------ data
text = open(args.data, encoding="utf-8").read()
ids = torch.tensor(tok(text)["input_ids"])
print(f"fine-tuning corpus: {len(ids):,} BPE tokens of Shakespeare")

T, B = args.seq, args.batch


def get_batch():
    ix = torch.randint(len(ids) - T - 1, (B,))
    return torch.stack([ids[i:i + T] for i in ix]).to(device)


sample("BEFORE fine-tuning: plain GPT-2")

# --------------------------------------------------------------- training
# The same five lines. Only requires_grad decides what moves.
opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad],
                        lr=lr)
start = time.time()
for step in range(args.steps + 1):
    x = get_batch()
    opt.zero_grad()
    loss = model(x, labels=x).loss   # HF shifts targets internally (5.6)
    loss.backward()
    opt.step()
    if step % 10 == 0:
        print(f"step {step:4d}  loss {loss.item():.3f}  "
              f"perplexity {math.exp(loss.item()):7.1f}  "
              f"({time.time()-start:.0f}s)")

sample(f"AFTER {args.steps} steps of {args.mode} fine-tuning")

if args.mode == "lora":
    adapter = {n: p for n, p in model.named_parameters() if p.requires_grad}
    size = sum(p.numel() for p in adapter.values()) * 4 / 1e6
    print(f"the entire 'fine-tune' fits in {len(adapter)} tensors, "
          f"{size:.1f} MB on disk (vs ~500 MB for a full checkpoint).")
    print("to 'uninstall' it, just delete A and B: W was never touched.")
