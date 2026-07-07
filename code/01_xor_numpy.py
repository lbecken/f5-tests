"""Part 1 - XOR with backpropagation BY HAND (numpy only).

The smallest network that can solve XOR: 2 inputs -> 2 hidden neurons -> 1
output. Nine parameters. Every gradient is written out explicitly so that
PyTorch's loss.backward() never feels like magic again.

Run:  python 01_xor_numpy.py
"""

import numpy as np

# Seed 0 converges. Try seed 1: training plateaus at loss ~0.125, a local
# minimum of this tiny loss landscape -- that plateau IS exercise 1.2.
rng = np.random.default_rng(0)

# ---------------------------------------------------------------- the data
# The entire "dataset": the truth table of XOR. Shapes: X (4, 2), y (4, 1).
X = np.array([[0., 0.], [0., 1.], [1., 0.], [1., 1.]])
y = np.array([[0.], [1.], [1.], [0.]])

# ---------------------------------------------------- the 9 parameters (theta)
# Layer 1: 2 -> 2         W1 (2, 2), b1 (2,)
# Layer 2: 2 -> 1         W2 (1, 2), b2 (1,)
W1 = rng.normal(0, 1.0, size=(2, 2))
b1 = np.zeros(2)
W2 = rng.normal(0, 1.0, size=(1, 2))
b2 = np.zeros(1)


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-z))


lr = 0.5          # the learning rate eta
for step in range(10_000):
    # ------------------------------------------------------- FORWARD PASS
    # Each line is one stage of the pipeline  x -> z1 -> h -> z2 -> p -> L
    z1 = X @ W1.T + b1          # (4, 2)  pre-activations, hidden layer
    h = np.tanh(z1)             # (4, 2)  hidden activations
    z2 = h @ W2.T + b2          # (4, 1)  pre-activation, output neuron
    p = sigmoid(z2)             # (4, 1)  prediction in (0, 1)
    loss = np.mean((p - y) ** 2)  # MSE, one number

    # ------------------------------------------------------ BACKWARD PASS
    # Chain rule, applied back-to-front. dX means dLoss/dX, and every dX
    # has the same shape as X. Multiply local derivatives, reuse upstream.
    N = len(X)
    dp = 2.0 * (p - y) / N            # (4, 1)  d/dp of mean((p-y)^2)
    dz2 = dp * p * (1 - p)            # (4, 1)  sigmoid'(z) = p(1-p)
    dW2 = dz2.T @ h                   # (1, 2)  z2 = h W2^T  =>  dW2 = dz2^T h
    db2 = dz2.sum(axis=0)             # (1,)
    dh = dz2 @ W2                     # (4, 2)  gradient flows down to h
    dz1 = dh * (1 - h ** 2)           # (4, 2)  tanh'(z) = 1 - tanh(z)^2
    dW1 = dz1.T @ X                   # (2, 2)
    db1 = dz1.sum(axis=0)             # (2,)

    # ------------------------------------------------------------- UPDATE
    # theta <- theta - eta * dL/dtheta   (gradient descent, section 1.6)
    W1 -= lr * dW1
    b1 -= lr * db1
    W2 -= lr * dW2
    b2 -= lr * db2

    if step % 1000 == 0:
        print(f"step {step:5d}   loss {loss:.6f}")

print("\ntruth table after training:")
for xi, yi, pi in zip(X, y, p):
    print(f"  {int(xi[0])} XOR {int(xi[1])} -> {pi[0]:.3f}   (target {int(yi[0])})")

print("\nlearned hidden hyperplanes (w1*x1 + w2*x2 + b = 0):")
for i in range(2):
    print(f"  neuron {i}: {W1[i,0]:+.2f}*x1 {W1[i,1]:+.2f}*x2 {b1[i]:+.2f} = 0")
