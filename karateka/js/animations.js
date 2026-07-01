/* animations.js — keyframed poses + interpolation.
 *
 * Every animation is a list of keyframes {t: 0..1, p: partial pose}.
 * Missing pose fields fall back to the animation's base stance, so keyframes
 * only describe what moves. The sampler interpolates between keyframes with
 * smoothstep easing, which is what gives the motion its rotoscoped feel.
 */
const Anim = (() => {
  // Relaxed upright stance (walking/running "travel" stance).
  const TRAVEL = {
    torso: 0, head: 2, rot: 0, dy: 0,
    uaN: 8, faN: 14, uaF: -6, faF: 2,
    thN: 5, shN: 2, thF: -5, shF: -3, ftN: 0, ftF: 0,
  };

  // Side-on fighting stance: knees bent, guard up.
  const FIGHT = {
    torso: 6, head: 4, rot: 0, dy: 5,
    uaN: 40, faN: 130, uaF: 22, faF: 115,
    thN: 24, shN: 8, thF: -20, shF: -32, ftN: 0, ftF: -25,
  };

  const A = {};

  A.travel_idle = {
    dur: 2.4, loop: true, base: TRAVEL,
    frames: [
      { t: 0, p: {} },
      { t: 0.5, p: { torso: 1.5, dy: 1, uaN: 10, uaF: -8 } },
      { t: 1, p: {} },
    ],
  };

  A.walk = {
    dur: 0.85, loop: true, base: TRAVEL, steps: [0.05, 0.55],
    frames: [
      { t: 0,    p: { thN: 26, shN: 18, thF: -22, shF: -34, ftF: -30, uaN: -16, faN: -10, uaF: 20, faF: 28, dy: 1, torso: 2 } },
      { t: 0.25, p: { thN: 10, shN: -14, thF: 2, shF: -2, uaN: 0, faN: 6, uaF: 4, faF: 10, dy: 3, torso: 3 } },
      { t: 0.5,  p: { thN: -22, shN: -34, ftN: -30, thF: 26, shF: 18, uaN: 20, faN: 28, uaF: -16, faF: -10, dy: 1, torso: 2 } },
      { t: 0.75, p: { thN: 2, shN: -2, thF: 10, shF: -14, uaN: 4, faN: 10, uaF: 0, faF: 6, dy: 3, torso: 3 } },
      { t: 1,    p: { thN: 26, shN: 18, thF: -22, shF: -34, ftF: -30, uaN: -16, faN: -10, uaF: 20, faF: 28, dy: 1, torso: 2 } },
    ],
  };

  A.run = {
    dur: 0.5, loop: true, base: TRAVEL, steps: [0.1, 0.6],
    frames: [
      { t: 0,    p: { torso: 14, thN: 48, shN: 26, thF: -34, shF: -66, ftF: -45, uaN: -30, faN: 44, uaF: 42, faF: 116, dy: 3 } },
      { t: 0.25, p: { torso: 15, thN: 12, shN: -30, thF: 8, shF: -34, dy: 6, uaN: 6, faN: 76, uaF: 6, faF: 82 } },
      { t: 0.5,  p: { torso: 14, thN: -34, shN: -66, ftN: -45, thF: 48, shF: 26, uaN: 42, faN: 116, uaF: -30, faF: 44, dy: 3 } },
      { t: 0.75, p: { torso: 15, thN: 8, shN: -34, thF: 12, shF: -30, dy: 6, uaN: 6, faN: 82, uaF: 6, faF: 76 } },
      { t: 1,    p: { torso: 14, thN: 48, shN: 26, thF: -34, shF: -66, ftF: -45, uaN: -30, faN: 44, uaF: 42, faF: 116, dy: 3 } },
    ],
  };

  A.fight_idle = {
    dur: 1.1, loop: true, base: FIGHT,
    frames: [
      { t: 0, p: {} },
      { t: 0.5, p: { dy: 7.5, uaN: 44, faN: 126, uaF: 26, faF: 111, torso: 7 } },
      { t: 1, p: {} },
    ],
  };

  // Small advancing/retreating shuffle in fighting stance.
  A.fight_step = {
    dur: 0.5, loop: true, base: FIGHT, steps: [0.05, 0.55],
    frames: [
      { t: 0, p: { thN: 32, shN: 16, thF: -14, shF: -26 } },
      { t: 0.5, p: { thN: 16, shN: 2, thF: -28, shF: -40, dy: 7 } },
      { t: 1, p: { thN: 32, shN: 16, thF: -14, shF: -26 } },
    ],
  };

  // ---- attacks (near arm / near leg is the striking limb) ----

  A.punch_high = {
    dur: 0.36, loop: false, base: FIGHT,
    frames: [
      { t: 0, p: {} },
      { t: 0.3, p: { uaN: 24, faN: 152, torso: 2, dy: 6 } },                      // chamber
      { t: 0.55, p: { uaN: 96, faN: 99, torso: 17, head: -6, dy: 6, uaF: 4, faF: 96 } }, // full extension at head height
      { t: 1, p: {} },
    ],
  };

  A.punch_mid = {
    dur: 0.34, loop: false, base: FIGHT,
    frames: [
      { t: 0, p: {} },
      { t: 0.3, p: { uaN: 20, faN: 140, torso: 3, dy: 7 } },
      { t: 0.55, p: { uaN: 80, faN: 84, torso: 15, dy: 8, uaF: 2, faF: 90 } },
      { t: 1, p: {} },
    ],
  };

  A.punch_low = {
    dur: 0.34, loop: false, base: FIGHT,
    frames: [
      { t: 0, p: {} },
      { t: 0.3, p: { uaN: 16, faN: 130, torso: 5, dy: 8 } },
      { t: 0.55, p: { uaN: 58, faN: 62, torso: 21, dy: 12, uaF: 0, faF: 80 } },
      { t: 1, p: {} },
    ],
  };

  A.kick_high = {
    dur: 0.52, loop: false, base: FIGHT,
    frames: [
      { t: 0, p: {} },
      { t: 0.3, p: { thN: 70, shN: -4, torso: -6, dy: 7, thF: -8, shF: -8, ftF: 0, uaN: 28, faN: 118 } },   // knee chamber
      { t: 0.55, p: { thN: 98, shN: 94, torso: -16, head: 8, dy: 5, thF: -4, shF: -6, ftF: 0, uaN: 14, faN: 96, uaF: -26, faF: -34 } }, // snap out
      { t: 0.75, p: { thN: 66, shN: 6, torso: -6, dy: 7, thF: -8, shF: -8, ftF: 0 } },                       // re-chamber
      { t: 1, p: {} },
    ],
  };

  A.kick_mid = {
    dur: 0.48, loop: false, base: FIGHT,
    frames: [
      { t: 0, p: {} },
      { t: 0.3, p: { thN: 58, shN: -10, torso: -2, dy: 7, thF: -6, shF: -8, ftF: 0, uaN: 28, faN: 118 } },
      { t: 0.55, p: { thN: 82, shN: 78, torso: -10, dy: 6, thF: -4, shF: -6, ftF: 0, uaN: 12, faN: 92, uaF: -22, faF: -30 } },
      { t: 0.75, p: { thN: 52, shN: 0, torso: -2, dy: 7, thF: -6, shF: -8, ftF: 0 } },
      { t: 1, p: {} },
    ],
  };

  A.kick_low = {
    dur: 0.44, loop: false, base: FIGHT,
    frames: [
      { t: 0, p: {} },
      { t: 0.3, p: { thN: 34, shN: -16, torso: 2, dy: 8, thF: -6, shF: -8, ftF: 0 } },
      { t: 0.55, p: { thN: 46, shN: 42, torso: 4, dy: 9, thF: -4, shF: -8, ftF: 0, uaN: 20, faN: 104 } },
      { t: 1, p: {} },
    ],
  };

  // ---- reactions ----

  A.hit_high = {
    dur: 0.34, loop: false, base: FIGHT,
    frames: [
      { t: 0, p: {} },
      { t: 0.3, p: { torso: -15, head: -24, dy: 7, uaN: 18, faN: 96, uaF: 44, faF: 138 } },
      { t: 1, p: {} },
    ],
  };

  A.hit_mid = {
    dur: 0.34, loop: false, base: FIGHT,
    frames: [
      { t: 0, p: {} },
      { t: 0.3, p: { torso: 24, head: 12, dy: 13, uaN: 14, faN: 44, uaF: 26, faF: 60 } },
      { t: 1, p: {} },
    ],
  };

  A.block = {
    dur: 0.26, loop: false, base: FIGHT,
    frames: [
      { t: 0, p: {} },
      { t: 0.4, p: { uaN: 52, faN: 152, torso: 3, dy: 7 } },
      { t: 1, p: {} },
    ],
  };

  // Knocked out: stagger, then fall flat on the back. Holds the last frame.
  A.ko = {
    dur: 0.95, loop: false, base: FIGHT,
    frames: [
      { t: 0, p: { torso: -18, head: -20, uaN: 30, faN: 120, uaF: 50, faF: 150 } },
      { t: 0.35, p: { rot: -38, dy: 14, torso: -20, head: -22, uaN: 60, faN: 150, uaF: 70, faF: 170, thN: 28, shN: 20, thF: 2, shF: -6 } },
      { t: 0.75, p: { rot: -86, dy: 30, torso: -10, head: -30, uaN: 100, faN: 150, uaF: 120, faF: 170, thN: 20, shN: 14, thF: 4, shF: 0, ftN: 20, ftF: 20 } },
      { t: 1, p: { rot: -88, dy: 31, torso: -8, head: -34, uaN: 110, faN: 140, uaF: 130, faF: 160, thN: 18, shN: 12, thF: 2, shF: -2, ftN: 25, ftF: 25 } },
    ],
  };

  A.bow = {
    dur: 1.9, loop: false, base: TRAVEL,
    frames: [
      { t: 0, p: {} },
      { t: 0.28, p: { torso: 44, head: 18, uaN: 22, faN: 30, uaF: 14, faF: 22 } },
      { t: 0.62, p: { torso: 44, head: 18, uaN: 22, faN: 30, uaF: 14, faF: 22 } },
      { t: 1, p: {} },
    ],
  };

  A.victory = {
    dur: 1.4, loop: true, base: TRAVEL,
    frames: [
      { t: 0, p: { uaN: 160, faN: 176, uaF: 150, faF: 168, torso: -4, head: -6 } },
      { t: 0.5, p: { uaN: 150, faN: 170, uaF: 160, faF: 176, torso: -6, head: -8, dy: 2 } },
      { t: 1, p: { uaN: 160, faN: 176, uaF: 150, faF: 168, torso: -4, head: -6 } },
    ],
  };

  // Princess: gentle idle sway (rendered in a kimono by the level painter).
  A.princess_idle = {
    dur: 2.6, loop: true, base: TRAVEL,
    frames: [
      { t: 0, p: { uaN: 16, faN: 40, uaF: 10, faF: 34 } },
      { t: 0.5, p: { torso: 2, dy: 1, uaN: 18, faN: 44, uaF: 12, faF: 36 } },
      { t: 1, p: { uaN: 16, faN: 40, uaF: 10, faF: 34 } },
    ],
  };

  // --- sampling ---

  const smooth = (u) => u * u * (3 - 2 * u);
  const lerp = (a, b, u) => a + (b - a) * u;

  function framePose(anim, frame) {
    return { ...anim.base, ...frame.p };
  }

  /* Sample an animation at time t (seconds). Returns a full pose object. */
  function sample(name, t) {
    const anim = A[name];
    let u = t / anim.dur;
    if (anim.loop) u -= Math.floor(u);
    else u = Math.min(1, Math.max(0, u));

    const fr = anim.frames;
    let i = 0;
    while (i < fr.length - 2 && u > fr[i + 1].t) i++;
    const f0 = fr[i], f1 = fr[i + 1];
    const span = Math.max(1e-6, f1.t - f0.t);
    const k = smooth(Math.min(1, Math.max(0, (u - f0.t) / span)));

    const p0 = framePose(anim, f0), p1 = framePose(anim, f1);
    const out = {};
    for (const key of Object.keys(p0)) out[key] = lerp(p0[key], p1[key] ?? p0[key], k);
    return out;
  }

  function lerpPose(a, b, u) {
    const out = {};
    for (const key of Object.keys(b)) {
      const av = a[key] ?? b[key];
      out[key] = lerp(av, b[key], u);
    }
    return out;
  }

  return { defs: A, sample, lerpPose };
})();
