'use strict';

/* ============================================================
 * Running figure — a kinematic gait model.
 *
 * The earlier version derived the legs from a spring-mass (SLIP)
 * physics model, which is correct dynamically but read as stiff
 * and "backwards". Natural running is dominated by the joint-angle
 * trajectories of the gait cycle, so this version drives the figure
 * directly from measured running kinematics (side / sagittal plane):
 *
 *   · a single gait phase φ advances at the cadence; the two legs
 *     are half a cycle out of step. Stance is ~38% of the cycle
 *     (running has two flight phases per stride — feet off the
 *     ground when neither leg is in stance).
 *   · SWING leg is forward-kinematic from real angle curves: the
 *     thigh swings from behind to in front, while the knee flexes
 *     to ~100–110° in mid-swing (heel tucked up toward the buttock)
 *     and re-extends to reach the next foot strike. This heel-up,
 *     high-knee recovery is the signature of a real running stride.
 *   · STANCE leg is inverse-kinematic to a PLANTED foot, so the
 *     contact point never skates; as the hip passes over it the
 *     knee naturally flexes (impact absorption) then extends
 *     (push-off). Knees always bend forward.
 *   · the hip rises and falls twice per stride — lowest at
 *     mid-stance, highest during flight — the running "bounce".
 *   · arms counter-swing to the legs with a flexed elbow; the
 *     trunk leans forward with speed.
 * 7.5-head proportions, side view.
 * ============================================================ */
(() => {
  let W, H, ctx, hud;
  let Hd, ppm, groundY;

  const Lr = 0.95;               // max leg length, m (thigh+shank)
  const H0 = 0.88;               // mean hip height, m
  let vDes = 4.2;                // running speed, m/s
  let bobAmp = 0.045;            // vertical COM oscillation amplitude, m
  let slowmo = false;

  // gait state
  let phi = 0;                   // gait phase [0,1)
  let x = 0;                     // COM world x (m)
  let camX = 0, dist = 0;
  const legStance = [false, false];
  const plantX = [0, 0];         // planted foot world-x while in stance
  const lastSwingAnkleX = [0, 0];
  const facing = 1;

  const D2R = Math.PI / 180;
  const smoother = s => s * s * s * (s * (s * 6 - 15) + 10);
  const cosd = a => Math.cos(a * D2R), sind = a => Math.sin(a * D2R);

  function dutyFactor() { return clamp(0.44 - 0.022 * vDes, 0.30, 0.42); }
  function strideTime() {         // seconds per full (two-step) stride
    const cadence = clamp(150 + 6 * (vDes - 3), 150, 186); // steps/min
    return 2 * 60 / cadence;
  }

  function reset() {
    phi = 0; x = 0; camX = 0; dist = 0;
    legStance[0] = legStance[1] = false;
    plantX[0] = -0.2; plantX[1] = 0.3;
    lastSwingAnkleX[0] = -0.2; lastSwingAnkleX[1] = 0.3;
  }

  // swing-leg joint angles (degrees) as a function of swing progress s∈[0,1]
  // thigh: measured from vertical, forward = +   ·   knee: flexion (≥0)
  function swingThighDeg(s) { return lerp(-20, 25, smoother(s)); }
  function swingKneeDeg(s) {
    // big mid-swing flexion (heel to buttock), small at both ends
    const bump = Math.exp(-((s - 0.42) / 0.30) * ((s - 0.42) / 0.30));
    return 22 + 88 * bump;
  }

  // world position of a swing leg's ankle for progress s (m, y-up from ground)
  function swingAnkle(hipXw, hipYw, s) {
    const th = swingThighDeg(s) * D2R;
    const kf = swingKneeDeg(s) * D2R;
    const thigh = Figure.SEG.thigh / Figure.HIP_HEADS * Lr;
    const shank = Figure.SEG.shank / Figure.HIP_HEADS * Lr;
    const kneeX = hipXw + facing * thigh * Math.sin(th);
    const kneeY = hipYw - thigh * Math.cos(th);
    const shAng = th - facing * kf;    // shank rotates back from thigh
    const ankX = kneeX + facing * shank * Math.sin(shAng);
    const ankY = kneeY - shank * Math.cos(shAng);
    return { kneeX, kneeY, ankX, ankY };
  }

  function pose() {
    const sx = wx => (wx - camX) * ppm + W * 0.42;
    const sy = wy => groundY - wy * ppm;

    // hip vertical bounce: lowest at mid-stance, highest in flight (2/stride)
    const D = dutyFactor();
    const hipYw = H0 + bobAmp * -Math.cos(2 * Math.PI * 2 * (phi - D * 0.5));
    const hipXw = x;
    const hipX = sx(hipXw), hipY = sy(hipYw);

    const lean = clamp(0.06 + vDes * 0.03, 0.08, 0.4);
    const spine = Figure.SEG.spine * Hd;
    const neckX = hipX + facing * Math.sin(lean) * spine;
    const neckY = hipY - Math.cos(lean) * spine;
    const hx = (Figure.SEG.neck + Figure.SEG.headR) * Hd;
    const J = {
      pelvis: { x: hipX, y: hipY },
      neck: { x: neckX, y: neckY },
      head: { x: neckX + facing * Math.sin(lean) * hx, y: neckY - Math.cos(lean) * hx },
    };
    J.shoulderN = J.shoulderF = { x: neckX, y: neckY };

    const thighPx = Figure.SEG.thigh * Hd, shankPx = Figure.SEG.shank * Hd;
    const footPx = Figure.SEG.foot * Hd;

    for (let leg = 0; leg < 2; leg++) {
      const p = (phi + leg * 0.5) % 1;
      const suf = leg === 0 ? 'N' : 'F';
      const stance = p < D;
      if (stance) {
        // pinned foot → IK; knee bulges forward (+facing)
        const fxW = plantX[leg];
        const ankScreenX = sx(fxW), ankScreenY = groundY;
        const kn = Figure.solve2(hipX, hipY, ankScreenX, ankScreenY, thighPx, shankPx, facing);
        J['knee' + suf] = { x: kn.x, y: kn.y };
        J['ankle' + suf] = { x: kn.fx, y: kn.fy };
        // foot flat on ground, pointing forward
        J['toe' + suf] = { x: kn.fx + facing * footPx, y: groundY };
      } else {
        const s = clamp((p - D) / (1 - D), 0, 1);
        const a = swingAnkle(hipXw, hipYw, s);
        lastSwingAnkleX[leg] = a.ankX;
        J['knee' + suf] = { x: sx(a.kneeX), y: sy(a.kneeY) };
        const ankX = sx(a.ankX), ankY = sy(a.ankY);
        J['ankle' + suf] = { x: ankX, y: ankY };
        // dorsiflexed foot (toe up) to clear the ground, pointing forward
        J['toe' + suf] = { x: ankX + facing * footPx * 0.95, y: ankY - footPx * 0.25 };
      }
    }

    // arms: counter-swing to the legs, elbow flexed ~90°
    const armAmp = clamp(0.5 + vDes * 0.05, 0.4, 0.95);
    const upper = Figure.SEG.upperArm * Hd, fore = Figure.SEG.foreArm * Hd;
    for (let arm = 0; arm < 2; arm++) {
      const suf = arm === 0 ? 'N' : 'F';
      // near arm opposite to near leg: near leg thigh forwardness ~ +cos(2πφ)
      const dir = arm === 0 ? 1 : -1;
      const swing = dir * armAmp * Math.cos(2 * Math.PI * phi);   // shoulder angle (rad from vertical, forward+)
      const sh = lean * 0.5 + swing;
      const ex = neckX + facing * Math.sin(sh) * upper;
      const ey = neckY + Math.cos(sh) * upper;                    // arm hangs down (+y)
      const fa = sh + facing * (1.5 - 0.3 * Math.cos(2 * Math.PI * phi) * dir); // flexed, swinging
      J['elbow' + suf] = { x: ex, y: ey };
      J['wrist' + suf] = { x: ex + facing * Math.sin(fa) * fore, y: ey + Math.cos(fa) * fore };
    }
    return J;
  }

  const sim = {
    name: 'Running Figure',
    icon: '🏃',
    info: 'A kinematic gait model built from measured running joint angles (side view). '
        + 'The swing leg flexes the knee to ~100° mid-swing — heel tucked up, high knee — '
        + 'then extends to reach the next foot strike; the stance foot is pinned so it '
        + 'never skates while the hip passes over it. The body bounces twice per stride. '
        + '7.5-head proportions.',

    controls: [
      { name: 'Speed (m/s)', min: 2, max: 7.5, step: 0.1,
        get: () => vDes, set: v => { vDes = v; }, fmt: v => v.toFixed(1) },
      { name: 'Bounce (cm)', min: 2, max: 9, step: 0.5,
        get: () => bobAmp * 100, set: v => { bobAmp = v / 100; }, fmt: v => v.toFixed(1) },
    ],
    actions: [
      { name: 'Slow-mo', fn: () => { slowmo = !slowmo; }, isOn: () => slowmo },
      { name: 'Reset', fn: () => reset() },
    ],

    init(env) {
      ({ ctx, w: W, h: H, hud } = env);
      Hd = (H * 0.5) / 7.5;
      ppm = (Figure.HIP_HEADS * Hd) / Lr;
      groundY = H * 0.82;
      reset();
    },

    frame(dt) {
      const d = slowmo ? dt * 0.28 : dt;
      const D = dutyFactor();
      // advance gait phase & detect stance transitions to plant feet
      const dphi = d / strideTime();
      const prevPhi = phi;
      phi = (phi + dphi) % 1;
      x += vDes * d;
      for (let leg = 0; leg < 2; leg++) {
        const p = (phi + leg * 0.5) % 1;
        const pPrev = (prevPhi + leg * 0.5) % 1;
        const stance = p < D, wasStance = pPrev < D;
        if (stance && !wasStance) plantX[leg] = lastSwingAnkleX[leg]; // foot strike
        legStance[leg] = stance;
      }
      camX = lerp(camX, x, 0.2);
      dist = x;
      render();

      const cadence = Math.round(120 / strideTime());
      const stepLen = vDes * strideTime() / 2;
      hud.textContent =
        `speed ${vDes.toFixed(1)} m/s  (${(vDes * 3.6).toFixed(1)} km/h)` + (slowmo ? '  · slow-mo' : '') + '\n' +
        `cadence ${cadence} steps/min   step ${stepLen.toFixed(2)} m\n` +
        `distance ${dist.toFixed(1)} m   ` +
        `phase ${(legStance[0] || legStance[1]) ? 'stance' : 'flight'}`;
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
    // contact shadow under any planted foot
    for (let leg = 0; leg < 2; leg++) {
      if (!legStance[leg]) continue;
      const fx = (plantX[leg] - camX) * ppm + W * 0.42;
      ctx.fillStyle = 'rgba(0,0,0,0.26)';
      ctx.beginPath();
      ctx.ellipse(fx, groundY + 3, Hd * 0.6, Hd * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    Figure.draw(ctx, J, Hd, { near: '#eef2f8', far: '#808b9c' });
  }

  Engine.register(sim);
})();
