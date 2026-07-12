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

if (process.env.SHOTS_DIR) {
  await page.mouse.click(1300, 850);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${process.env.SHOTS_DIR}/12-connected.png` });
}
await browser.close();
console.log("INTERACTIONS OK");
