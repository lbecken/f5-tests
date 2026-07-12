import { useEffect, useMemo, useState } from "react";
import {
  analyzeSequenceScene,
  generateMermaidSequence,
  generatePlantUMLSequence,
} from "../sequence";
import {
  analyzeScene,
  generateMermaid,
  generatePlantUML,
} from "../textExport";

type Format = "mermaid" | "plantuml";

export function TextExportDialog({
  elements,
  onDownload,
  onClose,
}: {
  elements: readonly object[];
  onDownload: (content: string, filename: string) => void;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<Format>("mermaid");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const seq = useMemo(() => analyzeSequenceScene(elements), [elements]);
  const model = useMemo(
    () => (seq ? null : analyzeScene(elements)),
    [elements, seq],
  );
  const text = useMemo(() => {
    if (seq) {
      return format === "mermaid"
        ? generateMermaidSequence(seq)
        : generatePlantUMLSequence(seq);
    }
    return format === "mermaid"
      ? generateMermaid(model!)
      : generatePlantUML(model!);
  }, [seq, model, format]);
  const detected = seq
    ? `sequence diagram (${seq.participants.length} participants, ${seq.events.length} messages)`
    : model!.classes.length > 0
      ? `class diagram (${model!.classes.length} classes, ${model!.edges.length} relations)`
      : `flowchart (${model!.nodes.length} nodes, ${model!.edges.length} edges)`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (permissions) — user can select the textarea
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-label="Export as text"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Export as text</h2>
          <button className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="text-export-controls">
          <label>
            <input
              type="radio"
              name="format"
              checked={format === "mermaid"}
              onChange={() => setFormat("mermaid")}
            />
            Mermaid
          </label>
          <label>
            <input
              type="radio"
              name="format"
              checked={format === "plantuml"}
              onChange={() => setFormat("plantuml")}
            />
            PlantUML
          </label>
          <span className="text-export-detected">Detected: {detected}</span>
        </div>
        <textarea
          className="text-export-output"
          readOnly
          value={text}
          aria-label="Generated diagram text"
          onFocus={(e) => e.target.select()}
        />
        <p className="text-export-note">
          Best-effort conversion: recognized shapes and connected (bound)
          arrows are exported; notes, frames and decorative figures are
          skipped.
        </p>
        <div className="text-export-actions">
          <button onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
          <button
            className="primary"
            onClick={() =>
              onDownload(
                text,
                format === "mermaid" ? "diagram.mmd" : "diagram.puml",
              )
            }
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
