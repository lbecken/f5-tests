import { memo, useEffect, useMemo, useRef, useState } from "react";
import { convertToExcalidrawElements, exportToSvg } from "@excalidraw/excalidraw";
import { STENCIL_GROUPS } from "../stencils";
import type { Stencil } from "../stencils/types";

export const STENCIL_MIME = "application/x-uml-stencil";

const previewCache = new Map<string, string>();

async function renderPreview(stencil: Stencil, dark: boolean): Promise<string> {
  const key = `${stencil.id}:${dark ? "dark" : "light"}`;
  const cached = previewCache.get(key);
  if (cached) return cached;
  const svg = await exportToSvg({
    elements: convertToExcalidrawElements(stencil.elements),
    appState: {
      exportBackground: false,
      exportWithDarkMode: dark,
      exportEmbedScene: false,
    },
    files: null,
    exportPadding: 6,
  });
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const html = svg.outerHTML;
  previewCache.set(key, html);
  return html;
}

const StencilCard = memo(function StencilCard({
  stencil,
  dark,
  onInsert,
}: {
  stencil: Stencil;
  dark: boolean;
  onInsert: (stencil: Stencil) => void;
}) {
  const [svg, setSvg] = useState<string>("");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    renderPreview(stencil, dark).then((html) => {
      if (alive.current) setSvg(html);
    });
    return () => {
      alive.current = false;
    };
  }, [stencil, dark]);

  return (
    <button
      className="stencil-card"
      title={`${stencil.name} — click or drag onto the canvas`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(STENCIL_MIME, stencil.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onInsert(stencil)}
    >
      <span
        className="stencil-preview"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <span className="stencil-name">{stencil.name}</span>
    </button>
  );
});

export function Palette({
  dark,
  onInsert,
}: {
  dark: boolean;
  onInsert: (stencil: Stencil) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({ class: true });
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STENCIL_GROUPS;
    return STENCIL_GROUPS.map((g) => ({
      ...g,
      stencils: g.stencils.filter(
        (s) =>
          s.name.toLowerCase().includes(q) || g.title.toLowerCase().includes(q),
      ),
    })).filter((g) => g.stencils.length > 0);
  }, [query]);

  const searching = query.trim().length > 0;

  return (
    <aside className="palette">
      <div className="palette-search">
        <input
          type="search"
          placeholder="Search shapes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search shapes"
        />
      </div>
      <div className="palette-groups">
        {groups.map((group) => {
          const isOpen = searching || !!open[group.kind];
          return (
            <section key={group.kind} className="palette-group">
              <button
                className="palette-group-header"
                onClick={() =>
                  setOpen((o) => ({ ...o, [group.kind]: !o[group.kind] }))
                }
                aria-expanded={isOpen}
              >
                <span className={`chevron ${isOpen ? "open" : ""}`}>▸</span>
                {group.title}
                <span className="count">{group.stencils.length}</span>
              </button>
              {isOpen && (
                <div className="stencil-grid">
                  {group.stencils.map((s) => (
                    <StencilCard
                      key={s.id}
                      stencil={s}
                      dark={dark}
                      onInsert={onInsert}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
        {groups.length === 0 && (
          <p className="palette-empty">No shapes match “{query}”.</p>
        )}
      </div>
      <p className="palette-hint">Drag onto the canvas, or click to insert.</p>
    </aside>
  );
}
