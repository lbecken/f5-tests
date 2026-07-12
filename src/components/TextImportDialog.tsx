import { useEffect, useState } from "react";
import { parseDiagramText } from "../textImport";

const PLACEHOLDER = `Paste Mermaid or PlantUML here, e.g.

classDiagram
  class Customer {
    +name: string
    +register() void
  }
  PremiumCustomer --|> Customer
  Customer --> Order : places

or

flowchart TD
  A([Start]) --> B{In stock?}
  B -->|yes| C[Ship order]

or

@startuml
class Customer
Customer --> Order : places
@enduml`;

export function TextImportDialog({
  onImport,
  onClose,
}: {
  /** Returns an error message, or null on success (dialog closes). */
  onImport: (text: string) => string | null;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const doImport = () => {
    const parsed = parseDiagramText(text);
    if ("error" in parsed) {
      setError(parsed.error);
      setWarnings([]);
      return;
    }
    setWarnings(parsed.warnings);
    const err = onImport(text);
    if (err) setError(err);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-label="Import from text"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Import from text</h2>
          <button className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <textarea
          className="text-export-output text-import-input"
          placeholder={PLACEHOLDER}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          aria-label="Diagram text to import"
        />
        {error && <p className="text-import-error">{error}</p>}
        {warnings.length > 0 && (
          <p className="text-export-note">
            Skipped {warnings.length} unrecognized line
            {warnings.length > 1 ? "s" : ""}.
          </p>
        )}
        <p className="text-export-note">
          Supports Mermaid class diagrams and flowcharts, and PlantUML class /
          shape diagrams. The result opens as a new tab of fully editable
          shapes with auto layout.
        </p>
        <div className="text-export-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={doImport} disabled={!text.trim()}>
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
