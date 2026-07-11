// ============================================================================
// LHC SIMULATOR — APP WIRING
// ============================================================================

import { LEVELS, DETECTORS, MACHINE, KIND_STYLE, processByKey } from './data.js';
import { LEARN_SECTIONS } from './content.js';
import { Machine, PHASES } from './accelerator.js';
import { RingView, InjectorView, startHero, drawComplexFigure } from './ring.js';
import { EventDisplay } from './eventdisplay.js';
import { Histogram } from './charts.js';
import { generateEvent, generateAnalysisSample, ANALYSIS_CHANNELS } from './physics.js';
import { AudioEngine } from './audio.js';

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------
const state = {
  level: parseInt(localStorage.getItem('lhc-level') ?? '0', 10),
  view: 'home',
  collisionsReady: false,     // a fill has reached stable beams at least once
  frozen: null,               // machine conditions snapshot for event generation
  detector: null,
  trigger: null,
  event: null,
  eventCount: 0,
  channel: null,
  data: {},                   // analysis samples per channel
  dataEvents: 0,
  cuts: { ptMin: 0, etaMax: 2.5, displacedVertex: false },
  autoplay: false,
};

const machine = new Machine();
const audio = new AudioEngine();
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

// ---------------------------------------------------------------------------
// Level selection
// ---------------------------------------------------------------------------
function renderLevelCards() {
  const wrap = $('level-cards');
  wrap.innerHTML = '';
  for (const lv of LEVELS) {
    const card = document.createElement('div');
    card.className = 'level-card' + (lv.id === state.level ? ' selected' : '');
    card.innerHTML = `<div class="level-icon">${lv.icon}</div>
      <div class="level-name">${lv.name.toUpperCase()}</div>
      <div class="level-tag">${lv.tag}</div>
      <div class="level-desc">${lv.desc}</div>`;
    card.onclick = () => {
      state.level = lv.id;
      localStorage.setItem('lhc-level', String(lv.id));
      audio.click();
      renderLevelCards(); updateLevelBadge();
      renderConfig(); renderTriggerSelect(); renderChannels(); renderEventPanels();
      toast(`Expertise level set to ${lv.name} — ${lv.tag}.`);
    };
    wrap.appendChild(card);
  }
}
function updateLevelBadge() {
  $('level-badge').textContent = LEVELS[state.level].name.toUpperCase();
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
function show(view) {
  if ((view === 'events' || view === 'analysis') && !state.collisionsReady) {
    toast('No collision data yet — run a fill to STABLE BEAMS in the Control Room first.');
    view = 'control';
  }
  state.view = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view));
  if (view === 'learn' && !learnRendered) renderLearn();
  if (view === 'analysis') renderDatasetInfo();
  if (view === 'control' || view === 'learn' || view === 'analysis') audio.narrate(view);
}
document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => { audio.click(); show(b.dataset.view); });
$('btn-start-sim').onclick = () => { audio.click(); show('control'); };
$('btn-start-learn').onclick = () => { audio.click(); show('learn'); };
function updateNavLocks() {
  $('nav-events').classList.toggle('locked', !state.collisionsReady);
  $('nav-analysis').classList.toggle('locked', !state.collisionsReady);
}

// ---------------------------------------------------------------------------
// Learn section
// ---------------------------------------------------------------------------
let learnRendered = false;
function renderLearn() {
  learnRendered = true;
  const nav = $('learn-nav');
  nav.innerHTML = '';
  let group = null;
  for (const s of LEARN_SECTIONS) {
    if (s.group !== group) {
      group = s.group;
      const g = document.createElement('div');
      g.className = 'learn-nav-group'; g.textContent = group.toUpperCase();
      nav.appendChild(g);
    }
    const b = document.createElement('button');
    b.textContent = s.nav; b.dataset.key = s.key;
    b.onclick = () => showLearnSection(s.key);
    nav.appendChild(b);
  }
  showLearnSection('cern');
}
function showLearnSection(key) {
  const s = LEARN_SECTIONS.find(x => x.key === key);
  $('learn-content').innerHTML =
    `<h1>${s.title}</h1><div class="subtitle">${s.subtitle}</div>` + s.html;
  document.querySelectorAll('#learn-nav button').forEach(b =>
    b.classList.toggle('active', b.dataset.key === key));
  $('view-learn').scrollTop = 0; window.scrollTo(0, 0);
  const fig = document.getElementById('fig-complex');
  if (fig) drawComplexFigure(fig);
}

// ---------------------------------------------------------------------------
// Fill configuration (level-gated)
// ---------------------------------------------------------------------------
const CONFIG_ITEMS = [
  { key: 'species', label: 'Beam species', minLevel: 1, type: 'select',
    options: [['pp', 'Protons (pp)'], ['pbpb', 'Lead ions (Pb–Pb)']], value: 'pp',
    help: 'ALICE is optimised for Pb–Pb; ~1 month of ion running per year.' },
  { key: 'energy', label: 'Energy per beam', minLevel: 1, type: 'select',
    options: [['6800', '6.8 TeV (Run 3)'], ['6500', '6.5 TeV (Run 2)'], ['7000', '7.0 TeV (design)']], value: '6800',
    help: '√s = 2 × beam energy for head-on pp collisions.' },
  { key: 'nBunches', label: 'Bunches per beam', minLevel: 2, type: 'range',
    min: 100, max: 2808, step: 4, value: 2400, unit: '',
    help: 'Max 2808 of 3564 slots — gaps are needed for kicker rise times.' },
  { key: 'ppb', label: 'Protons per bunch', minLevel: 2, type: 'range',
    min: 0.5, max: 1.8, step: 0.05, value: 1.6, unit: '×10¹¹',
    help: 'Luminosity scales with the SQUARE of bunch intensity.' },
  { key: 'emittance', label: 'Norm. emittance εN', minLevel: 3, type: 'range',
    min: 1.2, max: 3.5, step: 0.1, value: 2.0, unit: 'μm·rad',
    help: 'Beam phase-space size; smaller = brighter. Set by the injectors.' },
  { key: 'betaStar', label: 'β* at ATLAS/CMS', minLevel: 3, type: 'range',
    min: 0.15, max: 2.0, step: 0.05, value: 0.30, unit: 'm',
    help: 'Optics squeeze at the IP: beam size σ* = √(εβ*). L ∝ 1/β*.' },
  { key: 'xangle', label: 'Half crossing angle', minLevel: 3, type: 'range',
    min: 100, max: 320, step: 5, value: 160, unit: 'μrad',
    help: 'Prevents ~30 parasitic bunch encounters near each IP; costs luminosity via the geometric factor.' },
  { key: 'leveling', label: 'Luminosity levelling', minLevel: 4, type: 'check', value: true,
    help: 'Hold luminosity at a target (e.g. 2.0×10³⁴) by adjusting beam overlap, instead of letting it spike and decay.' },
  { key: 'rf', label: 'RF voltage', minLevel: 4, type: 'range',
    min: 8, max: 16, step: 0.5, value: 16, unit: 'MV',
    help: '400 MHz superconducting cavities at Point 4.' },
];
const cfgValues = {};

function renderConfig() {
  const wrap = $('config-controls');
  wrap.innerHTML = '';
  for (const it of CONFIG_ITEMS) {
    cfgValues[it.key] = cfgValues[it.key] ?? it.value;
    const locked = state.level < it.minLevel;
    const div = document.createElement('div');
    div.className = 'cfg-item' + (locked ? ' cfg-locked' : '');
    if (locked) div.dataset.lockmsg = `unlocks at ${LEVELS[it.minLevel].name}`;
    const valStr = () => {
      const v = cfgValues[it.key];
      if (it.type === 'select') return '';
      if (it.type === 'check') return v ? 'ON' : 'OFF';
      return `${v} ${it.unit}`;
    };
    const lab = document.createElement('label');
    lab.innerHTML = `<span>${it.label}</span><span class="cfg-val">${valStr()}</span>`;
    div.appendChild(lab);
    let input;
    if (it.type === 'select') {
      input = document.createElement('select');
      for (const [v, txt] of it.options) {
        const o = document.createElement('option');
        o.value = v; o.textContent = txt; input.appendChild(o);
      }
      input.value = cfgValues[it.key];
      input.onchange = () => { cfgValues[it.key] = input.value; audio.click(); updateConfigHint(); };
    } else if (it.type === 'check') {
      input = document.createElement('input'); input.type = 'checkbox';
      input.checked = !!cfgValues[it.key];
      input.onchange = () => { cfgValues[it.key] = input.checked; lab.querySelector('.cfg-val').textContent = valStr(); updateConfigHint(); };
    } else {
      input = document.createElement('input'); input.type = 'range';
      input.min = it.min; input.max = it.max; input.step = it.step;
      input.value = cfgValues[it.key];
      input.oninput = () => {
        cfgValues[it.key] = parseFloat(input.value);
        lab.querySelector('.cfg-val').textContent = valStr();
        updateConfigHint();
      };
    }
    if (locked) input.disabled = true;
    div.appendChild(input);
    const help = document.createElement('div');
    help.className = 'cfg-help'; help.textContent = it.help;
    div.appendChild(help);
    wrap.appendChild(div);
  }
  updateConfigHint();
}

function currentConfig() {
  return {
    species: cfgValues.species,
    energy_GeV: parseInt(cfgValues.energy, 10),
    nBunches: cfgValues.species === 'pbpb' ? 1240 : Math.round(cfgValues.nBunches),
    ppb: cfgValues.ppb * 1e11,
    emittance_um: cfgValues.emittance,
    betaStarTarget_m: cfgValues.betaStar,
    crossingAngle_urad: cfgValues.xangle,
    leveling: !!cfgValues.leveling,
    levelTarget: 2.0,
    rfVoltage_MV: cfgValues.rf,
  };
}

function updateConfigHint() {
  // predicted luminosity with these settings (peak, at full squeeze)
  const c = currentConfig();
  if (c.species === 'pbpb') {
    $('config-hint').innerHTML = `Pb–Pb fill: √s<sub>NN</sub> = 5.36 TeV, 1240 bunches, ` +
      `ℒ ~ 6×10²⁷ cm⁻²s⁻¹. ALICE is the featured detector.`;
    return;
  }
  const gamma = c.energy_GeV / 0.93827;
  const sigStar = Math.sqrt((c.emittance_um * 1e-6 / gamma) * c.betaStarTarget_m);
  const R = 1 / Math.sqrt(1 + Math.pow((c.crossingAngle_urad * 1e-6 * 0.09) / (2 * sigStar), 2));
  let L = (MACHINE.revolutionFreq_hz * c.nBunches * c.ppb * c.ppb * R) /
    (4 * Math.PI * sigStar * sigStar) * 1e-4 / 1e34;
  const leveled = c.leveling && L > c.levelTarget;
  if (leveled) L = c.levelTarget;
  const mu = (L * 1e34 * MACHINE.inelasticXsec_mb * 1e-27) / (c.nBunches * MACHINE.revolutionFreq_hz);
  $('config-hint').innerHTML =
    `Predicted peak: <b style="color:var(--accent2)">ℒ = ${L.toFixed(2)}×10³⁴ cm⁻²s⁻¹</b>${leveled ? ' (levelled)' : ''}, ` +
    `pile-up μ ≈ <b>${mu.toFixed(0)}</b>, beam size at IP σ* ≈ ${(sigStar * 1e6).toFixed(0)} μm, ` +
    `geometric factor R = ${R.toFixed(2)}.` +
    (state.level >= 3 ? '' : ' <i>(Raise your expertise level to control more of these.)</i>');
}

// ---------------------------------------------------------------------------
// Control room: run / dump, page 1, readouts, log
// ---------------------------------------------------------------------------
$('btn-run').onclick = () => {
  if (machine.phase !== PHASES.NOBEAM) { toast('A fill is already in progress. Dump the beams first.'); return; }
  machine.startFill(currentConfig());
  audio.inject();
  $('btn-dump').disabled = false;
  $('btn-run').disabled = true;
};
$('btn-dump').onclick = () => { machine.dump(); audio.dump(); };
$('btn-goto-events').onclick = () => show('events');

const PHASE_NARRATION = { INJECT: 'inject', RAMP: 'ramp', SQUEEZE: 'squeeze', STABLE: 'stable', DUMP: 'dump' };
machine.on('phase', (p) => {
  if (PHASE_NARRATION[p.key]) audio.narrate(PHASE_NARRATION[p.key]);
  if (p.key === 'STABLE') {
    state.collisionsReady = true;
    state.frozen = machine.snapshot();
    state.frozen.cfg = machine.cfg;
    updateNavLocks();
    audio.stableBeams();
    $('collision-cta').classList.remove('hidden');
    renderDetectorCards();
    toast('STABLE BEAMS — collision data is now available in the Event Display.');
  } else {
    $('collision-cta').classList.add('hidden');
    if (p.key === 'NOBEAM') { $('btn-run').disabled = false; $('btn-dump').disabled = true; }
    if (p.key !== 'NOBEAM') audio.phaseChange();
  }
});
machine.on('log', ({ msg, hl, t }) => {
  const lp = $('log-panel');
  const line = document.createElement('div');
  line.className = 'log-line' + (hl ? ' log-hl' : '');
  line.innerHTML = `<span class="log-time">${t}</span> ${msg}`;
  lp.prepend(line);
  while (lp.children.length > 40) lp.removeChild(lp.lastChild);
});

function fmtIntensity(n) {
  if (n <= 0) return '0';
  const e = Math.floor(Math.log10(n));
  return `${(n / 10 ** e).toFixed(2)}e${e}`;
}

function updateControlRoom(snap) {
  // Page 1
  $('p1-fill').textContent = 'Fill: ' + snap.fill;
  $('p1-clock').textContent = new Date().toTimeString().slice(0, 8);
  const modeEl = $('p1-mode');
  modeEl.textContent = snap.phase.label;
  modeEl.className = 'page1-mode ' + snap.phase.cls;
  $('p1-comment').textContent = snap.phase.comment;
  const tgt = Math.max(snap.targetIntensity, 1);
  $('p1-b1').style.width = Math.min(100, snap.intensity1 / tgt * 100) + '%';
  $('p1-b2').style.width = Math.min(100, snap.intensity2 / tgt * 100) + '%';
  $('p1-en').style.width = Math.min(100, snap.energy_GeV / 7000 * 100) + '%';
  $('p1-b1v').textContent = fmtIntensity(snap.intensity1) + ' p';
  $('p1-b2v').textContent = fmtIntensity(snap.intensity2) + ' p';
  $('p1-env').textContent = snap.energy_GeV >= 1000
    ? (snap.energy_GeV / 1000).toFixed(2) + ' TeV' : Math.round(snap.energy_GeV) + ' GeV';

  // readouts
  const ro = [
    ['Beam energy', snap.energy_GeV >= 1000 ? (snap.energy_GeV / 1000).toFixed(3) + ' TeV' : Math.round(snap.energy_GeV) + ' GeV', true],
    ['√s (pp)', ((snap.energy_GeV * 2) / 1000).toFixed(1) + ' TeV'],
    ['Dipole field', snap.dipoleB_T.toFixed(2) + ' T'],
    ['Dipole current', Math.round(snap.dipoleI_A).toLocaleString() + ' A'],
    ['Lorentz γ', snap.gamma > 0 ? Math.round(snap.gamma).toLocaleString() : '—'],
    ['β* (IP1/IP5)', snap.betaStar_cm.toFixed(0) + ' cm'],
    ['Stored energy', snap.stored_MJ.toFixed(0) + ' MJ'],
    ['Pile-up μ', snap.pileup > 0 ? snap.pileup.toFixed(1) : '—', snap.pileup > 0],
  ];
  $('readouts').innerHTML = ro.map(([k, v, hot]) =>
    `<div class="readout"><span class="k">${k}</span><span class="v${hot ? ' hot' : ''}">${v}</span></div>`).join('');

  const lum = snap.lumi;
  const fmtL = (x) => {
    if (x <= 0) return '0.00';
    if (x < 0.001) return (x * 1e7).toFixed(1) + 'e-7';
    return x.toFixed(3);
  };
  $('lumi-readouts').innerHTML = ['ATLAS', 'CMS', 'ALICE', 'LHCb'].map(d =>
    `<div class="readout"><span class="k" style="color:${DETECTORS[d].color}">${d}</span>` +
    `<span class="v">${fmtL(lum[d])}</span></div>`).join('') +
    `<div class="readout" style="grid-column:1/-1"><span class="k">∫ℒdt this fill (ATLAS)</span>` +
    `<span class="v hot">${(snap.integrated_fb * 1000).toFixed(1)} pb⁻¹</span></div>`;
}

// ---------------------------------------------------------------------------
// Event display
// ---------------------------------------------------------------------------
const eventDisplay = new EventDisplay($('event-canvas'));

function renderDetectorCards() {
  const wrap = $('detector-cards');
  wrap.innerHTML = '';
  for (const key of ['ATLAS', 'CMS', 'ALICE', 'LHCb']) {
    const d = DETECTORS[key];
    const card = document.createElement('div');
    card.className = 'detector-card' + (state.detector === key ? ' selected' : '');
    card.innerHTML = `<div class="dname" style="color:${d.color}">${d.name} <span style="color:var(--txt-dim);font-weight:400;font-size:10.5px">IP${d.ip}</span></div>
      <div class="ddesc">${d.short}</div>`;
    card.onclick = () => { audio.click(); selectDetector(key); };
    wrap.appendChild(card);
  }
}

function triggerOptions() {
  const det = DETECTORS[state.detector];
  const isIon = state.frozen && state.frozen.cfg && state.frozen.cfg.species === 'pbpb';
  if (isIon) return ['Pb–Pb central (0–10%)', 'Pb–Pb mid-central (30–50%)', 'Pb–Pb peripheral'];
  if (state.level === 0) return ['Highlights (best events)'];
  if (state.level === 1) return ['Highlights (best events)', 'Any (min-bias)'];
  return ['Highlights (best events)', ...det.triggers];
}

function selectDetector(key) {
  state.detector = key;
  audio.narrate(key.toLowerCase());
  renderDetectorCards();
  $('event-controls').classList.remove('hidden');
  $('ed-title').textContent = `${DETECTORS[key].name} — ${DETECTORS[key].full}`;
  renderTriggerSelect();
  renderLegend();
  nextEvent();
}

function renderTriggerSelect() {
  if (!state.detector) return;
  const wrap = $('trigger-select-wrap');
  const opts = triggerOptions();
  if (!opts.includes(state.trigger)) state.trigger = opts[0];
  wrap.innerHTML = '';
  const sel = document.createElement('select');
  for (const o of opts) { const e = document.createElement('option'); e.value = o; e.textContent = o; sel.appendChild(e); }
  sel.value = state.trigger;
  sel.onchange = () => { state.trigger = sel.value; audio.click(); nextEvent(); };
  wrap.appendChild(sel);
  const note = document.createElement('div');
  note.className = 'cfg-help';
  note.textContent = state.level >= 2
    ? 'Trigger streams are enriched: rare processes are pre-selected, as the real trigger menus do.'
    : 'Choose which kind of collisions to look at.';
  wrap.appendChild(note);

  // display toggles
  const dt = $('display-toggles');
  dt.innerHTML = '';
  if (state.level >= 2) {
    for (const [key, label, def] of [
      ['showPileup', 'Show pile-up tracks (faint grey)', true],
      ['showLabels', 'Show layer labels', true],
      ['showCalo', 'Show calorimeter deposits', true]]) {
      const l = document.createElement('label');
      l.className = 'chk';
      const c = document.createElement('input');
      c.type = 'checkbox'; c.checked = eventDisplay.opts[key] ?? def;
      c.onchange = () => { eventDisplay.setOptions({ [key]: c.checked }); };
      l.appendChild(c); l.appendChild(document.createTextNode(' ' + label));
      dt.appendChild(l);
    }
  }
}

// map trigger selection to a physics process
function pickProcess() {
  const t = state.trigger || '';
  const det = state.detector;
  const w = (list) => {   // weighted pick [[key, weight]...]
    const tot = list.reduce((s, x) => s + x[1], 0);
    let r = Math.random() * tot;
    for (const [k, wt] of list) { r -= wt; if (r <= 0) return k; }
    return list[0][0];
  };
  if (t.includes('Pb–Pb central')) return { key: 'pbpb', centrality: 'central' };
  if (t.includes('mid-central')) return { key: 'pbpb', centrality: 'midcentral' };
  if (t.includes('peripheral')) return { key: 'pbpb', centrality: 'peripheral' };
  if (t.includes('Highlights')) {
    if (det === 'LHCb') return { key: w([['bjpsik', 5], ['bsmumu', 1], ['zll', 1]]) };
    if (det === 'ALICE') return { key: 'pbpb', centrality: 'midcentral' };
    return { key: w([['hgg', 2], ['h4l', 2], ['zll', 3], ['ttbar', 2], ['wlnu', 2], ['dijet', 2]]) };
  }
  if (t.includes('min-bias')) return { key: w([['minbias', 8], ['dijet', 2]]) };
  if (t.includes('Single muon')) return { key: w([['wlnu', 6], ['zll', 2], ['ttbar', 2]]) };
  if (t.includes('Di-photon')) return { key: w([['hgg', 7], ['dijet', 3]]) };
  if (t.includes('Di-lepton')) return { key: w([['zll', 8], ['h4l', 1], ['ttbar', 1]]) };
  if (t.includes('High-mass')) return { key: w([['hgg', 4], ['h4l', 4], ['ttbar', 2]]) };
  if (t.includes('Multi-jet')) return { key: w([['dijet', 8], ['ttbar', 2]]) };
  if (t.includes('J/ψ')) return { key: 'bjpsik' };
  if (t.includes('B_s')) return { key: 'bsmumu' };
  if (t.includes('D meson')) return { key: 'bjpsik' };
  if (t.includes('pp reference')) return { key: 'minbias' };
  return { key: 'minbias' };
}

function nextEvent() {
  if (!state.detector || !state.frozen) return;
  const { key, centrality } = pickProcess();
  const mu = Math.min(state.frozen.pileup || 0, state.detector === 'LHCb' ? 5 : 60);
  state.event = generateEvent(key, state.detector, { pileup: state.level >= 2 ? mu : Math.min(mu, 8), centrality });
  state.eventCount++;
  eventDisplay.setEvent(state.event, state.detector);
  audio.collision();
  renderEventPanels();
}

$('btn-next-ev').onclick = () => { audio.click(); nextEvent(); };
$('btn-prev-ev').onclick = () => { audio.click(); nextEvent(); };  // stream is forward-only, like the real DAQ
$('chk-autoplay').onchange = (e) => { state.autoplay = e.target.checked; };
setInterval(() => { if (state.autoplay && state.view === 'events') nextEvent(); }, 2600);

function renderLegend() {
  const leg = $('ed-legend');
  leg.innerHTML = Object.values(KIND_STYLE).map(s =>
    `<span class="leg-item"><span class="leg-swatch" style="background:${s.color}"></span>${s.label}</span>`
  ).join('') + `<span class="leg-item"><span class="leg-swatch" style="background:#4a586e"></span>pile-up</span>`;
}

function renderEventPanels() {
  if (!state.event) return;
  const ev = state.event;
  $('ed-eventinfo').textContent =
    `Fill ${state.frozen.fill} · Event ${state.eventCount} · BX ${ev.bunchCrossing} · μ=${ev.pileup}`;

  // summary
  const main = ev.particles.filter(p => !p.isPileup);
  const count = (k) => main.filter(p => p.kind === k).length;
  $('event-summary').innerHTML =
    `<div class="proc-name">${ev.process.name}</div>
     <div style="font-family:var(--mono);font-size:11.5px;color:var(--accent)">${ev.process.tex}</div>
     <div class="proc-desc">${ev.process.desc}</div>
     <div style="margin-top:8px;font-size:12px">
       ${count('muon')} μ · ${count('electron')} e · ${count('photon')} γ ·
       ${count('jet') + count('bjet')} jets · ${main.filter(p => p.kind === 'hadron').length} hadrons
       ${ev.met ? ` · <b style="color:${KIND_STYLE.neutrino.color}">pT-miss ${ev.met.pt.toFixed(0)} GeV</b>` : ''}
     </div>`;

  // particle table (level >= 1); expert adds parent + charge
  const pt = $('particle-table');
  if (state.level === 0) {
    pt.innerHTML = `<div class="cfg-help" style="margin-top:8px">Raise your expertise level to see per-particle kinematics.</div>`;
  } else {
    let rows = main
      .filter(p => p.kind !== 'hadron' || p.p4.pt > 2 || main.length < 12)
      .sort((a, b) => b.p4.pt - a.p4.pt)
      .slice(0, state.level >= 3 ? 18 : 8);
    if (rows.length === 0) rows = [...main].sort((a, b) => b.p4.pt - a.p4.pt).slice(0, 8);
    const expert = state.level >= 4;
    pt.innerHTML = `<table><tr><th>part.</th><th>pT</th><th>η</th><th>φ</th>${state.level >= 2 ? '<th>E</th>' : ''}${expert ? '<th>from</th>' : ''}</tr>` +
      rows.map(p => {
        const c = KIND_STYLE[p.kind] ? KIND_STYLE[p.kind].color : '#fff';
        return `<tr><td style="color:${c}">${p.sym}</td>` +
          `<td>${p.p4.pt.toFixed(1)}</td><td>${p.p4.eta.toFixed(2)}</td><td>${p.p4.phi.toFixed(2)}</td>` +
          (state.level >= 2 ? `<td>${p.p4.E.toFixed(1)}</td>` : '') +
          (expert ? `<td>${p.parent || '—'}</td>` : '') + `</tr>`;
      }).join('') + `</table>
      <div class="cfg-help">pT, E in GeV. Sorted by pT${state.level < 3 ? ' (top 8)' : ''}.</div>`;
  }

  // physics box
  const eph = $('event-physics');
  let html = '';
  if (ev.physics.resonance && state.level >= 1) {
    const r = ev.physics.resonance;
    html += `<div class="ep-box"><div class="ep-title">WHAT HAPPENED</div>
      <b>${r.decay || r.name}</b>` +
      (r.flightLength_mm ? `<div>B hadron flight distance: <b>${r.flightLength_mm.toFixed(1)} mm</b> before decaying (cτ·γβ).</div>` : '') +
      (r.nch ? `<div>Charged multiplicity in acceptance: <b>${r.nch}</b> · elliptic flow v₂ ≈ ${r.v2}</div>` : '') +
      `</div>`;
  }
  if (ev.physics.masses.length && state.level >= 2) {
    html += ev.physics.masses.map(m =>
      `<div class="ep-box"><div class="ep-title">INVARIANT MASS</div>
       <div class="eq">${m.label} = ${m.value.toFixed(m.value < 10 ? 3 : 1)} GeV</div>
       <div class="cfg-help">expected: ${m.expect} (difference = detector resolution${m.label.startsWith('mT') ? ' + neutrino kinematics' : ''})</div>
       </div>`).join('');
  } else if (ev.physics.masses.length) {
    html += `<div class="ep-box"><div class="ep-title">INVARIANT MASS</div>
      <div class="cfg-help">Unlocks at Knowledgeable level — the mass of the decayed particle can be reconstructed from its daughters.</div></div>`;
  }
  if (state.level >= 3 && ev.process.key !== 'pbpb') {
    html += `<div class="ep-box"><div class="ep-title">PILE-UP</div>
      <div>${ev.pileup} additional soft pp interactions in this bunch crossing (Poisson, μ from machine conditions).</div></div>`;
  }
  eph.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Analysis view
// ---------------------------------------------------------------------------
const histo = new Histogram($('histo-canvas'));

const ANNOTATIONS = {
  dimuon: [{ x: 3.097, label: 'J/ψ' }, { x: 3.686, label: 'ψ(2S)' }, { x: 9.46, label: 'Υ(1S,2S,3S)' }, { x: 91.19, label: 'Z⁰' }],
  hgg: [{ x: 125.25, label: 'H → γγ' }],
  h4l: [{ x: 91.19, label: 'Z → 4ℓ' }, { x: 125.25, label: 'H' }],
  mtw: [{ x: 80.38, label: 'm(W) edge' }],
  jetpt: [],
  bmass: [{ x: 5.279, label: 'B⁺' }],
};

function renderChannels() {
  const wrap = $('channel-select');
  wrap.innerHTML = '';
  for (const ch of ANALYSIS_CHANNELS) {
    const locked = state.level < ch.minLevel;
    const b = document.createElement('button');
    b.className = 'channel-btn' + (state.channel === ch.key ? ' selected' : '');
    b.disabled = locked;
    b.style.opacity = locked ? 0.4 : 1;
    b.innerHTML = `${ch.name}<span class="ch-sub">${locked ? '🔒 unlocks at ' + LEVELS[ch.minLevel].name : ch.xlabel}</span>`;
    b.onclick = () => { audio.click(); selectChannel(ch.key); };
    wrap.appendChild(b);
  }
  renderCuts();
}

function selectChannel(key) {
  state.channel = key;
  if (!state.data[key]) collectData(key, 4000);
  renderChannels();
  refreshHisto();
}

function collectData(key, n) {
  const vals = generateAnalysisSample(key, n, state.cuts);
  state.data[key] = (state.data[key] || []).concat(vals);
  state.dataEvents += n;
}

$('btn-collect').onclick = () => {
  audio.click();
  if (!state.channel) { toast('Choose an analysis channel first.'); return; }
  collectData(state.channel, 6000);
  refreshHisto();
  renderDatasetInfo();
};

function renderCuts() {
  const wrap = $('cuts-panel');
  if (state.level < 3) {
    wrap.innerHTML = state.channel
      ? `<div class="cfg-help" style="margin-top:10px">Kinematic cuts unlock at Accomplished level.</div>` : '';
    return;
  }
  wrap.innerHTML = `<h3 class="panel-title" style="margin-top:6px">SELECTION CUTS</h3>`;
  const mk = (label, key, min, max, step, unit) => {
    const div = document.createElement('div');
    div.className = 'cfg-item';
    div.innerHTML = `<label><span>${label}</span><span class="cfg-val">${state.cuts[key]} ${unit}</span></label>`;
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = state.cuts[key];
    inp.oninput = () => {
      state.cuts[key] = parseFloat(inp.value);
      div.querySelector('.cfg-val').textContent = `${state.cuts[key]} ${unit}`;
      reapplyCuts();
    };
    div.appendChild(inp);
    wrap.appendChild(div);
  };
  mk('Lepton/photon pT >', 'ptMin', 0, 40, 1, 'GeV');
  mk('|η| <', 'etaMax', 0.8, 2.5, 0.1, '');
  const l = document.createElement('label');
  l.className = 'chk';
  const c = document.createElement('input');
  c.type = 'checkbox'; c.checked = state.cuts.displacedVertex;
  c.onchange = () => { state.cuts.displacedVertex = c.checked; reapplyCuts(); };
  l.appendChild(c);
  l.appendChild(document.createTextNode(' Require displaced vertex (B physics)'));
  wrap.appendChild(l);
  const note = document.createElement('div');
  note.className = 'cfg-help';
  note.textContent = 'Cuts regenerate the selected sample — watch peaks sharpen and background fall.';
  wrap.appendChild(note);
}

function reapplyCuts() {
  if (!state.channel) return;
  const n = Math.max(4000, (state.data[state.channel] || []).length);
  state.data[state.channel] = [];
  collectData(state.channel, n);
  refreshHisto();
}

function refreshHisto() {
  const ch = ANALYSIS_CHANNELS.find(c => c.key === state.channel);
  if (!ch) return;
  const vals = state.data[ch.key] || [];
  $('ana-header').textContent = `${ch.name} — ${vals.length.toLocaleString()} selected events`;
  histo.setData(vals, {
    range: ch.range, bins: ch.bins, log: ch.log, logx: ch.key === 'dimuon',
    xlabel: ch.xlabel, unit: ch.unit, annotations: ANNOTATIONS[ch.key],
  });
  $('ana-explain').innerHTML = `<h4>What you are looking at</h4><p>${ch.blurb}</p>` +
    (state.level >= 3 ? `<p style="color:var(--txt-dim);font-size:12.5px">Try the cuts: a pT threshold suppresses the soft
     background (steeply falling spectra) far more than signal — exactly how real analyses gain sensitivity.
     Statistical fluctuations create fake bumps in small samples; record more data and see which peaks survive. That is the
     daily life of an LHC physicist.</p>` : '');
  renderDatasetInfo();
}

function renderDatasetInfo() {
  const el = $('dataset-info');
  if (!el) return;
  el.innerHTML = `<div class="big">${state.dataEvents.toLocaleString()}</div>
    <div class="cfg-help">triggered events recorded${state.frozen ? ` · fill ${state.frozen.fill}` : ''}</div>`;
}

// ---------------------------------------------------------------------------
// Audio + narration toggles, captions
// ---------------------------------------------------------------------------
$('audio-toggle').onclick = () => {
  const on = audio.toggle();
  $('audio-toggle').textContent = on ? '🔊' : '🔇';
  $('audio-toggle').classList.toggle('off', !on);
  toast(on ? 'Sound on — music, machine sounds and voice narration enabled.' : 'Sound off.');
  if (on) {
    if (!audio.played.has('welcome')) {
      audio.narrate('welcome');
    } else if (state.view !== 'home') {
      // sound switched on mid-session: catch up with the current context
      audio.narrate(state.view === 'events' && state.detector ? state.detector.toLowerCase() : state.view);
    }
  }
};
$('voice-toggle').onclick = () => {
  const on = audio.toggleVoice();
  $('voice-toggle').classList.toggle('off', !on);
  toast(on ? 'Voice narration on.' : 'Voice narration off — music and machine sounds stay on.');
};
$('caption-close').onclick = () => audio.stopNarration();
audio.onCaption = (text) => {
  $('caption').classList.toggle('hidden', !text);
  $('voice-toggle').classList.toggle('speaking', !!text);
  if (text) $('caption-text').textContent = text;
};

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const ringView = new RingView($('ring-canvas'), machine);
const injectorView = new InjectorView($('injector-canvas'), machine);
let last = performance.now(), roTimer = 0;

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  machine.tick(dt);
  if (machine.phase.key === 'RAMP') audio.rampTick(machine.energy_GeV / 7000);
  if (machine.phase.key === 'STABLE') audio.collision();

  if (state.view === 'control') {
    ringView.draw(dt);
    injectorView.draw(dt);
    roTimer += dt;
    if (roTimer > 0.15) { roTimer = 0; updateControlRoom(machine.snapshot()); }
  } else if (state.view === 'events' && state.event) {
    eventDisplay.draw(dt);
  }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
renderLevelCards();
updateLevelBadge();
renderConfig();
renderDetectorCards();
renderChannels();
updateNavLocks();
updateControlRoom(machine.snapshot());
startHero($('hero-canvas'));
requestAnimationFrame(loop);
