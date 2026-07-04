# EXIT Engine

A reusable, web-based escape-room engine in the spirit of Kosmos's *EXIT: The Game* — red puzzle cards, a numbered answer deck, symbol-indexed 3-tier hint cards, and a rotating 3-ring decoder — plus three complete, original themed adventures built on top of it.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

No backend — progress is saved per-theme to `localStorage`.

## The three games

- **The Clockmaker's Last Wind** — steampunk mystery in a vanished horologist's workshop.
- **Abyssal Station 7** — sci-fi survival aboard a sealed deep-sea research station.
- **The Witch's Hourglass** — gothic fantasy in a cursed forest cottage.

Each is a standalone data pack (`src/themes/<id>/theme.tsx`) with ~9 puzzles, a decoder configuration, story booklet pages, inventory objects, and hand-drawn SVG art — no two themes share content, only the engine underneath them.

## Architecture

```
src/engine/          theme-agnostic core
  types.ts           ThemeManifest contract every theme implements
  store.ts            Zustand store: unlocked/drawn cards, hints, inventory, save/load
  icons.tsx           shared "lock symbol" icon set (ties red-card puzzles to green hint cards)
  audio.ts            procedural Web Audio ambient beds + UI stingers (no audio files)
  components/         Card flip, deck browser, decoder (react-three-fiber), booklet,
                       object tray, hint panel, code entry, game shell, win screen
  puzzles/             reusable puzzle widgets (cipher, counting, mirror, color-mix,
                       maze, logic grid, morse, fold, overlay, sequence) — themes
                       compose these with their own content/answers

src/themes/<id>/theme.tsx   a ThemeManifest: story, red/blue/green cards, decoder
                            config, objects, palette, music profile
```

### How a "room" plays out

1. **Red cards** carry the puzzles. A card only appears in the Puzzle Deck once a blue card has unlocked it; the player still has to browse the deck and draw it themselves.
2. Solving a puzzle yields a code — either typed directly, or dialed on the **decoder** (three draggable concentric rings; align a puzzle's symbols under the marker to reveal the digits).
3. That code is a **blue card's** id. The player searches the Answer Deck for it and flips it — it narrates the result, and either unlocks new red cards / inventory objects, or (for decoy codes) just a wrong-path flavor line.
4. Stuck? **Green cards**, indexed by the same symbol as the puzzle, offer three progressively more revealing hints.
5. Solving the theme's final red card wins the game and shows a time/hints/attempts score.

### Adding a new theme

Implement a `ThemeManifest` (see `src/engine/types.ts`) in a new `src/themes/<id>/theme.tsx`, add it to the `THEMES` array in `src/App.tsx`. Reuse the widgets in `src/engine/puzzles/` for puzzle content, or add a new widget there if you need a mechanic none of the existing ones cover.
