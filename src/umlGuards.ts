// Keeps UML shapes well-formed after every scene change:
//
// 1. Rotation is disabled for UML elements (angle snaps back to 0).
// 2. Multi-part shapes cannot be ungrouped (their group is restored).
// 3. "Message" arrows — arrows connected on both ends to lifeline binding
//    strips — behave like sequence-diagram messages instead of free arrows:
//    they are kept straight and horizontal, both ends pinned to the
//    lifelines, and dragging them (or their label) slides them up and down
//    the lifelines. Endpoints that land on a strip re-bind automatically,
//    so a body-drag (which makes Excalidraw drop bindings) reconnects on
//    release.
import { newElementWith } from "@excalidraw/excalidraw";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/excalidraw/element/types";

const EPS = 0.5;

type El = NonDeletedExcalidrawElement;

interface ArrowLike {
  points: readonly (readonly [number, number])[];
  startBinding: { elementId: string; focus: number; gap: number } | null;
  endBinding: { elementId: string; focus: number; gap: number } | null;
}

const isStrip = (el: El): boolean =>
  el.type === "rectangle" &&
  el.strokeColor === "transparent" &&
  el.backgroundColor === "transparent" &&
  el.width <= 24 &&
  typeof el.customData?.umlGroup === "string";

const near = (a: number, b: number) => Math.abs(a - b) <= EPS;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

export interface GuardOptions {
  /** True while an arrow endpoint is being dragged (linear editor). */
  endpointDragging: boolean;
}

interface MessageParts {
  arrow: El & ArrowLike;
  sStrip: El;
  eStrip: El;
  label?: El & ExcalidrawTextElement;
}

const collectStrips = (elements: readonly El[]) => {
  const strips = elements.filter(isStrip);
  return { strips, stripById: new Map(strips.map((s) => [s.id, s])) };
};

/**
 * Recognizes a "message": an arrow whose two endpoints resolve to two
 * different lifeline strips — via bindings, or by endpoint proximity
 * (allowProximity) so dropped/unbound arrows can reconnect.
 */
function messageParts(
  elements: readonly El[],
  el: El,
  strips: readonly El[],
  stripById: Map<string, El>,
  allowProximity: boolean,
): MessageParts | null {
  if (el.type !== "arrow" || !el.customData?.umlNoRotate) return null;
  const arrow = el as El & ArrowLike;
  const pts = arrow.points;
  if (!pts || pts.length < 2) return null;
  const stripAt = (x: number, y: number): El | undefined =>
    allowProximity
      ? strips.find(
          (s) =>
            x >= s.x - 8 &&
            x <= s.x + s.width + 8 &&
            y >= s.y - 4 &&
            y <= s.y + s.height + 4,
        )
      : undefined;
  const sStrip =
    (arrow.startBinding && stripById.get(arrow.startBinding.elementId)) ??
    stripAt(el.x + pts[0][0], el.y + pts[0][1]);
  const eStrip =
    (arrow.endBinding && stripById.get(arrow.endBinding.elementId)) ??
    stripAt(el.x + pts[pts.length - 1][0], el.y + pts[pts.length - 1][1]);
  if (!sStrip || !eStrip || sStrip.id === eStrip.id) return null;
  const label = elements.find(
    (t): t is El & ExcalidrawTextElement =>
      t.type === "text" && (t as ExcalidrawTextElement).containerId === el.id,
  );
  return { arrow, sStrip, eStrip, label };
}

/** Vertical range a message may occupy on its two lifelines. */
const messageRange = (p: MessageParts): [number, number] => [
  Math.max(p.sStrip.y, p.eStrip.y) + 10,
  Math.min(p.sStrip.y + p.sStrip.height, p.eStrip.y + p.eStrip.height) - 6,
];

/**
 * Returns a fixed copy of the scene, or null when nothing needed fixing.
 */
export function fixUmlScene(
  elements: readonly El[],
  opts: GuardOptions,
): El[] | null {
  const updates = new Map<string, El>();
  const current = (el: El): El => updates.get(el.id) ?? el;
  const update = (el: El, patch: Parameters<typeof newElementWith>[1]) => {
    updates.set(el.id, newElementWith(current(el) as ExcalidrawElement, patch) as El);
  };

  for (const el of elements) {
    if (el.angle !== 0 && el.customData?.umlNoRotate) {
      update(el, { angle: 0 as El["angle"] });
    }
    if (
      typeof el.customData?.umlGroup === "string" &&
      el.groupIds.length === 0
    ) {
      update(el, { groupIds: [el.customData.umlGroup] });
    }
  }

  // --- Message-arrow normalization ----------------------------------------
  // Skipped while an endpoint is being dragged so endpoints stay free to
  // re-target. (Body drags of fully-bound messages never reach Excalidraw:
  // the app intercepts them and calls slideMessageTo instead.)
  if (!opts.endpointDragging) {
    const { strips, stripById } = collectStrips(elements);
    for (const el of elements) {
      const parts = messageParts(elements, el, strips, stripById, true);
      if (!parts) continue;
      const pts = parts.arrow.points;
      const endpointMidY =
        (el.y + pts[0][1] + el.y + pts[pts.length - 1][1]) / 2;
      applyMessageGeometry(update, current, parts, endpointMidY);
    }
  }

  if (updates.size === 0) return null;
  return elements.map((el) => updates.get(el.id) ?? el);
}

type UpdateFn = (el: El, patch: Parameters<typeof newElementWith>[1]) => void;

/**
 * Straightens a message at targetY (clamped to the lifelines' overlap):
 * horizontal 2-point arrow between the strip centers, bindings with focus
 * matching targetY, strips listing the arrow in boundElements, and the label
 * centered on the arrow.
 */
function applyMessageGeometry(
  update: UpdateFn,
  current: (el: El) => El,
  parts: MessageParts,
  desiredY: number,
): void {
  const { arrow, sStrip, eStrip, label } = parts;
  const [top, bottom] = messageRange(parts);
  if (top > bottom) return;
  const targetY = clamp(desiredY, top, bottom);
  const ax = sStrip.x + sStrip.width / 2;
  const bx = eStrip.x + eStrip.width / 2;
  const pts = arrow.points;

  const geomOk =
    pts.length === 2 &&
    near(arrow.x, ax) &&
    near(arrow.y, targetY) &&
    near(pts[0][0], 0) &&
    near(pts[0][1], 0) &&
    near(pts[1][0], bx - ax) &&
    near(pts[1][1], 0);
  const bindOk =
    arrow.startBinding?.elementId === sStrip.id &&
    arrow.endBinding?.elementId === eStrip.id;

  if (!geomOk || !bindOk) {
    const focusOn = (s: El) =>
      clamp((targetY - (s.y + s.height / 2)) / (s.height / 2), -1, 1);
    update(arrow, {
      x: ax,
      y: targetY,
      width: Math.abs(bx - ax),
      height: 0,
      points: [
        [0, 0],
        [bx - ax, 0],
      ],
      startBinding: { elementId: sStrip.id, focus: focusOn(sStrip), gap: 1 },
      endBinding: { elementId: eStrip.id, focus: focusOn(eStrip), gap: 1 },
    } as unknown as Parameters<typeof newElementWith>[1]);
    // The strips must list the arrow in boundElements, otherwise Excalidraw
    // won't move the endpoint when the lifeline moves.
    for (const strip of [sStrip, eStrip]) {
      const s = current(strip);
      if (!s.boundElements?.some((b) => b.id === arrow.id)) {
        update(strip, {
          boundElements: [
            ...(s.boundElements ?? []),
            { id: arrow.id, type: "arrow" as const },
          ],
        });
      }
    }
  }

  if (label) {
    const lx = (ax + bx) / 2 - label.width / 2;
    const ly = targetY - label.height / 2;
    if (!near(label.x, lx) || !near(label.y, ly)) {
      update(label, { x: lx, y: ly });
    }
  }
}

/**
 * Hit-tests fully-bound messages: returns the arrow whose horizontal line
 * (or label) is at scene point (x, y), keeping a margin around the endpoints
 * so endpoint dragging still belongs to Excalidraw.
 */
export function findBoundMessageAt(
  elements: readonly El[],
  x: number,
  y: number,
): El | null {
  const { strips, stripById } = collectStrips(elements);
  for (const el of elements) {
    const parts = messageParts(elements, el, strips, stripById, false);
    if (!parts) continue;
    const { arrow, label } = parts;
    if (
      label &&
      x >= label.x - 2 &&
      x <= label.x + label.width + 2 &&
      y >= label.y - 2 &&
      y <= label.y + label.height + 2
    ) {
      return el;
    }
    const pts = arrow.points;
    const x1 = arrow.x + pts[0][0];
    const x2 = arrow.x + pts[pts.length - 1][0];
    const [lo, hi] = x1 < x2 ? [x1, x2] : [x2, x1];
    if (
      Math.abs(y - arrow.y) <= 10 &&
      x > lo + 20 &&
      x < hi - 20
    ) {
      return el;
    }
  }
  return null;
}

/**
 * Moves a bound message to the given height (clamped to its lifelines),
 * keeping it straight and connected. Returns the updated scene or null.
 */
export function slideMessageTo(
  elements: readonly El[],
  arrowId: string,
  targetY: number,
): El[] | null {
  const el = elements.find((e) => e.id === arrowId);
  if (!el) return null;
  const { strips, stripById } = collectStrips(elements);
  const parts = messageParts(elements, el, strips, stripById, false);
  if (!parts) return null;

  const updates = new Map<string, El>();
  const current = (e: El): El => updates.get(e.id) ?? e;
  const update: UpdateFn = (e, patch) => {
    updates.set(e.id, newElementWith(current(e) as ExcalidrawElement, patch) as El);
  };
  applyMessageGeometry(update, current, parts, targetY);
  if (updates.size === 0) return null;
  return elements.map((e) => updates.get(e.id) ?? e);
}

// ===========================================================================
// Side-edge "stretch" for grouped UML shapes
// ===========================================================================
//
// Excalidraw resizes a *multi-element* selection (which every multi-part UML
// shape is — its parts share one group) proportionally from any handle, and
// scales bound text with it. That is wrong for UML: dragging the bottom edge
// of a class box should make the box taller, not scale the whole thing and
// blow up the font. So the app intercepts side-edge drags on UML groups and
// runs the stretch below instead — a single-axis resize that grows the shape
// on one axis only and leaves text sizes untouched (corners are left to
// Excalidraw, keeping proportional resize there).

export type ResizeSide = "n" | "s" | "e" | "w";

export type Bounds = readonly [number, number, number, number];

const BOUND_TEXT_PADDING = 5;
/** Smallest a group is allowed to get on the stretched axis. */
const MIN_GROUP_SIZE = 20;

interface Sized {
  x: number;
  y: number;
  width: number;
  height: number;
  points?: readonly (readonly [number, number])[];
}

/** Axis-aligned bounds of some elements, taking linear points into account. */
export function elementsBounds(elements: readonly El[]): Bounds {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const raw of elements) {
    const el = raw as unknown as Sized;
    if (el.points && el.points.length > 0) {
      for (const [px, py] of el.points) {
        x1 = Math.min(x1, el.x + px);
        y1 = Math.min(y1, el.y + py);
        x2 = Math.max(x2, el.x + px);
        y2 = Math.max(y2, el.y + py);
      }
    } else {
      x1 = Math.min(x1, el.x);
      y1 = Math.min(y1, el.y);
      x2 = Math.max(x2, el.x + el.width);
      y2 = Math.max(y2, el.y + el.height);
    }
  }
  return [x1, y1, x2, y2];
}

/**
 * The set of selected elements that form a single stretchable UML group:
 * two or more UML parts (customData.umlNoRotate) sharing one group id. A
 * single UML element resizes fine on its own — the bug is specific to the
 * grouped, aspect-locked case — so those (and non-UML selections) return null.
 */
export function stretchableGroup(
  elements: readonly El[],
  selectedIds: readonly string[],
): { ids: string[]; bounds: Bounds } | null {
  const selected = elements.filter((el) => selectedIds.includes(el.id));
  if (selected.length < 2) return null;
  if (!selected.every((el) => el.customData?.umlNoRotate)) return null;
  // A common group id across the whole selection means it is one UML shape.
  let common: string[] = selected[0].groupIds as string[];
  for (const el of selected.slice(1)) {
    common = common.filter((g) => el.groupIds.includes(g));
  }
  if (common.length === 0) return null;
  return { ids: selected.map((el) => el.id), bounds: elementsBounds(selected) };
}

/**
 * Which side handle (n/s/e/w) the pointer is on for a selection with the
 * given bounds, or null if it is on a corner / not on a side. Matches
 * Excalidraw's own side-resize band: a thin strip just *outside* an edge,
 * within that edge's span (corners are handled by Excalidraw). Coordinates
 * and zoom are in scene space.
 */
export function sideHandleAt(
  bounds: Bounds,
  px: number,
  py: number,
  zoom: number,
): ResizeSide | null {
  const [x1, y1, x2, y2] = bounds;
  const band = 8 / zoom; // how far outside the edge still counts as the handle
  const inset = 1 / zoom; // ignore the pixel right on the border (that's a move)
  const minForSides = 40 / zoom; // Excalidraw hides side handles on tiny shapes
  const withinX = px >= x1 && px <= x2 && x2 - x1 > minForSides;
  const withinY = py >= y1 && py <= y2 && y2 - y1 > minForSides;
  if (withinX && py > y2 + inset && py <= y2 + band) return "s";
  if (withinX && py < y1 - inset && py >= y1 - band) return "n";
  if (withinY && px > x2 + inset && px <= x2 + band) return "e";
  if (withinY && px < x1 - inset && px >= x1 - band) return "w";
  return null;
}

/** Horizontal alignment of a text element (defaults to center). */
const textAlignOf = (el: El): string =>
  (el as unknown as { textAlign?: string }).textAlign ?? "center";
const vAlignOf = (el: El): string =>
  (el as unknown as { verticalAlign?: string }).verticalAlign ?? "middle";

/**
 * Repositions a container-bound label inside its (resized) container without
 * changing its font size — Excalidraw would normally rescale it.
 */
function placeBoundText(container: El, text: El): { x: number; y: number } {
  const c = container as unknown as Sized;
  const t = text as unknown as Sized;
  const P = BOUND_TEXT_PADDING;
  let x: number;
  switch (textAlignOf(text)) {
    case "left":
      x = c.x + P;
      break;
    case "right":
      x = c.x + c.width - t.width - P;
      break;
    default:
      x = c.x + (c.width - t.width) / 2;
  }
  let y: number;
  switch (vAlignOf(text)) {
    case "top":
      y = c.y + P;
      break;
    case "bottom":
      y = c.y + c.height - t.height - P;
      break;
    default:
      y = c.y + (c.height - t.height) / 2;
  }
  return { x, y };
}

/**
 * Stretches a UML group along one axis to the given pointer position,
 * anchored at the opposite edge. Every part scales on that axis (positions,
 * sizes and linear points); text keeps its font size and is re-centered in
 * its container. Returns the updated scene, or null if nothing changed.
 */
export function stretchUmlGroup(
  elements: readonly El[],
  ids: readonly string[],
  side: ResizeSide,
  bounds: Bounds,
  pointer: number,
): El[] | null {
  const [x1, y1, x2, y2] = bounds;
  const horizontal = side === "e" || side === "w";
  const size = horizontal ? x2 - x1 : y2 - y1;
  if (size <= 0) return null;

  // New size on the stretched axis, and the fixed (anchor) coordinate.
  let newSize: number;
  let anchor: number;
  switch (side) {
    case "e":
      anchor = x1;
      newSize = pointer - x1;
      break;
    case "w":
      anchor = x2;
      newSize = x2 - pointer;
      break;
    case "s":
      anchor = y1;
      newSize = pointer - y1;
      break;
    default: // "n"
      anchor = y2;
      newSize = y2 - pointer;
  }
  newSize = Math.max(newSize, MIN_GROUP_SIZE);
  if (near(newSize, size)) return null; // sub-pixel change: nothing to do
  const factor = newSize / size;

  const idSet = new Set(ids);
  const byId = new Map(elements.map((el) => [el.id, el]));
  // Bound labels aren't part of the selection, but they belong to the shape
  // and must be re-placed inside their resized containers.
  for (const el of elements) {
    const containerId = (el as unknown as { containerId?: string }).containerId;
    if (el.type === "text" && containerId && idSet.has(containerId)) {
      idSet.add(el.id);
    }
  }
  const scale = (v: number) => anchor + (v - anchor) * factor;

  const updates = new Map<string, El>();
  const patch = (el: El, p: Parameters<typeof newElementWith>[1]) =>
    updates.set(el.id, newElementWith(el as ExcalidrawElement, p) as El);

  for (const el of elements) {
    if (!idSet.has(el.id)) continue;
    const s = el as unknown as Sized;
    const isText = el.type === "text";
    // A bound label is repositioned from its container afterwards, not scaled.
    const isBoundLabel =
      isText &&
      typeof (el as unknown as { containerId?: string }).containerId ===
        "string";

    if (horizontal) {
      // A lifeline's invisible bind strip must keep its narrow width (the
      // message-binding logic only recognizes strips with width <= 24), so
      // recenter it on the scaled position instead of widening it.
      if (isStrip(el)) {
        patch(el, {
          x: scale(s.x + s.width / 2) - s.width / 2,
        } as Parameters<typeof newElementWith>[1]);
        continue;
      }
      const p: Record<string, unknown> = { x: scale(s.x) };
      if (!isText) p.width = s.width * factor;
      if (s.points) {
        p.points = s.points.map(([px, py]) => [px * factor, py]);
      }
      if (isBoundLabel) delete p.x; // placed later from the container
      patch(el, p as Parameters<typeof newElementWith>[1]);
    } else {
      const p: Record<string, unknown> = { y: scale(s.y) };
      if (!isText) p.height = s.height * factor;
      if (s.points) {
        p.points = s.points.map(([px, py]) => [px, py * factor]);
      }
      if (isBoundLabel) delete p.y;
      patch(el, p as Parameters<typeof newElementWith>[1]);
    }
  }

  // Re-place bound labels inside their now-resized containers.
  for (const el of elements) {
    if (!idSet.has(el.id) || el.type !== "text") continue;
    const containerId = (el as unknown as { containerId?: string }).containerId;
    if (!containerId) continue;
    const containerBase = byId.get(containerId);
    if (!containerBase) continue;
    const container = updates.get(containerId) ?? containerBase;
    const text = updates.get(el.id) ?? el;
    patch(text, placeBoundText(container, text) as unknown as Parameters<
      typeof newElementWith
    >[1]);
  }

  if (updates.size === 0) return null;
  return elements.map((el) => updates.get(el.id) ?? el);
}
