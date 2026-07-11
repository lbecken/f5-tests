import type { Skeleton } from "./types";

export const STROKE = "#1e1e1e";
export const WHITE = "#ffffff";

// Accent fill per diagram family (Excalidraw open-color light shades).
export const BLUE = "#d0ebff"; // class
export const YELLOW = "#fff3bf"; // package
export const VIOLET = "#e5dbff"; // sequence
export const GREEN = "#d3f9d8"; // activity
export const TEAL = "#c3fae8"; // state
export const PEACH = "#ffe8cc"; // use case
export const NOTE = "#fff9db";

export const base = {
  strokeColor: STROKE,
  strokeWidth: 1,
  fillStyle: "solid",
  roughness: 1,
} as const;

export const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  opts: Record<string, unknown> = {},
): Skeleton =>
  ({ type: "rectangle", x, y, width, height, ...base, ...opts }) as Skeleton;

export const ellipse = (
  x: number,
  y: number,
  width: number,
  height: number,
  opts: Record<string, unknown> = {},
): Skeleton =>
  ({ type: "ellipse", x, y, width, height, ...base, ...opts }) as Skeleton;

export const diamond = (
  x: number,
  y: number,
  width: number,
  height: number,
  opts: Record<string, unknown> = {},
): Skeleton =>
  ({ type: "diamond", x, y, width, height, ...base, ...opts }) as Skeleton;

export const line = (
  x: number,
  y: number,
  points: number[][],
  opts: Record<string, unknown> = {},
): Skeleton => ({ type: "line", x, y, points, ...base, ...opts }) as Skeleton;

export const arrow = (
  x: number,
  y: number,
  points: number[][],
  opts: Record<string, unknown> = {},
): Skeleton => ({ type: "arrow", x, y, points, ...base, ...opts }) as Skeleton;

export const text = (
  x: number,
  y: number,
  content: string,
  opts: Record<string, unknown> = {},
): Skeleton =>
  ({ type: "text", x, y, text: content, fontSize: 14, ...opts }) as Skeleton;

export const label = (t: string, opts: Record<string, unknown> = {}) => ({
  text: t,
  fontSize: 15,
  ...opts,
});

export const ROUNDED = { roundness: { type: 3 } };
export const DASHED = { strokeStyle: "dashed" };
export const FILLED = { backgroundColor: STROKE };

/** Stick figure used by sequence + use case diagrams. */
export const actor = (name: string, dx = 0, dy = 0): Skeleton[] => [
  ellipse(dx + 19, dy, 26, 26, { backgroundColor: WHITE }),
  line(dx + 32, dy + 26, [[0, 0], [0, 38]]),
  line(dx + 8, dy + 38, [[0, 0], [48, 0]]),
  line(dx + 32, dy + 64, [[0, 0], [-20, 28]]),
  line(dx + 32, dy + 64, [[0, 0], [20, 28]]),
  text(dx + 12, dy + 98, name),
];

/**
 * A three-compartment UML class. `id` (when given) names the middle
 * compartment `<id>` plus `<id>-header` / `<id>-methods`, so template arrows
 * can bind to it.
 */
export const classBox = (
  x: number,
  y: number,
  name: string,
  attrs: string,
  methods: string,
  id?: string,
): Skeleton[] => [
  rect(x, y, 220, 44, {
    backgroundColor: BLUE,
    label: label(name),
    ...(id ? { id: `${id}-header` } : {}),
  }),
  rect(x, y + 44, 220, 52, {
    backgroundColor: WHITE,
    label: label(attrs, { fontSize: 14 }),
    ...(id ? { id } : {}),
  }),
  rect(x, y + 96, 220, 52, {
    backgroundColor: WHITE,
    label: label(methods, { fontSize: 14 }),
    ...(id ? { id: `${id}-methods` } : {}),
  }),
];
