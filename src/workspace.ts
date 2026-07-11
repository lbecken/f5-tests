// Multi-document workspace persisted in localStorage. Each document (tab)
// stores its scene under its own key; the doc list and active id are stored
// separately. No server or database needed.

export interface DocMeta {
  id: string;
  name: string;
}

export interface SceneData {
  elements: unknown[];
  appState?: Record<string, unknown>;
}

const DOCS_KEY = "umldraw.docs";
const ACTIVE_KEY = "umldraw.activeDoc";
const LEGACY_SCENE_KEY = "umldraw.scene";

export const docKey = (id: string) => `umldraw.doc.${id}`;

export const newDocId = () =>
  `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function saveDocScene(id: string, sceneJson: string) {
  try {
    localStorage.setItem(docKey(id), sceneJson);
  } catch {
    // localStorage full or unavailable — persistence is best-effort.
  }
}

export function loadDocScene(id: string): SceneData | null {
  try {
    const raw = localStorage.getItem(docKey(id));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return { elements: data.elements ?? [], appState: data.appState ?? {} };
  } catch {
    return null;
  }
}

export function deleteDocScene(id: string) {
  localStorage.removeItem(docKey(id));
}

export function persistWorkspace(docs: DocMeta[], activeId: string) {
  try {
    localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
    localStorage.setItem(ACTIVE_KEY, activeId);
  } catch {
    // best-effort
  }
}

/**
 * Loads the doc list, migrating the single-scene format of earlier versions
 * (one scene under "umldraw.scene") into the first document.
 */
export function loadWorkspace(): { docs: DocMeta[]; activeId: string } {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    if (raw) {
      const docs = JSON.parse(raw) as DocMeta[];
      if (Array.isArray(docs) && docs.length > 0) {
        const active = localStorage.getItem(ACTIVE_KEY);
        const activeId = docs.some((d) => d.id === active)
          ? (active as string)
          : docs[0].id;
        return { docs, activeId };
      }
    }
  } catch {
    // fall through to a fresh workspace
  }

  const id = newDocId();
  const docs = [{ id, name: "Diagram 1" }];
  const legacy = localStorage.getItem(LEGACY_SCENE_KEY);
  if (legacy) {
    saveDocScene(id, legacy);
    localStorage.removeItem(LEGACY_SCENE_KEY);
  }
  persistWorkspace(docs, id);
  return { docs, activeId: id };
}

/** Next available "Diagram N" name. */
export function nextDocName(docs: DocMeta[]): string {
  let n = docs.length + 1;
  const names = new Set(docs.map((d) => d.name));
  while (names.has(`Diagram ${n}`)) n++;
  return `Diagram ${n}`;
}
