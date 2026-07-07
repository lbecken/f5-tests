"""Part 1 - the digit recognizer, revisited with named parts.

A 64 -> 64 -> 10 MLP on scikit-learn's 8x8 digits dataset (a small cousin of
MNIST: 1797 images, ships with sklearn, no download). Every ingredient now
has a name from Part 1: cross-entropy (1.5), Adam (1.6), autograd (1.7),
and the five-line training loop (1.8).

Run:  python 03_digits_mlp.py        (~1 minute on CPU, ~97% test accuracy)
"""

import torch
import torch.nn as nn
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split

torch.manual_seed(0)

# ------------------------------------------------------------------- data
digits = load_digits()  # X: (1797, 64) pixel intensities 0..16, y: (1797,)
X_train, X_test, y_train, y_test = train_test_split(
    digits.data, digits.target, test_size=0.25, random_state=0)

# Normalizing inputs to ~[0,1] keeps pre-activations in the healthy range
# of the nonlinearity from step 0 (the same hygiene motif as LayerNorm).
X_train = torch.tensor(X_train, dtype=torch.float32) / 16.0
X_test = torch.tensor(X_test, dtype=torch.float32) / 16.0
y_train = torch.tensor(y_train)
y_test = torch.tensor(y_test)

# ------------------------------------------------------------------ model
model = nn.Sequential(
    nn.Linear(64, 64),
    nn.ReLU(),
    nn.Linear(64, 10),   # 10 raw scores per image: the LOGITS.
)
# No softmax here: nn.CrossEntropyLoss applies log-softmax internally
# (numerically safer). The model outputs scores; the loss handles turning
# them into -log p_correct. GPT does exactly the same (Part 5).
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

print(model)
print(f"parameters: {sum(p.numel() for p in model.parameters())}")

# --------------------------------------------------------------- training
batch_size = 64
for epoch in range(60):
    perm = torch.randperm(len(X_train))  # stochastic in SGD = shuffled batches
    for i in range(0, len(X_train), batch_size):
        idx = perm[i:i + batch_size]
        optimizer.zero_grad()
        loss = criterion(model(X_train[idx]), y_train[idx])
        loss.backward()
        optimizer.step()

    with torch.no_grad():
        train_acc = (model(X_train).argmax(1) == y_train).float().mean()
        test_acc = (model(X_test).argmax(1) == y_test).float().mean()
    if epoch % 10 == 0 or epoch == 59:
        print(f"epoch {epoch:2d}  loss {loss.item():.4f}  "
              f"train acc {train_acc:.3f}  test acc {test_acc:.3f}")

# -------------------------------------------- look at one prediction closely
with torch.no_grad():
    logits = model(X_test[:1])                    # (1, 10) raw scores
    probs = torch.softmax(logits, dim=1)[0]       # (10,)  sums to 1
print(f"\none test image, true digit = {y_test[0].item()}")
print("class probabilities from softmax(logits):")
for d, p in enumerate(probs):
    bar = "#" * int(p * 50)
    print(f"  {d}: {p:.3f} {bar}")
print(f"cross-entropy for this image = -log p_correct = "
      f"{-torch.log(probs[y_test[0]]).item():.4f}")
