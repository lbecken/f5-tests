import { useEffect } from "react";
import { TEMPLATES, type Template } from "../templates";
import { useSkeletonPreview } from "./previews";

function TemplateCard({
  template,
  dark,
  onPick,
}: {
  template: Template;
  dark: boolean;
  onPick: (template: Template | null) => void;
}) {
  const svg = useSkeletonPreview(
    `template-${template.id}`,
    template.elements,
    dark,
  );
  return (
    <button className="template-card" onClick={() => onPick(template)}>
      <span
        className="template-preview"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <span className="template-name">{template.name}</span>
      <span className="template-desc">{template.description}</span>
    </button>
  );
}

export function TemplateDialog({
  dark,
  onPick,
  onClose,
}: {
  dark: boolean;
  /** null = blank diagram */
  onPick: (template: Template | null) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-label="New diagram"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>New diagram</h2>
          <button className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="template-grid">
          <button className="template-card" onClick={() => onPick(null)}>
            <span className="template-preview template-blank">+</span>
            <span className="template-name">Blank</span>
            <span className="template-desc">Empty canvas</span>
          </button>
          {TEMPLATES.map((t) => (
            <TemplateCard key={t.id} template={t} dark={dark} onPick={onPick} />
          ))}
        </div>
      </div>
    </div>
  );
}
