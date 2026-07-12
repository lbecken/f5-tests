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

  // --- Class compartment re-stacking ---------------------------------------
  // Editing a compartment's text makes Excalidraw grow that container, which
  // would overlap the compartment below: keep grouped same-width rect stacks
  // gapless by pushing lower compartments down (labels move along).
  {
    const byGroup = new Map<string, El[]>();
    for (const el of elements) {
      const gid = el.customData?.umlGroup;
      if (typeof gid !== "string" || el.type !== "rectangle" || isStrip(el)) {
        continue;
      }
      if (!byGroup.has(gid)) byGroup.set(gid, []);
      byGroup.get(gid)!.push(el);
    }
    for (const rects of byGroup.values()) {
      if (rects.length < 2) continue;
      const sorted = [...rects].sort((a, b) => a.y - b.y);
      const head = sorted[0];
      if (!sorted.every((r) => Math.abs(r.width - head.width) <= 2 && Math.abs(r.x - head.x) <= 2)) {
        continue;
      }
      let expectedY = head.y + head.height;
      for (const r of sorted.slice(1)) {
        if (!near(r.y, expectedY)) {
          const dy = expectedY - r.y;
          update(r, { y: expectedY });
          const label = elements.find(
            (t) =>
              t.type === "text" &&
              (t as ExcalidrawTextElement).containerId === r.id,
          );
          if (label) update(label, { y: label.y + dy });
        }
        expectedY += r.height;
      }
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
      // The intended height is stored on the arrow: endpoint positions are
      // NOT a reliable source (Excalidraw recomputes them from binding focus
      // when a lifeline moves, and its focus semantics differ from ours).
      const stored = parts.arrow.customData?.umlMsgY;
      const pts = parts.arrow.points;
      const endpointMidY =
        (el.y + pts[0][1] + el.y + pts[pts.length - 1][1]) / 2;
      applyMessageGeometry(
        update,
        current,
        parts,
        typeof stored === "number" ? stored : endpointMidY,
      );
    }

    // Activation bars imported from sequence text follow their lifeline.
    for (const el of elements) {
      const of = el.customData?.umlActivationOf;
      if (typeof of !== "string" || el.type !== "rectangle") continue;
      const strip = strips.find((st) => st.customData?.umlGroup === of);
      if (!strip) continue;
      const targetX = strip.x + strip.width / 2 - el.width / 2;
      if (!near(el.x, targetX)) update(el, { x: targetX });
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
  const storedOk = arrow.customData?.umlMsgY === targetY;

  if (!geomOk || !bindOk || !storedOk) {
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
      customData: { ...arrow.customData, umlMsgY: targetY },
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

// ---------------------------------------------------------------------------
// Side-handle stretching of UML groups
// ---------------------------------------------------------------------------
// Excalidraw resizes grouped selections proportionally on both axes from any
// handle (scaling text too). For UML shapes the expected behavior is: side
// handles stretch one axis only — members touching the dragged edge extend
// (a lifeline's dashed line grows, a class's bottom compartment gets taller,
// all compartments widen), text is never scaled. Corner handles keep the
// native proportional resize.

export type Edge = "n" | "s" | "e" | "w";

const MIN_SIZE = 18;
const EDGE_TOL = 2.5;

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const elementBounds = (el: El): Bounds => {
  const pts = (el as El & Partial<ArrowLike>).points;
  if ((el.type === "line" || el.type === "arrow") && pts && pts.length > 0) {
    const xs = pts.map((p) => el.x + p[0]);
    const ys = pts.map((p) => el.y + p[1]);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }
  return {
    minX: el.x,
    minY: el.y,
    maxX: el.x + el.width,
    maxY: el.y + el.height,
  };
};

const unionBounds = (els: readonly El[]): Bounds => {
  const bs = els.map(elementBounds);
  return {
    minX: Math.min(...bs.map((b) => b.minX)),
    minY: Math.min(...bs.map((b) => b.minY)),
    maxX: Math.max(...bs.map((b) => b.maxX)),
    maxY: Math.max(...bs.map((b) => b.maxY)),
  };
};

/**
 * When the selection is exactly the members of one UML group, returns the
 * group id, member ids and bounds — the precondition for edge stretching.
 */
export function selectedUmlGroup(
  elements: readonly El[],
  selectedElementIds: Readonly<Record<string, boolean>>,
): { gid: string; memberIds: string[]; bounds: Bounds } | null {
  const selected = elements.filter((e) => selectedElementIds[e.id]);
  if (selected.length < 2) return null;
  const gid = selected[0].customData?.umlGroup;
  if (typeof gid !== "string") return null;
  if (!selected.every((e) => e.customData?.umlGroup === gid)) return null;
  return {
    gid,
    memberIds: selected.map((e) => e.id),
    bounds: unionBounds(selected),
  };
}

/** Which side handle of the bounds (if any) is at scene point (x, y). */
export function edgeAt(
  bounds: Bounds,
  x: number,
  y: number,
  zoom: number,
): Edge | null {
  const band = 7 / zoom;
  const corner = 14 / zoom;
  const inX = x >= bounds.minX + corner && x <= bounds.maxX - corner;
  const inY = y >= bounds.minY + corner && y <= bounds.maxY - corner;
  if (inY && Math.abs(x - bounds.minX) <= band) return "w";
  if (inY && Math.abs(x - bounds.maxX) <= band) return "e";
  if (inX && Math.abs(y - bounds.minY) <= band) return "n";
  if (inX && Math.abs(y - bounds.maxY) <= band) return "s";
  return null;
}

/** Moves the line endpoint(s) that sit at `edgeValue` by delta (axis y/x). */
const stretchLinePoints = (
  el: El & ArrowLike,
  axis: "x" | "y",
  edgeValue: number,
  delta: number,
): { x: number; y: number; points: [number, number][]; width: number; height: number } => {
  const idx = axis === "x" ? 0 : 1;
  const base = axis === "x" ? el.x : el.y;
  let pts = el.points.map((p) =>
    Math.abs(base + p[idx] - edgeValue) <= EDGE_TOL
      ? ((axis === "x" ? [p[0] + delta, p[1]] : [p[0], p[1] + delta]) as [
          number,
          number,
        ])
      : ([p[0], p[1]] as [number, number]),
  );
  // rebase so points[0] stays [0,0]
  const [px, py] = pts[0];
  const x = el.x + px;
  const y = el.y + py;
  pts = pts.map((p) => [p[0] - px, p[1] - py]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    x,
    y,
    points: pts,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
};

/**
 * Stretches the group along one axis by `delta` (scene units): members whose
 * edge sits on the dragged side extend/shrink; everything else keeps its size
 * and position. Bound labels are re-centered, never scaled. Returns the
 * updated scene, or null when nothing changes.
 */
export function stretchUmlGroup(
  elements: readonly El[],
  memberIds: ReadonlySet<string>,
  edge: Edge,
  delta: number,
): El[] | null {
  if (delta === 0) return null;
  const members = elements.filter((e) => memberIds.has(e.id));
  if (members.length === 0) return null;
  const bounds = unionBounds(members);

  const affected = members.filter((el) => {
    const b = elementBounds(el);
    if (edge === "s") return Math.abs(b.maxY - bounds.maxY) <= EDGE_TOL;
    if (edge === "n") return Math.abs(b.minY - bounds.minY) <= EDGE_TOL;
    if (edge === "e") return Math.abs(b.maxX - bounds.maxX) <= EDGE_TOL;
    return Math.abs(b.minX - bounds.minX) <= EDGE_TOL;
  });
  if (affected.length === 0) return null;

  // Clamp so no affected member shrinks below MIN_SIZE.
  const shrink = edge === "s" || edge === "e" ? -delta : delta;
  const maxShrink = Math.min(
    ...affected.map((el) => {
      const b = elementBounds(el);
      const size =
        edge === "n" || edge === "s" ? b.maxY - b.minY : b.maxX - b.minX;
      return size - MIN_SIZE;
    }),
  );
  const clamped =
    shrink > maxShrink ? (edge === "s" || edge === "e" ? -maxShrink : maxShrink) : delta;
  if (clamped === 0) return null;

  const updates = new Map<string, El>();
  const update = (el: El, patch: Parameters<typeof newElementWith>[1]) => {
    updates.set(
      el.id,
      newElementWith((updates.get(el.id) ?? el) as ExcalidrawElement, patch) as El,
    );
  };

  for (const el of affected) {
    if (el.type === "line" || el.type === "arrow") {
      const linear = el as El & ArrowLike;
      const b = elementBounds(el);
      const axis = edge === "n" || edge === "s" ? "y" : "x";
      const edgeValue =
        edge === "s" ? b.maxY : edge === "n" ? b.minY : edge === "e" ? b.maxX : b.minX;
      update(
        el,
        stretchLinePoints(linear, axis, edgeValue, clamped) as unknown as Parameters<
          typeof newElementWith
        >[1],
      );
    } else if (edge === "s") {
      update(el, { height: el.height + clamped });
    } else if (edge === "n") {
      update(el, { y: el.y + clamped, height: el.height - clamped });
    } else if (edge === "e") {
      update(el, { width: el.width + clamped });
    } else {
      update(el, { x: el.x + clamped, width: el.width - clamped });
    }
  }

  // Horizontal stretches: keep thin vertical parts (lifeline line + strip)
  // centered under the widest box.
  if (edge === "e" || edge === "w") {
    const wide = members
      .map((el) => updates.get(el.id) ?? el)
      .filter((el) => el.type === "rectangle" && el.width > 24 && !isStrip(el));
    const thin = members.filter((el) => {
      const b = elementBounds(el);
      return b.maxX - b.minX <= 24;
    });
    if (wide.length === 1 && thin.length > 0) {
      const cx = wide[0].x + wide[0].width / 2;
      for (const el of thin) {
        const cur = updates.get(el.id) ?? el;
        const b = elementBounds(cur);
        const shift = cx - (b.minX + b.maxX) / 2;
        if (Math.abs(shift) > 0.01) update(el, { x: cur.x + shift });
      }
    }
  }

  // Re-center bound labels of resized containers (font size untouched).
  for (const el of elements) {
    if (el.type !== "text") continue;
    const t = el as El & ExcalidrawTextElement;
    if (!t.containerId || !updates.has(t.containerId)) continue;
    const c = updates.get(t.containerId)!;
    const lx = c.x + c.width / 2 - t.width / 2;
    const ly =
      t.verticalAlign === "top"
        ? c.y + 8
        : c.y + c.height / 2 - t.height / 2;
    if (!near(t.x, lx) || !near(t.y, ly)) update(t as El, { x: lx, y: ly });
  }

  if (updates.size === 0) return null;
  return elements.map((el) => updates.get(el.id) ?? el);
}
