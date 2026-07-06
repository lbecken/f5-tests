'use strict';

/* ============================================================
 * Fire — 2-D heat/combustion field.
 *  - temperature grid; fuel bed at the bottom injects heat with
 *    a flickering (noise-driven) burn rate
 *  - buoyant advection: each cell samples the cell(s) below with
 *    a lateral offset from a time-varying turbulence field →
 *    the flame licks and dances instead of rising in a column
 *  - radiative/entrainment cooling ∝ noise map → tongues break
 *    off and vanish, flame narrows with height
 *  - colour = blackbody-style ramp (black→red→orange→yellow→white)
 *  - embers (glowing particles, buoyancy + drag + cooling) and
 *    smoke (translucent puffs that expand and disperse) on top
 *  - hold the mouse to move the fire / ignite elsewhere
 * ============================================================ */
(() => {
  const CELL = 4;
  let W, H, ctx, hud;
  let cols, rows;
  let heat, heat2;
  let off, offCtx, img, data;
  let pal;                        // 256-entry RGBA palette
  let fuel = 0.88, windX = 0;     // sliders
  let fireX, fireW;
  let embers = [], smoke = [];
  let t = 0;

  function buildPalette() {
    pal = new Uint8ClampedArray(256 * 4);
    for (let i = 0; i < 256; i++) {
      const u = i / 255;
      // blackbody-ish ramp with gamma lift in the reds
      const r = clamp(Math.pow(u * 2.6, 0.9), 0, 1);
      const g = clamp(u * 2.4 - 0.75, 0, 1);
      const b = clamp(u * 3.2 - 2.2, 0, 1);
      pal[i * 4] = r * 255;
      pal[i * 4 + 1] = g * 220;
      pal[i * 4 + 2] = b * 255;
      pal[i * 4 + 3] = clamp(u * 4, 0, 1) * 255;
    }
  }

  function stepField() {
    t += 1 / 60;
    // fuel bed injection with flicker
    const by = rows - 2;
    for (let x = 0; x < cols; x++) {
      const inZone = Math.abs(x - fireX) < fireW / 2;
      if (!inZone) continue;
      const edge = 1 - Math.abs(x - fireX) / (fireW / 2); // hotter core
      const flick = 0.75 + 0.25 * Noise.fbm2(x * 0.15, t * 6, 3);
      const h = fuel * flick * (0.35 + 0.65 * Math.sqrt(edge));
      heat[by * cols + x] = Math.max(heat[by * cols + x], h);
      heat[(by + 1) * cols + x] = h;
    }

    // buoyant advection with turbulent lateral offset + cooling
    for (let y = 0; y < rows - 1; y++) {
      const yy = y * cols;
      for (let x = 0; x < cols; x++) {
        // turbulence: lateral sample offset, stronger higher up
        const tw = Noise.fbm2(x * 0.08, y * 0.1 - t * 2.2, 3);
        const sx = x + tw * 2.2 + windX * 1.5;
        const x0 = Math.floor(sx), fx = sx - x0;
        const xa = clamp(x0, 0, cols - 1), xb = clamp(x0 + 1, 0, cols - 1);
        // sample one row below (hot gas rises one cell per tick)
        const src = (y + 1) * cols;
        let v = heat[src + xa] * (1 - fx) + heat[src + xb] * fx;
        // slight lateral diffusion keeps the flame connected
        v = v * 0.86 + 0.07 * (heat[src + clamp(xa - 1, 0, cols - 1)]
                             + heat[src + clamp(xb + 1, 0, cols - 1)]);
        // cooling: base + noisy patches (entrained cold air)
        const cool = 0.006 + 0.024 * Math.max(0, Noise.fbm2(x * 0.13 + 90, y * 0.13 - t * 1.4, 3));
        heat2[yy + x] = Math.max(0, v - cool);
      }
    }
    // bottom row: decay of the bed itself
    for (let x = 0; x < cols; x++) {
      heat2[(rows - 1) * cols + x] = heat[(rows - 1) * cols + x] * 0.6;
    }
    [heat, heat2] = [heat2, heat];

    // spawn embers from hot region
    if (Math.random() < fuel * 0.5) {
      const ex = fireX + rand(-fireW / 3, fireW / 3);
      embers.push({
        x: ex * CELL, y: (rows - 4) * CELL,
        vx: rand(-12, 12), vy: rand(-70, -30),
        T: rand(0.7, 1), life: rand(0.8, 2.2),
      });
    }
    // spawn smoke above the flame
    if (Math.random() < 0.35) {
      smoke.push({
        x: (fireX + rand(-1, 1) * fireW * 0.3) * CELL,
        y: H - rand(0.35, 0.55) * H * fuel - H * 0.1,
        r: rand(6, 14), a: rand(0.05, 0.12), vy: rand(-25, -14),
      });
    }
  }

  function stepParticles(dt) {
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      // buoyancy up while hot, drag, turbulence
      e.vy += (-90 * e.T + 20) * dt;
      e.vx += Noise.fbm2(e.x * 0.02, t * 3 + i, 2) * 160 * dt + windX * 30 * dt;
      e.vx *= 0.985; e.vy *= 0.99;
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.T -= dt * 0.45;              // radiative cooling
      e.life -= dt;
      if (e.life <= 0 || e.T <= 0.05) embers.splice(i, 1);
    }
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i];
      s.y += s.vy * dt;
      s.x += (Noise.fbm1(s.y * 0.01 + i, 2) * 30 + windX * 40) * dt;
      s.r += 9 * dt;                 // turbulent diffusion → puff grows
      s.a -= dt * 0.035;
      if (s.a <= 0 || s.y < -30) smoke.splice(i, 1);
    }
  }

  const sim = {
    name: 'Fire',
    icon: '🔥',
    info: 'Temperature field: a flickering fuel bed injects heat, hot gas is '
        + 'advected upward through a turbulent offset field and cools by mixing '
        + 'with entrained air. Colour is a blackbody-style temperature ramp. '
        + 'Embers and smoke ride the same flow. <b>Hold the mouse to move the fire.</b>',

    controls: [
      { name: 'Fuel / intensity', min: 0.3, max: 1.0, step: 0.01,
        get: () => fuel, set: v => { fuel = v; }, fmt: v => v.toFixed(2) },
      { name: 'Wind', min: -3, max: 3, step: 0.1,
        get: () => windX, set: v => { windX = v; }, fmt: v => v.toFixed(1) },
    ],
    actions: [],

    init(env) {
      ({ ctx, w: W, h: H, hud } = env);
      cols = Math.ceil(W / CELL); rows = Math.ceil(H / CELL);
      heat = new Float32Array(cols * rows);
      heat2 = new Float32Array(cols * rows);
      off = document.createElement('canvas');
      off.width = cols; off.height = rows;
      offCtx = off.getContext('2d');
      img = offCtx.createImageData(cols, rows);
      data = img.data;
      buildPalette();
      fireX = cols >> 1;
      fireW = Math.min(46, cols * 0.3);
      embers = []; smoke = [];
    },

    frame(dt, ptr) {
      if (ptr.down) fireX = clamp((ptr.x / CELL) | 0, 4, cols - 4);
      stepField();
      stepParticles(dt);
      render();
      hud.textContent = `heat grid ${cols}×${rows}   ${embers.length} embers   ${smoke.length} smoke puffs`;
    },
  };

  function render() {
    ctx.fillStyle = '#08070c';
    ctx.fillRect(0, 0, W, H);

    // smoke first (behind the flame)
    for (const s of smoke) {
      ctx.fillStyle = `rgba(120,120,130,${Math.max(0, s.a)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // heat field → palette
    for (let i = 0; i < heat.length; i++) {
      const v = clamp(heat[i], 0, 1);
      const p = (v * 255) | 0;
      data[i * 4] = pal[p * 4];
      data[i * 4 + 1] = pal[p * 4 + 1];
      data[i * 4 + 2] = pal[p * 4 + 2];
      data[i * 4 + 3] = pal[p * 4 + 3];
    }
    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(off, 0, 0, W, H);

    // embers with glow
    for (const e of embers) {
      const T = clamp(e.T, 0, 1);
      ctx.fillStyle = `rgba(255,${(120 + T * 130) | 0},${(T * 60) | 0},${T})`;
      ctx.fillRect(e.x - 1, e.y - 1, 2, 2);
      ctx.fillStyle = `rgba(255,140,40,${T * 0.25})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // ground glow near the bed
    const gy = H - CELL * 2;
    const g = ctx.createLinearGradient(0, gy - 30, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(255,90,20,${fuel * 0.18})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, gy - 30, W, H);
  }

  Engine.register(sim);
})();
