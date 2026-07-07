"""Part 1 - XOR in PyTorch.

The exact same 2 -> 2 -> 1 network as 01_xor_numpy.py. Compare them line by
line: loss.backward() replaces the entire hand-written gradient block, and
optimizer.step() replaces the update lines. Nothing else changed.

Also saves a picture of the learned decision boundary to
../diagrams/xor-decision-boundary.png.

Run:  python 02_xor_pytorch.py
"""

import os

import torch
import torch.nn as nn

torch.manual_seed(42)

X = torch.tensor([[0., 0.], [0., 1.], [1., 0.], [1., 1.]])
y = torch.tensor([[0.], [1.], [1.], [0.]])

# The model: Linear stores W and b for us; Tanh/Sigmoid are the g's.
model = nn.Sequential(
    nn.Linear(2, 2),   # W1 (2,2), b1 (2,)   -- the hidden layer
    nn.Tanh(),
    nn.Linear(2, 1),   # W2 (1,2), b2 (1,)   -- the output neuron
    nn.Sigmoid(),
)
print(model)
n_params = sum(p.numel() for p in model.parameters())
print(f"parameters: {n_params}")  # 9, same as the numpy version

criterion = nn.MSELoss()
optimizer = torch.optim.SGD(model.parameters(), lr=0.5)

# THE training loop. You will write these five lines forever (section 1.8).
for step in range(10_000):
    optimizer.zero_grad()          # clear old gradients
    loss = criterion(model(X), y)  # forward
    loss.backward()                # backward: autograd runs backprop
    optimizer.step()               # theta <- theta - eta * grad
    if step % 1000 == 0:
        print(f"step {step:5d}   loss {loss.item():.6f}")

with torch.no_grad():
    p = model(X)
print("\ntruth table after training:")
for xi, yi, pi in zip(X, y, p):
    print(f"  {int(xi[0])} XOR {int(xi[1])} -> {pi.item():.3f}   (target {int(yi[0])})")

# The two hyperplanes the hidden layer chose (compare with exercise 1.1!)
W1, b1 = model[0].weight.data, model[0].bias.data
print("\nlearned hidden hyperplanes:")
for i in range(2):
    print(f"  neuron {i}: {W1[i,0]:+.2f}*x1 {W1[i,1]:+.2f}*x2 {b1[i]:+.2f} = 0")

# ------------------------------------------------- decision boundary plot
try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except ImportError:
    raise SystemExit("matplotlib not installed; skipping the plot")

# Evaluate the network on a dense grid of the input square.
gx, gy = torch.meshgrid(torch.linspace(-0.5, 1.5, 200),
                        torch.linspace(-0.5, 1.5, 200), indexing="xy")
grid = torch.stack([gx.reshape(-1), gy.reshape(-1)], dim=1)
with torch.no_grad():
    zz = model(grid).reshape(200, 200)

fig, ax = plt.subplots(figsize=(5, 4.5))
cs = ax.contourf(gx, gy, zz, levels=20, cmap="RdBu_r", vmin=0, vmax=1, alpha=0.85)
ax.contour(gx, gy, zz, levels=[0.5], colors="k", linewidths=1.5)
ax.scatter([0, 1], [0, 1], s=120, c="#1a3a8f", edgecolors="k", zorder=3, label="XOR = 0")
ax.scatter([0, 1], [1, 0], s=120, c="#d1495b", edgecolors="k", marker="s", zorder=3, label="XOR = 1")
ax.set_xlabel("x1"); ax.set_ylabel("x2")
ax.set_title("XOR decision boundary learned by the 2-2-1 network")
ax.legend(loc="upper center")
fig.colorbar(cs, label="network output")
out = os.path.join(os.path.dirname(__file__), "..", "diagrams", "xor-decision-boundary.png")
fig.tight_layout()
fig.savefig(out, dpi=120)
print(f"\nsaved {os.path.normpath(out)}")
