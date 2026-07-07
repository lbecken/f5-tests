# DEFENDER — web edition

A fast, loud, unapologetically retro homage to Williams Electronics'
**Defender** (1981) and its sequel **Stargate**, built as a single-page
web game on a low-resolution HTML5 canvas. No frameworks, no build
step — just three JS files and a stack of AI-generated arcade sound
effects.

![genre](https://img.shields.io/badge/genre-twitch%20shooter-red)
![tech](https://img.shields.io/badge/tech-vanilla%20JS%20%2B%20canvas%20%2B%20WebAudio-blue)

## Running it

The game loads its audio over `fetch`, so it needs to be served over
HTTP (opening `index.html` from `file://` will run silently in most
browsers):

```bash
cd defender
python3 -m http.server 8000
# open http://localhost:8000
```

Press **Enter** (or click/tap) on the title screen — that first
gesture also unlocks the browser's audio context.

## Controls

| Key | Action |
|---|---|
| `←` / `→` (or `A`/`D`) | Thrust left / right (this also flips the ship) |
| `↑` / `↓` (or `W`/`S`) | Move up / down |
| `Space` or `X` | Fire laser (hold for autofire) |
| `B` or `Shift` | **Smart bomb** — destroys everything on screen |
| `H` | **Hyperspace** — random teleport, 1-in-8 chance it kills you |
| `P` | Pause |
| `M` | Mute |

## The mission

You are the last defender of a planet 8 screens wide. Ten **humanoids**
wander the mountain ridge below. Green **landers** materialize in
waves, descend, grab humanoids, and haul them to the top of the sky.
If a lander gets its victim all the way up, it eats the humanoid and
becomes a **mutant** — faster, meaner, and hunting *you*.

The core loop that made Defender legendary:

- **Shoot a lander mid-abduction** and the humanoid falls.
- **Catch the falling humanoid with your ship** (+500) and ferry it
  down — touch the ground gently to set it down for another +500.
- A humanoid that falls a short distance survives on its own (+250).
  A long fall kills it.
- Lose **all ten** humanoids and the planet explodes: the terrain
  vanishes and every lander on the map instantly goes mutant. Good luck.

Clear all landers, bombers, pods and swarmers to finish the wave.
Surviving humanoids pay a bonus (100 × wave, up to 500 each) and the
next wave begins, faster and thicker.

## Enemy roster

| Enemy | Points | Behaviour |
|---|---|---|
| **Lander** (green) | 150 | Wanders, hunts humanoids, abducts them skyward. Fires aimed shots. |
| **Mutant** (magenta) | 150 | A lander that finished an abduction. Swarms you with jittery homing. |
| **Bomber** (blue diamond) | 250 | Drifts across the sky leaving a trail of stationary mines. |
| **Mine** (red) | 50 | Doesn't move. Doesn't have to. |
| **Pod** (violet) | 1000 | Drifts harmlessly — until you shoot it and 3–5 swarmers burst out. Smart-bomb these. |
| **Swarmer** (orange) | 150 | Tiny, fast, weaving kamikaze. |
| **Baiter** (yellow-green saucer) | 200 | Spawns when you take too long. Faster than your ship. The game's way of saying *hurry up*. |

## Scoring

- Enemies: see table above.
- Catch a falling humanoid: **+500**. Deposit it on the ground: **+500**.
- Humanoid survives a short fall on its own: **+250**.
- End-of-wave bonus: **100 × wave × surviving humanoid** (wave capped at 5).
- Every **10,000** points: extra ship *and* extra smart bomb.

## Sound

All 17 audio assets (12 effects + 5 announcer voice lines) were
generated with the [ElevenLabs](https://elevenlabs.io) sound-effects
and text-to-speech APIs — laser zaps, explosions, the thruster loop,
the abduction siren, and a gravel-voiced arcade announcer
("*Defend the humanoids!*"). See
[docs/TECHNIQUES.md](docs/TECHNIQUES.md#5-the-audio-pipeline) for the
prompts and pipeline.

## Files

```
defender/
├── index.html          page shell + CRT scanline overlay
├── js/
│   ├── sprites.js      pixel-art sprite definitions, baked at boot
│   ├── audio.js        WebAudio manager (mixing, ducking, thrust loop)
│   └── game.js         the entire game: world, AI, physics, rendering
├── assets/sfx/         ElevenLabs-generated mp3s
└── docs/TECHNIQUES.md  how it all works + the v2 (3-D X-wing) plan
```

## v2 idea

Take the same combat loop into pseudo-3D: a behind-the-ship camera,
trench-run terrain, enemies approaching in depth — *Luke Skywalker in
an X-wing*. Notes and a proposed technical approach are at the end of
[docs/TECHNIQUES.md](docs/TECHNIQUES.md#8-v2-the-x-wing-idea).
