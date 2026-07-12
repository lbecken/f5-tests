// Sequence-diagram text support: parse Mermaid `sequenceDiagram` and
// PlantUML sequence syntax into a SeqModel, render the model to Excalidraw
// skeletons (lifelines, messages, activations, fragments, notes), and
// recognize sequence diagrams on the canvas for text export.
import {
  DASHED,
  NOTE,
  VIOLET,
  actor as actorFigure,
  arrow,
  bindStrip,
  grouped,
  label,
  line,
  rect,
  text,
} from "./stencils/builders";
import type { Skeleton } from "./stencils/types";

export type MessageStyle = "sync" | "async" | "return" | "line";

export interface SeqParticipant {
  id: string;
  name: string;
  actor: boolean;
}

export type SeqEvent =
  | {
      type: "message";
      from: string;
      to: string;
      label?: string;
      style: MessageStyle;
      activateTarget?: boolean;
      deactivateSource?: boolean;
    }
  | { type: "note"; over: string[]; text: string }
  | { type: "activate"; participant: string }
  | { type: "deactivate"; participant: string }
  | { type: "blockStart"; kind: string; label?: string }
  | { type: "blockElse"; label?: string }
  | { type: "blockEnd" };

export interface SeqModel {
  participants: SeqParticipant[];
  events: SeqEvent[];
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const BLOCK_KINDS = /^(loop|alt|opt|par|critical|break|group)\b\s*(.*)$/i;

class ParticipantRegistry {
  list: SeqParticipant[] = [];
  private byKey = new Map<string, SeqParticipant>();

  ensure(key: string, name?: string, actor = false): SeqParticipant {
    const k = key.replace(/^"|"$/g, "");
    let p = this.byKey.get(k);
    if (!p) {
      p = { id: `P${this.list.length}`, name: name ?? k, actor };
      this.byKey.set(k, p);
      this.list.push(p);
    } else {
      if (name) p.name = name;
      if (actor) p.actor = true;
    }
    return p;
  }
}

export interface SeqParseResult {
  model: SeqModel;
  warnings: string[];
}

export function parseMermaidSequence(lines: string[]): SeqParseResult {
  const reg = new ParticipantRegistry();
  const events: SeqEvent[] = [];
  const warnings: string[] = [];

  for (const raw of lines) {
    const lineText = raw.replace(/%%.*$/, "").trim();
    if (
      !lineText ||
      /^(sequenceDiagram|autonumber|title\b|box\b|rect\b)/i.test(lineText)
    ) {
      continue;
    }
    let m = lineText.match(/^(participant|actor)\s+([\w"]+)(?:\s+as\s+(.+))?$/i);
    if (m) {
      reg.ensure(m[2], m[3]?.trim(), m[1].toLowerCase() === "actor");
      continue;
    }
    m = lineText.match(/^(activate|deactivate)\s+([\w"]+)$/i);
    if (m) {
      const p = reg.ensure(m[2]);
      events.push({
        type: m[1].toLowerCase() as "activate" | "deactivate",
        participant: p.id,
      });
      continue;
    }
    m = lineText.match(
      /^[Nn]ote\s+(?:over\s+([\w"]+)(?:\s*,\s*([\w"]+))?|(?:left|right)\s+of\s+([\w"]+))\s*:\s*(.*)$/,
    );
    if (m) {
      const over = [m[1] ?? m[3], m[2]]
        .filter(Boolean)
        .map((k) => reg.ensure(k!).id);
      events.push({ type: "note", over, text: m[4].trim() });
      continue;
    }
    m = lineText.match(BLOCK_KINDS);
    if (m) {
      events.push({
        type: "blockStart",
        kind: m[1].toLowerCase(),
        label: m[2].trim() || undefined,
      });
      continue;
    }
    m = lineText.match(/^else\b\s*(.*)$/i);
    if (m) {
      events.push({ type: "blockElse", label: m[1].trim() || undefined });
      continue;
    }
    if (/^end$/i.test(lineText)) {
      events.push({ type: "blockEnd" });
      continue;
    }
    // A->>+B: msg   A-->>-B: msg   A-)B: msg   A->B: msg   A--xB: msg
    m = lineText.match(
      /^([\w"]+)\s*(--|-)(>>|>|x|\))\s*([+-]?)\s*([\w"]+)\s*:\s*(.*)$/,
    );
    if (m) {
      const from = reg.ensure(m[1]);
      const to = reg.ensure(m[5]);
      const dashed = m[2] === "--";
      const head = m[3];
      let style: MessageStyle;
      if (head === ">") style = "line";
      else if (dashed) style = "return";
      else if (head === ")") style = "async";
      else style = "sync";
      events.push({
        type: "message",
        from: from.id,
        to: to.id,
        label: m[6].trim() || undefined,
        style,
        activateTarget: m[4] === "+",
        deactivateSource: m[4] === "-",
      });
      continue;
    }
    warnings.push(`Skipped: ${lineText}`);
  }
  return { model: { participants: reg.list, events }, warnings };
}

export function parsePlantUMLSequence(lines: string[]): SeqParseResult {
  const reg = new ParticipantRegistry();
  const events: SeqEvent[] = [];
  const warnings: string[] = [];
  let inBlockNote = false;

  for (const raw of lines) {
    const lineText = raw.replace(/'.*$/, "").trim();
    if (inBlockNote) {
      if (/^end\s*note$/i.test(lineText)) inBlockNote = false;
      continue;
    }
    if (
      !lineText ||
      /^(@startuml|@enduml|skinparam\b|title\b|hide\b|autonumber\b|autoactivate\b|!|scale\b|==)/i.test(
        lineText,
      )
    ) {
      continue;
    }
    let m = lineText.match(
      /^(participant|actor|boundary|control|entity|database|collections|queue)\s+(?:"([^"]+)"\s+as\s+([\w.]+)|([\w.]+)\s+as\s+"([^"]+)"|"([^"]+)"|([\w.]+))\s*$/i,
    );
    if (m) {
      const key = m[3] ?? m[4] ?? m[6] ?? m[7];
      const name = m[2] ?? m[5] ?? m[6] ?? key;
      reg.ensure(key, name, m[1].toLowerCase() === "actor");
      continue;
    }
    m = lineText.match(/^(activate|deactivate)\s+([\w."]+)$/i);
    if (m) {
      events.push({
        type: m[1].toLowerCase() as "activate" | "deactivate",
        participant: reg.ensure(m[2]).id,
      });
      continue;
    }
    m = lineText.match(
      /^note\s+(?:over\s+([\w."]+)(?:\s*,\s*([\w."]+))?|(?:left|right)(?:\s+of\s+([\w."]+))?)\s*(?::\s*(.*))?$/i,
    );
    if (m) {
      if (m[4] === undefined) {
        inBlockNote = true; // multi-line note body — skipped
        continue;
      }
      const over = [m[1] ?? m[3], m[2]]
        .filter(Boolean)
        .map((k) => reg.ensure(k!).id);
      if (over.length > 0) {
        events.push({ type: "note", over, text: m[4].trim() });
      }
      continue;
    }
    m = lineText.match(BLOCK_KINDS);
    if (m) {
      events.push({
        type: "blockStart",
        kind: m[1].toLowerCase() === "group" ? "group" : m[1].toLowerCase(),
        label: m[2].trim() || undefined,
      });
      continue;
    }
    m = lineText.match(/^else\b\s*(.*)$/i);
    if (m) {
      events.push({ type: "blockElse", label: m[1].trim() || undefined });
      continue;
    }
    if (/^end$/i.test(lineText)) {
      events.push({ type: "blockEnd" });
      continue;
    }
    // A -> B : msg    B --> A : msg    A ->> B ++ : msg    A <- B : msg
    m = lineText.match(
      /^([\w."]+)\s*(<<--|<--|<<-|<-|-->>|-->|->>|->)\s*([\w."]+)\s*(\+\+|--)?\s*(?::\s*(.*))?$/,
    );
    if (m) {
      const reversed = m[2].startsWith("<");
      const fromP = reg.ensure(reversed ? m[3] : m[1]);
      const toP = reg.ensure(reversed ? m[1] : m[3]);
      const dashed = m[2].includes("--");
      const thin = m[2].includes(">>") || m[2].includes("<<");
      const style: MessageStyle = dashed ? "return" : thin ? "async" : "sync";
      events.push({
        type: "message",
        from: fromP.id,
        to: toP.id,
        label: m[5]?.trim() || undefined,
        style,
        activateTarget: m[4] === "++",
        deactivateSource: m[4] === "--",
      });
      continue;
    }
    warnings.push(`Skipped: ${lineText}`);
  }
  return { model: { participants: reg.list, events }, warnings };
}

// ---------------------------------------------------------------------------
// Rendering: SeqModel -> Excalidraw skeletons
// ---------------------------------------------------------------------------

const MSG_STYLE: Record<MessageStyle, Record<string, unknown>> = {
  sync: { endArrowhead: "triangle" },
  async: { endArrowhead: "arrow" },
  return: { endArrowhead: "arrow", ...DASHED },
  line: {},
};

export function seqToSkeletons(model: SeqModel): Skeleton[] {
  const { participants, events } = model;
  if (participants.length === 0) return [];

  // --- Horizontal layout ---------------------------------------------------
  const cx = new Map<string, number>();
  const boxW = new Map<string, number>();
  let x = 0;
  for (const p of participants) {
    const w = p.actor
      ? Math.max(90, p.name.length * 8 + 20)
      : Math.max(120, p.name.length * 8.5 + 36);
    boxW.set(p.id, w);
    cx.set(p.id, x + w / 2);
    x += w + 80;
  }
  const minX = Math.min(...[...cx.values()]) - 70;
  const maxX = Math.max(...[...cx.values()]) + 70;

  const anyActor = participants.some((p) => p.actor);
  const headBottom = anyActor ? 128 : 44;

  // --- Vertical walk through events ----------------------------------------
  const heads: Skeleton[] = [];
  const activations: Skeleton[] = [];
  const frames: Skeleton[] = [];
  const body: Skeleton[] = [];

  let y = headBottom + 50;
  const activationStack = new Map<string, number[]>();
  const blockStack: { kind: string; label?: string; yStart: number }[] = [];

  const beginActivation = (pid: string, atY: number) => {
    if (!activationStack.has(pid)) activationStack.set(pid, []);
    activationStack.get(pid)!.push(atY);
  };
  const endActivation = (pid: string, atY: number) => {
    const start = activationStack.get(pid)?.pop();
    if (start === undefined) return;
    activations.push(
      rect(cx.get(pid)! - 7, start - 8, 14, atY - start + 20, {
        backgroundColor: VIOLET,
        // lets the scene guard keep the bar centered on its lifeline
        customData: { umlActivationOf: `part-${pid}` },
      }),
    );
  };

  for (const ev of events) {
    switch (ev.type) {
      case "message": {
        const fx = cx.get(ev.from)!;
        const tx = cx.get(ev.to)!;
        if (ev.activateTarget) beginActivation(ev.to, y);
        if (ev.from === ev.to) {
          body.push(
            arrow(fx, y, [[0, 0], [64, 0], [64, 38], [10, 38]], {
              ...MSG_STYLE[ev.style === "line" ? "sync" : ev.style],
              ...(ev.label
                ? { label: label(ev.label, { fontSize: 13 }) }
                : {}),
            }),
          );
          y += 78;
        } else {
          body.push(
            arrow(fx, y, [[0, 0], [tx - fx, 0]], {
              ...MSG_STYLE[ev.style],
              ...(ev.label
                ? { label: label(ev.label, { fontSize: 13 }) }
                : {}),
            }),
          );
          y += 58;
        }
        if (ev.deactivateSource) endActivation(ev.from, y - 20);
        break;
      }
      case "note": {
        const xs = ev.over.map((id) => cx.get(id)!);
        const left = Math.min(...xs) - 60;
        const width = Math.max(...xs) + 60 - left;
        body.push(
          rect(left, y - 14, Math.max(width, 140), 44, {
            backgroundColor: NOTE,
            label: label(ev.text, { fontSize: 13 }),
          }),
        );
        y += 66;
        break;
      }
      case "activate":
        beginActivation(ev.participant, y - 16);
        break;
      case "deactivate":
        endActivation(ev.participant, y - 16);
        break;
      case "blockStart":
        blockStack.push({ kind: ev.kind, label: ev.label, yStart: y - 12 });
        y += 44;
        break;
      case "blockElse":
        body.push(
          line(minX, y - 8, [[0, 0], [maxX - minX, 0]], DASHED),
          ...(ev.label
            ? [text(minX + 70, y - 2, `[${ev.label}]`, { fontSize: 13 })]
            : []),
        );
        y += 40;
        break;
      case "blockEnd": {
        const b = blockStack.pop();
        if (!b) break;
        frames.push(
          ...grouped(`frag-${frames.length}`, [
            rect(minX, b.yStart, maxX - minX, y - b.yStart, {
              backgroundColor: "transparent",
            }),
            rect(minX, b.yStart, 64, 26, {
              backgroundColor: VIOLET,
              label: label(b.kind, { fontSize: 13 }),
            }),
            ...(b.label
              ? [
                  text(minX + 74, b.yStart + 4, `[${b.label}]`, {
                    fontSize: 13,
                  }),
                ]
              : []),
          ]),
        );
        y += 30;
        break;
      }
    }
  }

  const bottom = y + 16;
  for (const [pid, starts] of activationStack) {
    while (starts.length > 0) endActivation(pid, bottom - 24);
  }

  // --- Heads + lifelines (grouped so each participant moves as one) --------
  for (const p of participants) {
    const c = cx.get(p.id)!;
    const lifeline = line(
      c,
      headBottom,
      [[0, 0], [0, bottom - headBottom]],
      DASHED,
    );
    const head = p.actor
      ? actorFigure(p.name, c - 32, 0)
      : [
          rect(c - boxW.get(p.id)! / 2, headBottom - 44, boxW.get(p.id)!, 44, {
            id: p.id,
            backgroundColor: VIOLET,
            label: label(p.name),
          }),
        ];
    heads.push(
      ...grouped(`part-${p.id}`, [
        ...head,
        lifeline,
        bindStrip(c, headBottom, bottom - headBottom),
      ]),
    );
  }

  return [...heads, ...activations, ...frames, ...body];
}

// ---------------------------------------------------------------------------
// Canvas recognition (for text export)
// ---------------------------------------------------------------------------

interface AnyEl {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
  strokeStyle?: string;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  containerId?: string | null;
  text?: string;
  points?: readonly (readonly number[])[];
}

const LIFELINE_MATCH = 45;

export function analyzeSequenceScene(
  elements: readonly object[],
): SeqModel | null {
  const els = (elements as AnyEl[]).filter((e) => !e.isDeleted);
  const labelByContainer = new Map<string, string>();
  for (const el of els) {
    if (el.type === "text" && el.containerId) {
      labelByContainer.set(el.containerId, el.text ?? "");
    }
  }

  // Lifelines: near-vertical dashed lines, long enough to matter.
  const participants: SeqParticipant[] = [];
  const lifelineX: number[] = [];
  for (const el of els) {
    if (el.type !== "line" || el.strokeStyle !== "dashed") continue;
    const pts = el.points ?? [];
    if (pts.length < 2) continue;
    const dx = Math.abs(pts[pts.length - 1][0] - pts[0][0]);
    const dy = Math.abs(pts[pts.length - 1][1] - pts[0][1]);
    if (dx > 10 || dy < 80) continue;
    const lx = el.x + pts[0][0];
    const topY = el.y + Math.min(pts[0][1], pts[pts.length - 1][1]);

    // A labeled box right above the line start = participant head.
    let name: string | undefined;
    let isActor = false;
    for (const box of els) {
      if (box.type !== "rectangle") continue;
      const lbl = (labelByContainer.get(box.id) ?? "").trim();
      if (!lbl) continue;
      if (
        Math.abs(box.y + box.height - topY) <= 30 &&
        lx >= box.x - 5 &&
        lx <= box.x + box.width + 5
      ) {
        name = lbl;
        break;
      }
    }
    if (!name) {
      // An actor figure: a standalone text just above the lifeline.
      for (const t of els) {
        if (t.type !== "text" || t.containerId || !t.text) continue;
        const tcx = t.x + t.width / 2;
        if (
          Math.abs(tcx - lx) <= 55 &&
          topY - (t.y + t.height) >= -10 &&
          topY - (t.y + t.height) <= 60
        ) {
          name = t.text.trim();
          isActor = true;
          break;
        }
      }
    }
    participants.push({
      id: `P${participants.length}`,
      name: name ?? `P${participants.length + 1}`,
      actor: isActor,
    });
    lifelineX.push(lx);
  }
  if (participants.length < 2) return null;

  const nearest = (px: number): string | undefined => {
    let best: { id: string; d: number } | undefined;
    lifelineX.forEach((lx, i) => {
      const d = Math.abs(px - lx);
      if (d <= LIFELINE_MATCH && (!best || d < best.d)) {
        best = { id: participants[i].id, d };
      }
    });
    return best?.id;
  };

  // Messages: horizontal-ish arrows between two lifelines, plus polyline
  // self-messages that return to the same lifeline.
  const messages: { y: number; ev: SeqEvent }[] = [];
  for (const el of els) {
    if (el.type !== "arrow") continue;
    const pts = el.points ?? [];
    if (pts.length < 2) continue;
    const sx = el.x + pts[0][0];
    const sy = el.y + pts[0][1];
    const ex = el.x + pts[pts.length - 1][0];
    const ey = el.y + pts[pts.length - 1][1];
    const from = nearest(sx);
    const to = nearest(ex);
    if (!from || !to) continue;
    const isSelf = from === to && pts.length > 2;
    if (!isSelf && (from === to || Math.abs(ey - sy) > 30)) continue;

    const dashed = el.strokeStyle === "dashed" || el.strokeStyle === "dotted";
    const style: MessageStyle = dashed
      ? "return"
      : el.endArrowhead === "triangle"
        ? "sync"
        : el.endArrowhead
          ? "async"
          : "line";
    messages.push({
      y: Math.min(sy, ey),
      ev: {
        type: "message",
        from,
        to,
        style,
        label:
          (labelByContainer.get(el.id) ?? "").trim().replace(/\n/g, " ") ||
          undefined,
      },
    });
  }
  if (messages.length === 0) return null;

  // Order participants left-to-right and messages top-to-bottom.
  const order = lifelineX
    .map((lx, i) => ({ lx, p: participants[i] }))
    .sort((a, b) => a.lx - b.lx)
    .map((e) => e.p);
  messages.sort((a, b) => a.y - b.y);
  return { participants: order, events: messages.map((m) => m.ev) };
}

// ---------------------------------------------------------------------------
// Text generation
// ---------------------------------------------------------------------------

const idFor = (p: SeqParticipant) =>
  p.name.replace(/\W+/g, "") || p.id;

export function generateMermaidSequence(model: SeqModel): string {
  const out = ["sequenceDiagram"];
  const ids = new Map<string, string>();
  const used = new Set<string>();
  for (const p of model.participants) {
    let id = idFor(p);
    while (used.has(id)) id += "_";
    used.add(id);
    ids.set(p.id, id);
    const kw = p.actor ? "actor" : "participant";
    out.push(
      id === p.name ? `  ${kw} ${id}` : `  ${kw} ${id} as ${p.name}`,
    );
  }
  const op: Record<MessageStyle, string> = {
    sync: "->>",
    async: "-)",
    return: "-->>",
    line: "->",
  };
  for (const ev of model.events) {
    switch (ev.type) {
      case "message":
        out.push(
          `  ${ids.get(ev.from)}${op[ev.style]}${ids.get(ev.to)}: ${ev.label ?? " "}`,
        );
        break;
      case "note":
        out.push(
          `  Note over ${ev.over.map((o) => ids.get(o)).join(",")}: ${ev.text}`,
        );
        break;
      case "blockStart":
        out.push(`  ${ev.kind}${ev.label ? ` ${ev.label}` : ""}`);
        break;
      case "blockElse":
        out.push(`  else${ev.label ? ` ${ev.label}` : ""}`);
        break;
      case "blockEnd":
        out.push("  end");
        break;
      case "activate":
        out.push(`  activate ${ids.get(ev.participant)}`);
        break;
      case "deactivate":
        out.push(`  deactivate ${ids.get(ev.participant)}`);
        break;
    }
  }
  return out.join("\n");
}

export function generatePlantUMLSequence(model: SeqModel): string {
  const out = ["@startuml"];
  for (const p of model.participants) {
    out.push(`${p.actor ? "actor" : "participant"} "${p.name}" as ${p.id}`);
  }
  const op: Record<MessageStyle, string> = {
    sync: "->",
    async: "->>",
    return: "-->",
    line: "->",
  };
  for (const ev of model.events) {
    switch (ev.type) {
      case "message":
        out.push(
          `${ev.from} ${op[ev.style]} ${ev.to}${ev.label ? ` : ${ev.label}` : ""}`,
        );
        break;
      case "note":
        out.push(`note over ${ev.over.join(", ")} : ${ev.text}`);
        break;
      case "blockStart":
        out.push(`${ev.kind}${ev.label ? ` ${ev.label}` : ""}`);
        break;
      case "blockElse":
        out.push(`else${ev.label ? ` ${ev.label}` : ""}`);
        break;
      case "blockEnd":
        out.push("end");
        break;
      case "activate":
        out.push(`activate ${ev.participant}`);
        break;
      case "deactivate":
        out.push(`deactivate ${ev.participant}`);
        break;
    }
  }
  out.push("@enduml");
  return out.join("\n");
}
