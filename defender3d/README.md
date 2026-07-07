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
  humanoid falls — **dive under it to scoop it onto your hull**
  (+500), then skim the ground to set it down (+500). A short fall is
  survivable on its own; a long one isn't.
- **Rolling terrain**: the surface is a heightfield around the ring —
  the grid and rails ride over ridges and valleys, humanoids stand on
  the slopes, landers descend to the local ground… and clipping a
  ridge at speed kills you. Fly the valleys.
- **The full enemy roster in 3D**: bombers cruising the ring leaving
  minefields, pods that burst into weaving swarmers, mutants and
  baiters that hunt you from any direction — including from behind.
- **Banking flight model** — lateral velocity rolls the ship and
  counter-tilts the whole world view; the chase camera eases behind
  your movement.
- **Alternating wingtip lasers** aimed at a velocity-led crosshair,
  baiters that spawn when you dawdle, smart bombs, waves, the scanner
  (now showing the ring flattened into a strip), and the full
  ElevenLabs soundscape from v1 with distance-based volume and
  screen-position panning.
- **A living cockpit soundscape**: enemies that streak past the canopy
  trigger a doppler flyby whoosh panned to the side they passed on;
  distant enemy fire is an audible low zap; close kills spray debris
  at the camera with a flash and heavier shake.
- **A wingman on the radio** (a second ElevenLabs voice): he calls
  incoming waves, warns you when something is on your tail, cheers a
  humanoid catch, and salutes a 5-kill streak. Chatter ducks the sound
  mix like the announcer, with a global cooldown so he never babbles.

## Still on the roadmap

- Trench walls / canyon sections between the open stretches.
- True Doppler pitch-bending (the flyby is a one-shot whoosh today).
- Full planet-destroyed state when every humanoid is lost (2D has it).
