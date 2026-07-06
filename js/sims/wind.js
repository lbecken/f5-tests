'use strict';

/* ============================================================
 * Wind — an invisible velocity field made visible.
 *  - wind speed = mean + slow gust envelope + fast turbulence
 *    (fractal 1/f noise, like real atmospheric gust spectra),
 *    plus spatial variation so gusts sweep across the screen
 *  - air tracers: massless particles advected by the local field,
 *    drawn as short streaks (like smoke/dust showing the flow)
 *  - grass: each blade is a damped harmonic oscillator driven by
 *    aerodynamic load q = ½ρu|u| — it bends to a new equilibrium
 *    in gusts and springs back, overshooting naturally
 *  - leaves: mass + drag (relax toward air velocity), gravity,
 *    tumbling; gusts can loft them off the ground again
 * ============================================================ */
(() => {
  const RHO = 1.225;
  let W, H, ctx, hud;
  let ppm, groundY;
  let windMean = 6, gustiness = 0.6;
  let t = 0;
  let tracers = [], blades = [], leaves = [];

  // local wind (m/s) at screen position — gust fronts travel with the mean flow
  function windAt(x, y, time) {
    const base = gustWind(time - x / (Math.max(1, windMean) * ppm) * 0.6, windMean, gustiness);
    const spatial = 1 + 0.35 * Noise.fbm2(x * 0.0015 - time * 0.15, y * 0.004, 3);
    const vert = 2.2 * Noise.fbm2(x * 0.003 + 31, y * 0.005 - time * 0.4, 3)
               * clamp(windMean / 8, 0.2, 1.2);
    return { u: base * spatial, v: vert };
  }

  function beaufort(u) {
    const scale = [
      [0.5, '0 calm'], [1.5, '1 light air'], [3.3, '2 light breeze'],
      [5.5, '3 gentle breeze'], [8, '4 moderate breeze'], [10.8, '5 fresh breeze'],
      [13.9, '6 strong breeze'], [17.2, '7 near gale'], [20.8, '8 gale'],
      [24.5, '9 strong gale'], [28.5, '10 storm'], [1e9, '11+ violent storm'],
    ];
    for (const [lim, name] of scale) if (u < lim) return name;
  }

  const sim = {
    name: 'Wind',
    icon: '🌬',
    info: 'Gusts from fractal (1/f) noise like real wind spectra. Tracers ride '
        + 'the field; every grass blade is a damped oscillator driven by dynamic '
        + 'pressure ½ρu², so it bends, springs back and overshoots; leaves have '
        + 'mass and drag and get lofted by strong gusts.',

    controls: [
      { name: 'Mean wind (m/s)', min: 0.5, max: 24, step: 0.5,
        get: () => windMean, set: v => { windMean = v; }, fmt: v => v.toFixed(1) },
      { name: 'Gustiness', min: 0, max: 1, step: 0.05,
        get: () => gustiness, set: v => { gustiness = v; }, fmt: v => v.toFixed(2) },
    ],
    actions: [],

    init(env) {
      ({ ctx, w: W, h: H, hud } = env);
      ppm = W / 40;                       // scene is ~40 m wide
      groundY = H - H * 0.12;
      t = 0;

      tracers = [];
      for (let i = 0; i < 260; i++) tracers.push(newTracer(true));

      blades = [];
      const n = Math.floor(W / 7);
      for (let i = 0; i < n; i++) {
        const L = rand(28, 74);
        blades.push({
          x: rand(0, W), y: groundY + rand(0, H * 0.1),
          L,
          k: rand(0.9, 2.2) * L / 50,     // stiffness ∝ thickness
          wn: rand(3.5, 7),               // natural frequency rad/s
          zeta: rand(0.25, 0.45),         // damping ratio (underdamped)
          th: 0, om: 0,
          col: `hsl(${rand(85, 130)},${rand(30, 45)}%,${rand(22, 38)}%)`,
        });
      }
      blades.sort((a, b) => a.y - b.y);

      leaves = [];
      for (let i = 0; i < 22; i++) {
        leaves.push({
          x: rand(0, W), y: rand(0, groundY),
          vx: 0, vy: 0, ang: rand(Math.PI * 2), spin: 0,
          size: rand(4, 8), tau: rand(0.25, 0.7),  // aero response time
          col: `hsl(${rand(20, 45)},${rand(50, 70)}%,${rand(35, 55)}%)`,
        });
      }
    },

    frame(dt, ptr) {
      t += dt;
      const uNow = gustWind(t, windMean, gustiness);

      // --- tracers (massless) ---
      for (const p of tracers) {
        const w = windAt(p.x, p.y, t);
        p.px = p.x; p.py = p.y;
        p.x += w.u * ppm * dt;
        p.y += w.v * ppm * dt;
        p.life -= dt;
        if (p.x > W + 10 || p.life <= 0 || p.y < -10 || p.y > H + 10)
          Object.assign(p, newTracer(false));
      }

      // --- grass: driven damped oscillator ---
      for (const b of blades) {
        const w = windAt(b.x, b.y - b.L * 0.6, t);
        const q = 0.5 * RHO * w.u * Math.abs(w.u);       // dynamic pressure
        const target = clamp(q * 0.012 / b.k, -1.35, 1.35);
        const acc = b.wn * b.wn * (target - b.th) - 2 * b.zeta * b.wn * b.om;
        b.om += acc * dt;
        b.th += b.om * dt;
      }

      // --- leaves ---
      for (const l of leaves) {
        const w = windAt(l.x, l.y, t);
        const onGround = l.y >= groundY - 2;
        // drag: velocity relaxes toward air velocity; gravity pulls down
        const f = Math.min(1, dt / l.tau);
        l.vx += (w.u * ppm - l.vx) * f;
        // flutter: alternating lift as the leaf tumbles
        const lift = Math.sin(l.ang * 2) * 0.35 * Math.abs(w.u);
        l.vy += ((w.v + lift) * ppm - l.vy) * f + 9.81 * ppm * dt * 0.35;
        l.spin = lerp(l.spin, (l.vx / ppm) * 0.6, 0.1);
        l.ang += l.spin * dt * 6;
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        if (l.y > groundY) {
          l.y = groundY; l.vy = 0;
          l.vx *= 0.82;                                  // ground friction
          // strong gust near the ground can loft the leaf again
          if (Math.abs(w.u) > 6 && Math.random() < 0.05)
            l.vy = -rand(1, 2.5) * ppm * clamp(Math.abs(w.u) / 10, 0.5, 1.6);
        }
        if (l.x > W + 20) { l.x = -15; l.y = rand(0, groundY); }
        if (l.x < -20) { l.x = W + 15; }
      }

      render(uNow);
      hud.textContent =
        `wind ${uNow.toFixed(1)} m/s  (${(uNow * 3.6).toFixed(0)} km/h)   ` +
        `Beaufort ${beaufort(Math.abs(uNow))}`;
    },
  };

  function newTracer(anywhere) {
    return {
      x: anywhere ? rand(0, W) : (windMean >= 0 ? rand(-40, 0) : rand(W, W + 40)),
      y: rand(0, H * 0.95),
      px: 0, py: 0,
      life: rand(2, 7),
      a: rand(0.1, 0.4),
    };
  }

  function render(uNow) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#141a26');
    bg.addColorStop(1, '#1b2331');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // tracers as streaks along their motion
    ctx.lineCap = 'round';
    for (const p of tracers) {
      if (!p.px) continue;
      const dx = p.x - p.px, dy = p.y - p.py;
      ctx.strokeStyle = `rgba(200,215,235,${p.a})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - dx * 3, p.y - dy * 3);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    // ground
    ctx.fillStyle = '#1a2415';
    ctx.fillRect(0, groundY, W, H - groundY);

    // grass blades: quadratic curve, tip displaced by sin(θ)
    for (const b of blades) {
      const tipX = b.x + Math.sin(b.th) * b.L;
      const tipY = b.y - Math.cos(b.th) * b.L;
      const cpX = b.x + Math.sin(b.th * 0.45) * b.L * 0.5;
      const cpY = b.y - b.L * 0.55;
      ctx.strokeStyle = b.col;
      ctx.lineWidth = clamp(b.L / 30, 1, 2.4);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.quadraticCurveTo(cpX, cpY, tipX, tipY);
      ctx.stroke();
    }

    // leaves
    for (const l of leaves) {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.ang);
      ctx.fillStyle = l.col;
      ctx.beginPath();
      ctx.ellipse(0, 0, l.size, l.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // wind vane arrow
    const ax = W - 70, ay = 40;
    const len = clamp(Math.abs(uNow) * 2.4, 6, 60) * Math.sign(uNow || 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax - len, ay);
    ctx.lineTo(ax + len, ay);
    ctx.lineTo(ax + len - 7 * Math.sign(len), ay - 5);
    ctx.moveTo(ax + len, ay);
    ctx.lineTo(ax + len - 7 * Math.sign(len), ay + 5);
    ctx.stroke();
  }

  Engine.register(sim);
})();
