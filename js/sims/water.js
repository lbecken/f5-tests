'use strict';

/* ============================================================
 * Water — particle fluid (Smoothed-Particle Hydrodynamics).
 * Implements Clavet et al. 2005 "Particle-based Viscoelastic
 * Fluid Simulation" (double density relaxation):
 *  1. gravity + viscosity impulses
 *  2. predict positions
 *  3. density ρ = Σ(1-q)², near-density ρ' = Σ(1-q)³
 *     pressure P = k(ρ-ρ₀), P' = k'ρ' → pairwise displacements
 *  4. wall collision, velocity recomputed from positions
 * Incompressibility, surface tension-like clustering and
 * splashing all emerge from the near-pressure term.
 * Neighbour search: uniform spatial hash grid, cell = h.
 * Rendering: metaballs (additive density sprites at ¼ res,
 * thresholded to a surface with depth shading).
 * ============================================================ */
(() => {
  // tick units: 1 tick = 1/60 s, distances in px
  const H_R = 28;              // interaction radius h
  const GRAV = 0.35;           // px/tick²  (≈ 9.81 m/s² at 120 px/m)
  const RHO0 = 3.0;            // rest density
  const K = 0.5;               // stiffness
  const K_NEAR = 3.0;          // near stiffness (anti-clumping / surface tension)
  const VISC_S = 0.06;         // linear viscosity
  let viscB = 0.20;            // quadratic viscosity (slider)
  const VCAP = H_R * 0.45;     // CFL-ish speed cap per tick

  let W, H, ctx, hud;
  let N = 0, maxN = 1100;
  let px, py, ox, oy, vx, vy;  // particle state
  let gCols, gRows, gHead, gNext; // spatial hash
  let tapOn = true, tapX, tick = 0, acc = 0;
  let obst;                    // rectangular obstacle
  let lowC, lowCtx, lowImg, sprite; // metaball rendering
  const SS = 4;                // supersample-down factor for metaballs

  function alloc(n) {
    px = new Float32Array(n); py = new Float32Array(n);
    ox = new Float32Array(n); oy = new Float32Array(n);
    vx = new Float32Array(n); vy = new Float32Array(n);
    gNext = new Int32Array(n);
  }

  function spawn(x, y, sx, sy) {
    if (N >= maxN) return;
    px[N] = x + rand(-2, 2); py[N] = y + rand(-2, 2);
    vx[N] = sx; vy[N] = sy;
    N++;
  }

  function buildHash() {
    gHead.fill(-1);
    for (let i = 0; i < N; i++) {
      const cx = clamp((px[i] / H_R) | 0, 0, gCols - 1);
      const cy = clamp((py[i] / H_R) | 0, 0, gRows - 1);
      const c = cy * gCols + cx;
      gNext[i] = gHead[c];
      gHead[c] = i;
    }
  }

  /* visit unordered pairs (i,j) with r<h via the hash grid */
  function forPairs(fn) {
    for (let i = 0; i < N; i++) {
      const cx = clamp((px[i] / H_R) | 0, 0, gCols - 1);
      const cy = clamp((py[i] / H_R) | 0, 0, gRows - 1);
      for (let gy = Math.max(0, cy - 1); gy <= Math.min(gRows - 1, cy + 1); gy++)
        for (let gx = Math.max(0, cx - 1); gx <= Math.min(gCols - 1, cx + 1); gx++)
          for (let j = gHead[gy * gCols + gx]; j !== -1; j = gNext[j]) {
            if (j <= i) continue;
            const dx = px[j] - px[i], dy = py[j] - py[i];
            const r2 = dx * dx + dy * dy;
            if (r2 < H_R * H_R && r2 > 1e-9) fn(i, j, dx, dy, Math.sqrt(r2));
          }
    }
  }

  function tickSim(ptr) {
    tick++;
    // emit from the tap
    if (tapOn && N < maxN) {
      for (let k = 0; k < 3; k++) spawn(tapX + k * 7 - 7, 14, 0.4, 2.5);
    }

    // 1. external forces
    for (let i = 0; i < N; i++) vy[i] += GRAV;
    if (ptr.down) {
      const R = 70, R2 = R * R;
      for (let i = 0; i < N; i++) {
        const dx = px[i] - ptr.x, dy = py[i] - ptr.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const s = (1 - Math.sqrt(d2) / R) * 0.25;
          vx[i] += (ptr.vx / 60) * s;
          vy[i] += (ptr.vy / 60) * s;
        }
      }
    }

    buildHash();

    // 2. viscosity impulses (radial, inelastic)
    forPairs((i, j, dx, dy, r) => {
      const q = r / H_R;
      const ux = dx / r, uy = dy / r;
      const u = (vx[i] - vx[j]) * ux + (vy[i] - vy[j]) * uy; // approach speed
      if (u > 0) {
        const I = (1 - q) * (VISC_S * u + viscB * u * u) * 0.5;
        vx[i] -= I * ux; vy[i] -= I * uy;
        vx[j] += I * ux; vy[j] += I * uy;
      }
    });

    // 3. predict
    for (let i = 0; i < N; i++) {
      const sp = Math.hypot(vx[i], vy[i]);
      if (sp > VCAP) { vx[i] *= VCAP / sp; vy[i] *= VCAP / sp; }
      ox[i] = px[i]; oy[i] = py[i];
      px[i] += vx[i]; py[i] += vy[i];
    }

    // 4. double density relaxation
    buildHash();
    const rho = new Float32Array(N), rhoN = new Float32Array(N);
    forPairs((i, j, dx, dy, r) => {
      const q = 1 - r / H_R;
      rho[i] += q * q; rhoN[i] += q * q * q;
      rho[j] += q * q; rhoN[j] += q * q * q;
    });
    const P = new Float32Array(N), Pn = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      P[i] = K * (rho[i] - RHO0);
      Pn[i] = K_NEAR * rhoN[i];
    }
    forPairs((i, j, dx, dy, r) => {
      const q = 1 - r / H_R;
      const D = ((P[i] + P[j]) * 0.5 * q + (Pn[i] + Pn[j]) * 0.5 * q * q) * 0.5;
      const ux = dx / r, uy = dy / r;
      px[i] -= D * ux; py[i] -= D * uy;
      px[j] += D * ux; py[j] += D * uy;
    });

    // 5. walls + obstacle (position projection → no-slip-ish, no bounce)
    const m = 4;
    for (let i = 0; i < N; i++) {
      if (px[i] < m) px[i] = m + rand(0.1);
      if (px[i] > W - m) px[i] = W - m - rand(0.1);
      if (py[i] > H - m) py[i] = H - m - rand(0.1);
      if (py[i] < m) py[i] = m;
      // rect obstacle: push out through nearest face
      if (px[i] > obst.x && px[i] < obst.x + obst.w &&
          py[i] > obst.y && py[i] < obst.y + obst.h) {
        const dl = px[i] - obst.x, dr = obst.x + obst.w - px[i];
        const dtp = py[i] - obst.y, db = obst.y + obst.h - py[i];
        const mn = Math.min(dl, dr, dtp, db);
        if (mn === dtp) py[i] = obst.y;
        else if (mn === dl) px[i] = obst.x;
        else if (mn === dr) px[i] = obst.x + obst.w;
        else py[i] = obst.y + obst.h;
      }
    }

    // 6. velocity from positions
    for (let i = 0; i < N; i++) {
      vx[i] = px[i] - ox[i];
      vy[i] = py[i] - oy[i];
    }
  }

  const sim = {
    name: 'Water',
    icon: '💧',
    info: 'SPH fluid (Clavet 2005 double-density relaxation): pressure keeps it '
        + 'incompressible, a near-pressure term gives surface-tension clustering, '
        + 'pairwise viscosity damps splashes. <b>Drag through the water to stir it.</b>',

    controls: [
      { name: 'Particles', min: 300, max: 2500, step: 50,
        get: () => maxN, set: v => { maxN = v; if (N > maxN) N = maxN; } },
      { name: 'Viscosity', min: 0, max: 0.5, step: 0.01,
        get: () => viscB, set: v => { viscB = v; }, fmt: v => v.toFixed(2) },
    ],
    actions: [
      { name: 'Tap on/off', fn: () => { tapOn = !tapOn; }, isOn: () => tapOn },
      { name: 'Drain', fn: () => { N = 0; } },
    ],

    init(env) {
      ({ ctx, w: W, h: H, hud } = env);
      alloc(3000);
      maxN = Math.min(maxN, 3000);
      N = 0;
      tapX = W * 0.28;
      obst = { x: W * 0.55, y: H - H * 0.28, w: Math.min(140, W * 0.14), h: H * 0.28 };
      gCols = Math.ceil(W / H_R); gRows = Math.ceil(H / H_R);
      gHead = new Int32Array(gCols * gRows);
      // pre-fill a pool so there is water immediately
      for (let y = H - 10; y > H - 90; y -= H_R * 0.45)
        for (let x = 8; x < W * 0.5; x += H_R * 0.45)
          spawn(x, y, 0, 0);
      // metaball buffers
      lowC = document.createElement('canvas');
      lowC.width = Math.ceil(W / SS); lowC.height = Math.ceil(H / SS);
      lowCtx = lowC.getContext('2d', { willReadFrequently: true });
      lowImg = lowCtx.createImageData(lowC.width, lowC.height);
      const sr = Math.ceil(H_R * 0.75 / SS);
      sprite = document.createElement('canvas');
      sprite.width = sprite.height = sr * 2;
      const sc = sprite.getContext('2d');
      const g = sc.createRadialGradient(sr, sr, 0, sr, sr, sr);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      sc.fillStyle = g;
      sc.fillRect(0, 0, sr * 2, sr * 2);
    },

    frame(dt, ptr) {
      acc += dt;
      let steps = 0;
      while (acc >= 1 / 60 && steps < 3) { tickSim(ptr); acc -= 1 / 60; steps++; }
      if (steps === 3) acc = 0;
      render();
      hud.textContent = `${N} particles   h=${H_R}px   spatial hash ${gCols}×${gRows}`;
    },
  };

  function render() {
    ctx.fillStyle = '#0d1118';
    ctx.fillRect(0, 0, W, H);

    // accumulate density sprites at low res
    lowCtx.clearRect(0, 0, lowC.width, lowC.height);
    const s = sprite.width;
    for (let i = 0; i < N; i++) {
      lowCtx.drawImage(sprite, px[i] / SS - s / 2, py[i] / SS - s / 2);
    }
    const d = lowCtx.getImageData(0, 0, lowC.width, lowC.height);
    const a = d.data;
    const out = new Uint32Array(lowImg.data.buffer);
    const T = 70;                     // surface threshold
    for (let i = 0, p = 3; i < out.length; i++, p += 4) {
      const al = a[p];
      if (al < T) { out[i] = 0; continue; }
      const depth = Math.min(1, (al - T) / 140);
      // shallow: light cyan → deep: dark blue  (ABGR little-endian)
      const r = lerp(120, 18, depth) | 0;
      const g = lerp(190, 90, depth) | 0;
      const b = lerp(235, 190, depth) | 0;
      const edge = al < T + 26 ? 60 : 0; // brighter rim = specular-ish surface
      out[i] = (232 << 24) | (Math.min(255, b + edge) << 16)
             | (Math.min(255, g + edge) << 8) | Math.min(255, r + edge);
    }
    lowCtx.putImageData(lowImg, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lowC, 0, 0, W, H);

    // tap
    if (tapOn) {
      ctx.fillStyle = '#39414f';
      ctx.fillRect(tapX - 16, 0, 32, 12);
    }
    // obstacle
    ctx.fillStyle = '#2b3242';
    ctx.fillRect(obst.x, obst.y, obst.w, obst.h);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(obst.x, obst.y, obst.w, 3);
  }

  Engine.register(sim);
})();
