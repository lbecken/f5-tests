# Production Asset Pipeline

How to take the engine from hand-crafted SVG/procedural-audio (current state) to
professionally produced art, music, and narration — and exactly where each asset
plugs in. All slots below already exist in the code; the game runs fully without
them and upgrades gracefully as assets land.

## 1. Visual art

### Recommended: Recraft (recraft.ai)
The strongest fit for this project because it generates **native SVG/vector**
output with controllable, consistent style — the entire engine is styled around
scalable vector art (card faces, cover art, object icons, booklet illustrations),
so vector-native generation means no tracing, no resolution problems, and easy
palette re-tinting per theme via `currentColor`/CSS variables.

Workflow per theme:
1. Define one style prompt per theme ("1928 art-deco travel poster, two-color,
   gold on navy…") and generate the **cover art** first; lock its seed/style.
2. Generate in the same style: 10 card-face illustrations, 3 object icons,
   1 decoder emblem, 3–4 booklet spot illustrations.
3. Drop each SVG into the theme folder and reference it from the manifest slots:
   `coverArt`, `redCards[x].component` (as a backdrop), `objects[x].icon`,
   `intro/storyPages[x].body`.

### Alternatives / complements
- **Midjourney v7** — best raw illustration quality (raster). Use for booklet
  full-page art and box covers; upscale + compress to WebP.
- **gpt-image-1 (OpenAI) or Imagen 4 (Google)** — strong prompt adherence for
  *diagrammatic* puzzle art (maps, schematics, tickets) where layout precision
  matters; both handle text-in-image decently now, but keep real text as HTML/SVG
  overlays so puzzles stay crisp, accessible, and localizable.
- **Scenario.gg / Layer.ai** — if you want a trained style LoRA so every asset
  across all themes shares one "house style" (the physical EXIT series' strongest
  visual trait).

**Rule that keeps quality high:** AI generates the *illustration layer* only.
Anything a puzzle depends on (letters, numerals, symbols, star positions) stays
authored SVG/HTML on top — pixel-accurate, theme-recolorable, and never hallucinated.

## 2. Voices & narration — ElevenLabs (agreed)

- One **narrator voice per theme** (design a voice: gravelly horologist,
  serene station AI, dry Egyptian guardian…). Generate per-blue-card narration
  clips + intro/win page readings.
- **ElevenLabs SFX** (text-to-sound-effect) for the tactile layer: card flip,
  paper tear, ring snap, seal crack, safe clunk. Short (<1s), layered over the
  existing Web Audio ticks.
- Alternatives: OpenAI TTS (cheaper bulk), Hume AI (emotion control),
  Play.ht (many languages).

Engine hookup (small addition when assets exist): a `narrationUrl` field on
`BlueCard`/`BookletPage`, played on reveal with a mute toggle beside the music
toggle. The data model makes this a ~30-line change.

## 3. Music

Two viable routes, in order of recommendation:

### Route A — generative full-track: Suno / Udio / Stable Audio / ElevenLabs Music
Prompt 60–90s **loopable** instrumental beds per theme, three per game:
`main` (exploration), `finale` (last act), `win` (one-shot). Stable Audio is
particularly good at seamless loops and stingers; Suno/Udio give richer
arrangements (ask for "no melody drift, loopable, instrumental").

### Route B — MIDI + quality sound banks (your suggestion — best control)
Compose (or AI-generate, e.g. with Google Magenta) short MIDI motifs, then render
them through professional sample libraries — Spitfire LABS (free, excellent),
BBC SO Discover, or any Kontakt bank — in a DAW (Reaper/Logic), exporting OGG
loops. This gives *musical* control (same leitmotif intensifying per act, which
is exactly what the game's progress system wants) instead of prompt roulette.
Skip in-browser soundfont rendering (WebAudioFont/Tone.js sampler): shipping
pre-rendered OGGs is smaller, gapless, and battery-friendly.

### Engine hookup (already built)
`ThemeManifest.music.tracks = { main, finale, win }` — when URLs are present the
procedural bed switches off, `main` loops, `finale` takes over automatically at
75% story progress, `win` fires on escape. Absent tracks fall back to the
procedural generative bed, which itself already evolves with progress (filter
opens, tempo rises, second voice at 45%, heartbeat pulse at 75%).

## 4. Suggested order of investment

1. **Voice + SFX (ElevenLabs)** — biggest perceived-quality jump per dollar;
   narration transforms the blue-card reveals.
2. **Cover art + card backdrops (Recraft)** — the storefront moment.
3. **Music loops (Stable Audio or MIDI+LABS)** — the procedural bed is a decent
   placeholder; produced loops are the final polish.
