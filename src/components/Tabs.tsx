import { useEffect, useRef, useState } from "react";
import type { DocMeta } from "../workspace";

export function Tabs({
  docs,
  activeId,
  onSelect,
  onClose,
  onRename,
  onAdd,
}: {
  docs: DocMeta[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onAdd: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const commit = () => {
    if (editingId && draft.trim()) onRename(editingId, draft.trim());
    setEditingId(null);
  };

  return (
    <div className="tabs" role="tablist">
      {docs.map((doc) => {
        const active = doc.id === activeId;
        return (
          <div
            key={doc.id}
            role="tab"
            aria-selected={active}
            className={`tab ${active ? "active" : ""}`}
            onClick={() => !active && onSelect(doc.id)}
            onDoubleClick={() => {
              setEditingId(doc.id);
              setDraft(doc.name);
            }}
            title={`${doc.name} — double-click to rename`}
          >
            {editingId === doc.id ? (
              <input
                ref={inputRef}
                className="tab-rename"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="tab-name">{doc.name}</span>
            )}
            <button
              className="tab-close"
              aria-label={`Close ${doc.name}`}
              title="Close tab"
              onClick={(e) => {
                e.stopPropagation();
                onClose(doc.id);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
      <button className="tab-add" onClick={onAdd} title="New diagram">
        +
      </button>
    </div>
  );
}
