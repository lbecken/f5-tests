'use strict';

/* ============================================================
 * Bouncing ball — rigid-body point physics in real SI units.
 *  - semi-implicit Euler, 1/480 s substeps
 *  - gravity g = 9.81 m/s² (adjustable)
 *  - quadratic aerodynamic drag  F = ½ ρ Cd A v²
 *  - impacts: coefficient of restitution e (normal),
 *    tangential slip friction on each bounce
 *  - bounce cutoff when rebound height < surface roughness,
 *    then rolling with rolling-resistance deceleration a = Crr·g
 * ============================================================ */
(() => {
  const PRESETS = [
    { name: 'Basketball', r: 0.121, m: 0.62,  e: 0.76, cd: 0.47, crr: 0.020, col: '#e07b39' },
    { name: 'Tennis',     r: 0.033, m: 0.058, e: 0.73, cd: 0.55, crr: 0.030, col: '#c8e05a' },
    { name: 'Superball',  r: 0.025, m: 0.045, e: 0.92, cd: 0.47, crr: 0.015, col: '#d84fd8' },
    { name: 'Bowling',    r: 0.108, m: 6.8,   e: 0.30, cd: 0.45, crr: 0.010, col: '#3a4a72' },
  ];
  const RHO_AIR = 1.225;          // kg/m³
  const SUB_DT = 1 / 480;         // s
  const REST_H = 0.004;           // m — stop bouncing when rebound < 4 mm

  let W, H, ctx, hud;
  let ppm;                        // pixels per metre
  let floorY, wallPad;
  let g = 9.81, airDrag = true;
  let preset = PRESETS[0];
  let ball, trail, marks, tSim, acc;
  let grabbed = false;

  function newBall(dropH) {
    return {
      x: 2.0,                     // m from left wall
      y: dropH,                   // m above floor (centre)
      vx: 1.6, vy: 0,
      rolling: false, stopped: false,
      e0: null,                   // initial mechanical energy, set on release
    };
  }

  function energy(b) {
    return 0.5 * preset.m * (b.vx * b.vx + b.vy * b.vy)
         + preset.m * g * Math.max(0, b.y - preset.r);
  }

  function reset(dropH = 4.2) {
    ball = newBall(dropH);
    ball.e0 = energy(ball);
    trail = [];
    marks = [];
    tSim = 0; acc = 0;
    grabbed = false;
  }

  function step(dt) {
    const b = ball;
    if (b.stopped || grabbed) return;
    tSim += dt;

    if (b.rolling) {
      // rolling resistance: constant deceleration Crr·g opposing motion
      const dec = preset.crr * g;
      const dv = dec * dt;
      if (Math.abs(b.vx) <= dv) { b.vx = 0; b.stopped = true; }
      else b.vx -= Math.sign(b.vx) * dv;
      b.x += b.vx * dt;
      b.y = preset.r;
      walls(b);
      return;
    }

    // free flight
    let ax = 0, ay = -g;
    if (airDrag) {
      const v = Math.hypot(b.vx, b.vy);
      if (v > 1e-6) {
        const A = Math.PI * preset.r * preset.r;
        const k = 0.5 * RHO_AIR * preset.cd * A / preset.m; // 1/m
        ax -= k * v * b.vx;
        ay -= k * v * b.vy;
      }
    }
    b.vx += ax * dt;
    b.vy += ay * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // floor impact
    if (b.y < preset.r && b.vy < 0) {
      b.y = preset.r;
      const vin = -b.vy;
      b.vy = preset.e * vin;                       // normal restitution
      b.vx *= 0.985;                               // tangential slip loss
      marks.push({ x: b.x, v: vin, t: tSim });
      // rebound apex e²·v²/2g below roughness scale → settle to rolling
      if ((b.vy * b.vy) / (2 * g) < REST_H) {
        b.vy = 0;
        b.rolling = true;
      }
    }
    walls(b);
  }

  function walls(b) {
    const xMax = (W - wallPad) / ppm;
    const xMin = wallPad / ppm;
    if (b.x - preset.r < xMin && b.vx < 0) { b.x = xMin + preset.r; b.vx = -preset.e * b.vx; }
    if (b.x + preset.r > xMax && b.vx > 0) { b.x = xMax - preset.r; b.vx = -preset.e * b.vx; }
  }

  const sim = {
    name: 'Bouncing Ball',
    icon: '⚽',
    info: 'Real SI units: g = 9.81 m/s², quadratic air drag ½ρC<sub>d</sub>Av², '
        + 'coefficient of restitution per material, rolling resistance until rest. '
        + '<b>Drag the ball to throw it.</b>',

    controls: [
      { name: 'Gravity (m/s²)', min: 1.6, max: 24.8, step: 0.1,
        get: () => g, set: v => { g = v; }, fmt: v => v.toFixed(1) },
      { name: 'Restitution e', min: 0.05, max: 0.95, step: 0.01,
        get: () => preset.e, set: v => { preset.e = v; }, fmt: v => v.toFixed(2) },
    ],
    actions: [
      ...PRESETS.map(p => ({
        name: p.name,
        fn: () => { preset = p; reset(); },
        isOn: () => preset === p,
      })),
      { name: 'Air drag', fn: () => { airDrag = !airDrag; }, isOn: () => airDrag },
      { name: 'Reset', fn: () => reset() },
    ],

    init(env) {
      ({ ctx, w: W, h: H, hud } = env);
      ppm = H / 5.2;              // view is 5.2 m tall
      floorY = H - Math.round(0.25 * ppm);
      wallPad = 0;
      // deep-copy preset restitution so slider edits don't persist across reloads
      PRESETS.forEach(p => { if (p._e0 === undefined) p._e0 = p.e; });
      reset();
    },

    frame(dt, ptr) {
      // -- interaction: grab & throw --------------------------------
      const [bx, by] = [ball.x * ppm, floorY - ball.y * ppm];
      if (ptr.justDown) {
        const d = Math.hypot(ptr.x - bx, ptr.y - by);
        if (d < Math.max(30, preset.r * ppm + 12)) grabbed = true;
      }
      if (grabbed) {
        if (ptr.down) {
          ball.x = clamp(ptr.x / ppm, preset.r, (W / ppm) - preset.r);
          ball.y = clamp((floorY - ptr.y) / ppm, preset.r, (floorY / ppm));
          ball.vx = 0; ball.vy = 0;
          ball.rolling = false; ball.stopped = false;
          trail.length = 0; marks.length = 0;
        } else {
          grabbed = false;
          ball.vx = clamp(ptr.vx / ppm, -15, 15);
          ball.vy = clamp(-ptr.vy / ppm, -15, 15);
          ball.e0 = energy(ball);
          tSim = 0;
        }
      }

      // -- physics, fixed substeps ----------------------------------
      acc += dt;
      while (acc >= SUB_DT) { step(SUB_DT); acc -= SUB_DT; }

      if (!ball.stopped && !grabbed) {
        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > 240) trail.shift();
      }

      render();

      const sp = Math.hypot(ball.vx, ball.vy);
      const e = energy(ball);
      hud.textContent =
        `${preset.name}   r=${(preset.r * 100).toFixed(1)} cm  m=${preset.m} kg\n` +
        `h = ${Math.max(0, ball.y - preset.r).toFixed(2)} m   ` +
        `v = ${sp.toFixed(2)} m/s\n` +
        `energy = ${(100 * e / Math.max(1e-9, ball.e0)).toFixed(1)} %` +
        (ball.stopped ? '   — at rest' : ball.rolling ? '   — rolling' : '');
    },
  };

  function render() {
    ctx.fillStyle = '#0d1017';
    ctx.fillRect(0, 0, W, H);

    // metre grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let m = 1; m * ppm < W; m++) { ctx.moveTo(m * ppm, 0); ctx.lineTo(m * ppm, floorY); }
    for (let m = 1; floorY - m * ppm > 0; m++) { ctx.moveTo(0, floorY - m * ppm); ctx.lineTo(W, floorY - m * ppm); }
    ctx.stroke();

    // floor
    ctx.fillStyle = '#232a38';
    ctx.fillRect(0, floorY, W, H - floorY);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, floorY, W, 2);

    // trail
    if (trail.length > 1) {
      ctx.beginPath();
      trail.forEach((p, i) => {
        const [x, y] = [p.x * ppm, floorY - p.y * ppm];
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.strokeStyle = 'rgba(90,160,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // bounce marks
    marks.slice(-12).forEach(mk => {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(mk.x * ppm - 1, floorY - 5, 2, 5);
    });

    // ball with simple shading + contact shadow
    const r = preset.r * ppm;
    const [x, y] = [ball.x * ppm, floorY - ball.y * ppm];
    const hgt = ball.y - preset.r;
    const shScale = clamp(1 - hgt / 4, 0.15, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.35 * shScale})`;
    ctx.beginPath();
    ctx.ellipse(x, floorY + 3, r * (0.6 + 0.6 * shScale), r * 0.18 * shScale + 2, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, preset.col);
    grad.addColorStop(1, shade(preset.col, 0.35));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(r, 3), 0, Math.PI * 2);
    ctx.fill();
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) * f, gc = ((n >> 8) & 255) * f, b = (n & 255) * f;
    return `rgb(${r | 0},${gc | 0},${b | 0})`;
  }

  Engine.register(sim);
})();
