# Nature Simulations — Technical Documentation

A collection of ten interactive physics simulations (eight nature scenes plus two
human-figure biomechanics sims), written in plain JavaScript on a single 2-D `<canvas>`. The priority throughout is **physical realism**: every simulation is built
around a real physical model (or a standard computational-physics approximation of one),
with visuals layered on top. No external libraries are used — every solver below is
implemented from scratch in `js/sims/`.

**Run it:** open `index.html` in a browser (or serve the folder with any static server).
Pick a simulation from the sidebar (or keys `1`–`8`), pause with `space`. Each simulation
exposes its physically meaningful parameters as sliders.

---

## Architecture

```
index.html          UI shell, loads scripts
style.css
js/main.js          engine: sim registry, RAF loop, input, UI, shared noise
js/sims/*.js        one self-contained module per simulation
```

`js/main.js` provides:

- **The loop.** `requestAnimationFrame` with a frame-time clamp (33 ms) so a background
  tab doesn't produce a giant unstable timestep. Simulations that need it run **fixed
  physics substeps** internally (the ball integrates at 480 Hz, the water at 60 Hz ticks)
  via an accumulator — the standard technique for making numerical integration
  independent of display frame rate.
- **Value noise / fBm** (`Noise.fbm1/fbm2`): deterministic fractal noise summing octaves
  of smoothed lattice noise. Used everywhere something needs natural, band-limited
  randomness (gusts, flame turbulence, flicker).
- **A shared gust model** `gustWind(t, mean, gustiness)`: wind speed = mean × (1 + slow
  fBm envelope + fast fBm turbulence). Real atmospheric wind has a *1/f*-like gust
  spectrum — energy at many timescales — which a single sine or uniform jitter cannot
  reproduce; fractal noise can. Rain, wind and snow all consume this same model.
- Pointer state with **velocity estimation** (for throwing the ball, stirring the water).

---

## 1. Bouncing Ball (`ball.js`)

The most classically "physical" of the set — a projectile in real SI units.

**Units.** The canvas is calibrated to metres (view height = 5.2 m, `ppm` pixels per
metre); all state (position, velocity) is stored in metres and m/s and only converted to
pixels at draw time. The HUD reads out height, speed and remaining mechanical energy.

**Integration.** Semi-implicit (symplectic) Euler at a fixed 1/480 s substep:
`v += a·dt; x += v·dt`. Semi-implicit Euler is preferred over explicit Euler because it
conserves energy over long trajectories instead of systematically gaining it.

**Forces in flight.**
- Gravity `g = 9.81 m/s²` (slider goes from Moon 1.6 to Jupiter-ish 24.8).
- Quadratic aerodynamic drag, the correct regime for balls at these Reynolds numbers:
  `F = ½ ρ Cd A |v| v`, with air density ρ = 1.225 kg/m³, the ball's real cross-section
  `A = πr²` and a per-ball drag coefficient (≈0.47 for a sphere). Because the
  acceleration is `F/m`, the presets behave differently: a tennis ball (58 g) is visibly
  slowed by air, a 6.8 kg bowling ball is not. Toggleable to compare.

**Impact model.** On floor contact the normal velocity is reflected with a
**coefficient of restitution** `v' = −e·v` (basketball ≈ 0.76, superball ≈ 0.92,
bowling ball ≈ 0.30 — measured real-world values), and the tangential velocity takes a
small slip-friction loss. Successive rebound heights therefore follow the physical
`h_{n+1} = e² h_n` geometric decay.

**Coming to rest.** An ideal restitution model bounces forever (Zeno's paradox of
infinitely many, infinitely small bounces). Physically, bouncing stops once the rebound
height falls below the scale of surface roughness/contact deformation. We implement
exactly that cutoff: when the rebound apex `v²/2g` drops below 4 mm the ball transitions
to **rolling**, where it decelerates under rolling resistance `a = −C_rr · g`
(C_rr ≈ 0.01–0.03, per ball) until it stops. This produces the correct
bounce–bounce–roll–stop sequence you see in reality.

**Interaction.** Grab and throw the ball with the pointer; release velocity comes from
the tracked pointer velocity, capped at 15 m/s.

---

## 2. Falling Sand (`sand.js`)

A **granular-material cellular automaton** — the standard approach for sand at grain
resolution (a continuum solver would smear out the discrete pile behaviour that makes
sand *sand*).

**Grid.** 3 px cells; each cell is empty, sand or wall. Sand cells carry a colour (small
per-grain HSL jitter, like real quartz sand) and a **vertical velocity**.

**Fall rule.** Unlike the classic "move one cell per frame" automaton (which gives
unphysical constant-speed rain of grains), each grain accelerates: `v += g` per tick,
then attempts to move `⌊v⌋` cells downward, scanning for the first blocked cell.
Free-falling grains therefore trace parabolic-in-time trajectories like the ball does.
On landing, most of the vertical velocity is lost (inelastic grain–pile collision).

**Toppling and the angle of repose.** A blocked grain tries to slide diagonally
down-left/down-right (random order, with probability 0.85 per tick, and only if the
lateral cell is also free — grains can't teleport through walls). This local rule makes
piles self-organise to a stable slope: the **angle of repose**. Dry sand's repose angle
is ≈ 34°; the combination of slide probability and the both-cells-free condition tunes
the automaton's emergent slope to roughly that. Pour a stream in one spot and a clean
cone grows, its flanks avalanching whenever they locally exceed the stable angle —
exactly the real mechanism.

**Sweep order.** The grid updates bottom-up, alternating left→right / right→left each
frame; otherwise the automaton develops a visible lateral bias.

**Interaction.** Pour sand (with adjustable brush and flow rate), draw walls, erase. Two
hoppers trickle sand onto ledges at startup so the repose behaviour is immediately
visible.

---

## 3. Water (`water.js`)

A real fluid solver: **Smoothed-Particle Hydrodynamics**, specifically the
*double density relaxation* scheme of Clavet, Beaudoin & Poulin,
"Particle-based Viscoelastic Fluid Simulation" (SCA 2005) — a formulation prized for
producing stable, lively liquid with visible surface tension at interactive rates.

Each 60 Hz tick, for ~1 000+ particles:

1. **External forces** — gravity (scaled to ≈ 9.81 m/s² at the scene's px/m), plus the
   pointer's velocity injected into nearby particles when stirring.
2. **Viscosity** — for every particle pair within the interaction radius *h*, an
   inelastic radial impulse proportional to their approach speed
   (`(1−q)(σu + βu²)`, split between the pair). This is momentum-conserving shear/bulk
   damping; the β (quadratic) term mainly kills high-speed splatter.
3. **Prediction** — positions advance by velocity (with a CFL-style speed cap).
4. **Double density relaxation** — the heart of the method. For each particle compute
   density `ρ = Σ(1−q)²` and *near*-density `ρ' = Σ(1−q)³` over neighbours
   (`q = r/h`), then pressure `P = k(ρ−ρ₀)` and near-pressure `P' = k'ρ'`. Each pair is
   pushed apart/together by `D = dt²(P(1−q) + P'(1−q)²)` along their axis. The `P` term
   enforces **incompressibility** (particles resist packing above rest density ρ₀ and are
   *pulled back* when below it, which is what makes it a liquid rather than a gas); the
   always-repulsive near term prevents clustering and yields the **surface-tension-like**
   beading and film behaviour at the free surface.
5. **Boundaries** — walls and a rectangular obstacle are handled by position projection
   (pushed out through the nearest face). Because the scheme recomputes velocity from
   positions, projection automatically produces the right inelastic wall response.
6. **Velocity update** — `v = (x − x_prev)/dt` (the position-based-dynamics trick that
   keeps the method unconditionally stable).

**Neighbour search.** A uniform **spatial hash grid** with cell size *h* (linked lists in
typed arrays, zero allocation per frame) reduces the pair search from O(N²) to O(N).

**Rendering.** Individual particles are not what water looks like. We render
**metaballs**: every particle splats a radial-falloff density sprite into a ¼-resolution
buffer; the summed field is thresholded into a surface, shaded by depth (accumulated
density → darker, deeper blue) with a bright rim at the threshold band, then upscaled
with bilinear smoothing. This gives a continuous liquid surface with drops that visibly
merge and separate.

Physical touches to look for: the tap stream **breaks into droplets** as it falls (the
near-pressure term reproduces a Plateau–Rayleigh-like instability), splashes crown when
they hit the pool, waves slosh and settle into a **flat horizontal surface**, and the pool
level rises around the obstacle.

---

## 4. Rain (`rain.js`)

Ballistic drop physics driven by real meteorological relations.

**Drop population.** Diameters are sampled 0.5–4 mm with a distribution strongly skewed
to small drops (`0.5 + 3.5·u^2.2`), qualitatively matching the Marshall–Palmer
exponential drop-size distribution of real rain. Spawn rate scales with the
rain-rate slider (mm/h).

**Terminal velocity.** Each drop falls at the empirical **Atlas et al. (1973)** fit
to measured raindrop fall speeds:

> v_t = 9.65 − 10.3 e^(−0.6 D)  [m/s, D in mm]

so a 0.5 mm drizzle drop falls ≈ 2 m/s while a 4 mm drop falls ≈ 8.7 m/s. (Drops reach
terminal velocity within metres of fall, so simulating the full drag transient would be
invisible; using v_t directly is the physically faithful shortcut.)

**Wind coupling.** Horizontal velocity relaxes toward the shared gust model with a
size-dependent response time (small drops follow gusts more readily) — so the whole
rain field slants and sways coherently as gusts pass.

**Rendering as streaks.** A camera with a 1/55 s shutter sees a drop as a streak of
length `v × exposure` along its velocity vector — that's exactly what is drawn, so
faster (bigger) drops draw longer, steeper streaks. Three parallax depth layers scale
size, speed and brightness.

**Impacts.** On hitting the ground a drop spawns (a) a **splash crown** of ballistic
droplets (~2 m/s ejecta under full gravity, count and energy scaled by drop size) and
(b) an expanding **ripple** drawn as a grazing-angle ellipse that fades as it grows.

---

## 5. Fire (`fire.js`)

A 2-D **temperature-field combustion model** (the physically-grounded evolution of the
classic "demo-effect fire", plus particles).

**Heat field.** A grid (4 px cells) stores normalised gas temperature. Per tick:

- **Fuel bed injection.** The bottom rows inside the fire zone inject heat, hottest at
  the core, modulated by fBm **flicker** in space and time (real flames flicker at a few
  Hz because of the unsteady balance between buoyancy and entrainment — noise-driven
  injection reproduces that band-limited unsteadiness).
- **Buoyant advection.** Each cell samples the row below it — hot gas rises — at a
  **laterally offset** position given by a time-scrolling turbulence field (fBm), with
  bilinear interpolation. This offset advection is what makes the flame lick, lean and
  detach tongues rather than rise as a static column. A wind slider adds a constant
  shear. A small lateral diffusion term keeps the flame body connected.
- **Cooling.** Temperature decays by a base radiative term plus a noise-patterned term
  representing parcels of entrained cold air; flame height emerges as the height where
  injected heat has cooled to invisibility (≈ fuel/cooling-rate cells), so the fuel
  slider directly and physically controls flame height.

**Colour.** Temperature maps through a 256-entry **blackbody-style ramp**
(black → deep red → orange → yellow → white-blue at the very hottest), composited
additively (`lighter`) — hot gas is an emitter, so additive blending is the physically
right compositing mode.

**Particles.** Embers spawn in the hot zone and rise with buoyancy proportional to
their own temperature, jittered by the same turbulence, cooling (dimming red-ward) until
they wink out. Smoke puffs rise above the flame tip, drift with the wind, and **grow
while fading** (turbulent diffusion of an initially compact parcel).

---

## 6. Wind (`wind.js`)

Wind itself is invisible — the simulation is really four coupled demonstrations of the
same velocity field, which is what makes it read as *wind* rather than as independent
animations.

**The field.** Horizontal speed = shared gust model (mean × slow fBm gust envelope ×
fast turbulence), with an additional spatial fBm factor whose phase **travels with the
mean flow** — so a gust front visibly sweeps across the scene from upwind to downwind,
arriving at the grass slightly after you see the tracers accelerate. A small fBm
vertical component adds updrafts/downdrafts. The HUD reads m/s, km/h and the Beaufort
description.

**Tracers.** ~260 massless particles advected directly by the field, drawn as short
streaks along their displacement (dust/smoke revealing streamlines, à la windy.com).

**Grass.** Every blade is a **driven damped harmonic oscillator**:
`θ̈ = ωn²(θ_target − θ) − 2ζωn θ̇`, where the equilibrium deflection θ_target comes from
the aerodynamic load — dynamic pressure `q = ½ ρ u|u|` — divided by a per-blade
stiffness (thicker/longer blades are stiffer, with their own natural frequency ωn and
underdamped ζ ≈ 0.3). The result: blades bend to a new equilibrium in a gust,
**spring back and overshoot** when it passes, and neighbouring blades sway with
different phase — the visual signature of real grass. Rendered as quadratic curves
bending from the root.

**Leaves.** Have mass: velocity relaxes toward the local air velocity with a response
time (drag), gravity pulls down, an alternating lift term coupled to their tumble angle
makes them flutter and side-slip rather than translate rigidly. On the ground they skid
with friction, and a sufficiently strong gust (u > 6 m/s) can **loft them back into the
air** — leaf saltation, as in reality.

---

## 7. Snow (`snow.js`)

**Falling flakes.** Snowflakes are extremely low-density, high-drag objects: terminal
velocity is ~0.5–1.5 m/s and nearly independent of size (bigger flakes are fluffier,
not denser) — each flake gets a value in that measured range. On top of the mean fall:

- **Flutter**: real flakes oscillate side-to-side from unsteady vortex shedding; each
  flake gets its own oscillation amplitude (8–26 px), frequency (0.8–2.2 Hz) and phase.
- **Wind drift** from the shared gust model, with a fast response time (flakes are
  light), so the whole snowfall leans coherently in gusts.
- Three parallax layers (scale, speed, brightness) for depth.

**Accumulation.** The ground and the cabin roof each carry a **per-column height
field**. A landing flake deposits mass (proportional to its size) spread over a few
columns. Every frame the height fields **relax granularly**: wherever the local slope
between adjacent columns exceeds the repose slope of settling snow (tan 35°), a fraction
of the excess flows downhill — the same angle-of-repose physics as the sand automaton,
but on a height field. Drifts therefore grow with smooth, natural profiles instead of
spikes. Snow that relaxes past the **roof edges spills off** and is re-deposited on the
ground below, building the tell-tale pile under the eaves. The HUD tracks the deepest
drift in cm.

---

## 8. Lightning (`lightning.js`) — bonus

Cloud-to-ground lightning follows a well-understood sequence, and the simulation
reproduces each phase:

1. **Stepped leader.** A channel of ionised air descends from the cloud in discrete
   ~50 m jerky steps, forking into branches. Modelled as a biased random walk: each tip
   extends in segments with downward bias and per-step angular jitter, and spawns
   branch tips with a probability that decays with branch depth; branches are thinner
   (w × 0.55 per generation) and dimmer. Propagation is spread over many frames —
   slowed ~10 000× from the real ~2×10⁵ m/s — so the normally invisible leader phase
   can be watched.
2. **Return stroke.** The instant the main channel connects to ground, the stored
   charge drains: the whole channel (and the sky) flashes at full brightness with a
   fast exponential decay. Rendered as a wide additive glow pass under a white-hot core
   pass, with the scene's ambient light keyed to the flash.
3. **Restrikes.** Real flashes flicker because 2–4 dart leaders re-illuminate the same
   channel at ~50 ms intervals — reproduced with randomised restrike timing and
   decaying intensity.
4. **Thunder.** Each strike is assigned a distance; the HUD notes when the thunder
   would arrive at 340 m/s (the familiar "count the seconds" rule).

Background rain (simplified) sets the storm scene. Click to trigger a strike on demand.

---

## 9. Running Figure (`figure.js` + `runner.js`)

A human stick figure whose stride is generated from **measured running kinematics** — the
sagittal-plane joint-angle trajectories of the gait cycle — rather than a hand-drawn loop.
(An earlier version derived the legs from a spring-mass SLIP physics model; that is
dynamically correct but read as stiff and unnatural, so the figure is now driven directly
by the joint-angle curves that dominate how running actually *looks*.)

**The figure.** Built to the classical **7.5-head canon** (1 unit = one head height),
landmarks matching standard figure-drawing / anthropometric references: shoulders at 1.5
heads from the top, pelvis at 4.0, knee ~5.9, sole at 7.5. Drawn in the **sagittal (side)
plane** — the plane running lives in — with near-side limbs bright and far-side limbs
dimmed for depth. A shared two-link **inverse-kinematics** solver places knees/elbows, and
crucially picks the correct bend direction (knees always bulge *forward*), which fixes the
"backwards leg" look.

**The gait clock.** A single phase φ advances at the cadence (derived from the speed
slider); the two legs are half a cycle out of step. **Stance is ~38% of the cycle** — a
running-specific value (the swing phase is ~62%), which means there are two **flight
phases** per stride where neither foot is down. The hip rises and falls **twice per
stride**, lowest at mid-stance and highest during flight: the running "bounce".

**Swing leg — forward kinematics from real angle curves.** The signature of a natural
stride is what the swing leg does, and it is taken straight from gait data:

- the **thigh** swings from ~20° behind vertical at toe-off to ~25° in front by the next
  foot strike;
- the **knee** flexes to ~**100–110°** in mid-swing — heel tucked up toward the buttock,
  high knee — then re-extends to ~20° to reach forward for the next strike. (Measured
  running knee flexion peaks around 90–125° in mid-swing.)

This heel-up, high-knee recovery is exactly what was missing before.

**Stance leg — inverse kinematics to a planted foot.** At foot strike the contact point
is pinned to the ground and the stance leg is IK-solved up to the moving hip, so **the
foot never skates**. As the hip passes over the plant the knee flexes (impact absorption)
then extends (push-off) for free, because the hip is bobbing down and back up.

Arms counter-swing to the legs with a flexed (~90°) elbow; the trunk leans forward with
speed. HUD shows speed, cadence (steps/min), step length, distance and phase. Sliders:
running speed and the vertical "bounce" amplitude; a **slow-mo** toggle lets you inspect
the stride.

## 10. Jump & Fall (`figure.js` + `jumper.js`)

The same 7.5-head figure performing a **countermovement jump** and landing, following the
real biomechanical phase sequence, with a physically-decided outcome.

**Phases** (all on the COM, SI units rendered in pixels):
1. **Countermovement (crouch)** — the COM dips as hips/knees/ankles flex (the eccentric
   pre-stretch that loads the legs).
2. **Propulsion** — the legs extend and the COM accelerates upward. The push-off
   acceleration is *derived from the target height*: to reach height *h* the body needs
   take-off speed `v = √(2gh)`, delivered over the leg-extension distance *d*, so the
   required acceleration is `a = v²/2d`. The height slider is therefore a real target hit
   by real kinematics.
3. **Take-off → Flight** — once the legs reach full extension the figure becomes a
   ballistic projectile (arms thrown overhead, as arm-swing genuinely augments jump
   height). Forward leaps add a horizontal component and carry off the ledge.
4. **Landing** — at foot contact the landing speed is known, and the legs brake the COM
   over their flex distance. The peak **ground-reaction force in bodyweights** is
   `BW = 1 + v_land²/(2·d·g)`.

**The collapse criterion.** If the landing force stays within what flexing legs can
absorb (`BW ≤ ~8.5`), the figure flexes and springs back to standing — a *stuck* landing.
If it exceeds that limit, the legs can't dissipate the impact and the body **collapses
into a Verlet ragdoll**: the skeleton becomes a set of point masses linked by stiff
**distance constraints** (bone lengths), integrated with Verlet integration under gravity,
with ground/ledge collision and friction, and constraints relaxed over several iterations
per step. The ragdoll inherits the COM's velocity, then tumbles and settles naturally.

So the same physics decides the outcome: a gentle hop off a low ledge is stuck cleanly
(~2 BW); a 4 m drop generates ~12 BW, overwhelms the legs, and the figure crumples. Set
the jump height and drop height, then use **Jump up**, **Leap off ledge**, or **Reset**.
The HUD reports the phase, apex height, and the landing force with the collapse limit.

### References used for the two figures

- **Running gait joint angles** used to drive the swing leg (thigh sweep; mid-swing knee
  flexion ~90–125° with heel recovery; stance ≈ 38% / swing ≈ 62% of the cycle):
  running-biomechanics / gait-analysis literature — e.g. Physiopedia, *Running
  Biomechanics*; ScienceDirect gait-cycle overviews.
- **Countermovement-jump** phase structure (unweighing → braking → propulsion → flight →
  landing) and landing force absorption: CMJ biomechanics literature (e.g. Hawkin
  Dynamics, *Phases of the CMJ*; PMC, *Vertical Ground Reaction Forces in the Landing
  Phase of a Countermovement Jump*).

## Performance notes

Everything runs at 60 fps at 1280×800 in a single thread:

- Typed arrays (`Float32Array`/`Uint8Array`/`Uint32Array`) for all grids and particle
  state; zero per-frame allocation in the hot loops (the water solver's per-tick
  density arrays are the one deliberate exception).
- Grid sims (sand, fire) write pixels into an `ImageData` at grid resolution and let
  the GPU upscale (`drawImage`), with smoothing off for sand (crisp grains) and on for
  fire (soft gas).
- The water's O(N) spatial hash makes ~1 000–2 500 particles with two full pairwise
  passes per tick comfortably real-time; metaball compositing happens at ¼ resolution.
- Fixed-timestep substepping decouples physics accuracy from render rate.

## Known simplifications

Honest limits of the models (all standard for interactive simulation):

- The ball has no spin/Magnus force; restitution is velocity-independent.
- The sand automaton's repose angle is an emergent approximation, not calibrated per
  material; grains are single-sized.
- The water is 2-D and the SPH parameters are in pixel units tuned to look/behave like
  water at this scale rather than derived from the Navier–Stokes coefficients of real
  water.
- Fire is a heat-field heuristic of buoyant convection, not a Navier–Stokes smoke/flame
  solver; radiation and chemistry are folded into the cooling and palette.
- Rain/snow use terminal-velocity shortcuts instead of integrating drag from rest
  (indistinguishable visually, since the transient is over in metres).
- Lightning geometry is a biased random walk, not a dielectric-breakdown field solve.
