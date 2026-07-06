'use strict';

/* ============================================================
 * Lightning (bonus) — stepped leader + return stroke.
 * Real cloud-to-ground lightning: a "stepped leader" of ionised
 * air descends in ~50 m jerky segments, forking into branches;
 * when a path connects to ground, the "return stroke" discharges
 * up the channel in <100 µs — that's the flash — usually followed
 * by 2–4 dimmer restrikes down the same channel (the flicker).
 * Modelled here:
 *  - leader: biased random walk downward, per-step angle jitter,
 *    branch probability decaying with depth; propagates over
 *    several frames (slowed ~10000× so you can see it)
 *  - return stroke: full channel + scene illumination flash with
 *    exponential decay, then random restrikes
 *  - thunder delay ∝ distance (340 m/s) shown in the HUD
 * ============================================================ */
(() => {
  let W, H, ctx, hud;
  let bolt = null;                 // { segs:[{x1,y1,x2,y2,w,branchDepth}], tips:[...] }
  let phase = 'wait';              // wait → leader → flash
  let waitT = 0, flash = 0, restrikes = 0, nextRestrike = 0;
  let groundY, dist;               // "distance" of this strike, km
  let rainDrops = [];
  let t = 0;

  function startLeader() {
    const x0 = rand(W * 0.15, W * 0.85);
    bolt = { segs: [], tips: [{ x: x0, y: 20, ang: Math.PI / 2, depth: 0, w: 3 }] };
    phase = 'leader';
    dist = rand(0.4, 3);
  }

  function stepLeader() {
    // several leader steps per frame
    const newTips = [];
    let reached = false;
    for (const tip of bolt.tips) {
      for (let s = 0; s < 3; s++) {
        const len = rand(9, 22);
        // bias downward; jitter grows for branches
        const jitter = 0.55 + tip.depth * 0.15;
        const ang = Math.PI / 2 + (tip.ang - Math.PI / 2) * 0.35 + rand(-jitter, jitter);
        const nx = tip.x + Math.cos(ang) * len;
        const ny = tip.y + Math.sin(ang) * len;
        bolt.segs.push({ x1: tip.x, y1: tip.y, x2: nx, y2: ny, w: tip.w, d: tip.depth });
        tip.x = nx; tip.y = ny; tip.ang = ang;
        // branching: more likely near the cloud, thinner each level
        if (tip.depth < 4 && Math.random() < 0.09 - tip.depth * 0.015) {
          newTips.push({
            x: nx, y: ny,
            ang: ang + rand(0.4, 0.9) * (Math.random() < 0.5 ? -1 : 1),
            depth: tip.depth + 1,
            w: tip.w * 0.55,
          });
        }
        if (ny >= groundY && tip.depth === 0) reached = true;
      }
    }
    bolt.tips.push(...newTips);
    // prune branch tips that wandered off or got long enough
    bolt.tips = bolt.tips.filter(tp =>
      tp.y < groundY && tp.x > -50 && tp.x < W + 50 &&
      (tp.depth === 0 || Math.random() > 0.12));
    if (reached) {
      phase = 'flash';
      flash = 1;
      restrikes = 2 + (Math.random() * 3 | 0);
      nextRestrike = rand(0.15, 0.35);
    }
  }

  const sim = {
    name: 'Lightning',
    icon: '⚡',
    info: 'Bonus: a stepped leader random-walks down in jerky segments and forks '
        + '(slowed ~10 000× so you can watch it); on ground contact the return '
        + 'stroke flashes the whole channel, then restrikes flicker down the same '
        + 'path. Thunder arrives at 340 m/s. <b>Click to trigger a strike.</b>',
    controls: [],
    actions: [{ name: 'Strike now', fn: () => { if (phase === 'wait') startLeader(); } }],

    init(env) {
      ({ ctx, w: W, h: H, hud } = env);
      groundY = H - H * 0.08;
      phase = 'wait';
      waitT = 1.2;
      bolt = null;
      t = 0;
      rainDrops = [];
      for (let i = 0; i < 160; i++)
        rainDrops.push({ x: rand(0, W), y: rand(0, H), v: rand(500, 750) });
    },

    frame(dt, ptr) {
      t += dt;
      if (ptr.justDown && phase === 'wait') startLeader();

      if (phase === 'wait') {
        waitT -= dt;
        if (waitT <= 0) startLeader();
      } else if (phase === 'leader') {
        stepLeader();
      } else if (phase === 'flash') {
        flash *= Math.pow(0.02, dt);           // fast exponential decay
        nextRestrike -= dt;
        if (restrikes > 0 && nextRestrike <= 0) {
          flash = rand(0.5, 0.85);
          restrikes--;
          nextRestrike = rand(0.1, 0.3);
        }
        if (restrikes === 0 && flash < 0.01) {
          phase = 'wait';
          waitT = rand(2, 6);
          bolt = null;
        }
      }

      // background rain
      for (const r of rainDrops) {
        r.y += r.v * dt; r.x -= 60 * dt;
        if (r.y > H) { r.y = rand(-30, 0); r.x = rand(0, W * 1.1); }
      }

      render();
      hud.textContent = phase === 'flash' || phase === 'wait' && bolt === null
        ? (dist ? `strike ${dist.toFixed(1)} km away — thunder in ${(dist * 1000 / 340).toFixed(1)} s` : '')
        : 'stepped leader descending…';
    },
  };

  function render() {
    const lum = clamp(flash, 0, 1);
    // sky lit by the flash
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, `rgb(${18 + lum * 90},${20 + lum * 95},${30 + lum * 120})`);
    bg.addColorStop(1, `rgb(${10 + lum * 60},${12 + lum * 65},${18 + lum * 85})`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // rain
    ctx.strokeStyle = `rgba(160,180,220,${0.18 + lum * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const r of rainDrops) {
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x + 1.5, r.y - 14);
    }
    ctx.stroke();

    // ground silhouette
    ctx.fillStyle = `rgb(${8 + lum * 40},${10 + lum * 45},${14 + lum * 55})`;
    ctx.fillRect(0, groundY, W, H - groundY);

    if (bolt) {
      const bright = phase === 'leader' ? 0.55 : 0.25 + lum;
      ctx.lineCap = 'round';
      // glow pass
      if (lum > 0.05) {
        ctx.strokeStyle = `rgba(150,170,255,${lum * 0.5})`;
        for (const s of bolt.segs) {
          if (s.d > 1) continue;
          ctx.lineWidth = s.w * 7;
          ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
        }
      }
      // core pass
      for (const s of bolt.segs) {
        const a = clamp(bright * (1 - s.d * 0.22), 0, 1);
        ctx.strokeStyle = `rgba(235,240,255,${a})`;
        ctx.lineWidth = Math.max(0.5, s.w * (phase === 'flash' ? 1.4 : 0.7));
        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      }
    }
  }

  Engine.register(sim);
})();
