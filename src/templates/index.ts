import type { DiagramKind, Skeleton } from "../stencils/types";
import {
  DASHED,
  FILLED,
  GREEN,
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
} from "../stencils/builders";

export interface Template {
  id: DiagramKind;
  name: string;
  description: string;
  elements: Skeleton[];
}

// Arrows reference other elements by id (start/end bindings), so they stay
// attached when shapes are moved. Each template is only ever converted into a
// fresh document, so the fixed ids cannot collide.

const classTemplate: Skeleton[] = [
  ...classBox(
    0,
    0,
    "Customer",
    "+ name: string\n+ email: string",
    "+ register(): void",
    "customer",
  ),
  ...classBox(
    480,
    0,
    "Order",
    "+ date: Date\n+ total: Money",
    "+ checkout(): void",
    "order",
  ),
  ...classBox(
    0,
    320,
    "PremiumCustomer",
    "+ discount: Percent",
    "+ upgrade(): void",
    "premium",
  ),
  arrow(240, 70, [[0, 0], [220, 0]], {
    start: { id: "customer" },
    end: { id: "order" },
    label: label("places  1..*", { fontSize: 13 }),
  }),
  arrow(110, 300, [[0, 0], [0, -140]], {
    start: { id: "premium-header" },
    end: { id: "customer-methods" },
    endArrowhead: "triangle_outline",
  }),
];

const packageTemplate: Skeleton[] = [
  rect(0, 0, 90, 28, { backgroundColor: YELLOW }),
  rect(0, 28, 230, 130, {
    id: "pkg-app",
    backgroundColor: WHITE,
    label: label("app", { verticalAlign: "top" }),
  }),
  rect(430, 0, 90, 28, { backgroundColor: YELLOW }),
  rect(430, 28, 230, 130, {
    id: "pkg-domain",
    backgroundColor: WHITE,
    label: label("domain", { verticalAlign: "top" }),
  }),
  rect(215, 300, 90, 28, { backgroundColor: YELLOW }),
  rect(215, 328, 230, 130, {
    id: "pkg-infra",
    backgroundColor: WHITE,
    label: label("infrastructure", { verticalAlign: "top" }),
  }),
  arrow(250, 90, [[0, 0], [160, 0]], {
    ...DASHED,
    endArrowhead: "arrow",
    start: { id: "pkg-app" },
    end: { id: "pkg-domain" },
    label: label("«import»", { fontSize: 13 }),
  }),
  arrow(180, 180, [[0, 0], [120, 130]], {
    ...DASHED,
    endArrowhead: "arrow",
    start: { id: "pkg-app" },
    end: { id: "pkg-infra" },
  }),
  arrow(500, 180, [[0, 0], [-120, 130]], {
    ...DASHED,
    endArrowhead: "arrow",
    start: { id: "pkg-domain" },
    end: { id: "pkg-infra" },
  }),
];

const sequenceTemplate: Skeleton[] = [
  ...actor("User"),
  line(32, 120, [[0, 0], [0, 320]], DASHED),
  rect(240, 40, 130, 44, {
    backgroundColor: VIOLET,
    label: label(": WebApp"),
  }),
  line(305, 84, [[0, 0], [0, 356]], DASHED),
  rect(520, 40, 130, 44, {
    backgroundColor: VIOLET,
    label: label(": Database"),
  }),
  line(585, 84, [[0, 0], [0, 356]], DASHED),
  rect(298, 160, 14, 200, { backgroundColor: VIOLET }),
  rect(578, 210, 14, 70, { backgroundColor: VIOLET }),
  arrow(36, 165, [[0, 0], [258, 0]], {
    endArrowhead: "triangle",
    label: label("login(credentials)", { fontSize: 13 }),
  }),
  arrow(316, 215, [[0, 0], [258, 0]], {
    endArrowhead: "triangle",
    label: label("findUser()", { fontSize: 13 }),
  }),
  arrow(574, 270, [[0, 0], [-258, 0]], {
    ...DASHED,
    endArrowhead: "arrow",
    label: label("user", { fontSize: 13 }),
  }),
  arrow(294, 340, [[0, 0], [-254, 0]], {
    ...DASHED,
    endArrowhead: "arrow",
    label: label("session", { fontSize: 13 }),
  }),
];

const activityTemplate: Skeleton[] = [
  ellipse(147, 0, 26, 26, { id: "act-start", ...FILLED }),
  rect(80, 90, 160, 56, {
    id: "act-receive",
    ...ROUNDED,
    backgroundColor: GREEN,
    label: label("Receive order"),
  }),
  diamond(120, 210, 80, 80, { id: "act-check", backgroundColor: WHITE }),
  rect(-120, 360, 160, 56, {
    id: "act-fulfill",
    ...ROUNDED,
    backgroundColor: GREEN,
    label: label("Fulfill order"),
  }),
  rect(280, 360, 160, 56, {
    id: "act-notify",
    ...ROUNDED,
    backgroundColor: GREEN,
    label: label("Notify customer"),
  }),
  diamond(125, 480, 70, 70, { id: "act-merge", backgroundColor: WHITE }),
  ellipse(143, 610, 34, 34, { id: "act-end", backgroundColor: WHITE }),
  ellipse(150, 617, 20, 20, FILLED),
  arrow(160, 30, [[0, 0], [0, 55]], {
    endArrowhead: "arrow",
    start: { id: "act-start" },
    end: { id: "act-receive" },
  }),
  arrow(160, 150, [[0, 0], [0, 55]], {
    endArrowhead: "arrow",
    start: { id: "act-receive" },
    end: { id: "act-check" },
  }),
  arrow(115, 255, [[0, 0], [-150, 100]], {
    endArrowhead: "arrow",
    start: { id: "act-check" },
    end: { id: "act-fulfill" },
    label: label("[in stock]", { fontSize: 13 }),
  }),
  arrow(205, 255, [[0, 0], [150, 100]], {
    endArrowhead: "arrow",
    start: { id: "act-check" },
    end: { id: "act-notify" },
    label: label("[out of stock]", { fontSize: 13 }),
  }),
  arrow(-40, 420, [[0, 0], [160, 90]], {
    endArrowhead: "arrow",
    start: { id: "act-fulfill" },
    end: { id: "act-merge" },
  }),
  arrow(360, 420, [[0, 0], [-160, 90]], {
    endArrowhead: "arrow",
    start: { id: "act-notify" },
    end: { id: "act-merge" },
  }),
  arrow(160, 555, [[0, 0], [0, 50]], {
    endArrowhead: "arrow",
    start: { id: "act-merge" },
    end: { id: "act-end" },
  }),
];

const stateTemplate: Skeleton[] = [
  ellipse(0, 40, 26, 26, { id: "st-start", ...FILLED }),
  rect(120, 20, 160, 64, {
    id: "st-idle",
    ...ROUNDED,
    backgroundColor: TEAL,
    label: label("Idle"),
  }),
  rect(420, 20, 160, 64, {
    id: "st-running",
    ...ROUNDED,
    backgroundColor: TEAL,
    label: label("Running"),
  }),
  ellipse(700, 35, 34, 34, { id: "st-end", backgroundColor: WHITE }),
  ellipse(707, 42, 20, 20, FILLED),
  arrow(30, 52, [[0, 0], [85, 0]], {
    endArrowhead: "arrow",
    start: { id: "st-start" },
    end: { id: "st-idle" },
  }),
  arrow(285, 35, [[0, 0], [130, 0]], {
    endArrowhead: "arrow",
    start: { id: "st-idle" },
    end: { id: "st-running" },
    label: label("start / run", { fontSize: 13 }),
  }),
  arrow(415, 70, [[0, 0], [-130, 0]], {
    endArrowhead: "arrow",
    start: { id: "st-running" },
    end: { id: "st-idle" },
    label: label("pause", { fontSize: 13 }),
  }),
  arrow(585, 52, [[0, 0], [110, 0]], {
    endArrowhead: "arrow",
    start: { id: "st-running" },
    end: { id: "st-end" },
    label: label("done", { fontSize: 13 }),
  }),
];

const useCaseTemplate: Skeleton[] = [
  ...actor("User"),
  rect(260, -60, 340, 400, {
    backgroundColor: "transparent",
    label: label("Web Shop", { verticalAlign: "top" }),
  }),
  ellipse(330, 20, 190, 76, {
    id: "uc-browse",
    backgroundColor: PEACH,
    label: label("Browse catalog"),
  }),
  ellipse(330, 150, 190, 76, {
    id: "uc-order",
    backgroundColor: PEACH,
    label: label("Place order"),
  }),
  ellipse(330, 400, 190, 76, {
    id: "uc-login",
    backgroundColor: PEACH,
    label: label("Log in"),
  }),
  line(64, 40, [[0, 0], [266, 18]]),
  line(64, 70, [[0, 0], [266, 118]]),
  arrow(420, 240, [[0, 0], [0, 145]], {
    ...DASHED,
    endArrowhead: "arrow",
    start: { id: "uc-order" },
    end: { id: "uc-login" },
    label: label("«include»", { fontSize: 13 }),
  }),
];

export const TEMPLATES: Template[] = [
  {
    id: "class",
    name: "Class diagram",
    description: "Classes, inheritance, association",
    elements: classTemplate,
  },
  {
    id: "package",
    name: "Package diagram",
    description: "Packages with «import» dependencies",
    elements: packageTemplate,
  },
  {
    id: "sequence",
    name: "Sequence diagram",
    description: "Actor, lifelines, messages",
    elements: sequenceTemplate,
  },
  {
    id: "activity",
    name: "Activity diagram",
    description: "Actions, decision, merge",
    elements: activityTemplate,
  },
  {
    id: "state",
    name: "State diagram",
    description: "States and transitions",
    elements: stateTemplate,
  },
  {
    id: "usecase",
    name: "Use case diagram",
    description: "Actor, system boundary, «include»",
    elements: useCaseTemplate,
  },
];
