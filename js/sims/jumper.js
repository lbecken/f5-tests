'use strict';

/* ============================================================
 * Jumping & falling figure — countermovement jump + landing.
 *
 * Real biomechanical phase sequence of a jump:
 *   stand → COUNTERMOVEMENT (crouch, eccentric dip of the COM)
 *         → PROPULSION (legs extend, COM accelerates upward)
 *         → TAKEOFF at full leg extension
 *         → FLIGHT (ballistic projectile under gravity)
 *         → LANDING (legs flex to brake the COM's momentum).
 *
 * Physics on the centre of mass (SI, rendered in screen pixels):
 *  · Push-off acceleration is derived from the target height h via
 *    the takeoff speed v = √(2gh) applied over the leg-extension
 *    distance d  (a = v²/2d) — the height slider is a real target
 *    reached by real kinematics.
 *  · At touchdown the landing speed is known; braking the COM over
 *    the legs' flex distance gives a peak ground-reaction force in
 *    bodyweights, BW = 1 + v_land²/(2·d·g). If that stays within
 *    what the legs can absorb, the figure flexes and recovers; if
 *    it exceeds the limit, the body COLLAPSES into a Verlet ragdoll
 *    (point masses + distance constraints) that tumbles and settles
 *    under gravity and friction.
 *
 * A gentle hop is stuck cleanly; a big drop off the ledge exceeds
 * the legs and the figure crumples — same force criterion decides.
 * 7.5-head proportions, side view.
 * ============================================================ */
(() => {
  let W, H, ctx, hud;
  let Hd, ppm, gpx;                // px/head, px/metre, gravity px/s²
  let groundY, ledgeY, ledgeScreenX;

  const g = 9.81, m = 70;
  const Lr = 0.95;                 // standing hip height (m)
  const CROUCH = 0.40;             // countermovement depth (fraction of leg)
  const LAND_MAX = 0.42;           // max leg-flex braking distance (fraction)
  const FORCE_LIMIT = 8.5;         // bodyweights the legs can absorb before collapse

  let LrPx;                        // Lr in px
  let hipX, hipY, vX, vY;          // COM in screen px (y-down)
  let phase, tPhase, forward, pushVx = 0, aNet = 0, vTo = 0;
  let landDepth = 0, landT = 0, landSurf = 0;
  let targetH = 0.55;              // desired jump height (m)
  let facing = 1;
  let msg = 'ready', peakBW = 0, apexH = 0, startFootY = 0;
  let ragdoll = null, settleT = 0;

  const cos = Math.cos, sin = Math.sin;

  const surfUnder = sx => (sx < ledgeScreenX ? ledgeY : groundY);

  function reset() {
    hipX = W * 0.30;
    hipY = ledgeY - LrPx;
    vX = 0; vY = 0;
    phase = 'stand'; tPhase = 0; forward = false;
    ragdoll = null; msg = 'ready'; peakBW = 0; apexH = 0;
  }

  function launch(fwd) {
    if (phase !== 'stand') return;
    forward = fwd; facing = 1;
    phase = 'crouch'; tPhase = 0; msg = 'countermovement';
    startFootY = surfUnder(hipX);
  }

  function beginPush() {
    const hPx = targetH * ppm;
    const d = CROUCH * LrPx;
    aNet = gpx * hPx / d;                  // net upward accel over extension
    vTo = Math.sqrt(2 * aNet * d);         // = √(2·g·h) in px/s
    pushVx = forward ? clamp(1.8 + targetH * 1.4, 1.6, 4.8) * ppm : 0;
    vX = pushVx * facing;
  }

  function stepPhysics(dt) {
    tPhase += dt;
    if (phase === 'crouch') {
      const T = 0.30, u = clamp(tPhase / T, 0, 1), s = u * u * (3 - 2 * u);
      hipY = (startFootY - LrPx) + CROUCH * LrPx * s;
      if (u >= 1) { phase = 'push'; tPhase = 0; beginPush(); msg = 'propulsion'; }
    } else if (phase === 'push') {
      vY += -aNet * dt;                    // accelerate upward
      hipY += vY * dt; hipX += vX * dt;
      if (hipY <= startFootY - LrPx) {     // legs fully extended → takeoff
        hipY = startFootY - LrPx; phase = 'flight'; tPhase = 0; msg = 'flight';
      }
    } else if (phase === 'flight') {
      vY += gpx * dt;
      hipX += vX * dt; hipY += vY * dt;
      apexH = Math.max(apexH, (startFootY - (hipY + LrPx)) / ppm);
      const surf = surfUnder(hipX);
      const footY = hipY + LrPx;
      if (vY > 0 && footY >= surf) {
        hipY = surf - LrPx;
        doLanding(surf);
      }
    } else if (phase === 'land') {
      const u = clamp(tPhase / landT, 0, 1);
      hipY = (landSurf - LrPx) + Math.sin(u * Math.PI) * landDepth;
      if (u >= 1) { phase = 'stand'; hipY = landSurf - LrPx; vX = vY = 0; msg = 'landed cleanly'; }
    } else if (phase === 'collapse') {
      stepRagdoll(dt);
    }
  }

  function doLanding(surf) {
    const vLand = vY / ppm;                // m/s downward
    const dAvail = LAND_MAX * Lr;
    peakBW = 1 + (vLand * vLand) / (2 * dAvail * g);
    if (peakBW <= FORCE_LIMIT) {
      landSurf = surf;
      landDepth = clamp(vLand * 0.055, 0.05, LAND_MAX) * LrPx;
      landT = clamp((landDepth / ppm) / Math.max(0.6, vLand) * 3.2, 0.14, 0.5);
      phase = 'land'; tPhase = 0; msg = `absorbing ${peakBW.toFixed(1)} BW`;
    } else {
      spawnRagdoll();
      phase = 'collapse'; tPhase = 0; settleT = 0;
      msg = `collapse — ${peakBW.toFixed(1)} BW exceeds legs`;
    }
  }

  // ---------- IK skeleton pose (all non-ragdoll phases) ----------
  function pose() {
    const thigh = Figure.SEG.thigh * Hd, shank = Figure.SEG.shank * Hd;
    const upper = Figure.SEG.upperArm * Hd, fore = Figure.SEG.foreArm * Hd;
    const footLen = Figure.SEG.foot * Hd;
    const inFlight = (phase === 'push' || phase === 'flight');

    const J = { pelvis: { x: hipX, y: hipY } };
    // small trunk lean: forward in flight, upright otherwise
    const lean = (phase === 'crouch') ? 0.35
               : (phase === 'flight') ? clamp(vX / ppm * 0.06, -0.2, 0.3) + 0.12
               : (phase === 'land') ? 0.22 : 0.06;
    const spine = Figure.SEG.spine * Hd;
    const neckX = hipX + sin(lean) * spine * facing, neckY = hipY - cos(lean) * spine;
    J.neck = { x: neckX, y: neckY };
    const hx = (Figure.SEG.neck + Figure.SEG.headR) * Hd;
    J.head = { x: neckX + sin(lean) * hx * facing, y: neckY - cos(lean) * hx };
    J.shoulderN = J.shoulderF = { x: neckX, y: neckY };

    for (let leg = 0; leg < 2; leg++) {
      const suf = leg === 0 ? 'N' : 'F';
      const spread = (leg === 0 ? 0.12 : -0.12) * Hd * facing;
      let ax, ay;
      if (inFlight) {
        // tuck: feet drawn up toward the hip, knees bent forward
        const tuck = phase === 'flight' ? 0.55 : 0.35;
        ax = hipX + (0.35 + spread / Hd) * Hd * facing;
        ay = hipY + LrPx * (1 - tuck);
      } else {
        const surf = surfUnder(hipX);
        ax = hipX + spread + 0.15 * Hd * facing;
        ay = surf;
      }
      const kn = Figure.solve2(hipX, hipY, ax, ay, thigh, shank, +1 * facing);
      J['knee' + suf] = { x: kn.x, y: kn.y };
      J['ankle' + suf] = { x: kn.fx, y: kn.fy };
      const toeUp = inFlight ? -footLen * 0.2 : footLen * 0.12;
      J['toe' + suf] = { x: kn.fx + footLen * facing, y: Math.min(surfUnder(kn.fx), kn.fy + toeUp) };
    }

    // arm angles measured from straight-down; +cos points downward.
    // crouch: swung down-and-back · push/flight: thrown up overhead ·
    // land: forward for balance · stand: hanging.
    let aUp, aFo;
    if (phase === 'crouch') { aUp = -1.0; aFo = -0.5; }
    else if (inFlight) { aUp = 2.7; aFo = 2.95; }
    else if (phase === 'land') { aUp = 1.2; aFo = 1.6; }
    else { aUp = 0.28; aFo = 0.15; }
    for (let arm = 0; arm < 2; arm++) {
      const suf = arm === 0 ? 'N' : 'F';
      const d = arm === 0 ? 0.13 : -0.13;            // split so arms don't overlap
      const exx = neckX + Math.sin(aUp + d) * upper * facing;
      const eyy = neckY + Math.cos(aUp) * upper;
      const wxx = exx + Math.sin(aFo + d) * fore * facing;
      const wyy = eyy + Math.cos(aFo) * fore;
      J['elbow' + suf] = { x: exx, y: eyy };
      J['wrist' + suf] = { x: wxx, y: wyy };
    }
    return J;
  }

  // ---------- Verlet ragdoll ----------
  function spawnRagdoll() {
    const J = pose();
    const names = ['head', 'neck', 'pelvis', 'elbowN', 'wristN', 'elbowF', 'wristF',
                   'kneeN', 'ankleN', 'kneeF', 'ankleF'];
    const pts = {};
    const stepV = 1 / 60;
    for (const n of names) {
      const p = J[n];
      pts[n] = { x: p.x, y: p.y, px: p.x - vX * stepV + rand(-1, 1), py: p.y - vY * stepV + rand(-1, 1) };
    }
    const link = (a, b) => ({ a, b, len: Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y) });
    const cons = [
      link('head', 'neck'), link('neck', 'pelvis'),
      link('neck', 'elbowN'), link('elbowN', 'wristN'),
      link('neck', 'elbowF'), link('elbowF', 'wristF'),
      link('pelvis', 'kneeN'), link('kneeN', 'ankleN'),
      link('pelvis', 'kneeF'), link('kneeF', 'ankleF'),
      // a couple of stiffeners so the torso keeps shape
      link('head', 'pelvis'),
    ];
    ragdoll = { pts, cons };
  }

  function stepRagdoll(dt) {
    const { pts, cons } = ragdoll;
    const damp = 0.99;
    const dt2 = (1 / 60) * (1 / 60);       // fixed verlet step
    for (const n in pts) {
      const p = pts[n];
      const nx = p.x + (p.x - p.px) * damp;
      const ny = p.y + (p.y - p.py) * damp + gpx * dt2;
      p.px = p.x; p.py = p.y; p.x = nx; p.y = ny;
    }
    for (let it = 0; it < 12; it++) {
      for (const c of cons) {
        const a = pts[c.a], b = pts[c.b];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy) || 1e-4;
        const diff = (d - c.len) / d * 0.5;
        dx *= diff; dy *= diff;
        a.x += dx; a.y += dy; b.x -= dx; b.y -= dy;
      }
      // ground / ledge collision + friction
      for (const n in pts) {
        const p = pts[n];
        const surf = surfUnder(p.x);
        if (p.y > surf) {
          const vx = (p.x - p.px);
          p.y = surf;
          p.px = p.x + vx * 0.5;             // friction (reverse a bit of slide)
        }
      }
    }
    // settle detection
    let mo = 0;
    for (const n in pts) { const p = pts[n]; mo += Math.abs(p.x - p.px) + Math.abs(p.y - p.py); }
    if (mo < 0.6) { settleT += dt; if (settleT > 1.6) { msg = 'collapsed — reset to try again'; } }
    else settleT = 0;
  }

  function ragdollJoints() {
    const p = ragdoll.pts;
    return {
      head: p.head, neck: p.neck, pelvis: p.pelvis,
      shoulderN: p.neck, shoulderF: p.neck,
      elbowN: p.elbowN, wristN: p.wristN, elbowF: p.elbowF, wristF: p.wristF,
      kneeN: p.kneeN, ankleN: p.ankleN, kneeF: p.kneeF, ankleF: p.ankleF,
      toeN: { x: p.ankleN.x + Figure.SEG.foot * Hd * facing, y: p.ankleN.y },
      toeF: { x: p.ankleF.x + Figure.SEG.foot * Hd * facing, y: p.ankleF.y },
    };
  }

  const sim = {
    name: 'Jump & Fall',
    icon: '🤸',
    info: 'Countermovement jump: crouch → propulsion → ballistic flight → landing '
        + 'absorption. Push-off accel comes from the target height via v=√(2gh); at '
        + 'touchdown the peak ground-reaction force (bodyweights) is computed from the '
        + 'landing speed and leg-flex distance. Under the limit it flexes and recovers; '
        + 'over it, the body collapses into a Verlet ragdoll. <b>Use the buttons.</b>',

    controls: [
      { name: 'Jump height (m)', min: 0.2, max: 1.4, step: 0.05,
        get: () => targetH, set: v => { targetH = v; }, fmt: v => v.toFixed(2) },
      { name: 'Drop height (m)', min: 0, max: 4, step: 0.25,
        get: () => (groundY - ledgeY) / ppm,
        set: v => { ledgeY = groundY - v * ppm; if (phase === 'stand') hipY = ledgeY - LrPx; },
        fmt: v => v.toFixed(2) },
    ],
    actions: [
      { name: 'Jump up', fn: () => launch(false) },
      { name: 'Leap off ledge', fn: () => launch(true) },
      { name: 'Reset', fn: () => reset() },
    ],

    init(env) {
      ({ ctx, w: W, h: H, hud } = env);
      // scale so the standing figure + the full 4 m drop range fit vertically
      ppm = H * 0.13;
      Hd = ppm * Lr / Figure.HIP_HEADS;
      gpx = g * ppm;
      LrPx = Figure.HIP_HEADS * Hd;
      groundY = H * 0.9;
      ledgeY = groundY - 2 * ppm;           // default 2 m drop
      ledgeScreenX = W * 0.46;
      reset();
    },

    frame(dt) {
      let acc = dt; const hs = 1 / 240; let guard = 0;
      while (acc > 0 && guard++ < 80) { const s = Math.min(hs, acc); stepPhysics(s); acc -= s; }
      render();
      const stateLine = phase === 'collapse'
        ? `RAGDOLL · ${Object.keys(ragdoll.pts).length} nodes, ${ragdoll.cons.length} constraints`
        : `phase: ${phase}`;
      hud.textContent =
        `${msg}\n${stateLine}\n` +
        `target ${targetH.toFixed(2)} m · apex ${apexH.toFixed(2)} m` +
        (peakBW ? ` · landing ${peakBW.toFixed(1)} BW (limit ${FORCE_LIMIT})` : '');
    },
  };

  function render() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#141b28'); bg.addColorStop(1, '#20293a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // low ground
    ctx.fillStyle = '#222c3c'; ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(0, groundY, W, 2);
    // ledge platform
    ctx.fillStyle = '#2b3446';
    ctx.fillRect(0, ledgeY, ledgeScreenX, groundY - ledgeY);
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(0, ledgeY, ledgeScreenX, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(ledgeScreenX - 3, ledgeY, 3, groundY - ledgeY);

    // height ticks on the ledge face
    ctx.fillStyle = 'rgba(120,180,255,0.35)';
    for (let mm = 1; ledgeY + mm * ppm < groundY; mm++) {
      ctx.fillRect(ledgeScreenX + 4, groundY - mm * ppm, 10, 2);
    }

    const J = (phase === 'collapse') ? ragdollJoints() : pose();

    // contact shadow
    if (phase !== 'flight' && phase !== 'push') {
      const surf = surfUnder(hipX);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(hipX, surf + 3, Hd * 0.8, Hd * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    Figure.draw(ctx, J, Hd, { near: '#eef2f8', far: '#808b9c' });
  }

  Engine.register(sim);
})();
