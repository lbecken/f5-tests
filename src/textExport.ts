// Best-effort export of the canvas to Mermaid / PlantUML text. Excalidraw
// elements are drawings, not a semantic model, so this reconstructs meaning
// heuristically: stacked same-width rectangles become classes, arrowheads map
// to UML relationship kinds, and arrow bindings (or endpoint proximity, for
// plain lines) decide what connects to what.

const NOTE_BG = "#fff9db";
const PROXIMITY = 16;

/** Minimal structural view of the Excalidraw elements we care about. */
interface AnyEl {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
  backgroundColor?: string;
  strokeColor?: string;
  strokeStyle?: string;
  roundness?: unknown;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
  containerId?: string | null;
  text?: string;
  points?: readonly (readonly number[])[];
}

export type NodeShape = "rect" | "rounded" | "ellipse" | "diamond" | "circle";

export interface TextNode {
  id: string;
  label: string;
  shape: NodeShape;
}

export interface TextClass {
  id: string;
  name: string;
  stereotype?: string;
  attrs: string[];
  methods: string[];
}

export type EdgeKind =
  | "inheritance"
  | "realization"
  | "composition"
  | "aggregation"
  | "dependency"
  | "arrow"
  | "line";

export interface TextEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  label?: string;
}

export interface SceneModel {
  classes: TextClass[];
  nodes: TextNode[];
  edges: TextEdge[];
}

const near = (a: number, b: number, tol = 3) => Math.abs(a - b) <= tol;

export function analyzeScene(elements: readonly object[]): SceneModel {
  const els = (elements as AnyEl[]).filter((e) => !e.isDeleted);

  // Bound label text per container id.
  const labelByContainer = new Map<string, string>();
  for (const el of els) {
    if (el.type === "text" && el.containerId) {
      labelByContainer.set(el.containerId, el.text ?? "");
    }
  }
  const labelOf = (el: AnyEl) => (labelByContainer.get(el.id) ?? "").trim();

  const containers = els.filter(
    (e) => e.type === "rectangle" || e.type === "ellipse" || e.type === "diamond",
  );

  // --- Class detection: 2-3 stacked rectangles with equal x and width ------
  const rects = containers
    .filter((e) => e.type === "rectangle")
    .sort((a, b) => a.y - b.y);
  const inStack = new Set<string>();
  const classes: TextClass[] = [];
  // element id -> semantic node id (for classes: every compartment maps to it)
  const ownerOf = new Map<string, string>();

  for (const head of rects) {
    if (inStack.has(head.id) || !labelOf(head)) continue;
    const stack = [head];
    let last = head;
    for (;;) {
      const next = rects.find(
        (r) =>
          !inStack.has(r.id) &&
          r.id !== last.id &&
          near(r.x, head.x) &&
          near(r.width, head.width) &&
          near(r.y, last.y + last.height),
      );
      if (!next || stack.length === 3) break;
      stack.push(next);
      last = next;
    }
    if (stack.length < 2) continue;

    const rawName = labelOf(head);
    const lines = rawName.split("\n").map((s) => s.trim());
    const stereo = lines[0]?.match(/^[«<]{1,2}(.+?)[»>]{1,2}$/);
    const stereotype = stereo ? stereo[1] : undefined;
    const name = (stereo ? lines.slice(1).join(" ") : rawName.replace(/\n/g, " ")) || "Class";

    const compartments = stack
      .slice(1)
      .map((r) => labelOf(r).split("\n").map((s) => s.trim()).filter(Boolean));
    const id = `C${classes.length}`;
    classes.push({
      id,
      name,
      stereotype,
      attrs: compartments.length === 2 ? compartments[0] : [],
      methods:
        compartments.length === 2
          ? compartments[1]
          : (compartments[0] ?? []),
    });
    for (const r of stack) {
      inStack.add(r.id);
      ownerOf.set(r.id, id);
    }
  }

  // --- Plain nodes ---------------------------------------------------------
  const nodes: TextNode[] = [];
  const nodeEls: AnyEl[] = [];
  for (const el of containers) {
    if (inStack.has(el.id)) continue;
    if ((el.backgroundColor ?? "").toLowerCase() === NOTE_BG) continue;
    // Invisible helper shapes (lifeline binding strips) are not nodes.
    if (
      el.strokeColor === "transparent" &&
      el.backgroundColor === "transparent"
    ) {
      continue;
    }
    // Large transparent rectangles are frames/boundaries/swimlanes, not nodes.
    if (
      el.backgroundColor === "transparent" &&
      (el.width > 260 || el.height > 260)
    ) {
      continue;
    }
    let shape: NodeShape;
    if (el.type === "diamond") shape = "diamond";
    else if (el.type === "ellipse") {
      shape = el.width <= 44 && el.height <= 44 ? "circle" : "ellipse";
    } else {
      shape = el.roundness ? "rounded" : "rect";
    }
    const id = `N${nodes.length}`;
    nodes.push({ id, label: labelOf(el).replace(/\n/g, " "), shape });
    ownerOf.set(el.id, id);
    nodeEls.push(el);
  }

  // --- Edges ---------------------------------------------------------------
  const resolvePoint = (px: number, py: number): string | undefined => {
    let best: { id: string; area: number } | undefined;
    for (const el of nodeEls) {
      if (
        px >= el.x - PROXIMITY &&
        px <= el.x + el.width + PROXIMITY &&
        py >= el.y - PROXIMITY &&
        py <= el.y + el.height + PROXIMITY
      ) {
        const area = el.width * el.height;
        if (!best || area < best.area) best = { id: ownerOf.get(el.id)!, area };
      }
    }
    return best?.id;
  };

  const edges: TextEdge[] = [];
  for (const el of els) {
    if (el.type !== "arrow" && el.type !== "line") continue;
    const pts = el.points ?? [];
    if (pts.length < 2) continue;
    const [sx, sy] = [el.x + pts[0][0], el.y + pts[0][1]];
    const [ex, ey] = [
      el.x + pts[pts.length - 1][0],
      el.y + pts[pts.length - 1][1],
    ];
    const from =
      (el.startBinding && ownerOf.get(el.startBinding.elementId)) ??
      resolvePoint(sx, sy);
    const to =
      (el.endBinding && ownerOf.get(el.endBinding.elementId)) ??
      resolvePoint(ex, ey);
    if (!from || !to || from === to) continue;

    const dashed = el.strokeStyle === "dashed" || el.strokeStyle === "dotted";
    let kind: EdgeKind;
    if (el.type === "line") kind = "line";
    else if (el.endArrowhead === "triangle_outline") {
      kind = dashed ? "realization" : "inheritance";
    } else if (el.startArrowhead === "diamond") kind = "composition";
    else if (el.startArrowhead === "diamond_outline") kind = "aggregation";
    else if (dashed) kind = "dependency";
    else if (!el.endArrowhead && !el.startArrowhead) kind = "line";
    else kind = "arrow";

    const label = labelOf(el).replace(/\n/g, " ") || undefined;
    edges.push({ from, to, kind, label });
  }

  // Unlabeled helper shapes (activation bars, start/end dots that ended up
  // disconnected) are only kept when something connects to them.
  const connected = new Set(edges.flatMap((e) => [e.from, e.to]));
  const keptNodes = nodes.filter((n) => n.label || connected.has(n.id));

  return { classes, nodes: keptNodes, edges };
}

// ---------------------------------------------------------------------------
// Mermaid
// ---------------------------------------------------------------------------

const mmEsc = (s: string) => s.replace(/"/g, "#quot;");

const MERMAID_CLASS_OP: Record<EdgeKind, string> = {
  inheritance: "--|>",
  realization: "..|>",
  composition: "*--",
  aggregation: "o--",
  dependency: "..>",
  arrow: "-->",
  line: "--",
};

const MERMAID_NODE_WRAP: Record<NodeShape, [string, string]> = {
  rect: ['["', '"]'],
  rounded: ['("', '")'],
  ellipse: ['(["', '"])'],
  diamond: ['{"', '"}'],
  circle: ['(("', '"))'],
};

export function generateMermaid(model: SceneModel): string {
  const out: string[] = [];
  if (model.classes.length > 0) {
    out.push("classDiagram");
    for (const c of model.classes) {
      const members = [...c.attrs, ...c.methods];
      if (members.length > 0) {
        out.push(`  class ${c.id}["${mmEsc(c.name)}"] {`);
        for (const m of members) out.push(`    ${m}`);
        out.push("  }");
      } else {
        out.push(`  class ${c.id}["${mmEsc(c.name)}"]`);
      }
      if (c.stereotype) out.push(`  <<${c.stereotype}>> ${c.id}`);
    }
    for (const n of model.nodes) {
      out.push(`  class ${n.id}["${mmEsc(n.label || " ")}"]`);
    }
    for (const e of model.edges) {
      const rel = `  ${e.from} ${MERMAID_CLASS_OP[e.kind]} ${e.to}`;
      out.push(e.label ? `${rel} : ${mmEsc(e.label)}` : rel);
    }
  } else {
    out.push("flowchart TD");
    for (const n of model.nodes) {
      const [open, close] = MERMAID_NODE_WRAP[n.shape];
      out.push(`  ${n.id}${open}${mmEsc(n.label || " ")}${close}`);
    }
    for (const e of model.edges) {
      const op =
        e.kind === "line"
          ? "---"
          : e.kind === "dependency" || e.kind === "realization"
            ? "-.->"
            : "-->";
      const lbl = e.label ? `|"${mmEsc(e.label)}"|` : "";
      out.push(`  ${e.from} ${op}${lbl} ${e.to}`);
    }
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// PlantUML
// ---------------------------------------------------------------------------

const puEsc = (s: string) => s.replace(/"/g, "'");

const PLANTUML_OP: Record<EdgeKind, string> = {
  inheritance: "--|>",
  realization: "..|>",
  composition: "*--",
  aggregation: "o--",
  dependency: "..>",
  arrow: "-->",
  line: "--",
};

const PLANTUML_SHAPE: Record<NodeShape, string> = {
  rect: "rectangle",
  rounded: "rectangle",
  ellipse: "usecase",
  diamond: "hexagon",
  circle: "circle",
};

export function generatePlantUML(model: SceneModel): string {
  const out: string[] = ["@startuml"];
  if (model.classes.length > 0) {
    for (const c of model.classes) {
      const keyword =
        c.stereotype === "interface"
          ? "interface"
          : c.stereotype === "enumeration"
            ? "enum"
            : c.stereotype === "abstract"
              ? "abstract class"
              : "class";
      const members = [...c.attrs, ...c.methods];
      if (members.length > 0) {
        out.push(`${keyword} "${puEsc(c.name)}" as ${c.id} {`);
        for (const a of c.attrs) out.push(`  ${a}`);
        if (c.attrs.length > 0 && c.methods.length > 0) out.push("  --");
        for (const m of c.methods) out.push(`  ${m}`);
        out.push("}");
      } else {
        out.push(`${keyword} "${puEsc(c.name)}" as ${c.id}`);
      }
    }
    for (const n of model.nodes) {
      out.push(`class "${puEsc(n.label || " ")}" as ${n.id}`);
    }
  } else {
    for (const n of model.nodes) {
      out.push(
        `${PLANTUML_SHAPE[n.shape]} "${puEsc(n.label || " ")}" as ${n.id}`,
      );
    }
  }
  for (const e of model.edges) {
    const rel = `${e.from} ${PLANTUML_OP[e.kind]} ${e.to}`;
    out.push(e.label ? `${rel} : ${puEsc(e.label)}` : rel);
  }
  out.push("@enduml");
  return out.join("\n");
}
