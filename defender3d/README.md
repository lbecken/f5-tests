# DEFENDER 3D — trench run prototype (v2)

The v2 experiment sketched in
[../defender/docs/TECHNIQUES.md](../defender/docs/TECHNIQUES.md#8-v2-the-x-wing-idea):
the same Defender combat loop, seen from **behind the ship** — banking
starfighter, green wingtip lasers converging on a crosshair, a wireframe
planet surface rushing underneath. Luke Skywalker energy, Williams
Electronics soul.

## Running it

The prototype **shares sprites, the audio engine, and all mp3 assets
with the 2D game**, so serve the *repo root*:

```bash
python3 -m http.server 8000        # from the repository root
# open http://localhost:8000/defender3d/
```

## Controls

| Key | Action |
|---|---|
| `←` `→` `↑` `↓` (or WASD) | Fly — the ship banks into turns |
| `Space` / `X` | Fire wingtip lasers (they converge on the crosshair) |
| `Shift` | Boost |
| `B` | Smart bomb (clears everything in visual range) |
| `P` / `M` | Pause / mute |

## What's in the prototype

- **Pseudo-3D canvas renderer** — no WebGL, no libraries. Points are
  projected `x/z`, `y/z` around a focal length, world objects are
  depth-sorted and drawn far-to-near, and the 2D game's pixel sprites
  are simply **scaled by 1/z**, which keeps the retro look for free.
- **A cylindrical world**: you fly forever around the planet's equator
  (circumference 12,000 units, wrapping in z exactly like the 2D
  game wrapped in x — same `wrapDz` shortest-distance math).
- **The abduction loop in depth**: landers descend to the surface
  ahead of you, grab humanoids, and lift; kill the lander and the
  humanoid parachutes back down; let it reach the top and you've made
  a mutant that hunts you around the ring.
- **Banking flight model** — lateral velocity rolls the ship and
  counter-tilts the whole world view; the chase camera eases behind
  your movement.
- **Alternating wingtip lasers** aimed at a velocity-led crosshair,
  baiters that spawn when you dawdle, smart bombs, waves, the scanner
  (now showing the ring flattened into a strip), and the full
  ElevenLabs soundscape from v1 with distance-based volume and
  screen-position panning.

## Not done yet (roadmap)

- Catching falling humanoids with the ship (currently they parachute
  and survive on their own — the dive-and-scoop deserves real tuning).
- Terrain height / trench walls (the surface is a flat grid; the
  horizon ridge is a parallax silhouette).
- Bombers, mines, pods and swarmers in 3D.
- Doppler on passing enemies; wingman voice chatter.
- A proper rear-view explosion when you fly through debris.
