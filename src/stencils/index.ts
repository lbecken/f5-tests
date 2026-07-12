import type { Stencil, StencilGroup } from "./types";
import {
  BLUE,
  DASHED,
  bindStrip,
  FILLED,
  GREEN,
  NOTE,
  PEACH,
  ROUNDED,
  TEAL,
  VIOLET,
  WHITE,
  YELLOW,
  actor,
  arrow,
  classBox,
  diamond,
  ellipse,
  label,
  line,
  rect,
  text,
} from "./builders";

// ---------------------------------------------------------------------------
// Common (shared across all diagram types)
// ---------------------------------------------------------------------------

const commonStencils: Stencil[] = [
  {
    id: "note",
    name: "Note",
    elements: [
      rect(0, 0, 200, 80, {
        backgroundColor: NOTE,
        label: label("Note…", { fontSize: 14 }),
      }),
    ],
  },
  {
    id: "text-label",
    name: "Text",
    elements: [text(0, 0, "Label", { fontSize: 16 })],
  },
  {
    id: "frame-title",
    name: "Title frame",
    elements: [
      rect(0, 0, 360, 240, { backgroundColor: "transparent" }),
      rect(0, 0, 120, 30, {
        backgroundColor: WHITE,
        label: label("Diagram", { fontSize: 14 }),
      }),
    ],
  },
];

// ---------------------------------------------------------------------------
// Class diagram
// ---------------------------------------------------------------------------

const classStencils: Stencil[] = [
  {
    id: "class",
    name: "Class",
    elements: classBox(
      0,
      0,
      "ClassName",
      "+ attribute: Type",
      "+ operation(): Type",
    ),
  },
  {
    id: "class-simple",
    name: "Class (simple)",
    elements: [
      rect(0, 0, 180, 52, { backgroundColor: BLUE, label: label("ClassName") }),
    ],
  },
  {
    id: "abstract-class",
    name: "Abstract class",
    elements: [
      rect(0, 0, 220, 60, {
        backgroundColor: BLUE,
        label: label("«abstract»\nClassName"),
      }),
      rect(0, 60, 220, 52, {
        backgroundColor: WHITE,
        label: label("+ operation(): Type", { fontSize: 14 }),
      }),
    ],
  },
  {
    id: "interface",
    name: "Interface",
    elements: [
      rect(0, 0, 220, 60, {
        backgroundColor: BLUE,
        label: label("«interface»\nInterfaceName"),
      }),
      rect(0, 60, 220, 52, {
        backgroundColor: WHITE,
        label: label("+ operation(): Type", { fontSize: 14 }),
      }),
    ],
  },
  {
    id: "enumeration",
    name: "Enumeration",
    elements: [
      rect(0, 0, 200, 60, {
        backgroundColor: BLUE,
        label: label("«enumeration»\nStatus"),
      }),
      rect(0, 60, 200, 64, {
        backgroundColor: WHITE,
        label: label("ACTIVE\nINACTIVE", { fontSize: 14 }),
      }),
    ],
  },
  {
    id: "multiplicity",
    name: "Multiplicity",
    elements: [text(0, 0, "1..*", { fontSize: 14 })],
  },
  {
    id: "association",
    name: "Association",
    elements: [line(0, 0, [[0, 0], [170, 0]])],
  },
  {
    id: "directed-association",
    name: "Directed assoc.",
    elements: [arrow(0, 0, [[0, 0], [170, 0]], { endArrowhead: "arrow" })],
  },
  {
    id: "inheritance",
    name: "Inheritance",
    elements: [
      arrow(0, 0, [[0, 0], [170, 0]], { endArrowhead: "triangle_outline" }),
    ],
  },
  {
    id: "realization",
    name: "Realization",
    elements: [
      arrow(0, 0, [[0, 0], [170, 0]], {
        ...DASHED,
        endArrowhead: "triangle_outline",
      }),
    ],
  },
  {
    id: "dependency",
    name: "Dependency",
    elements: [
      arrow(0, 0, [[0, 0], [170, 0]], { ...DASHED, endArrowhead: "arrow" }),
    ],
  },
  {
    id: "aggregation",
    name: "Aggregation",
    elements: [
      arrow(0, 0, [[0, 0], [170, 0]], { startArrowhead: "diamond_outline" }),
    ],
  },
  {
    id: "composition",
    name: "Composition",
    elements: [
      arrow(0, 0, [[0, 0], [170, 0]], { startArrowhead: "diamond" }),
    ],
  },
];

// ---------------------------------------------------------------------------
// Package diagram
// ---------------------------------------------------------------------------

const packageStencils: Stencil[] = [
  {
    id: "package",
    name: "Package",
    elements: [
      rect(0, 0, 100, 30, { backgroundColor: YELLOW }),
      rect(0, 30, 250, 150, {
        backgroundColor: WHITE,
        label: label("PackageName", { verticalAlign: "top" }),
      }),
    ],
  },
  {
    id: "package-small",
    name: "Package (small)",
    elements: [
      rect(0, 0, 70, 24, { backgroundColor: YELLOW }),
      rect(0, 24, 170, 70, {
        backgroundColor: WHITE,
        label: label("Package"),
      }),
    ],
  },
  {
    id: "pkg-import",
    name: "Import",
    elements: [
      arrow(0, 0, [[0, 0], [170, 0]], {
        ...DASHED,
        endArrowhead: "arrow",
        label: label("«import»", { fontSize: 13 }),
      }),
    ],
  },
  {
    id: "pkg-merge",
    name: "Merge",
    elements: [
      arrow(0, 0, [[0, 0], [170, 0]], {
        ...DASHED,
        endArrowhead: "arrow",
        label: label("«merge»", { fontSize: 13 }),
      }),
    ],
  },
  {
    id: "pkg-containment",
    name: "Dependency",
    elements: [
      arrow(0, 0, [[0, 0], [170, 0]], { ...DASHED, endArrowhead: "arrow" }),
    ],
  },
];

// ---------------------------------------------------------------------------
// Sequence diagram
// ---------------------------------------------------------------------------

const sequenceStencils: Stencil[] = [
  { id: "seq-actor", name: "Actor", elements: actor("Actor") },
  {
    id: "actor-lifeline",
    name: "Actor lifeline",
    elements: [
      ...actor("Actor"),
      line(32, 120, [[0, 0], [0, 220]], DASHED),
      bindStrip(32, 120, 220),
    ],
  },
  {
    id: "lifeline",
    name: "Lifeline",
    elements: [
      rect(0, 0, 130, 44, {
        backgroundColor: VIOLET,
        label: label("obj: Class"),
      }),
      line(65, 44, [[0, 0], [0, 260]], DASHED),
      bindStrip(65, 44, 260),
    ],
  },
  {
    id: "activation",
    name: "Activation",
    elements: [rect(0, 0, 14, 100, { backgroundColor: VIOLET })],
  },
  {
    id: "sync-message",
    name: "Sync message",
    elements: [
      arrow(0, 0, [[0, 0], [180, 0]], {
        endArrowhead: "triangle",
        label: label("message()", { fontSize: 13 }),
      }),
    ],
  },
  {
    id: "async-message",
    name: "Async message",
    elements: [
      arrow(0, 0, [[0, 0], [180, 0]], {
        endArrowhead: "arrow",
        label: label("asyncMessage()", { fontSize: 13 }),
      }),
    ],
  },
  {
    id: "return-message",
    name: "Return",
    elements: [
      arrow(0, 0, [[0, 0], [180, 0]], {
        ...DASHED,
        endArrowhead: "arrow",
        label: label("result", { fontSize: 13 }),
      }),
    ],
  },
  {
    id: "self-message",
    name: "Self message",
    elements: [
      arrow(0, 0, [[0, 0], [70, 0], [70, 44], [4, 44]], {
        endArrowhead: "triangle",
      }),
    ],
  },
  {
    id: "fragment",
    name: "Fragment (alt/loop)",
    elements: [
      rect(0, 0, 300, 170, { backgroundColor: "transparent" }),
      rect(0, 0, 64, 26, {
        backgroundColor: VIOLET,
        label: label("alt", { fontSize: 13 }),
      }),
    ],
  },
  {
    id: "destroy",
    name: "Destroy",
    elements: [
      line(0, 0, [[0, 0], [28, 28]]),
      line(0, 28, [[0, 0], [28, -28]]),
    ],
  },
];

// ---------------------------------------------------------------------------
// Activity diagram
// ---------------------------------------------------------------------------

const activityStencils: Stencil[] = [
  {
    id: "act-initial",
    name: "Initial",
    elements: [ellipse(0, 0, 26, 26, FILLED)],
  },
  {
    id: "act-final",
    name: "Final",
    elements: [
      ellipse(0, 0, 34, 34, { backgroundColor: WHITE }),
      ellipse(7, 7, 20, 20, FILLED),
    ],
  },
  {
    id: "action",
    name: "Action",
    elements: [
      rect(0, 0, 160, 56, {
        ...ROUNDED,
        backgroundColor: GREEN,
        label: label("Action"),
      }),
    ],
  },
  {
    id: "act-decision",
    name: "Decision / Merge",
    elements: [diamond(0, 0, 80, 80, { backgroundColor: WHITE })],
  },
  {
    id: "act-fork",
    name: "Fork / Join",
    elements: [rect(0, 0, 150, 10, FILLED)],
  },
  {
    id: "act-flow",
    name: "Control flow",
    elements: [arrow(0, 0, [[0, 0], [150, 0]], { endArrowhead: "arrow" })],
  },
  {
    id: "act-guard-flow",
    name: "Guarded flow",
    elements: [
      arrow(0, 0, [[0, 0], [150, 0]], {
        endArrowhead: "arrow",
        label: label("[condition]", { fontSize: 13 }),
      }),
    ],
  },
  {
    id: "swimlane",
    name: "Swimlane",
    elements: [
      rect(0, 36, 220, 300, { backgroundColor: "transparent" }),
      rect(0, 0, 220, 36, { backgroundColor: GREEN, label: label("Lane") }),
    ],
  },
  {
    id: "act-object",
    name: "Object node",
    elements: [
      rect(0, 0, 140, 48, { backgroundColor: WHITE, label: label("Object") }),
    ],
  },
];

// ---------------------------------------------------------------------------
// State diagram
// ---------------------------------------------------------------------------

const stateStencils: Stencil[] = [
  {
    id: "state",
    name: "State",
    elements: [
      rect(0, 0, 160, 64, {
        ...ROUNDED,
        backgroundColor: TEAL,
        label: label("State"),
      }),
    ],
  },
  {
    id: "state-actions",
    name: "State + actions",
    elements: [
      rect(0, 0, 190, 100, { ...ROUNDED, backgroundColor: WHITE }),
      line(0, 38, [[0, 0], [190, 0]]),
      text(66, 9, "State", { fontSize: 15 }),
      text(12, 50, "entry / action\nexit / action", { fontSize: 13 }),
    ],
  },
  {
    id: "st-initial",
    name: "Initial",
    elements: [ellipse(0, 0, 26, 26, FILLED)],
  },
  {
    id: "st-final",
    name: "Final",
    elements: [
      ellipse(0, 0, 34, 34, { backgroundColor: WHITE }),
      ellipse(7, 7, 20, 20, FILLED),
    ],
  },
  {
    id: "st-choice",
    name: "Choice",
    elements: [diamond(0, 0, 70, 70, { backgroundColor: WHITE })],
  },
  {
    id: "st-history",
    name: "History",
    elements: [
      ellipse(0, 0, 36, 36, {
        backgroundColor: WHITE,
        label: label("H", { fontSize: 14 }),
      }),
    ],
  },
  {
    id: "transition",
    name: "Transition",
    elements: [
      arrow(0, 0, [[0, 0], [170, 0]], {
        endArrowhead: "arrow",
        label: label("event / action", { fontSize: 13 }),
      }),
    ],
  },
];

// ---------------------------------------------------------------------------
// Use case diagram
// ---------------------------------------------------------------------------

const useCaseStencils: Stencil[] = [
  { id: "uc-actor", name: "Actor", elements: actor("Actor") },
  {
    id: "usecase",
    name: "Use case",
    elements: [
      ellipse(0, 0, 190, 80, {
        backgroundColor: PEACH,
        label: label("Use Case"),
      }),
    ],
  },
  {
    id: "system-boundary",
    name: "System boundary",
    elements: [
      rect(0, 0, 320, 420, {
        backgroundColor: "transparent",
        label: label("System", { verticalAlign: "top" }),
      }),
    ],
  },
  {
    id: "uc-association",
    name: "Association",
    elements: [line(0, 0, [[0, 0], [170, 0]])],
  },
  {
    id: "uc-include",
    name: "Include",
    elements: [
      arrow(0, 0, [[0, 0], [180, 0]], {
        ...DASHED,
        endArrowhead: "arrow",
        label: label("«include»", { fontSize: 13 }),
      }),
    ],
  },
  {
    id: "uc-extend",
    name: "Extend",
    elements: [
      arrow(0, 0, [[0, 0], [180, 0]], {
        ...DASHED,
        endArrowhead: "arrow",
        label: label("«extend»", { fontSize: 13 }),
      }),
    ],
  },
  {
    id: "uc-generalization",
    name: "Generalization",
    elements: [
      arrow(0, 0, [[0, 0], [170, 0]], { endArrowhead: "triangle_outline" }),
    ],
  },
];

export const STENCIL_GROUPS: StencilGroup[] = [
  { kind: "common", title: "Common", stencils: commonStencils },
  { kind: "class", title: "Class", stencils: classStencils },
  { kind: "package", title: "Package", stencils: packageStencils },
  { kind: "sequence", title: "Sequence", stencils: sequenceStencils },
  { kind: "activity", title: "Activity", stencils: activityStencils },
  { kind: "state", title: "State", stencils: stateStencils },
  { kind: "usecase", title: "Use Case", stencils: useCaseStencils },
];

export const ALL_STENCILS: ReadonlyMap<string, Stencil> = new Map(
  STENCIL_GROUPS.flatMap((g) => g.stencils.map((s) => [s.id, s])),
);
