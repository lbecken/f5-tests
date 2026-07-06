import { chromium } from 'playwright';

const out = process.env.OUT_DIR;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
page.on('console', (m) => console.log('[console]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const sections = page.locator('section.demo');
await sections.nth(0).screenshot({ path: `${out}/horizontal.png` });
await sections.nth(1).screenshot({ path: `${out}/vertical.png` });
await sections.nth(2).screenshot({ path: `${out}/overflow.png` });

// scrolled state of the overflow demo
const scroller = page.locator('section.demo').nth(2).locator('.ht-scroller');
await scroller.evaluate((el) => (el.scrollLeft = 600));
await page.waitForTimeout(400);
await sections.nth(2).locator('.ht').screenshot({ path: `${out}/overflow-scrolled.png` });

await browser.close();
console.log('done');
