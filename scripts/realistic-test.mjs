// Realistic usage test: builds a class diagram and a 5-participant sequence
// diagram the way a user would (insert, edit labels, stretch, resize, connect,
// move) and records findings instead of hard-failing — output feeds
// docs/TEST-REPORT.md.
// Usage: npm run preview -- --port 4173 & node scripts/realistic-test.mjs
import { chromium } from "playwright-core";

const url = process.env.APP_URL ?? "http://localhost:4173";
const shots = process.env.SHOTS_DIR ?? "/tmp";
const executablePath =
  process.env.CHROMIUM_PATH ??
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const findings = [];
const report = (area, status, detail) => {
  findings.push({ area, status, detail });
  console.log(`[${status}] ${area}: ${detail}`);
};

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => report("console", "BUG", `pageerror: ${e.message}`));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector(".stencil-card", { timeout: 20000 });
await page.waitForTimeout(1200);

const drop = async (id, fx, fy) => {
  await page.evaluate(
    ([id, fx, fy]) => {
      const dt = new DataTransfer();
      dt.setData("application/x-uml-stencil", id);
      const t = document.querySelector(".canvas-wrap");
      const r = t.getBoundingClientRect();
      const o = {
        bubbles: true,
        cancelable: true,
        clientX: r.left + r.width * fx,
        clientY: r.top + r.height * fy,
        dataTransfer: dt,
      };
      t.dispatchEvent(new DragEvent("dragover", o));
      t.dispatchEvent(new DragEvent("drop", o));
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
      els: api.getSceneElements().map((e) => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        width: e.width,
        height: e.height,
        points: e.points,
        text: e.text,
        fontSize: e.fontSize,
        containerId: e.containerId,
        sb: e.startBinding?.elementId,
        eb: e.endBinding?.elementId,
        gid: e.customData?.umlGroup,
        strokeColor: e.strokeColor,
      })),
      scrollX: a.scrollX,
      scrollY: a.scrollY,
      zoom: a.zoom.value,
      ol: a.offsetLeft,
      ot: a.offsetTop,
    };
  });

let s;
const tc = (x, y) => [
  (x + s.scrollX) * s.zoom + s.ol,
  (y + s.scrollY) * s.zoom + s.ot,
];
const deselect = async () => {
  await page.mouse.click(1350, 862);
  await page.waitForTimeout(200);
};
const dragMouse = async (from, to, steps = 15) => {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps });
  await page.mouse.up();
  await page.waitForTimeout(450);
};
const groupBounds = (gid) => {
  const members = s.els.filter((e) => e.gid === gid && !e.containerId);
  const xs = [];
  const ys = [];
  for (const e of members) {
    if (e.points) {
      for (const p of e.points) {
        xs.push(e.x + p[0]);
        ys.push(e.y + p[1]);
      }
    } else {
      xs.push(e.x, e.x + e.width);
      ys.push(e.y, e.y + e.height);
    }
  }
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
};
const editText = async (clientX, clientY, newText) => {
  await page.mouse.dblclick(clientX, clientY);
  await page.waitForTimeout(500);
  const editing = await page.evaluate(
    () => !!document.querySelector(".excalidraw textarea"),
  );
  if (!editing) return false;
  await page.keyboard.press("Control+a");
  await page.keyboard.type(newText.replace(/\\n/g, "\n"), { delay: 5 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  return true;
};

// ===========================================================================
// Scenario 1: class diagram
// ===========================================================================
console.log("--- Scenario 1: class diagram ---");
await drop("class", 0.35, 0.35);
await drop("class", 0.75, 0.35);
s = await getScene();
let stacks = {};
for (const gid of [...new Set(s.els.map((e) => e.gid).filter(Boolean))]) {
  const rects = s.els
    .filter((e) => e.gid === gid && e.type === "rectangle")
    .sort((a, b) => a.y - b.y);
  stacks[gid] = rects;
}
const gids = Object.keys(stacks);
const [c1, c2] = gids.map((g) => stacks[g]);
if (!c1 || c1.length !== 3 || !c2 || c2.length !== 3) {
  report("class-insert", "BUG", "expected two 3-compartment classes");
} else {
  report("class-insert", "OK", "two classes with 3 grouped compartments");
}

// --- 1a. edit the name, add properties, add methods
const nameC = tc(c1[0].x + c1[0].width / 2, c1[0].y + c1[0].height / 2);
if (await editText(nameC[0], nameC[1], "Customer")) {
  report("class-edit-name", "OK", "class name edited by double-click");
} else {
  report("class-edit-name", "BUG", "double-click did not open the name editor");
}
const attrsC = tc(c1[1].x + c1[1].width / 2, c1[1].y + c1[1].height / 2);
await editText(attrsC[0], attrsC[1], "+ name: string\\n+ email: string\\n+ vip: boolean\\n+ age: int");
s = await getScene();
let a1 = s.els.find((e) => e.id === c1[1].id);
let m1 = s.els.find((e) => e.id === c1[2].id);
const overlap = a1.y + a1.height - m1.y;
if (overlap > 2) {
  report(
    "class-add-attrs",
    "BUG",
    `adding attribute lines grows the middle compartment over the methods compartment (overlap ${overlap.toFixed(0)}px) — compartments are not re-stacked`,
  );
} else if (a1.height < 80) {
  report(
    "class-add-attrs",
    "NOTE",
    `container did not grow for 4 attribute lines (h=${a1.height.toFixed(0)}) — text may overflow`,
  );
} else {
  report("class-add-attrs", "OK", "attrs compartment grew without overlapping");
}
await page.screenshot({ path: `${shots}/rt-01-class-edited.png` });

// --- 1b. stretch S edge for more method space
await deselect();
s = await getScene();
const c1head = s.els.find((e) => e.id === c1[0].id);
await page.mouse.click(...tc(c1head.x + 20, c1head.y + 10)); // select group
await page.waitForTimeout(300);
s = await getScene();
let b = groupBounds(c1head.gid);
const mBefore = s.els.find((e) => e.id === c1[2].id);
const fontBefore = s.els.find((e) => e.containerId === c1[2].id)?.fontSize;
await dragMouse(
  tc((b.minX + b.maxX) / 2, b.maxY),
  tc((b.minX + b.maxX) / 2, b.maxY + 70),
);
s = await getScene();
const mAfter = s.els.find((e) => e.id === c1[2].id);
const fontAfter = s.els.find((e) => e.containerId === c1[2].id)?.fontSize;
if (Math.abs(mAfter.height - (mBefore.height + 70)) <= 6 && fontAfter === fontBefore) {
  report("class-stretch-s", "OK", "S-edge stretch grew only the bottom compartment, font unchanged");
} else {
  report(
    "class-stretch-s",
    "BUG",
    `S-edge stretch: methods h ${mBefore.height.toFixed(0)}->${mAfter.height.toFixed(0)}, font ${fontBefore}->${fontAfter}`,
  );
}

// --- 1c. stretch E edge
s = await getScene();
b = groupBounds(c1head.gid);
const wBefore = s.els.find((e) => e.id === c1[0].id).width;
await dragMouse(
  tc(b.maxX, (b.minY + b.maxY) / 2),
  tc(b.maxX + 60, (b.minY + b.maxY) / 2),
);
s = await getScene();
const widths = c1.map((r) => s.els.find((e) => e.id === r.id).width);
if (widths.every((w) => Math.abs(w - (wBefore + 60)) <= 6)) {
  report("class-stretch-e", "OK", "E-edge stretch widened all compartments equally");
} else {
  report("class-stretch-e", "BUG", `E-edge widths after stretch: ${widths.map((w) => w.toFixed(0)).join(",")}`);
}
await page.screenshot({ path: `${shots}/rt-02-class-stretched.png` });

// --- 1d. corner (proportional) resize
s = await getScene();
b = groupBounds(c1head.gid);
const hBefore = b.maxY - b.minY;
await dragMouse(tc(b.maxX, b.maxY), tc(b.maxX + 50, b.maxY + 50));
s = await getScene();
b = groupBounds(c1head.gid);
const fontCorner = s.els.find((e) => e.containerId === c1[2].id)?.fontSize;
if (b.maxY - b.minY > hBefore + 20) {
  report(
    "class-corner-resize",
    "OK",
    `corner resize scaled the whole class (native proportional; font ${fontAfter}->${fontCorner})`,
  );
} else {
  report(
    "class-corner-resize",
    "NOTE",
    `corner-resize drag did not resize (h ${hBefore.toFixed(0)}->${(b.maxY - b.minY).toFixed(0)}) — corner handle may not have been hit`,
  );
}

// --- 1e. connect inheritance between stretched classes, then move
await deselect();
await drop("inheritance", 0.55, 0.62);
s = await getScene();
const inh = s.els.filter((e) => e.type === "arrow").at(-1);
const mid = tc(inh.x + (inh.points[0][0] + inh.points.at(-1)[0]) / 2, inh.y);
await page.mouse.click(mid[0], mid[1]);
await page.waitForTimeout(300);
const c2mid = s.els.find((e) => e.id === c2[1].id);
await dragMouse(
  tc(inh.x + inh.points.at(-1)[0], inh.y + inh.points.at(-1)[1]),
  tc(c2mid.x + c2mid.width / 2, c2mid.y + c2mid.height / 2),
);
s = await getScene();
const inh2 = s.els.find((e) => e.id === inh.id);
if (inh2?.eb && s.els.find((e) => e.id === inh2.eb)?.gid === c2mid.gid) {
  report("class-connect", "OK", "inheritance arrow bound to the second class after stretching");
} else {
  report("class-connect", "BUG", `arrow end binding after stretch: ${inh2?.eb}`);
}
await page.screenshot({ path: `${shots}/rt-03-class-final.png` });

// ===========================================================================
// Scenario 2: sequence diagram (browser -> JSF -> service -> repo -> DB)
// ===========================================================================
console.log("--- Scenario 2: sequence diagram ---");
await page.click('button:has-text("Import")');
await page.waitForSelector(".text-import-input", { timeout: 10000 });
await page.fill(
  ".text-import-input",
  `sequenceDiagram
  actor U as User
  participant C as JSFController
  participant S as Service
  participant R as Repository
  participant D as DB
  U->>+C: submit form
  C->>+S: process(order)
  S->>S: validate(order)
  S->>+R: save(order)
  R->>+D: INSERT order
  D-->>-R: ok
  R-->>-S: entity
  S-->>-C: result
  C-->>-U: render page`,
);
await page.click('.text-export-actions button:has-text("Import")');
await page.waitForTimeout(1200);
s = await getScene();
const seqArrows = s.els.filter((e) => e.type === "arrow");
const seqLines = s.els.filter((e) => e.type === "line" && e.gid);
report(
  "seq-import",
  seqLines.length === 5 && seqArrows.length >= 8 ? "OK" : "BUG",
  `imported: ${seqLines.length} lifelines, ${seqArrows.length} messages`,
);
await page.screenshot({ path: `${shots}/rt-04-seq-imported.png` });

// Imported messages are NOT bound (rendered by coordinates): check whether
// moving a lifeline leaves them behind.
const dbLine = seqLines.sort((a, b) => a.x - b.x).at(-1);
const dbStrip = s.els.find(
  (e) => e.gid === dbLine.gid && e.type === "rectangle" && e.width <= 24,
);
const boundToDb = seqArrows.filter((e) => e.sb === dbStrip?.id || e.eb === dbStrip?.id);
report(
  "seq-import-bindings",
  boundToDb.length > 0 ? "OK" : "BUG",
  boundToDb.length > 0
    ? "imported messages are bound to lifeline strips"
    : "imported sequence messages are NOT bound to the lifelines — moving/stretching a lifeline leaves the arrows behind",
);

// --- 2a. stretch the DB lifeline down; do bound arrows keep their y?
await deselect();
s = await getScene();
const dbHead = s.els.find(
  (e) => e.gid === dbLine.gid && e.type === "rectangle" && e.width > 24,
);
await page.mouse.click(...tc(dbHead.x + 12, dbHead.y + 10));
await page.waitForTimeout(300);
s = await getScene();
b = groupBounds(dbLine.gid);
const arrowYsBefore = seqArrows.map((a) => {
  const e = s.els.find((x) => x.id === a.id);
  return e.y + e.points[0][1];
});
const lineLenBefore = Math.abs(dbLine.points.at(-1)[1] - dbLine.points[0][1]);
await dragMouse(
  tc((b.minX + b.maxX) / 2, b.maxY),
  tc((b.minX + b.maxX) / 2, b.maxY + 120),
);
s = await getScene();
const dbLine2 = s.els.find((e) => e.id === dbLine.id);
const lineLenAfter = Math.abs(dbLine2.points.at(-1)[1] - dbLine2.points[0][1]);
const arrowYsAfter = seqArrows.map((a) => {
  const e = s.els.find((x) => x.id === a.id);
  return e.y + e.points[0][1];
});
const maxShift = Math.max(
  ...arrowYsBefore.map((y, i) => Math.abs(arrowYsAfter[i] - y)),
);
if (Math.abs(lineLenAfter - (lineLenBefore + 120)) <= 8) {
  report("seq-stretch-lifeline", "OK", `DB lifeline extended by 120px via S-edge stretch`);
} else {
  report(
    "seq-stretch-lifeline",
    "BUG",
    `lifeline length ${lineLenBefore.toFixed(0)}->${lineLenAfter.toFixed(0)} after S-edge stretch of 120`,
  );
}
report(
  "seq-stretch-arrows",
  maxShift <= 3 ? "OK" : "BUG",
  maxShift <= 3
    ? "messages kept their vertical position while the lifeline stretched"
    : `messages shifted up to ${maxShift.toFixed(0)}px when the lifeline stretched`,
);
await page.screenshot({ path: `${shots}/rt-05-seq-stretched.png` });

// --- 2b. add another call between Service and Repository, connect, slide
await deselect();
s = await getScene();
const linesLR = s.els
  .filter((e) => e.type === "line" && e.gid && e.points && Math.abs(e.points.at(-1)[0]) < 5)
  .sort((a, b) => a.x - b.x);
const svcLine = linesLR[2];
const repoLine = linesLR[3];
const bottomY = Math.min(
  svcLine.y + Math.abs(svcLine.points.at(-1)[1]),
  repoLine.y + Math.abs(repoLine.points.at(-1)[1]),
) - 30;
await drop("sync-message", 0.5, 0.85);
s = await getScene();
const newMsg = s.els.filter((e) => e.type === "arrow").at(-1);
const nmMid = tc(newMsg.x + (newMsg.points[0][0] + newMsg.points.at(-1)[0]) / 2, newMsg.y + (newMsg.points[0][1] + newMsg.points.at(-1)[1]) / 2);
await page.mouse.click(nmMid[0], nmMid[1]);
await page.waitForTimeout(300);
await dragMouse(
  tc(newMsg.x + newMsg.points.at(-1)[0], newMsg.y + newMsg.points.at(-1)[1]),
  tc(repoLine.x, bottomY),
);
s = await getScene();
let nm = s.els.find((e) => e.id === newMsg.id);
const nmMid2 = tc(nm.x + (nm.points[0][0] + nm.points.at(-1)[0]) / 2, nm.y + (nm.points[0][1] + nm.points.at(-1)[1]) / 2);
await deselect();
await page.mouse.click(nmMid2[0], nmMid2[1]);
await page.waitForTimeout(300);
await dragMouse(
  tc(nm.x + nm.points[0][0], nm.y + nm.points[0][1]),
  tc(svcLine.x, bottomY),
);
s = await getScene();
nm = s.els.find((e) => e.id === newMsg.id);
if (nm.sb && nm.eb) {
  report("seq-add-call", "OK", "new call connected to Service and Repository lifelines");
  // slide it up 40px
  await deselect();
  const y0 = nm.y;
  const c = tc(nm.x + nm.points.at(-1)[0] / 2, nm.y);
  await dragMouse(c, [c[0], c[1] - 40]);
  s = await getScene();
  nm = s.els.find((e) => e.id === newMsg.id);
  report(
    "seq-slide-call",
    Math.abs(nm.y - (y0 - 40)) <= 25 && nm.sb && nm.eb ? "OK" : "BUG",
    `slide: y ${y0.toFixed(0)}->${nm.y.toFixed(0)}, bound=${!!(nm.sb && nm.eb)}`,
  );
} else {
  report("seq-add-call", "BUG", `new call bindings sb=${nm.sb} eb=${nm.eb}`);
}
await page.screenshot({ path: `${shots}/rt-06-seq-newcall.png` });

// --- 2c. move a middle lifeline horizontally: do its messages follow?
await deselect();
s = await getScene();
const svcHead = s.els.find(
  (e) => e.gid === svcLine.gid && e.type === "rectangle" && e.width > 24,
);
const svcStrip = s.els.find(
  (e) => e.gid === svcLine.gid && e.type === "rectangle" && e.width <= 24,
);
const affected = s.els.filter(
  (e) => e.type === "arrow" && (e.sb === svcStrip.id || e.eb === svcStrip.id),
);
await dragMouse(
  tc(svcHead.x + 14, svcHead.y + 8),
  tc(svcHead.x + 14 + 60, svcHead.y + 8),
);
s = await getScene();
const svcStrip2 = s.els.find((e) => e.id === svcStrip.id);
const stillBound = affected.every((a) => {
  const e = s.els.find((x) => x.id === a.id);
  return e.sb === a.sb && e.eb === a.eb;
});
const endpointsFollow = affected.every((a) => {
  const e = s.els.find((x) => x.id === a.id);
  const cx = svcStrip2.x + svcStrip2.width / 2;
  const sx = e.x + e.points[0][0];
  const ex = e.x + e.points.at(-1)[0];
  return Math.abs(sx - cx) <= 3 || Math.abs(ex - cx) <= 3;
});
report(
  "seq-move-lifeline",
  stillBound && endpointsFollow ? "OK" : "BUG",
  stillBound && endpointsFollow
    ? `moving the Service lifeline kept ${affected.length} bound messages attached and straight`
    : `after moving Service: bound=${stillBound}, endpointsFollow=${endpointsFollow} (${affected.length} messages)`,
);
await page.screenshot({ path: `${shots}/rt-07-seq-moved.png` });

// --- 2d. unbound imported messages after all this? summarize.
s = await getScene();
const unbound = s.els.filter(
  (e) => e.type === "arrow" && (!e.sb || !e.eb),
);
report(
  "seq-unbound-arrows",
  unbound.length === 0 ? "OK" : "NOTE",
  `${unbound.length} message arrows without full bindings (imported self-messages/returns not on strips)`,
);

console.log("\n=== FINDINGS ===");
console.log(JSON.stringify(findings, null, 1));
await browser.close();
