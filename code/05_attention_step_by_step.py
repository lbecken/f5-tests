"""Part 4 - attention, from raw matrices to a trained head, in six acts.

  act 1: scaled dot-product attention computed step by step, shapes printed
  act 2: why the / sqrt(d_k): softmax saturation demo
  act 3: the causal mask
  act 4: permutation test - attention alone is order-blind (Part 3, 3.5)
  act 5: multi-head, loop version vs production reshape version
  act 6: a REAL trained attention head: learns to find the odd token out

Output: ../diagrams/attention-heatmap.png

Run:  python 05_attention_step_by_step.py     (seconds on CPU)
"""

import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import torch
import torch.nn as nn
import torch.nn.functional as F

torch.manual_seed(1)
torch.set_printoptions(precision=2, sci_mode=False)


def banner(s):
    print("\n" + "=" * 72 + f"\n{s}\n" + "=" * 72)


# ========================================================================
banner("act 1: scaled dot-product attention, step by step")
# ========================================================================
T, d, d_k = 4, 8, 8            # 4 tokens, model dim 8, head dim 8
X = torch.randn(T, d)          # the residual stream: one row per token
print(f"X (the token vectors)            : {tuple(X.shape)}")

# The ONLY learned parameters of attention: three projection matrices.
W_Q, W_K, W_V = (torch.randn(d_k, d) / d**0.5 for _ in range(3))

Q = X @ W_Q.T                  # queries : what each token is looking for
K = X @ W_K.T                  # keys    : what each token advertises
V = X @ W_V.T                  # values  : what each token delivers
print(f"Q, K, V                          : {tuple(Q.shape)} each")

S = Q @ K.T                    # all T x T scores in one matmul
print(f"S = Q K^T (raw scores)           : {tuple(S.shape)}\n{S}")

S_scaled = S / d_k**0.5
A = F.softmax(S_scaled, dim=-1)  # each ROW becomes a probability distribution
print(f"A = softmax(S / sqrt(d_k))       : rows sum to {A.sum(-1)}")
print(A)

out = A @ V                    # each row: weighted average of the values
print(f"output = A V                     : {tuple(out.shape)}")
print("row t of the output = sum_s A[t,s] * V[s]  -- a soft lookup.")

# ========================================================================
banner("act 2: why divide by sqrt(d_k)? softmax saturation")
# ========================================================================
for dk_big in (8, 512):
    q, k = torch.randn(dk_big), torch.randn(4, dk_big)
    raw = k @ q                              # scores against 4 keys
    print(f"d_k={dk_big:4d}  raw scores std ~ sqrt(d_k)={dk_big**0.5:5.1f}   "
          f"softmax(raw)  ={F.softmax(raw, dim=-1).numpy().round(3)}")
    print(f"          scaled                      "
          f"softmax(scaled)={F.softmax(raw / dk_big**0.5, dim=-1).numpy().round(3)}")
print("unscaled at large d_k -> one weight ~1, rest ~0: saturated, gradients die.")

# ========================================================================
banner("act 3: the causal mask")
# ========================================================================
mask = torch.tril(torch.ones(T, T))          # lower-triangular of ones
S_masked = S_scaled.masked_fill(mask == 0, float("-inf"))
print(f"scores with the future set to -inf:\n{S_masked}")
A_causal = F.softmax(S_masked, dim=-1)
print(f"causal attention (lower-triangular, rows still sum to 1):\n{A_causal}")
assert torch.allclose(A_causal.triu(1), torch.zeros(T, T)), "future leaked!"
print("row t has exactly zero weight on every column s > t.")

# ========================================================================
banner("act 4: permutation test - attention is order-blind")
# ========================================================================
def attend(X):
    Q, K, V = X @ W_Q.T, X @ W_K.T, X @ W_V.T
    return F.softmax(Q @ K.T / d_k**0.5, dim=-1) @ V

perm = torch.tensor([2, 0, 3, 1])
out1 = attend(X)[perm]         # attend, then shuffle the rows
out2 = attend(X[perm])         # shuffle the rows, then attend
print(f"attend-then-shuffle == shuffle-then-attend ? "
      f"{torch.allclose(out1, out2, atol=1e-5)}")
print("outputs just follow the shuffle -> the mechanism itself cannot see")
print("order. This is why positional embeddings must be ADDED as data (3.5).")

# ========================================================================
banner("act 5: multi-head - readable loop vs production reshape")
# ========================================================================
d, h = 8, 2
d_head = d // h                # shrink each head so total compute stays flat
X = torch.randn(T, d)
Wq = torch.randn(d, d) / d**0.5   # ONE big projection holds all heads
Wk = torch.randn(d, d) / d**0.5
Wv = torch.randn(d, d) / d**0.5

# loop version: h separate small attentions, then concatenate
outs = []
for i in range(h):
    sl = slice(i * d_head, (i + 1) * d_head)   # this head's slice of dims
    Qi, Ki, Vi = X @ Wq.T[:, sl], X @ Wk.T[:, sl], X @ Wv.T[:, sl]
    Ai = F.softmax(Qi @ Ki.T / d_head**0.5, dim=-1)
    outs.append(Ai @ Vi)
loop_out = torch.cat(outs, dim=-1)                       # (T, d)

# production version: one projection, reshape to (h, T, d_head), batch it
Q = (X @ Wq.T).view(T, h, d_head).transpose(0, 1)        # (h, T, d_head)
K = (X @ Wk.T).view(T, h, d_head).transpose(0, 1)
V = (X @ Wv.T).view(T, h, d_head).transpose(0, 1)
A = F.softmax(Q @ K.transpose(-2, -1) / d_head**0.5, dim=-1)  # (h, T, T)
fast_out = (A @ V).transpose(0, 1).reshape(T, d)         # (T, d)

print(f"loop version == reshape version ? "
      f"{torch.allclose(loop_out, fast_out, atol=1e-5)}")
print(f"h={h} heads, each d_head={d_head}: h attention matrices of shape "
      f"{tuple(A.shape[1:])}, one 'conversation' per head.")

# ========================================================================
banner("act 6: training an attention head to FIND something")
# ========================================================================
# Task: a sequence of 'filler' tokens (ids 0..4) contains exactly ONE
# 'odd' token (ids 5..9) at a random position; the final position holds a
# fixed QUERY token (id 10). The model must output WHERE the odd token is.
# Position is only readable by attending to the odd token itself (its value
# carries its positional embedding) -- there is no shortcut. One attention
# head suffices, and we can WATCH where it learned to look.
V_SIZE, T_SEQ, D = 11, 13, 32
QUERY_ID = 10


def make_batch(B):
    seq = torch.randint(0, 5, (B, T_SEQ))            # fillers everywhere
    pos = torch.randint(0, T_SEQ - 1, (B,))          # odd token position
    odd = torch.randint(5, 10, (B,))                 # odd token identity
    seq[torch.arange(B), pos] = odd
    seq[:, -1] = QUERY_ID                            # last slot: the query
    return seq, pos                                  # target = the position


class OneHeadFinder(nn.Module):
    def __init__(self):
        super().__init__()
        self.emb = nn.Embedding(V_SIZE, D)
        self.pos = nn.Embedding(T_SEQ, D)
        self.Wq = nn.Linear(D, D, bias=False)
        self.Wk = nn.Linear(D, D, bias=False)
        self.Wv = nn.Linear(D, D, bias=False)
        self.head = nn.Linear(D, T_SEQ - 1)   # logits over candidate positions

    def forward(self, seq):
        x = self.emb(seq) + self.pos(torch.arange(T_SEQ))   # (B, T, D)
        Q, K, Vv = self.Wq(x), self.Wk(x), self.Wv(x)
        A = F.softmax(Q @ K.transpose(-2, -1) / D**0.5, dim=-1)  # (B, T, T)
        out = A @ Vv
        return self.head(out[:, -1]), A[:, -1]  # last position's logits + its attention row


model = OneHeadFinder()
opt = torch.optim.Adam(model.parameters(), lr=1e-3)
for step in range(1500):
    seq, target = make_batch(64)
    opt.zero_grad()
    logits, _ = model(seq)
    loss = F.cross_entropy(logits, target)
    loss.backward()
    opt.step()
    if step % 300 == 0:
        acc = (logits.argmax(1) == target).float().mean()
        print(f"step {step:4d}  loss {loss.item():.3f}  batch acc {acc:.2f}")

seq, pos = make_batch(8)
with torch.no_grad():
    logits, att = model(seq)
acc = (logits.argmax(1) == pos).float().mean()
print(f"\ntest accuracy on 8 fresh sequences: {acc:.2f}")
print("attention weight that the QUERY position puts on the odd token:")
for b in range(8):
    print(f"  sequence {b}: odd token at position {pos[b].item():2d}, "
          f"attention there = {att[b, pos[b]].item():.2f}")

# ------------------------------------------------------------- the figure
fig, axes = plt.subplots(1, 2, figsize=(12, 4.8))
im0 = axes[0].imshow(A_causal, cmap="Blues", vmin=0, vmax=1)
axes[0].set_title("act 3: causal attention\n(strictly lower-triangular)")
axes[0].set_xlabel("attended position s (key)")
axes[0].set_ylabel("position t (query)")
fig.colorbar(im0, ax=axes[0])

im1 = axes[1].imshow(att, cmap="Blues", vmin=0, vmax=1, aspect="auto")
for b in range(8):
    axes[1].add_patch(plt.Rectangle((pos[b] - 0.5, b - 0.5), 1, 1,
                                    fill=False, edgecolor="#d1495b", lw=2))
axes[1].set_title("act 6: trained attention from the query position\n"
                  "(red box = where the odd token actually is)")
axes[1].set_xlabel("attended position s")
axes[1].set_ylabel("test sequence")
fig.colorbar(im1, ax=axes[1])
fig.tight_layout()
out = os.path.join(os.path.dirname(__file__), "..", "diagrams",
                   "attention-heatmap.png")
fig.savefig(out, dpi=120)
print(f"\nsaved {os.path.normpath(out)}")
