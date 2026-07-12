import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

/** Element skeleton accepted by convertToExcalidrawElements(). */
export type Skeleton = NonNullable<
  Parameters<typeof convertToExcalidrawElements>[0]
>[number];

export type DiagramKind =
  | "common"
  | "class"
  | "package"
  | "sequence"
  | "activity"
  | "state"
  | "usecase";

export interface Stencil {
  id: string;
  name: string;
  elements: Skeleton[];
}

export interface StencilGroup {
  kind: DiagramKind;
  title: string;
  stencils: Stencil[];
}

/** Approximate bounding box of a stencil, used to center it on insertion. */
export function skeletonBounds(elements: Skeleton[]): {
  width: number;
  height: number;
} {
  let maxX = 0;
  let maxY = 0;
  for (const el of elements) {
    const e = el as {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      points?: readonly (readonly number[])[];
    };
    const x = e.x ?? 0;
    const y = e.y ?? 0;
    if (e.points) {
      for (const p of e.points) {
        maxX = Math.max(maxX, x + p[0]);
        maxY = Math.max(maxY, y + p[1]);
      }
    }
    maxX = Math.max(maxX, x + (e.width ?? 0));
    maxY = Math.max(maxY, y + (e.height ?? 0));
  }
  return { width: maxX, height: maxY };
}

/** Returns a copy of the skeleton translated by (dx, dy). */
export function translateSkeleton(
  elements: Skeleton[],
  dx: number,
  dy: number,
): Skeleton[] {
  return elements.map((el) => {
    const e = el as unknown as { x?: number; y?: number };
    return {
      ...(el as object),
      x: (e.x ?? 0) + dx,
      y: (e.y ?? 0) + dy,
    } as Skeleton;
  });
}
