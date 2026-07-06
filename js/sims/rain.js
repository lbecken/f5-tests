'use strict';

/* ============================================================
 * Rain — ballistic drops with size-dependent terminal velocity.
 *  - drop diameters sampled 0.5–4 mm (Marshall–Palmer-ish:
 *    small drops far more common than large ones)
 *  - fall speed from the empirical Atlas et al. (1973) law
 *      v_t = 9.65 − 10.3·e^(−600·D)  m/s   (D in metres)
 *  - horizontal motion follows the shared gust/turbulence model
 *  - streak length = v · exposure time (motion blur, 1/60 s)
 *  - impacts spawn a splash crown (ballistic droplets) and an
 *    expanding circular ripple on the wet ground
 *  - three depth layers with parallax (far = smaller, slower px)
 * ============================================================ */
(() => {
  const LAYERS = [
    { scale: 0.45, alpha: 0.25 },  // far
    { scale: 0.7,  alpha: 0.45 },
    { scale: 1.0,  alpha: 0.9 },   // near
  ];
  const EXPOSURE = 1 / 55;         // s of "shutter" for streaks

  let W, H, ctx, hud;
  let ppm;                         // px per metre (near layer)
  let groundY;
  let drops = [], splashes = [], ripples = [];
  let intensity = 60;              // mm/h rain rate
  let windMean = 3;                // m/s
  let t = 0;

  function vTerm(Dmm) {            // Atlas 1973, D in mm → m/s
    return Math.max(1, 9.65 - 10.3 * Math.exp(-0.6 * Dmm));
  }
  function sampleD() {             // skewed toward small drops
    return 0.5 + 3.5 * Math.pow(Math.random(), 2.2);
  }

  function spawnDrop() {
    const li = (Math.random() * 3) | 0;
    const L = LAYERS[li];
    const d = sampleD();
    drops.push({
      x: rand(-0.2 * W, 1.2 * W),
      y: rand(-80, -5),
      d, li,
      vt: vTerm(d),
      vx: 0,
    });
  }

  const sim = {
    name: 'Rain',
    icon: '🌧',
    info: 'Drop sizes follow a skewed distribution; each falls at its empirical '
        + 'terminal velocity v<sub>t</sub> = 9.65 − 10.3e<sup>−0.6D</sup> m/s '
        + '(Atlas 1973). Streak length is speed × shutter time; gusty wind '
        + 'slants the rain; impacts make splash crowns and ripples.',

    controls: [
      { name: 'Intensity (mm/h)', min: 2, max: 150, step: 1,
        get: () => intensity, set: v => { intensity = v; } },
      { name: 'Wind (m/s)', min: 0, max: 18, step: 0.5,
        get: () => windMean, set: v => { windMean = v; }, fmt: v => v.toFixed(1) },
    ],
    actions: [],

    init(env) {
      ({ ctx, w: W, h: H, hud } = env);
      ppm = H / 12;                // near layer sees ~12 m of height
      groundY = H - Math.round(H * 0.09);
      drops = []; splashes = []; ripples = [];
      t = 0;
      for (let i = 0; i < 250; i++) { spawnDrop(); drops[drops.length - 1].y = rand(0, H); }
    },

    frame(dt, ptr) {
      t += dt;
      // spawn rate ∝ intensity (flux of drops through the scene)
      const rate = intensity * 3.2;
      for (let n = rate * dt + (Math.random() < (rate * dt) % 1 ? 1 : 0); n >= 1; n--) spawnDrop();

      const wind = gustWind(t, windMean, 0.7); // m/s at this moment

      for (let i = drops.length - 1; i >= 0; i--) {
        const p = drops[i];
        const L = LAYERS[p.li];
        // horizontal: relax toward wind speed (small drops follow wind faster)
        const tau = 0.12 + p.d * 0.12;         // response time, s
        p.vx += (wind - p.vx) * Math.min(1, dt / tau);
        p.x += p.vx * ppm * L.scale * dt;
        p.y += p.vt * ppm * L.scale * dt;

        const gy = groundY + (p.li - 2) * 6;   // far layers hit slightly higher
        if (p.y >= gy) {
          if (p.li === 2 || Math.random() < 0.3) impact(p.x, gy, p);
          drops.splice(i, 1);
        } else if (p.x < -0.25 * W || p.x > 1.25 * W) {
          drops.splice(i, 1);
        }
      }

      // splash droplets: pure ballistics
      const g = 9.81 * ppm;
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.vy += g * dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.life -= dt;
        if (s.life <= 0 || s.y > groundY + 4) splashes.splice(i, 1);
      }
      // ripples: radius grows, fades
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.r += r.spd * dt;
        r.a -= dt * 1.6;
        if (r.a <= 0) ripples.splice(i, 1);
      }

      render(wind);
      hud.textContent =
        `${drops.length} drops   wind ${wind.toFixed(1)} m/s   ` +
        `v_t range ${vTerm(0.5).toFixed(1)}–${vTerm(4).toFixed(1)} m/s`;
    },
  };

  function impact(x, y, p) {
    const e = clamp(p.d / 4, 0.2, 1);          // bigger drop → bigger splash
    const n = (2 + e * 5) | 0;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + rand(-1, 1) * 1.1;
      const sp = rand(0.3, 1) * e * 2.2 * ppm; // ~2 m/s crown ejecta
      splashes.push({ x, y: y - 1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                      life: rand(0.15, 0.4) });
    }
    ripples.push({ x, y: y + 2, r: 1, spd: rand(25, 45) * e + 15, a: 0.5 * e + 0.2 });
  }

  function render(wind) {
    // night sky gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#10141d');
    bg.addColorStop(1, '#1a2130');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // wet ground with faint reflection sheen
    const gg = ctx.createLinearGradient(0, groundY, 0, H);
    gg.addColorStop(0, '#2a3448');
    gg.addColorStop(0.15, '#1c2434');
    gg.addColorStop(1, '#131926');
    ctx.fillStyle = gg;
    ctx.fillRect(0, groundY, W, H - groundY);

    // ripples (ellipses — ground seen at a grazing angle)
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    for (const r of ripples) {
      ctx.globalAlpha = Math.max(0, r.a);
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // drops as motion-blur streaks along their velocity vector
    ctx.lineCap = 'round';
    for (const p of drops) {
      const L = LAYERS[p.li];
      const lx = p.vx * ppm * L.scale * EXPOSURE;
      const ly = p.vt * ppm * L.scale * EXPOSURE;
      ctx.strokeStyle = `rgba(170,195,230,${L.alpha})`;
      ctx.lineWidth = clamp(p.d * 0.55 * L.scale, 0.5, 2.2);
      ctx.beginPath();
      ctx.moveTo(p.x - lx, p.y - ly);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    // splash droplets
    ctx.fillStyle = 'rgba(190,210,240,0.8)';
    for (const s of splashes) {
      ctx.fillRect(s.x - 0.7, s.y - 0.7, 1.4, 1.4);
    }
  }

  Engine.register(sim);
})();
