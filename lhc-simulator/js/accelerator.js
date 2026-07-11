// ============================================================================
// LHC SIMULATOR — MACHINE ENGINE
// Drives a fill through the real LHC cycle:
//   INJECTION → RAMP → FLAT TOP → SQUEEZE → ADJUST → STABLE BEAMS → DUMP
// Times are compressed (~100x) but the physics readouts are computed from the
// actual luminosity formula, so every knob responds the way the machine does.
// ============================================================================

import { MACHINE, IONS } from './data.js';

const PROTON_MASS_GEV = 0.93827;

export const PHASES = {
  NOBEAM:   { key: 'NOBEAM',   label: 'NO BEAM',        cls: '',            comment: 'Machine ready. Configure the fill and inject beam.' },
  INJECT:   { key: 'INJECT',   label: 'INJECTION',      cls: 'mode-inject', comment: 'SPS delivering bunch trains at 450 GeV…' },
  RAMP:     { key: 'RAMP',     label: 'RAMP',           cls: 'mode-ramp',   comment: 'Dipole current rising — RF tracking the field…' },
  FLATTOP:  { key: 'FLATTOP',  label: 'FLAT TOP',       cls: 'mode-ramp',   comment: 'Top energy reached. Preparing the squeeze…' },
  SQUEEZE:  { key: 'SQUEEZE',  label: 'SQUEEZE',        cls: 'mode-squeeze',comment: 'Inner-triplet quadrupoles squeezing β* at the IPs…' },
  ADJUST:   { key: 'ADJUST',   label: 'ADJUST',         cls: 'mode-squeeze',comment: 'Collapsing the separation bumps — beams into collision…' },
  STABLE:   { key: 'STABLE',   label: 'STABLE BEAMS',   cls: 'mode-stable', comment: 'Experiments taking data. Luminosity burn-off in progress.' },
  DUMP:     { key: 'DUMP',     label: 'BEAM DUMP',      cls: 'mode-dump',   comment: 'Beams extracted to the dump blocks at Point 6.' },
  RAMPDOWN: { key: 'RAMPDOWN', label: 'RAMP DOWN',      cls: '',            comment: 'Magnets cycling down for the next fill.' },
};

// phase durations in simulator seconds (~100x faster than reality)
const DUR = { INJECT: 12, RAMP: 14, FLATTOP: 3, SQUEEZE: 8, ADJUST: 4, DUMP: 2.5, RAMPDOWN: 4 };

export class Machine {
  constructor() {
    this.fillNumber = MACHINE.fillNumberStart;
    this.reset();
    this.listeners = { phase: [], log: [] };
  }

  reset() {
    this.phase = PHASES.NOBEAM;
    this.phaseT = 0;
    this.simSpeed = 100;
    this.energy_GeV = 0;
    this.intensity1 = 0;         // protons (or ions) in beam 1
    this.intensity2 = 0;
    this.betaStar_m = 1.0;       // before squeeze
    this.lumi = { ATLAS: 0, CMS: 0, ALICE: 0, LHCb: 0 };  // 1e34 cm^-2 s^-1
    this.pileup = 0;
    this.integrated_fb = 0;      // fb^-1 this fill (ATLAS/CMS)
    this.stableTime = 0;
    this.burnFactor = 1;
    this.cfg = null;
  }

  on(evt, fn) { this.listeners[evt].push(fn); }
  emit(evt, arg) { for (const f of this.listeners[evt]) f(arg); }
  log(msg, hl = false) { this.emit('log', { msg, hl, t: this.clockStr() }); }

  clockStr() {
    const d = new Date();
    return d.toTimeString().slice(0, 8);
  }

  get isIon() { return this.cfg && this.cfg.species === 'pbpb'; }

  startFill(cfg) {
    // cfg: { species, energy_GeV, nBunches, ppb, emittance_um, betaStarTarget_m,
    //        crossingAngle_urad, leveling, rfVoltage_MV }
    this.reset();
    this.cfg = cfg;
    this.fillNumber++;
    this.targetIntensity = cfg.nBunches * cfg.ppb;
    this.energy_GeV = MACHINE.injectionEnergy_GeV;
    this.setPhase(PHASES.INJECT);
    this.log(`FILL ${this.fillNumber}: injection started — ${cfg.nBunches} bunches/beam, ` +
      (this.isIon ? 'Pb ions' : `${(cfg.ppb / 1e11).toFixed(2)}×10¹¹ p/bunch`), true);
  }

  dump(reason = 'Programmed dump by operator.') {
    if (this.phase === PHASES.NOBEAM || this.phase === PHASES.DUMP || this.phase === PHASES.RAMPDOWN) return;
    this.setPhase(PHASES.DUMP);
    this.log(`BEAM DUMP — ${reason}`, true);
  }

  setPhase(p) {
    this.phase = p;
    this.phaseT = 0;
    this.emit('phase', p);
  }

  // Instantaneous luminosity in units of 1e34, from the real formula.
  computeLumi(betaStar_m) {
    const c = this.cfg;
    if (!c) return 0;
    if (this.isIon) {
      // Pb-Pb: much lower luminosity, quote in 1e27-ish but return scaled
      return 6e-7 * (c.nBunches / IONS.bunches) * this.burnFactor; // ~6e27 cm-2s-1
    }
    const gamma = this.energy_GeV / PROTON_MASS_GEV;
    const epsN = c.emittance_um * 1e-6;                 // m rad
    const sigStar = Math.sqrt((epsN / gamma) * betaStar_m);   // m
    const sigZ = 0.09;                                  // bunch length, m
    const theta = c.crossingAngle_urad * 1e-6;
    const R = 1 / Math.sqrt(1 + Math.pow((theta * sigZ) / (2 * sigStar), 2));
    const Nb = c.ppb * this.burnFactor;
    const L = (MACHINE.revolutionFreq_hz * c.nBunches * Nb * Nb * R) /
              (4 * Math.PI * sigStar * sigStar);        // m^-2 s^-1
    return L * 1e-4 / 1e34;                             // → 1e34 cm^-2 s^-1
  }

  computePileup() {
    if (this.isIon || !this.cfg) return 0;
    const L = this.lumi.ATLAS * 1e34;                   // cm-2 s-1
    const rate = L * MACHINE.inelasticXsec_mb * 1e-27;  // interactions/s
    return rate / (this.cfg.nBunches * MACHINE.revolutionFreq_hz);
  }

  // dt: real seconds since last tick
  tick(dt) {
    if (this.phase === PHASES.NOBEAM) return;
    this.phaseT += dt;
    const c = this.cfg;
    const frac = (key) => Math.min(1, this.phaseT / DUR[key]);

    switch (this.phase.key) {
      case 'INJECT': {
        const f = frac('INJECT');
        // trains arrive in steps
        const step = Math.floor(f * 12) / 12;
        this.intensity1 = this.targetIntensity * Math.min(1, step + 0.02);
        this.intensity2 = this.targetIntensity * Math.min(1, Math.max(0, step - 0.04) + 0.02);
        if (f >= 1) {
          this.intensity1 = this.intensity2 = this.targetIntensity;
          this.log('Both beams at target intensity. Starting energy ramp.', true);
          this.setPhase(PHASES.RAMP);
        }
        break;
      }
      case 'RAMP': {
        const f = frac('RAMP');
        // parabolic-exponential-linear ramp shape, roughly like the real PELP ramp
        const s = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        this.energy_GeV = MACHINE.injectionEnergy_GeV +
          (c.energy_GeV - MACHINE.injectionEnergy_GeV) * s;
        if (f >= 1) {
          this.energy_GeV = c.energy_GeV;
          this.log(`Flat top: ${(c.energy_GeV / 1000).toFixed(1)} TeV per beam.`, true);
          this.setPhase(PHASES.FLATTOP);
        }
        break;
      }
      case 'FLATTOP': {
        if (frac('FLATTOP') >= 1) { this.setPhase(PHASES.SQUEEZE); this.log('Squeeze started: β* 1.0 m → ' + c.betaStarTarget_m.toFixed(2) + ' m'); }
        break;
      }
      case 'SQUEEZE': {
        const f = frac('SQUEEZE');
        this.betaStar_m = 1.0 - (1.0 - c.betaStarTarget_m) * f;
        if (f >= 1) { this.betaStar_m = c.betaStarTarget_m; this.setPhase(PHASES.ADJUST); this.log('Optics squeezed. Adjusting beams into collision…'); }
        break;
      }
      case 'ADJUST': {
        const f = frac('ADJUST');
        const L = this.computeLumi(this.betaStar_m) * f * f;
        this.setLumis(L);
        if (f >= 1) {
          this.setPhase(PHASES.STABLE);
          this.log('*** STABLE BEAMS *** Experiments ramping detector HV and taking data.', true);
        }
        break;
      }
      case 'STABLE': {
        this.stableTime += dt;
        // burn-off: intensity decays; τ ≈ 60 sim-seconds ~ "10 hours"
        this.burnFactor = Math.exp(-this.stableTime / 90);
        this.intensity1 = this.targetIntensity * this.burnFactor;
        this.intensity2 = this.targetIntensity * this.burnFactor;
        let L = this.computeLumi(this.betaStar_m);
        // luminosity levelling: cap at target by (virtually) adjusting the crossing bump
        if (c.leveling && !this.isIon) L = Math.min(L, c.levelTarget || 2.0);
        this.setLumis(L);
        // integrated luminosity: sim second ~ 100 real seconds
        this.integrated_fb += (L * 1e34 * this.simSpeed * dt) * 1e-39; // fb^-1
        break;
      }
      case 'DUMP': {
        const f = frac('DUMP');
        this.intensity1 = Math.max(0, this.intensity1 * (1 - f * 1.2));
        this.intensity2 = Math.max(0, this.intensity2 * (1 - f * 1.2));
        this.setLumis(0);
        if (f >= 1) { this.setPhase(PHASES.RAMPDOWN); }
        break;
      }
      case 'RAMPDOWN': {
        const f = frac('RAMPDOWN');
        this.energy_GeV = Math.max(0, this.cfg.energy_GeV * (1 - f));
        if (f >= 1) { const keep = this.fillNumber; this.reset(); this.fillNumber = keep; this.setPhase(PHASES.NOBEAM); this.log('Machine cycled. Ready for next fill.'); }
        break;
      }
    }
    this.pileup = this.computePileup();
  }

  setLumis(L) {
    // ATLAS & CMS run at full lumi; ALICE and LHCb level much lower (as in reality)
    if (this.isIon) {
      this.lumi = { ATLAS: L * 0.9, CMS: L * 0.9, ALICE: L, LHCb: L * 0.2 };
    } else {
      this.lumi = { ATLAS: L, CMS: L, ALICE: Math.min(L, 0.003), LHCb: Math.min(L, 0.2) };
    }
  }

  get stable() { return this.phase.key === 'STABLE'; }

  // Readout snapshot for the UI
  snapshot() {
    const c = this.cfg || {};
    const gamma = this.energy_GeV > 0 ? this.energy_GeV / PROTON_MASS_GEV : 0;
    const beta = gamma > 1 ? Math.sqrt(1 - 1 / (gamma * gamma)) : 0;
    // dipole field/current scale linearly with momentum
    const B = MACHINE.dipoleField_T * (this.energy_GeV / 7000);
    const I = MACHINE.dipoleCurrent_A * (this.energy_GeV / 7000);
    return {
      phase: this.phase, fill: this.fillNumber,
      energy_GeV: this.energy_GeV,
      intensity1: this.intensity1, intensity2: this.intensity2,
      targetIntensity: this.targetIntensity || 1,
      dipoleB_T: B, dipoleI_A: I,
      gamma, beta,
      betaStar_cm: this.betaStar_m * 100,
      lumi: this.lumi, pileup: this.pileup,
      integrated_fb: this.integrated_fb,
      revFreq: MACHINE.revolutionFreq_hz,
      stored_MJ: this.isIon ? this.intensity1 * 2680 * 208 * 1.602e-19 * 1e9 / 1e6
                            : this.intensity1 * this.energy_GeV * 1.602e-19 * 1e9 / 1e6,
    };
  }
}
