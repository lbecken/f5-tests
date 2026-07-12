# UML Builders: Research & Analysis (July 2026)

Goal: a free, modern-looking UML builder in the browser, supporting the most
used diagram types (Class, Package, Sequence, Activity, State, Use Case) with
drag & drop, editing, moving, resizing, and save/load — preferably TypeScript,
canvas-based, in the spirit of Excalidraw.

## 1. Landscape of existing tools

### Visual editors (drag & drop)

| Tool | License / cost | UML support | Modern UI? | Notes |
|---|---|---|---|---|
| **diagrams.net (draw.io)** | Apache 2.0, free | Full UML shape libraries | Middling — functional but dated, very dense UI | The de-facto free choice today; desktop + web; the closest existing answer to "free UML builder" |
| **StarUML** | Paid (~$99), closed source | Full UML 2.x, model-driven | Yes, polished desktop app | Real modeling tool (semantic model, not just drawing) |
| **Miro / Lucidchart / Gliffy** | Freemium SaaS | UML shape packs | Yes, very modern | Cloud-only, diagrams live in their walled garden, free tiers are limited |
| **Visual Paradigm Online / Community** | Freemium | Full UML | Web version modern-ish | Heavy, nags to upgrade |
| **Gaphor** | Apache 2.0 | UML/SysML/C4, semantic model | Clean GTK desktop UI | Python desktop app, not web |
| **Eclipse Papyrus / Modelio** | Open source | Full UML/MDA | No — classic IDE-era UI | Powerful but the opposite of "modern & light" |
| **Apollon (TUM)** | MIT | 13 diagram types incl. all 6 targets | Yes — clean, minimal, React | The closest existing open-source match: an embeddable UML editor written in React + TypeScript (`@ls1intum/apollon`), with a hosted standalone app |
| **Excalidraw** | MIT | None built-in (community shape libraries exist) | Yes — the benchmark for "modern canvas UI" | Whiteboard, not a UML tool, but embeddable as a React component with a full programmatic API |

### Text-to-diagram (no drag & drop — different philosophy)

| Tool | License | Notes |
|---|---|---|
| **PlantUML** | GPL, free | Most complete UML coverage anywhere; UI/rendering aesthetics essentially frozen for a decade (themes help a bit) |
| **Mermaid** | MIT | The modern PlantUML: markdown-ish syntax, built into GitHub/GitLab/Notion/Obsidian; covers class/sequence/state/ER and more; layout is automatic, not hand-arranged |
| **D2** | MPL 2.0 | Newest of the three, nicest default aesthetics, good auto-layout |
| **Kroki** | Open source | Rendering API that wraps PlantUML, Mermaid, Graphviz, etc. |

Takeaway: if you want *text-first* UML with a modern look, Mermaid or D2
already solve it. If you want *hands-on* drag/move/resize editing that is free
and open source, the field is basically diagrams.net (dated UI), Apollon
(little known but very good), or building something on a canvas library.

## 2. Libraries you could build on (so you don't start from scratch)

| Library | License | What it gives you | Fit for this project |
|---|---|---|---|
| **@excalidraw/excalidraw** | MIT | The entire Excalidraw editor as a React component: canvas, selection, move/resize, arrows with binding, text editing, undo/redo, export PNG/SVG, `.excalidraw` JSON format, dark mode, imperative API (`updateScene`, `convertToExcalidrawElements`, `exportToSvg`, …) | **Excellent** — you write only the UML layer |
| **@ls1intum/apollon** | MIT | A complete embeddable UML editor (semantic elements, all 6 target diagram types) | Excellent if you want *semantic* UML; less "Excalidraw feel", less flexible drawing |
| **React Flow (@xyflow/react)** | MIT | Node/edge graph editor primitives; you build every node type yourself | Good, but class compartments, resize handles, edge markers etc. are all DIY — weeks of work |
| **JointJS** | MPL 2.0 (community) | SVG diagramming with a real graph model; UML demos exist | Good; the best bits (advanced routing, UI widgets) are in the paid JointJS+ |
| **maxGraph** | Apache 2.0 | Successor of mxGraph — the engine inside draw.io | Powerful but low-level, older-style API |
| **tldraw** | Proprietary ("tldraw license") | Beautiful infinite-canvas SDK | ❌ Requires a paid license key in production since SDK 4.0 — ruled out for a free tool |
| **GoJS** | Commercial | Everything | ❌ Paid |
| **Konva / Fabric.js** | MIT | Raw canvas scene graph only | Too low-level: selection, undo, text editing, persistence all DIY |

## 3. Is it difficult to build one?

Depends entirely on where you start:

- **From scratch (Konva/canvas):** hard. Selection, marquee, resize handles,
  arrow routing + re-binding when shapes move, inline text editing, undo/redo,
  clipboard, export — that's months of solid work before UML even enters.
- **From graph primitives (React Flow, JointJS, maxGraph):** medium. The
  canvas mechanics exist, but every UML node type, marker, and interaction is
  still custom. A polished result is weeks of work.
- **From a finished editor (Excalidraw or Apollon):** easy-to-medium. The
  editor is done; the work is the UML layer (shape definitions, palette,
  file handling). A functional, genuinely modern tool in days.

## 4. Recommendation and what was built

**An "Excalidraw version of a UML builder" is realistic — and it's the best
option.** Excalidraw is MIT-licensed, ships as an embeddable React + TypeScript
component, renders to canvas, and already provides *every* interaction on the
requirements list (drag, move, resize, edit labels by double-click, arrows that
stay attached to shapes, undo/redo, dark mode, PNG/SVG export, `.excalidraw`
JSON save/load). What it lacks is UML vocabulary — so that is what this repo
adds:

- **UMLdraw** (this repo): Vite + React + TypeScript app embedding the
  Excalidraw editor.
- A **stencil palette** with ~45 UML shapes across the 6 target diagram types,
  defined as Excalidraw "element skeletons" (`convertToExcalidrawElements`):
  class/interface/enumeration boxes with compartments, all 7 class-relationship
  arrow styles (inheritance ▷, composition ◆, aggregation ◇, dependency ⇢ …),
  packages, lifelines/activations/messages/fragments, activity nodes
  (initial/final/decision/fork/swimlane), states and transitions, actors,
  use cases and «include»/«extend».
- Palette previews are rendered live by Excalidraw's own SVG exporter, so they
  always look exactly like what lands on the canvas.
- **Insert by drag & drop or click**; inserted shapes are normal Excalidraw
  elements — fully editable, resizable, connectable.
- **Persistence:** autosave to `localStorage` (survives reload — no server, no
  DB needed), plus Save/Open of standard `.excalidraw` files (interoperable
  with excalidraw.com), plus PNG/SVG export. No backend at all; `sqlite` would
  be overkill for single-file documents.
- Fonts are self-hosted, so the app works fully offline.

### Trade-off to be aware of

Excalidraw shapes are *drawings*, not a semantic UML model: the app doesn't
know that a box is a "Class", so it can't validate models, auto-layout, or
generate code the way StarUML/PlantUML can. For visual communication (the
common case) that's fine. If you ever want semantic UML in the same modern
style, **Apollon** (`@ls1intum/apollon`, MIT) is the library to embed — that
would be the recommended "v2 direction" if drawing-only ever feels limiting.

## 5. Sources

- [PlantUML alternatives overview (AlternativeTo)](https://alternativeto.net/software/plantuml/)
- [Beyond PlantUML — open source diagramming alternatives](https://profullstack.substack.com/p/beyond-plantuml-the-best-open-source)
- [Mermaid vs PlantUML comparison](https://www.gleek.io/blog/mermaid-vs-plantuml)
- [Excalidraw npm package](https://www.npmjs.com/package/@excalidraw/excalidraw) and [integration docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/integration), [API docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api)
- [Apollon UML editor (GitHub)](https://github.com/ls1intum/Apollon), [npm](https://www.npmjs.com/package/@ls1intum/apollon), [docs](https://apollon-library.readthedocs.io/en/stable/user/getting-started.html)
- [tldraw license](https://tldraw.dev/community/license) and [pricing](https://tldraw.dev/pricing)
- [maxGraph (Apache 2.0)](https://maxgraph.github.io/maxGraph/docs/manual/)
- [JavaScript diagramming libraries roundup (JointJS blog)](https://www.jointjs.com/blog/javascript-diagramming-libraries)
- [React Flow vs JointJS comparison](https://www.synergycodes.com/blog/react-flow-vs-jointjs-react-wrapper)
