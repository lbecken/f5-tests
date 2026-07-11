// End-to-end smoke test: drives the built app in headless Chromium.
// Usage: npm run build && npm run preview -- --port 4173 & npm run smoke
import { chromium } from "playwright-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.env.APP_URL ?? "http://localhost:4173";
const shots = process.env.SHOTS_DIR ?? mkdtempSync(join(tmpdir(), "umldraw-"));
const executablePath =
  process.env.CHROMIUM_PATH ??
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector(".excalidraw", { timeout: 20000 });
await page.waitForSelector(".stencil-card", { timeout: 20000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${shots}/01-initial.png` });

// Click-insert a Class stencil
await page.click('.stencil-card[title^="Class"]');
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

// Verify localStorage autosave captured elements
await page.waitForTimeout(1200);
const saved = await page.evaluate(() => {
  const raw = localStorage.getItem("umldraw.scene");
  if (!raw) return null;
  return JSON.parse(raw).elements.length;
});
console.log("autosaved element count:", saved);

// PNG export triggers a download
const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
await page.click('button:has-text("PNG")');
const download = await downloadPromise;
console.log("png export download:", download.suggestedFilename());

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

// 3 class compartments + 2 lifeline parts + 1 use case (+ bound label texts)
if (!saved || saved < 6) {
  console.error("FAIL: expected at least 6 autosaved elements, got", saved);
  process.exit(1);
}
console.log("SMOKE OK");
