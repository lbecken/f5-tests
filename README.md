# UMLdraw

A free, modern UML diagram builder for the browser — an "Excalidraw version of
a UML builder". It embeds the MIT-licensed
[Excalidraw](https://github.com/excalidraw/excalidraw) editor and adds a UML
stencil palette on top, so you get a hand-drawn-style infinite canvas with
full editing (move, resize, connect, label) plus ready-made UML shapes.

See [docs/RESEARCH.md](docs/RESEARCH.md) for the research and analysis of
existing UML tools and libraries that led to this design.

![UMLdraw](docs/screenshot.png)

## Features

- **6 diagram types** in the palette: Class, Package, Sequence, Activity,
  State, Use Case (~45 stencils: class boxes with compartments, interfaces,
  all UML relationship arrows, lifelines, activations, messages, fragments,
  activity/state nodes, actors, use cases, «include»/«extend», …)
- **Drag & drop** stencils onto the canvas, or click to insert at the center
- Everything Excalidraw can do: move, resize, rotate, edit labels
  (double-click), arrows that stay bound to shapes, undo/redo, zoom/pan,
  multi-select, alignment, dark mode
- **Autosave** to `localStorage` — close the tab, come back, your diagram is
  still there (no server, no database)
- **Save / Open** standard `.excalidraw` files (interoperable with
  excalidraw.com)
- **Export** to PNG and SVG
- Fully client-side and offline-capable (fonts are self-hosted); TypeScript +
  React + Vite

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build (static files, host anywhere or open via any static server):

```bash
npm run build
npm run preview    # serves dist/ at http://localhost:4173
```

## Smoke test

A headless-Chromium end-to-end test (insert via click and drag & drop,
autosave, PNG export, theme toggle):

```bash
npm run build
npm run preview -- --port 4173 &
npm run smoke      # set CHROMIUM_PATH if Chromium lives elsewhere
```

## Project structure

```
src/
  App.tsx                  app shell: canvas, insert/save/load/export logic
  components/Palette.tsx   UML stencil sidebar (search, groups, SVG previews)
  components/Toolbar.tsx   top bar (New / Open / Save / PNG / SVG / theme)
  stencils/index.ts        all UML shape definitions (element skeletons)
  stencils/types.ts        skeleton helpers (bounds, translation)
scripts/
  copy-fonts.mjs           self-hosts Excalidraw fonts (runs before dev/build)
  smoke.mjs                Playwright smoke test
```

## How stencils work

Each stencil is a list of Excalidraw *element skeletons* (see
`src/stencils/index.ts`). On insert they are converted to real elements with
`convertToExcalidrawElements()` and appended to the scene — from then on they
are ordinary Excalidraw shapes. Adding a new stencil is a ~10-line change.
