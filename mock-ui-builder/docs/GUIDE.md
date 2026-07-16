# PF Mock Builder — How it works & how to extend it

This document explains the application's architecture, how the "PrimeFaces rendering"
is achieved in a purely static app, and the exact steps to add new components to the
palette.

---

## 1. What the application is

PF Mock Builder is a **browser-local UI mock layout builder**: you sketch a screen by
dragging placeholder components from a palette onto a free-form canvas (Balsamiq-style),
then press **▶ Render** to see the same layout drawn as realistic **PrimeFaces**
components filled with generated mock data. Layouts ("recipes") are saved as JSON —
to browser storage, or exported/imported as portable `.mock.json` files.

There is **no server, no build step, and no external dependency**. Opening
`index.html` from disk is the entire deployment.

```
mock-ui-builder/
├── index.html          app shell: toolbar, palette, canvas, inspector, modal, toast
├── css/
│   ├── app.css         builder chrome (toolbar/palette/inspector), selection UI,
│   │                   wireframe treatment, render-mode rules
│   └── prime.css       hand-written recreation of the PrimeFaces "Saga" theme
└── js/
    ├── mockdata.js     deterministic mock data generator        → window.MockData
    ├── components.js   component registry (palette → PrimeFaces) → window.Registry
    ├── sample.js       demo layout loaded on first run           → window.SAMPLE_LAYOUT
    └── app.js          state, canvas interactions, undo/redo, save/load, modes
```

Plain `<script>` files sharing globals are used instead of ES modules on purpose:
browsers block `import` over `file://`, and the requirement is that a double-click on
`index.html` always works.

---

## 2. How the PrimeFaces look is achieved without JSF

This is the most common question about the app, so here is the full picture.

**PrimeFaces components don't exist in the browser.** A tag like `<p:dataTable>` is a
*server-side renderer*: at request time, JSF/PrimeFaces turns it into plain HTML
(`<div class="ui-datatable"><table>…`), and the page links a theme stylesheet (Saga,
Nova, …) that styles those class names. The browser never sees anything but
**HTML + CSS**. JavaScript only adds behavior — which this app deliberately doesn't
need ("no behavior, just realistic rendering").

So the app reproduces the **end product** instead of running the generator:

1. **Markup imitation** — every entry in `js/components.js` has an `html(props)`
   function that emits markup *structurally equivalent* to what PrimeFaces renders
   for that component (a dropdown is a bordered flex box containing a label part and
   a chevron trigger part; a DataTable is header bar + `<table>` + paginator strip;
   a dialog is header/content/footer with the Saga shadow; and so on).

2. **Theme imitation** — `css/prime.css` is a hand-written recreation of the Saga
   design language, driven by CSS custom properties that mirror Saga's tokens:
   primary `#2196F3`, text `#495057`, borders `#ced4da`/`#dee2e6`, surface `#f8f9fa`,
   the severity palette (success `#689F38`, info `#0288D1`, warning `#FBC02D`,
   danger `#D32F2F`, help `#9C27B0`), 4px radii, PrimeFaces paddings and font sizes.
   Class names are kept PrimeFaces-flavored (`p-button`, `p-inputtext`,
   `p-datatable`, `p-highlight`, …) so the stylesheet reads like a theme.

3. **Icons** — PrimeIcons is a web font that would have to be fetched, so all icons
   are tiny inline `<svg>` paths defined once in `components.js` (chevrons, check,
   search, calendar, upload, …). Nothing external is ever loaded.

4. **Mock data** — `js/mockdata.js` produces deterministic, index-based data (names,
   countries, prices, dates, chart series). Deterministic means a layout renders
   identically every time, on every machine — important for a mock you share with
   others. DataTable columns are resolved by header name: a column called `Email`,
   `Price`, `Status` or `Date` automatically gets plausible values of that kind.

5. **One markup, two looks** — here is the trick that keeps sketch and render in
   sync. The *same* generated markup is shown in both modes; the only difference is
   CSS. In edit mode, `app.css` applies a wireframe treatment:

   ```css
   body:not(.render-mode) .comp-inner {
     filter: grayscale(1) contrast(.92);
     opacity: .9;
   }
   ```

   which drains the Saga colors into a Balsamiq-like gray sketch. Pressing
   **▶ Render** simply removes that filter (and hides editing chrome: grid,
   handles, drop hints). Because there is no second rendering path, the rendered UI
   is *pixel-for-pixel* the layout you sketched — nothing can drift.

**Trade-off to be aware of:** the components are faithful lookalikes, not the real
thing. If PrimeFaces restyles a component in a future theme, `prime.css` won't know.
For a layout/communication tool that is exactly right; if pixel-perfect fidelity to a
specific PrimeFaces version ever becomes a requirement, the clean JSON recipe format
(section 4) could be fed to an alternative renderer (e.g. a small PrimeVue page)
without touching the builder.

---

## 3. Application architecture

### State

`app.js` keeps a single mutable state object:

```js
state = {
  canvas: { title, width, height, chrome: 'browser'|'window'|'none', grid: true },
  components: [ { id, type, x, y, w, h, props: {…} }, … ]   // array order = z-order
}
```

- `type` is the registry key (`'dataTable'`, `'commandButton'`, …).
- `parent` (optional) is the id of the **container** component this one is nested
  in (Panel, Card, Fieldset, TabView, Dialog, Sidebar, OverlayPanel — the defs
  flagged `container: true`). Coordinates always stay absolute; the parent link is
  what makes children follow container moves and cascade on delete/duplicate.
  Membership is (re)assigned automatically when a drag ends: the component's center
  point is tested against container bounds, topmost container wins.
- `props` stores **only values that differ from the definition's defaults** —
  defaults are merged at render time by `Registry.resolve()`. This keeps recipes
  small and lets defaults evolve without breaking old files.
- The array index doubles as z-order; "bring to front" is just an array move.

### Rendering pipeline

`renderAll()` rebuilds the canvas DOM from state: one `div.comp` (absolute position,
size, z-index) per component, whose inner HTML comes from
`Registry.render(component, mode)`. During drags, only styles/`renderComp()` are
touched for smoothness; the full rebuild happens on commit. The selection outlines
and resize handles live in a separate `#overlay` layer that is `pointer-events: none`
except the handles, so it never blocks canvas clicks.

### Interactions

- **Palette → canvas**: pointer-based drag with a ghost element (works with the zoom
  transform, unlike native HTML5 DnD), or double-click to add at center.
- **Move/resize**: pointer drags with 10px grid snapping; 8 handles on single
  selection; marquee selection on empty canvas; Shift+click toggles membership.
- **Undo/redo**: JSON snapshots pushed *before* each mutation (capped at 100).
  Property fields snapshot on focus and commit on change, so typing is one undo step.
- **Zoom**: a CSS `transform: scale()` on the canvas wrapper; all pointer math
  divides by the zoom factor.

### Persistence

| Mechanism | Where | When |
|---|---|---|
| Autosave | `localStorage` `pfmb.autosave.v1` | on every committed change |
| Named layouts (Save/Open) | `localStorage` `pfmb.layouts.v1` | on demand |
| Export/Import | `*.mock.json` file download / file picker | on demand |
| PNG export | `*.png` download (2× resolution) | on demand |
| UI preferences (collapsed palette) | `localStorage` `pfmb.ui.v1` | on toggle |

The first three share the same JSON recipe format. PNG export re-renders the layout
into an SVG `<foreignObject>` together with the page's collected CSS, rasterizes it
on an off-screen canvas, and downloads the result — no library, fully offline. It
captures whichever mode is active (rendered, or the grayscale wireframe).

---

## 4. Layout recipe format

```json
{
  "app": "pf-mock-layout",
  "version": 1,
  "savedAt": "2026-07-09T22:00:00.000Z",
  "canvas": { "title": "Sales Admin", "width": 1180, "height": 830,
              "chrome": "browser", "grid": true },
  "components": [
    { "id": "c1", "type": "dataTable", "x": 20, "y": 260, "w": 720, "h": 350,
      "props": { "columns": "Name\nCountry\nStatus", "rows": 6, "paginator": true } }
  ]
}
```

Loading is defensive: the `app` magic string is checked, unknown component types are
dropped, and missing canvas fields fall back to defaults — so recipes survive
version differences in both directions.

---

## 5. Adding a new component: step by step

Everything about a component lives in **one registry entry** plus **its CSS**. The
palette, inspector, save format, wireframe mode and render mode all derive from the
entry automatically.

### Step 1 — declare the component in `js/components.js`

Add a `def(…)` call in the section matching its category. Worked example: a
`p:inputOtp`-style one-time-code input.

```js
def('inputOtp', {
  name: 'Input OTP',            // palette display name
  pf: 'p:inputOtp',             // the PrimeFaces tag it maps to (shown in UI)
  cat: 'Form',                  // palette category (see Registry.categories)
  w: 220, h: 44,                // default size when dropped
  props: [                      // inspector schema, in display order
    { k: 'digits', n: 'Digits',      t: 'num',  d: 4 },
    { k: 'filled', n: 'Show value',  t: 'bool', d: true },
    { k: 'mask',   n: 'Masked',      t: 'bool', d: false }
  ],
  html: (d) => {                // d = props merged with defaults
    const n = Math.max(1, Math.min(8, d.digits | 0));
    let cells = '';
    for (let i = 0; i < n; i++) {
      const ch = d.filled ? (d.mask ? '•' : String((i * 3 + 1) % 10)) : '';
      cells += `<span class="p-otp-cell">${ch}</span>`;
    }
    return `<div class="p-otp">${cells}</div>`;
  }
});
```

The field reference:

| Field | Meaning |
|---|---|
| `type` (1st arg) | Registry key. **Stored in saved layouts — never rename it** once released; add a new type instead. |
| `name`, `pf`, `cat` | Palette/inspector display. `cat` must be one of `Registry.categories` (add a new category there if needed — it shows up automatically). |
| `w`, `h` | Default drop size in canvas px (snapped to the 10px grid, so multiples of 10 look best). |
| `props` | Array of `{k, n, t, d, o?}`: key, label, type, default, options. Types: `text`, `num`, `bool`, `sel` (dropdown — supply `o: ['a','b']`), `list` (textarea, one item per line — read with the `lines()` helper). |
| `html(d, c, mode)` | Returns the markup. `d` = resolved props, `c` = the placed component (rarely needed), `mode` = `'edit'` or `'render'` — only branch on it when the two looks must differ structurally (see `photoBox()` for the image placeholder example). |

Helpers available inside the file — use them instead of reinventing:

- `esc(s)` — **always** escape user-editable prop values interpolated into HTML.
- `lines(s)` — splits a `list`-type prop into trimmed non-empty lines.
- `I.chevD`, `I.check`, `I.search`, … — inline SVG icons; add new ones to the `I`
  map with the same `svg()`/`ST` helpers.
- `btn(label, {icon, sev, style, cls})` — a Saga-styled button.
- `checkboxBox(checked)`, `radioBox(checked)`, `stars(v, max)`,
  `listRows(opts, selIdx, cls)`, `tableHtml(d, opts)`, `paginatorHtml()`,
  `photoBox(mode, i, label)` — shared fragments.
- `M` (= `MockData`) — deterministic data: `M.fullName(i)`, `M.price(i)`,
  `M.rows(n)`, `M.series(n, min, max, seed)`, `M.lorem(words)`,
  `M.cell(columnName, rowIndex)`…

### Step 2 — style it in `css/prime.css`

Add rules for the new classes in the matching section, using the theme tokens:

```css
.p-otp { display: flex; gap: 8px; align-items: center; }
.p-otp-cell {
  flex: 1; height: 100%; display: grid; place-items: center;
  background: #fff; border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius); font-size: 18px; font-weight: 600;
}
```

Layout rules to respect:

- The root element of your markup is stretched to the placed size by
  `.comp-inner > * { width: 100%; height: 100% }` — design it to **fill and flex**,
  and add `overflow: hidden` so an aggressive resize crops instead of spilling.
- Use the `--pf-*` custom properties for every color/radius so the component stays
  on-theme (and stays wireframe-compatible — the grayscale filter does the rest).
- No external assets (fonts, images, CDNs). Inline SVG and CSS gradients only.

### Step 3 — mock data (only if needed)

If the component displays data that no existing generator covers, add a small
deterministic function to `js/mockdata.js` (index-based, no `Math.random()` — renders
must be stable across reloads and machines).

### Step 4 — test

1. Open `index.html`, find the component in the palette (search box finds it by
   `name` or `pf`).
2. Drop it, resize it small and large — it should crop gracefully, never overflow.
3. Edit every prop in the inspector; check edit *and* render mode.
4. Export the layout, reload with a cleared `localStorage`, import it back.
5. Optional but recommended: the repo's showcase check — a small Playwright script
   that loads a layout containing every registry entry and asserts no console
   errors and no `.p-unknown` render failures (see `README` / project history).

That's the entire process — no other file references component types. The palette,
inspector form, recipe format, demo loader and both render modes pick the new entry
up automatically.

---

## 6. Conventions & gotchas

- **Escape everything** user-typed with `esc()` — prop values land in `innerHTML`.
- **Never rename a released `type`** or prop `k`; saved recipes reference them.
  Add new types/props with defaults instead — old files then load unchanged.
- **Keep renderers pure**: `html()` must not touch DOM or state; it is re-run on
  every change and during mode switches.
- **Deterministic output only**: same props ⇒ same markup. No randomness, no dates
  from `Date.now()` inside renderers.
- **Sizes in grid units**: defaults in multiples of 10 align with snapping.
- Bumping the recipe `version` is only needed for *breaking* format changes; purely
  additive changes (new types, new props) need nothing.
