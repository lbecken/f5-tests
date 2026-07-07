// game3d.js — DEFENDER 3D, the "X-wing" prototype (v2).
// Same combat loop as the 2D game — landers abduct humanoids, mutants
// hunt you, smart bombs save you — but seen from behind the ship,
// flying forever around the planet's equator. Pure canvas pseudo-3D:
// project x/z, y/z, sort by depth, draw far-to-near.
//
// Shares sprites.js, audio.js and all mp3 assets with ../defender.

'use strict';

// ---------------------------------------------------------------- constants
const VIEW_W = 480, VIEW_H = 312;
const SCAN_H = 44;
const CX = VIEW_W / 2, CY = 132;     // projection center / horizon
const FOCAL = 230;
const RING_C = 12000;                // planet circumference (world z wraps)
const LAT_LIM = 220;                 // lateral flight envelope
const ALT_MIN = 14, ALT_MAX = 175;   // altitude envelope (ground is y=0)
const FWD_SPEED = 340;               // constant forward speed
const BOOST_SPEED = 560;             // hold Shift
const DRAW_FAR = 2600;               // z clip

const START_LIVES = 3, START_BOMBS = 3, BONUS_EVERY = 10000;

// ------------------------------------------------------------------ helpers
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const wrapZ = (z) => ((z % RING_C) + RING_C) % RING_C;
const wrapDz = (a, b) => {
  let d = wrapZ(a) - wrapZ(b);
  if (d > RING_C / 2) d -= RING_C;
  if (d < -RING_C / 2) d += RING_C;
  return d;
};

// ------------------------------------------------------------------ terrain
// Height varies along the ring (rolling hills across the flight path).
// Fly low through the valleys — clip a ridge and you're debris.
const TERR_STEP = 100;
const TERR_N = RING_C / TERR_STEP;
let terr = [];

function genTerr() {
  terr = new Array(TERR_N);
  let y = rand(5, 25);
  for (let i = 0; i < TERR_N; i++) {
    terr[i] = y;
    y += rand(-13, 13);
    y = clamp(y, 0, 62);
  }
  const blend = 10;
  for (let i = 0; i < blend; i++) {
    const t = i / blend, j = TERR_N - blend + i;
    terr[j] = terr[j] * (1 - t) + terr[0] * t;
  }
}

function groundY(z) {
  z = wrapZ(z);
  const i = Math.floor(z / TERR_STEP);
  const f = (z - i * TERR_STEP) / TERR_STEP;
  return terr[i] + (terr[(i + 1) % TERR_N] - terr[i]) * f;
}

// -------------------------------------------------------------------- state
let canvas, ctx, sprites, audio;
let state = 'title';
let stateTimer = 0;
let score = 0, lives = START_LIVES, bombs = START_BOMBS, wave = 0;
let nextBonus = BONUS_EVERY;
let baiterClock = 0, landerReserve = 0;
let shake = 0, flash = 0;

const ship = {
  x: 0, y: 60, z: 0, vx: 0, vy: 0,
  roll: 0, alive: true, invuln: 0,
  fireCooldown: 0, muzzle: 1,        // alternating wingtip
  carrying: null,                    // rescued humanoid on the hull
};
const cam = { x: 0, y: 84, z: -90 };

let enemies = [];
let humanoids = [];
let bolts = [];       // player laser bolts
let ebullets = [];
let particles = [];
let popups = [];
let stars = [];
let ridge = [];       // horizon mountain silhouette

const voCooldown = { abduct: 0, mutant: 0 };
let wingCooldown = 0;                // shared cooldown for wingman chatter
let killStreak = 0, killStreakT = 0; // rapid-kill counter for "great shooting"
let watchbackT = 0;                  // periodic check for enemies behind

function wingSay(name) {
  if (wingCooldown > 0) return;
  wingCooldown = 8;
  audio.say(name);
}

// -------------------------------------------------------------------- input
const keys = {};
window.addEventListener('keydown', (e) => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  if (e.repeat) return;
  keys[e.key.toLowerCase()] = true;
  handlePress(e.key.toLowerCase());
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('pointerdown', () => { if (state === 'title') startGame(); });

function handlePress(k) {
  if (state === 'title' && (k === 'enter' || k === ' ')) { startGame(); return; }
  if (state === 'gameover' && k === 'enter') { state = 'title'; return; }
  if (k === 'm' && audio) audio.toggleMute();
  if (k === 'p' && (state === 'playing' || state === 'paused')) {
    state = state === 'paused' ? 'playing' : 'paused';
    audio.setThrust(false);
  }
  if (state !== 'playing') return;
  if (k === 'b') smartBomb();
}

// -------------------------------------------------------------------- setup
window.addEventListener('load', () => {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // rear-view X-wing added to the shared sprite sheet before baking
  SPRITE_DEFS.xwing = {
    palette: { 1: '#c0c8d8', 2: '#f07030', 3: '#40d0ff', 5: '#ffe040' },
    rows: [
      '2...................2',
      '.22...............22.',
      '..225...........522..',
      '...2255.......5522...',
      '.....22111311122.....',
      '...2255.......5522...',
      '..225...........522..',
      '.22...............22.',
      '2...................2',
    ],
  };
  sprites = bakeSprites();
  audio = new AudioMan('../defender/assets/sfx');
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  stars = Array.from({ length: 110 }, () => ({
    a: rand(0, 1), y: rand(4, CY - 24), tw: rand(0, Math.PI * 2),
  }));
  ridge = Array.from({ length: 96 }, () => rand(6, 30));
  requestAnimationFrame(frame);
});

function fitCanvas() {
  const s = Math.max(1, Math.floor(Math.min(
    window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)));
  canvas.style.width = VIEW_W * s + 'px';
  canvas.style.height = VIEW_H * s + 'px';
}

function startGame() {
  audio.init().then(() => audio.say('vo_defend'));
  score = 0; lives = START_LIVES; bombs = START_BOMBS; wave = 0;
  nextBonus = BONUS_EVERY;
  ship.x = 0; ship.y = 90; ship.z = 0; ship.vx = 0; ship.vy = 0;
  ship.carrying = null;
  genTerr();
  spawnHumanoids();
  startWave(1);
  respawnShip();
  state = 'playing';
}

function spawnHumanoids() {
  humanoids = [];
  for (let i = 0; i < 10; i++) {
    const z = wrapZ(i * RING_C / 10 + rand(-300, 300));
    humanoids.push({
      x: rand(-LAT_LIM * 0.8, LAT_LIM * 0.8),
      z, y: groundY(z), state: 'walk',
    });
  }
}

function startWave(n) {
  wave = n;
  baiterClock = 0;
  bolts = []; ebullets = [];
  enemies = [];
  landerReserve = 8 + n * 3;
  spawnLanderBatch();
  const bombers = n >= 2 ? Math.min(n, 5) : 0;
  for (let i = 0; i < bombers; i++) {
    enemies.push({
      type: 'bomber',
      x: rand(-LAT_LIM, LAT_LIM), y: rand(70, 150),
      z: wrapZ(ship.z + rand(1000, RING_C - 1000)),
      vz: rand(60, 130) * (Math.random() < 0.5 ? 1 : -1),
      vx: 0, vy: 0, t: rand(0, 9), fire: 99, mineT: rand(0.8, 1.6),
    });
  }
  const pods = n >= 3 ? Math.min(n - 2, 4) : 0;
  for (let i = 0; i < pods; i++) {
    enemies.push({
      type: 'pod',
      x: rand(-LAT_LIM, LAT_LIM), y: rand(80, 160),
      z: wrapZ(ship.z + rand(1000, RING_C - 1000)),
      vx: 0, vy: 0, t: rand(0, 9), fire: 99,
    });
  }
  spawnHumanoids();
  if (n > 1) wingSay('wing_incoming');
}

function spawnLanderBatch() {
  const batch = Math.min(landerReserve, 4 + Math.min(wave, 4));
  for (let i = 0; i < batch; i++) {
    enemies.push({
      type: 'lander', state: 'seek',
      x: rand(-LAT_LIM, LAT_LIM),
      y: rand(90, 160),
      z: wrapZ(ship.z + rand(700, RING_C - 700)),
      vx: 0, vy: 0, t: rand(0, 9), fire: rand(1, 4), target: null,
    });
    landerReserve--;
  }
}

function respawnShip() {
  ship.alive = true;
  ship.invuln = 3;
  ship.vx = 0; ship.vy = 0;
  ship.y = clamp(ship.y, 90, 140);   // safely above the tallest ridge
}

// --------------------------------------------------------------- projection
// Returns null when the point is behind the near plane.
function project(wx, wy, wz) {
  const dz = wrapDz(wz, cam.z);
  if (dz < 14 || dz > DRAW_FAR + 400) return null;
  const s = FOCAL / dz;
  return { x: CX + (wx - cam.x) * s, y: CY - (wy - cam.y) * s, s, dz };
}

// --------------------------------------------------------------- game verbs
function fire() {
  if (ship.fireCooldown > 0) return;
  ship.fireCooldown = 0.13;
  ship.muzzle = -ship.muzzle;
  // bolt leaves a wingtip and converges on the aim point ahead
  const ox = ship.x + ship.muzzle * 18, oy = ship.y - 2;
  const tx = ship.x + ship.vx * 0.35, ty = ship.y + ship.vy * 0.35;
  const dx = tx - ox, dy = ty - oy, dzz = 650;
  const d = Math.hypot(dx, dy, dzz);
  const sp = 1700;
  bolts.push({ x: ox, y: oy, z: ship.z, vx: dx / d * sp, vy: dy / d * sp, vz: dzz / d * sp, life: 1.4 });
  audio.play('shoot', { vol: 0.5, rate: rand(1.0, 1.15) });
}

function smartBomb() {
  if (bombs <= 0 || !ship.alive) return;
  bombs--;
  flash = 0.12; shake = Math.max(shake, 5);
  audio.play('smartbomb', { vol: 0.9 });
  for (const e of enemies) {
    const dz = wrapDz(e.z, cam.z);
    if (dz > 0 && dz < DRAW_FAR) killEnemy(e, true);
  }
  enemies = enemies.filter((e) => !e.dead);
}

function addScore(n, x, y, z) {
  score += n;
  if (x !== undefined) popups.push({ x, y, z, text: '' + n, life: 1.1 });
  while (score >= nextBonus) {
    lives++; bombs++;
    nextBonus += BONUS_EVERY;
    audio.play('rescue', { vol: 0.9, rate: 0.8 });
  }
}

const SCORES = { lander: 150, mutant: 150, baiter: 200, bomber: 250, pod: 1000, swarmer: 150, mine: 50 };

function killEnemy(e, silentish) {
  if (e.dead) return;
  e.dead = true;
  addScore(SCORES[e.type] || 100, e.x, e.y, e.z);
  spawnExplosion(e.x, e.y, e.z, e.type === 'pod' ? '#c040ff' : '#ffd040');
  const p = project(e.x, e.y, e.z);
  if (!silentish) {
    audio.play('explosion', {
      vol: clamp(500 / (p ? p.dz : 500), 0.15, 0.7),
      rate: rand(0.9, 1.15),
      pan: p ? clamp((p.x - CX) / CX, -1, 1) * 0.7 : 0,
    });
  }
  shake = Math.max(shake, 2);
  // a close kill sprays debris at the canopy
  if (p && p.dz < 280) {
    spawnExplosion(e.x, e.y, e.z, '#ffffff', 16, -260);
    shake = Math.max(shake, 4);
    flash = Math.max(flash, 0.04);
  }
  if (e.type === 'lander' && e.target && e.target.state === 'grabbed') {
    e.target.state = 'falling';
    e.target.fallFrom = e.target.y;
    e.target.vy = 0;
  }
  if (e.type === 'pod') {
    const n = randi(3, 4);
    for (let i = 0; i < n; i++) {
      enemies.push({
        type: 'swarmer',
        x: e.x + rand(-20, 20), y: clamp(e.y + rand(-20, 20), 10, ALT_MAX),
        z: wrapZ(e.z + rand(-30, 30)),
        vx: 0, vy: 0, t: rand(0, 9), fire: rand(1, 3),
      });
    }
    audio.play('materialize', { vol: 0.5 });
  }
  // rapid kills earn wingman praise
  killStreak++; killStreakT = 6;
  if (killStreak >= 5) { wingSay('wing_goodshot'); killStreak = 0; }
}

function killShip() {
  if (!ship.alive || ship.invuln > 0) return;
  ship.alive = false;
  if (ship.carrying) {
    ship.carrying.state = 'falling';
    ship.carrying.fallFrom = ship.carrying.y;
    ship.carrying.vy = 0;
    ship.carrying = null;
  }
  audio.setThrust(false);
  audio.play('bigboom', { vol: 1 });
  spawnExplosion(ship.x, ship.y, ship.z + 30, '#ffffff', 50);
  shake = 8; flash = 0.08;
  lives--;
  state = 'dead'; stateTimer = 2.2;
  if (lives < 0) {
    state = 'gameover'; stateTimer = 3;
    audio.say('vo_gameover');
  }
}

// ------------------------------------------------------------------ effects
function spawnExplosion(x, y, z, color, n = 22, vzBias = 0) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y, z,
      vx: rand(-160, 160), vy: rand(-160, 160), vz: rand(-160, 160) + vzBias,
      life: rand(0.3, 0.9),
      color: Math.random() < 0.4 ? '#ffffff' : color,
    });
  }
}

// ------------------------------------------------------------------- update
let lastT = 0;
function frame(t) {
  const dt = Math.min((t - lastT) / 1000 || 0, 1 / 30);
  lastT = t;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function update(dt) {
  stateTimer -= dt;
  if (shake > 0) shake = Math.max(0, shake - dt * 20);
  if (flash > 0) flash -= dt;
  voCooldown.abduct -= dt; voCooldown.mutant -= dt;
  wingCooldown -= dt; watchbackT -= dt;
  if ((killStreakT -= dt) <= 0) killStreak = 0;

  for (const p of particles) {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z = wrapZ(p.z + p.vz * dt);
    p.vx *= Math.pow(0.3, dt); p.vy *= Math.pow(0.3, dt); p.vz *= Math.pow(0.3, dt);
  }
  particles = particles.filter((p) => p.life > 0);
  for (const p of popups) { p.life -= dt; p.y += 30 * dt; }
  popups = popups.filter((p) => p.life > 0);

  if (state === 'title' || state === 'gameover' || state === 'paused') return;

  if (state === 'dead') {
    updateEnemies(dt); updateBullets(dt); updateHumanoids(dt);
    if (stateTimer <= 0 && lives >= 0) { respawnShip(); state = 'playing'; }
    return;
  }
  if (state === 'wavebreak') {
    if (stateTimer <= 0) { startWave(wave + 1); state = 'playing'; }
    return;
  }

  baiterClock += dt;
  updateShip(dt);
  updateBolts(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateHumanoids(dt);

  if (baiterClock > Math.max(14, 32 - wave * 2)) {
    baiterClock = 0;
    enemies.push({
      type: 'baiter', x: ship.x + rand(-80, 80), y: ship.y + rand(-40, 40),
      z: wrapZ(ship.z + DRAW_FAR - 200), vx: 0, vy: 0, t: 0, fire: rand(0.5, 1.5),
    });
    audio.play('baiter', { vol: 0.6 });
  }

  const landersActive = enemies.filter((e) => e.type === 'lander').length;
  if (landerReserve > 0 && landersActive <= 2) spawnLanderBatch();

  // something sneaking up from behind? the wingman notices
  if (watchbackT <= 0) {
    watchbackT = 4;
    const behind = enemies.some((e) => {
      const dz = wrapDz(e.z, ship.z);
      return dz < -60 && dz > -500 && (e.type === 'mutant' || e.type === 'baiter' || e.type === 'swarmer');
    });
    if (behind) wingSay('wing_watchback');
  }

  if (enemies.filter((e) => e.type !== 'baiter' && e.type !== 'mine').length + landerReserve === 0) {
    const saved = humanoids.filter((h) => h.state !== 'dead').length;
    const bonus = Math.min(wave, 5) * 100 * saved;
    if (bonus) addScore(bonus);
    audio.say('vo_wave');
    audio.play('rescue', { vol: 0.8 });
    enemies = []; ebullets = [];
    state = 'wavebreak'; stateTimer = 2.5;
  }
}

function updateShip(dt) {
  ship.invuln = Math.max(0, ship.invuln - dt);
  ship.fireCooldown -= dt;

  const L = keys['arrowleft'] || keys['a'], R = keys['arrowright'] || keys['d'];
  const U = keys['arrowup'] || keys['w'], D = keys['arrowdown'] || keys['s'];
  const boost = keys['shift'];

  ship.vx += ((R ? 1 : 0) - (L ? 1 : 0)) * 900 * dt;
  ship.vy += ((U ? 1 : 0) - (D ? 1 : 0)) * 800 * dt;
  if (!L && !R) ship.vx *= Math.pow(0.05, dt);
  if (!U && !D) ship.vy *= Math.pow(0.05, dt);
  ship.vx = clamp(ship.vx, -260, 260);
  ship.vy = clamp(ship.vy, -220, 220);

  ship.x = clamp(ship.x + ship.vx * dt, -LAT_LIM, LAT_LIM);
  ship.y = clamp(ship.y + ship.vy * dt, 6, ALT_MAX);
  ship.z = wrapZ(ship.z + (boost ? BOOST_SPEED : FWD_SPEED) * dt);

  // hug the valleys, respect the ridges
  if (ship.y < groundY(ship.z) + 5) { killShip(); return; }

  // ferrying a rescued humanoid: skim the ground to set it down
  if (ship.carrying) {
    ship.carrying.x = ship.x;
    ship.carrying.y = ship.y - 10;
    ship.carrying.z = ship.z;
    if (ship.y < groundY(ship.z) + 22) {
      ship.carrying.state = 'walk';
      ship.carrying.y = groundY(ship.carrying.z);
      ship.carrying = null;
      addScore(500, ship.x, ship.y, wrapZ(ship.z + 100));
      audio.play('rescue', { vol: 0.9 });
    }
  }

  // bank into the turn
  const targetRoll = clamp(-ship.vx * 0.0024, -0.5, 0.5);
  ship.roll += (targetRoll - ship.roll) * Math.min(1, dt * 8);

  audio.setThrust(!!boost);
  if (keys[' '] || keys['x']) fire();

  // chase camera eases after the ship
  cam.x += (ship.x * 0.8 - cam.x) * Math.min(1, dt * 5);
  cam.y += ((ship.y + 26) - cam.y) * Math.min(1, dt * 5);
  cam.z = wrapZ(ship.z - 90);
}

function updateBolts(dt) {
  for (const b of bolts) {
    b.life -= dt;
    b.px = b.x; b.py = b.y; b.pz = b.z;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z = wrapZ(b.z + b.vz * dt);
    for (const e of enemies) {
      if (e.dead) continue;
      const dz = wrapDz(e.z, b.z);
      if (Math.abs(dz) < 34 && Math.abs(e.x - b.x) < 24 && Math.abs(e.y - b.y) < 20) {
        killEnemy(e); b.life = 0; break;
      }
    }
    if (b.y < -20) b.life = 0;
  }
  bolts = bolts.filter((b) => b.life > 0);
  enemies = enemies.filter((e) => !e.dead);
}

function enemyFire(e) {
  const dz = wrapDz(ship.z, e.z);
  if (dz > -50 && dz < 200) return;           // don't shoot point-blank
  const lead = Math.abs(dz) / 300;
  const tx = ship.x + ship.vx * lead, ty = ship.y + ship.vy * lead;
  const dx = tx - e.x, dy = ty - e.y;
  const d = Math.hypot(dx, dy, dz) || 1;
  const sp = Math.min(300 + wave * 25, 520);
  ebullets.push({
    x: e.x, y: e.y, z: e.z,
    vx: dx / d * sp, vy: dy / d * sp, vz: dz / d * sp, life: 6,
  });
  const p = project(e.x, e.y, e.z);
  if (p) {
    audio.play('enemyshoot', {
      vol: clamp(300 / p.dz, 0.08, 0.4),
      rate: rand(0.9, 1.1),
      pan: clamp((p.x - CX) / CX, -1, 1) * 0.7,
    });
  }
}

function updateEnemies(dt) {
  for (const e of enemies) {
    e.t += dt; e.fire -= dt;
    if (e.type === 'lander') updateLander(e, dt);
    else if (e.type === 'bomber') {
      e.z = wrapZ(e.z + e.vz * dt);
      e.x += Math.sin(e.t * 0.9) * 40 * dt;
      e.y = clamp(e.y + Math.cos(e.t * 0.7) * 30 * dt, 60, 160);
      e.mineT -= dt;
      if (e.mineT < 0) {
        if (enemies.filter((m) => m.type === 'mine').length < 40) {
          enemies.push({ type: 'mine', x: e.x, y: e.y, z: e.z, vx: 0, vy: 0, t: 0, fire: 99, life: 14 });
        }
        e.mineT = rand(0.7, 1.4);
      }
    } else if (e.type === 'mine') {
      e.life -= dt;
      if (e.life <= 0) e.dead = true;
    } else if (e.type === 'pod') {
      e.x += Math.sin(e.t * 0.6) * 22 * dt;
      e.y = clamp(e.y + Math.cos(e.t * 0.8) * 26 * dt, 60, ALT_MAX);
      e.z = wrapZ(e.z + 30 * dt);
    } else if (e.type === 'swarmer') {
      const dz = wrapDz(ship.z, e.z);
      e.z = wrapZ(e.z + (Math.sign(dz) * Math.min(Math.abs(dz), (FWD_SPEED + 150) * dt)) + FWD_SPEED * dt * (Math.abs(dz) < 350 ? 1 : 0));
      e.x += (ship.x - e.x) * dt * 1.8 + Math.sin(e.t * 8) * 180 * dt;
      e.y += (ship.y - e.y) * dt * 1.8 + Math.cos(e.t * 7) * 160 * dt;
      e.y = clamp(e.y, 8, ALT_MAX + 20);
      if (e.fire < 0) { enemyFire(e); e.fire = rand(1.4, 3); }
    } else if (e.type === 'mutant') {
      // close in on the player from any direction around the ring
      const dz = wrapDz(ship.z, e.z);
      e.z = wrapZ(e.z + Math.sign(dz) * Math.min(Math.abs(dz), (FWD_SPEED + 90) * dt) + FWD_SPEED * dt * (Math.abs(dz) < 400 ? 1 : 0));
      e.x += (ship.x - e.x) * dt * 1.4 + rand(-260, 260) * dt;
      e.y += (ship.y - e.y) * dt * 1.4 + rand(-260, 260) * dt;
      e.y = clamp(e.y, 6, ALT_MAX + 20);
      if (e.fire < 0) { enemyFire(e); e.fire = rand(0.6, 1.6); }
    } else if (e.type === 'baiter') {
      const dz = wrapDz(ship.z, e.z);
      e.z = wrapZ(e.z + (FWD_SPEED + clamp(dz * 0.8, -160, 160)) * dt);
      e.x += (ship.x - e.x) * dt * 2;
      e.y += (ship.y - e.y) * dt * 2;
      if (e.fire < 0) { enemyFire(e); e.fire = rand(0.4, 1.2); }
    }
    // ramming the player
    const dz = wrapDz(e.z, ship.z);
    if (ship.alive && ship.invuln <= 0 &&
        Math.abs(dz) < 26 && Math.abs(e.x - ship.x) < 20 && Math.abs(e.y - ship.y) < 14) {
      killEnemy(e); killShip();
    }
    // near miss: doppler whoosh as something streaks past the canopy
    if (e.prevDz !== undefined && e.prevDz > 0 && dz <= 0 &&
        Math.abs(e.x - ship.x) < 130 && Math.abs(e.y - ship.y) < 90) {
      const prox = Math.max(Math.abs(e.x - ship.x), Math.abs(e.y - ship.y));
      audio.play('flyby', {
        vol: clamp(1 - prox / 130, 0.15, 0.8),
        rate: rand(0.9, 1.25),
        pan: clamp((e.x - ship.x) / 60, -1, 1) * 0.8,
      });
    }
    e.prevDz = dz;
  }
  enemies = enemies.filter((e) => !e.dead);
}

function updateLander(e, dt) {
  if (e.state === 'seek') {
    e.x += Math.sin(e.t * 0.8) * 30 * dt;
    e.z = wrapZ(e.z + 40 * dt);
    if (Math.random() < dt * 0.7) {
      let best = null, bd = 500;
      for (const h of humanoids) {
        if (h.state !== 'walk') continue;
        const d = Math.abs(wrapDz(h.z, e.z)) + Math.abs(h.x - e.x);
        if (d < bd) { bd = d; best = h; }
      }
      if (best) { e.target = best; e.state = 'descend'; }
    }
  } else if (e.state === 'descend') {
    if (!e.target || e.target.state !== 'walk') { e.state = 'seek'; e.target = null; return; }
    e.x += (e.target.x - e.x) * dt * 2;
    e.z = wrapZ(e.z + wrapDz(e.target.z, e.z) * dt * 2);
    e.y -= 40 * dt;
    if (e.y <= groundY(e.z) + 10) {
      e.y = groundY(e.z) + 10;
      e.state = 'lift';
      e.target.state = 'grabbed';
      const p = project(e.x, e.y, e.z);
      audio.play('abduct', { vol: 0.7, pan: p ? clamp((p.x - CX) / CX, -1, 1) * 0.7 : 0 });
      if (voCooldown.abduct <= 0) { audio.say('vo_abduct'); voCooldown.abduct = 12; }
      else wingSay('wing_humanoids');
    }
  } else if (e.state === 'lift') {
    if (!e.target || e.target.state !== 'grabbed') { e.state = 'seek'; e.target = null; return; }
    e.y += 26 * dt;
    e.target.y = e.y - 8; e.target.x = e.x; e.target.z = e.z;
    if (e.y >= ALT_MAX) {
      e.target.state = 'dead';
      e.target = null;
      e.type = 'mutant';
      audio.play('mutant', { vol: 0.8 });
      if (voCooldown.mutant <= 0) { audio.say('vo_mutant'); voCooldown.mutant = 18; }
    }
  }
  if (e.fire < 0) { enemyFire(e); e.fire = rand(1.5, 3.5); }
}

function updateBullets(dt) {
  for (const b of ebullets) {
    b.life -= dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z = wrapZ(b.z + b.vz * dt);
    if (b.y < 0) b.life = 0;
    const dz = wrapDz(b.z, ship.z);
    if (ship.alive && ship.invuln <= 0 &&
        Math.abs(dz) < 18 && Math.abs(b.x - ship.x) < 16 && Math.abs(b.y - ship.y) < 11) {
      b.life = 0;
      killShip();
    }
  }
  ebullets = ebullets.filter((b) => b.life > 0);
}

function updateHumanoids(dt) {
  for (const h of humanoids) {
    if (h.state === 'walk') {
      h.z = wrapZ(h.z + Math.sin(lastT / 900 + h.x) * 6 * dt);
      h.y = groundY(h.z);
    } else if (h.state === 'falling') {
      h.vy = clamp((h.vy || 0) - 160 * dt, -110, 0);
      h.y += h.vy * dt;
      // dive under a falling humanoid to scoop it onto the hull
      if (ship.alive && !ship.carrying &&
          Math.abs(wrapDz(h.z, ship.z)) < 34 &&
          Math.abs(h.x - ship.x) < 24 && Math.abs(h.y - ship.y) < 18) {
        h.state = 'carried';
        ship.carrying = h;
        addScore(500, h.x, h.y, h.z);
        audio.play('rescue', { vol: 0.9 });
        wingSay('wing_nicecatch');
        continue;
      }
      const g = groundY(h.z);
      if (h.y <= g) {
        h.y = g;
        if ((h.fallFrom || 0) - g > 70) {
          h.state = 'dead';
          spawnExplosion(h.x, h.y, h.z, '#d0a0ff', 10);
          audio.play('humandie', { vol: 0.6 });
        } else {
          h.state = 'walk';
          addScore(250, h.x, h.y + 10, h.z);
          audio.play('rescue', { vol: 0.6 });
        }
      }
    }
  }
}

// ------------------------------------------------------------------- render
function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (state === 'title') { drawTitle(); return; }

  ctx.save();
  if (shake > 0) ctx.translate(randi(-shake, shake) / 2, randi(-shake, shake) / 2);
  // bank: tilt the whole world opposite the ship's roll
  ctx.translate(CX, CY); ctx.rotate(ship.roll * 0.5); ctx.translate(-CX, -CY);

  drawStars();
  drawRidge();
  drawGround();
  drawWorldObjects();
  ctx.restore();

  drawShipAndCrosshair();
  drawScanner();
  drawHUD();

  if (state === 'wavebreak') {
    centerText(`WAVE ${wave} CLEARED`, 150, '#40ff40', 16);
  }
  if (state === 'gameover') {
    centerText('GAME OVER', 150, '#ff4040', 20);
    centerText('PRESS ENTER', 178, '#808080', 8);
  }
  if (state === 'paused') centerText('PAUSED', 150, '#ffffff', 16);

  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, flash * 6)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawStars() {
  const t = lastT / 1000;
  for (const s of stars) {
    // stars drift opposite the turn for cheap parallax
    const x = ((s.a * VIEW_W - cam.x * 0.25) % VIEW_W + VIEW_W) % VIEW_W;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 2 + s.tw));
    ctx.fillStyle = `rgba(255,255,255,${tw})`;
    ctx.fillRect(Math.round(x), Math.round(s.y), 1, 1);
  }
}

function drawRidge() {
  // far mountain silhouette, slow parallax with forward motion
  ctx.fillStyle = '#3a1804';
  ctx.beginPath();
  ctx.moveTo(0, CY + 1);
  const n = ridge.length;
  for (let i = 0; i <= 48; i++) {
    const idx = (Math.floor(cam.z / 40) + i + n) % n;
    ctx.lineTo(i * 10, CY + 1 - ridge[idx]);
  }
  ctx.lineTo(VIEW_W, CY + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e06010';
  ctx.fillRect(0, CY, VIEW_W, 1);      // horizon line
}

function drawGround() {
  // cross lines ride the heightfield as they sweep toward the camera
  ctx.strokeStyle = '#7a3008';
  ctx.lineWidth = 1;
  const first = Math.ceil((cam.z + 16) / TERR_STEP) * TERR_STEP;
  for (let k = 0; k < 26; k++) {
    const z = first + k * TERR_STEP;
    const y = groundY(z);
    const a = project(-900 + cam.x, y, z), b = project(900 + cam.x, y, z);
    if (!a || !b) continue;
    ctx.globalAlpha = clamp(1.4 - a.dz / DRAW_FAR, 0.08, 0.8);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // longitudinal rails: polylines following the terrain profile
  ctx.globalAlpha = 0.35;
  for (let x = -600; x <= 600; x += 120) {
    ctx.beginPath();
    let started = false;
    for (let z = cam.z + 40; z <= cam.z + DRAW_FAR; z += TERR_STEP) {
      const p = project(x, groundY(z), z);
      if (!p) continue;
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawWorldObjects() {
  // gather everything with a depth, draw far-to-near
  const items = [];
  for (const h of humanoids) {
    if (h.state === 'dead') continue;
    items.push({ z: wrapDz(h.z, cam.z), kind: 'humanoid', o: h });
  }
  for (const e of enemies) items.push({ z: wrapDz(e.z, cam.z), kind: 'enemy', o: e });
  for (const b of ebullets) items.push({ z: wrapDz(b.z, cam.z), kind: 'ebullet', o: b });
  for (const b of bolts) items.push({ z: wrapDz(b.z, cam.z), kind: 'bolt', o: b });
  for (const p of particles) items.push({ z: wrapDz(p.z, cam.z), kind: 'particle', o: p });
  for (const p of popups) items.push({ z: wrapDz(p.z || cam.z + 300, cam.z), kind: 'popup', o: p });
  items.sort((a, b) => b.z - a.z);

  for (const it of items) {
    const o = it.o;
    switch (it.kind) {
      case 'humanoid': {
        const p = project(o.x, o.y + 4, o.z);
        if (!p) break;
        const img = sprites.humanoid;
        const s = Math.max(p.s * 3.2, 0.4);
        ctx.drawImage(img, p.x - img.width * s / 2, p.y - img.height * s / 2, img.width * s, img.height * s);
        break;
      }
      case 'enemy': {
        const p = project(o.x, o.y, o.z);
        if (!p) break;
        const img = sprites[o.type];
        const s = clamp(p.s * 4.5, 0.3, 6);
        ctx.drawImage(img, p.x - img.width * s / 2, p.y - img.height * s / 2, img.width * s, img.height * s);
        break;
      }
      case 'ebullet': {
        const p = project(o.x, o.y, o.z);
        if (!p) break;
        const r = clamp(p.s * 6, 1, 5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(p.x - r / 2, p.y - r / 2, r, r);
        break;
      }
      case 'bolt': {
        const p1 = project(o.px, o.py, o.pz), p2 = project(o.x, o.y, o.z);
        if (!p1 || !p2) break;
        ctx.strokeStyle = '#40ff40';
        ctx.lineWidth = clamp(p2.s * 5, 1, 3);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        break;
      }
      case 'particle': {
        const p = project(o.x, o.y, o.z);
        if (!p) break;
        ctx.globalAlpha = clamp(o.life * 2.5, 0, 1);
        ctx.fillStyle = o.color;
        const r = clamp(p.s * 4, 1, 3);
        ctx.fillRect(p.x, p.y, r, r);
        ctx.globalAlpha = 1;
        break;
      }
      case 'popup': {
        const p = project(o.x, o.y, o.z);
        if (!p) break;
        ctx.globalAlpha = clamp(o.life, 0, 1);
        ctx.font = '7px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(o.text, p.x, p.y);
        ctx.globalAlpha = 1;
        break;
      }
    }
  }
}

function drawShipAndCrosshair() {
  // crosshair floats where the bolts converge
  const aim = project(ship.x + ship.vx * 0.35, ship.y + ship.vy * 0.35, wrapZ(ship.z + 650));
  if (aim && ship.alive) {
    ctx.strokeStyle = 'rgba(64,255,64,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(aim.x - 6, aim.y); ctx.lineTo(aim.x - 2, aim.y);
    ctx.moveTo(aim.x + 2, aim.y); ctx.lineTo(aim.x + 6, aim.y);
    ctx.moveTo(aim.x, aim.y - 6); ctx.lineTo(aim.x, aim.y - 2);
    ctx.moveTo(aim.x, aim.y + 2); ctx.lineTo(aim.x, aim.y + 6);
    ctx.stroke();
  }

  if (!ship.alive) return;
  if (ship.invuln > 0 && Math.floor(lastT / 60) % 2 === 0) return;
  const p = project(ship.x, ship.y, ship.z);
  if (!p) return;
  const img = sprites.xwing;
  const s = 2;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(ship.roll);
  ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s);
  // engine glow
  ctx.fillStyle = keys['shift'] ? '#80ffff' : '#ff8030';
  const fw = keys['shift'] ? 3 : 2;
  ctx.fillRect(-7, img.height - 3, fw, fw);
  ctx.fillRect(5, img.height - 3, fw, fw);
  ctx.restore();
}

function drawScanner() {
  const w = VIEW_W - 120, h = SCAN_H - 8, ox = 116, oy = 4;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(ox, oy, w, h);
  ctx.strokeStyle = '#3040a0';
  ctx.strokeRect(ox - 0.5, oy - 0.5, w + 1, h + 1);

  // the ring flattened into a strip, player centered
  const mapX = (z) => ox + Math.round((wrapDz(z, ship.z) / RING_C + 0.5) * w);
  const mapY = (y) => oy + h - 2 - Math.round((y / (ALT_MAX + 20)) * (h - 4));

  for (const hm of humanoids) {
    if (hm.state === 'dead') continue;
    ctx.fillStyle = '#d0a0ff';
    ctx.fillRect(mapX(hm.z), mapY(hm.y), 1, 1);
  }
  const dotColor = { lander: '#30e030', mutant: '#ff40ff', baiter: '#c0ff20', bomber: '#6080ff', pod: '#c040ff', swarmer: '#ff8020', mine: '#ff4040' };
  for (const e of enemies) {
    ctx.fillStyle = dotColor[e.type] || '#fff';
    const d = e.type === 'mine' ? 1 : 2;
    ctx.fillRect(mapX(e.z), mapY(e.y), d, d);
  }
  if (ship.alive && Math.floor(lastT / 120) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + w / 2 - 1, mapY(ship.y) - 1, 3, 3);
  }
  // visible-range brackets
  const vr = (DRAW_FAR / RING_C) * w;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(ox + w / 2 + vr, oy); ctx.lineTo(ox + w / 2 + vr, oy + 4);
  ctx.moveTo(ox + w / 2 + vr, oy + h); ctx.lineTo(ox + w / 2 + vr, oy + h - 4);
  ctx.stroke();
}

function drawHUD() {
  ctx.textAlign = 'left';
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.fillStyle = '#ff4040';
  ctx.fillText(String(score).padStart(7, '0'), 6, 14);
  ctx.font = '7px "Courier New", monospace';
  ctx.fillStyle = '#808080';
  ctx.fillText(`WAVE ${wave}`, 6, 24);
  for (let i = 0; i < Math.min(lives, 5); i++) drawMiniShip(14 + i * 20, 32);
  ctx.fillStyle = '#40d0ff';
  for (let i = 0; i < Math.min(bombs, 8); i++) ctx.fillRect(6 + i * 6, 40, 4, 4);
}

function drawMiniShip(x, y) {
  const img = sprites.xwing;
  ctx.drawImage(img, x - img.width / 2, y - img.height / 2);
}

function centerText(text, y, color, size) {
  ctx.font = `bold ${size}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, VIEW_W / 2, y);
}

function drawTitle() {
  const t = lastT / 1000;
  drawStars();
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px "Courier New", monospace';
  ctx.fillStyle = `hsl(${(t * 60) % 360}, 90%, 60%)`;
  ctx.fillText('DEFENDER 3D', VIEW_W / 2, 105);
  centerText('TRENCH RUN PROTOTYPE', 123, '#808080', 9);
  if (Math.floor(t * 2) % 2 === 0) centerText('PRESS ENTER TO LAUNCH', 170, '#ffffff', 11);
  centerText('←→↑↓ FLY   SPACE FIRE   SHIFT BOOST', 210, '#40d0ff', 8);
  centerText('B SMART BOMB   P PAUSE   M MUTE', 223, '#40d0ff', 8);
  centerText('THE HUMANOIDS STILL NEED YOU', 250, '#d0a0ff', 8);
  // marquee: x-wing sweeping in from the horizon
  const zz = 1400 - (t * 300) % 1400;
  const s = clamp(FOCAL / (zz + 60) * 8, 0.5, 5);
  const img = sprites && sprites.xwing;
  if (img) ctx.drawImage(img, CX - img.width * s / 2 + Math.sin(t) * 60, 60 - img.height * s / 2, img.width * s, img.height * s);
}
