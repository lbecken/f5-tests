// ============================================================================
// LHC SIMULATOR — LEARN SECTION CONTENT
// Written for a physics undergraduate (~20 y.o.) with solid maths/mechanics/EM
// and an introductory grasp of special relativity and quantum mechanics.
// ============================================================================

export const LEARN_SECTIONS = [
  // =========================================================================
  { group: 'The Laboratory', key: 'cern', title: 'CERN', nav: 'CERN — the laboratory',
    subtitle: 'CONSEIL EUROPÉEN POUR LA RECHERCHE NUCLÉAIRE · FOUNDED 1954 · GENEVA',
    html: `
<p><strong>CERN</strong> is the world's largest particle-physics laboratory, straddling the
Franco-Swiss border near Geneva. It was founded in 1954 by 12 European states as one of Europe's
first joint scientific ventures — the idea was to pool resources for fundamental research that no
single post-war country could afford, and to do it openly, for peaceful purposes only. Today it has
25 member states, employs ~2,700 staff, and hosts over <strong>12,000 visiting scientists</strong>
from more than 100 nationalities — about half of the world's particle physicists.</p>

<div class="stat-grid">
  <div class="stat-box"><span class="v">1954</span><span class="k">founded</span></div>
  <div class="stat-box"><span class="v">25</span><span class="k">member states</span></div>
  <div class="stat-box"><span class="v">~12,000</span><span class="k">visiting scientists</span></div>
  <div class="stat-box"><span class="v">~1.2 TWh/yr</span><span class="k">energy use (≈ Geneva canton)</span></div>
</div>

<h2>What CERN is actually for</h2>
<p>The mission is to answer the most basic questions: <em>what is the universe made of, and what
holds it together?</em> The tools are accelerators — machines that concentrate energy into a
region ~10⁻¹⁹ m across, recreating conditions less than a billionth of a second after the Big
Bang. By <span class="eq-inline">E = mc²</span>, that concentrated energy can turn into particles
that haven't existed naturally since the early universe.</p>

<h2>Things CERN gave the world (besides physics)</h2>
<ul>
<li><strong>The World Wide Web</strong> — invented at CERN in 1989 by Tim Berners-Lee to let
physicists share data. CERN put it in the public domain in 1993. The first website ran on a NeXT
computer in Building 31.</li>
<li><strong>Antimatter medicine</strong> — PET scanners descend directly from particle-detector
technology; CERN's antiproton decelerator studies antimatter for physics <em>and</em> for cancer
therapy research.</li>
<li><strong>Grid & scientific computing</strong> — the Worldwide LHC Computing Grid links ~170
computing centres in 40+ countries to process the ~1 petabyte/day the experiments produce.</li>
<li><strong>Touchscreens</strong> — capacitive touchscreens were developed at CERN in the early
1970s for the SPS control room.</li>
</ul>

<h2>A short timeline a physicist should know</h2>
<table>
<tr><th>Year</th><th>Milestone</th></tr>
<tr><td>1954</td><td>CERN convention ratified; construction begins in Meyrin.</td></tr>
<tr><td>1959</td><td>Proton Synchrotron (PS) starts — briefly the world's highest-energy accelerator. <em>Still running today as an LHC injector.</em></td></tr>
<tr><td>1968</td><td>Georges Charpak invents the multi-wire proportional chamber (Nobel 1992) — ancestor of all modern tracking detectors.</td></tr>
<tr><td>1973</td><td>Gargamelle bubble chamber discovers <strong>weak neutral currents</strong> — first evidence for the Z boson's existence.</td></tr>
<tr><td>1983</td><td>UA1/UA2 at the SppS collider discover the <strong>W and Z bosons</strong> (Nobel 1984 for Rubbia & van der Meer).</td></tr>
<tr><td>1989–2000</td><td><strong>LEP</strong>, an e⁺e⁻ collider in the 27 km tunnel, measures the Z with exquisite precision and shows there are exactly <strong>3 light neutrino families</strong>.</td></tr>
<tr><td>1995</td><td>First anti-hydrogen atoms created.</td></tr>
<tr><td>2008</td><td>LHC starts up in the LEP tunnel (and, nine days later, suffers the famous magnet-interconnect incident — repaired by 2009).</td></tr>
<tr><td>2012</td><td>ATLAS and CMS announce the <strong>Higgs boson</strong> (Nobel 2013 for Englert & Higgs).</td></tr>
<tr><td>2015–2018</td><td>Run 2 at 13 TeV: Higgs couplings measured, pentaquarks at LHCb, QGP studies.</td></tr>
<tr><td>2022–2026</td><td>Run 3 at 13.6 TeV — the conditions this simulator reproduces.</td></tr>
<tr><td>2026–2030</td><td><strong>Long Shutdown 3 (now!)</strong>: installation of the High-Luminosity LHC upgrade, targeting 10× more data.</td></tr>
</table>

<div class="info-box gold"><strong>For your future job applications:</strong> CERN runs
the <em>Summer Student Programme</em> (undergrads spend 8–13 weeks working in a research team —
exactly your profile), <em>Technical Student</em> placements (6–12 months), and doctoral
programmes. Most physicists at CERN are not CERN employees — they belong to the worldwide
university collaborations that build and run the experiments. You don't need to "work for CERN"
to work <em>at</em> CERN: joining an ATLAS/CMS/ALICE/LHCb group at your university is the usual path.</div>
`},

  // =========================================================================
  { group: 'The Laboratory', key: 'complex', title: 'The Accelerator Complex', nav: 'Accelerator complex',
    subtitle: 'FIVE MACHINES IN SERIES · EACH ONE A FORMER FLAGSHIP',
    html: `
<p>No single machine can take protons from rest to 6.8 TeV. The LHC is only the last stage of an
<strong>injector chain</strong> in which each accelerator — most of them former flagship machines —
hands the beam to the next at ever-higher energy:</p>

<div class="learn-fig"><canvas id="fig-complex" width="800" height="300"></canvas>
<figcaption>The CERN injection chain. Energies are kinetic (LINAC4) / total per proton.</figcaption></div>

<table>
<tr><th>Machine</th><th>Built</th><th>Output energy</th><th>What it does</th></tr>
<tr><td><strong>LINAC4</strong></td><td>2020</td><td>160 MeV</td><td>Accelerates <strong>H⁻ ions</strong> (a proton with two electrons) through RF cavities. At injection into the Booster the electrons are stripped off by a foil — this "charge-exchange injection" lets you stack far more protons into the same phase space than injecting bare protons ever could.</td></tr>
<tr><td><strong>PS Booster</strong></td><td>1972</td><td>2 GeV</td><td>Four superimposed synchrotron rings, 157 m circumference. Splits the LINAC current into 4 rings to beat space-charge forces (the mutual repulsion of protons, worst at low energy).</td></tr>
<tr><td><strong>PS</strong></td><td>1959</td><td>26 GeV</td><td>The 628 m Proton Synchrotron — running since 1959! Performs the crucial <strong>RF gymnastics</strong>: bunch splitting that creates the LHC's 25 ns bunch spacing structure.</td></tr>
<tr><td><strong>SPS</strong></td><td>1976</td><td>450 GeV</td><td>The 7 km Super Proton Synchrotron — the machine that discovered the W and Z as a collider in 1983. Now the last injector: fills the LHC with trains of bunches at 450 GeV.</td></tr>
<tr><td><strong>LHC</strong></td><td>2008</td><td>6.8 TeV</td><td>Final acceleration ×15, then collisions.</td></tr>
</table>

<h2>The 25 ns bunch structure</h2>
<p>LHC beams are not continuous — they are trains of <strong>bunches</strong>, each ~1.2×10¹¹
protons, ~8 cm long, spaced 25 ns apart (≈ 7.5 m at v ≈ c). The pattern is manufactured in
the PS by RF "bunch splitting": each Booster bunch is split 3×, then 2×, then 2× — one bunch
becomes 12, spaced exactly 25 ns. A full LHC fill carries up to <strong>2,808 bunches per beam</strong>
(out of 3,564 possible 25 ns "slots"; gaps are left for injection and abort kickers to switch on).</p>

<div class="eq">Bunch crossing rate at the experiments ≈ 40 MHz &nbsp;→&nbsp; with ~60 pp interactions per crossing: <b>over 10⁹ collisions per second</b></div>

<details class="deep-dive"><summary>Deep dive: why H⁻ injection is clever (Liouville's theorem)</summary><div class="dd-body">
<p>Liouville's theorem says phase-space density of a beam is conserved under conservative forces —
you cannot inject new protons "on top of" circulating ones, because that spot in phase space is
occupied. The trick: inject <em>H⁻ ions</em> through a stripping foil placed where the circulating
proton beam passes. The foil strips both electrons, and the new proton lands on the same orbit as
the stored beam. Since the stripping is dissipative (not Hamiltonian), Liouville doesn't apply, and
you can pile turn after turn into the same phase-space area. That's how the Booster reaches
brightness the LHC needs.</p></div></details>

<div class="info-box">The injector complex serves far more than the LHC: ISOLDE (radioactive
isotopes), n_TOF (neutron physics), the Antiproton Decelerator (antihydrogen), AWAKE
(plasma-wakefield acceleration R&D), and fixed-target experiments at the SPS all run in parallel,
sharing beam pulse-by-pulse via a computer-controlled "supercycle".</div>
`},

  // =========================================================================
  { group: 'The Machine', key: 'lhc', title: 'The LHC Machine', nav: 'The LHC machine',
    subtitle: '26.7 KM · 1232 DIPOLES · 1.9 K · TWO COUNTER-ROTATING BEAMS',
    html: `
<p>The LHC is a <strong>synchrotron</strong>: a ring in which dipole magnets bend the beam onto a
closed orbit while RF cavities push it forward, with the magnetic field ramping up in sync with the
energy. It occupies the 26.7 km tunnel dug for LEP in the 1980s, ~100 m underground.</p>

<div class="stat-grid">
  <div class="stat-box"><span class="v">26,659 m</span><span class="k">circumference</span></div>
  <div class="stat-box"><span class="v">11,245</span><span class="k">revolutions per second</span></div>
  <div class="stat-box"><span class="v">1232</span><span class="k">main dipoles, 15 m each</span></div>
  <div class="stat-box"><span class="v">8.33 T</span><span class="k">design dipole field</span></div>
  <div class="stat-box"><span class="v">11,850 A</span><span class="k">dipole current</span></div>
  <div class="stat-box"><span class="v">1.9 K</span><span class="k">superfluid helium bath</span></div>
  <div class="stat-box"><span class="v">10⁻¹⁰ mbar</span><span class="k">beam vacuum</span></div>
  <div class="stat-box"><span class="v">~400 MJ</span><span class="k">energy stored per beam</span></div>
</div>

<h2>Why 6.8 TeV and not more? The bending-field limit</h2>
<p>For a relativistic particle of momentum <em>p</em> and charge <em>e</em> on a circular orbit of
radius <em>ρ</em> in field <em>B</em>:</p>
<div class="eq">p [GeV/c] = 0.3 · B [T] · ρ [m]</div>
<p>With ρ ≈ 2,804 m (the dipole-filled fraction of the ring) and B = 8.33 T you get p ≈ 7 TeV.
<strong>The tunnel circumference and the maximum field of the magnets set the energy — nothing
else.</strong> Run 3 operates at 6.8 TeV per beam to keep a comfortable margin on magnet training.
This is why the proposed Future Circular Collider needs a 91 km tunnel: same physics, bigger ρ.</p>

<h2>Superconducting magnets at 1.9 K</h2>
<p>8.33 T is far beyond iron-core magnets (~2 T max). The dipole coils are
<strong>niobium-titanium</strong> cables carrying 11,850 A with zero resistance, held at
<strong>1.9 K</strong> — colder than the 2.7 K cosmic microwave background. Why 1.9 K and not the
4.2 K of normal liquid helium? Below 2.17 K helium becomes <strong>superfluid</strong>: its thermal
conductivity becomes enormous, letting it wick heat out of the coil windings through micron-scale
channels. The LHC cryogenic system holds ~130 tonnes of helium — the largest cryogenic installation
on Earth.</p>

<details class="deep-dive"><summary>Deep dive: quenches and machine protection</summary><div class="dd-body">
<p>If a magnet segment warms locally above its critical temperature it becomes resistive — a
<strong>quench</strong>. 11.8 kA through even a tiny resistance dumps megawatts into a coil that has
millijoules of heat capacity. Quench protection detects the resistive voltage within milliseconds,
fires heaters to spread the quench over the whole magnet (diluting the energy), and extracts the
circuit energy into dump resistors. Meanwhile the <em>beam</em> itself stores ~400 MJ — enough to
melt ~500 kg of copper — so it must never touch the magnets: a triplicated system of
<strong>beam-loss monitors</strong> can trigger the abort in under 3 turns (~270 μs). The abort
kickers deflect the beam down a 700 m line into an 8 m graphite <strong>dump block</strong>, the
only object on Earth designed to absorb a full LHC beam.</p></div></details>

<h2>Two beams, one magnet</h2>
<p>Colliding protons on protons (unlike proton–antiproton) requires <em>two separate rings</em>
with opposite bending fields. The LHC's elegant solution: <strong>twin-aperture magnets</strong> —
both beam pipes inside a common yoke and cryostat, with opposite field directions, 19.4 cm apart.
The two beams cross from one aperture to the other only at the four interaction points.</p>

<h2>RF cavities: 400 MHz</h2>
<p>Sixteen superconducting cavities (eight per beam, at Point 4) oscillate at 400.79 MHz, providing
up to 16 MV. During the ~20-minute <strong>ramp</strong>, they add just ~485 keV per turn — but at
11,245 turns/s that is ~5.5 GeV/s. The RF also keeps bunches longitudinally focused: a proton
arriving late sees a larger accelerating voltage, one arriving early sees less, so protons execute
<em>synchrotron oscillations</em> about the ideal phase.</p>

<h2>Beam optics: quadrupoles, β* and the squeeze</h2>
<p>Dipoles bend; <strong>quadrupoles focus</strong>. A quadrupole focuses in one plane and defocuses
in the other, so the lattice alternates F and D quadrupoles ("FODO"), giving net focusing in both
planes — protons oscillate transversely about the ideal orbit (<em>betatron oscillations</em>). The
local beam size follows the <strong>beta function</strong> β(s):</p>
<div class="eq">σ(s) = √( ε · β(s) )&nbsp;&nbsp;&nbsp;with ε = ε<sub>N</sub>/γ the geometric emittance</div>
<p>At the interaction points, triplets of strong quadrupoles squeeze β down to
<strong>β* ≈ 30 cm</strong> (from ~11 km at its maximum in the arcs!), compressing the beam to
~13 μm RMS — a hair's width — to maximise collision rate. The <strong>"squeeze"</strong> is a
distinct phase of every fill, after the ramp: the optics are changed gradually while keeping the
beam stable. In this simulator you can control β* at the Accomplished level and watch the
luminosity respond as 1/β*.</p>

<h2>The machine cycle you will drive in the Control Room</h2>
<ol>
<li><strong>INJECTION</strong> — the SPS delivers 450 GeV bunch trains; beams accumulate over minutes.</li>
<li><strong>RAMP</strong> — dipole current rises 757 A → ~11.5 kA over ~20 min; RF tracks; energy 450 GeV → 6.8 TeV.</li>
<li><strong>FLAT TOP / SQUEEZE</strong> — β* squeezed from 1 m to 30 cm; beams still separated.</li>
<li><strong>ADJUST</strong> — beams steered into collision at the four IPs.</li>
<li><strong>STABLE BEAMS</strong> — experiments ramp up their sensitive detectors and record physics for 5–15 h while intensity decays ("luminosity burn-off").</li>
<li><strong>BEAM DUMP</strong> — planned or triggered; then ramp-down and a new fill.</li>
</ol>

<div class="info-box gold">A curious real-machine fact: the LHC's circumference changes measurably
with the Moon. Earth tides stretch the rock by ~1 mm over 27 km, shifting the beam energy by
~0.01% — LEP discovered this when its Z-mass measurements wobbled with the lunar cycle. The LHC
corrects for it in the machine model. Also monitored: the water level in Lake Geneva and the
passage of the TGV to nearby Bellegarde (whose DC return currents once perturbed LEP's magnets).</div>
`},

  // =========================================================================
  { group: 'The Machine', key: 'lumi', title: 'Luminosity & Cross-sections', nav: 'Luminosity & cross-sections',
    subtitle: 'THE NUMBERS THAT DECIDE WHAT YOU CAN DISCOVER',
    html: `
<p>Two numbers govern everything at a collider: the <strong>energy</strong> (what you <em>can</em>
create) and the <strong>luminosity</strong> (how <em>often</em> you create it). If you learn one
formula from this simulator, make it this one:</p>
<div class="eq">Rate of process X:&nbsp;&nbsp; dN/dt = ℒ · σ<sub>X</sub></div>
<p>σ<sub>X</sub> is the <strong>cross-section</strong> — an effective target area, quantum
mechanics included, expressed in <strong>barns</strong> (1 b = 10⁻²⁴ cm², roughly a uranium
nucleus; the name is from "can't hit the broad side of a barn"). ℒ is the
<strong>instantaneous luminosity</strong> in cm⁻²s⁻¹, a property of the <em>machine</em>:</p>
<div class="eq">ℒ = ( N<sub>b</sub>² · n<sub>b</sub> · f<sub>rev</sub> · γ ) / ( 4π · ε<sub>N</sub> · β* ) &nbsp;·&nbsp; R(φ)</div>
<ul>
<li><strong>N<sub>b</sub></strong> — protons per bunch (~1.6×10¹¹). Enters <em>squared</em>: brightness is everything.</li>
<li><strong>n<sub>b</sub></strong> — number of bunches (up to 2808).</li>
<li><strong>f<sub>rev</sub></strong> — revolution frequency, 11,245 Hz (fixed by the ring size).</li>
<li><strong>ε<sub>N</sub>, β*</strong> — normalised emittance and optics at the IP: smaller = denser beams = more collisions.</li>
<li><strong>R(φ)</strong> — a reduction factor (~0.7) from the <strong>crossing angle</strong> φ: beams must cross at ~160 μrad so that only one bunch pair collides per crossing, not the ~30 pairs that share the common beam pipe around the IP.</li>
</ul>

<p>Run 3 peak: ℒ ≈ 2×10³⁴ cm⁻²s⁻¹. Multiply by the inelastic cross-section
σ<sub>inel</sub> ≈ 80 mb and you get ~1.6×10⁹ interactions/s. Spread over ~2,400 colliding bunch
pairs at 11 kHz, that's <strong>μ ≈ 60 proton–proton interactions per bunch crossing</strong> —
the infamous <strong>pile-up</strong> you'll see in the event display.</p>

<h2>Integrated luminosity: the currency of data</h2>
<div class="eq">N<sub>events</sub> = σ · ∫ℒ dt&nbsp;&nbsp;&nbsp;&nbsp;[∫ℒdt] = fb⁻¹ ("inverse femtobarns")</div>
<p>Run 2 delivered ~140 fb⁻¹ to ATLAS and CMS; Run 3 roughly doubled that. A useful mental
exercise: σ(H→ZZ*→4ℓ) ≈ 7.5 fb, so 140 fb⁻¹ gives only ~1,000 golden-channel Higgs events
<em>before</em> detection efficiency. Rare physics is a brutal numbers game — this is why the
HL-LHC upgrade (3000 fb⁻¹) matters.</p>

<h2>The hierarchy of cross-sections</h2>
<p>The single most important plot in collider physics is the cross-section hierarchy — spanning
<strong>14 orders of magnitude</strong>:</p>
<table>
<tr><th>Process</th><th>σ at 13.6 TeV</th><th>Rate at ℒ = 2×10³⁴</th></tr>
<tr><td>Inelastic pp (anything)</td><td>~80 mb</td><td>1.6×10⁹ /s</td></tr>
<tr><td>b-quark pairs</td><td>~0.6 mb</td><td>~10⁷ /s</td></tr>
<tr><td>W → ℓν</td><td>~20 nb</td><td>~400 /s</td></tr>
<tr><td>Z → ℓℓ</td><td>~2 nb</td><td>~40 /s</td></tr>
<tr><td>tt̄ pairs</td><td>~0.9 nb</td><td>~18 /s</td></tr>
<tr><td>Higgs (all)</td><td>~60 pb</td><td>~1.2 /s</td></tr>
<tr><td>H → γγ</td><td>~140 fb</td><td>~1 / 6 min</td></tr>
<tr><td>H → ZZ* → 4μ</td><td>~1 fb</td><td>~2 / day</td></tr>
</table>
<p>So the detector sees a billion boring events per second, and maybe two golden Higgs events per
day. Finding them is the job of the <strong>trigger</strong> (see the detector pages) — and the
reason the analysis view of this simulator lets you choose enriched event streams.</p>

<details class="deep-dive"><summary>Deep dive: why partons make hadron colliders messy — and flexible</summary><div class="dd-body">
<p>Protons are bags of quarks and gluons ("partons"), each carrying a fraction <em>x</em> of the
proton momentum described by <strong>parton distribution functions</strong> f(x, Q²). The actual
hard collision is parton–parton, at effective energy √ŝ = √(x₁x₂s) — different for every event.
That's the price of hadron colliders (no fixed collision energy, huge QCD backgrounds) and also
their power: a 13.6 TeV pp machine scans <em>all</em> parton energies at once, which is why hadron
machines are "discovery machines" while e⁺e⁻ machines are "precision machines". The cross-section
factorises as σ = Σ<sub>ij</sub> ∫dx₁dx₂ f<sub>i</sub>(x₁)f<sub>j</sub>(x₂) σ̂<sub>ij</sub>(x₁x₂s) —
a formula you will meet on day one of any QCD course.</p></div></details>
`},

  // =========================================================================
  { group: 'The Machine', key: 'kinematics', title: 'Collider Kinematics', nav: 'Collider kinematics',
    subtitle: 'THE VARIABLES YOU WILL SEE IN EVERY EVENT DISPLAY',
    html: `
<p>Collider physicists use coordinates adapted to the physics. The beam defines the z-axis;
the interesting action is <em>transverse</em> to it. These are the variables shown for every
particle in this simulator's event display:</p>

<h2>Transverse momentum p<sub>T</sub></h2>
<div class="eq">p<sub>T</sub> = √(p<sub>x</sub>² + p<sub>y</sub>²)</div>
<p>Before the collision, the total transverse momentum is ~0. Whatever emerges must balance in the
transverse plane — this is the workhorse conservation law. High p<sub>T</sub> means a violent,
short-distance interaction: interesting. Most of the longitudinal momentum, by contrast, just
disappears down the beam pipe with the proton remnants.</p>

<h2>Pseudorapidity η</h2>
<div class="eq">η = −ln tan(θ/2)&nbsp;&nbsp;&nbsp;&nbsp;θ = polar angle from the beam</div>
<p>η = 0 is perpendicular to the beam; η = ±2.5 is θ ≈ 9.4°; η = 5 is θ ≈ 0.77°. Why this odd
variable? For massless particles it equals the <strong>rapidity</strong>
y = ½ln[(E+p<sub>z</sub>)/(E−p<sub>z</sub>)], and <em>differences in rapidity are invariant under
boosts along the beam</em>. Since every parton collision has an unknown longitudinal boost,
Δη is physical where Δθ is not. Also, soft particle production is roughly flat in η — about 6
charged particles per unit η in a min-bias event.</p>

<h2>Invariant mass — the discovery variable</h2>
<div class="eq">m² = (ΣE)² − |Σ<b>p</b>|²</div>
<p>Sum the four-momenta of a set of decay products, and the invariant mass reconstructs the mass of
whatever decayed — regardless of how fast it was moving. This is <em>the</em> tool: plot m(μ⁺μ⁻)
for millions of muon pairs and peaks appear at every neutral particle that decays to muons: J/ψ
(3.10 GeV), Υ (9.46), Z (91.2)... The Higgs was discovered as a bump in m(γγ) at 125 GeV. Try it
in the Analysis view.</p>

<h2>Missing transverse momentum (MET)</h2>
<div class="eq"><b>p</b><sub>T</sub><sup>miss</sup> = −Σ<sub>visible</sub> <b>p</b><sub>T</sub></div>
<p>Neutrinos (and any hypothetical dark-matter particle) leave without a trace. Their presence is
inferred from transverse imbalance. You can't use the longitudinal component — too much escapes
down the beam pipe — which is why only <em>transverse</em> missing momentum is meaningful, and why
for W → ℓν one plots the <strong>transverse mass</strong> instead of the mass.</p>

<h2>Why tracks curve: momentum measurement</h2>
<div class="eq">r [m] = p<sub>T</sub> [GeV] / (0.3 · B [T])&nbsp;&nbsp;&nbsp;(radius of curvature, charge |e|)</div>
<p>In CMS's 3.8 T field, a 1 GeV pion curls with r ≈ 0.9 m; a 100 GeV muon is nearly straight.
Curvature direction gives the <em>charge sign</em>; sagitta gives the momentum. The event display
in this simulator solves exactly this helix equation per particle — compare the same event in
ATLAS (2 T) and CMS (3.8 T) and you'll see the difference in curl.</p>

<h2>How a detector identifies particles</h2>
<p>All large detectors are onions with the same four layers — learn the signature table and you
can read any event display on Earth:</p>
<table>
<tr><th>Particle</th><th>Tracker</th><th>EM calorimeter</th><th>Hadronic cal.</th><th>Muon system</th></tr>
<tr><td>electron</td><td>track</td><td><strong>shower, all E</strong></td><td>—</td><td>—</td></tr>
<tr><td>photon</td><td><strong>no track</strong></td><td><strong>shower</strong></td><td>—</td><td>—</td></tr>
<tr><td>muon</td><td>track</td><td>minimal</td><td>minimal</td><td><strong>track!</strong></td></tr>
<tr><td>π±, K±, p</td><td>track</td><td>little</td><td><strong>shower</strong></td><td>—</td></tr>
<tr><td>neutron, K⁰L</td><td>no track</td><td>little</td><td><strong>shower</strong></td><td>—</td></tr>
<tr><td>quark/gluon</td><td colspan="4">a <strong>jet</strong>: collimated spray of the above</td></tr>
<tr><td>b-quark</td><td colspan="4">jet + <strong>displaced vertex</strong> (B hadron flies mm before decaying)</td></tr>
<tr><td>ν, dark matter?</td><td colspan="4"><strong>nothing</strong> → missing p<sub>T</sub></td></tr>
</table>
`},

  // =========================================================================
  { group: 'The Experiments', key: 'atlas', title: 'ATLAS', nav: 'ATLAS · IP1',
    subtitle: 'A TOROIDAL LHC APPARATUS · 46 m × 25 m · 7,000 TONNES · ~6,000 MEMBERS',
    html: `
<p><strong>ATLAS</strong> is the largest particle detector ever built — a 46 m long, 25 m diameter
cylinder that would loosely fit Notre-Dame's nave, yet weighs <em>less</em> than the (much smaller)
CMS because its defining feature is mostly <strong>empty space filled with magnetic field</strong>:
the eight-coil air-core <strong>barrel toroid</strong>, the largest superconducting magnet in the
world.</p>

<div class="stat-grid">
  <div class="stat-box"><span class="v">46 × 25 m</span><span class="k">size</span></div>
  <div class="stat-box"><span class="v">7,000 t</span><span class="k">weight (≈ Eiffel tower)</span></div>
  <div class="stat-box"><span class="v">2 T + toroids</span><span class="k">magnets</span></div>
  <div class="stat-box"><span class="v">~100 M</span><span class="k">readout channels</span></div>
</div>

<h2>Design philosophy: two independent magnet systems</h2>
<p>ATLAS measures muons <em>twice</em>: once in the inner detector (2 T solenoid) and again,
independently, in the enormous muon spectrometer bathed in the toroid field. The toroid geometry
(field circling <em>around</em> the beam axis) means muons are bent in the r–z plane over a huge
lever arm in air — no multiple scattering in iron — giving good stand-alone muon momentum
resolution even at TeV energies. This redundancy is a safety net: if a "new physics" muon shows up,
two independent systems must agree.</p>

<h2>The onion, from the beam outwards</h2>
<ul>
<li><strong>Pixel detector + IBL</strong> — 92M silicon pixels, innermost layer 3.3 cm from the beam.
Vertex resolution ~10 μm: this is what tags b-jets by their displaced vertices.</li>
<li><strong>SCT</strong> — 6M silicon strips, 4 barrels + 18 disks.</li>
<li><strong>TRT</strong> — 300k gas-filled straw tubes. Bonus: transition radiation X-rays fire only
for highly relativistic particles (γ ≳ 1000), separating electrons from pions.</li>
<li><strong>LAr electromagnetic calorimeter</strong> — lead absorbers folded into an accordion
shape (no readout gaps in φ), immersed in liquid argon at 88 K. Energy resolution
σ/E ≈ 10%/√E ⊕ 0.7%.</li>
<li><strong>Tile hadronic calorimeter</strong> — steel + scintillating tiles; measures jets.</li>
<li><strong>Muon spectrometer</strong> — thousands of drift-tube chambers over ~5,500 m², aligned
to ~30 μm by optical sensors, inside the toroid field.</li>
</ul>

<h2>Trigger: from 40 MHz to 3 kHz</h2>
<p>40 million bunch crossings per second; ~1.5 MB per event; you can afford to record ~3,000/s.
The <strong>Level-1 trigger</strong> (custom hardware, decision in 2.5 μs, using coarse calorimeter
and muon data) cuts to 100 kHz; the <strong>High-Level Trigger</strong> (a ~60,000-core CPU farm
running fast reconstruction) selects the final ~3 kHz. Every trigger decision is irreversible —
rejected events are lost forever, which is why trigger menus are among the most carefully reviewed
documents in the collaboration.</p>

<div class="info-box gold"><strong>ATLAS discovered</strong> (with CMS): the Higgs boson (2012),
Higgs couplings to τ, b, t; evidence for rare processes like light-by-light scattering in Pb–Pb
and four-top-quark production. Its 3,000-author papers hold the record for the most authors in
science.</div>

<div class="info-box">In the simulator: select ATLAS in the event display and note the gentler
track curvature (2 T vs CMS's 3.8 T) and the huge outer muon system — to scale.</div>
`},

  // =========================================================================
  { group: 'The Experiments', key: 'cms', title: 'CMS', nav: 'CMS · IP5',
    subtitle: 'COMPACT MUON SOLENOID · 21.6 m × 15 m · 14,000 TONNES',
    html: `
<p><strong>CMS</strong> asks the same physics questions as ATLAS with a deliberately opposite
design — essential for cross-checking discoveries. Where ATLAS is huge and airy, CMS is
<em>compact and dense</em>: half the length, twice the mass (14,000 t — more iron than the Eiffel
Tower), all organised around one colossal magnet.</p>

<div class="stat-grid">
  <div class="stat-box"><span class="v">3.8 T</span><span class="k">solenoid field</span></div>
  <div class="stat-box"><span class="v">2.6 GJ</span><span class="k">stored magnetic energy</span></div>
  <div class="stat-box"><span class="v">75,848</span><span class="k">PbWO₄ crystals</span></div>
  <div class="stat-box"><span class="v">14,000 t</span><span class="k">total weight</span></div>
</div>

<h2>One magnet to rule them all</h2>
<p>The 13 m long, 6 m bore superconducting solenoid produces <strong>3.8 T</strong> — the largest
such magnet ever built, storing 2.6 GJ (a 747 at cruising speed). The strong field curls tracks
tightly, giving superb momentum resolution with a compact tracker. Uniquely, the
<em>calorimeters sit inside the coil</em>, so electrons and photons are measured before crossing
any magnet material. Outside, a 12,500 t iron yoke returns the flux and hosts the muon chambers —
muons are the only charged particles that get that far, hence the name.</p>

<h2>The crystal jewel: PbWO₄ ECAL</h2>
<p>75,848 lead-tungstate crystals — transparent, but denser than steel (8.3 g/cm³), grown over
a decade in Russia and China. Scintillation light is measured with resolution
<strong>σ/E ≈ 3%/√E ⊕ 0.3%</strong> — several times finer than ATLAS's sampling calorimeter at
high energy. This was a deliberate bet on the H → γγ channel, made 20 years before the discovery:
the Higgs mass resolution in CMS's diphoton spectrum comes almost entirely from these crystals.
(Trivia: some of the HCAL brass came from melted-down Russian navy artillery shells.)</p>

<h2>Particle Flow reconstruction</h2>
<p>CMS pioneered <strong>particle-flow</strong>: instead of treating tracker and calorimeters
separately, the software builds a global list of individual particles (every π±, γ, K⁰...) by
linking tracks to calorimeter clusters. Charged hadrons (~65% of a jet's energy) take their energy
from the tracker — far more precise than the HCAL. Jet resolution improves by ~2× and pile-up
subtraction becomes possible: charged pile-up particles are identified by their vertex and removed
one by one.</p>

<h2>Built in a barn, lowered in slices</h2>
<p>Unusually, CMS was assembled <em>on the surface</em> in 15 giant slices, each lowered 100 m down
the shaft by a gantry crane between 2006–2008 — the heaviest slice, the central wheel with the
solenoid, weighed 1,920 t and cleared the shaft walls by ~20 cm on each side. The design makes CMS
maintainable: the slices can still be pulled apart on air pads during shutdowns.</p>

<div class="info-box">In the simulator: compare the same Z → μμ event in CMS and ATLAS — CMS's
3.8 T field visibly curls low-p<sub>T</sub> tracks into spirals. And note how compact the detector
cross-section is next to ATLAS's.</div>
`},

  // =========================================================================
  { group: 'The Experiments', key: 'alice', title: 'ALICE', nav: 'ALICE · IP2',
    subtitle: 'A LARGE ION COLLIDER EXPERIMENT · QUARK–GLUON PLASMA · 10,000 TONNES',
    html: `
<p><strong>ALICE</strong> is the LHC's heavy-ion specialist. For about one month per year the LHC
collides <strong>lead nuclei</strong> (fully stripped ²⁰⁸Pb⁸²⁺ ions) at √s<sub>NN</sub> = 5.36 TeV
per nucleon pair. Each central collision deposits so much energy into a nucleus-sized volume that
protons and neutrons "melt": for ~10⁻²³ s, quarks and gluons roam free in a droplet of
<strong>quark–gluon plasma (QGP)</strong> at ~5×10¹² K — 300,000 × hotter than the Sun's core, and
the state of the entire universe during its first ~10 microseconds.</p>

<div class="stat-grid">
  <div class="stat-box"><span class="v">5.36 TeV</span><span class="k">√s per nucleon pair (Pb–Pb)</span></div>
  <div class="stat-box"><span class="v">~5×10¹² K</span><span class="k">QGP temperature</span></div>
  <div class="stat-box"><span class="v">≥ 10,000</span><span class="k">particles in one central event</span></div>
  <div class="stat-box"><span class="v">12.5 G</span><span class="k">pixels in the ITS2 tracker</span></div>
</div>

<h2>Why the QGP is a "perfect liquid"</h2>
<p>The expectation was a gas of free quarks; the discovery (at RHIC, confirmed and refined at the
LHC) was that QGP flows as a <em>nearly perfect fluid</em> — the smallest ratio of shear viscosity
to entropy density η/s ever observed, close to the conjectured quantum bound 1/4π from string
theory (AdS/CFT). The evidence is <strong>elliptic flow</strong>: in off-centre collisions the
overlap zone is almond-shaped; pressure gradients convert this spatial anisotropy into momentum
anisotropy, measured as a cos 2(φ−Ψ) modulation with coefficient <strong>v₂</strong>. The
simulator's ALICE events include this modulation — look for the preferred emission plane in
mid-central collisions.</p>

<h2>Other key signatures you can discuss in an interview</h2>
<ul>
<li><strong>Jet quenching</strong>: a parton crossing the QGP loses energy — back-to-back jets come
out lopsided (one jet "eaten" by the medium).</li>
<li><strong>J/ψ suppression & regeneration</strong>: the plasma screens the c–c̄ binding
(Debye screening), melting charmonium states in a temperature-ordered sequence — a QGP
thermometer.</li>
<li><strong>Strangeness enhancement</strong>: thermal gluons readily make s–s̄ pairs, boosting
strange-baryon yields — seen even in the highest-multiplicity <em>pp</em> collisions, one of
ALICE's most surprising results.</li>
</ul>

<h2>The detector: built for 10,000 tracks, not for rate</h2>
<p>ALICE's problem is the opposite of ATLAS/CMS: not billions of sparse events per second, but a
few thousand <em>enormously dense</em> events. Hence:</p>
<ul>
<li><strong>The TPC</strong> — an 88 m³ gas-filled Time Projection Chamber, the largest ever:
electrons from ionised gas drift up to 2.5 m to the endplates, giving full 3D imaging of every
track plus particle ID via energy loss dE/dx (the Bethe–Bloch curve made visible).</li>
<li><strong>ITS2</strong> — 12.5 billion monolithic silicon pixels (MAPS), the largest pixel camera
ever built, with the innermost layer just 23 mm from the beam.</li>
<li><strong>A gentle 0.5 T field</strong> (the reused L3 magnet from LEP) — low, so that very soft
particles (p<sub>T</sub> ~ 100 MeV) still reach the TPC instead of spiralling forever.</li>
<li><strong>Time-of-Flight</strong> at 56 ps resolution — combined with dE/dx, ALICE identifies
π/K/p one by one over a huge momentum range: no other LHC experiment can.</li>
</ul>

<div class="info-box">In the simulator: choose ALICE and a Pb–Pb central trigger — the display
switches to heavy-ion mode with ~1,000 reconstructed tracks in the TPC acceptance. Then compare
a peripheral collision, and find the elliptic-flow asymmetry in the mid-central one.</div>
`},

  // =========================================================================
  { group: 'The Experiments', key: 'lhcb', title: 'LHCb', nav: 'LHCb · IP8',
    subtitle: 'LHC BEAUTY · FORWARD SPECTROMETER · CP VIOLATION & RARE DECAYS',
    html: `
<p><strong>LHCb</strong> looks nothing like the others: not a barrel, but a <strong>one-armed
forward spectrometer</strong> stretching 20 m along the beam line, covering only a cone of
10–300 mrad (pseudorapidity 2 < η < 5) on one side of the collision. The reason: at LHC
energies, b-quark pairs are produced overwhelmingly at small angles — the same gluon-gluon
fusion kinematics that make them, throw them forward. One modest-size arm catches roughly a
quarter of all b-hadrons.</p>

<div class="stat-grid">
  <div class="stat-box"><span class="v">2 < η < 5</span><span class="k">acceptance</span></div>
  <div class="stat-box"><span class="v">5.1 mm</span><span class="k">VELO distance to beam</span></div>
  <div class="stat-box"><span class="v">~10¹²</span><span class="k">b-quark pairs per year</span></div>
  <div class="stat-box"><span class="v">4 T·m</span><span class="k">dipole bending power</span></div>
</div>

<h2>Why beauty? The matter–antimatter mystery</h2>
<p>The universe is made of matter, yet the Big Bang should have produced matter and antimatter in
equal amounts. A necessary ingredient for the asymmetry is <strong>CP violation</strong> — a
difference in behaviour between particles and their antiparticles. The Standard Model contains
some CP violation (the CKM phase, Nobel 2008 for Kobayashi & Maskawa), and B mesons are where it
shows up most richly: neutral B's <em>oscillate</em> between particle and antiparticle before
decaying (B_s does so 3 trillion times per second!), and interference between oscillation and decay
makes CP asymmetries measurable. But the known CP violation is ~10⁹ times too small to explain the
universe — <em>something else is out there</em>, and LHCb's precision measurements are how we
triangulate it.</p>

<h2>The signature move: the displaced vertex</h2>
<p>A B meson at LHCb typically flies <strong>~1 cm</strong> before decaying (cτ ≈ 0.5 mm, boosted
by γ ≈ 20). The <strong>VELO</strong> — silicon pixel modules sitting just 5.1 mm from the beam,
<em>inside the accelerator vacuum</em>, retracted during injection and closed around the beam once
stable — resolves this flight path directly. A vertex displaced by millimetres from the collision
point is an almost background-free signature of heavy-flavour decay. The simulator's LHCb display
zooms into exactly this: watch the B fly before its decay products appear.</p>

<h2>Precision instruments along the arm</h2>
<ul>
<li><strong>Two RICH detectors</strong> — Ring-Imaging Cherenkov counters measure the Cherenkov
cone angle (cos θ<sub>c</sub> = 1/nβ) to distinguish π from K from p across 2–100 GeV. Essential:
B → ππ, B → Kπ and B → KK look identical without hadron ID.</li>
<li><strong>The dipole magnet</strong> (4 T·m, warm) — bends tracks horizontally; its polarity is
reversed every few weeks so that left–right detector asymmetries cancel in CP measurements. A
lovely example of controlling systematics by design.</li>
<li><strong>SciFi tracker</strong> — 11,000 km of scintillating fibre readout by SiPMs.</li>
<li><strong>Real-time analysis</strong> — since 2022 LHCb reads out the full detector at 30 MHz
with <em>no hardware trigger</em>: a GPU farm (Allen) reconstructs every event in real time.</li>
</ul>

<h2>Results a student should know</h2>
<ul>
<li><strong>B_s⁰ → μ⁺μ⁻</strong> observed at BR ≈ 3×10⁻⁹ — one of the rarest processes ever
measured, agreeing with the SM and killing large classes of supersymmetric models.</li>
<li><strong>Pentaquarks and tetraquarks</strong> — LHCb has discovered dozens of exotic hadrons,
reopening hadron spectroscopy.</li>
<li><strong>CP violation in charm</strong> (2019) — first observation, at the 10⁻³ level.</li>
<li>The long-running <strong>lepton-flavour-universality</strong> saga (R<sub>K</sub>): hints that
B decays might prefer muons over electrons faded with more data — a healthy lesson in statistics
and scientific self-correction.</li>
</ul>

<div class="info-box">In the simulator: LHCb's event display is drawn side-on (the spectrometer
view) instead of end-on. Select the B → J/ψ K trigger and look for the secondary vertex a few mm
from the collision point — the measured flight distance is printed in the event data panel.</div>
`},

  // =========================================================================
  { group: 'Beyond', key: 'career', title: 'Working at CERN', nav: 'Working at CERN',
    subtitle: 'PATHS INTO THE LAB FOR A PHYSICS STUDENT',
    html: `
<p>You are a physics undergraduate who might want to end up in that control room. Here is the
honest map of how people actually get there.</p>

<h2>The two populations</h2>
<p><strong>CERN staff</strong> (~2,700) are mostly accelerator physicists, engineers, technicians
and computing experts who run the <em>machines</em>. <strong>Users</strong> (~12,000) are the
experimental physicists, who belong to universities and institutes worldwide and come to CERN
through their collaboration (ATLAS, CMS, ALICE, LHCb, and dozens of smaller experiments). Most
particle physicists are users: the standard path is a PhD with a university group that is a member
of a collaboration.</p>

<h2>Programmes with your name on them</h2>
<table>
<tr><th>Programme</th><th>When</th><th>What</th></tr>
<tr><td><strong>Summer Student</strong></td><td>Bachelor/Master, ≥3 years completed</td><td>8–13 weeks, a real project in a real team, famous lecture series. The classic entry point — applications close in January.</td></tr>
<tr><td><strong>Technical Student</strong></td><td>During Bachelor/Master</td><td>6–12 months on applied physics/engineering/computing.</td></tr>
<tr><td><strong>Doctoral Student</strong></td><td>PhD phase</td><td>Do your thesis research based at CERN, paid by CERN.</td></tr>
<tr><td><strong>Fellowship</strong></td><td>After PhD (or MSc for engineers)</td><td>2–3 year early-career research posts.</td></tr>
</table>

<h2>What skills actually matter</h2>
<ul>
<li><strong>Programming is non-negotiable.</strong> Analysis is Python (+ ROOT, increasingly
scikit-hep/awkward); frameworks and reconstruction are C++. Machine learning is everywhere —
triggers, b-tagging, calibration.</li>
<li><strong>Statistics</strong> — likelihoods, hypothesis testing, look-elsewhere effect, the
meaning of "5σ". Discoveries are statistics; learn it properly.</li>
<li><strong>The physics core</strong>: quantum field theory eventually, but first master special
relativity kinematics (four-vectors — the ones this simulator computes), electrodynamics, and
statistical mechanics.</li>
<li><strong>Hardware literacy</strong> — people who can take a shift, debug a detector, or design
electronics are chronically in demand. Instrumentation is a career superpower.</li>
</ul>

<h2>What "5σ" means — the discovery threshold</h2>
<div class="eq">p ≈ 2.9 × 10⁻⁷ &nbsp;—&nbsp; the chance of background alone fluctuating this far</div>
<p>Particle physics demands 5 standard deviations before claiming discovery, largely because of
the <em>look-elsewhere effect</em>: search a thousand mass bins and 3σ bumps appear for free. In
the Analysis view of this simulator, record small datasets and watch fake bumps come and go in the
γγ spectrum; then record a large one and see the real 125 GeV peak stabilise. That intuition — how
statistics create and destroy "signals" — is worth more than any single formula.</p>

<div class="info-box gold">Last practical tip: the LHC experiments publish real open data
(opendata.cern.ch) with analysis tutorials. A university project reproducing the Higgs → 4ℓ
peak from CMS open data is an outstanding line on a summer-student application — and it's the
real-world version of what this simulator's Analysis tab does.</div>
`},
];
