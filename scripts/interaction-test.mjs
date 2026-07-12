// Regression test for canvas interactions reported from manual testing:
// 1. UML shapes must not rotate (rotation snaps back, nothing disappears).
// 2. A relationship arrow's endpoints can be dragged onto class boxes and
//    bind to them (stay attached).
// Usage: npm run preview -- --port 4173 & node scripts/interaction-test.mjs
import { chromium } from "playwright-core";

const url = process.env.APP_URL ?? "http://localhost:4173";
const executablePath =
  process.env.CHROMIUM_PATH ??
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.error("pageerror:", e.message));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector(".stencil-card", { timeout: 20000 });
await page.waitForTimeout(1200);

const dropStencil = async (id, fx, fy) => {
  await page.evaluate(
    ([id, fx, fy]) => {
      const dt = new DataTransfer();
      dt.setData("application/x-uml-stencil", id);
      const target = document.querySelector(".canvas-wrap");
      const r = target.getBoundingClientRect();
      const opts = {
        bubbles: true,
        cancelable: true,
        clientX: r.left + r.width * fx,
        clientY: r.top + r.height * fy,
        dataTransfer: dt,
      };
      target.dispatchEvent(new DragEvent("dragover", opts));
      target.dispatchEvent(new DragEvent("drop", opts));
    },
    [id, fx, fy],
  );
  await page.waitForTimeout(400);
};

const getScene = () =>
  page.evaluate(() => {
    const api = window.__umldraw;
    const a = api.getAppState();
    return {
      elements: api.getSceneElements().map((e) => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        width: e.width,
        height: e.height,
        angle: e.angle,
        points: e.points,
        startBinding: e.startBinding,
        endBinding: e.endBinding,
        endArrowhead: e.endArrowhead,
        customData: e.customData,
        groupIds: e.groupIds,
        version: e.version,
      })),
      scrollX: a.scrollX,
      scrollY: a.scrollY,
      zoom: a.zoom.value,
      offsetLeft: a.offsetLeft,
      offsetTop: a.offsetTop,
    };
  });

const toClient = (s, x, y) => [
  (x + s.scrollX) * s.zoom + s.offsetLeft,
  (y + s.scrollY) * s.zoom + s.offsetTop,
];

// --- Build the scene: parent class, child class, inheritance arrow --------
await dropStencil("class-simple", 0.62, 0.2);
await dropStencil("class-simple", 0.32, 0.72);
await dropStencil("inheritance", 0.45, 0.46);

let s = await getScene();
const rects = s.elements.filter((e) => e.type === "rectangle");
const arrow = s.elements.find((e) => e.type === "arrow");
if (rects.length !== 2 || !arrow) {
  fail(`expected 2 class boxes and 1 arrow, got ${JSON.stringify(s.elements.map((e) => e.type))}`);
}
if (!arrow.customData?.umlNoRotate) fail("inserted arrow is not tagged umlNoRotate");
// Regression: points must be normalized (points[0] === [0,0]), otherwise the
// arrow's geometry corrupts on endpoint drag and it stops rendering.
if (arrow.points[0][0] !== 0 || arrow.points[0][1] !== 0) {
  fail(`inserted arrow points are not normalized: ${JSON.stringify(arrow.points)}`);
}
const parent = rects.reduce((a, b) => (a.y < b.y ? a : b));
const child = rects.find((r) => r.id !== parent.id);

// --- 2) Drag the arrow's END endpoint onto the parent class ---------------
// Click the arrow first (a real pointer click activates the endpoint
// handles — programmatic selection does not).
const mid = toClient(
  s,
  arrow.x + (arrow.points[0][0] + arrow.points[arrow.points.length - 1][0]) / 2,
  arrow.y + (arrow.points[0][1] + arrow.points[arrow.points.length - 1][1]) / 2,
);
await page.mouse.click(1300, 850); // deselect
await page.waitForTimeout(200);
await page.mouse.click(mid[0], mid[1]);
await page.waitForTimeout(300);
const endPt = toClient(
  s,
  arrow.x + arrow.points[arrow.points.length - 1][0],
  arrow.y + arrow.points[arrow.points.length - 1][1],
);
const parentCenter = toClient(
  s,
  parent.x + parent.width / 2,
  parent.y + parent.height / 2,
);
await page.mouse.move(endPt[0], endPt[1]);
await page.mouse.down();
await page.mouse.move(parentCenter[0], parentCenter[1], { steps: 20 });
await page.mouse.up();
await page.waitForTimeout(400);

s = await getScene();
let a2 = s.elements.find((e) => e.type === "arrow");
if (!a2) fail("arrow disappeared after dragging its end endpoint");
if (a2.endBinding?.elementId !== parent.id) {
  fail(
    `arrow end did not bind to the parent class (endBinding=${JSON.stringify(a2.endBinding)})`,
  );
}
console.log("OK: arrow end endpoint bound to parent class");

// --- Drag the arrow's START endpoint onto the child class -----------------
// Re-select the arrow with a real click (binding drag may have deselected).
const mid2 = toClient(
  s,
  a2.x + (a2.points[0][0] + a2.points[a2.points.length - 1][0]) / 2,
  a2.y + (a2.points[0][1] + a2.points[a2.points.length - 1][1]) / 2,
);
await page.mouse.click(1300, 850);
await page.waitForTimeout(200);
await page.mouse.click(mid2[0], mid2[1]);
await page.waitForTimeout(300);
const startPt = toClient(s, a2.x + a2.points[0][0], a2.y + a2.points[0][1]);
const childCenter = toClient(
  s,
  child.x + child.width / 2,
  child.y + child.height / 2,
);
await page.mouse.move(startPt[0], startPt[1]);
await page.mouse.down();
await page.mouse.move(childCenter[0], childCenter[1], { steps: 20 });
await page.mouse.up();
await page.waitForTimeout(400);

s = await getScene();
a2 = s.elements.find((e) => e.type === "arrow");
if (!a2) fail("arrow disappeared after dragging its start endpoint");
if (a2.startBinding?.elementId !== child.id) {
  fail(
    `arrow start did not bind to the child class (startBinding=${JSON.stringify(a2.startBinding)})`,
  );
}
console.log("OK: arrow start endpoint bound to child class");

// --- Moving the child must keep the arrow attached -------------------------
// Grab the box by its top-left corner region: its center is where the bound
// arrow endpoint sits (the arrow is on top there, and dragging an arrow's
// body detaches it — native Excalidraw behavior).
const childBefore = s.elements.find((e) => e.id === child.id);
const from = toClient(s, childBefore.x + 25, childBefore.y + 14);
await page.mouse.click(1300, 850); // deselect
await page.waitForTimeout(200);
await page.mouse.move(from[0], from[1]);
await page.mouse.down();
await page.mouse.move(from[0] - 120, from[1] + 40, { steps: 15 });
await page.mouse.up();
await page.waitForTimeout(400);
s = await getScene();
a2 = s.elements.find((e) => e.type === "arrow");
const childNow = s.elements.find((e) => e.id === child.id);
if (Math.abs(childNow.x - childBefore.x) < 50) {
  fail("test error: the class box did not move");
}
if (a2.startBinding?.elementId !== child.id) {
  console.error("child after:", JSON.stringify(childNow));
  console.error("arrow after:", JSON.stringify(a2));
  fail("arrow lost its binding when the class was moved");
}
console.log("OK: arrow stayed attached while moving the class");

// --- 1) Rotation must be inert for UML shapes ------------------------------
// Programmatic rotation (covers whatever gesture set the angle): the guard
// must snap every tagged element back to 0.
await page.evaluate(() => {
  const api = window.__umldraw;
  api.updateScene({
    elements: api.getSceneElements().map((e) =>
      e.customData?.umlNoRotate
        ? { ...e, angle: 0.6, version: e.version + 1 }
        : e,
    ),
  });
});
await page.waitForTimeout(600);
s = await getScene();
const rotated = s.elements.filter((e) => e.angle !== 0);
if (rotated.length > 0) {
  fail(`rotation guard failed: ${rotated.length} elements kept a nonzero angle`);
}
console.log("OK: rotation snapped back to 0 for all UML elements");

// UI attempt: select the parent box and drag where the rotate handle sits.
s = await getScene();
const p2 = s.elements.find((e) => e.id === parent.id);
const pc = toClient(s, p2.x + p2.width / 2, p2.y + p2.height / 2);
await page.mouse.click(1300, 850); // deselect
await page.waitForTimeout(200);
await page.mouse.click(pc[0], pc[1]); // select the box
await page.waitForTimeout(300);
const top = toClient(s, p2.x + p2.width / 2, p2.y)[1];
await page.mouse.move(pc[0], top - 18);
await page.mouse.down();
await page.mouse.move(pc[0] + 90, top + 30, { steps: 15 });
await page.mouse.up();
await page.waitForTimeout(600);
s = await getScene();
const p3 = s.elements.find((e) => e.id === parent.id);
if (!p3) fail("class box disappeared after rotate attempt");
if (p3.angle !== 0) fail(`class box kept angle ${p3.angle} after rotate attempt`);
const a3 = s.elements.find((e) => e.type === "arrow");
if (!a3) fail("arrow disappeared after rotate attempt");
if (a3.angle !== 0) fail(`arrow kept angle ${a3.angle}`);
console.log("OK: rotate-handle drag left the class box unrotated and intact");

// --- 3) A lifeline (box + dashed line) moves as a single grouped shape -----
await dropStencil("lifeline", 0.8, 0.4);
s = await getScene();
const lifeLine = s.elements.find(
  (e) => e.type === "line" && e.customData?.umlGroup,
);
const lifeHead = s.elements.find(
  (e) =>
    e.type === "rectangle" &&
    e.customData?.umlGroup === lifeLine?.customData?.umlGroup,
);
if (!lifeLine || !lifeHead) fail("lifeline parts are not grouped");
const gid = lifeLine.customData.umlGroup;

// Drag the head box; the dashed line must follow.
await page.mouse.click(1300, 850); // deselect
await page.waitForTimeout(200);
const headCenter = toClient(
  s,
  lifeHead.x + lifeHead.width / 2,
  lifeHead.y + lifeHead.height / 2,
);
await page.mouse.move(headCenter[0], headCenter[1]);
await page.mouse.down();
await page.mouse.move(headCenter[0] - 90, headCenter[1] + 50, { steps: 15 });
await page.mouse.up();
await page.waitForTimeout(400);
s = await getScene();
const headAfter = s.elements.find((e) => e.id === lifeHead.id);
const lineAfter = s.elements.find((e) => e.id === lifeLine.id);
const dHead = [headAfter.x - lifeHead.x, headAfter.y - lifeHead.y];
const dLine = [lineAfter.x - lifeLine.x, lineAfter.y - lifeLine.y];
if (Math.abs(dHead[0]) < 50) fail("test error: lifeline head did not move");
if (Math.abs(dHead[0] - dLine[0]) > 2 || Math.abs(dHead[1] - dLine[1]) > 2) {
  fail(
    `lifeline did not move as one: head moved ${dHead}, line moved ${dLine}`,
  );
}
console.log("OK: lifeline (box + dashed line) moved as a single shape");

// Ungrouping is not allowed: the guard restores the group.
await page.evaluate((gid) => {
  const api = window.__umldraw;
  api.updateScene({
    elements: api.getSceneElements().map((e) =>
      e.customData?.umlGroup === gid
        ? { ...e, groupIds: [], version: e.version + 1 }
        : e,
    ),
  });
}, gid);
await page.waitForTimeout(600);
s = await getScene();
const parts = s.elements.filter((e) => e.customData?.umlGroup === gid);
if (!parts.every((e) => e.groupIds?.includes(gid))) {
  fail("ungroup was not reverted by the guard");
}
console.log("OK: ungrouping a lifeline is reverted");

// --- 4) A message arrow connects to lifelines by hovering the vertical line
await dropStencil("lifeline", 0.55, 0.35);
s = await getScene();
const dashedLines = s.elements.filter(
  (e) => e.type === "line" && e.customData?.umlGroup,
);
if (dashedLines.length !== 2) fail("expected 2 lifelines on the canvas");
// Sort left-to-right; each lifeline's bindable strip shares its group id.
dashedLines.sort((a, b) => a.x - b.x);
const stripOf = (lineEl) =>
  s.elements.find(
    (e) =>
      e.type === "rectangle" &&
      e.customData?.umlGroup === lineEl.customData.umlGroup &&
      e.width <= 24 && // the narrow invisible strip, not the head box
      Math.abs(e.x + e.width / 2 - (lineEl.x + lineEl.points[0][0])) < 12,
  );
const [lineA, lineB] = dashedLines;
const stripA = stripOf(lineA);
const stripB = stripOf(lineB);
if (!stripA || !stripB) fail("lifelines have no bindable strip");

// Drop a sync message between the two lifelines, well below the head boxes.
const laX = lineA.x + lineA.points[0][0];
const lbX = lineB.x + lineB.points[0][0];
const msgY = Math.max(lineA.y, lineB.y) + 120; // inside both vertical lines
{
  const c = toClient(s, (laX + lbX) / 2, msgY);
  const rect = await page.evaluate(() => {
    const r = document.querySelector(".canvas-wrap").getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  await dropStencil(
    "sync-message",
    (c[0] - rect.left) / rect.width,
    (c[1] - rect.top) / rect.height,
  );
}

// Select the arrow and drag its endpoints onto the two vertical lines.
s = await getScene();
const msg = s.elements
  .filter((e) => e.type === "arrow" && e.endArrowhead === "triangle")
  .at(-1);
if (!msg) fail("message arrow not inserted");
const msgMid = toClient(
  s,
  msg.x + (msg.points[0][0] + msg.points.at(-1)[0]) / 2,
  msg.y + (msg.points[0][1] + msg.points.at(-1)[1]) / 2,
);
await page.mouse.click(1300, 850);
await page.waitForTimeout(200);
await page.mouse.click(msgMid[0], msgMid[1]);
await page.waitForTimeout(300);

const dragEndpointTo = async (fromScene, toScene) => {
  const f = toClient(s, fromScene[0], fromScene[1]);
  const t = toClient(s, toScene[0], toScene[1]);
  await page.mouse.move(f[0], f[1]);
  await page.mouse.down();
  await page.mouse.move(t[0], t[1], { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(400);
};
await dragEndpointTo(
  [msg.x + msg.points.at(-1)[0], msg.y + msg.points.at(-1)[1]],
  [lbX, msgY],
);
s = await getScene();
let msg2 = s.elements.find((e) => e.id === msg.id);
if (msg2.endBinding?.elementId !== stripB.id) {
  fail(
    `message end did not bind to the right lifeline strip (endBinding=${JSON.stringify(msg2.endBinding)})`,
  );
}
// re-select and drag the start endpoint onto the left lifeline's line
const mid3 = toClient(
  s,
  msg2.x + (msg2.points[0][0] + msg2.points.at(-1)[0]) / 2,
  msg2.y + (msg2.points[0][1] + msg2.points.at(-1)[1]) / 2,
);
await page.mouse.click(1300, 850);
await page.waitForTimeout(200);
await page.mouse.click(mid3[0], mid3[1]);
await page.waitForTimeout(300);
await dragEndpointTo(
  [msg2.x + msg2.points[0][0], msg2.y + msg2.points[0][1]],
  [laX, msgY],
);
s = await getScene();
msg2 = s.elements.find((e) => e.id === msg.id);
if (msg2.startBinding?.elementId !== stripA.id) {
  fail(
    `message start did not bind to the left lifeline strip (startBinding=${JSON.stringify(msg2.startBinding)})`,
  );
}
console.log("OK: message arrow bound to both lifelines via their vertical lines");

// Moving a lifeline must drag the bound message endpoint along.
const headB = s.elements.find(
  (e) =>
    e.type === "rectangle" &&
    e.customData?.umlGroup === lineB.customData.umlGroup &&
    e.id !== stripB.id,
);
const endXBefore = msg2.x + msg2.points.at(-1)[0];
await page.mouse.click(1300, 850);
await page.waitForTimeout(200);
const hb = toClient(s, headB.x + headB.width / 2, headB.y + headB.height / 2);
await page.mouse.move(hb[0], hb[1]);
await page.mouse.down();
await page.mouse.move(hb[0] + 70, hb[1], { steps: 15 });
await page.mouse.up();
await page.waitForTimeout(400);
s = await getScene();
msg2 = s.elements.find((e) => e.id === msg.id);
const endXAfter = msg2.x + msg2.points.at(-1)[0];
if (msg2.endBinding?.elementId !== stripB.id) {
  fail("message lost its lifeline binding when the lifeline moved");
}
if (Math.abs(endXAfter - endXBefore - 70) > 25) {
  fail(
    `message endpoint did not follow the lifeline (moved ${(endXAfter - endXBefore).toFixed(1)}px, expected ~70px)`,
  );
}
console.log("OK: message endpoint followed the lifeline when it moved");

// --- 5) Dragging a connected message slides it along the lifelines --------
// (a bound message must stay straight and connected; the drag only changes
// its height)
s = await getScene();
msg2 = s.elements.find((e) => e.id === msg.id);
const yBefore = msg2.y;
if (Math.abs(msg2.points[0][1] - msg2.points.at(-1)[1]) > 1) {
  fail("message is not straight after normalization");
}
const midNow = toClient(
  s,
  msg2.x + msg2.points.at(-1)[0] / 2,
  msg2.y,
);
await page.mouse.click(1300, 850);
await page.waitForTimeout(200);
await page.mouse.move(midNow[0], midNow[1]);
await page.mouse.down();
await page.mouse.move(midNow[0], midNow[1] + 60, { steps: 15 });
await page.mouse.up();
await page.waitForTimeout(600);
s = await getScene();
msg2 = s.elements.find((e) => e.id === msg.id);
const sy2 = msg2.y + msg2.points[0][1];
const ey2 = msg2.y + msg2.points.at(-1)[1];
if (Math.abs(sy2 - ey2) > 1) {
  fail(`message not straight after slide (start y ${sy2}, end y ${ey2})`);
}
if (Math.abs(msg2.y - (yBefore + 60)) > 30) {
  fail(
    `message did not slide vertically (~60px expected, got ${(msg2.y - yBefore).toFixed(1)}px)`,
  );
}
if (
  msg2.startBinding?.elementId !== stripA.id ||
  msg2.endBinding?.elementId !== stripB.id
) {
  fail("message lost its lifeline bindings after sliding");
}
console.log("OK: dragging the message slid it along the lifelines, straight and connected");

// --- 6) Side-edge drags on a UML group stretch on one axis (no scaling) ----
// Excalidraw would resize a grouped selection proportionally and scale its
// text; the app intercepts side edges and stretches a single axis instead,
// leaving font sizes untouched. Corners still resize proportionally.
{
  // Fresh canvas with a single class box (3 grouped compartments + labels).
  await page.evaluate(() => window.__umldraw.updateScene({ elements: [] }));
  await page.waitForTimeout(200);
  await dropStencil("class", 0.5, 0.4);

  const groupBox = (sc) => {
    const rs = sc.elements.filter((e) => e.type === "rectangle");
    return [
      Math.min(...rs.map((e) => e.x)),
      Math.min(...rs.map((e) => e.y)),
      Math.max(...rs.map((e) => e.x + e.width)),
      Math.max(...rs.map((e) => e.y + e.height)),
    ];
  };
  const fontsOf = (sc) =>
    sc.elements.filter((e) => e.type === "text").map((e) => e.fontSize);
  const selectGroup = async (sc) => {
    const [bx1, by1, bx2, by2] = groupBox(sc);
    const c = toClient(sc, (bx1 + bx2) / 2, (by1 + by2) / 2);
    await page.mouse.click(1300, 850);
    await page.waitForTimeout(150);
    await page.mouse.click(c[0], c[1]);
    await page.waitForTimeout(200);
  };

  // South edge: height grows, width and fonts stay put.
  s = await getScene();
  let [x1, y1, x2, y2] = groupBox(s);
  const w0 = x2 - x1;
  const h0 = y2 - y1;
  const fonts0 = JSON.stringify(fontsOf(s));
  await selectGroup(s);
  let hp = toClient(s, (x1 + x2) / 2, y2);
  await page.mouse.move(hp[0], hp[1] + 4);
  await page.mouse.down();
  await page.mouse.move(hp[0], hp[1] + 4 + 90, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  s = await getScene();
  let [nx1, ny1, nx2, ny2] = groupBox(s);
  if (Math.abs(nx2 - nx1 - w0) > 1) {
    fail(`south stretch changed width (${w0} -> ${nx2 - nx1})`);
  }
  if (ny2 - ny1 - h0 < 60) {
    fail(`south stretch did not grow height (${h0} -> ${ny2 - ny1})`);
  }
  if (JSON.stringify(fontsOf(s)) !== fonts0) {
    fail(`south stretch scaled the fonts (${fonts0} -> ${JSON.stringify(fontsOf(s))})`);
  }
  console.log("OK: south-edge drag stretched height only, fonts untouched");

  // East edge: width grows, height and fonts stay put; labels re-center.
  await page.evaluate(() => window.__umldraw.updateScene({ elements: [] }));
  await page.waitForTimeout(200);
  await dropStencil("class", 0.5, 0.4);
  s = await getScene();
  [x1, y1, x2, y2] = groupBox(s);
  const ew0 = x2 - x1;
  const eh0 = y2 - y1;
  await selectGroup(s);
  hp = toClient(s, x2, (y1 + y2) / 2);
  await page.mouse.move(hp[0] + 4, hp[1]);
  await page.mouse.down();
  await page.mouse.move(hp[0] + 4 + 100, hp[1], { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  s = await getScene();
  [nx1, ny1, nx2, ny2] = groupBox(s);
  if (Math.abs(ny2 - ny1 - eh0) > 1) {
    fail(`east stretch changed height (${eh0} -> ${ny2 - ny1})`);
  }
  if (nx2 - nx1 - ew0 < 60) {
    fail(`east stretch did not grow width (${ew0} -> ${nx2 - nx1})`);
  }
  for (const t of s.elements.filter((e) => e.type === "text")) {
    const c = s.elements.find((e) => e.id === t.containerId);
    if (!c) continue;
    if (Math.abs(t.x + t.width / 2 - (c.x + c.width / 2)) > 2) {
      fail("east stretch left a label off-center in its widened compartment");
    }
  }
  console.log("OK: east-edge drag stretched width only, labels re-centered");

  // Corner: still a proportional resize (native Excalidraw), fonts scale.
  await page.evaluate(() => window.__umldraw.updateScene({ elements: [] }));
  await page.waitForTimeout(200);
  await dropStencil("class", 0.5, 0.4);
  s = await getScene();
  [x1, y1, x2, y2] = groupBox(s);
  await selectGroup(s);
  hp = toClient(s, x2, y2);
  await page.mouse.move(hp[0] + 6, hp[1] + 6);
  await page.mouse.down();
  await page.mouse.move(hp[0] + 6 + 80, hp[1] + 6 + 54, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  s = await getScene();
  [nx1, ny1, nx2, ny2] = groupBox(s);
  if (nx2 - nx1 - (x2 - x1) < 20 || ny2 - ny1 - (y2 - y1) < 20) {
    fail("corner drag did not resize the class box in both directions");
  }
  console.log("OK: corner drag still resizes proportionally");
}

if (process.env.SHOTS_DIR) {
  await page.mouse.click(1300, 850);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${process.env.SHOTS_DIR}/12-connected.png` });
}
await browser.close();
console.log("INTERACTIONS OK");
