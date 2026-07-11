// ============================================================================
// LHC SIMULATOR — RING / INJECTOR / HERO CANVAS RENDERERS
// ============================================================================

import { RING_POINTS } from './data.js';

function fitCanvas(cv) {
  const dpr = window.devicePixelRatio || 1;
  const r = cv.getBoundingClientRect();
  if (r.width === 0) return false;
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return true;
}

// ---------------------------------------------------------------------------
// Main ring view (control room)
// ---------------------------------------------------------------------------
export class RingView {
  constructor(canvas, machine) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.machine = machine;
    this.t = 0;
    this.sparks = [];   // collision flashes at the IPs
  }

  draw(dt) {
    if (!fitCanvas(this.cv)) return;
    this.t += dt;
    const ctx = this.ctx, W = this.cv.width, H = this.cv.height;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36;
    const snap = this.machine.snapshot();
    const phase = snap.phase.key;
    const beamOn = !['NOBEAM', 'RAMPDOWN'].includes(phase) && snap.intensity1 > 0;

    ctx.clearRect(0, 0, W, H);
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(1, 1);

    // tunnel
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = '#1a2740'; ctx.lineWidth = 16 * dpr; ctx.stroke();

    // dipole glow strengthens with energy
    const eFrac = snap.energy_GeV / 7000;
    if (eFrac > 0) {
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(60,120,255,${0.10 + 0.25 * eFrac})`;
      ctx.lineWidth = 22 * dpr; ctx.stroke();
    }

    // the two beam pipes
    for (const [rOff, color, dir] of [[-4 * dpr, '#4fa8ff', 1], [4 * dpr, '#ff5b5b', -1]]) {
      ctx.beginPath(); ctx.arc(cx, cy, R + rOff, 0, Math.PI * 2);
      ctx.strokeStyle = beamOn ? color + '55' : '#22314e';
      ctx.lineWidth = 2 * dpr; ctx.stroke();
    }

    // octant point markers
    ctx.font = `${11 * dpr}px monospace`;
    ctx.textAlign = 'center';
    RING_POINTS.forEach((pt, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 8;   // IP1 (ATLAS) at bottom in reality; put at top for readability
      const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      ctx.beginPath(); ctx.arc(x, y, (pt.kind === 'exp' ? 7 : 4.5) * dpr, 0, Math.PI * 2);
      ctx.fillStyle = pt.color; ctx.fill();
      if (pt.kind === 'exp') {
        ctx.strokeStyle = pt.color; ctx.lineWidth = dpr;
        ctx.beginPath(); ctx.arc(x, y, 11 * dpr, 0, Math.PI * 2); ctx.stroke();
      }
      const lx = cx + (R + 42 * dpr) * Math.cos(a), ly = cy + (R + 42 * dpr) * Math.sin(a);
      ctx.fillStyle = pt.kind === 'exp' ? pt.color : '#5a7292';
      ctx.fillText(pt.label, lx, ly + 4 * dpr);
    });

    // circulating bunch trains
    if (beamOn) {
      const nDots = 24;
      const speed = 0.25 + 1.4 * eFrac;
      const fill1 = snap.intensity1 / snap.targetIntensity;
      const fill2 = snap.intensity2 / snap.targetIntensity;
      for (const [color, dir, rOff, fillFrac] of [
        ['#7fc4ff', 1, -4 * dpr, fill1], ['#ff8a8a', -1, 4 * dpr, fill2]]) {
        const n = Math.max(1, Math.round(nDots * fillFrac));
        for (let i = 0; i < n; i++) {
          const a = dir * this.t * speed + (i * Math.PI * 2) / nDots;
          const x = cx + (R + rOff) * Math.cos(a), y = cy + (R + rOff) * Math.sin(a);
          ctx.beginPath(); ctx.arc(x, y, 2.6 * dpr, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowColor = color; ctx.shadowBlur = 8 * dpr;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }

    // collision sparks at experiment IPs during stable beams
    if (phase === 'STABLE') {
      if (Math.random() < 0.5) {
        const exps = [0, 1, 4, 7];
        const i = exps[(Math.random() * exps.length) | 0];
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 8;
        this.sparks.push({ a, r: 0, life: 1 });
      }
      this.sparks = this.sparks.filter(s => s.life > 0);
      for (const s of this.sparks) {
        s.r += 90 * dt * dpr; s.life -= dt * 2.2;
        const x = cx + R * Math.cos(s.a), y = cy + R * Math.sin(s.a);
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,230,120,${Math.max(0, s.life) * 0.8})`;
        ctx.lineWidth = 1.5 * dpr; ctx.stroke();
      }
    }

    // centre annotation
    ctx.fillStyle = '#31435f'; ctx.font = `${10.5 * dpr}px monospace`;
    ctx.fillText('LHC · 26.7 km · view from above', cx, cy - 10 * dpr);
    ctx.fillStyle = '#4b638a';
    ctx.fillText(`Beam 1 ⟳  ·  Beam 2 ⟲  ·  ${snap.revFreq.toLocaleString()} rev/s`, cx, cy + 8 * dpr);
    if (phase === 'STABLE') {
      ctx.fillStyle = '#55e08c';
      ctx.fillText('~40 MHz bunch crossings at the 4 IPs', cx, cy + 26 * dpr);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Injector chain strip (control room, below the ring)
// ---------------------------------------------------------------------------
export class InjectorView {
  constructor(canvas, machine) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.machine = machine; this.t = 0;
  }

  draw(dt) {
    if (!fitCanvas(this.cv)) return;
    this.t += dt;
    const ctx = this.ctx, W = this.cv.width, H = this.cv.height;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, W, H);
    const y = H * 0.52;
    const injecting = this.machine.phase.key === 'INJECT';

    // layout: LINAC4 — PSB — PS — SPS — → LHC
    const stops = [
      { x: 0.06, r: 0,          label: 'LINAC4',  sub: '160 MeV' },
      { x: 0.24, r: 10,         label: 'PSB',     sub: '2 GeV' },
      { x: 0.44, r: 16,         label: 'PS',      sub: '26 GeV' },
      { x: 0.68, r: 24,         label: 'SPS',     sub: '450 GeV' },
      { x: 0.92, r: 0,          label: '→ LHC',   sub: injecting ? 'injecting' : '' },
    ];
    ctx.strokeStyle = '#2a3c5e'; ctx.lineWidth = 2 * dpr;
    ctx.beginPath(); ctx.moveTo(W * 0.03, y); ctx.lineTo(W * 0.95, y); ctx.stroke();

    ctx.font = `${10 * dpr}px monospace`; ctx.textAlign = 'center';
    for (const s of stops) {
      const x = W * s.x;
      if (s.r > 0) {
        ctx.beginPath(); ctx.arc(x, y, s.r * dpr, 0, Math.PI * 2);
        ctx.strokeStyle = injecting ? '#4fc3f7' : '#334a6e';
        ctx.lineWidth = 2 * dpr; ctx.stroke();
      } else {
        ctx.fillStyle = injecting ? '#4fc3f7' : '#334a6e';
        ctx.fillRect(x - 14 * dpr, y - 3 * dpr, 28 * dpr, 6 * dpr);
      }
      ctx.fillStyle = '#8aa0c0'; ctx.fillText(s.label, x, y - 30 * dpr);
      ctx.fillStyle = '#5a7292'; ctx.fillText(s.sub, x, y + 38 * dpr);
    }

    // moving packet during injection
    if (injecting) {
      const f = (this.t * 0.35) % 1;
      const x = W * (0.06 + f * (0.92 - 0.06));
      ctx.beginPath(); ctx.arc(x, y, 4 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd54f'; ctx.shadowColor = '#ffd54f'; ctx.shadowBlur = 10 * dpr;
      ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.fillStyle = '#46617f'; ctx.textAlign = 'left';
    ctx.fillText('INJECTOR CHAIN', 8 * dpr, 14 * dpr);
  }
}

// ---------------------------------------------------------------------------
// Hero background: decorative ring + colliding particles
// ---------------------------------------------------------------------------
export function startHero(canvas) {
  const ctx = canvas.getContext('2d');
  let t = 0, running = true, last = performance.now();
  const sparks = [];

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (!fitCanvas(canvas)) { requestAnimationFrame(frame); return; }
    const W = canvas.width, H = canvas.height, dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, W, H);

    // starfield-ish dots
    ctx.fillStyle = 'rgba(120,160,220,0.25)';
    for (let i = 0; i < 60; i++) {
      const x = ((i * 733) % W), yy = ((i * 397) % H);
      ctx.fillRect(x, yy, 1.2 * dpr, 1.2 * dpr);
    }

    const cx = W / 2, cy = H * 0.58, R = Math.min(W, H) * 0.55;
    // big arc suggestion of the ring
    ctx.beginPath(); ctx.arc(cx, cy + R * 0.9, R * 1.5, -Math.PI * 0.82, -Math.PI * 0.18);
    ctx.strokeStyle = 'rgba(50,90,160,0.35)'; ctx.lineWidth = 30 * dpr; ctx.stroke();

    // two counter-rotating particles on the arc
    const arcR = R * 1.5, acy = cy + R * 0.9;
    const a1 = -Math.PI * 0.82 + ((t * 0.55) % 1) * (Math.PI * 0.64);
    const a2 = -Math.PI * 0.18 - ((t * 0.55) % 1) * (Math.PI * 0.64);
    for (const [a, c] of [[a1, '#4fa8ff'], [a2, '#ff5b5b']]) {
      const x = cx + arcR * Math.cos(a), y = acy + arcR * Math.sin(a);
      ctx.beginPath(); ctx.arc(x, y, 4 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 16 * dpr; ctx.fill(); ctx.shadowBlur = 0;
    }
    // collision burst when they meet (mid arc)
    if (Math.abs(((t * 0.55) % 1) - 0.5) < dt * 0.6) {
      const a = -Math.PI * 0.5;
      const x = cx + arcR * Math.cos(a), y = acy + arcR * Math.sin(a);
      for (let i = 0; i < 22; i++) {
        const th = Math.random() * Math.PI * 2, v = (40 + Math.random() * 160) * dpr;
        sparks.push({ x, y, vx: Math.cos(th) * v, vy: Math.sin(th) * v, life: 1,
          c: ['#ffd54f', '#4fc3f7', '#ff8a65', '#b39ddb'][i % 4] });
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 1.4;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.8 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = s.c; ctx.fill();
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return () => { running = false; };
}

// ---------------------------------------------------------------------------
// Learn-section figure: the accelerator complex
// ---------------------------------------------------------------------------
export function drawComplexFigure(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0f1c'; ctx.fillRect(0, 0, W, H);
  const y = H * 0.62;
  const stops = [
    { x: 0.08, r: 0,  label: 'LINAC4', sub: 'H⁻ · 160 MeV', c: '#ffd54f' },
    { x: 0.25, r: 16, label: 'PS Booster', sub: '2 GeV · 157 m', c: '#4dd0e1' },
    { x: 0.44, r: 26, label: 'PS', sub: '26 GeV · 628 m · since 1959', c: '#aed581' },
    { x: 0.66, r: 40, label: 'SPS', sub: '450 GeV · 6.9 km', c: '#ff8a65' },
    { x: 0.88, r: 52, label: 'LHC', sub: '6.8 TeV · 26.7 km', c: '#4fc3f7' },
  ];
  ctx.strokeStyle = '#2a3c5e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W * 0.05, y); ctx.lineTo(W * 0.9, y); ctx.stroke();
  ctx.font = '12px monospace'; ctx.textAlign = 'center';
  for (const s of stops) {
    const x = W * s.x;
    if (s.r > 0) {
      ctx.beginPath(); ctx.arc(x, y - s.r, s.r, 0, Math.PI * 2);
      ctx.strokeStyle = s.c; ctx.lineWidth = 3; ctx.stroke();
    } else {
      ctx.fillStyle = s.c; ctx.fillRect(x - 22, y - 4, 44, 8);
    }
    ctx.fillStyle = '#d7e3f4'; ctx.fillText(s.label, x, y + 24);
    ctx.fillStyle = '#8aa0c0'; ctx.font = '10.5px monospace';
    ctx.fillText(s.sub, x, y + 40);
    ctx.font = '12px monospace';
  }
  // energy arrow
  ctx.strokeStyle = '#ffd54f66'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W * 0.06, H * 0.12); ctx.lineTo(W * 0.9, H * 0.12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W * 0.9, H * 0.12); ctx.lineTo(W * 0.885, H * 0.10); ctx.moveTo(W * 0.9, H * 0.12); ctx.lineTo(W * 0.885, H * 0.145); ctx.stroke();
  ctx.fillStyle = '#ffd54f'; ctx.textAlign = 'left';
  ctx.fillText('energy ×42,500 across the chain', W * 0.06, H * 0.08);
}
