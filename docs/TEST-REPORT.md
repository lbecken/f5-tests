# Realistic usage test report & TODO list

Date: 2026-07-12 · Branch: `claude/modern-uml-builder-idcdok`
How produced: `npm run build && npm run preview -- --port 4173 &` then
`node scripts/realistic-test.mjs` (headless Chromium, real mouse gestures),
plus visual inspection of the screenshots it saves. Re-run it any time —
it prints `[OK|BUG|NOTE]` findings as it goes.

Scenario 1: build a class diagram — two classes, edit the name, add
attributes/methods, stretch (side handles), resize (corner), connect
inheritance, move.
Scenario 2: build a sequence diagram (User → JSFController → Service →
Repository → DB with returns and a self-call) via text import, stretch
lifelines, add and connect a new call, slide it, move a lifeline.

## What works

| Area | Result |
|---|---|
| Insert two 3-compartment classes (grouped) | OK |
| Edit attributes/methods text (double-click) | OK — but see bug 2 |
| **Side-handle stretch (new)**: S edge grows only the bottom compartment; E edge widens all compartments; font size never scales; lifeline S-stretch extends the dashed line + strip only | OK |
| Connect inheritance arrow to a stretched class; binding survives moving the class | OK |
| Sequence import: 5 participants, 9 messages, activations, self-call; messages come **bound** to the lifelines | OK |
| Stretch a lifeline 120px down: messages keep their vertical positions | OK |
| Add a call with the sync-message stencil, connect both endpoints to lifeline vertical lines | OK |
| Slide a connected message up/down (custom gesture) | OK |
| Move a lifeline: bound message endpoints follow horizontally and stay bound | OK |

## Bugs / TODO (priority order)

### 1. Moving a lifeline horizontally scrambles message heights — ✅ FIXED
After dragging a lifeline sideways, its bound messages ended up at wrong
vertical positions (order visibly shuffled: "render page" jumped above
"submit form"). Cause: when Excalidraw moves a bound shape it recomputes
arrow endpoints from the binding `focus` value, and the focus we write in
`applyMessageGeometry` (src/umlGuards.ts) uses a simple linear formula that
does not match Excalidraw's `determineFocusDistance` semantics — the
endpoint jumps vertically, and the normalizer then re-straightens the
message at the *wrong* midpoint.
**Fixed:** the intended height is stored on the arrow
(`customData.umlMsgY`, written by `applyMessageGeometry`) and the
normalizer restores it instead of trusting endpoint positions. Verified:
realistic test now reports "messages attached, straight, at their
heights" and `rt-07-seq-moved.png` shows the correct order.

### 2. Class compartments don't re-stack when text grows — ✅ FIXED
Adding attribute lines makes Excalidraw grow that compartment downward, and
it overlaps/clips into the methods compartment below (observed 28px
overlap; 4th line hidden). Screenshot: `rt-01-class-edited.png`.
**Fixed:** `fixUmlScene` now re-stacks grouped same-width rect stacks
(each compartment's y = previous compartment's bottom, labels move along).
Verified: "attrs compartment grew without overlapping".

### 3. Activation bars are not part of the lifeline group — ✅ FIXED
Moving a lifeline leaves its activation bars behind (visible in
`rt-07-seq-moved.png`, bar left of JSFController). They are standalone
rects (src/sequence.ts `seqToSkeletons` pushes them ungrouped) so they can
be repositioned freely — but they should follow the lifeline horizontally.
**Fixed:** import tags bars with `customData.umlActivationOf` and the
guard keeps them centered on their lifeline's strip. Verified visually in
`rt-07-seq-moved.png` (bar follows the moved Service lifeline). Bars stay
independently movable vertically.

### 4. Editing a grouped shape's label needs an extra double-click — MEDIUM
The first double-click on a class header (grouped) selects the group /
enters it; only a second double-click opens the text editor. The automated
first attempt to rename a class failed for this reason (attribute editing
succeeded because the group was already entered by then).
**Fix idea:** intercept `dblclick` on the wrapper: if it hits a labeled
container inside a UML group, forward/trigger text editing directly (or
document the double-double-click). Needs investigation of what Excalidraw
allows via the imperative API.

### 5. Self-messages don't follow their lifeline — LOW
Imported self-calls (e.g. `validate(order)`) are unbound (normalizer skips
same-strip arrows), so they stay behind when the lifeline moves.
**Fix idea:** allow start=end strip in `messageParts`, render/normalize the
loop shape relative to the strip center, keep both bindings on that strip.

### 6. Corner-resize of groups — VERIFY MANUALLY
The automated corner drag did not engage the corner handle (position
mismatch), so proportional group resize is unverified. Excalidraw's native
behavior scales text on corner resize, which is the expected/accepted
behavior — just confirm the handles work by hand after the side-stretch
interception (interception leaves 14px corner zones untouched).

### 7. Test-script artifacts — LOW (tests, not product)
`scripts/realistic-test.mjs` counts actor figure lines as "lifelines"
(reported 9 instead of 5) and picked JSFController instead of Service for
the move test. Tighten the filters (vertical dashed lines with height >
80 only) if exact counts matter.

## Where things live

- `src/umlGuards.ts` — all custom behavior: rotation/ungroup guards,
  message normalization + slide, group side-stretch. Most fixes go here.
- `src/App.tsx` `handleCanvasPointerDown` — gesture interception (stretch,
  slide).
- `src/sequence.ts` — sequence import renderer (activations, fragments).
- `scripts/interaction-test.mjs` — regression suite (10 checks), run with
  `npm run test:interactions`.
- `scripts/realistic-test.mjs` — this report's scenario script.
