/* smoke.mjs — end-to-end gameplay test driven through Playwright.
 * Requires a static server on :8321 (npm run serve) and playwright-core.
 * Run: node test/smoke.mjs
 */
import { chromium } from "playwright-core";

const URL = process.env.GAME_URL || "http://localhost:8321/index.html";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium",
});

async function newGame() {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter"); // title -> intro (bow)
  await page.waitForFunction(() => window.__game.state === "play", null, { timeout: 5000 });
  return { page, errors };
}

const game = (page) => page.evaluate(() => ({
  state: window.__game.state,
  stance: window.__game.player.stance,
  px: window.__game.player.x,
  php: window.__game.player.hp,
  pstate: window.__game.player.state,
  stance: window.__game.player.stance,
  ehp: window.__game.enemies.map((e) => e.f.hp),
  estate: window.__game.enemies.map((e) => e.f.state),
}));

// ---- scenario 0: walking left turns the player around (no moonwalking) ----
{
  const { page, errors } = await newGame();
  await page.evaluate(() => { window.__game.player.x = 600; });
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(700);
  const left = await page.evaluate(() => ({
    facing: window.__game.player.facing, anim: window.__game.player.anim, x: window.__game.player.x,
  }));
  await page.keyboard.up("ArrowLeft");
  check("player turns to face left and runs", left.facing === -1 && left.anim === "run" && left.x < 600,
    `facing=${left.facing} anim=${left.anim} x=${left.x.toFixed(0)}`);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(400);
  const right = await page.evaluate(() => window.__game.player.facing);
  await page.keyboard.up("ArrowRight");
  check("player turns back to face right", right === 1, `facing=${right}`);
  check("no JS errors in scenario 0", errors.length === 0, errors.join("; "));
  await page.close();
}

// ---- scenario 1: fight the first guard to a knockout, then advance ----
{
  const { page, errors } = await newGame();
  await page.evaluate(() => { window.__game.player.x = 1440; });
  await page.keyboard.press("Space"); // fight stance
  await page.waitForTimeout(300);

  const t0 = Date.now();
  let s = await game(page);
  while (s.estate[0] !== "ko" && s.pstate !== "ko" && Date.now() - t0 < 45000) {
    const key = ["KeyJ", "KeyK", "KeyL", "KeyU", "KeyI"][(Math.random() * 5) | 0];
    await page.keyboard.press(key);
    await page.keyboard.press("ArrowRight"); // keep pressure on
    await page.waitForTimeout(160);
    s = await game(page);
  }
  check("guard can be knocked out", s.estate[0] === "ko",
    `guard hp=${s.ehp[0]} state=${s.estate[0]}, player hp=${s.php}`);
  check("hits landed both ways or guard fell fast", s.php < 12 || s.estate[0] === "ko");

  // path opens once the guard is down
  if (s.estate[0] === "ko") {
    // wait out any in-flight attack so the stance toggle registers
    await page.waitForFunction(() => !window.__game.player.busy, null, { timeout: 3000 });
    await page.keyboard.press("Space"); // back to travel stance
    await page.waitForTimeout(300);
    const guardX = await page.evaluate(() => window.__game.enemies[0].f.x);
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(2200);
    await page.keyboard.up("ArrowRight");
    const s2 = await game(page);
    check("player advances past a fallen guard", s2.px > guardX + 40,
      `x=${s2.px.toFixed(0)} guard=${guardX.toFixed(0)} stance=${s2.stance}`);
  }
  check("no JS errors in scenario 1", errors.length === 0, errors.join("; "));
  await page.screenshot({ path: "test/out-fight.png" });
  await page.close();
}

// ---- scenario 2: hit while in running stance = instant defeat ----
{
  const { page, errors } = await newGame();
  await page.evaluate(() => { window.__game.player.x = 1450; }); // in guard's face, travel stance
  await page.waitForTimeout(4000); // let the guard strike
  const s = await game(page);
  check("running-stance hit is an instant knockout", s.pstate === "ko" && s.php === 0,
    `player state=${s.pstate} hp=${s.php}`);
  await page.waitForTimeout(2000);
  const s2 = await game(page);
  check("defeat leads to game over screen", s2.state === "gameover", `state=${s2.state}`);
  check("no JS errors in scenario 2", errors.length === 0, errors.join("; "));
  await page.close();
}

// ---- scenario 3: princess endings (respectful vs. fighting stance) ----
{
  const { page, errors } = await newGame();
  await page.evaluate(() => {
    for (const e of window.__game.enemies) e.f.knockOut();
    window.__game.player.x = 6480;
  });
  await page.keyboard.down("ArrowRight"); // walk in respectfully (travel stance)
  await page.waitForTimeout(2500);
  await page.keyboard.up("ArrowRight");
  const s = await game(page);
  check("respectful approach rescues the princess", s.state === "win", `state=${s.state}`);
  await page.screenshot({ path: "test/out-win.png" });
  check("no JS errors in scenario 3", errors.length === 0, errors.join("; "));
  await page.close();
}
{
  const { page, errors } = await newGame();
  await page.evaluate(() => {
    for (const e of window.__game.enemies) e.f.knockOut();
    window.__game.player.x = 6480;
  });
  await page.keyboard.press("Space"); // fight stance
  await page.waitForTimeout(300);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(3000);
  await page.keyboard.up("ArrowRight");
  const s = await game(page);
  check("fighting-stance approach triggers the Easter egg", s.pstate === "ko", `player=${s.pstate}`);
  check("no JS errors in scenario 4", errors.length === 0, errors.join("; "));
  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
