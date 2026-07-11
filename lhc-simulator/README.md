# LHC Simulator

An interactive, physics-faithful simulation of CERN's Large Hadron Collider — the machine,
the four experiments, and the data analysis — built as a self-contained web app.

**Target audience:** a physics undergraduate (~20 y.o.) with solid maths and physics, who is
curious about how the LHC really works and might one day want to work at CERN.

![home](https://img.shields.io/badge/stack-vanilla%20JS%20%2B%20canvas-blue) ![deps](https://img.shields.io/badge/dependencies-none-brightgreen)

## Running it

No build step, no dependencies — it's plain ES modules. Serve the folder with any static server:

```bash
cd lhc-simulator
python3 -m http.server 8000
# open http://localhost:8000
```

## What's inside

### 🎚 Five expertise levels
**Spectator → Intern → Knowledgeable → Accomplished → Expert.** The level controls which machine
parameters you may touch (from "watch a preset fill" to "own β*, crossing angle, emittance and
luminosity levelling") and how much physics detail the displays reveal (from plain-language
summaries to full per-particle kinematics tables and analysis cuts).

### 🕹 Control Room
Drive a fill through the real LHC cycle — **INJECTION → RAMP → FLAT TOP → SQUEEZE → ADJUST →
STABLE BEAMS → DUMP** — with an "LHC Page 1"-style status display, a live ring view with both
counter-rotating beams, the injector chain (LINAC4 → PSB → PS → SPS), and machine readouts
(dipole field & current, Lorentz γ, stored energy, β*).
The luminosity is computed from the actual formula
ℒ = N<sub>b</sub>²·n<sub>b</sub>·f<sub>rev</sub>·γ / (4π·ε<sub>N</sub>·β*) · R(φ),
so every knob responds the way the machine does — including the pile-up μ and the geometric
crossing-angle factor. Times are compressed ~100×.

### 💥 Event Display
After STABLE BEAMS, pick a detector and browse collisions inside real, to-scale geometry:

- **ATLAS / CMS / ALICE** — transverse view with tracker, calorimeters, solenoid and muon system;
  charged tracks are true helices with r = p<sub>T</sub>/(0.3·B), so the same event visibly curls
  more in CMS (3.8 T) than in ATLAS (2 T). Photons are trackless dashed lines into the ECAL, muons
  punch through to the muon chambers, jets are cones, missing p<sub>T</sub> is a dashed arrow,
  pile-up is faint grey.
- **LHCb** — side-view forward spectrometer with the 4 T·m dipole kick, plus a **VELO inset**
  showing the millimetre-displaced B-decay vertex and the measured flight distance.
- **ALICE Pb–Pb** — heavy-ion mode with centrality-dependent multiplicity (~1000 tracks central)
  and elliptic-flow modulation v₂.

Events come from an honest toy generator: Breit-Wigner resonances (Z, W, H, J/ψ, Υ, B), proper
two-body decays boosted from the rest frame, per-detector Gaussian smearing, underlying event and
Poisson pile-up taken from the machine conditions you configured.

### 📊 Analysis
Accumulate datasets and make the classic plots: the **dimuon spectrum** (J/ψ, ψ(2S), Υ(1S,2S,3S),
Z peaks on a log-log falling continuum), the **H → γγ bump hunt**, the **golden channel m(4ℓ)**,
the **W transverse-mass Jacobian edge**, the falling **jet p<sub>T</sub> spectrum**, and LHCb's
**B⁺ → J/ψ K⁺ mass peak**. At higher expertise levels, apply kinematic cuts (p<sub>T</sub>, |η|,
displaced-vertex requirement) and watch signal-to-background improve — or record small datasets
and learn to distrust 3σ bumps.

### 📚 Learn
A didactic section written at physics-undergraduate level: CERN and its history, the accelerator
complex and the 25 ns bunch-splitting gymnastics, the LHC machine (superconducting magnets at
1.9 K, quench protection, RF, β* and the squeeze), luminosity & cross-sections, collider
kinematics (p<sub>T</sub>, η, invariant mass, MET), one deep page per experiment
(ATLAS, CMS, ALICE, LHCb), and a practical guide to actually getting a job at CERN.

## Media
- Hero artwork generated with **Recraft** (`assets/img/tunnel.webp`)
- Ambient loop and welcome narration generated with **ElevenLabs** (`assets/audio/`) —
  toggle with the 🔊 button; all machine sounds are synthesised live with WebAudio.

## Fidelity notes
Numbers follow LHC Run 3 (2022–2026) operating conditions and PDG values: 6.8 TeV/beam, 2808
max bunches at 25 ns, 11,245 rev/s, 1232 dipoles at up to 8.33 T / 1.9 K, levelling at
2×10³⁴ cm⁻²s⁻¹ with μ ≈ 60, σ<sub>inel</sub> ≈ 80 mb, and the real cross-section hierarchy from
minimum bias down to H → ZZ* → 4ℓ. It is a *simulation for learning*, not a Monte Carlo generator:
angular distributions and hadronisation are simplified, but every mass peak, curvature, flight
distance and rate is where physics says it should be.
