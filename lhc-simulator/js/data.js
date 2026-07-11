// ============================================================================
// LHC SIMULATOR — DOMAIN DATA
// Machine parameters, detectors, particles and physics processes.
// Numbers follow LHC Run 3 (2022–2026) operating conditions and PDG values.
// ============================================================================

export const LEVELS = [
  {
    id: 0, key: 'spectator', name: 'Spectator', icon: '👀',
    tag: 'visitor on the gallery',
    desc: 'Watch a fill from injection to collisions with everything pre-configured. Plain-language explanations, zero controls to break.'
  },
  {
    id: 1, key: 'intern', name: 'Intern', icon: '🎓',
    tag: 'summer student',
    desc: 'Choose the beam species and collision energy, pick which detector to inspect, and read the basic machine displays.'
  },
  {
    id: 2, key: 'knowledgeable', name: 'Knowledgeable', icon: '📐',
    tag: 'physics undergraduate',
    desc: 'Set the number of bunches and bunch intensity, watch the luminosity respond, choose trigger streams and toggle detector layers.'
  },
  {
    id: 3, key: 'accomplished', name: 'Accomplished', icon: '⚙️',
    tag: 'graduate researcher',
    desc: 'Control β*, crossing angle and emittance; see pile-up follow the optics; apply kinematic cuts in the analysis and hunt for peaks.'
  },
  {
    id: 4, key: 'expert', name: 'Expert', icon: '🧠',
    tag: 'machine physicist / run coordinator',
    desc: 'Everything unlocked: luminosity levelling, RF voltage, full per-particle kinematics tables, all analysis channels and cut control.'
  },
];

// ---------------------------------------------------------------------------
// Machine constants (LHC Run 3)
// ---------------------------------------------------------------------------
export const MACHINE = {
  circumference_m: 26658.883,
  revolutionFreq_hz: 11245,
  dipoles: 1232,
  dipoleField_T: 8.33,          // at 7 TeV design; ~7.7 T at 6.8 TeV
  dipoleCurrent_A: 11850,       // at design field
  temperature_K: 1.9,
  injectionEnergy_GeV: 450,
  maxEnergy_GeV: 6800,
  rfFreq_MHz: 400.79,
  rfVoltage_MV: 16,             // total per beam at flat top
  maxBunches: 2808,
  bunchSpacing_ns: 25,
  protonsPerBunchNominal: 1.6e11,
  normEmittanceNominal_um: 2.0, // µm·rad
  crossingAngleNominal_urad: 160,
  betaStarNominal_m: 0.30,      // ATLAS/CMS Run 3 after full squeeze
  inelasticXsec_mb: 80,         // σ_inel(pp) at 13.6 TeV
  fillNumberStart: 10496,       // plausible late-Run-3 fill numbers
};

// Ion run parameters (Pb-Pb)
export const IONS = {
  sqrtSNN_TeV: 5.36,
  energyPerNucleon_GeV: 2680,
  bunches: 1240,
  hadronicXsec_b: 7.7,
};

// ---------------------------------------------------------------------------
// The four experiments.
// geometry radii are in metres (real barrel radii, used to scale the display).
// ---------------------------------------------------------------------------
export const DETECTORS = {
  ATLAS: {
    key: 'ATLAS', name: 'ATLAS', ip: 1, octant: 0,
    full: 'A Toroidal LHC ApparatuS',
    color: '#4fc3f7',
    short: 'General-purpose: Higgs, top, searches for new physics.',
    style: 'barrel',
    solenoid_T: 2.0,
    length_m: 46, height_m: 25, weight_t: 7000,
    // display layers: [innerR, outerR] in metres, drawn to scale
    layers: [
      { key: 'pixel',   name: 'Pixel detector + IBL', r: [0.033, 0.15],  color: '#37474f', hue: '#90a4ae', desc: 'Silicon pixels, 92M channels. Innermost layer 3.3 cm from the beam — vertexing and b-tagging.' },
      { key: 'sct',     name: 'SCT silicon strips',   r: [0.30, 0.52],   color: '#3b4a63', hue: '#a3b6d6', desc: 'Four barrels of silicon micro-strips, ~6M channels.' },
      { key: 'trt',     name: 'TRT straw tracker',    r: [0.56, 1.08],   color: '#2f3d55', hue: '#8fa8cc', desc: '~300k gas-filled straws; transition radiation separates electrons from pions.' },
      { key: 'solenoid',name: 'Solenoid (2 T)',       r: [1.22, 1.32],   color: '#5d4037', hue: '#bcaaa4', desc: 'Thin superconducting solenoid: 2 T for the inner tracker.' },
      { key: 'ecal',    name: 'LAr EM calorimeter',   r: [1.5, 1.97],    color: '#1b5e20', hue: '#66bb6a', desc: 'Liquid-argon "accordion" sampling calorimeter. σ_E/E ≈ 10%/√E ⊕ 0.7%.' },
      { key: 'hcal',    name: 'Tile hadronic cal.',   r: [2.28, 4.25],   color: '#7f5f00', hue: '#ffd54f', desc: 'Steel + scintillating tiles. σ_E/E ≈ 50%/√E ⊕ 3% for jets.' },
      { key: 'muon',    name: 'Muon spectrometer',    r: [4.9, 11.0],    color: '#4a148c55', hue: '#ce93d8', desc: 'Drift tubes in an 8-coil air-core toroid (0.5–4 T·m bending power). Stand-alone muon momentum.' },
    ],
    resolutions: { muon_pt: 0.03, electron_e: 0.025, photon_e: 0.015, jet_e: 0.12 },
    triggers: ['Any (min-bias)', 'Single muon pT>25', 'Di-photon', 'Di-lepton', 'High-mass (H candidates)', 'Multi-jet'],
  },
  CMS: {
    key: 'CMS', name: 'CMS', ip: 5, octant: 4,
    full: 'Compact Muon Solenoid',
    color: '#ff7043',
    short: 'General-purpose: same physics as ATLAS, opposite design philosophy.',
    style: 'barrel',
    solenoid_T: 3.8,
    length_m: 21.6, height_m: 15, weight_t: 14000,
    layers: [
      { key: 'pixel',   name: 'Pixel detector',        r: [0.029, 0.16], color: '#37474f', hue: '#90a4ae', desc: '124M pixels; innermost layer 2.9 cm from the beam.' },
      { key: 'tracker', name: 'Silicon strip tracker', r: [0.20, 1.16],  color: '#3b4a63', hue: '#a3b6d6', desc: 'Largest silicon tracker ever built: 200 m² of sensors, 9.3M strips.' },
      { key: 'ecal',    name: 'PbWO₄ crystal ECAL',    r: [1.29, 1.55],  color: '#1b5e20', hue: '#66bb6a', desc: '75,848 lead-tungstate crystals. Superb resolution: σ_E/E ≈ 3%/√E ⊕ 0.3%.' },
      { key: 'hcal',    name: 'Brass/scint. HCAL',     r: [1.77, 2.95],  color: '#7f5f00', hue: '#ffd54f', desc: 'Brass absorber (partly from Russian navy shells) + plastic scintillator.' },
      { key: 'solenoid',name: 'Solenoid (3.8 T)',      r: [2.95, 3.8],   color: '#5d4037', hue: '#bcaaa4', desc: 'The largest superconducting solenoid ever built. 2.6 GJ stored energy.' },
      { key: 'muon',    name: 'Muon system + yoke',    r: [4.0, 7.4],    color: '#4a148c55', hue: '#ce93d8', desc: 'DT, CSC and RPC chambers embedded in the steel return yoke (12,500 t).' },
    ],
    resolutions: { muon_pt: 0.02, electron_e: 0.02, photon_e: 0.01, jet_e: 0.12 },
    triggers: ['Any (min-bias)', 'Single muon pT>24', 'Di-photon', 'Di-lepton', 'High-mass (H candidates)', 'Multi-jet'],
  },
  ALICE: {
    key: 'ALICE', name: 'ALICE', ip: 2, octant: 1,
    full: 'A Large Ion Collider Experiment',
    color: '#ab47bc',
    short: 'Heavy-ion specialist: quark–gluon plasma, the primordial universe.',
    style: 'barrel',
    solenoid_T: 0.5,
    length_m: 26, height_m: 16, weight_t: 10000,
    layers: [
      { key: 'its',  name: 'ITS silicon tracker', r: [0.023, 0.43],  color: '#37474f', hue: '#90a4ae', desc: 'Upgraded ITS2: 7 layers, 12.5 billion MAPS pixels — the largest pixel camera ever.' },
      { key: 'tpc',  name: 'Time Projection Chamber', r: [0.85, 2.47], color: '#0d3b52', hue: '#4dd0e1', desc: '88 m³ of Ne–CO₂ gas. Every charged track imaged in 3D; dE/dx identifies the particle species.' },
      { key: 'trd',  name: 'TRD',                r: [2.9, 3.68],    color: '#33421f', hue: '#aed581', desc: 'Transition Radiation Detector: electron ID.' },
      { key: 'tof',  name: 'Time-of-Flight',     r: [3.7, 3.99],    color: '#5b4a14', hue: '#ffe082', desc: '~56 ps timing: separates π/K/p up to a few GeV/c.' },
      { key: 'emcal',name: 'EMCal / PHOS',       r: [4.3, 4.8],     color: '#1b5e20', hue: '#66bb6a', desc: 'Electromagnetic calorimeters for photons and jets.' },
      { key: 'l3',   name: 'L3 magnet (0.5 T)',  r: [5.0, 6.5],     color: '#7f1c1c55', hue: '#ef9a9a', desc: 'The old LEP L3 solenoid — huge and warm (not superconducting). Low field to catch very soft tracks.' },
    ],
    resolutions: { muon_pt: 0.04, electron_e: 0.04, photon_e: 0.03, jet_e: 0.15 },
    triggers: ['Pb–Pb central (0–10%)', 'Pb–Pb mid-central (30–50%)', 'Pb–Pb peripheral', 'pp reference'],
  },
  LHCb: {
    key: 'LHCb', name: 'LHCb', ip: 8, octant: 7,
    full: 'LHC beauty',
    color: '#66bb6a',
    short: 'Forward spectrometer: b-quarks, CP violation, matter vs antimatter.',
    style: 'forward',
    dipole_Tm: 4.0,
    length_m: 20, height_m: 10, weight_t: 5600,
    // forward stations: z positions in metres from the interaction point
    stations: [
      { key: 'velo',  name: 'VELO',            z: [0.0, 1.0],   color: '#37474f', hue: '#90a4ae', desc: 'VErtex LOcator: silicon pixels 5.1 mm from the beam, inside the beam vacuum. Resolves B-decay vertices displaced by a few mm.' },
      { key: 'rich1', name: 'RICH-1',          z: [1.1, 2.2],   color: '#0d3b52', hue: '#4dd0e1', desc: 'Ring-imaging Cherenkov: π/K separation 2–60 GeV/c.' },
      { key: 'ut',    name: 'UT tracker',      z: [2.3, 2.7],   color: '#3b4a63', hue: '#a3b6d6', desc: 'Silicon strips upstream of the magnet.' },
      { key: 'magnet',name: 'Dipole (4 T·m)',  z: [3.0, 7.0],   color: '#5d403766', hue: '#bcaaa4', desc: 'Warm dipole bends tracks horizontally; polarity is flipped regularly to control detection asymmetries.' },
      { key: 'scifi', name: 'SciFi tracker',   z: [7.5, 9.5],   color: '#33421f', hue: '#aed581', desc: '11,000 km of scintillating fibre read by silicon photomultipliers.' },
      { key: 'rich2', name: 'RICH-2',          z: [9.7, 11.6],  color: '#0d3b52', hue: '#4dd0e1', desc: 'Cherenkov ID for fast tracks 15–100+ GeV/c.' },
      { key: 'calo',  name: 'ECAL + HCAL',     z: [12.0, 15.0], color: '#1b5e20', hue: '#66bb6a', desc: 'Shashlik ECAL and iron-scintillator HCAL.' },
      { key: 'muon',  name: 'Muon stations',   z: [15.5, 19.0], color: '#4a148c55', hue: '#ce93d8', desc: 'M2–M5 behind 80 cm iron walls.' },
    ],
    acceptance_mrad: [10, 300],
    resolutions: { muon_pt: 0.005, electron_e: 0.03, photon_e: 0.03, jet_e: 0.15 },
    triggers: ['B → J/ψ K (displaced vertex)', 'B_s → μμ (rare decay)', 'D meson (charm)', 'Any (min-bias)'],
  },
};

// ---------------------------------------------------------------------------
// Particle dictionary (PDG 2024 values, GeV)
// ---------------------------------------------------------------------------
export const PARTICLES = {
  'e-':   { name: 'electron',   sym: 'e⁻', mass: 0.000511, charge: -1, kind: 'electron' },
  'e+':   { name: 'positron',   sym: 'e⁺', mass: 0.000511, charge: +1, kind: 'electron' },
  'mu-':  { name: 'muon',       sym: 'μ⁻', mass: 0.10566,  charge: -1, kind: 'muon' },
  'mu+':  { name: 'antimuon',   sym: 'μ⁺', mass: 0.10566,  charge: +1, kind: 'muon' },
  'gamma':{ name: 'photon',     sym: 'γ',  mass: 0,        charge: 0,  kind: 'photon' },
  'nu':   { name: 'neutrino',   sym: 'ν',  mass: 0,        charge: 0,  kind: 'neutrino' },
  'jet':  { name: 'jet',        sym: 'jet',mass: 0,        charge: 0,  kind: 'jet' },
  'bjet': { name: 'b-jet',      sym: 'b-jet', mass: 4.18,  charge: 0,  kind: 'bjet' },
  'pi+':  { name: 'pion',       sym: 'π⁺', mass: 0.13957,  charge: +1, kind: 'hadron' },
  'pi-':  { name: 'pion',       sym: 'π⁻', mass: 0.13957,  charge: -1, kind: 'hadron' },
  'K+':   { name: 'kaon',       sym: 'K⁺', mass: 0.49368,  charge: +1, kind: 'hadron' },
  'K-':   { name: 'kaon',       sym: 'K⁻', mass: 0.49368,  charge: -1, kind: 'hadron' },
  'p':    { name: 'proton',     sym: 'p',  mass: 0.93827,  charge: +1, kind: 'hadron' },
};

export const RESONANCES = {
  Z:    { mass: 91.1876, width: 2.4952,  sym: 'Z⁰' },
  W:    { mass: 80.377,  width: 2.085,   sym: 'W±' },
  H:    { mass: 125.25,  width: 0.0041,  sym: 'H' },   // natural width tiny; detector-dominated
  Jpsi: { mass: 3.0969,  width: 9.3e-5,  sym: 'J/ψ' },
  psi2S:{ mass: 3.6861,  width: 3.0e-4,  sym: 'ψ(2S)' },
  Y1S:  { mass: 9.4604,  width: 5.4e-5,  sym: 'Υ(1S)' },
  Y2S:  { mass: 10.0234, width: 3.2e-5,  sym: 'Υ(2S)' },
  Y3S:  { mass: 10.3552, width: 2.0e-5,  sym: 'Υ(3S)' },
  B:    { mass: 5.2793,  width: 0,       sym: 'B⁺' },
  Bs:   { mass: 5.3669,  width: 0,       sym: 'B_s⁰' },
  top:  { mass: 172.5,   width: 1.42,    sym: 't' },
};

// ---------------------------------------------------------------------------
// Physics processes at √s = 13.6 TeV.
// xsec in picobarn (pb). 1 mb = 1e9 pb, 1 nb = 1e3 pb, 1 fb = 1e-3 pb.
// ---------------------------------------------------------------------------
export const PROCESSES = [
  {
    key: 'minbias', name: 'Minimum bias (soft QCD)', xsec_pb: 8.0e10,
    tex: 'pp → X (inelastic)',
    desc: 'The overwhelming majority of collisions: soft scatters producing a spray of low-momentum hadrons. This is also what every pile-up interaction looks like.',
    detectors: ['ATLAS','CMS','ALICE','LHCb'],
  },
  {
    key: 'dijet', name: 'QCD di-jet', xsec_pb: 6.0e7,   // pT > ~60 GeV
    tex: 'gg/qq → jets',
    desc: 'Two partons scatter hard and hadronise into back-to-back collimated sprays of hadrons — jets. The workhorse (and main background) of hadron-collider physics.',
    detectors: ['ATLAS','CMS'],
  },
  {
    key: 'wlnu', name: 'W → ℓν', xsec_pb: 2.0e4,
    tex: 'q q̄′ → W± → ℓ± ν',
    desc: 'A W boson decays to a charged lepton and a neutrino. The neutrino escapes unseen — you infer it from missing transverse momentum.',
    detectors: ['ATLAS','CMS'],
  },
  {
    key: 'zll', name: 'Z → ℓ⁺ℓ⁻', xsec_pb: 2.0e3,
    tex: 'q q̄ → Z → ℓ⁺ℓ⁻',
    desc: 'The "standard candle" of the LHC: two opposite-charge leptons whose invariant mass reconstructs the Z peak at 91.2 GeV. Used to calibrate everything.',
    detectors: ['ATLAS','CMS','LHCb'],
  },
  {
    key: 'ttbar', name: 'Top pair production', xsec_pb: 9.0e2,
    tex: 'gg → t t̄ → WbWb̄',
    desc: 'The heaviest known elementary particle, produced in pairs. Each top decays t → Wb almost 100% of the time, giving b-jets plus the W decay products.',
    detectors: ['ATLAS','CMS'],
  },
  {
    key: 'hgg', name: 'Higgs → γγ', xsec_pb: 0.14,      // σ(H)≈60 pb × BR 0.23%
    tex: 'gg → H → γγ',
    desc: 'The discovery channel of 2012. Rare (BR = 0.23%) but spectacular: two high-energy photons whose invariant mass piles up at 125 GeV over a smooth background.',
    detectors: ['ATLAS','CMS'],
  },
  {
    key: 'h4l', name: 'Higgs → ZZ* → 4ℓ', xsec_pb: 0.0075,
    tex: 'gg → H → ZZ* → 4ℓ',
    desc: '“The golden channel”: four leptons, almost no background. One Z is on-shell (~91 GeV), the other virtual (~30 GeV) — the Higgs at 125 GeV cannot make two real Zs.',
    detectors: ['ATLAS','CMS'],
  },
  {
    key: 'bjpsik', name: 'B⁺ → J/ψ K⁺', xsec_pb: 6.0e5,
    tex: 'pp → b b̄; B⁺ → J/ψ(μμ) K⁺',
    desc: 'A beauty hadron flies a few millimetres before decaying — LHCb’s VELO resolves the displaced vertex. J/ψ → μ⁺μ⁻ gives a clean dimuon signature.',
    detectors: ['LHCb'],
  },
  {
    key: 'bsmumu', name: 'B_s → μ⁺μ⁻', xsec_pb: 1.2,
    tex: 'B_s⁰ → μ⁺μ⁻ (BR ≈ 3×10⁻⁹)',
    desc: 'One of the rarest decays ever measured. Heavily suppressed in the Standard Model — any deviation would signal new physics. LHCb and CMS measured it together.',
    detectors: ['LHCb'],
  },
  {
    key: 'pbpb', name: 'Pb–Pb heavy-ion collision', xsec_pb: 7.7e12,
    tex: 'Pb+Pb → QGP → thousands of hadrons',
    desc: 'Two lead nuclei collide and, for ~10⁻²³ s, create quark–gluon plasma at ~5 trillion K. It expands, cools and freezes out into thousands of hadrons.',
    detectors: ['ALICE'],
  },
];

export function processByKey(k) { return PROCESSES.find(p => p.key === k); }

// ---------------------------------------------------------------------------
// Display colours per particle kind (classic event-display conventions)
// ---------------------------------------------------------------------------
export const KIND_STYLE = {
  muon:     { color: '#ff5252', label: 'muon (μ)' },
  electron: { color: '#69f0ae', label: 'electron (e)' },
  photon:   { color: '#ffee58', label: 'photon (γ) — dashed, no track' },
  jet:      { color: '#ffab40', label: 'jet (quark/gluon)' },
  bjet:     { color: '#ff6e9c', label: 'b-jet (displaced vertex)' },
  hadron:   { color: '#64b5f6', label: 'charged hadron (π, K, p)' },
  neutrino: { color: '#b39ddb', label: 'missing pT (ν) — dashed arrow' },
};

// The eight LHC octants / interaction points, for the ring display
export const RING_POINTS = [
  { p: 1, label: 'IP1 · ATLAS',  kind: 'exp', color: '#4fc3f7' },
  { p: 2, label: 'IP2 · ALICE',  kind: 'exp', color: '#ab47bc' },
  { p: 3, label: 'P3 · Momentum collimation', kind: 'sys', color: '#546e7a' },
  { p: 4, label: 'P4 · RF cavities', kind: 'sys', color: '#26a69a' },
  { p: 5, label: 'IP5 · CMS',    kind: 'exp', color: '#ff7043' },
  { p: 6, label: 'P6 · Beam dump', kind: 'sys', color: '#ef5350' },
  { p: 7, label: 'P7 · Betatron collimation', kind: 'sys', color: '#546e7a' },
  { p: 8, label: 'IP8 · LHCb',   kind: 'exp', color: '#66bb6a' },
];
