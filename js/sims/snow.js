'use strict';

/* ============================================================
 * Snow — slow-fall aerodynamics + accumulation.
 *  - snowflakes fall at realistic ~0.5–1.5 m/s terminal velocity
 *    (barely size-dependent — big flakes are fluffy, low density)
 *  - flutter: side-to-side oscillation from vortex shedding,
 *    each flake with its own frequency/phase, plus gust drift
 *  - accumulation: per-column height maps on the ground AND on
 *    a cabin roof; deposits relax sideways whenever the local
 *    slope exceeds the repose angle of fresh snow, so drifts
 *    build smooth natural profiles; snow slides off roof edges
 *  - three parallax depth layers
 * ============================================================ */
(() => {
  const REPOSE = Math.tan(35 * Math.PI / 180); // repose slope of settling snow
  let W, H, ctx, hud;
  let ppm, groundY;
  let flakes = [];
  let windMean = 1.5, rate = 400;
  let ground, roof;               // accumulation surfaces
  let cabin;
  let t = 0;

  function newFlake(anywhere) {
    const layer = Math.random();               // 0 far … 1 near
    const s = 0.35 + layer * 0.65;             // parallax scale
    const d = rand(1, 4) * s;                  // rendered size, px
    return {
      x: rand(-0.1 * W, 1.1 * W),
      y: anywhere ? rand(-H * 0.1, H) : rand(-40, -5),
      s, d,
      vt: rand(0.5, 1.5),                      // m/s terminal fall speed
      fA: rand(8, 26),                         // flutter amplitude px
      fW: rand(0.8, 2.2),                      // flutter freq Hz
      ph: rand(Math.PI * 2),
      vx: 0,
    };
  }

  function makeSurface(x0, x1, y) {
    const n = Math.max(2, Math.round(x1 - x0));
    return { x0, x1, y, h: new Float32Array(n) };
  }

  function deposit(surf, x, amt) {
    // a flake is a few px wide — spread its mass over neighbouring columns
    const i = clamp(Math.round(x - surf.x0), 0, surf.h.length - 1);
    surf.h[i] += amt * 0.5;
    surf.h[Math.max(0, i - 1)] += amt * 0.25;
    surf.h[Math.min(surf.h.length - 1, i + 1)] += amt * 0.25;
  }

  // granular relaxation: flow downhill when slope exceeds repose
  function relax(surf, spill) {
    const h = surf.h;
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < h.length - 1; i++) {
        const diff = h[i] - h[i + 1];
        if (diff > REPOSE) { const q = (diff - REPOSE) * 0.25; h[i] -= q; h[i + 1] += q; }
        else if (-diff > REPOSE) { const q = (-diff - REPOSE) * 0.25; h[i + 1] -= q; h[i] += q; }
      }
    }
    if (spill) {
      // snow pushed past the ends slides off and lands below
      if (h[0] > 2) { spill(surf.x0, h[0] * 0.3); h[0] *= 0.7; }
      const e = h.length - 1;
      if (h[e] > 2) { spill(surf.x1, h[e] * 0.3); h[e] *= 0.7; }
    }
  }

  function surfaceTop(surf, x) {
    if (x < surf.x0 || x > surf.x1) return Infinity;
    return surf.y - surf.h[clamp(Math.round(x - surf.x0), 0, surf.h.length - 1)];
  }

  const sim = {
    name: 'Snow',
    icon: '❄',
    info: 'Flakes fall at their real ~1 m/s terminal velocity and flutter from '
        + 'vortex shedding, drifting with gusts. Landed snow builds per-column '
        + 'height fields that relax to the repose angle of fresh snow — watch '
        + 'drifts grow on the ground and the cabin roof, and slide off the eaves.',

    controls: [
      { name: 'Snowfall rate', min: 20, max: 800, step: 10,
        get: () => rate, set: v => { rate = v; } },
      { name: 'Wind (m/s)', min: 0, max: 10, step: 0.25,
        get: () => windMean, set: v => { windMean = v; }, fmt: v => v.toFixed(2) },
    ],
    actions: [
      { name: 'Clear snow', fn: () => { ground.h.fill(0); roof.h.fill(0); } },
    ],

    init(env) {
      ({ ctx, w: W, h: H, hud } = env);
      ppm = H / 10;                              // ~10 m tall scene
      groundY = H - 26;
      t = 0;
      cabin = {
        x: W * 0.62, w: Math.min(220, W * 0.22),
        y: groundY - Math.min(150, H * 0.22), // roof line
      };
      ground = makeSurface(0, W, groundY);
      roof = makeSurface(cabin.x, cabin.x + cabin.w, cabin.y);
      flakes = [];
      for (let i = 0; i < 400; i++) flakes.push(newFlake(true));
    },

    frame(dt, ptr) {
      t += dt;
      const want = clamp(rate, 20, 1500);
      while (flakes.length < want) flakes.push(newFlake(false));
      if (flakes.length > want * 1.2) flakes.length = Math.round(want * 1.2);

      const wind = gustWind(t, windMean, 0.8);

      for (const f of flakes) {
        // horizontal: relax toward wind (flakes are light — fast response)
        f.vx += (wind - f.vx) * Math.min(1, dt / 0.3);
        const flutter = Math.cos(t * f.fW * Math.PI * 2 + f.ph) * f.fA * f.s;
        f.x += (f.vx * ppm * f.s + flutter) * dt;
        f.y += f.vt * ppm * f.s * dt;

        // near/mid-layer flakes accumulate; far layers just vanish at ground level
        const near = f.s > 0.55;
        let landY = groundY - (near ? ground.h[clamp(Math.round(f.x), 0, ground.h.length - 1)] : -6);
        if (near) {
          const rTop = surfaceTop(roof, f.x);
          if (rTop < landY && f.y >= rTop) {
            deposit(roof, f.x, 1.5 + f.d);
            Object.assign(f, newFlake(false));
            continue;
          }
        }
        if (f.y >= landY) {
          if (near && f.x >= 0 && f.x < W) deposit(ground, f.x, 1.5 + f.d);
          Object.assign(f, newFlake(false));
          continue;
        }
        if (f.x > 1.15 * W) f.x = -0.1 * W;
        if (f.x < -0.15 * W) f.x = 1.1 * W;
      }

      relax(roof, (x, amt) => deposit(ground, x, amt));
      relax(ground, null);

      render();
      const depth = Math.max(...ground.h) / ppm * 100;
      hud.textContent =
        `${flakes.length} flakes   wind ${wind.toFixed(1)} m/s   ` +
        `deepest drift ${depth.toFixed(0)} cm`;
    },
  };

  function drawSurfaceSnow(surf) {
    ctx.beginPath();
    ctx.moveTo(surf.x0, surf.y);
    for (let i = 0; i < surf.h.length; i++) {
      ctx.lineTo(surf.x0 + i, surf.y - surf.h[i]);
    }
    ctx.lineTo(surf.x1, surf.y);
    ctx.closePath();
    ctx.fillStyle = '#e8eef8';
    ctx.fill();
  }

  function render() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#151b28');
    bg.addColorStop(1, '#232c3e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ground band
    ctx.fillStyle = '#242c3c';
    ctx.fillRect(0, groundY, W, H - groundY);

    // cabin
    ctx.fillStyle = '#3a2f28';
    ctx.fillRect(cabin.x, cabin.y, cabin.w, groundY - cabin.y);
    ctx.fillStyle = '#2a221d';
    ctx.fillRect(cabin.x, cabin.y, cabin.w, 6);
    ctx.fillStyle = '#ffd98a';
    ctx.fillRect(cabin.x + cabin.w * 0.2, cabin.y + 40, 26, 30); // lit window
    ctx.fillRect(cabin.x + cabin.w * 0.65, cabin.y + 40, 26, 30);

    // accumulated snow
    drawSurfaceSnow(roof);
    drawSurfaceSnow(ground);

    // flakes (far layers dimmer)
    for (const f of flakes) {
      const a = 0.25 + f.s * 0.75;
      ctx.fillStyle = `rgba(240,245,255,${a})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, Math.max(0.6, f.d / 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  Engine.register(sim);
})();
