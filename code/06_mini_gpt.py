"""Part 5 - a complete, trainable GPT in ~200 readable lines.

Every box of the decoder-only architecture diagram, written out by hand:
token + position embeddings, pre-LN blocks with causal multi-head
self-attention and a 4x MLP, weight-tied LM head, next-token cross-entropy,
autoregressive generation with temperature and top-k. No nn.Transformer,
no black boxes. Character-level tokenizer so the model is the whole story.

Trained on Shakespeare (data/tinyshakespeare.txt, public domain). Defaults
are laptop-CPU-sized; watch the samples go from noise to word-shaped to
English-shaped as the loss falls.

Run:   python 06_mini_gpt.py                  (~10 min CPU)
       python 06_mini_gpt.py --steps 500      (quick smoke test, ~2 min)
       python 06_mini_gpt.py --colab          (bigger model, needs a GPU)
This file is a spiritual child of Karpathy's nanoGPT, shrunk for reading.
"""

import argparse
import math
import os
import time

import torch
import torch.nn as nn
import torch.nn.functional as F

# ----------------------------------------------------------- configuration
p = argparse.ArgumentParser()
p.add_argument("--steps", type=int, default=3000)
p.add_argument("--colab", action="store_true", help="bigger model for GPU")
p.add_argument("--speak", action="store_true", help="report perplexity too")
args = p.parse_args()

if args.colab:  # a size that shows visibly better text on a free Colab GPU
    n_layer, n_head, d, T = 6, 6, 384, 256
    batch_size, lr, steps = 64, 3e-4, max(args.steps, 5000)
else:           # CPU-friendly: ~0.8M parameters
    n_layer, n_head, d, T = 4, 4, 128, 64
    batch_size, lr, steps = 32, 1e-3, args.steps

device = "cuda" if torch.cuda.is_available() else "cpu"
torch.manual_seed(1337)
print(f"device={device}  layers={n_layer} heads={n_head} d={d} context={T}")

# ------------------------------------------------------------------- data
# Character-level tokenizer: the vocabulary is simply every distinct
# character in the corpus. Real GPT uses BPE (Part 3, 3.1); characters let
# us skip that machinery so the MODEL is the entire story.
here = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(here, "..", "data", "tinyshakespeare.txt")
if not os.path.exists(path):  # e.g. running standalone on Colab
    import urllib.request
    url = ("https://raw.githubusercontent.com/karpathy/char-rnn/"
           "master/data/tinyshakespeare/input.txt")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    urllib.request.urlretrieve(url, path)
text = open(path, encoding="utf-8").read()
chars = sorted(set(text))
V = len(chars)
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for i, c in enumerate(chars)}
encode = lambda s: [stoi[c] for c in s]
decode = lambda ids: "".join(itos[int(i)] for i in ids)
print(f"corpus: {len(text):,} chars, vocab of {V} characters")

data = torch.tensor(encode(text), dtype=torch.long)
n_val = len(data) // 10
train_data, val_data = data[:-n_val], data[-n_val:]


def get_batch(split):
    """Random (input, target) chunks. target = input shifted one left:
    every position is a training example (section 5.6)."""
    src = train_data if split == "train" else val_data
    ix = torch.randint(len(src) - T - 1, (batch_size,))
    x = torch.stack([src[i:i + T] for i in ix])
    y = torch.stack([src[i + 1:i + T + 1] for i in ix])
    return x.to(device), y.to(device)


# ------------------------------------------------------------------ model
class CausalSelfAttention(nn.Module):
    """Multi-head masked self-attention (Part 4), the reshape version."""

    def __init__(self):
        super().__init__()
        assert d % n_head == 0
        self.qkv = nn.Linear(d, 3 * d)       # fused W_Q, W_K, W_V (like GPT-2)
        self.proj = nn.Linear(d, d)          # W_O, the output projection
        # the causal mask is a constant, not a parameter -> register_buffer
        self.register_buffer("mask", torch.tril(torch.ones(T, T)).view(1, 1, T, T))

    def forward(self, x):
        B, t, _ = x.shape
        d_head = d // n_head
        q, k, v = self.qkv(x).split(d, dim=2)             # each (B, t, d)
        # split heads: (B, t, d) -> (B, n_head, t, d_head)
        q = q.view(B, t, n_head, d_head).transpose(1, 2)
        k = k.view(B, t, n_head, d_head).transpose(1, 2)
        v = v.view(B, t, n_head, d_head).transpose(1, 2)
        att = (q @ k.transpose(-2, -1)) / math.sqrt(d_head)   # (B, h, t, t)
        att = att.masked_fill(self.mask[:, :, :t, :t] == 0, float("-inf"))
        att = F.softmax(att, dim=-1)
        out = att @ v                                          # (B, h, t, d_head)
        out = out.transpose(1, 2).contiguous().view(B, t, d)   # concat heads
        return self.proj(out)


class MLP(nn.Module):
    """The feed-forward block: the Part-1 MLP, applied per token (5.4)."""

    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(d, 4 * d), nn.GELU(), nn.Linear(4 * d, d))

    def forward(self, x):
        return self.net(x)


class Block(nn.Module):
    """One transformer block, pre-LN like GPT-2 (5.3):
    communicate (attention), then compute (MLP), each added to the
    residual stream (5.2)."""

    def __init__(self):
        super().__init__()
        self.ln1 = nn.LayerNorm(d)
        self.attn = CausalSelfAttention()
        self.ln2 = nn.LayerNorm(d)
        self.mlp = MLP()

    def forward(self, x):
        x = x + self.attn(self.ln1(x))   # tokens exchange information
        x = x + self.mlp(self.ln2(x))    # each token digests, independently
        return x


class MiniGPT(nn.Module):
    def __init__(self):
        super().__init__()
        self.tok_emb = nn.Embedding(V, d)        # E: (V, d)      Part 3
        self.pos_emb = nn.Embedding(T, d)        # P: (T_max, d)  Part 3, 3.5
        self.blocks = nn.ModuleList(Block() for _ in range(n_layer))
        self.ln_f = nn.LayerNorm(d)              # final LN       5.5
        self.lm_head = nn.Linear(d, V, bias=False)
        self.lm_head.weight = self.tok_emb.weight  # WEIGHT TYING  5.5
        self.apply(self._init)

    @staticmethod
    def _init(m):
        # GPT-2's init: small weights (std 0.02) keep initial logits small,
        # so the untrained model starts honestly uncertain: loss ~ log(V)
        # (exercise 5.2). PyTorch defaults would start it confidently wrong.
        if isinstance(m, (nn.Linear, nn.Embedding)):
            nn.init.normal_(m.weight, mean=0.0, std=0.02)
            if isinstance(m, nn.Linear) and m.bias is not None:
                nn.init.zeros_(m.bias)

    def forward(self, idx, targets=None):
        B, t = idx.shape
        pos = torch.arange(t, device=idx.device)
        x = self.tok_emb(idx) + self.pos_emb(pos)   # (B, t, d)
        for block in self.blocks:
            x = block(x)                             # (B, t, d) every time
        x = self.ln_f(x)
        logits = self.lm_head(x)                     # (B, t, V)
        loss = None
        if targets is not None:
            # cross-entropy at EVERY position at once (5.6) -- the same
            # -log p_correct as the digit classifier, V-way.
            loss = F.cross_entropy(logits.view(-1, V), targets.view(-1))
        return logits, loss

    @torch.no_grad()
    def generate(self, idx, max_new, temperature=0.8, top_k=40):
        """The autoregressive loop (5.7). Naive version, no KV cache:
        exercise 5.6 asks you to add one."""
        self.eval()
        for _ in range(max_new):
            idx_cond = idx[:, -T:]                # crop to the context size
            logits, _ = self(idx_cond)
            logits = logits[:, -1, :] / temperature   # last position only
            if top_k is not None:
                kth = torch.topk(logits, top_k).values[:, [-1]]
                logits[logits < kth] = float("-inf")
            probs = F.softmax(logits, dim=-1)
            idx = torch.cat([idx, torch.multinomial(probs, 1)], dim=1)
        self.train()
        return idx


model = MiniGPT().to(device)
n_params = sum(p.numel() for p in model.parameters())
print(f"parameters: {n_params/1e6:.2f}M")
print(f"loss at init should be ~ -log(1/V) = {math.log(V):.2f} (exercise 5.2)")

optimizer = torch.optim.AdamW(model.parameters(), lr=lr)


@torch.no_grad()
def val_loss(iters=20):
    model.eval()
    losses = [model(*get_batch("val"))[1].item() for _ in range(iters)]
    model.train()
    return sum(losses) / len(losses)


# --------------------------------------------------------------- training
# THE loop from section 1.8. Unchanged since XOR. That is the point.
start = time.time()
for step in range(steps + 1):
    xb, yb = get_batch("train")
    optimizer.zero_grad()
    _, loss = model(xb, yb)
    loss.backward()
    optimizer.step()

    if step % 500 == 0:
        vl = val_loss()
        msg = (f"step {step:5d}  train {loss.item():.3f}  val {vl:.3f}  "
               f"({time.time()-start:.0f}s)")
        if args.speak:
            msg += f"  = as confused as choosing among {math.exp(vl):.1f} chars"
        print(msg)
        ctx = torch.zeros((1, 1), dtype=torch.long, device=device)  # "\n"
        sample = decode(model.generate(ctx, 120)[0])
        print("--- sample " + "-" * 50)
        print(sample)
        print("-" * 61)

print("\nfinal 400-character sample (temperature 0.8, top-k 40):")
ctx = torch.zeros((1, 1), dtype=torch.long, device=device)
print(decode(model.generate(ctx, 400)[0]))
