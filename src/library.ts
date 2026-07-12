// The UML stencils exposed as a standard Excalidraw library: preloaded into
// the embedded editor's Library panel, and downloadable as .excalidrawlib for
// use on excalidraw.com or any other Excalidraw instance.
import {
  convertToExcalidrawElements,
  mergeLibraryItems,
  serializeLibraryAsJSON,
} from "@excalidraw/excalidraw";
import type { LibraryItems } from "@excalidraw/excalidraw/types";
import { STENCIL_GROUPS } from "./stencils";

const LIBRARY_KEY = "umldraw.library";

let cached: LibraryItems | null = null;

/** All stencils as Excalidraw library items with stable ids. */
export function buildUmlLibraryItems(): LibraryItems {
  if (cached) return cached;
  cached = STENCIL_GROUPS.flatMap((group) =>
    group.stencils.map((stencil) => ({
      id: `umldraw-${stencil.id}`,
      status: "unpublished" as const,
      name: `${group.title}: ${stencil.name}`,
      created: 0,
      elements: convertToExcalidrawElements(stencil.elements),
    })),
  );
  return cached;
}

export function saveStoredLibrary(items: LibraryItems) {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(items));
  } catch {
    // best-effort
  }
}

function loadStoredLibrary(): LibraryItems {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

/**
 * The user's persisted library merged with the built-in UML items (stable
 * ids keep this idempotent: existing UML items are not duplicated).
 */
export function initialLibraryItems(): LibraryItems {
  return mergeLibraryItems(loadStoredLibrary(), buildUmlLibraryItems());
}

/** .excalidrawlib file content with all UML stencils. */
export function umlLibraryJSON(): string {
  return serializeLibraryAsJSON(buildUmlLibraryItems());
}
