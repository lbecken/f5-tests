export function Toolbar({
  dark,
  onNew,
  onOpen,
  onSave,
  onExportPng,
  onExportSvg,
  onExportLibrary,
  onToggleTheme,
}: {
  dark: boolean;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onExportLibrary: () => void;
  onToggleTheme: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <svg
          className="brand-mark"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          aria-hidden="true"
        >
          <rect x="1" y="2" width="12" height="8" rx="1.5" fill="none" strokeWidth="1.8" />
          <rect x="11" y="14" width="12" height="8" rx="4" fill="none" strokeWidth="1.8" />
          <path d="M7 10v7a3 3 0 0 0 3 3h1" fill="none" strokeWidth="1.8" />
        </svg>
        <span className="brand-name">UMLdraw</span>
        <span className="brand-tag">UML diagrams, Excalidraw style</span>
      </div>
      <div className="topbar-actions">
        <button onClick={onNew}>New</button>
        <button onClick={onOpen}>Open…</button>
        <button onClick={onSave} className="primary">
          Save
        </button>
        <span className="divider" />
        <button onClick={onExportPng}>PNG</button>
        <button onClick={onExportSvg}>SVG</button>
        <button
          onClick={onExportLibrary}
          title="Download all UML shapes as an .excalidrawlib library — load it on excalidraw.com or any Excalidraw app"
        >
          UML lib
        </button>
        <span className="divider" />
        <button
          onClick={onToggleTheme}
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {dark ? "☀️" : "🌙"}
        </button>
      </div>
    </header>
  );
}
