"""Part 3 - watch embeddings being learned.

A tiny corpus, a vocabulary of ~30 words, and 2-DIMENSIONAL embeddings so we
can plot them directly. The model is trained on next-word prediction (one
honest cross-entropy loss) and we watch the embedding geometry organize
itself: animals cluster with animals, foods with foods.

Also demonstrates, with your own eyes:
  * the sparse-row gradient of section 3.4 (only rows of tokens in the
    batch get nonzero gradient),
  * cosine similarities before vs after training,
  * the sinusoidal positional-encoding pattern (saved as a heatmap).

Outputs: ../diagrams/embeddings-before-after.png
         ../diagrams/positional-encoding.png

Run:  python 04_embeddings_toy.py     (seconds on CPU)
"""

import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

torch.manual_seed(3)
DIAGRAMS = os.path.join(os.path.dirname(__file__), "..", "diagrams")

# ------------------------------------------------------------- the corpus
# Deliberately structured: animals do animal things, foods do food things.
# Distributional semantics ("know a word by the company it keeps") needs
# words of the same kind to appear in the same kinds of contexts.
sentences = """
the cat chases the mouse
the dog chases the cat
the cat eats the fish
the dog eats the meat
the mouse eats the cheese
the horse eats the grass
the cat sleeps on the mat
the dog sleeps on the floor
the horse runs on the field
the mouse runs on the floor
people cook the rice
people cook the pasta
people eat the bread
people eat the rice
people slice the bread
people slice the cheese
the child eats the apple
the child eats the banana
people peel the banana
people peel the apple
the cat likes the fish
the dog likes the meat
the child likes the pasta
the horse likes the grass
""".strip().splitlines()

tokens = [s.split() for s in sentences]
vocab = sorted({w for s in tokens for w in s})
stoi = {w: i for i, w in enumerate(vocab)}
V = len(vocab)
print(f"vocabulary ({V} words): {vocab}\n")

# Training pairs, skip-gram style: from a word, predict its NEIGHBORS
# (previous and next word). Same one-hot-in, cross-entropy-out setup as a
# next-token model; the two-directional window just makes sure every word
# (including sentence-final foods) gets used as an input and receives
# gradient on its embedding row.
pairs = []
for s in tokens:
    for i in range(len(s)):
        if i > 0:
            pairs.append((stoi[s[i]], stoi[s[i - 1]]))
        if i < len(s) - 1:
            pairs.append((stoi[s[i]], stoi[s[i + 1]]))
X = torch.tensor([p[0] for p in pairs])
Y = torch.tensor([p[1] for p in pairs])
print(f"{len(pairs)} (word -> neighbor word) training pairs\n")


# ------------------------------------------------------------- the model
class TinyLM(nn.Module):
    def __init__(self, V, d=2):
        super().__init__()
        self.emb = nn.Embedding(V, d)   # THE embedding table E: (V, d)
        self.mlp = nn.Sequential(        # a small MLP on top (Part 1!)
            nn.Linear(d, 16), nn.Tanh(), nn.Linear(16, V))

    def forward(self, ids):
        return self.mlp(self.emb(ids))   # ids (B,) -> (B, d) -> (B, V) logits


model = TinyLM(V)
before = model.emb.weight.detach().clone()  # snapshot of the random init

# ------------------------------------------ act 1: the sparse gradient
# One batch containing ONLY "cat chases mouse". Which rows of E.weight.grad
# are nonzero? Exactly the rows of tokens that appeared in the forward pass.
ids = torch.tensor([stoi["cat"], stoi["chases"]])
tgt = torch.tensor([stoi["chases"], stoi["mouse"]])
loss = F.cross_entropy(model(ids), tgt)
loss.backward()
print("act 1: gradient rows after a batch containing only 'cat chases mouse':")
for w in vocab:
    g = model.emb.weight.grad[stoi[w]]
    if g.abs().sum() > 0:
        print(f"  E.grad[{w!r}] = {g.numpy().round(4)}   <-- nonzero")
print("  (every other of the", V, "rows is exactly zero)\n")
model.zero_grad()

# --------------------------------------------------- act 2: full training
opt = torch.optim.Adam(model.parameters(), lr=0.05)
for step in range(2000):
    opt.zero_grad()
    loss = F.cross_entropy(model(X), Y)
    loss.backward()
    opt.step()
    if step % 400 == 0:
        print(f"step {step:4d}   loss {loss.item():.4f}")
after = model.emb.weight.detach().clone()

# ------------------------------------------- act 3: cosine similarities
def cos(a, b, M):
    va, vb = M[stoi[a]], M[stoi[b]]
    return F.cosine_similarity(va, vb, dim=0).item()

print("\nact 3: cosine similarity, before -> after training")
for a, b in [("cat", "dog"), ("cat", "horse"), ("rice", "pasta"),
             ("cat", "rice"), ("eats", "likes"), ("cat", "chases")]:
    print(f"  {a:>6} ~ {b:<6}   {cos(a, b, before):+.2f}  ->  {cos(a, b, after):+.2f}")

# ------------------------------------------------------ act 4: the plots
groups = {
    "animals": ["cat", "dog", "mouse", "horse", "fish"],
    "foods": ["rice", "pasta", "bread", "cheese", "apple", "banana",
              "meat", "grass"],
    "verbs": ["chases", "eats", "sleeps", "runs", "cook", "slice",
              "peel", "likes"],
    "other": ["the", "on", "people", "child", "mat", "floor", "field"],
}
colors = {"animals": "#d1495b", "foods": "#e29b3d", "verbs": "#1a6fb0",
          "other": "#8a8a8a"}

fig, axes = plt.subplots(1, 2, figsize=(12, 5.5))
for ax, M, title in [(axes[0], before, "before training (random init)"),
                     (axes[1], after, "after training (next-word prediction)")]:
    for g, words in groups.items():
        pts = np.array([M[stoi[w]].numpy() for w in words])
        ax.scatter(pts[:, 0], pts[:, 1], c=colors[g], label=g, s=45, zorder=3)
        for w, (px, py) in zip(words, pts):
            ax.annotate(w, (px, py), fontsize=8, xytext=(4, 4),
                        textcoords="offset points")
    ax.set_title(title)
    ax.axhline(0, color="#ccc", lw=0.5); ax.axvline(0, color="#ccc", lw=0.5)
axes[0].legend(loc="best", fontsize=9)
fig.suptitle("2-d word embeddings: meaning emerges from next-word prediction alone")
fig.tight_layout()
out = os.path.join(DIAGRAMS, "embeddings-before-after.png")
fig.savefig(out, dpi=120)
print(f"\nsaved {os.path.normpath(out)}")

# --------------------------- act 5: sinusoidal positional encodings (3.5)
T_max, d = 100, 64
pos = np.arange(T_max)[:, None]                      # (T, 1)
i = np.arange(d // 2)[None, :]                       # (1, d/2)
angles = pos / (10000 ** (2 * i / d))                # (T, d/2)
P = np.zeros((T_max, d))
P[:, 0::2] = np.sin(angles)
P[:, 1::2] = np.cos(angles)

fig, ax = plt.subplots(figsize=(9, 4.5))
im = ax.imshow(P, aspect="auto", cmap="RdBu_r", vmin=-1, vmax=1)
ax.set_xlabel("embedding dimension")
ax.set_ylabel("position in sequence")
ax.set_title("sinusoidal positional encodings: fast stripes (left) encode fine\n"
             "position, slow stripes (right) encode coarse position")
fig.colorbar(im)
fig.tight_layout()
out = os.path.join(DIAGRAMS, "positional-encoding.png")
fig.savefig(out, dpi=120)
print(f"saved {os.path.normpath(out)}")
