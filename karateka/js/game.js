/* game.js — main loop, game states, camera, combat resolution, HUD.
 *
 * Renders into a 480x270 offscreen canvas, then scales x2 onto the visible
 * canvas with image smoothing disabled — smooth skeletal animation displayed
 * through chunky 1984-style pixels.
 */
(() => {
  const display = document.getElementById("screen");
  const dctx = display.getContext("2d");
  const W = 480, H = 270;
  const buf = document.createElement("canvas");
  buf.width = W; buf.height = H;
  const ctx = buf.getContext("2d");
  dctx.imageSmoothingEnabled = false;

  const PLAYER_COLORS = { gi: "#e8e2d0", skin: "#d9a066", belt: "#26201a", hair: "#1a1114" };
  const GUARD_COLORS  = { gi: "#a03028", skin: "#c8935c", belt: "#111", hair: "#14100e" };
  const BOSS_COLORS   = { gi: "#2e2a3c", skin: "#b98a55", belt: "#5a0f16", hair: "#0a080a" };
  const PRINCESS_COLORS = { gi: "#c94f6d", skin: "#e8c39e", belt: "#a83a56", hair: "#1a1114" };

  const ATTACK_KEYS = {
    KeyJ: "punch_high", KeyK: "punch_mid", KeyL: "punch_low",
    KeyU: "kick_high",  KeyI: "kick_mid",  KeyO: "kick_low",
  };

  const ENEMY_SPECS = [
    { x: 1500, hp: 5,  name: "GUARD",  colors: GUARD_COLORS, cooldown: [1.15, 1.9],  stepBackChance: 0.4,  dmgMul: 1 },
    { x: 2500, hp: 6,  name: "GUARD",  colors: GUARD_COLORS, cooldown: [0.95, 1.6],  stepBackChance: 0.35, dmgMul: 1 },
    { x: 3500, hp: 7,  name: "GUARD",  colors: GUARD_COLORS, cooldown: [0.8, 1.4],   stepBackChance: 0.3,  dmgMul: 1 },
    { x: 4600, hp: 8,  name: "GUARD",  colors: GUARD_COLORS, cooldown: [0.7, 1.2],   stepBackChance: 0.3,  dmgMul: 1 },
    { x: 5700, hp: 12, name: "AKUMA",  colors: BOSS_COLORS,  cooldown: [0.5, 0.95],  stepBackChance: 0.25, dmgMul: 1.5 },
  ];
  const PRINCESS_X = 6560;

  let state, player, enemies, princess, camX, time, msg, msgT, shake, heartbeatT, koT, met;

  function message(text, dur = 3.2) { msg = text; msgT = dur; }

  function reset() {
    state = "title";
    time = 0; camX = 0; shake = 0; heartbeatT = 0; koT = 0;
    msg = ""; msgT = 0;
    player = new Fighter({ x: 60, facing: 1, colors: PLAYER_COLORS, hpMax: 12, isPlayer: true, stance: "travel" });
    enemies = ENEMY_SPECS.map((s) => {
      const f = new Fighter({ x: s.x, facing: -1, colors: s.colors, hpMax: s.hp, stance: "fight" });
      f.dmgMul = s.dmgMul;
      f.name = s.name;
      return { f, ai: new EnemyAI(f, s), spec: s, met: false };
    });
    princess = new Fighter({ x: PRINCESS_X, facing: -1, colors: PRINCESS_COLORS, hpMax: 1 });
    princess.setAnim("princess_idle", true);
    met = false;
    // solve all skeletons once so every fighter is drawable from frame one
    player.solve(Level.GROUND);
    for (const e of enemies) e.f.solve(Level.GROUND);
    princess.solve(Level.GROUND);
  }

  function startGame() {
    state = "intro";
    player.state = "bow";
    player.setAnim("bow", true);
    AudioFX.gong();
    message("RESCUE PRINCESS MARIKO FROM THE FORTRESS OF AKUMA", 4);
  }

  // ---- combat ----

  function tryStrike(attacker, defender) {
    if (!attacker.attackActive() || defender.state === "ko") return;
    const tip = attacker.strikePoint();
    if (!tip) return;
    const facingOK = (defender.x - attacker.x) * attacker.facing > 0;
    if (!facingOK || Math.abs(defender.x - attacker.x) > 58) return;
    if (Math.abs(tip.x - defender.x) > 12) return;

    attacker.hasHit = true;
    const dmg = attacker.attack.dmg * (attacker.dmgMul || 1);

    // Karateka rule: caught in running stance = instant defeat.
    if (defender.isPlayer && defender.stance === "travel") {
      defender.knockOut();
      message("NEVER MEET A FOE IN RUNNING STANCE", 4);
      return;
    }
    defender.takeHit({ height: attacker.attack.height, dmg }, attacker.x);
    if (defender.isPlayer) { AudioFX.hurt(); shake = 0.18; }
    else AudioFX.hit();
  }

  function resolveCombat(a, b) {
    // simultaneous same-height attacks cancel out (the original's spacing/timing defense)
    if (a.attackActive() && b.attackActive() && a.attack.height === b.attack.height &&
        Math.abs(a.x - b.x) < 55) {
      a.hasHit = b.hasHit = true;
      a.playBlock(); b.playBlock();
      AudioFX.clash();
      return;
    }
    tryStrike(a, b);
    tryStrike(b, a);
  }

  // ---- update ----

  function activeEnemy() {
    return enemies.find((e) => e.f.state !== "ko" && Math.abs(e.f.x - player.x) < 400) || null;
  }

  function update(dt) {
    time += dt;
    if (msgT > 0) msgT -= dt;
    if (shake > 0) shake -= dt;

    if (state === "title") {
      if (Input.justPressed("Enter")) startGame();
      return;
    }
    if (state === "intro") {
      player.update(dt, 0);
      player.solve(Level.GROUND);
      for (const e of enemies) { e.f.update(dt, 0); e.f.solve(Level.GROUND); }
      princess.update(dt, 0);
      princess.solve(Level.GROUND);
      if (player.animT >= Anim.defs.bow.dur) { state = "play"; player.state = "idle"; }
      return;
    }
    if (state === "gameover" || state === "win") {
      if (Input.justPressed("Enter")) { reset(); startGame(); }
      // keep animating the scene behind the overlay
    }

    const engaged = activeEnemy();

    // player input
    let move = 0;
    if (state === "play" && player.state !== "ko") {
      if (Input.held("ArrowRight")) move = 1;
      else if (Input.held("ArrowLeft")) move = -1;

      if (Input.justPressed("Space") && !player.busy) {
        player.stance = player.stance === "fight" ? "travel" : "fight";
        player.setAnim(player.stance === "fight" ? "fight_idle" : "travel_idle", true);
      }
      for (const [code, atk] of Object.entries(ATTACK_KEYS)) {
        if (Input.justPressed(code)) player.startAttack(atk);
      }
    }

    player.update(dt, player.busy ? 0 : move);
    player.x = Math.max(24, Math.min(Level.WIDTH - 40, player.x));

    // a standing opponent bars the way
    if (engaged && engaged.f.state !== "ko") {
      player.x = Math.min(player.x, engaged.f.x - 22);
    }

    for (const e of enemies) {
      const isEngaged = engaged === e && state === "play";
      if (isEngaged && !e.met) {
        e.met = true;
        AudioFX.gong();
        message(e.spec.name === "AKUMA" ? "AKUMA HIMSELF BARS THE WAY" : "A GUARD BLOCKS YOUR PATH", 2.6);
      }
      if (isEngaged) e.ai.update(dt, player);
      else e.f.update(dt, 0);
      e.f.solve(Level.GROUND);
    }
    player.solve(Level.GROUND);
    princess.update(dt, 0);
    princess.solve(Level.GROUND);

    if (engaged && state === "play") resolveCombat(player, engaged.f);

    // player defeated?
    if (player.state === "ko" && state === "play") {
      koT += dt;
      if (koT > 1.6) { state = "gameover"; }
    }

    // reaching the princess — approach decides the ending (the famous Easter egg)
    if (state === "play" && !enemies.some((e) => e.f.state !== "ko") &&
        Math.abs(player.x - princess.x) < 30 && player.state !== "ko") {
      if (player.stance === "fight") {
        princess.startAttack("kick_mid");
        player.knockOut();
        message("MARIKO GREETS AN ARMED STRANGER WITH A KICK", 5);
      } else {
        state = "win";
        player.state = "victory";
        player.setAnim("victory", true);
        AudioFX.fanfare();
      }
    }

    // low-vitality heartbeat
    if (player.hp > 0 && player.hp <= 3 && state === "play") {
      heartbeatT -= dt;
      if (heartbeatT <= 0) { AudioFX.heartbeat(); heartbeatT = 1.3; }
    }

    // camera follows the player
    const target = Math.max(0, Math.min(Level.WIDTH - W, player.x - 170));
    camX += (target - camX) * Math.min(1, dt * 6);
  }

  // ---- drawing ----

  function drawBar(x, y, hp, hpMax, alignRight, label) {
    ctx.fillStyle = "#d8a340";
    ctx.font = "8px monospace";
    ctx.textAlign = alignRight ? "right" : "left";
    ctx.fillText(label, alignRight ? x + hpMax * 7 : x, y - 3);
    for (let i = 0; i < hpMax; i++) {
      ctx.fillStyle = i < hp ? "#e0b13e" : "#3a2c18";
      ctx.fillRect(x + i * 7, y, 5, 7);
    }
  }

  function drawHUD() {
    // letterbox bars
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, 14);
    ctx.fillRect(0, H - 26, W, 26);

    if (state === "title") return;
    drawBar(10, H - 15, Math.ceil(player.hp), player.hpMax, false, "KARATEKA");
    const e = activeEnemy();
    if (e && state !== "win") {
      const x = W - 10 - e.f.hpMax * 7;
      drawBar(x, H - 15, Math.ceil(e.f.hp), e.f.hpMax, true, e.spec.name);
    }
  }

  function centerText(text, y, size = 10, color = "#e0b13e") {
    ctx.fillStyle = color;
    ctx.font = `${size}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(text, W / 2, y);
  }

  function drawTitle() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    Level.draw(ctx, 6560 - 240, W, time, PRINCESS_X); // the princess awaits behind the title
    princess.update(0.016, 0);
    princess.solve(Level.GROUND);
    Level.drawPrincess(ctx, princess);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    centerText("F O R T R E S S   O F   A K U M A", 86, 16);
    centerText("in the style of KARATEKA (1984)", 106, 8, "#9a8560");
    centerText("The warlord Akuma has taken Princess Mariko.", 140, 8, "#c9b58a");
    centerText("You alone walk the road to his fortress.", 152, 8, "#c9b58a");
    if (Math.floor(time * 1.6) % 2 === 0) centerText("PRESS ENTER", 196, 10, "#e8e2d0");
    drawHUD();
  }

  function draw() {
    if (state === "title") { drawTitle(); blit(); return; }

    const sx = shake > 0 ? (Math.random() - 0.5) * 4 : 0;
    Level.draw(ctx, camX + sx, W, time, PRINCESS_X);

    ctx.save();
    ctx.translate(-camX - sx, 0);
    Level.drawPrincess(ctx, princess);
    for (const e of enemies) e.f.draw(ctx);
    player.draw(ctx);
    ctx.restore();

    drawHUD();

    if (msgT > 0) {
      ctx.globalAlpha = Math.min(1, msgT / 0.4);
      centerText(msg, 40, 9);
      ctx.globalAlpha = 1;
    }

    if (state === "gameover") {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
      centerText("YOU HAVE FALLEN", 120, 15, "#c0392b");
      centerText("The road to the fortress must be walked again.", 142, 8, "#c9b58a");
      centerText("PRESS ENTER", 180, 10, "#e8e2d0");
    } else if (state === "win") {
      centerText("PRINCESS MARIKO IS SAFE", 60, 13);
      centerText("T H E   E N D", 84, 10, "#c9b58a");
    }

    blit();
  }

  function blit() {
    dctx.imageSmoothingEnabled = false;
    dctx.drawImage(buf, 0, 0, W, H, 0, 0, display.width, display.height);
  }

  // ---- main loop ----

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    Input.endFrame();
    requestAnimationFrame(frame);
  }

  reset();
  requestAnimationFrame(frame);

  // expose a handle for automated tests
  window.__game = {
    get state() { return state; },
    get player() { return player; },
    get enemies() { return enemies; },
    message,
  };
})();
