// Import Mermaid (classDiagram / flowchart) and PlantUML text into editable
// Excalidraw elements: parse into the shared SceneModel, auto-layout with a
// simple layered algorithm, and emit element skeletons with bound arrows.
import {
  BLUE,
  GREEN,
  PEACH,
  ROUNDED,
  STROKE,
  TEAL,
  WHITE,
  arrow,
  rect,
  ellipse,
  diamond,
  label,
} from "./stencils/builders";
import type { Skeleton } from "./stencils/types";
import type {
  EdgeKind,
  NodeShape,
  SceneModel,
  TextClass,
  TextEdge,
  TextNode,
} from "./textExport";

export interface ImportResult {
  model: SceneModel;
  format: "mermaid-class" | "mermaid-flow" | "plantuml";
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Shared parsing helpers
// ---------------------------------------------------------------------------

/** Maps a normalized relation operator to kind + whether A/B are swapped. */
function relationOp(
  op: string,
): { kind: EdgeKind; swap: boolean } | undefined {
  switch (op) {
    case "--|>":
      return { kind: "inheritance", swap: false };
    case "<|--":
      return { kind: "inheritance", swap: true };
    case "..|>":
      return { kind: "realization", swap: false };
    case "<|..":
      return { kind: "realization", swap: true };
    case "*--":
      return { kind: "composition", swap: false };
    case "--*":
      return { kind: "composition", swap: true };
    case "o--":
      return { kind: "aggregation", swap: false };
    case "--o":
      return { kind: "aggregation", swap: true };
    case "..>":
      return { kind: "dependency", swap: false };
    case "<..":
      return { kind: "dependency", swap: true };
    case "-->":
      return { kind: "arrow", swap: false };
    case "<--":
      return { kind: "arrow", swap: true };
    case "--":
    case "..":
      return { kind: "line", swap: false };
    default:
      return undefined;
  }
}

const RELATION_RE =
  /^([\w~`]+)\s*(?:"[^"]*"\s*)?(<\|--|--\|>|<\|\.\.|\.\.\|>|\*--|--\*|o--|--o|<--|-->|<\.\.|\.\.>|--|\.\.)\s*(?:"[^"]*"\s*)?([\w~`]+)\s*(?::\s*(.+))?$/;

interface ClassAcc {
  name: string;
  stereotype?: string;
  attrs: string[];
  methods: string[];
}

function finishClassModel(
  classAcc: Map<string, ClassAcc>,
  nodeAcc: Map<string, TextNode>,
  edges: TextEdge[],
): SceneModel {
  // Relations may reference entities that were never declared — create them.
  for (const e of edges) {
    for (const id of [e.from, e.to]) {
      if (!classAcc.has(id) && !nodeAcc.has(id)) {
        if (classAcc.size > 0) {
          classAcc.set(id, { name: id, attrs: [], methods: [] });
        } else {
          nodeAcc.set(id, { id, label: id, shape: "rect" });
        }
      }
    }
  }
  const classes: TextClass[] = [...classAcc.entries()].map(([id, c]) => ({
    id,
    ...c,
  }));
  return { classes, nodes: [...nodeAcc.values()], edges };
}

// ---------------------------------------------------------------------------
// Mermaid classDiagram
// ---------------------------------------------------------------------------

function parseMermaidClass(lines: string[]): ImportResult {
  const classAcc = new Map<string, ClassAcc>();
  const edges: TextEdge[] = [];
  const warnings: string[] = [];
  let current: ClassAcc | null = null;

  const ensure = (id: string): ClassAcc => {
    let c = classAcc.get(id);
    if (!c) {
      c = { name: id.replace(/[`~]/g, " ").trim(), attrs: [], methods: [] };
      classAcc.set(id, c);
    }
    return c;
  };

  for (const raw of lines) {
    const line = raw.replace(/%%.*$/, "").trim();
    if (!line || /^(classDiagram|direction\s|note\s|note$)/.test(line)) {
      continue;
    }
    if (line === "}") {
      current = null;
      continue;
    }
    if (current) {
      const st = line.match(/^<<(.+)>>$/);
      if (st) current.stereotype = st[1].toLowerCase();
      else if (line.includes("(")) current.methods.push(line);
      else current.attrs.push(line);
      continue;
    }
    let m = line.match(/^class\s+([\w~`]+)(?:\["([^"]*)"\])?\s*(\{)?$/);
    if (m) {
      const c = ensure(m[1]);
      if (m[2]) c.name = m[2];
      if (m[3]) current = c;
      continue;
    }
    m = line.match(/^<<(.+)>>\s+([\w~`]+)$/);
    if (m) {
      ensure(m[2]).stereotype = m[1].toLowerCase();
      continue;
    }
    m = line.match(RELATION_RE);
    if (m) {
      const rel = relationOp(m[2]);
      if (rel) {
        ensure(m[1]);
        ensure(m[3]);
        edges.push({
          from: rel.swap ? m[3] : m[1],
          to: rel.swap ? m[1] : m[3],
          kind: rel.kind,
          label: m[4]?.trim(),
        });
        continue;
      }
    }
    warnings.push(`Skipped: ${line}`);
  }
  return {
    model: finishClassModel(classAcc, new Map(), edges),
    format: "mermaid-class",
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Mermaid flowchart
// ---------------------------------------------------------------------------

const FLOW_EDGE_RE = /\s*(-\.->|-\.-|===>|==>|--->|-->|---|--|~~~)\s*/;

const FLOW_SHAPES: [RegExp, NodeShape][] = [
  [/^\(\(\s*"?(.*?)"?\s*\)\)$/, "circle"],
  [/^\(\[\s*"?(.*?)"?\s*\]\)$/, "ellipse"],
  [/^\[\s*"?(.*?)"?\s*\]$/, "rect"],
  [/^\(\s*"?(.*?)"?\s*\)$/, "rounded"],
  [/^\{\s*"?(.*?)"?\s*\}$/, "diamond"],
];

function parseMermaidFlow(lines: string[]): ImportResult {
  const nodeAcc = new Map<string, TextNode>();
  const edges: TextEdge[] = [];
  const warnings: string[] = [];

  const parseNodeToken = (
    token: string,
  ): { id: string; label?: string } | null => {
    const m = token.match(/^([\w-]+)\s*(.*)$/s);
    if (!m) return null;
    const id = m[1];
    const rest = m[2].trim();
    let lbl: string | undefined;
    let shape: NodeShape = "rect";
    if (rest) {
      for (const [re, s] of FLOW_SHAPES) {
        const sm = rest.match(re);
        if (sm) {
          lbl = sm[1];
          shape = s;
          break;
        }
      }
    }
    const existing = nodeAcc.get(id);
    if (!existing) {
      nodeAcc.set(id, { id, label: lbl ?? id, shape });
    } else if (lbl) {
      existing.label = lbl;
      existing.shape = shape;
    }
    return { id };
  };

  for (const raw of lines) {
    const line = raw.replace(/%%.*$/, "").trim();
    if (
      !line ||
      /^(flowchart|graph)\s/.test(line) ||
      /^(subgraph\b|end$|direction\s|classDef\s|class\s|style\s|linkStyle\s|click\s)/.test(
        line,
      )
    ) {
      continue;
    }
    const parts = line.split(FLOW_EDGE_RE);
    // parts: node, op, node, op, node...
    let prev: string | null = null;
    let failed = false;
    for (let i = 0; i < parts.length; i += 2) {
      let token = parts[i].trim();
      let edgeLabel: string | undefined;
      const lm = token.match(/^\|([^|]*)\|\s*(.*)$/s);
      if (lm) {
        edgeLabel = lm[1].trim();
        token = lm[2].trim();
      }
      // "&" chains: only the first node is used.
      const first = token.split("&")[0].trim();
      const node = parseNodeToken(first);
      if (!node) {
        failed = true;
        break;
      }
      if (prev !== null) {
        const op = parts[i - 1];
        if (op !== "~~~") {
          const dashed = op.startsWith("-.");
          const hasHead = op.endsWith(">");
          edges.push({
            from: prev,
            to: node.id,
            kind: hasHead ? (dashed ? "dependency" : "arrow") : "line",
            label: edgeLabel,
          });
        }
      }
      prev = node.id;
    }
    if (failed) warnings.push(`Skipped: ${line}`);
  }
  return {
    model: { classes: [], nodes: [...nodeAcc.values()], edges },
    format: "mermaid-flow",
    warnings,
  };
}

// ---------------------------------------------------------------------------
// PlantUML
// ---------------------------------------------------------------------------

const PU_SHAPE_KEYWORDS: Record<string, NodeShape> = {
  rectangle: "rect",
  component: "rect",
  node: "rect",
  card: "rect",
  agent: "rounded",
  usecase: "ellipse",
  actor: "ellipse",
  hexagon: "diamond",
  circle: "circle",
};

function parsePlantUML(lines: string[]): ImportResult {
  const classAcc = new Map<string, ClassAcc>();
  const nodeAcc = new Map<string, TextNode>();
  const edges: TextEdge[] = [];
  const warnings: string[] = [];
  let current: ClassAcc | null = null;
  let inMethods = false;

  for (const raw of lines) {
    const line = raw.replace(/'.*$/, "").trim();
    if (
      !line ||
      /^(@startuml|@enduml|skinparam\b|title\b|hide\b|show\b|!|scale\b|left to right\b|top to bottom\b|allowmixing$)/i.test(
        line,
      )
    ) {
      continue;
    }
    if (line === "}") {
      current = null;
      inMethods = false;
      continue;
    }
    if (current) {
      if (/^[-.=_]{2,}\s*\w*$/.test(line)) {
        inMethods = true;
      } else if (inMethods) {
        current.methods.push(line);
      } else if (line.includes("(")) {
        current.methods.push(line);
      } else {
        current.attrs.push(line);
      }
      continue;
    }

    // class / interface / enum / abstract class declarations
    let m = line.match(
      /^(abstract\s+class|abstract|class|interface|enum|annotation)\s+(?:"([^"]+)"\s+as\s+([\w.]+)|([\w.]+)\s+as\s+"([^"]+)"|([\w.]+))\s*(?:<<.+>>\s*)?(\{)?$/i,
    );
    if (m) {
      const keyword = m[1].toLowerCase().replace(/\s+/g, " ");
      const id = m[3] ?? m[4] ?? m[6];
      const name = m[2] ?? m[5] ?? id;
      const c: ClassAcc = classAcc.get(id) ?? {
        name,
        attrs: [],
        methods: [],
      };
      c.name = name;
      if (keyword === "interface") c.stereotype = "interface";
      else if (keyword === "enum") c.stereotype = "enumeration";
      else if (keyword.startsWith("abstract")) c.stereotype = "abstract";
      classAcc.set(id, c);
      if (m[7]) {
        current = c;
        inMethods = false;
      }
      continue;
    }

    // generic shapes (deployment/use-case style)
    m = line.match(
      /^(rectangle|usecase|actor|circle|hexagon|component|node|card|agent)\s+(?:"([^"]+)"\s+as\s+([\w.]+)|([\w.]+)|"([^"]+)")\s*$/i,
    );
    if (m) {
      const shape = PU_SHAPE_KEYWORDS[m[1].toLowerCase()] ?? "rect";
      const id = m[3] ?? m[4] ?? m[5];
      const name = m[2] ?? m[5] ?? id;
      nodeAcc.set(id, { id, label: name, shape });
      continue;
    }

    // relations — normalize direction hints and dash lengths first
    const normalized = line
      .replace(/-(?:up|down|left|right|u|d|l|r)-/gi, "--")
      .replace(/(?<![<|*o.-])-{2,}(?![>|*o-])/g, "--")
      .replace(/-{2,}(>|\|>|\*|o)/g, "--$1")
      .replace(/(<|<\||\*|o)-{2,}/g, "$1--")
      .replace(/\.{2,}(>|\|>)/g, "..$1")
      .replace(/(<|<\|)\.{2,}/g, "$1..");
    m = normalized.match(RELATION_RE);
    if (m) {
      const rel = relationOp(m[2]);
      if (rel) {
        edges.push({
          from: rel.swap ? m[3] : m[1],
          to: rel.swap ? m[1] : m[3],
          kind: rel.kind,
          label: m[4]?.trim(),
        });
        continue;
      }
    }
    warnings.push(`Skipped: ${line}`);
  }
  return {
    model: finishClassModel(classAcc, nodeAcc, edges),
    format: "plantuml",
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function parseDiagramText(input: string): ImportResult | { error: string } {
  const text = input.trim();
  if (!text) return { error: "Paste some Mermaid or PlantUML text first." };
  const lines = text.split("\n");
  if (/@startuml/i.test(text) || /^\s*(class|interface|enum|rectangle|usecase|actor)\s+[\w"]/im.test(text) && !/^\s*(classDiagram|flowchart|graph)\b/m.test(text)) {
    const result = parsePlantUML(lines);
    if (
      result.model.classes.length + result.model.nodes.length === 0 &&
      result.model.edges.length === 0
    ) {
      return { error: "No shapes or relations could be parsed." };
    }
    return result;
  }
  if (/^\s*classDiagram\b/m.test(text)) return checkEmpty(parseMermaidClass(lines));
  if (/^\s*(flowchart|graph)\b/m.test(text)) return checkEmpty(parseMermaidFlow(lines));
  // Fall back: try PlantUML relations, then flowchart
  const pu = parsePlantUML(lines);
  if (pu.model.classes.length + pu.model.nodes.length > 0) return pu;
  return {
    error:
      "Could not detect the format. Start with `classDiagram`, `flowchart TD`, or `@startuml`.",
  };
}

function checkEmpty(result: ImportResult): ImportResult | { error: string } {
  if (
    result.model.classes.length + result.model.nodes.length === 0 &&
    result.model.edges.length === 0
  ) {
    return { error: "No shapes or relations could be parsed." };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Layout + skeleton generation
// ---------------------------------------------------------------------------

const X_GAP = 90;
const Y_GAP = 110;

interface Placed {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
}

const textWidth = (lines: string[], min: number, max: number) =>
  Math.min(
    max,
    Math.max(min, ...lines.map((l) => l.length * 7.5 + 40)),
  );

function classSize(c: TextClass): { width: number; height: number } {
  const nameLines = (c.stereotype ? 2 : 1);
  const width = textWidth(
    [c.name, ...(c.attrs ?? []), ...(c.methods ?? [])],
    220,
    380,
  );
  const headerH = nameLines > 1 ? 60 : 44;
  const compH = (n: number) => (n > 0 ? n * 21 + 16 : 30);
  const hasBody = c.attrs.length + c.methods.length > 0;
  const height = hasBody
    ? headerH + compH(c.attrs.length) + compH(c.methods.length)
    : headerH + 16;
  return { width, height };
}

function nodeSize(n: TextNode): { width: number; height: number } {
  switch (n.shape) {
    case "circle": {
      if (!n.label) return { width: 48, height: 48 };
      const d = Math.max(80, n.label.length * 8 + 34);
      return { width: d, height: d };
    }
    case "diamond": {
      const w = textWidth([n.label], 100, 200);
      return { width: w, height: Math.max(80, w * 0.6) };
    }
    case "ellipse":
      return { width: textWidth([n.label], 170, 300), height: 80 };
    default:
      return { width: textWidth([n.label], 140, 300), height: 60 };
  }
}

/** Longest-path layering (rank), tolerant of cycles via bounded relaxation. */
function computeLayers(ids: string[], edges: TextEdge[]): Map<string, number> {
  const layer = new Map<string, number>(ids.map((id) => [id, 0]));
  const rankEdges = edges
    .filter((e) => layer.has(e.from) && layer.has(e.to))
    .map((e) =>
      e.kind === "inheritance" || e.kind === "realization"
        ? { from: e.to, to: e.from }
        : { from: e.from, to: e.to },
    );
  for (let pass = 0; pass < ids.length; pass++) {
    let changed = false;
    for (const e of rankEdges) {
      const want = (layer.get(e.from) ?? 0) + 1;
      if (want > (layer.get(e.to) ?? 0) && want <= ids.length) {
        layer.set(e.to, want);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return layer;
}

const IMPORT_EDGE_STYLE: Record<EdgeKind, Record<string, unknown>> = {
  inheritance: { endArrowhead: "triangle_outline" },
  realization: { endArrowhead: "triangle_outline", strokeStyle: "dashed" },
  composition: { startArrowhead: "diamond" },
  aggregation: { startArrowhead: "diamond_outline" },
  dependency: { endArrowhead: "arrow", strokeStyle: "dashed" },
  arrow: { endArrowhead: "arrow" },
  // plain lines are emitted as head-less arrows so they can bind to shapes
  line: {},
};

const NODE_FILL: Record<NodeShape, string> = {
  rect: GREEN,
  rounded: TEAL,
  ellipse: PEACH,
  diamond: WHITE,
  circle: STROKE,
};

/**
 * A class is three separate rectangles, and Excalidraw trims a bound arrow
 * only at the bound element's own boundary — so arrows are bound to the
 * compartment nearest the other endpoint (header from above, methods from
 * below) to avoid piercing through the box.
 */
interface Segment {
  id: string;
  cy: number;
}

export function modelToSkeletons(model: SceneModel): Skeleton[] {
  const placed = new Map<string, Placed>();
  const segments = new Map<string, Segment[]>();
  for (const c of model.classes) {
    placed.set(c.id, { id: c.id, ...classSize(c) });
  }
  for (const n of model.nodes) {
    placed.set(n.id, { id: n.id, ...nodeSize(n) });
  }

  const layers = computeLayers([...placed.keys()], model.edges);
  const rows = new Map<number, Placed[]>();
  for (const p of placed.values()) {
    const l = layers.get(p.id) ?? 0;
    if (!rows.has(l)) rows.set(l, []);
    rows.get(l)!.push(p);
  }

  let y = 0;
  for (const l of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(l)!;
    const rowWidth =
      row.reduce((s, p) => s + p.width, 0) + X_GAP * (row.length - 1);
    let x = -rowWidth / 2;
    let maxH = 0;
    for (const p of row) {
      p.x = x;
      p.y = y;
      x += p.width + X_GAP;
      maxH = Math.max(maxH, p.height);
    }
    y += maxH + Y_GAP;
  }

  const out: Skeleton[] = [];

  for (const c of model.classes) {
    const p = placed.get(c.id)!;
    const x = p.x!;
    const yy = p.y!;
    const headerH = c.stereotype ? 60 : 44;
    const headerLabel = c.stereotype
      ? `«${c.stereotype}»\n${c.name}`
      : c.name;
    const hasBody = c.attrs.length + c.methods.length > 0;
    out.push(
      rect(x, yy, p.width, hasBody ? headerH : headerH + 16, {
        id: c.id,
        backgroundColor: BLUE,
        label: label(headerLabel),
      }),
    );
    const segs: Segment[] = [{ id: c.id, cy: yy + headerH / 2 }];
    if (hasBody) {
      const attrsH = c.attrs.length > 0 ? c.attrs.length * 21 + 16 : 30;
      const methodsH = c.methods.length > 0 ? c.methods.length * 21 + 16 : 30;
      out.push(
        rect(x, yy + headerH, p.width, attrsH, {
          id: `${c.id}-attrs`,
          backgroundColor: WHITE,
          ...(c.attrs.length > 0
            ? { label: label(c.attrs.join("\n"), { fontSize: 14 }) }
            : {}),
        }),
        rect(x, yy + headerH + attrsH, p.width, methodsH, {
          id: `${c.id}-methods`,
          backgroundColor: WHITE,
          ...(c.methods.length > 0
            ? { label: label(c.methods.join("\n"), { fontSize: 14 }) }
            : {}),
        }),
      );
      segs.push(
        { id: `${c.id}-attrs`, cy: yy + headerH + attrsH / 2 },
        { id: `${c.id}-methods`, cy: yy + headerH + attrsH + methodsH / 2 },
      );
    }
    segments.set(c.id, segs);
  }

  for (const n of model.nodes) {
    const p = placed.get(n.id)!;
    const opts = {
      id: n.id,
      // an unlabeled circle is a start/end dot; a labeled one is a real node
      backgroundColor:
        n.shape === "circle" && n.label ? WHITE : NODE_FILL[n.shape],
      ...(n.label ? { label: label(n.label) } : {}),
    };
    if (n.shape === "diamond") out.push(diamond(p.x!, p.y!, p.width, p.height, opts));
    else if (n.shape === "ellipse" || n.shape === "circle") {
      out.push(ellipse(p.x!, p.y!, p.width, p.height, opts));
    } else {
      out.push(
        rect(p.x!, p.y!, p.width, p.height, {
          ...opts,
          ...(n.shape === "rounded" ? ROUNDED : {}),
        }),
      );
    }
  }

  // Pick the compartment whose vertical center is closest to the other end.
  const anchor = (id: string, towardY: number): { id: string; cy: number } => {
    const segs = segments.get(id);
    const p = placed.get(id)!;
    if (!segs || segs.length === 1) {
      return { id, cy: p.y! + p.height / 2 };
    }
    let best = segs[0];
    for (const s of segs) {
      if (Math.abs(s.cy - towardY) < Math.abs(best.cy - towardY)) best = s;
    }
    return best;
  };

  for (const e of model.edges) {
    const a = placed.get(e.from);
    const b = placed.get(e.to);
    if (!a || !b) continue;
    const ax = a.x! + a.width / 2;
    const bx = b.x! + b.width / 2;
    const bCenterY = b.y! + b.height / 2;
    const aCenterY = a.y! + a.height / 2;
    const from = anchor(e.from, bCenterY);
    const to = anchor(e.to, aCenterY);
    out.push(
      arrow(ax, from.cy, [[0, 0], [bx - ax, to.cy - from.cy]], {
        ...IMPORT_EDGE_STYLE[e.kind],
        start: { id: from.id },
        end: { id: to.id },
        ...(e.label ? { label: label(e.label, { fontSize: 13 }) } : {}),
      }),
    );
  }

  return out;
}
