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
