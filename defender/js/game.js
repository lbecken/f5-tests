// game.js — DEFENDER, web edition.
// A fast horizontal-scrolling shooter in the spirit of Williams'
// Defender (1981) / Stargate. Wrapping world, abducting landers,
// mutants, a scanner, smart bombs — the whole loop.

'use strict';

// ---------------------------------------------------------------- constants
const VIEW_W = 480;            // internal (low) resolution
const VIEW_H = 312;
const SCAN_H = 44;             // scanner strip at top of screen
const PLAY_TOP = SCAN_H + 4;   // playfield vertical bounds
const PLAY_BOT = VIEW_H - 6;
const WORLD_W = VIEW_W * 8;    // world wraps: 8 screens wide

const SHIP_ACCEL = 900;        // px/s^2 while thrusting
const SHIP_DRAG = 0.45;        // per-second horizontal velocity decay
const SHIP_MAX_VX = 520;       // this game is meant to be FAST
const SHIP_VY = 250;           // vertical move speed
const LASER_SPEED = 1600;
const LASER_LIFE = 0.42;
const FIRE_INTERVAL = 0.11;

const START_LIVES = 3;
const START_BOMBS = 3;
const BONUS_EVERY = 10000;     // extra life + smart bomb per 10k points

// ------------------------------------------------------------------ helpers
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const wrapX = (x) => ((x % WORLD_W) + WORLD_W) % WORLD_W;
// shortest signed distance from b to a in the wrapping world
const wrapDx = (a, b) => {
  let d = wrapX(a) - wrapX(b);
  if (d > WORLD_W / 2) d -= WORLD_W;
  if (d < -WORLD_W / 2) d += WORLD_W;
  return d;
};

// ------------------------------------------------------------------ terrain
// Jagged mountain skyline: a random walk over fixed-interval posts,
// eased back to its start so the wrap seam is invisible.
const TERRAIN_STEP = 16;
const TERRAIN_N = WORLD_W / TERRAIN_STEP;
let terrain = [];

function genTerrain() {
  terrain = new Array(TERRAIN_N);
  let y = rand(240, 270);
  for (let i = 0; i < TERRAIN_N; i++) {
    terrain[i] = y;
    y += rand(-22, 22);
    y = clamp(y, 190, PLAY_BOT - 8);
  }
  // blend the last quarter-screen back to terrain[0] for seamless wrap
  const blend = 24;
  for (let i = 0; i < blend; i++) {
    const t = i / blend;
    const j = TERRAIN_N - blend + i;
    terrain[j] = terrain[j] * (1 - t) + terrain[0] * t;
  }
}

function terrainY(x) {
  x = wrapX(x);
  const i = Math.floor(x / TERRAIN_STEP);
  const f = (x - i * TERRAIN_STEP) / TERRAIN_STEP;
  const a = terrain[i], b = terrain[(i + 1) % TERRAIN_N];
  return a + (b - a) * f;
}

// -------------------------------------------------------------------- state
let canvas, ctx, sprites, audio;
let state = 'title';        // title | playing | wavebreak | dead | gameover
let stateTimer = 0;
let score = 0, lives = START_LIVES, bombs = START_BOMBS, wave = 0;
let nextBonus = BONUS_EVERY;
let waveTime = 0, baiterClock = 0;
let planetAlive = true;     // false once every humanoid is lost
let shake = 0, flash = 0;

const ship = {
  x: 0, y: 0, vx: 0, vy: 0, facing: 1,
  alive: true, invuln: 0, fireCooldown: 0,
  carrying: null,           // humanoid being ferried to the ground
};
let camX = 0;

let lasers = [];            // player shots
let ebullets = [];          // enemy shots
let enemies = [];           // landers, mutants, bombers, pods, swarmers, baiters
let humanoids = [];
let particles = [];
let popups = [];            // floating score text
let stars = [];
let landerReserve = 0;      // landers not yet materialized this wave

const voCooldown = { abduct: 0, mutant: 0 };

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
  if (k === 'b' || k === 'shift') smartBomb();
  if (k === 'h') hyperspace();
}

// -------------------------------------------------------------------- setup
window.addEventListener('load', () => {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  sprites = bakeSprites();
  audio = new AudioMan();
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  genTerrain();
  stars = Array.from({ length: 140 }, () => ({
    x: rand(0, WORLD_W), y: rand(PLAY_TOP, 230), tw: rand(0, Math.PI * 2),
  }));
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
  genTerrain();
  spawnHumanoids();
  startWave(1);
  respawnShip(true);
  state = 'playing';
}

function spawnHumanoids() {
  humanoids = [];
  for (let i = 0; i < 10; i++) {
    const x = wrapX(i * WORLD_W / 10 + rand(-120, 120));
    humanoids.push({ x, y: terrainY(x) - 4, state: 'walk', dir: Math.random() < 0.5 ? -1 : 1, fallFrom: 0 });
  }
  planetAlive = true;
}

function startWave(n) {
  wave = n;
  waveTime = 0; baiterClock = 0;
  lasers = []; ebullets = [];
  enemies = enemies.filter((e) => false);
  landerReserve = Math.min(15 + (n - 1) * 3, 30);
  spawnLanderBatch();
  const bombers = n >= 2 ? Math.min(1 + n, 6) : 0;
  for (let i = 0; i < bombers; i++) spawnEnemy('bomber');
  const pods = n >= 3 ? Math.min(n - 2, 4) : 0;
  for (let i = 0; i < pods; i++) spawnEnemy('pod');
  if (!planetAlive) spawnHumanoids(); // fresh planet each wave
}

function spawnLanderBatch() {
  const batch = Math.min(landerReserve, 5 + Math.min(wave, 5));
  for (let i = 0; i < batch; i++) {
    spawnEnemy('lander');
    landerReserve--;
  }
}

function spawnEnemy(type, x, y) {
  const e = {
    type,
    x: x !== undefined ? x : wrapX(ship.x + rand(0.25, 0.75) * WORLD_W * (Math.random() < 0.5 ? 1 : -1)),
    y: y !== undefined ? y : rand(PLAY_TOP + 12, 170),
    vx: 0, vy: 0, t: rand(0, 10), fire: rand(0.5, 3),
    target: null, state: 'seek', hp: 1,
  };
  if (type === 'bomber') { e.vx = rand(30, 60) * (Math.random() < 0.5 ? 1 : -1); e.vy = rand(-20, 20); e.mineT = rand(0.6, 1.4); }
  if (type === 'baiter') { e.x = wrapX(ship.x + (Math.random() < 0.5 ? -1 : 1) * (VIEW_W / 2 + 30)); e.y = ship.y; }
  if (type === 'swarmer') { e.fire = rand(1, 3); }
  enemies.push(e);
  spawnSparkle(e.x, e.y, '#80ffff');
  if (onScreen(e.x)) audio.play('materialize', { vol: 0.5, pan: panOf(e.x) });
  return e;
}

const onScreen = (x, m = 40) => Math.abs(wrapDx(x, camX)) < VIEW_W / 2 + m;
const panOf = (x) => clamp(wrapDx(x, camX) / (VIEW_W / 2), -1, 1) * 0.7;

// --------------------------------------------------------------- game verbs
function fire() {
  if (ship.fireCooldown > 0) return;
  ship.fireCooldown = FIRE_INTERVAL;
  lasers.push({
    x: wrapX(ship.x + ship.facing * 10), y: ship.y,
    dir: ship.facing, life: LASER_LIFE, len: 8,
  });
  audio.play('shoot', { vol: 0.55, rate: rand(0.95, 1.1) });
}

function smartBomb() {
  if (bombs <= 0 || !ship.alive) return;
  bombs--;
  flash = 0.12; shake = Math.max(shake, 5);
  audio.play('smartbomb', { vol: 0.9 });
  for (const e of enemies) {
    if (onScreen(e.x, 10)) killEnemy(e, true);
  }
  enemies = enemies.filter((e) => !e.dead);
}

function hyperspace() {
  if (!ship.alive) return;
  audio.play('hyperspace', { vol: 0.8 });
  spawnSparkle(ship.x, ship.y, '#ffffff');
  dropCarried();
  ship.x = rand(0, WORLD_W);
  ship.y = rand(PLAY_TOP + 20, 240);
  ship.vx = 0; ship.vy = 0;
  camX = ship.x;
  if (Math.random() < 0.125) { killShip(); }   // the classic gamble
  else ship.invuln = Math.max(ship.invuln, 1);
}

function addScore(n, x, y) {
  score += n;
  if (x !== undefined) popups.push({ x, y, text: '' + n, life: 1 });
  while (score >= nextBonus) {
    lives++; bombs++;
    nextBonus += BONUS_EVERY;
    audio.play('rescue', { vol: 0.9, rate: 0.8 });
    popups.push({ x: ship.x, y: ship.y - 14, text: 'BONUS SHIP', life: 1.6 });
  }
}

const SCORES = { lander: 150, mutant: 150, bomber: 250, pod: 1000, swarmer: 150, baiter: 200, mine: 50 };

function killEnemy(e, silentish) {
  if (e.dead) return;
  e.dead = true;
  addScore(SCORES[e.type] || 100, e.x, e.y);
  spawnExplosion(e.x, e.y, e.type === 'pod' ? '#c040ff' : '#ffd040');
  if (!silentish) audio.play('explosion', { vol: 0.6, rate: rand(0.9, 1.15), pan: panOf(e.x) });
  shake = Math.max(shake, 2);
  // a shot lander drops its humanoid; a shot pod bursts into swarmers
  if (e.type === 'lander' && e.target && e.target.state === 'grabbed') {
    e.target.state = 'falling';
    e.target.fallFrom = e.target.y;
    e.target.vy = 0;
  }
  if (e.type === 'pod') {
    const n = randi(3, 5);
    for (let i = 0; i < n; i++) {
      const s = spawnEnemy('swarmer', wrapX(e.x + rand(-8, 8)), e.y + rand(-8, 8));
      s.vx = rand(-120, 120); s.vy = rand(-80, 80);
    }
  }
}

function killShip() {
  if (!ship.alive || ship.invuln > 0) return;
  ship.alive = false;
  dropCarried();
  audio.setThrust(false);
  audio.play('bigboom', { vol: 1 });
  spawnExplosion(ship.x, ship.y, '#ffffff', 60);
  shake = 8; flash = 0.08;
  lives--;
  state = 'dead'; stateTimer = 2.2;
  if (lives < 0) {
    state = 'gameover'; stateTimer = 3;
    audio.say('vo_gameover');
  }
}

function dropCarried() {
  if (ship.carrying) {
    ship.carrying.state = 'falling';
    ship.carrying.fallFrom = ship.carrying.y;
    ship.carrying.vy = 0;
    ship.carrying = null;
  }
}

function respawnShip(fresh) {
  ship.alive = true;
  ship.invuln = 3;
  ship.vx = 0; ship.vy = 0; ship.facing = 1;
  if (fresh) ship.x = WORLD_W / 2;
  ship.y = 150;
  camX = ship.x;
}

// ------------------------------------------------------------------ effects
function spawnExplosion(x, y, color, n = 26) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(40, 260);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.3, 0.9), color: Math.random() < 0.4 ? '#ffffff' : color,
      size: Math.random() < 0.3 ? 2 : 1,
    });
  }
}

function spawnSparkle(x, y, color) {
  for (let i = 0; i < 14; i++) {
    particles.push({
      x: wrapX(x + rand(-10, 10)), y: y + rand(-10, 10),
      vx: 0, vy: 0, life: rand(0.15, 0.5), color, size: 1,
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

  updateParticles(dt);
  for (const p of popups) { p.life -= dt; p.y -= 12 * dt; }
  popups = popups.filter((p) => p.life > 0);

  if (state === 'title' || state === 'gameover' || state === 'paused') return;

  if (state === 'dead') {
    updateEnemies(dt); updateBullets(dt); updateHumanoids(dt);
    if (stateTimer <= 0 && lives >= 0) { respawnShip(false); state = 'playing'; }
    return;
  }

  if (state === 'wavebreak') {
    if (stateTimer <= 0) { startWave(wave + 1); state = 'playing'; }
    return;
  }

  waveTime += dt; baiterClock += dt;
  updateShip(dt);
  updateLasers(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateHumanoids(dt);

  // Dawdle and the baiters come for you — just like the arcade.
  if (baiterClock > Math.max(12, 30 - wave * 2)) {
    baiterClock = 0;
    spawnEnemy('baiter');
    audio.play('baiter', { vol: 0.6 });
  }

  // trickle in the remaining landers of this wave
  const landersActive = enemies.filter((e) => e.type === 'lander').length;
  if (landerReserve > 0 && landersActive <= 3) spawnLanderBatch();

  // wave over when everything that counts is destroyed
  const remaining = enemies.filter((e) => e.type !== 'baiter').length + landerReserve;
  if (remaining === 0) {
    const saved = humanoids.filter((h) => h.state !== 'dead').length;
    const bonus = Math.min(wave, 5) * 100 * saved;
    if (bonus) addScore(bonus, ship.x, ship.y - 20);
    audio.say('vo_wave');
    audio.play('rescue', { vol: 0.8 });
    enemies = [];        // baiters don't survive the wave break
    ebullets = [];
    state = 'wavebreak'; stateTimer = 2.5;
  }
}

function updateShip(dt) {
  ship.invuln = Math.max(0, ship.invuln - dt);
  ship.fireCooldown -= dt;

  const left = keys['arrowleft'] || keys['a'];
  const right = keys['arrowright'] || keys['d'];
  const up = keys['arrowup'] || keys['w'];
  const down = keys['arrowdown'] || keys['s'];

  let thrusting = false;
  if (left) { ship.facing = -1; ship.vx -= SHIP_ACCEL * dt; thrusting = true; }
  if (right) { ship.facing = 1; ship.vx += SHIP_ACCEL * dt; thrusting = true; }
  if (!left && !right) ship.vx *= Math.pow(SHIP_DRAG, dt);
  ship.vx = clamp(ship.vx, -SHIP_MAX_VX, SHIP_MAX_VX);
  audio.setThrust(thrusting);

  ship.vy = (down ? SHIP_VY : 0) - (up ? SHIP_VY : 0);
  ship.x = wrapX(ship.x + ship.vx * dt);
  ship.y = clamp(ship.y + ship.vy * dt, PLAY_TOP + 6, PLAY_BOT - 4);

  if (keys[' '] || keys['x']) fire();

  // camera leads the ship so you can see what you're flying into
  const lead = ship.facing * 110 + ship.vx * 0.22;
  const targetCam = wrapX(ship.x + lead);
  camX = wrapX(camX + wrapDx(targetCam, camX) * Math.min(1, dt * 5));

  // ferry a caught humanoid: touch down gently to release
  if (ship.carrying) {
    ship.carrying.x = ship.x;
    ship.carrying.y = ship.y + 8;
    const ground = terrainY(ship.x);
    if (ship.y + 12 >= ground - 4 && planetAlive) {
      ship.carrying.state = 'walk';
      ship.carrying.y = ground - 4;
      ship.carrying = null;
      addScore(500, ship.x, ship.y - 10);
      audio.play('rescue', { vol: 0.9 });
    }
  }

  // terrain is deadly if you plow into it
  if (ship.y + 3 >= terrainY(ship.x) && planetAlive) killShip();
}

function updateLasers(dt) {
  for (const l of lasers) {
    l.life -= dt;
    l.x = wrapX(l.x + l.dir * LASER_SPEED * dt);
    l.len = Math.min(l.len + LASER_SPEED * dt * 0.5, 130);
    // sample a few points along the beam for hits
    for (const e of enemies) {
      if (e.dead) continue;
      for (let s = 0; s < 4; s++) {
        const px = wrapX(l.x - l.dir * (l.len * s / 4));
        if (Math.abs(wrapDx(e.x, px)) < 7 && Math.abs(e.y - l.y) < 6) {
          killEnemy(e); l.life = 0; break;
        }
      }
      if (l.life <= 0) break;
    }
  }
  lasers = lasers.filter((l) => l.life > 0);
  enemies = enemies.filter((e) => !e.dead);
}

function enemyFire(e, speed) {
  const dx = wrapDx(ship.x, e.x), dy = ship.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const wob = rand(-0.25, 0.25);
  const vx = (dx / d) * speed, vy = (dy / d) * speed;
  ebullets.push({
    x: e.x, y: e.y,
    vx: vx * Math.cos(wob) - vy * Math.sin(wob),
    vy: vx * Math.sin(wob) + vy * Math.cos(wob),
    life: 3.2,
  });
}

function updateEnemies(dt) {
  const bulletSpeed = Math.min(160 + wave * 18, 320);
  for (const e of enemies) {
    e.t += dt;
    e.fire -= dt;
    switch (e.type) {
      case 'lander': updateLander(e, dt); break;
      case 'mutant': {
        // frenzied homing with jitter — the scariest thing in the game
        const dx = wrapDx(ship.x, e.x), dy = ship.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = 130 + wave * 8;
        e.vx += ((dx / d) * sp - e.vx) * dt * 3 + rand(-400, 400) * dt;
        e.vy += ((dy / d) * sp - e.vy) * dt * 3 + rand(-400, 400) * dt;
        e.x = wrapX(e.x + e.vx * dt);
        e.y = clamp(e.y + e.vy * dt, PLAY_TOP + 6, PLAY_BOT - 20);
        if (e.fire < 0 && onScreen(e.x)) { enemyFire(e, bulletSpeed); e.fire = rand(0.5, 1.6); }
        break;
      }
      case 'bomber': {
        e.x = wrapX(e.x + e.vx * dt);
        e.y += e.vy * dt;
        if (e.y < PLAY_TOP + 15 || e.y > 200) e.vy = -e.vy;
        e.mineT -= dt;
        if (e.mineT < 0 && onScreen(e.x)) {
          enemies.push({ type: 'mine', x: e.x, y: e.y, vx: 0, vy: 0, t: 0, fire: 99, life: 8 });
          e.mineT = rand(0.5, 1.1);
        }
        break;
      }
      case 'mine': {
        e.life -= dt;
        if (e.life <= 0) e.dead = true;
        break;
      }
      case 'pod': {
        e.x = wrapX(e.x + Math.cos(e.t * 0.7) * 25 * dt);
        e.y = clamp(e.y + Math.sin(e.t * 0.9) * 30 * dt, PLAY_TOP + 12, 200);
        break;
      }
      case 'swarmer': {
        const dx = wrapDx(ship.x, e.x), dy = ship.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = 190 + wave * 6;
        e.vx += ((dx / d) * sp - e.vx) * dt * 2.2;
        e.vy += ((dy / d) * sp - e.vy) * dt * 2.2 + Math.sin(e.t * 9) * 260 * dt;
        e.x = wrapX(e.x + e.vx * dt);
        e.y = clamp(e.y + e.vy * dt, PLAY_TOP + 6, PLAY_BOT - 10);
        if (e.fire < 0 && onScreen(e.x)) { enemyFire(e, bulletSpeed * 0.9); e.fire = rand(1.2, 2.6); }
        break;
      }
      case 'baiter': {
        // faster than you. always.
        const dx = wrapDx(ship.x, e.x), dy = ship.y - e.y;
        e.vx += Math.sign(dx) * 420 * dt;
        e.vx = clamp(e.vx, -(SHIP_MAX_VX + 60), SHIP_MAX_VX + 60);
        e.vy = clamp(dy * 2, -140, 140);
        e.x = wrapX(e.x + e.vx * dt);
        e.y = clamp(e.y + e.vy * dt, PLAY_TOP + 6, PLAY_BOT - 20);
        if (e.fire < 0) { enemyFire(e, bulletSpeed * 1.15); e.fire = rand(0.4, 1.1); }
        break;
      }
    }

    // contact with the ship is fatal (for the ship)
    if (ship.alive && ship.invuln <= 0 &&
        Math.abs(wrapDx(e.x, ship.x)) < 8 && Math.abs(e.y - ship.y) < 6) {
      killEnemy(e);
      killShip();
    }
  }
  enemies = enemies.filter((e) => !e.dead);
}

function updateLander(e, dt) {
  const bulletSpeed = Math.min(160 + wave * 18, 320);
  if (e.state === 'seek') {
    if (!e.wanderVx || Math.random() < dt * 0.5) e.wanderVx = rand(-60, 60);
    e.x = wrapX(e.x + e.wanderVx * dt);
    e.y += Math.sin(e.t * 2) * 18 * dt;
    e.y = clamp(e.y, PLAY_TOP + 12, 170);
    // hunt for a humanoid roughly below
    if (planetAlive && Math.random() < dt * 0.8) {
      let best = null, bd = 50;
      for (const h of humanoids) {
        if (h.state !== 'walk') continue;
        const d = Math.abs(wrapDx(h.x, e.x));
        if (d < bd) { bd = d; best = h; }
      }
      if (best) { e.target = best; e.state = 'descend'; }
    }
  } else if (e.state === 'descend') {
    if (!e.target || e.target.state !== 'walk') { e.state = 'seek'; e.target = null; }
    else {
      e.x = wrapX(e.x + wrapDx(e.target.x, e.x) * dt * 2);
      e.y += 55 * dt;
      if (e.y >= e.target.y - 9) {
        e.state = 'lift';
        e.target.state = 'grabbed';
        if (voCooldown.abduct <= 0) {
          audio.play('abduct', { vol: 0.7, pan: panOf(e.x) });
          audio.say('vo_abduct');
          voCooldown.abduct = 12;
        } else {
          audio.play('abduct', { vol: 0.5, pan: panOf(e.x) });
        }
      }
    }
  } else if (e.state === 'lift') {
    if (!e.target || e.target.state !== 'grabbed') { e.state = 'seek'; e.target = null; }
    else {
      e.y -= 32 * dt;
      e.target.x = e.x; e.target.y = e.y + 9;
      if (e.y <= PLAY_TOP + 10) {
        // reached the top: humanoid is consumed, lander becomes a MUTANT
        e.target.state = 'dead';
        e.target = null;
        e.type = 'mutant';
        e.vx = 0; e.vy = 0;
        audio.play('mutant', { vol: 0.8 });
        if (voCooldown.mutant <= 0) { audio.say('vo_mutant'); voCooldown.mutant = 18; }
        checkPlanet();
      }
    }
  }
  if (e.fire < 0 && onScreen(e.x)) { enemyFire(e, bulletSpeed); e.fire = rand(1.2, 3); }
}

function checkPlanet() {
  if (planetAlive && humanoids.every((h) => h.state === 'dead')) {
    // lose every humanoid and the planet blows: all landers go mutant
    planetAlive = false;
    flash = 0.2; shake = 10;
    audio.play('bigboom', { vol: 1 });
    for (const e of enemies) {
      if (e.type === 'lander') { e.type = 'mutant'; e.state = 'seek'; e.target = null; }
    }
  }
}

function updateBullets(dt) {
  for (const b of ebullets) {
    b.life -= dt;
    b.x = wrapX(b.x + b.vx * dt);
    b.y += b.vy * dt;
    if (b.y < PLAY_TOP || b.y > PLAY_BOT) b.life = 0;
    if (ship.alive && ship.invuln <= 0 &&
        Math.abs(wrapDx(b.x, ship.x)) < 7 && Math.abs(b.y - ship.y) < 5) {
      b.life = 0;
      killShip();
    }
  }
  ebullets = ebullets.filter((b) => b.life > 0);
}

function updateHumanoids(dt) {
  for (const h of humanoids) {
    if (h.state === 'walk') {
      if (Math.random() < dt * 0.3) h.dir = -h.dir;
      h.x = wrapX(h.x + h.dir * 8 * dt);
      h.y = terrainY(h.x) - 4;
    } else if (h.state === 'falling') {
      h.vy = (h.vy || 0) + 300 * dt;
      h.y += h.vy * dt;
      // the ship can catch a falling humanoid for big points
      if (ship.alive && !ship.carrying &&
          Math.abs(wrapDx(h.x, ship.x)) < 10 && Math.abs(h.y - ship.y) < 8) {
        h.state = 'carried';
        ship.carrying = h;
        addScore(500, h.x, h.y);
        audio.play('rescue', { vol: 0.9 });
        continue;
      }
      const ground = terrainY(h.x);
      if (h.y >= ground - 4) {
        h.y = ground - 4;
        if (h.fallFrom !== undefined && ground - 4 - h.fallFrom > 70) {
          h.state = 'dead';
          spawnExplosion(h.x, h.y, '#d0a0ff', 10);
          audio.play('humandie', { vol: 0.7, pan: panOf(h.x) });
          checkPlanet();
        } else {
          h.state = 'walk';
          addScore(250, h.x, h.y - 6);
        }
      }
    }
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.life -= dt;
    p.x = wrapX(p.x + p.vx * dt);
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.3, dt);
    p.vy *= Math.pow(0.3, dt);
  }
  particles = particles.filter((p) => p.life > 0);
}

// ------------------------------------------------------------------- render
const sx = (x) => Math.round(wrapDx(x, camX) + VIEW_W / 2);

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.save();
  if (shake > 0) ctx.translate(randi(-shake, shake) / 2, randi(-shake, shake) / 2);

  if (state === 'title') { drawTitle(); ctx.restore(); return; }

  drawStars();
  if (planetAlive) drawTerrain();
  drawHumanoids();
  drawEnemies();
  drawLasers();
  drawBullets();
  drawParticles();
  drawShip();
  drawPopups();
  drawScanner();
  drawHUD();

  if (state === 'wavebreak') {
    centerText(`WAVE ${wave} CLEARED`, 140, '#40ff40', 16);
    const saved = humanoids.filter((h) => h.state !== 'dead').length;
    centerText(`${saved} HUMANOIDS × ${Math.min(wave, 5) * 100} BONUS`, 165, '#d0a0ff', 8);
  }
  if (state === 'gameover') {
    centerText('GAME OVER', 140, '#ff4040', 20);
    centerText('PRESS ENTER', 170, '#808080', 8);
  }
  if (state === 'paused') centerText('PAUSED', 150, '#ffffff', 16);

  ctx.restore();

  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, flash * 6)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawStars() {
  const t = lastT / 1000;
  for (const s of stars) {
    const x = sx(s.x);
    if (x < -2 || x > VIEW_W + 2) continue;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + s.tw));
    ctx.fillStyle = `rgba(255,255,255,${tw})`;
    ctx.fillRect(x, Math.round(s.y), 1, 1);
  }
}

function drawTerrain() {
  ctx.strokeStyle = '#e06010';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const startI = Math.floor(wrapX(camX - VIEW_W / 2) / TERRAIN_STEP);
  for (let k = 0; k <= VIEW_W / TERRAIN_STEP + 1; k++) {
    const i = (startI + k) % TERRAIN_N;
    const wx = (startI + k) * TERRAIN_STEP;
    const x = sx(wx), y = Math.round(terrain[i]) + 0.5;
    if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawSprite(name, x, y, flip) {
  const img = sprites[flip ? name + '_flip' : name];
  ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
}

function drawShip() {
  if (!ship.alive) return;
  if (ship.invuln > 0 && Math.floor(lastT / 60) % 2 === 0) return; // blink
  const x = sx(ship.x);
  drawSprite('ship', x, ship.y, ship.facing < 0);
  // engine flame
  if ((keys['arrowleft'] || keys['a'] || keys['arrowright'] || keys['d'])) {
    ctx.fillStyle = Math.random() < 0.5 ? '#ff8000' : '#ffff40';
    const fx = x - ship.facing * (9 + randi(0, 4));
    ctx.fillRect(fx, Math.round(ship.y) - 1, ship.facing * -randi(2, 5), 2);
  }
  if (ship.carrying) drawSprite('humanoid', x, ship.y + 8, false);
}

function drawEnemies() {
  for (const e of enemies) {
    const x = sx(e.x);
    if (x < -20 || x > VIEW_W + 20) continue;
    drawSprite(e.type, x, e.y, e.vx < 0);
  }
}

function drawHumanoids() {
  for (const h of humanoids) {
    if (h.state === 'dead' || h.state === 'carried') continue;
    const x = sx(h.x);
    if (x < -5 || x > VIEW_W + 5) continue;
    drawSprite('humanoid', x, h.y, false);
  }
}

function drawLasers() {
  for (const l of lasers) {
    const hx = sx(l.x);
    const tx = hx - l.dir * l.len;
    const grad = ctx.createLinearGradient(tx, 0, hx, 0);
    grad.addColorStop(0, 'rgba(64,208,255,0)');
    grad.addColorStop(0.7, '#40d0ff');
    grad.addColorStop(1, '#ffffff');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tx, l.y + 0.5); ctx.lineTo(hx, l.y + 0.5);
    ctx.stroke();
  }
}

function drawBullets() {
  ctx.fillStyle = '#ffffff';
  for (const b of ebullets) {
    const x = sx(b.x);
    if (x < 0 || x > VIEW_W) continue;
    ctx.fillRect(x - 1, Math.round(b.y) - 1, 2, 2);
  }
}

function drawParticles() {
  for (const p of particles) {
    const x = sx(p.x);
    if (x < -2 || x > VIEW_W + 2) continue;
    ctx.globalAlpha = clamp(p.life * 2.5, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(x, Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawPopups() {
  ctx.font = '7px "Courier New", monospace';
  ctx.textAlign = 'center';
  for (const p of popups) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(p.text, sx(p.x), Math.round(p.y));
  }
  ctx.globalAlpha = 1;
}

// The scanner: the whole wrapping world in a strip, player centered.
function drawScanner() {
  const w = VIEW_W - 120, h = SCAN_H - 8, ox = 116, oy = 4;
  ctx.fillStyle = '#000';
  ctx.fillRect(ox, oy, w, h);
  ctx.strokeStyle = '#3040a0';
  ctx.strokeRect(ox - 0.5, oy - 0.5, w + 1, h + 1);

  const mapX = (x) => ox + Math.round((wrapDx(x, camX) / WORLD_W + 0.5) * w);
  const mapY = (y) => oy + Math.round(((y - PLAY_TOP) / (PLAY_BOT - PLAY_TOP)) * (h - 2)) + 1;

  if (planetAlive) {
    ctx.fillStyle = '#a04808';
    for (let i = 0; i < TERRAIN_N; i += 4) {
      ctx.fillRect(mapX(i * TERRAIN_STEP), mapY(terrain[i]), 1, 1);
    }
  }
  for (const hgn of humanoids) {
    if (hgn.state === 'dead') continue;
    ctx.fillStyle = '#d0a0ff';
    ctx.fillRect(mapX(hgn.x), mapY(hgn.y), 1, 1);
  }
  const dotColor = { lander: '#30e030', mutant: '#ff40ff', bomber: '#6080ff', pod: '#c040ff', swarmer: '#ff8020', baiter: '#c0ff20', mine: '#ff4040' };
  for (const e of enemies) {
    ctx.fillStyle = dotColor[e.type] || '#fff';
    ctx.fillRect(mapX(e.x), mapY(e.y), e.type === 'mine' ? 1 : 2, e.type === 'mine' ? 1 : 2);
  }
  if (ship.alive && Math.floor(lastT / 120) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mapX(ship.x) - 1, mapY(ship.y) - 1, 3, 3);
  }
  // brackets marking the visible slice of world
  const vw = (VIEW_W / WORLD_W) * w / 2;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  const cx = ox + w / 2;
  ctx.moveTo(cx - vw, oy); ctx.lineTo(cx - vw, oy + 4);
  ctx.moveTo(cx + vw, oy); ctx.lineTo(cx + vw, oy + 4);
  ctx.moveTo(cx - vw, oy + h); ctx.lineTo(cx - vw, oy + h - 4);
  ctx.moveTo(cx + vw, oy + h); ctx.lineTo(cx + vw, oy + h - 4);
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
  // lives as little ships, bombs as dots
  for (let i = 0; i < Math.min(lives, 5); i++) drawSprite('ship', 14 + i * 20, 32, false);
  ctx.fillStyle = '#40d0ff';
  for (let i = 0; i < Math.min(bombs, 8); i++) ctx.fillRect(6 + i * 6, 40, 4, 4);
}

function centerText(text, y, color, size) {
  ctx.font = `bold ${size}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, VIEW_W / 2, y);
}

function drawTitle() {
  drawStars();
  const t = lastT / 1000;
  ctx.textAlign = 'center';
  ctx.font = 'bold 36px "Courier New", monospace';
  ctx.fillStyle = `hsl(${(t * 60) % 360}, 90%, 60%)`;
  ctx.fillText('DEFENDER', VIEW_W / 2, 110);
  centerText('WEB EDITION', 128, '#808080', 9);
  if (Math.floor(t * 2) % 2 === 0) centerText('PRESS ENTER TO DEFEND', 175, '#ffffff', 11);
  centerText('← → THRUST    ↑ ↓ MOVE    SPACE FIRE', 215, '#40d0ff', 8);
  centerText('B SMART BOMB    H HYPERSPACE    M MUTE', 228, '#40d0ff', 8);
  centerText('PROTECT THE HUMANOIDS', 252, '#d0a0ff', 8);
  // marquee ship flying across
  const mx = (t * 180) % (VIEW_W + 60) - 30;
  drawSprite('ship', mx, 65, false);
  ctx.fillStyle = '#ff8000';
  ctx.fillRect(Math.round(mx) - 12, 64, -randi(2, 6), 2);
}
