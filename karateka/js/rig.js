/* rig.js — procedural 2D skeletal animation.
 *
 * A fighter is a small humanoid skeleton posed by joint angles (forward
 * kinematics). Angles are authored in degrees, facing right:
 *   - limbs (arms/legs): 0 = straight down, positive = toward facing direction
 *   - torso: 0 = upright, positive = lean forward
 *   - head: relative to torso
 *   - rot: whole-body rotation around the hip (used for knockdowns)
 *   - dy: hip drop in px (crouch / fall)
 * Mirroring for left-facing characters is a sign flip on the horizontal
 * component, so every animation is authored once.
 */
const Rig = (() => {
  // Bone lengths in internal-resolution pixels (character stands ~66px tall).
  const L = {
    thigh: 19, shin: 17, foot: 7,
    torso: 22, headDist: 9, headR: 5.5,
    upperArm: 14, foreArm: 13, fistR: 3,
  };
  const HIP_STAND = L.thigh + L.shin; // hip height over ground with legs straight

  const rad = (d) => (d * Math.PI) / 180;

  // End point of a bone: 0deg points down, positive angles swing forward.
  function limb(from, deg, len, facing) {
    const a = rad(deg);
    return { x: from.x + Math.sin(a) * len * facing, y: from.y + Math.cos(a) * len };
  }
  // Torso points up: 0deg upright, positive leans forward.
  function up(from, deg, len, facing) {
    const a = rad(deg);
    return { x: from.x + Math.sin(a) * len * facing, y: from.y - Math.cos(a) * len };
  }

  function rotAround(p, c, theta) {
    const dx = p.x - c.x, dy = p.y - c.y;
    const s = Math.sin(theta), co = Math.cos(theta);
    return { x: c.x + dx * co - dy * s, y: c.y + dx * s + dy * co };
  }

  /* Compute every joint position for a pose.
   * x: world x of the hip; groundY: floor line; facing: +1 right / -1 left. */
  function solve(pose, x, groundY, facing) {
    const hip = { x, y: groundY - HIP_STAND + (pose.dy || 0) };
    const neck = up(hip, pose.torso, L.torso, facing);
    const head = up(neck, pose.torso + pose.head, L.headDist, facing);
    const shoulder = up(hip, pose.torso, L.torso * 0.92, facing);

    const pts = {
      hip, neck, head, shoulder,
      elbowN: limb(shoulder, pose.uaN, L.upperArm, facing),
      elbowF: limb(shoulder, pose.uaF, L.upperArm, facing),
      kneeN: limb(hip, pose.thN, L.thigh, facing),
      kneeF: limb(hip, pose.thF, L.thigh, facing),
    };
    pts.handN = limb(pts.elbowN, pose.faN, L.foreArm, facing);
    pts.handF = limb(pts.elbowF, pose.faF, L.foreArm, facing);
    pts.ankleN = limb(pts.kneeN, pose.shN, L.shin, facing);
    pts.ankleF = limb(pts.kneeF, pose.shF, L.shin, facing);
    // Feet point forward, rotated by ft* (0 = flat on the ground).
    pts.toeN = { x: pts.ankleN.x + Math.cos(rad(pose.ftN || 0)) * L.foot * facing, y: pts.ankleN.y + Math.sin(rad(pose.ftN || 0)) * L.foot };
    pts.toeF = { x: pts.ankleF.x + Math.cos(rad(pose.ftF || 0)) * L.foot * facing, y: pts.ankleF.y + Math.sin(rad(pose.ftF || 0)) * L.foot };

    if (pose.rot) {
      const theta = rad(pose.rot) * facing;
      for (const k of Object.keys(pts)) pts[k] = rotAround(pts[k], hip, theta);
    }
    return pts;
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f);
    const g = Math.round(((n >> 8) & 255) * f);
    const b = Math.round((n & 255) * f);
    return `rgb(${r},${g},${b})`;
  }

  function seg(ctx, a, b, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  /* Draw a fighter. colors: { gi, skin, belt, hair }.
   * Far-side limbs are drawn darker and first, for depth (classic technique). */
  function draw(ctx, pts, colors, facing) {
    const far = 0.62;
    const giF = shade(colors.gi, far), skinF = shade(colors.skin, far);

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse((pts.ankleN.x + pts.ankleF.x) / 2, Math.max(pts.ankleN.y, pts.ankleF.y) + 3, 16, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // far arm & far leg
    seg(ctx, pts.shoulder, pts.elbowF, 4.5, giF);
    seg(ctx, pts.elbowF, pts.handF, 4, giF);
    ctx.fillStyle = skinF;
    ctx.beginPath(); ctx.arc(pts.handF.x, pts.handF.y, L.fistR, 0, Math.PI * 2); ctx.fill();
    seg(ctx, pts.hip, pts.kneeF, 5.5, giF);
    seg(ctx, pts.kneeF, pts.ankleF, 5, giF);
    seg(ctx, pts.ankleF, pts.toeF, 3.5, skinF);

    // torso + belt
    seg(ctx, pts.hip, pts.neck, 8, colors.gi);
    seg(ctx, pts.hip, { x: pts.hip.x + (pts.neck.x - pts.hip.x) * 0.18, y: pts.hip.y + (pts.neck.y - pts.hip.y) * 0.18 }, 8.5, colors.belt);

    // near leg
    seg(ctx, pts.hip, pts.kneeN, 5.5, colors.gi);
    seg(ctx, pts.kneeN, pts.ankleN, 5, colors.gi);
    seg(ctx, pts.ankleN, pts.toeN, 3.5, colors.skin);

    // head: skin circle + hair cap on the back half
    ctx.fillStyle = colors.skin;
    ctx.beginPath(); ctx.arc(pts.head.x, pts.head.y, L.headR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = colors.hair;
    ctx.beginPath();
    const a0 = facing === 1 ? Math.PI * 0.75 : Math.PI * 1.45;
    ctx.arc(pts.head.x, pts.head.y, L.headR + 0.5, a0, a0 + Math.PI * 0.8);
    ctx.arc(pts.head.x, pts.head.y, L.headR * 0.35, a0 + Math.PI * 0.8, a0, true);
    ctx.fill();
    // headband
    ctx.fillStyle = colors.belt;
    ctx.fillRect(pts.head.x - L.headR, pts.head.y - 2.5, L.headR * 2, 2);

    // near arm
    seg(ctx, pts.shoulder, pts.elbowN, 4.5, colors.gi);
    seg(ctx, pts.elbowN, pts.handN, 4, colors.gi);
    ctx.fillStyle = colors.skin;
    ctx.beginPath(); ctx.arc(pts.handN.x, pts.handN.y, L.fistR, 0, Math.PI * 2); ctx.fill();
  }

  return { L, HIP_STAND, solve, draw, shade };
})();
