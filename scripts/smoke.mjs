// End-to-end smoke test: drives the built app in headless Chromium.
// Usage: npm run build && npm run preview -- --port 4173 & npm run smoke
import { chromium } from "playwright-core";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.env.APP_URL ?? "http://localhost:4173";
const shots = process.env.SHOTS_DIR ?? mkdtempSync(join(tmpdir(), "umldraw-"));
const executablePath =
  process.env.CHROMIUM_PATH ??
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});
// Auto-accept confirm() dialogs (tab close)
page.on("dialog", (d) => d.accept());

const activeDocElementCount = () =>
  page.evaluate(() => {
    const active = localStorage.getItem("umldraw.activeDoc");
    const raw = localStorage.getItem(`umldraw.doc.${active}`);
    if (!raw) return null;
    return JSON.parse(raw).elements.length;
  });

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector(".excalidraw", { timeout: 20000 });
await page.waitForSelector(".stencil-card", { timeout: 20000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${shots}/01-initial.png` });

// Click-insert a Class stencil
await page.click('.stencil-card[title^="Class "]');
await page.waitForTimeout(600);

// Open the Sequence group and insert a lifeline
await page.click('.palette-group-header:has-text("Sequence")');
await page.waitForTimeout(400);
await page.click('.stencil-card[title^="Lifeline"]');
await page.waitForTimeout(600);

// Drag & drop path: synthesize an HTML5 drop of the "usecase" stencil
await page.evaluate(() => {
  const dt = new DataTransfer();
  dt.setData("application/x-uml-stencil", "usecase");
  const target = document.querySelector(".canvas-wrap");
  const rect = target.getBoundingClientRect();
  const opts = {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + rect.width * 0.7,
    clientY: rect.top + rect.height * 0.7,
    dataTransfer: dt,
  };
  target.dispatchEvent(new DragEvent("dragover", opts));
  target.dispatchEvent(new DragEvent("drop", opts));
});
await page.waitForTimeout(600);
await page.screenshot({ path: `${shots}/02-inserted.png` });

// Verify per-document autosave captured elements
await page.waitForTimeout(1200);
const saved = await activeDocElementCount();
console.log("autosaved element count (doc 1):", saved);
// 3 class compartments + 2 lifeline parts + 1 use case (+ bound label texts)
if (!saved || saved < 6) fail(`expected >= 6 autosaved elements, got ${saved}`);

// New tab from the "Class diagram" template
await page.click('.topbar-actions button:has-text("New")');
await page.waitForSelector(".template-grid", { timeout: 10000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${shots}/05-templates.png` });
await page.click('.template-card:has-text("Class diagram")');
await page.waitForTimeout(1000);
await page.screenshot({ path: `${shots}/06-template-tab.png` });

const tabCount = await page.locator(".tab").count();
console.log("tab count after template:", tabCount);
if (tabCount !== 2) fail(`expected 2 tabs, got ${tabCount}`);
const templateElements = await activeDocElementCount();
console.log("template doc element count:", templateElements);
if (!templateElements || templateElements < 10) {
  fail(`expected a populated template doc, got ${templateElements}`);
}

// Text export on the class template: Mermaid classDiagram with inheritance
await page.click('button:has-text("Text")');
await page.waitForSelector(".text-export-output", { timeout: 10000 });
const mermaid = await page.inputValue(".text-export-output");
console.log("mermaid export:\n" + mermaid);
if (!mermaid.includes("classDiagram")) fail("expected Mermaid classDiagram");
if (!mermaid.includes("Customer")) fail("expected Customer class in export");
if (!mermaid.includes("--|>")) fail("expected inheritance relation in export");
if (!mermaid.includes("places")) fail("expected association label in export");
await page.click('.text-export-controls label:has-text("PlantUML")');
await page.waitForTimeout(300);
const plantuml = await page.inputValue(".text-export-output");
if (!plantuml.startsWith("@startuml")) fail("expected PlantUML output");
if (!plantuml.includes("class \"Customer\"")) {
  fail("expected PlantUML class Customer");
}
const textDownloadPromise = page.waitForEvent("download", { timeout: 15000 });
await page.click('.text-export-actions button:has-text("Download")');
const textDownload = await textDownloadPromise;
console.log("text export download:", textDownload.suggestedFilename());
await page.screenshot({ path: `${shots}/08-text-export.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// Switch back to the first tab — its scene must come back
await page.click(".tab >> nth=0");
await page.waitForTimeout(800);
const backCount = await activeDocElementCount();
console.log("doc 1 element count after switching back:", backCount);
if (backCount !== saved) fail(`doc 1 changed: ${saved} -> ${backCount}`);

// Close the template tab (auto-accepted confirm)
await page.click(".tab >> nth=1 >> .tab-close");
await page.waitForTimeout(600);
const tabsAfterClose = await page.locator(".tab").count();
if (tabsAfterClose !== 1) fail(`expected 1 tab after close, got ${tabsAfterClose}`);

// PNG export triggers a download
const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
await page.click('button:has-text("PNG")');
const download = await downloadPromise;
console.log("png export download:", download.suggestedFilename());

// UML library export downloads a valid .excalidrawlib with all stencils
const libDownloadPromise = page.waitForEvent("download", { timeout: 15000 });
await page.click('button:has-text("UML lib")');
const libDownload = await libDownloadPromise;
const lib = JSON.parse(readFileSync(await libDownload.path(), "utf8"));
console.log(
  "library download:",
  libDownload.suggestedFilename(),
  `type=${lib.type}`,
  `items=${lib.libraryItems?.length}`,
);
if (lib.type !== "excalidrawlib") fail(`bad library type: ${lib.type}`);
if ((lib.libraryItems?.length ?? 0) < 50) {
  fail(`expected >= 50 library items, got ${lib.libraryItems?.length}`);
}

// The embedded editor's Library panel is preloaded with the UML shapes
await page.click(".excalidraw .sidebar-trigger");
await page.waitForTimeout(800);
const libUnits = await page.locator(".library-menu-items-container").count();
console.log("library panel containers:", libUnits);
await page.screenshot({ path: `${shots}/07-library.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// Toggle dark theme
await page.click('button[aria-label="Toggle theme"]');
await page.waitForTimeout(800);
await page.screenshot({ path: `${shots}/03-dark.png` });

// Search filter
await page.fill('input[aria-label="Search shapes"]', "actor");
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/04-search.png` });

console.log("screenshots in:", shots);
console.log("errors:", errors.length ? errors : "none");
await browser.close();
console.log("SMOKE OK");
