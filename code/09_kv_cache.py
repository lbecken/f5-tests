"""Part 8 - the KV cache, built, verified, and benchmarked.

Generation with a decoder-only model is naively O(T^2) PER TOKEN: every new
token re-runs the whole model over the whole context. But the causal mask
guarantees past tokens' keys and values can never change -- so cache them.

This script:
  1. trains a small character-level GPT (context 256) for a few minutes,
  2. implements generate_naive()  -- re-encode everything each step,
     and     generate_cached() -- feed ONLY the newest token, reuse K/V,
  3. PROVES they are equivalent: greedy decoding, token-for-token identical,
  4. benchmarks per-token latency and plots the curves,
  5. prints the cache-size arithmetic that rules real inference servers.

Output: ../diagrams/kv-cache-timing.png

Run:  python 09_kv_cache.py               (~8 min CPU: ~5 train + ~3 bench)
      python 09_kv_cache.py --steps 100   (quick smoke test)
"""

import argparse
import math
import os
import time

import torch
import torch.nn as nn
import torch.nn.functional as F

ap = argparse.ArgumentParser()
ap.add_argument("--steps", type=int, default=500)
ap.add_argument("--gen", type=int, default=250, help="tokens to generate in the benchmark")
args = ap.parse_args()

torch.manual_seed(1337)
device = "cuda" if torch.cuda.is_available() else "cpu"
n_layer, n_head, d, T_max = 4, 4, 128, 256
d_head = d // n_head

# ------------------------------------------------------------------- data
here = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(here, "..", "data", "tinyshakespeare.txt")
if not os.path.exists(path):
    import urllib.request
    os.makedirs(os.path.dirname(path), exist_ok=True)
    urllib.request.urlretrieve("https://raw.githubusercontent.com/karpathy/"
                               "char-rnn/master/data/tinyshakespeare/input.txt", path)
text = open(path, encoding="utf-8").read()
chars = sorted(set(text))
V = len(chars)
stoi = {c: i for i, c in enumerate(chars)}
decode = lambda ids: "".join(chars[int(i)] for i in ids)
data = torch.tensor([stoi[c] for c in text], dtype=torch.long)


# ------------------------------------------------------------------ model
# Same architecture as 06_mini_gpt.py, with ONE change: every forward can
# accept a `past` (the cache) and returns a `present` (the updated cache).
class CausalSelfAttention(nn.Module):
    def __init__(self):
        super().__init__()
        self.qkv = nn.Linear(d, 3 * d)
        self.proj = nn.Linear(d, d)

    def forward(self, x, past=None):
        B, t, _ = x.shape                       # t = tokens ARRIVING NOW
        q, k, v = self.qkv(x).split(d, dim=2)
        q = q.view(B, t, n_head, d_head).transpose(1, 2)   # (B, h, t, hd)
        k = k.view(B, t, n_head, d_head).transpose(1, 2)
        v = v.view(B, t, n_head, d_head).transpose(1, 2)

        if past is not None:
            pk, pv = past                       # (B, h, P, hd) each
            k = torch.cat([pk, k], dim=2)       # keys  = past + new
            v = torch.cat([pv, v], dim=2)       # values = past + new
        present = (k, v)                        # the cache, one layer's worth

        P = k.size(2) - t                       # how many cached positions
        att = (q @ k.transpose(-2, -1)) / math.sqrt(d_head)  # (B, h, t, P+t)
        # causal mask, cache-aware: arriving token i sits at global position
        # P+i and may see keys 0 .. P+i. When t == 1 (generation) this
        # allows everything -- no masking needed, the future doesn't exist.
        if t > 1:
            mask = torch.tril(torch.ones(t, P + t, device=x.device),
                              diagonal=P)
            att = att.masked_fill(mask == 0, float("-inf"))
        att = F.softmax(att, dim=-1)
        out = (att @ v).transpose(1, 2).contiguous().view(B, t, d)
        return self.proj(out), present


class Block(nn.Module):
    def __init__(self):
        super().__init__()
        self.ln1, self.ln2 = nn.LayerNorm(d), nn.LayerNorm(d)
        self.attn = CausalSelfAttention()
        self.mlp = nn.Sequential(nn.Linear(d, 4 * d), nn.GELU(),
                                 nn.Linear(4 * d, d))

    def forward(self, x, past=None):
        a, present = self.attn(self.ln1(x), past)
        x = x + a
        x = x + self.mlp(self.ln2(x))   # the MLP is per-token: nothing to cache!
        return x, present


class MiniGPT(nn.Module):
    def __init__(self):
        super().__init__()
        self.tok_emb = nn.Embedding(V, d)
        self.pos_emb = nn.Embedding(T_max, d)
        self.blocks = nn.ModuleList(Block() for _ in range(n_layer))
        self.ln_f = nn.LayerNorm(d)
        self.lm_head = nn.Linear(d, V, bias=False)
        self.lm_head.weight = self.tok_emb.weight
        self.apply(self._init)

    @staticmethod
    def _init(m):
        # GPT-2-style small init (see 06_mini_gpt.py and exercise 5.2)
        if isinstance(m, (nn.Linear, nn.Embedding)):
            nn.init.normal_(m.weight, mean=0.0, std=0.02)
            if isinstance(m, nn.Linear) and m.bias is not None:
                nn.init.zeros_(m.bias)

    def forward(self, idx, targets=None, pasts=None):
        B, t = idx.shape
        P = 0 if pasts is None else pasts[0][0].size(2)
        pos = torch.arange(P, P + t, device=idx.device)  # global positions!
        x = self.tok_emb(idx) + self.pos_emb(pos)
        presents = []
        for i, block in enumerate(self.blocks):
            x, present = block(x, None if pasts is None else pasts[i])
            presents.append(present)
        logits = self.lm_head(self.ln_f(x))
        loss = None
        if targets is not None:
            loss = F.cross_entropy(logits.view(-1, V), targets.view(-1))
        return logits, loss, presents


# --------------------------------------------------------------- training
model = MiniGPT().to(device)
print(f"model: {sum(p.numel() for p in model.parameters())/1e6:.2f}M params, "
      f"context {T_max}")
opt = torch.optim.AdamW(model.parameters(), lr=1e-3)
B = 12
start = time.time()
for step in range(args.steps + 1):
    ix = torch.randint(len(data) - T_max - 1, (B,))
    xb = torch.stack([data[i:i + T_max] for i in ix]).to(device)
    yb = torch.stack([data[i + 1:i + T_max + 1] for i in ix]).to(device)
    opt.zero_grad()
    _, loss, _ = model(xb, yb)
    loss.backward()
    opt.step()
    if step % 100 == 0:
        print(f"step {step:4d}  loss {loss.item():.3f}  ({time.time()-start:.0f}s)")
model.eval()


# ------------------------------------------------- two ways to generate
@torch.no_grad()
def generate_naive(idx, n):
    """Every step: re-run the FULL model on the FULL context. O(T^2)/step."""
    times = []
    for _ in range(n):
        t0 = time.time()
        logits, _, _ = model(idx[:, -T_max:])       # everything, every time
        nxt = logits[:, -1, :].argmax(-1, keepdim=True)   # greedy
        idx = torch.cat([idx, nxt], dim=1)
        times.append(time.time() - t0)
    return idx, times


@torch.no_grad()
def generate_cached(idx, n):
    """Prefill once, then each step feeds ONE token and reuses the cache."""
    times = []
    t0 = time.time()
    logits, _, pasts = model(idx[:, -T_max:])       # PREFILL: encode prompt
    nxt = logits[:, -1, :].argmax(-1, keepdim=True)
    idx = torch.cat([idx, nxt], dim=1)
    times.append(time.time() - t0)
    for _ in range(n - 1):                          # DECODE: one token a time
        t0 = time.time()
        if pasts[0][0].size(2) >= T_max:            # context full: naive crop
            logits, _, pasts = model(idx[:, -T_max:])   # (exercise 8.4: do better)
        else:
            logits, _, pasts = model(nxt, pasts=pasts)  # ONLY the new token
        nxt = logits[:, -1, :].argmax(-1, keepdim=True)
        idx = torch.cat([idx, nxt], dim=1)
        times.append(time.time() - t0)
    return idx, times


# ------------------------------------------- 1) PROOF of equivalence
prompt = torch.tensor([[stoi[c] for c in "ROMEO:"]], device=device)
out_naive, t_naive = generate_naive(prompt.clone(), args.gen)
out_cached, t_cached = generate_cached(prompt.clone(), args.gen)
same = torch.equal(out_naive, out_cached)
print(f"\ngreedy outputs identical, token for token: {same}")
assert same, "cache changed the math somewhere!"
print("greedy sample (loop-prone, as 5.7 warned):",
      repr(decode(out_naive[0, :60].tolist())))

# nicer text: same cached machinery, temperature sampling instead of argmax
@torch.no_grad()
def sample_cached(idx, n, temp=0.8):
    logits, _, pasts = model(idx[:, -T_max:])
    for _ in range(n):
        probs = F.softmax(logits[:, -1, :] / temp, dim=-1)
        nxt = torch.multinomial(probs, 1)
        idx = torch.cat([idx, nxt], dim=1)
        if pasts[0][0].size(2) >= T_max:
            logits, _, pasts = model(idx[:, -T_max:])
        else:
            logits, _, pasts = model(nxt, pasts=pasts)
    return idx

print("sampled at temp 0.8:",
      repr(decode(sample_cached(prompt.clone(), 60)[0].tolist())))

# ------------------------------------------- 2) the benchmark numbers
print(f"\ngenerating {args.gen} tokens:")
print(f"  naive : {sum(t_naive):6.2f}s total   "
      f"last-token latency {t_naive[-1]*1e3:6.1f} ms")
print(f"  cached: {sum(t_cached):6.2f}s total   "
      f"last-token latency {t_cached[-1]*1e3:6.1f} ms")
print(f"  speedup: {sum(t_naive)/sum(t_cached):.1f}x  "
      f"(and it grows with context length)")

# ------------------------------------------- 3) the cache-size arithmetic
bytes_per = 4  # float32
cache = n_layer * 2 * n_head * T_max * d_head * bytes_per
print(f"\ncache size, this toy (batch 1): n_layer*2*T*d*4B = {cache/1e6:.1f} MB")
gpt2 = 12 * 2 * 1024 * 768 * bytes_per
print(f"GPT-2 small at full context   : {gpt2/1e6:.0f} MB per sequence")
# 70B-class at 32k context, fp16: 80 layers, head dim 128
mha = 80 * 2 * 32768 * (64 * 128) * 2   # MHA: 64 kv-heads
gqa = 80 * 2 * 32768 * (8 * 128) * 2    # GQA: 8 kv-heads (Llama-2-70B style)
print(f"a 70B-class model, 32k context: MHA ~{mha/1e9:.0f} GB per sequence;"
      f" GQA (8 kv-heads) ~{gqa/1e9:.0f} GB"
      f" -- THIS is why MQA/GQA (4.7) and PagedAttention exist")

# ------------------------------------------------------------- the plot
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

fig, axes = plt.subplots(1, 2, figsize=(12, 4.6))
axes[0].plot([t * 1e3 for t in t_naive], color="#d1495b",
             label="naive: re-encode everything")
axes[0].plot([t * 1e3 for t in t_cached], color="#1a6fb0",
             label="KV cache: one token per step")
# the late blue spike is real and instructive: the cache reached T_max and
# the code fell back to a full re-encode (see generate_cached / exercise 8.4)
spike = max(range(1, len(t_cached)), key=lambda i: t_cached[i])
if t_cached[spike] > 3 * sorted(t_cached)[len(t_cached) // 2]:
    axes[0].annotate("cache hit T_max:\nfallback full re-encode\n(exercise 8.4)",
                     xy=(spike, t_cached[spike] * 1e3),
                     xytext=(spike * 0.45, t_cached[spike] * 1e3 * 0.85),
                     fontsize=9, arrowprops=dict(arrowstyle="->", color="#5b6b85"))
axes[0].set_xlabel("generation step")
axes[0].set_ylabel("latency per token (ms)")
axes[0].set_title("per-token latency: naive grows with context,\ncached stays flat")
axes[0].legend()

import numpy as np
axes[1].plot(np.cumsum(t_naive), color="#d1495b", label="naive")
axes[1].plot(np.cumsum(t_cached), color="#1a6fb0", label="KV cache")
axes[1].set_xlabel("generation step")
axes[1].set_ylabel("cumulative time (s)")
axes[1].set_title(f"total time to generate {args.gen} tokens\n"
                  f"speedup here: {sum(t_naive)/sum(t_cached):.1f}x")
axes[1].legend()
fig.tight_layout()
out = os.path.join(here, "..", "diagrams", "kv-cache-timing.png")
fig.savefig(out, dpi=120)
print(f"\nsaved {os.path.normpath(out)}")
