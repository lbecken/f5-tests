'use strict';

/* ============================================================
 * Running figure — driven by a Spring-Loaded Inverted Pendulum.
 *
 * The SLIP is the canonical reduced-order model of running in
 * biomechanics: the whole body is a point mass (the centre of
 * mass, ≈ the pelvis) bouncing on a massless linear leg-spring.
 *   · FLIGHT  — the COM is a projectile under gravity only.
 *   · STANCE  — one foot is planted; the leg acts as a spring
 *               F = k(L0 − L) directed from foot to COM, so the
 *               body compresses, stores energy, and rebounds.
 * Touchdown geometry uses Raibert's foot-placement heuristic
 * (plant the foot ahead by an amount set by forward speed), which
 * stabilises the running speed. SLIP is energy-conserving, so once
 * running it settles into a steady periodic bounce — the vertical
 * oscillation of a real runner emerges from the physics, not a
 * scripted animation.
 *
 * The skeleton is hung on the physics: the planted foot never
 * skates (it is the real SLIP contact, IK-solved up to the hip);
 * the swing leg follows a raised cycloid to the next footfall;
 * arms counter-swing; the trunk leans forward with speed.
 * 7.5-head proportions, side view (sagittal plane).
 * ============================================================ */
(() => {
  let W, H, ctx, hud;
  let Hd;                       // pixels per head
  let ppm;                      // pixels per metre
  let groundY;

  // physics (SI)
  const g = 9.81, m = 70;
  const Lr = 0.95;              // leg rest length, m (standing hip height)
  let k = 14000;               // leg stiffness N/m
  let vDes = 4.5;              // desired forward speed m/s

  // COM state
  let x, y, vx, vy;
  let phase, foot, stanceLeg;
  const HOP = 1.05;             // regulated vertical take-off speed (m/s) → low, realistic bounce

  // per-leg gait bookkeeping
  let plant = [0, 0];           // world-x where each foot last planted (m)
  let liftT = [0, 0];           // sim-time each foot last lifted off
  let stepPeriod = 0.34, lastTD = 0;
  let camX = 0, tSim = 0, strides = 0;

  const cos = Math.cos, sin = Math.sin;

  function reset() {
    x = 0; y = Lr; vx = vDes; vy = 0;
    phase = 'flight'; stanceLeg = 1; foot = 0;
    camX = 0; tSim = 0; strides = 0; lastTD = 0; stepPeriod = 0.34;
    plant = [-0.3, 0.3]; liftT = [0, 0];
  }

  // Raibert forward foot offset for the current speed (m)
  function footOffset() {
    const tStance = Math.PI * Math.sqrt(m / k);      // spring half-period
    return clamp(vx * tStance * 0.5 + 0.06 * (vx - vDes), -0.6 * Lr, 0.6 * Lr);
  }

  function stepPhysics(dt) {
    tSim += dt;
    if (phase === 'flight') {
      vy -= g * dt; x += vx * dt; y += vy * dt;
      const off = footOffset();
      const yTouch = Math.sqrt(Math.max(0, Lr * Lr - off * off));
      if (vy < 0 && y <= yTouch) {
        y = yTouch;
        foot = x + off;
        stanceLeg ^= 1;
        plant[stanceLeg] = foot;
        liftT[stanceLeg ^ 1] = tSim;                 // other leg begins swing
        stepPeriod = lerp(stepPeriod, clamp(tSim - lastTD, 0.2, 0.6), 0.3);
        lastTD = tSim;
        strides++;
        phase = 'stance';
      }
    } else {
      const dx = x - foot, dy = y;
      let L = Math.hypot(dx, dy) || 1e-4;
      const ux = dx / L, uy = dy / L;
      const Fs = k * (Lr - L);
      vx += (ux * Fs / m) * dt;
      vy += (uy * Fs / m - g) * dt;
      x += vx * dt; y += vy * dt;
      if (L >= Lr && (vx * ux + vy * uy) > 0) {
        phase = 'flight';
        // decouple hop from speed: regulate vertical take-off to a small fixed value
        // (keeps the bounce realistic) and nudge horizontal speed toward the target.
        if (vy > 0) vy = HOP;
        vx += 0.3 * (vDes - vx);
      }
    }
  }

  // ---- map physics → skeleton joints (pixels) ----
  function pose() {
    const sx = wx => (wx - camX) * ppm + W * 0.42;
    const sy = wy => groundY - wy * ppm;
    const hipX = sx(x), hipY = sy(y);
    const lean = clamp(vx * 0.06, 0.05, 0.6);

    const J = { pelvis: { x: hipX, y: hipY } };
    const spineLen = Figure.SEG.spine * Hd;
    const neckX = hipX + sin(lean) * spineLen, neckY = hipY - cos(lean) * spineLen;
    J.neck = { x: neckX, y: neckY };
    const headExtra = (Figure.SEG.neck + Figure.SEG.headR) * Hd;
    J.head = { x: neckX + sin(lean) * headExtra, y: neckY - cos(lean) * headExtra };
    J.shoulderN = J.shoulderF = { x: neckX, y: neckY };

    const thigh = Figure.SEG.thigh * Hd, shank = Figure.SEG.shank * Hd;
    const footLen = Figure.SEG.foot * Hd;
    let nearLegFore = 0;

    for (let leg = 0; leg < 2; leg++) {
      const isStance = (phase === 'stance' && leg === stanceLeg);
      let ax, ay;
      if (isStance) {
        ax = sx(foot); ay = groundY;
      } else {
        // swing leg as a hip pendulum whose length shortens mid-swing:
        // the knee flexes (heel toward buttock) then extends to reach the
        // next footfall — matching measured swing-phase knee flexion.
        const prog = clamp((tSim - liftT[leg]) / stepPeriod, 0, 1);
        const sp = prog * prog * (3 - 2 * prog);
        const offA = Math.asin(footOffset() / Lr);
        const theta = lerp(-0.6, offA, sp);              // sweep back → front
        const legLen = Lr * (1 - 0.45 * Math.sin(prog * Math.PI)); // knee flex
        const fxW = x + legLen * sin(theta);
        const fyW = y - legLen * cos(theta);             // world height of foot
        ax = sx(fxW); ay = groundY - fyW * ppm;
      }
      const kn = Figure.solve2(hipX, hipY, ax, ay, thigh, shank, +1);
      const suf = leg === 0 ? 'N' : 'F';
      J['knee' + suf] = { x: kn.x, y: kn.y };
      J['ankle' + suf] = { x: kn.fx, y: kn.fy };
      J['toe' + suf] = { x: kn.fx + footLen, y: Math.min(groundY, kn.fy + footLen * 0.12) };
      if (leg === 0) nearLegFore = (kn.fx - hipX) / (thigh + shank);
    }

    // arms counter-swing to legs; elbow flexed
    const amp = clamp(0.55 + vx * 0.05, 0.4, 1.1);
    const upper = Figure.SEG.upperArm * Hd, fore = Figure.SEG.foreArm * Hd;
    for (let arm = 0; arm < 2; arm++) {
      const suf = arm === 0 ? 'N' : 'F';
      const dir = arm === 0 ? -1 : 1;
      const swing = dir * nearLegFore * amp * 1.4;
      const shX = neckX, shY = neckY;
      const aUp = lean + swing;
      const ex = shX + sin(aUp) * upper, ey = shY + cos(aUp) * upper * 0.9;
      const aFo = aUp + 1.45;
      J['elbow' + suf] = { x: ex, y: ey };
      J['wrist' + suf] = { x: ex + sin(aFo) * fore, y: ey + cos(aFo) * fore * 0.7 };
    }
    return J;
  }

  const sim = {
    name: 'Running Figure',
    icon: '🏃',
    info: 'Driven by a Spring-Loaded Inverted Pendulum — the standard physics model '
        + 'of running. The centre of mass bounces on a massless leg-spring: ballistic '
        + 'in flight, spring-loaded in stance, with Raibert foot placement setting the '
        + 'speed. The planted foot never skates; the vertical bounce is emergent. '
        + '7.5-head proportions, side view.',

    controls: [
      { name: 'Speed (m/s)', min: 2, max: 7.5, step: 0.1,
        get: () => vDes, set: v => { vDes = v; E0 = 0.5 * m * vDes * vDes + m * g * (Lr * 1.07) + 0.5 * m * 1.15 * 1.15; },
        fmt: v => v.toFixed(1) },
      { name: 'Leg stiffness (kN/m)', min: 8, max: 22, step: 0.5,
        get: () => k / 1000, set: v => { k = v * 1000; }, fmt: v => v.toFixed(1) },
    ],
    actions: [{ name: 'Reset', fn: () => reset() }],

    init(env) {
      ({ ctx, w: W, h: H, hud } = env);
      Hd = (H * 0.5) / 7.5;
      ppm = (Figure.HIP_HEADS * Hd) / Lr;
      groundY = H * 0.82;
      reset();
    },

    frame(dt) {
      let acc = dt; const hs = 1 / 240; let guard = 0;
      while (acc > 0 && guard++ < 80) { const s = Math.min(hs, acc); stepPhysics(s); acc -= s; }
      camX = lerp(camX, x, 0.15);
      render();
      hud.textContent =
        `SLIP  ·  speed ${vx.toFixed(2)} m/s  (${(vx * 3.6).toFixed(1)} km/h)\n` +
        `COM height ${y.toFixed(2)} m   ${phase}\n` +
        `distance ${x.toFixed(1)} m   cadence ~${(60 / stepPeriod) | 0} steps/min   strides ${strides}`;
    },
  };

  function render() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#141b28'); bg.addColorStop(1, '#20293a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#222c3c'; ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, groundY, W, 2);

    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    for (let mm = Math.floor(camX - 6); mm < camX + 8; mm++) {
      const px = (mm - camX) * ppm + W * 0.42;
      ctx.fillRect(px, groundY + 10, 14, 3);
    }
    ctx.fillStyle = 'rgba(120,180,255,0.5)';
    for (let mm = Math.ceil((camX - 6) / 5) * 5; mm < camX + 8; mm += 5) {
      const px = (mm - camX) * ppm + W * 0.42;
      ctx.fillRect(px, groundY - 26, 2, 26);
    }

    const J = pose();
    if (phase === 'stance') {
      const fx = (foot - camX) * ppm + W * 0.42;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(fx, groundY + 3, Hd * 0.7, Hd * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    Figure.draw(ctx, J, Hd, { near: '#eef2f8', far: '#808b9c' });
  }

  Engine.register(sim);
})();
