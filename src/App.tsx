import { useCallback, useRef, useState } from "react";
import {
  CaptureUpdateAction,
  Excalidraw,
  WelcomeScreen,
  convertToExcalidrawElements,
  exportToBlob,
  exportToSvg,
  loadFromBlob,
  serializeAsJSON,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";

import {
  initialLibraryItems,
  saveStoredLibrary,
  umlLibraryJSON,
} from "./library";
import { Palette, STENCIL_MIME } from "./components/Palette";
import { Tabs } from "./components/Tabs";
import { TemplateDialog } from "./components/TemplateDialog";
import { TextExportDialog } from "./components/TextExportDialog";
import { TextImportDialog } from "./components/TextImportDialog";
import { seqToSkeletons } from "./sequence";
import { modelToSkeletons, parseDiagramText } from "./textImport";
import { Toolbar } from "./components/Toolbar";
import { ALL_STENCILS } from "./stencils";
import {
  skeletonBounds,
  translateSkeleton,
  type Stencil,
} from "./stencils/types";
import type { Template } from "./templates";
import {
  deleteDocScene,
  loadDocScene,
  loadWorkspace,
  newDocId,
  nextDocName,
  persistWorkspace,
  saveDocScene,
  type DocMeta,
} from "./workspace";

const THEME_KEY = "umldraw.theme";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [dark, setDark] = useState(
    () => localStorage.getItem(THEME_KEY) === "dark",
  );
  const [workspace] = useState(loadWorkspace);
  const [docs, setDocs] = useState<DocMeta[]>(workspace.docs);
  const [activeId, setActiveId] = useState(workspace.activeId);
  const [showTemplates, setShowTemplates] = useState(false);
  const [textExportElements, setTextExportElements] = useState<
    readonly object[] | null
  >(null);
  const [showTextImport, setShowTextImport] = useState(false);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const [initialData] = useState(() => {
    const scene = loadDocScene(workspace.activeId);
    return {
      elements: (scene?.elements ?? []) as never[],
      appState: { ...(scene?.appState ?? {}), collaborators: new Map() },
      scrollToContent: true,
      libraryItems: initialLibraryItems(),
    };
  });

  const serializeCurrent = useCallback(() => {
    const api = apiRef.current;
    if (!api) return null;
    return serializeAsJSON(
      api.getSceneElements(),
      api.getAppState(),
      api.getFiles(),
      "local",
    );
  }, []);

  /** Immediately persist the current scene to the active document. */
  const flushSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    const json = serializeCurrent();
    if (json) saveDocScene(activeIdRef.current, json);
  }, [serializeCurrent]);

  const scheduleAutosave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const json = serializeCurrent();
      if (json) saveDocScene(activeIdRef.current, json);
    }, 500);
  }, [serializeCurrent]);

  /** Replace the canvas contents with the given document's scene. */
  const loadDocIntoCanvas = useCallback((id: string) => {
    const api = apiRef.current;
    if (!api) return;
    const scene = loadDocScene(id);
    api.resetScene();
    if (scene && scene.elements.length > 0) {
      api.updateScene({
        elements: scene.elements as never[],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      api.scrollToContent(undefined, { fitToContent: true });
    }
    api.history.clear();
  }, []);

  const switchDoc = useCallback(
    (id: string) => {
      if (id === activeIdRef.current) return;
      flushSave();
      setActiveId(id);
      setDocs((d) => {
        persistWorkspace(d, id);
        return d;
      });
      loadDocIntoCanvas(id);
    },
    [flushSave, loadDocIntoCanvas],
  );

  const createDoc = useCallback(
    (template: { name: string; elements: Template["elements"] } | null) => {
      flushSave();
      const id = newDocId();
      if (template) {
        const elements = convertToExcalidrawElements(template.elements, {
          regenerateIds: false,
        });
        saveDocScene(id, JSON.stringify({ elements, appState: {} }));
      }
      setDocs((d) => {
        const name = template ? template.name : nextDocName(d);
        const docs = [...d, { id, name }];
        persistWorkspace(docs, id);
        return docs;
      });
      setActiveId(id);
      loadDocIntoCanvas(id);
      setShowTemplates(false);
    },
    [flushSave, loadDocIntoCanvas],
  );

  const closeDoc = useCallback(
    (id: string) => {
      const scene = loadDocScene(id);
      const hasContent = (scene?.elements.length ?? 0) > 0;
      if (
        hasContent &&
        !window.confirm("Close this tab? The diagram will be deleted.")
      ) {
        return;
      }
      deleteDocScene(id);
      let next = docs.filter((doc) => doc.id !== id);
      let nextActive = activeId;
      if (next.length === 0) {
        nextActive = newDocId();
        next = [{ id: nextActive, name: "Diagram 1" }];
      } else if (id === activeId) {
        const idx = Math.max(0, docs.findIndex((doc) => doc.id === id) - 1);
        nextActive = next[Math.min(idx, next.length - 1)].id;
      }
      setDocs(next);
      setActiveId(nextActive);
      if (id === activeId) loadDocIntoCanvas(nextActive);
      persistWorkspace(next, nextActive);
    },
    [docs, activeId, loadDocIntoCanvas],
  );

  const renameDoc = useCallback((id: string, name: string) => {
    setDocs((d) => {
      const docs = d.map((doc) => (doc.id === id ? { ...doc, name } : doc));
      persistWorkspace(docs, activeIdRef.current);
      return docs;
    });
  }, []);

  const insertStencil = useCallback(
    (stencil: Stencil, at?: { clientX: number; clientY: number }) => {
      const api = apiRef.current;
      if (!api) return;
      const appState = api.getAppState();
      const viewport = at ?? {
        clientX: appState.offsetLeft + appState.width / 2,
        clientY: appState.offsetTop + appState.height / 2,
      };
      const scene = viewportCoordsToSceneCoords(viewport, appState);
      const { width, height } = skeletonBounds(stencil.elements);
      const inserted = convertToExcalidrawElements(
        translateSkeleton(
          stencil.elements,
          scene.x - width / 2,
          scene.y - height / 2,
        ),
        { regenerateIds: true },
      );
      api.updateScene({
        elements: [...api.getSceneElements(), ...inserted],
        appState: {
          selectedElementIds: Object.fromEntries(
            inserted.map((el) => [el.id, true as const]),
          ),
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      api.setActiveTool({ type: "selection" });
    },
    [],
  );

  const handleSave = useCallback(() => {
    const json = serializeCurrent();
    if (!json) return;
    const doc = docs.find((d) => d.id === activeId);
    const name = (doc?.name ?? "diagram").replace(/[^\w.-]+/g, "-");
    downloadBlob(
      new Blob([json], { type: "application/json" }),
      `${name}.excalidraw`,
    );
  }, [serializeCurrent, docs, activeId]);

  const handleOpenFile = useCallback(
    async (file: File) => {
      try {
        const restored = await loadFromBlob(file, null, null);
        flushSave();
        const id = newDocId();
        saveDocScene(
          id,
          JSON.stringify({
            elements: restored.elements,
            appState: {},
          }),
        );
        const name = file.name.replace(/\.(excalidraw|json)$/i, "");
        setDocs((d) => {
          const docs = [...d, { id, name: name || nextDocName(d) }];
          persistWorkspace(docs, id);
          return docs;
        });
        setActiveId(id);
        loadDocIntoCanvas(id);
      } catch (error) {
        window.alert(
          `Could not open the file: ${error instanceof Error ? error.message : error}`,
        );
      }
    },
    [flushSave, loadDocIntoCanvas],
  );

  const handleExport = useCallback(
    async (format: "png" | "svg") => {
      const api = apiRef.current;
      if (!api) return;
      const elements = api.getSceneElements();
      if (elements.length === 0) {
        window.alert("Nothing to export — the canvas is empty.");
        return;
      }
      const appState = { ...api.getAppState(), exportBackground: true };
      const files = api.getFiles();
      const doc = docs.find((d) => d.id === activeId);
      const name = (doc?.name ?? "diagram").replace(/[^\w.-]+/g, "-");
      if (format === "png") {
        const blob = await exportToBlob({
          elements,
          appState,
          files,
          mimeType: "image/png",
          exportPadding: 24,
        });
        downloadBlob(blob, `${name}.png`);
      } else {
        const svg = await exportToSvg({
          elements,
          appState,
          files,
          exportPadding: 24,
        });
        const markup = new XMLSerializer().serializeToString(svg);
        downloadBlob(
          new Blob([markup], { type: "image/svg+xml" }),
          `${name}.svg`,
        );
      }
    },
    [docs, activeId],
  );

  const handleTextImport = useCallback(
    (text: string): string | null => {
      const parsed = parseDiagramText(text);
      if ("error" in parsed) return parsed.error;
      const skeletons =
        parsed.kind === "sequence"
          ? seqToSkeletons(parsed.seq)
          : modelToSkeletons(parsed.model);
      if (skeletons.length === 0) return "Nothing to import.";
      const name =
        parsed.kind === "sequence"
          ? "Imported sequence diagram"
          : parsed.format === "mermaid-flow"
            ? "Imported flowchart"
            : "Imported class diagram";
      createDoc({ name, elements: skeletons });
      setShowTextImport(false);
      return null;
    },
    [createDoc],
  );

  const openTextExport = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const elements = api.getSceneElements();
    if (elements.length === 0) {
      window.alert("Nothing to export — the canvas is empty.");
      return;
    }
    setTextExportElements(elements);
  }, []);

  const handleExportLibrary = useCallback(() => {
    downloadBlob(
      new Blob([umlLibraryJSON()], { type: "application/json" }),
      "umldraw-uml.excalidrawlib",
    );
  }, []);

  const toggleTheme = useCallback(() => {
    setDark((d) => {
      localStorage.setItem(THEME_KEY, d ? "light" : "dark");
      return !d;
    });
  }, []);

  return (
    <div className={`app ${dark ? "dark" : ""}`}>
      <Toolbar
        dark={dark}
        onNew={() => setShowTemplates(true)}
        onOpen={() => fileInputRef.current?.click()}
        onImportText={() => setShowTextImport(true)}
        onSave={handleSave}
        onExportPng={() => handleExport("png")}
        onExportSvg={() => handleExport("svg")}
        onExportText={openTextExport}
        onExportLibrary={handleExportLibrary}
        onToggleTheme={toggleTheme}
      />
      <Tabs
        docs={docs}
        activeId={activeId}
        onSelect={switchDoc}
        onClose={closeDoc}
        onRename={renameDoc}
        onAdd={() => setShowTemplates(true)}
      />
      <div className="main">
        <Palette dark={dark} onInsert={insertStencil} />
        <div
          className="canvas-wrap"
          onDragOverCapture={(e) => {
            if (e.dataTransfer.types.includes(STENCIL_MIME)) {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDropCapture={(e) => {
            const id = e.dataTransfer.getData(STENCIL_MIME);
            if (!id) return;
            e.preventDefault();
            e.stopPropagation();
            const stencil = ALL_STENCILS.get(id);
            if (stencil) {
              insertStencil(stencil, {
                clientX: e.clientX,
                clientY: e.clientY,
              });
            }
          }}
        >
          <Excalidraw
            excalidrawAPI={(api) => {
              apiRef.current = api;
            }}
            initialData={initialData}
            theme={dark ? "dark" : "light"}
            onChange={scheduleAutosave}
            onLibraryChange={saveStoredLibrary}
            UIOptions={{
              canvasActions: { toggleTheme: false },
            }}
          >
            <WelcomeScreen>
              <WelcomeScreen.Center>
                <WelcomeScreen.Center.Heading>
                  Pick a UML shape from the left panel, or start from a
                  template via “New”
                </WelcomeScreen.Center.Heading>
              </WelcomeScreen.Center>
            </WelcomeScreen>
          </Excalidraw>
        </div>
      </div>
      {showTextImport && (
        <TextImportDialog
          onImport={handleTextImport}
          onClose={() => setShowTextImport(false)}
        />
      )}
      {textExportElements && (
        <TextExportDialog
          elements={textExportElements}
          onDownload={(content, filename) => {
            downloadBlob(new Blob([content], { type: "text/plain" }), filename);
          }}
          onClose={() => setTextExportElements(null)}
        />
      )}
      {showTemplates && (
        <TemplateDialog
          dark={dark}
          onPick={createDoc}
          onClose={() => setShowTemplates(false)}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".excalidraw,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleOpenFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
