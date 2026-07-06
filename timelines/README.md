# Timeline components

Two data-driven React components that reproduce the two reference infographic
designs:

- **`<HorizontalTimeline>`** — cream banner with colored year nodes on a
  horizontal axis, alternating content blocks above/below, `STEP NN`
  captions, icon badges, a start dot and an end arrow.
- **`<VerticalTimeline>`** — central spine that blends through the item
  colors as one continuous gradient, hollow nodes, dotted leader lines,
  pill-shaped year badges, content alternating left/right.

The demo app (`src/App.tsx`) shows both, plus the overflow behaviour.

```bash
npm install
npm run dev        # demo at http://localhost:5173
npm run build
```

## Usage

```tsx
import { HorizontalTimeline, VerticalTimeline } from './lib';

<HorizontalTimeline
  items={[
    { label: '2014', title: 'Kick-off', description: '…', icon: <RocketIcon /> },
    { label: '2015', title: 'First release', description: '…' },
    // color is optional — the component assigns one when omitted:
    { label: '2016', title: 'Rebrand', description: '…', color: '#e02c74' },
  ]}
/>

<VerticalTimeline
  items={[
    { label: '2006', title: 'Your Title Here', description: '…' },
    { label: '2009', title: 'Your Title Here', description: '…' },
  ]}
  maxHeight={560}
/>
```

### Color API

Adding an item requires no color decision. Each component owns a default
categorical palette (`HORIZONTAL_PALETTE`, `VERTICAL_PALETTE` in
`src/lib/palette.ts`) and assigns colors to items **by index, in fixed
order**; `item.color` overrides the assignment for that item only, without
shifting anyone else's color. Pass `palette={[…]}` to swap the whole scheme.

Both default palettes were extracted from the reference designs and then
retuned until they passed an accessibility validator for categorical
palettes (lightness band, chroma floor, adjacent-pair color-vision-deficiency
separation) against their surfaces (cream `#f6efe7` / white `#ffffff`).
A few steps sit below the 3:1 contrast guideline for *unlabeled* marks —
that is acceptable here because every mark is directly labeled (the year sits
on the node/badge), so identity is never carried by color alone. If a
timeline has more items than the palette has entries the assignment wraps
around; adjacent items still get distinct colors.

### When the timeline gets too big

Both components **scroll inside themselves** rather than shrinking or
wrapping, so the layout never degrades:

- `HorizontalTimeline` scrolls on the x-axis with scroll-snap per item and
  edge fades that appear only on the side(s) with more content. Each item
  reserves `itemWidth` px (default 232).
- `VerticalTimeline` grows naturally with the page by default; give it
  `maxHeight` (px or any CSS length) to cap it, and it scrolls on the
  y-axis inside the component with the same edge-fade hints.

Scrollable regions are keyboard-focusable (arrow keys scroll them).

### Props

| Prop | Type | Default | Applies to |
|---|---|---|---|
| `items` | `TimelineItem[]` | — | both |
| `palette` | `string[]` | built-in | both |
| `itemWidth` | `number` (px) | `232` | horizontal |
| `showSteps` | `boolean` | `true` | horizontal |
| `maxHeight` | `number \| string` | unset (grow) | vertical |
| `className`, `style` | — | — | both |

Item fields: `label` (required — node/badge text), `title`, `description`,
`color?`, and for the horizontal component `icon?` (any `ReactNode`) and
`step?` (overrides the auto `STEP NN` caption).

Fine-grained theming (surface, ink colors, node size, item height) is
exposed as CSS custom properties — see the top of
`src/lib/HorizontalTimeline.css` and `src/lib/VerticalTimeline.css`
(`--ht-*` / `--vt-*`).

## Screenshots

`scripts/screenshot.mjs` drives the demo with Playwright and captures each
section (`OUT_DIR=/some/dir node scripts/screenshot.mjs` with the dev server
running on port 5199).
