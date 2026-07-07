# DEFENDER — mechanics & techniques

How the game works under the hood, why the design choices were made,
and where v2 could go. Everything lives in three small files:
`js/sprites.js`, `js/audio.js`, and `js/game.js` (~700 lines total).

---

## 1. Making it *feel* fast

Defender's reputation was built on raw speed and panic. Several
deliberate choices recreate that:

- **Low resolution, big pixels.** The canvas is an internal
  480 × 312 buffer scaled up by an integer factor with
  `image-rendering: pixelated`. Fewer pixels means motion covers a
  larger *fraction* of the screen per frame — the same px/s reads as
  much faster than it would at 1080p.
- **High top speed with inertia.** The ship accelerates at
  900 px/s² toward a 520 px/s ceiling (more than a full screen per
  second) and coasts with weak drag when you let go. You steer a
  missile, not a cursor.
- **A camera that leads the ship.** The camera aims at
  `ship.x + facing * 110 + vx * 0.22` and eases toward it. When you
  flip direction the whole world sweeps past you — the signature
  Defender "whip pan" — and at speed you can actually see what you're
  about to hit.
- **Frame-rate independence.** The loop runs on
  `requestAnimationFrame` with a `dt` clamp of 1/30 s, and every
  velocity, timer and decay is scaled by `dt` (exponential decays use
  `Math.pow(k, dt)` so drag behaves identically at 60 Hz and 144 Hz).
- **Screen shake + white flash** on explosions and smart bombs, both
  decaying per-frame. Cheap, and it sells every impact.

## 2. The wrapping world

The world is 8 screens wide (3840 px) and circular. Two helpers make
everything else trivial:

```js
const wrapX  = (x) => ((x % WORLD_W) + WORLD_W) % WORLD_W;
const wrapDx = (a, b) => {            // shortest signed distance
  let d = wrapX(a) - wrapX(b);
  if (d >  WORLD_W / 2) d -= WORLD_W;
  if (d < -WORLD_W / 2) d += WORLD_W;
  return d;
};
```

Every distance in the game — homing AI, collision tests, camera
easing, minimap dots, stereo panning — goes through `wrapDx`, so an
enemy 100 px "behind" the seam correctly reads as 100 px away, and
mutants chase you the short way around the planet. World-to-screen is
one expression: `screenX = wrapDx(worldX, camX) + VIEW_W / 2`.

The terrain is a random walk sampled every 16 px, with the last
24 posts linearly blended back into the first so the wrap seam is
invisible. `terrainY(x)` interpolates between posts and is used for
walking humanoids, landing rescues, and crashing the ship.

## 3. Defender-style lasers

Defender's gun doesn't fire dots — it fires *rays* that streak across
the screen. Each shot here is a segment whose head moves at
1600 px/s while its tail stretches to 130 px, drawn with a
white-to-cyan linear gradient that fades to transparent. Collision
sampling checks four points along the beam per enemy per frame, so a
beam can't tunnel through a small swarmer between frames.

## 4. Enemy AI in one page

Every enemy is a plain object `{type, x, y, vx, vy, state, ...}` in a
single array, with a `switch` on type in `updateEnemies`. The
interesting ones:

- **Lander** — a 3-state machine: `seek` (drift, periodically scan
  for a walking humanoid within 50 px horizontally), `descend`
  (converge on the victim), `lift` (rise at 32 px/s with the humanoid
  attached). Reaching the top of the sky consumes the humanoid and
  rewrites `e.type = 'mutant'` in place — the object *is* the mutant
  now, which is exactly how the original conveys "that used to be a
  lander".
- **Mutant** — steers toward the player through `wrapDx` with heavy
  random jitter injected every frame (`± 400 px/s²`). The jitter is
  what makes mutants terrifying: they're unleadable.
- **Baiter** — an anti-camping mechanism. A timer spawns one whenever
  the wave has dragged on (sooner in later waves). Its speed cap is
  60 px/s *above* the ship's, so you cannot outrun it — you must turn
  and fight, which is precisely the pressure the 1981 design intended.
- **Pod → swarmers** — pods barely move, but killing one spawns 3–5
  swarmers with random burst velocities. Swarmers home like mutants
  plus a `sin(t * 9)` vertical weave, so they arrive as an oscillating
  cloud.
- **Bomber** — bounces diagonally, dropping stationary mines with an
  8-second lifetime. Mines punish flying in a straight line behind a
  bomber, i.e. the thing you most want to do.

Enemy shots are aimed at the ship with a random rotation of up to
±0.25 rad and a speed that scales with the wave, capped so late waves
get *denser* rather than undodgeable.

## 5. The audio pipeline

All 17 sounds were generated ahead of time with ElevenLabs and
committed as mp3s (`assets/sfx/`):

- **Effects** use the sound-generation endpoint
  (`POST /v1/sound-generation`) with prompts like
  *"retro 8-bit arcade laser gun zap, short sharp pew"* or
  *"urgent high-pitched alien alarm siren, fast oscillating warning
  tone"*, durations of 0.7–2.5 s and `prompt_influence` ≈ 0.5.
- **Announcer lines** ("Defend the humanoids!", "Alert! Abduction!",
  "Mutant attack!", "Wave complete!", "Game over, defender.") use the
  text-to-speech endpoint with the husky "Callum" character voice and
  high style/low stability settings for arcade drama.

At runtime (`js/audio.js`), everything decodes to `AudioBuffer`s on
the first user gesture (satisfying autoplay policy). Playback details
that matter for game feel:

- Every `play()` spawns a throwaway `BufferSource`, so ten explosions
  can overlap — arcade sound never waits its turn.
- Shots get a **random playback-rate** (0.95–1.15×) so rapid fire
  doesn't sound like a stuck sample.
- Off-screen events are **stereo-panned** by their wrapped world
  offset (`pan = wrapDx(x, camX) / halfScreen`), so you *hear* an
  abduction siren start to your left before you can see it.
- The **thruster** is a single looping source whose gain is ramped by
  `setTargetAtTime` when the thrust key goes down/up — a clickless
  swell instead of on/off chatter.
- **Voice lines duck the mix**: `say()` ramps the SFX bus down to 35%
  for the duration of the line, then back. Announcements cut through
  the chaos without a volume war. Voice triggers have per-line
  cooldowns (12–20 s) so the announcer never babbles.

## 6. The scanner

The strip across the top is a genuine minimap of the *entire* world,
player-centered: `mapX = ((wrapDx(x, camX) / WORLD_W) + 0.5) * width`.
Terrain is subsampled orange dots, each entity type keeps its body
color, the player blinks, and two bracket pairs mark the slice of
world currently on the main screen. In Defender the scanner is not
decoration — reading it *is* playing the game, because abductions
usually start three screens away.

## 7. Sprites without image files

`js/sprites.js` defines each sprite as an array of strings, one
character per pixel, with a tiny per-sprite palette:

```js
humanoid: {
  palette: { 1:'#d0a0ff', 2:'#ffffff', 3:'#9060c0' },
  rows: [ '.2.', '111', '.1.', '111', '.1.', '3.3', '3.3' ],
}
```

At boot they're rasterized once onto offscreen canvases (plus a
pre-flipped copy for left-facing), and drawn with `drawImage` — no
per-frame fillRect loops, no asset downloads, and the art is
greppable text you can edit in place.

## 8. v2: the X-wing idea

The plan for a sequel is to keep the *exact* combat loop — waves,
abduction pressure, smart bombs, the scanner — and move the camera
behind the ship for a *Star Wars* trench-run feel:

- **Rendering:** stay on canvas with a painter's-algorithm
  pseudo-3D (project `x/z`, `y/z`, sort by depth) — the Atari
  *Star Wars* (1983) wireframe look is both authentic and cheap. A
  full WebGL/three.js upgrade is the fallback if fill rate allows.
- **World:** the wrapping 1-D world becomes a wrapping cylinder —
  fly forever around the planet's equator; the scanner becomes a ring.
- **Abductions in depth:** landers rise from the surface ahead;
  the catch mechanic becomes a dive-and-scoop on the deck, which is
  naturally more dramatic in 3D.
- **Audio:** same ElevenLabs pipeline, plus Doppler (a
  `playbackRate` ramp on approach) and full 3-D panning via
  `PannerNode`; add targeting-computer voice chatter and wingman
  lines ("*Watch your back!*").
- **Controls:** pitch/yaw on the same four keys, throttle on thrust —
  the inertia model carries over almost unchanged.

## 9. Things intentionally simplified

- The original restores the planet only every fifth wave after
  destruction; here a fresh planet (and ten new humanoids) arrives
  with each new wave.
- Original Defender's per-wave enemy mix follows a fixed table;
  this version uses formulas (`15 + 3(w-1)` landers, bombers from
  wave 2, pods from wave 3) that approximate the same curve.
- Hyperspace death is a flat 12.5% rather than the original's
  proximity-weighted gamble.
