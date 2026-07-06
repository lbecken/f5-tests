'use strict';

/* ============================================================
 * Shared human-figure model for the runner & jumper sims.
 *
 * Proportions: the classical 7.5-head artistic canon (1 unit =
 * one head height). Landmarks below are measured in "heads" and
 * match standard figure-drawing / anthropometric references:
 *   top 0 · chin 1.0 · shoulders 1.5 · elbow ~2.9 · wrist ~4.4 ·
 *   hip/pelvis 4.0 · knee ~5.9 · ankle/sole 7.5
 * Everything is drawn in the sagittal (side) plane, because that
 * is the plane running and jumping physics actually live in.
 * Near-side limbs are drawn bright, far-side limbs dimmed, which
 * is the conventional way to read a profile figure in motion.
 * ============================================================ */

const Figure = (() => {
  // segment lengths in head-units
  const SEG = {
    headR: 0.5,      // head radius (head is 1 unit tall)
    neck: 0.35,      // top-of-spine → head bottom
    spine: 2.5,      // shoulder line → pelvis
    upperArm: 1.4,
    foreArm: 1.45,   // includes hand
    thigh: 1.9,
    shank: 1.55,
    foot: 0.95,
  };
  // standing hip height (pelvis above sole) in heads → used to scale physics
  const HIP_HEADS = SEG.thigh + SEG.shank;   // 3.45

  /* two-link inverse kinematics: given root A and target B and two
   * segment lengths, return the middle joint. `side` (+1/-1) picks
   * which of the two elbow/knee solutions (bend direction). */
  function solve2(ax, ay, bx, by, l1, l2, side) {
    let dx = bx - ax, dy = by - ay;
    let d = Math.hypot(dx, dy);
    const dmin = Math.abs(l1 - l2) + 1e-4, dmax = l1 + l2 - 1e-4;
    if (d < dmin) d = dmin; if (d > dmax) d = dmax;
    if (d < 1e-6) d = 1e-6;
    const ux = dx / d, uy = dy / d;
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const mx = ax + ux * a, my = ay + uy * a;
    // perpendicular
    return { x: mx + side * (-uy) * h, y: my + side * (ux) * h,
             // also return the clamped foot so caller can avoid overreach artefacts
             fx: ax + ux * d, fy: ay + uy * d };
  }

  /* Draw a capsule-style bone. */
  function bone(ctx, x1, y1, x2, y2, w, col) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  /* Render the figure from a joint dictionary (all in pixels).
   * Required points: head, neck, pelvis, and near/far limb chains:
   *   shoulderN/F, elbowN/F, wristN/F, kneeN/F, ankleN/F, toeN/F
   */
  function draw(ctx, J, H, opt = {}) {
    const near = opt.near || '#e9edf5';
    const far = opt.far || '#7d8798';
    const wLimb = H * 0.16;
    const wTorso = H * 0.26;

    // ---- far side first (depth) ----
    bone(ctx, J.pelvis.x, J.pelvis.y, J.kneeF.x, J.kneeF.y, wLimb, far);
    bone(ctx, J.kneeF.x, J.kneeF.y, J.ankleF.x, J.ankleF.y, wLimb, far);
    bone(ctx, J.ankleF.x, J.ankleF.y, J.toeF.x, J.toeF.y, wLimb * 0.8, far);
    bone(ctx, J.shoulderF.x, J.shoulderF.y, J.elbowF.x, J.elbowF.y, wLimb * 0.85, far);
    bone(ctx, J.elbowF.x, J.elbowF.y, J.wristF.x, J.wristF.y, wLimb * 0.8, far);

    // ---- torso ----
    bone(ctx, J.neck.x, J.neck.y, J.pelvis.x, J.pelvis.y, wTorso, near);

    // ---- head ----
    ctx.fillStyle = near;
    ctx.beginPath();
    ctx.arc(J.head.x, J.head.y, H * SEG.headR, 0, Math.PI * 2);
    ctx.fill();
    // short neck stub
    bone(ctx, J.neck.x, J.neck.y, J.head.x, J.head.y + H * SEG.headR * 0.6,
         wLimb * 0.7, near);

    // ---- near side ----
    bone(ctx, J.pelvis.x, J.pelvis.y, J.kneeN.x, J.kneeN.y, wLimb, near);
    bone(ctx, J.kneeN.x, J.kneeN.y, J.ankleN.x, J.ankleN.y, wLimb, near);
    bone(ctx, J.ankleN.x, J.ankleN.y, J.toeN.x, J.toeN.y, wLimb * 0.8, near);
    bone(ctx, J.shoulderN.x, J.shoulderN.y, J.elbowN.x, J.elbowN.y, wLimb * 0.9, near);
    bone(ctx, J.elbowN.x, J.elbowN.y, J.wristN.x, J.wristN.y, wLimb * 0.85, near);
  }

  return { SEG, HIP_HEADS, solve2, draw, bone };
})();
