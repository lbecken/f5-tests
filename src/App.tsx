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

import { Palette, STENCIL_MIME } from "./components/Palette";
import { Toolbar } from "./components/Toolbar";
import { ALL_STENCILS } from "./stencils";
import {
  skeletonBounds,
  translateSkeleton,
  type Stencil,
} from "./stencils/types";

const SCENE_KEY = "umldraw.scene";
const THEME_KEY = "umldraw.theme";

function loadInitialData() {
  try {
    const raw = localStorage.getItem(SCENE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      elements: data.elements ?? [],
      appState: { ...(data.appState ?? {}), collaborators: new Map() },
      scrollToContent: true,
    };
  } catch {
    return null;
  }
}

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
  const [initialData] = useState(loadInitialData);

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

  const scheduleAutosave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const api = apiRef.current;
      if (!api) return;
      try {
        localStorage.setItem(
          SCENE_KEY,
          serializeAsJSON(
            api.getSceneElements(),
            api.getAppState(),
            api.getFiles(),
            "local",
          ),
        );
      } catch {
        // localStorage full or unavailable — autosave is best-effort.
      }
    }, 500);
  }, []);

  const handleNew = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    if (
      api.getSceneElements().length > 0 &&
      !window.confirm("Clear the canvas and start a new diagram?")
    ) {
      return;
    }
    api.resetScene();
    localStorage.removeItem(SCENE_KEY);
  }, []);

  const handleSave = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const json = serializeAsJSON(
      api.getSceneElements(),
      api.getAppState(),
      api.getFiles(),
      "local",
    );
    downloadBlob(
      new Blob([json], { type: "application/json" }),
      "diagram.excalidraw",
    );
  }, []);

  const handleOpenFile = useCallback(async (file: File) => {
    const api = apiRef.current;
    if (!api) return;
    try {
      const restored = await loadFromBlob(file, null, null);
      api.updateScene({
        elements: restored.elements,
        appState: restored.appState,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      api.scrollToContent(undefined, { fitToContent: true });
    } catch (error) {
      window.alert(
        `Could not open the file: ${error instanceof Error ? error.message : error}`,
      );
    }
  }, []);

  const handleExport = useCallback(async (format: "png" | "svg") => {
    const api = apiRef.current;
    if (!api) return;
    const elements = api.getSceneElements();
    if (elements.length === 0) {
      window.alert("Nothing to export — the canvas is empty.");
      return;
    }
    const appState = { ...api.getAppState(), exportBackground: true };
    const files = api.getFiles();
    if (format === "png") {
      const blob = await exportToBlob({
        elements,
        appState,
        files,
        mimeType: "image/png",
        exportPadding: 24,
      });
      downloadBlob(blob, "diagram.png");
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
        "diagram.svg",
      );
    }
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
        onNew={handleNew}
        onOpen={() => fileInputRef.current?.click()}
        onSave={handleSave}
        onExportPng={() => handleExport("png")}
        onExportSvg={() => handleExport("svg")}
        onToggleTheme={toggleTheme}
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
              insertStencil(stencil, { clientX: e.clientX, clientY: e.clientY });
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
            UIOptions={{
              canvasActions: { toggleTheme: false },
            }}
          >
            <WelcomeScreen>
              <WelcomeScreen.Center>
                <WelcomeScreen.Center.Heading>
                  Pick a UML shape from the left panel to get started
                </WelcomeScreen.Center.Heading>
              </WelcomeScreen.Center>
            </WelcomeScreen>
          </Excalidraw>
        </div>
      </div>
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
