// ============================================================================
// LHC SIMULATOR — EVENT GENERATOR
// Generates collision events with honest relativistic kinematics:
// resonances are Breit-Wigner distributed, decays are done in the rest frame
// and boosted back, detector response is applied as Gaussian smearing with
// per-detector resolutions. Not a full MC generator — but the distributions
// (mass peaks, pT spectra, multiplicities) behave the way real ones do.
// ============================================================================

import { PARTICLES, RESONANCES, DETECTORS, processByKey } from './data.js';

// ---------------------------------------------------------------------------
// Random number helpers
// ---------------------------------------------------------------------------
export function rand(a = 0, b = 1) { return a + Math.random() * (b - a); }

export function gauss(mean = 0, sigma = 1) {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function breitWigner(mass, width) {
  // Cauchy sampling via inverse CDF
  if (width <= 0) return mass;
  return mass + 0.5 * width * Math.tan(Math.PI * (Math.random() - 0.5));
}

export function expFalling(scale) { return -scale * Math.log(Math.random()); }

export function poisson(mu) {
  if (mu > 30) return Math.max(0, Math.round(gauss(mu, Math.sqrt(mu))));
  const L = Math.exp(-mu);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

// ---------------------------------------------------------------------------
// Four-vectors.  Convention: pt (GeV), eta, phi (rad), m (GeV).
// ---------------------------------------------------------------------------
export class P4 {
  constructor(px = 0, py = 0, pz = 0, E = 0) { this.px = px; this.py = py; this.pz = pz; this.E = E; }

  static fromPtEtaPhiM(pt, eta, phi, m) {
    const px = pt * Math.cos(phi), py = pt * Math.sin(phi), pz = pt * Math.sinh(eta);
    const E = Math.sqrt(px * px + py * py + pz * pz + m * m);
    return new P4(px, py, pz, E);
  }
  get pt()  { return Math.hypot(this.px, this.py); }
  get p()   { return Math.hypot(this.px, this.py, this.pz); }
  get phi() { return Math.atan2(this.py, this.px); }
  get eta() {
    const p = this.p;
    if (p === Math.abs(this.pz)) return this.pz >= 0 ? 10 : -10;
    return 0.5 * Math.log((p + this.pz) / (p - this.pz));
  }
  get theta() { return Math.atan2(this.pt, this.pz); }
  get m() {
    const m2 = this.E * this.E - this.p * this.p;
    return m2 > 0 ? Math.sqrt(m2) : 0;
  }
  add(o) { return new P4(this.px + o.px, this.py + o.py, this.pz + o.pz, this.E + o.E); }

  // Boost this vector by the velocity of frame `ref` (i.e. from ref's rest frame to lab)
  boostedBy(ref) {
    const bx = ref.px / ref.E, by = ref.py / ref.E, bz = ref.pz / ref.E;
    const b2 = bx * bx + by * by + bz * bz;
    if (b2 <= 0) return new P4(this.px, this.py, this.pz, this.E);
    const g = 1 / Math.sqrt(1 - b2);
    const bp = bx * this.px + by * this.py + bz * this.pz;
    const g2 = (g - 1) / b2;
    return new P4(
      this.px + (g2 * bp + g * this.E) * bx,
      this.py + (g2 * bp + g * this.E) * by,
      this.pz + (g2 * bp + g * this.E) * bz,
      g * (this.E + bp)
    );
  }
}

export function invariantMass(list) {
  let s = new P4();
  for (const p of list) s = s.add(p.p4);
  return s.m;
}

// Isotropic two-body decay of a parent (given as P4 with mass M) into m1, m2.
// Returns two P4 in the lab frame.
function twoBodyDecay(parent, m1, m2) {
  const M = Math.max(parent.m, m1 + m2 + 1e-6);
  const E1 = (M * M + m1 * m1 - m2 * m2) / (2 * M);
  const p = Math.sqrt(Math.max(0, E1 * E1 - m1 * m1));
  const cosT = rand(-1, 1), sinT = Math.sqrt(1 - cosT * cosT), ph = rand(0, 2 * Math.PI);
  const d1 = new P4(p * sinT * Math.cos(ph), p * sinT * Math.sin(ph), p * cosT, E1);
  const d2 = new P4(-d1.px, -d1.py, -d1.pz, Math.sqrt(p * p + m2 * m2));
  return [d1.boostedBy(parent), d2.boostedBy(parent)];
}

// ---------------------------------------------------------------------------
// Particle record used by displays / analysis
// ---------------------------------------------------------------------------
let PID = 0;
function mkParticle(pdgKey, p4, opts = {}) {
  const def = PARTICLES[pdgKey] || { name: pdgKey, sym: pdgKey, mass: 0, charge: 0, kind: 'hadron' };
  return {
    id: ++PID,
    key: pdgKey,
    sym: opts.sym || def.sym,
    kind: opts.kind || def.kind,
    charge: (opts.charge !== undefined) ? opts.charge : def.charge,
    p4,
    origin: opts.origin || { x: 0, y: 0, z: 0 },   // production vertex (mm)
    parent: opts.parent || null,                   // label of mother particle
    isPileup: !!opts.isPileup,
  };
}

// Detector smearing: returns a *new* smeared particle (truth preserved in .truth)
function smear(part, det) {
  const res = det.resolutions;
  let f = 1;
  if (part.kind === 'muon')          f = Math.max(0.2, gauss(1, res.muon_pt));
  else if (part.kind === 'electron') f = Math.max(0.2, gauss(1, res.electron_e));
  else if (part.kind === 'photon')   f = Math.max(0.2, gauss(1, res.photon_e));
  else if (part.kind === 'jet' || part.kind === 'bjet') f = Math.max(0.2, gauss(1, res.jet_e));
  else if (part.kind === 'hadron')   f = Math.max(0.2, gauss(1, 0.01 + 0.005 * part.p4.pt));
  const t = part.p4;
  const s = P4.fromPtEtaPhiM(t.pt * f, t.eta + gauss(0, 0.002), t.phi + gauss(0, 0.002), t.m);
  return { ...part, truth: t, p4: s };
}

// ---------------------------------------------------------------------------
// Underlying event & pile-up: soft charged hadrons
// ---------------------------------------------------------------------------
function softHadrons(n, { isPileup = false, vertexZ = 0 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const pt = 0.15 + expFalling(0.6);
    const eta = rand(-2.5, 2.5);
    const phi = rand(0, 2 * Math.PI);
    const keys = ['pi+', 'pi-', 'pi+', 'pi-', 'K+', 'K-', 'p'];
    const k = keys[(Math.random() * keys.length) | 0];
    out.push(mkParticle(k, P4.fromPtEtaPhiM(pt, eta, phi, PARTICLES[k].mass),
      { isPileup, origin: { x: 0, y: 0, z: vertexZ } }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hard-process generators. Each returns { hard: [particles], met: P4|null, notes }
// ---------------------------------------------------------------------------

function genZll() {
  const mZ = breitWigner(RESONANCES.Z.mass, RESONANCES.Z.width);
  const pt = expFalling(9), y = rand(-2, 2), phi = rand(0, 2 * Math.PI);
  const Z = P4.fromPtEtaPhiM(pt, y, phi, Math.max(20, mZ));
  const flavor = Math.random() < 0.5 ? 'mu' : 'e';
  const m = PARTICLES[flavor + '-'].mass;
  const [d1, d2] = twoBodyDecay(Z, m, m);
  return {
    hard: [
      mkParticle(flavor + '-', d1, { parent: 'Z' }),
      mkParticle(flavor + '+', d2, { parent: 'Z' }),
    ],
    met: null,
    resonance: { name: 'Z⁰', mass: mZ, decay: flavor === 'mu' ? 'Z → μ⁺μ⁻' : 'Z → e⁺e⁻' },
  };
}

function genWlnu() {
  const mW = breitWigner(RESONANCES.W.mass, RESONANCES.W.width);
  const W = P4.fromPtEtaPhiM(expFalling(10), rand(-2.2, 2.2), rand(0, 2 * Math.PI), Math.max(15, mW));
  const flavor = Math.random() < 0.5 ? 'mu' : 'e';
  const sign = Math.random() < 0.55 ? '+' : '-'; // slight W+ excess in pp
  const [l, nu] = twoBodyDecay(W, PARTICLES[flavor + '-'].mass, 0);
  return {
    hard: [
      mkParticle(flavor + sign, l, { parent: 'W' }),
      mkParticle('nu', nu, { parent: 'W', kind: 'neutrino' }),
    ],
    met: nu,
    resonance: { name: 'W' + sign, mass: mW, decay: `W${sign} → ${flavor === 'mu' ? 'μ' : 'e'}${sign} ν` },
  };
}

function genDijet() {
  const pt = 60 + expFalling(55);
  const eta = rand(-2, 2), phi = rand(0, 2 * Math.PI);
  const j1 = P4.fromPtEtaPhiM(pt, eta, phi, 8);
  const j2 = P4.fromPtEtaPhiM(pt * gauss(1, 0.08), rand(-2, 2), phi + Math.PI + gauss(0, 0.12), 8);
  return {
    hard: [mkParticle('jet', j1), mkParticle('jet', j2)],
    met: null,
    resonance: null,
  };
}

function genHgg() {
  // σ(H) at 13.6 TeV ≈ 60 pb; natural width negligible → detector resolution shows.
  const H = P4.fromPtEtaPhiM(expFalling(18), rand(-1.8, 1.8), rand(0, 2 * Math.PI), RESONANCES.H.mass);
  const [g1, g2] = twoBodyDecay(H, 0, 0);
  return {
    hard: [mkParticle('gamma', g1, { parent: 'H' }), mkParticle('gamma', g2, { parent: 'H' })],
    met: null,
    resonance: { name: 'H', mass: RESONANCES.H.mass, decay: 'H → γγ' },
  };
}

function genH4l() {
  const H = P4.fromPtEtaPhiM(expFalling(16), rand(-1.6, 1.6), rand(0, 2 * Math.PI), RESONANCES.H.mass);
  // one on-shell Z, one far off-shell Z*
  const mZ1 = Math.min(breitWigner(RESONANCES.Z.mass, RESONANCES.Z.width), 100);
  const mZ2 = Math.max(12, Math.min(RESONANCES.H.mass - mZ1 - 0.5, 12 + expFalling(14)));
  const [Z1, Z2] = twoBodyDecay(H, Math.max(mZ1, 40), mZ2);
  const out = [];
  let i = 0;
  for (const Z of [Z1, Z2]) {
    const flavor = Math.random() < 0.5 ? 'mu' : 'e';
    const m = PARTICLES[flavor + '-'].mass;
    const [a, b] = twoBodyDecay(Z, m, m);
    out.push(mkParticle(flavor + '-', a, { parent: i === 0 ? 'Z₁' : 'Z₂*' }));
    out.push(mkParticle(flavor + '+', b, { parent: i === 0 ? 'Z₁' : 'Z₂*' }));
    i++;
  }
  return {
    hard: out, met: null,
    resonance: { name: 'H', mass: RESONANCES.H.mass, decay: 'H → ZZ* → 4ℓ', mZ1, mZ2 },
  };
}

function genTtbar() {
  const out = [];
  let metSum = new P4();
  for (const sgn of [+1, -1]) {
    const mt = breitWigner(RESONANCES.top.mass, RESONANCES.top.width);
    const t = P4.fromPtEtaPhiM(expFalling(45), rand(-1.8, 1.8), rand(0, 2 * Math.PI), Math.max(150, mt));
    const mW = breitWigner(RESONANCES.W.mass, RESONANCES.W.width);
    const [W, b] = twoBodyDecay(t, Math.max(60, mW), 4.7);
    out.push(mkParticle('bjet', b, { parent: 't', origin: { x: gauss(0, .5), y: gauss(0, .5), z: 0 } }));
    // W decay: 1/3 leptonic (e/μ), 2/3 hadronic
    if (Math.random() < 0.32) {
      const flavor = Math.random() < 0.5 ? 'mu' : 'e';
      const [l, nu] = twoBodyDecay(W, PARTICLES[flavor + '-'].mass, 0);
      out.push(mkParticle(flavor + (sgn > 0 ? '+' : '-'), l, { parent: 'W' }));
      out.push(mkParticle('nu', nu, { parent: 'W', kind: 'neutrino' }));
      metSum = metSum.add(nu);
    } else {
      const [q1, q2] = twoBodyDecay(W, 1.5, 1.5);
      out.push(mkParticle('jet', q1, { parent: 'W' }));
      out.push(mkParticle('jet', q2, { parent: 'W' }));
    }
  }
  return {
    hard: out,
    met: metSum.pt > 1 ? metSum : null,
    resonance: { name: 't t̄', mass: RESONANCES.top.mass, decay: 't → W b (×2)' },
  };
}

function genMinbias() {
  return { hard: softHadrons(2 + poisson(18)), met: null, resonance: null };
}

// --- LHCb-specific -------------------------------------------------------
function genBJpsiK() {
  // B+ produced forward, flies ~ few mm, decays to J/psi(->mumu) K+
  const pB = 40 + expFalling(35);                       // GeV, forward momentum
  const theta = rand(0.015, 0.20);                      // rad, in LHCb acceptance
  const phi = rand(0, 2 * Math.PI);
  const eta = -Math.log(Math.tan(theta / 2));
  const B = P4.fromPtEtaPhiM(pB * Math.sin(theta), eta, phi, RESONANCES.B.mass);
  // decay length: cτ(B+) = 0.491 mm, boosted by γβ = p/m
  const gammaBeta = B.p / RESONANCES.B.mass;
  const L = expFalling(0.491 * gammaBeta);              // mm, along flight
  const dir = { x: B.px / B.p, y: B.py / B.p, z: B.pz / B.p };
  const sv = { x: dir.x * L, y: dir.y * L, z: dir.z * L };
  const mJ = breitWigner(RESONANCES.Jpsi.mass, 0.02);   // detector-ish width
  const [Jpsi, K] = twoBodyDecay(B, mJ, PARTICLES['K+'].mass);
  const [m1, m2] = twoBodyDecay(Jpsi, PARTICLES['mu-'].mass, PARTICLES['mu-'].mass);
  return {
    hard: [
      mkParticle('mu-', m1, { parent: 'J/ψ', origin: sv }),
      mkParticle('mu+', m2, { parent: 'J/ψ', origin: sv }),
      mkParticle('K+', K, { parent: 'B⁺', origin: sv }),
    ],
    met: null,
    resonance: { name: 'B⁺', mass: RESONANCES.B.mass, decay: 'B⁺ → J/ψ(μμ) K⁺', flightLength_mm: L, sv },
  };
}

function genBsmumu() {
  const pB = 45 + expFalling(30);
  const theta = rand(0.015, 0.18), phi = rand(0, 2 * Math.PI);
  const eta = -Math.log(Math.tan(theta / 2));
  const Bs = P4.fromPtEtaPhiM(pB * Math.sin(theta), eta, phi, RESONANCES.Bs.mass);
  const gammaBeta = Bs.p / RESONANCES.Bs.mass;
  const L = expFalling(0.439 * gammaBeta);
  const dir = { x: Bs.px / Bs.p, y: Bs.py / Bs.p, z: Bs.pz / Bs.p };
  const sv = { x: dir.x * L, y: dir.y * L, z: dir.z * L };
  const [m1, m2] = twoBodyDecay(Bs, PARTICLES['mu-'].mass, PARTICLES['mu-'].mass);
  return {
    hard: [
      mkParticle('mu-', m1, { parent: 'B_s', origin: sv }),
      mkParticle('mu+', m2, { parent: 'B_s', origin: sv }),
    ],
    met: null,
    resonance: { name: 'B_s⁰', mass: RESONANCES.Bs.mass, decay: 'B_s⁰ → μ⁺μ⁻', flightLength_mm: L, sv },
  };
}

// --- ALICE Pb-Pb ----------------------------------------------------------
function genPbPb(centrality = 'central') {
  // dN_ch/deta at midrapidity: ~1900 (0-5%), ~800 (30-50%), ~100 peripheral
  const table = { central: 950, midcentral: 380, peripheral: 60 };
  const n = poisson(table[centrality] || 400);
  const out = [];
  const psi = rand(0, Math.PI);                          // event-plane angle
  const v2 = { central: 0.03, midcentral: 0.10, peripheral: 0.07 }[centrality] || 0.06;
  for (let i = 0; i < n; i++) {
    // sample phi with elliptic-flow modulation dN/dphi ∝ 1 + 2 v2 cos(2(phi-psi))
    let phi;
    do { phi = rand(0, 2 * Math.PI); }
    while (Math.random() > (1 + 2 * v2 * Math.cos(2 * (phi - psi))) / (1 + 2 * v2));
    const pt = 0.12 + expFalling(0.55);
    const eta = rand(-0.9, 0.9);                         // ALICE central barrel
    const keys = ['pi+', 'pi-', 'pi+', 'pi-', 'pi+', 'pi-', 'K+', 'K-', 'p'];
    const k = keys[(Math.random() * keys.length) | 0];
    out.push(mkParticle(k, P4.fromPtEtaPhiM(pt, eta, phi, PARTICLES[k].mass)));
  }
  return {
    hard: out, met: null,
    resonance: { name: 'QGP', decay: `Pb–Pb, ${centrality}`, nch: n, v2, eventPlane: psi },
  };
}

const GENERATORS = {
  minbias: genMinbias, dijet: genDijet, wlnu: genWlnu, zll: genZll,
  ttbar: genTtbar, hgg: genHgg, h4l: genH4l,
  bjpsik: genBJpsiK, bsmumu: genBsmumu, pbpb: genPbPb,
};

// ---------------------------------------------------------------------------
// Full event: hard process + underlying event + pile-up, smeared by detector.
// ---------------------------------------------------------------------------
export function generateEvent(processKey, detectorKey, { pileup = 0, centrality } = {}) {
  const det = DETECTORS[detectorKey];
  const proc = processByKey(processKey);
  const gen = GENERATORS[processKey] || genMinbias;
  const res = gen(centrality);

  let parts = [...res.hard];

  // underlying event for pp hard scatters (not for PbPb / minbias which are all soft)
  if (processKey !== 'pbpb' && processKey !== 'minbias') {
    parts = parts.concat(softHadrons(3 + poisson(9)));
  }
  // pile-up (other pp collisions in the same bunch crossing)
  const nPU = processKey === 'pbpb' ? 0 : poisson(pileup);
  for (let v = 0; v < nPU; v++) {
    parts = parts.concat(softHadrons(1 + poisson(5), { isPileup: true, vertexZ: gauss(0, 45) }));
  }

  const smeared = parts.map(p => p.kind === 'neutrino' ? p : smear(p, det));

  // reconstructed quantities
  const visible = smeared.filter(p => p.kind !== 'neutrino' && !p.isPileup);
  const leptons = visible.filter(p => p.kind === 'muon' || p.kind === 'electron');
  const photons = visible.filter(p => p.kind === 'photon');
  const physics = { masses: [] };

  if (res.resonance) {
    physics.resonance = res.resonance;
    if (processKey === 'zll' && leptons.length >= 2)
      physics.masses.push({ label: 'm(ℓ⁺ℓ⁻)', value: invariantMass(leptons.slice(0, 2)), expect: 'Z at 91.2 GeV' });
    if (processKey === 'hgg' && photons.length >= 2)
      physics.masses.push({ label: 'm(γγ)', value: invariantMass(photons.slice(0, 2)), expect: 'H at 125.25 GeV' });
    if (processKey === 'h4l' && leptons.length >= 4)
      physics.masses.push({ label: 'm(4ℓ)', value: invariantMass(leptons.slice(0, 4)), expect: 'H at 125.25 GeV' });
    if ((processKey === 'bjpsik' || processKey === 'bsmumu')) {
      const mus = visible.filter(p => p.kind === 'muon');
      if (mus.length >= 2) physics.masses.push({
        label: 'm(μ⁺μ⁻)', value: invariantMass(mus.slice(0, 2)),
        expect: processKey === 'bjpsik' ? 'J/ψ at 3.097 GeV' : 'B_s at 5.367 GeV'
      });
      const all = visible.filter(p => !p.isPileup && (p.kind === 'muon' || p.kind === 'hadron'));
      if (processKey === 'bjpsik' && all.length >= 3) physics.masses.push({
        label: 'm(μμK)', value: invariantMass(all.slice(0, 3)), expect: 'B⁺ at 5.279 GeV'
      });
    }
  }

  // missing transverse momentum
  let met = null;
  if (res.met) {
    met = { pt: res.met.pt * gauss(1, 0.1), phi: res.met.phi + gauss(0, 0.05) };
    if (processKey === 'wlnu' && leptons.length >= 1) {
      // transverse mass mT = sqrt(2 pTl MET (1-cos dphi))
      const l = leptons[0];
      const dphi = l.p4.phi - met.phi;
      physics.masses.push({
        label: 'mT(ℓ,MET)',
        value: Math.sqrt(2 * l.p4.pt * met.pt * (1 - Math.cos(dphi))),
        expect: 'Jacobian edge near m(W) = 80.4 GeV'
      });
    }
  }

  return {
    process: proc, detector: detectorKey,
    particles: smeared, met, pileup: nPU,
    physics,
    id: 'evt-' + Math.random().toString(36).slice(2, 8),
    bunchCrossing: (Math.random() * 3564) | 0,
  };
}

// ---------------------------------------------------------------------------
// Bulk generation for the Analysis view: returns filled histogram-ready arrays
// with signal + realistic backgrounds per channel.
// ---------------------------------------------------------------------------
export const ANALYSIS_CHANNELS = [
  {
    key: 'dimuon', name: 'Dimuon invariant mass', unit: 'GeV', log: true,
    range: [0.5, 130], bins: 220, minLevel: 1,
    xlabel: 'm(μ⁺μ⁻)  [GeV]',
    blurb: 'Every opposite-charge muon pair in the data. Resonances appear as peaks over the continuum: J/ψ (3.10), ψ(2S) (3.69), the three Υ states (9.5–10.4) and the Z (91.2). One plot, fifty years of physics.',
  },
  {
    key: 'hgg', name: 'H → γγ search', unit: 'GeV', log: false,
    range: [100, 160], bins: 60, minLevel: 2,
    xlabel: 'm(γγ)  [GeV]',
    blurb: 'The 2012 discovery plot. A tiny bump at 125 GeV on a smoothly falling di-photon background. Statistics matter: record more data and watch the significance grow.',
  },
  {
    key: 'h4l', name: 'H → ZZ* → 4ℓ', unit: 'GeV', log: false,
    range: [70, 180], bins: 55, minLevel: 2,
    xlabel: 'm(4ℓ)  [GeV]',
    blurb: 'The golden channel: almost background-free. The peak at 91 GeV is Z → 4ℓ; the one at 125 GeV is the Higgs.',
  },
  {
    key: 'mtw', name: 'W transverse mass', unit: 'GeV', log: false,
    range: [0, 120], bins: 60, minLevel: 3,
    xlabel: 'mT(ℓ, pT-miss)  [GeV]',
    blurb: 'The neutrino escapes, so m(W) cannot be reconstructed directly. The transverse mass mT = √(2·pTℓ·pTmiss·(1−cosΔφ)) has a Jacobian edge at m(W) ≈ 80.4 GeV.',
  },
  {
    key: 'jetpt', name: 'Inclusive jet pT spectrum', unit: 'GeV', log: true,
    range: [60, 800], bins: 60, minLevel: 3,
    xlabel: 'jet pT  [GeV]',
    blurb: 'QCD at work: a steeply falling power-law spectrum spanning many orders of magnitude. Deviations at high pT were once how people looked for quark substructure.',
  },
  {
    key: 'bmass', name: 'B⁺ → J/ψ K⁺ mass (LHCb)', unit: 'GeV', log: false,
    range: [5.0, 5.6], bins: 60, minLevel: 2,
    xlabel: 'm(J/ψ K⁺)  [GeV]',
    blurb: 'Combine the J/ψ (from two muons) with a kaon: a sharp B⁺ peak at 5.279 GeV over combinatorial background. Requiring a displaced vertex kills most background — that is the magic of the VELO.',
  },
];

export function generateAnalysisSample(channelKey, nEvents, cuts = {}) {
  // Returns array of "measured" values for the requested channel.
  const vals = [];
  const ptCut = cuts.ptMin ?? 0;
  const etaCut = cuts.etaMax ?? 5;
  const vtxCut = cuts.displacedVertex ?? false;

  const passLepton = () => {
    // model cut efficiency: harder pT cut = fewer background entries survive
    const pt = 3 + expFalling(18);
    const eta = rand(-2.5, 2.5);
    return pt > ptCut && Math.abs(eta) < etaCut;
  };

  for (let i = 0; i < nEvents; i++) {
    switch (channelKey) {
      case 'dimuon': {
        const r = Math.random();
        let m = null;
        // continuum (Drell-Yan + heavy flavour): falling
        if (r < (ptCut > 15 ? 0.30 : 0.62)) m = 0.6 + expFalling(ptCut > 10 ? 4 : 6);
        else if (r < 0.80) m = breitWigner(RESONANCES.Jpsi.mass, 0.035);
        else if (r < 0.845) m = breitWigner(RESONANCES.psi2S.mass, 0.045);
        else if (r < 0.895) m = breitWigner(RESONANCES.Y1S.mass, 0.09);
        else if (r < 0.915) m = breitWigner(RESONANCES.Y2S.mass, 0.09);
        else if (r < 0.925) m = breitWigner(RESONANCES.Y3S.mass, 0.09);
        else m = breitWigner(RESONANCES.Z.mass, RESONANCES.Z.width) * gauss(1, 0.015);
        if (m > 0.5 && m < 130 && passLepton()) vals.push(m);
        break;
      }
      case 'hgg': {
        // S/B ~ 1/20 in the peak region before cuts; cuts improve it
        const sigFrac = ptCut > 30 ? 0.10 : 0.045;
        if (Math.random() < sigFrac) vals.push(gauss(RESONANCES.H.mass, 1.6));
        else {
          // smoothly falling background on [100,160]
          let m; do { m = 100 + expFalling(28); } while (m > 160);
          vals.push(m);
        }
        break;
      }
      case 'h4l': {
        const r = Math.random();
        if (r < 0.30) vals.push(gauss(RESONANCES.H.mass, 2.0));         // Higgs
        else if (r < 0.72) vals.push(breitWigner(RESONANCES.Z.mass, RESONANCES.Z.width)); // Z->4l
        else { let m; do { m = 75 + expFalling(60); } while (m > 180); vals.push(m); }    // ZZ continuum
        break;
      }
      case 'mtw': {
        // Jacobian peak: sample cos(theta*) flat, mT = mW * sin(theta*) approx + resolution
        const mW = breitWigner(RESONANCES.W.mass, RESONANCES.W.width);
        const c = rand(-1, 1);
        let mt = mW * Math.sqrt(1 - c * c) * gauss(1, 0.04);
        if (Math.random() < 0.25) mt = expFalling(30);   // QCD background
        if (mt < 120) vals.push(mt);
        break;
      }
      case 'jetpt': {
        // dN/dpT ~ pT^-6 above 60
        const u = Math.random();
        const pt = 60 * Math.pow(1 - u, -1 / 5);
        if (pt < 800) vals.push(pt);
        break;
      }
      case 'bmass': {
        const isSig = Math.random() < (vtxCut ? 0.75 : 0.28);
        if (isSig) vals.push(gauss(RESONANCES.B.mass, 0.012));
        else if (!vtxCut || Math.random() < 0.35) vals.push(rand(5.0, 5.6)); // combinatorial
        break;
      }
    }
  }
  return vals;
}
