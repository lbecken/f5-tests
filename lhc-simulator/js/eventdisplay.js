// ============================================================================
// LHC SIMULATOR — EVENT DISPLAY
// Draws collision events inside real detector geometry.
//  · ATLAS / CMS / ALICE: transverse (x–y) view, layers to scale, helical
//    tracks with radius r = pT / (0.3 B) — charge sign sets the curl direction.
//  · LHCb: side (z–x) spectrometer view with the dipole kick, plus a VELO
//    inset that resolves millimetre-displaced B vertices.
// ============================================================================

import { DETECTORS, KIND_STYLE } from './data.js';

function fitCanvas(cv) {
  const dpr = window.devicePixelRatio || 1;
  const r = cv.getBoundingClientRect();
  if (r.width === 0) return false;
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; return true; }
  return true;
}

// Trace a charged-particle helix in the transverse plane. Units: metres, GeV, tesla.
// Returns array of [x, y] points, stopping at rStop or after maxTurn radians of bend.
function traceHelix(pt, phi0, charge, B, rStop, maxTurn = 3.5 * Math.PI) {
  const pts = [[0, 0]];
  if (B <= 0 || charge === 0) {
    // straight line
    pts.push([rStop * Math.cos(phi0), rStop * Math.sin(phi0)]);
    return pts;
  }
  const rc = pt / (0.3 * B);                 // curvature radius in metres
  const kappa = -charge / rc;                // dφ/ds
  let x = 0, y = 0, phi = phi0, turned = 0;
  const ds = Math.max(0.01, Math.min(0.12, 0.06 * rc));
  for (let i = 0; i < 4000; i++) {
    x += ds * Math.cos(phi); y += ds * Math.sin(phi);
    phi += kappa * ds; turned += Math.abs(kappa * ds);
    pts.push([x, y]);
    if (x * x + y * y >= rStop * rStop) break;
    if (turned > maxTurn) break;             // low-pT looper: stop after a few turns
  }
  return pts;
}

export class EventDisplay {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.event = null; this.det = null;
    this.zoom = 1; this.reveal = 1; this.animT = 0;
    this.opts = { showPileup: true, showLabels: true, showCalo: true };
    this.items = [];
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = Math.min(30, Math.max(0.5, this.zoom * (e.deltaY < 0 ? 1.18 : 0.85)));
    }, { passive: false });
  }

  setOptions(opts) { Object.assign(this.opts, opts); this.prepare(); }

  setEvent(event, detKey) {
    this.event = event;
    this.det = DETECTORS[detKey];
    this.animT = 0; this.reveal = 0;
    this.prepare();
  }

  // Precompute drawable primitives (world coordinates in metres)
  prepare() {
    this.items = [];
    if (!this.event || !this.det) return;
    if (this.det.style === 'forward') { this.prepareForward(); return; }

    const det = this.det;
    const B = det.solenoid_T;
    const layer = (k) => det.layers.find(l => l.key === k) || det.layers[det.layers.length - 1];
    const ecalR = (layer('ecal') || layer('emcal')).r;
    const hcalL = layer('hcal') || layer('emcal') || layer('tof');
    const outerR = det.layers[det.layers.length - 1].r[1];
    const muonL = det.layers.find(l => l.key === 'muon') || det.layers[det.layers.length - 1];

    for (const p of this.event.particles) {
      if (p.isPileup && !this.opts.showPileup) continue;
      const st = KIND_STYLE[p.kind];
      const pt = Math.max(0.05, p.p4.pt), phi = p.p4.phi;

      if (p.kind === 'neutrino') continue;   // drawn via MET

      if (p.kind === 'photon') {
        const rEnd = ecalR[0] + (ecalR[1] - ecalR[0]) * 0.55;
        this.items.push({ type: 'line', pts: [[0, 0], [rEnd * Math.cos(phi), rEnd * Math.sin(phi)]],
          color: st.color, width: 1.6, dash: [0.08, 0.08], kind: p.kind, p });
        this.items.push({ type: 'blob', x: rEnd * Math.cos(phi), y: rEnd * Math.sin(phi),
          r: 0.05 + 0.11 * Math.log10(1 + p.p4.E), color: st.color, p });
        continue;
      }
      if (p.kind === 'jet' || p.kind === 'bjet') {
        const rEnd = hcalL.r[1];
        this.items.push({ type: 'cone', phi, r: rEnd, half: 0.13 + 0.05 / Math.sqrt(pt / 40),
          color: st.color, p });
        // a few charged tracks inside the cone
        const n = 3 + (Math.random() * 3 | 0);
        for (let i = 0; i < n; i++) {
          const f = 0.3 + Math.random() * 0.5;
          const tpts = traceHelix(pt * f * 0.3, phi + (Math.random() - 0.5) * 0.2,
            Math.random() < 0.5 ? 1 : -1, B, ecalR[0]);
          this.items.push({ type: 'line', pts: tpts, color: st.color + '88', width: 1, kind: p.kind, p });
        }
        if (p.kind === 'bjet') {
          const d = 0.04 + Math.random() * 0.05; // exaggerated for visibility
          this.items.push({ type: 'vertex', x: d * Math.cos(phi), y: d * Math.sin(phi), color: st.color, p });
        }
        continue;
      }

      // charged particles: helix
      let rStop = outerR;
      if (p.kind === 'electron') rStop = ecalR[0] + (ecalR[1] - ecalR[0]) * 0.5;
      else if (p.kind === 'hadron') rStop = hcalL.r[0] + (hcalL.r[1] - hcalL.r[0]) * 0.45;
      else if (p.kind === 'muon') rStop = muonL.r[0] + (muonL.r[1] - muonL.r[0]) * 0.85;
      const pts = traceHelix(pt, phi, p.charge, B, rStop);
      const faint = p.isPileup;
      this.items.push({
        type: 'line', pts,
        color: faint ? '#4a586e' : st.color,
        width: p.kind === 'muon' ? 2.2 : (faint ? 0.7 : 1.3),
        kind: p.kind, p,
      });
      if (p.kind === 'electron' && !faint) {
        const e = pts[pts.length - 1];
        this.items.push({ type: 'blob', x: e[0], y: e[1], r: 0.05 + 0.1 * Math.log10(1 + p.p4.E), color: st.color, p });
      }
      if (p.kind === 'hadron' && !faint && this.opts.showCalo && p.p4.pt > 1.2) {
        const e = pts[pts.length - 1];
        this.items.push({ type: 'blob', x: e[0], y: e[1], r: 0.04 + 0.07 * Math.log10(1 + p.p4.E), color: '#ffd54f99', p });
      }
      if (p.kind === 'muon' && !faint) {
        // hit marks in the muon system
        for (const f of [0.15, 0.45, 0.8]) {
          const rr = muonL.r[0] + (muonL.r[1] - muonL.r[0]) * f;
          const idx = pts.findIndex(q => q[0] * q[0] + q[1] * q[1] >= rr * rr);
          if (idx > 0) this.items.push({ type: 'hit', x: pts[idx][0], y: pts[idx][1], color: st.color });
        }
      }
    }

    if (this.event.met && this.event.met.pt > 8) {
      this.items.push({ type: 'met', phi: this.event.met.phi, pt: this.event.met.pt, r: outerR * 0.75 });
    }
  }

  prepareForward() {
    // LHCb: coordinates (z, x) in metres; z along the beam 0..20, x = bending plane
    const det = this.det;
    const res = this.event.physics && this.event.physics.resonance;
    const sv = res && res.sv ? res.sv : null;     // secondary vertex in mm

    for (const p of this.event.particles) {
      if (p.isPileup && !this.opts.showPileup) continue;
      const st = KIND_STYLE[p.kind];
      const pz = Math.abs(p.p4.pz) + 0.3;
      let slope = p.p4.px / pz;                    // dx/dz before magnet
      if (Math.abs(slope) > 0.35) continue;        // outside acceptance
      const z0 = p.origin ? p.origin.z / 1000 : 0; // mm → m (tiny)
      const x0 = p.origin ? p.origin.x / 1000 : 0;
      const kick = p.charge * 1.2 / pz;            // dipole: Δpx = q·0.3·(4 T·m) = 1.2 GeV

      const zEnd = p.kind === 'muon' ? 19 : (p.kind === 'photon' || p.kind === 'electron' ? 12.6 :
                   p.kind === 'hadron' ? 13.8 : 19);
      const pts = [];
      let x = x0, sl = slope;
      for (let z = z0; z <= zEnd; z += 0.15) {
        pts.push([z, x]);
        const inMag = z > 3 && z < 7;
        x += (sl + (inMag ? kick * ((z - 3) / 4) : (z >= 7 ? kick : 0))) * 0.15;
        if (Math.abs(x) > 4.5) break;
      }
      this.items.push({
        type: 'fline', pts, color: p.isPileup ? '#41506b' : st.color,
        width: p.kind === 'muon' ? 2.2 : 1.3,
        dash: p.kind === 'photon' ? [0.15, 0.15] : null, p,
      });
      const last = pts[pts.length - 1];
      if ((p.kind === 'electron' || p.kind === 'photon') && last[0] > 12)
        this.items.push({ type: 'fblob', z: last[0], x: last[1], r: 0.25, color: st.color });
      if (p.kind === 'hadron' && last[0] > 13)
        this.items.push({ type: 'fblob', z: last[0], x: last[1], r: 0.22, color: '#ffd54f99' });
    }
    if (sv) this.velo = { sv, flight: res.flightLength_mm }; else this.velo = null;
  }

  draw(dt) {
    if (!this.event || !fitCanvas(this.cv)) return;
    this.animT += dt;
    this.reveal = Math.min(1, this.animT / 1.1);
    const ctx = this.ctx, W = this.cv.width, H = this.cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#04070d'; ctx.fillRect(0, 0, W, H);
    if (this.det.style === 'forward') this.drawForward(ctx, W, H);
    else this.drawBarrel(ctx, W, H);
  }

  drawBarrel(ctx, W, H) {
    const det = this.det;
    const dpr = window.devicePixelRatio || 1;
    const outerR = det.layers[det.layers.length - 1].r[1];
    const S = (Math.min(W, H) * 0.47 / outerR) * this.zoom;   // px per metre
    const cx = W / 2, cy = H / 2;
    const X = (x) => cx + x * S, Y = (y) => cy - y * S;

    // ---- detector layers (annuli) ----
    for (const l of det.layers) {
      ctx.beginPath();
      ctx.arc(cx, cy, l.r[1] * S, 0, Math.PI * 2);
      ctx.arc(cx, cy, l.r[0] * S, 0, Math.PI * 2, true);
      ctx.fillStyle = l.color + (l.color.length === 7 ? '66' : '');
      ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, l.r[1] * S, 0, Math.PI * 2);
      ctx.strokeStyle = '#22314e'; ctx.lineWidth = 1; ctx.stroke();
      if (this.opts.showLabels && l.r[1] * S > 40 * dpr) {
        ctx.fillStyle = l.hue; ctx.font = `${10 * dpr}px monospace`; ctx.textAlign = 'center';
        ctx.fillText(l.name, cx, cy - (l.r[0] + (l.r[1] - l.r[0]) * 0.5) * S + 3 * dpr);
      }
    }
    // beam pipe
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(2, 0.02 * S), 0, Math.PI * 2);
    ctx.fillStyle = '#0e1524'; ctx.fill(); ctx.strokeStyle = '#3a4f75'; ctx.stroke();

    // ---- event items with reveal animation ----
    const rev = this.reveal;
    for (const it of this.items) {
      if (it.type === 'line') {
        const n = Math.max(2, Math.floor(it.pts.length * rev));
        ctx.beginPath();
        ctx.moveTo(X(it.pts[0][0]), Y(it.pts[0][1]));
        for (let i = 1; i < n; i++) ctx.lineTo(X(it.pts[i][0]), Y(it.pts[i][1]));
        ctx.strokeStyle = it.color; ctx.lineWidth = it.width * dpr;
        ctx.setLineDash(it.dash ? it.dash.map(d => d * S) : []);
        ctx.stroke(); ctx.setLineDash([]);
      } else if (it.type === 'blob' && rev > 0.85) {
        const g = ctx.createRadialGradient(X(it.x), Y(it.y), 0, X(it.x), Y(it.y), it.r * S);
        g.addColorStop(0, it.color); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(X(it.x), Y(it.y), it.r * S, 0, Math.PI * 2); ctx.fill();
      } else if (it.type === 'cone') {
        const r = it.r * rev;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r * S, -it.phi - it.half, -it.phi + it.half); // canvas y flipped
        ctx.closePath();
        ctx.fillStyle = it.color + '2e'; ctx.fill();
        ctx.strokeStyle = it.color + '77'; ctx.lineWidth = dpr; ctx.stroke();
      } else if (it.type === 'hit' && rev > 0.9) {
        ctx.fillStyle = it.color;
        ctx.fillRect(X(it.x) - 3 * dpr, Y(it.y) - 3 * dpr, 6 * dpr, 6 * dpr);
      } else if (it.type === 'vertex' && rev > 0.6) {
        ctx.strokeStyle = it.color; ctx.lineWidth = dpr;
        ctx.beginPath(); ctx.arc(X(it.x), Y(it.y), 5 * dpr, 0, Math.PI * 2); ctx.stroke();
      } else if (it.type === 'met' && rev > 0.7) {
        const a = it.phi, L = Math.min(it.r, 0.5 + it.pt / 40 * it.r);
        ctx.strokeStyle = KIND_STYLE.neutrino.color; ctx.lineWidth = 2.4 * dpr;
        ctx.setLineDash([8 * dpr, 6 * dpr]);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(X(L * Math.cos(a)), Y(L * Math.sin(a))); ctx.stroke();
        ctx.setLineDash([]);
        // arrowhead
        const ex = X(L * Math.cos(a)), ey = Y(L * Math.sin(a));
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 12 * dpr * Math.cos(-a - 0.4), ey - 12 * dpr * Math.sin(-a - 0.4));
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 12 * dpr * Math.cos(-a + 0.4), ey - 12 * dpr * Math.sin(-a + 0.4));
        ctx.stroke();
        ctx.fillStyle = KIND_STYLE.neutrino.color; ctx.font = `${11 * dpr}px monospace`;
        ctx.fillText(`pT-miss ${it.pt.toFixed(0)} GeV`, ex, ey - 10 * dpr);
      }
    }

    // scale + view label
    ctx.fillStyle = '#46617f'; ctx.font = `${10.5 * dpr}px monospace`; ctx.textAlign = 'left';
    ctx.fillText(`${det.name} · transverse (x–y) view · B = ${det.solenoid_T} T ` +
      `· geometry to scale (outer R = ${outerR.toFixed(1)} m) · scroll to zoom`, 10 * dpr, H - 12 * dpr);
    // 1 m scale bar
    ctx.strokeStyle = '#8aa0c0'; ctx.lineWidth = 2 * dpr;
    ctx.beginPath(); ctx.moveTo(10 * dpr, H - 34 * dpr); ctx.lineTo(10 * dpr + S, H - 34 * dpr); ctx.stroke();
    ctx.fillText('1 m', 14 * dpr + S, H - 30 * dpr);
  }

  drawForward(ctx, W, H) {
    const det = this.det;
    const dpr = window.devicePixelRatio || 1;
    const S = (W * 0.92 / 21) * Math.max(1, this.zoom * 0.9);  // px per metre in z
    const z0px = W * 0.05, xMid = H * 0.5;
    const Z = (z) => z0px + z * S, Xx = (x) => xMid - x * S * 1.6;

    // acceptance cone 10–300 mrad
    ctx.strokeStyle = '#1d2c47'; ctx.lineWidth = dpr; ctx.setLineDash([6 * dpr, 6 * dpr]);
    ctx.beginPath(); ctx.moveTo(Z(0), Xx(0)); ctx.lineTo(Z(20), Xx(20 * 0.3)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(Z(0), Xx(0)); ctx.lineTo(Z(20), Xx(-20 * 0.3)); ctx.stroke();
    ctx.setLineDash([]);

    // stations
    for (const s of det.stations) {
      const zA = Z(s.z[0]), zB = Z(s.z[1]);
      const half0 = Math.max(0.25, s.z[0] * 0.3), half1 = Math.max(0.3, s.z[1] * 0.3);
      ctx.beginPath();
      ctx.moveTo(zA, Xx(half0)); ctx.lineTo(zB, Xx(half1));
      ctx.lineTo(zB, Xx(-half1)); ctx.lineTo(zA, Xx(-half0)); ctx.closePath();
      ctx.fillStyle = (s.color.length > 7 ? s.color : s.color + '55'); ctx.fill();
      ctx.strokeStyle = '#22314e'; ctx.stroke();
      ctx.fillStyle = s.hue; ctx.font = `${9.5 * dpr}px monospace`; ctx.textAlign = 'center';
      ctx.save();
      ctx.translate((zA + zB) / 2, Xx(half1) - 6 * dpr);
      ctx.fillText(s.name, 0, 0);
      ctx.restore();
    }
    // beam line
    ctx.strokeStyle = '#3a4f75'; ctx.lineWidth = dpr;
    ctx.beginPath(); ctx.moveTo(Z(-0.5), Xx(0)); ctx.lineTo(Z(20.5), Xx(0)); ctx.stroke();

    // tracks
    const rev = this.reveal;
    for (const it of this.items) {
      if (it.type === 'fline') {
        const n = Math.max(2, Math.floor(it.pts.length * rev));
        ctx.beginPath(); ctx.moveTo(Z(it.pts[0][0]), Xx(it.pts[0][1]));
        for (let i = 1; i < n; i++) ctx.lineTo(Z(it.pts[i][0]), Xx(it.pts[i][1]));
        ctx.strokeStyle = it.color; ctx.lineWidth = it.width * dpr;
        ctx.setLineDash(it.dash ? it.dash.map(d => d * S) : []);
        ctx.stroke(); ctx.setLineDash([]);
      } else if (it.type === 'fblob' && rev > 0.85) {
        const g = ctx.createRadialGradient(Z(it.z), Xx(it.x), 0, Z(it.z), Xx(it.x), it.r * S);
        g.addColorStop(0, it.color); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(Z(it.z), Xx(it.x), it.r * S, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ---- VELO inset: the displaced vertex, in millimetres ----
    if (this.velo && rev > 0.5) {
      const bw = W * 0.30, bh = H * 0.30, bx = W * 0.66, by = H * 0.65;
      ctx.fillStyle = '#070d18'; ctx.strokeStyle = '#3a4f75'; ctx.lineWidth = dpr;
      ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = '#8aa0c0'; ctx.font = `${10 * dpr}px monospace`; ctx.textAlign = 'left';
      ctx.fillText('VELO zoom — millimetre scale', bx + 8 * dpr, by + 14 * dpr);
      const sv = this.velo.sv;
      const span = Math.max(14, Math.abs(sv.z) * 1.6);       // mm shown
      const mz = (mm) => bx + bw * 0.12 + (mm / span) * bw * 0.8;
      const mx = (mm) => by + bh * 0.55 - (mm / span) * bh * 0.8;
      // beam line + PV
      ctx.strokeStyle = '#31435f';
      ctx.beginPath(); ctx.moveTo(bx + 6 * dpr, mx(0)); ctx.lineTo(bx + bw - 6 * dpr, mx(0)); ctx.stroke();
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath(); ctx.arc(mz(0), mx(0), 4 * dpr, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('PV', mz(0) - 8 * dpr, mx(0) + 16 * dpr);
      // B flight line
      ctx.strokeStyle = '#ff6e9c'; ctx.setLineDash([4 * dpr, 3 * dpr]);
      ctx.beginPath(); ctx.moveTo(mz(0), mx(0)); ctx.lineTo(mz(sv.z), mx(sv.x)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ff6e9c';
      ctx.beginPath(); ctx.arc(mz(sv.z), mx(sv.x), 4 * dpr, 0, Math.PI * 2); ctx.fill();
      ctx.fillText(`SV — B flew ${this.velo.flight.toFixed(1)} mm`, mz(sv.z) + 8 * dpr, mx(sv.x) - 6 * dpr);
      // decay prongs
      for (const a of [-0.5, 0.15, 0.6]) {
        ctx.strokeStyle = '#64b5f6';
        ctx.beginPath(); ctx.moveTo(mz(sv.z), mx(sv.x));
        ctx.lineTo(mz(sv.z) + bw * 0.18, mx(sv.x) - Math.tan(a) * bh * 0.2); ctx.stroke();
      }
    }

    ctx.fillStyle = '#46617f'; ctx.font = `${10.5 * dpr}px monospace`; ctx.textAlign = 'left';
    ctx.fillText(`LHCb · side view (z–x bending plane) · dipole ∫B·dl = 4 T·m · acceptance 10–300 mrad`,
      10 * dpr, H - 12 * dpr);
  }
}
