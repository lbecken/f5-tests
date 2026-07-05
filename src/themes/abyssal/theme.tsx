import type { ReactNode } from 'react'
import type { ThemeManifest } from '../../engine/types'
import coverUrl from '../../assets/art/abyssal-cover.svg'
import introVoice from '../../assets/voice/abyssal-intro.mp3'
import winVoice from '../../assets/voice/abyssal-win.mp3'
import {
  MorsePanel, CipherPanel, SymbolCounter, MirrorPanel, LogicGridPanel,
  LensPanel, ConstellationPanel, DialGauge,
} from '../../engine/puzzles'
import { LockIcon } from '../../engine/icons'

function CoverArt() {
  return <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
}

function BoxClue() {
  return <p>Stenciled inside the lid, half worn away: "MERIDIAN NEVER SLEEPS. NEITHER SHOULD YOU."</p>
}

function KeycardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="#4fd1c5" strokeWidth="1.6" />
      <circle cx="8" cy="12" r="2" stroke="#4fd1c5" strokeWidth="1.4" />
      <line x1="13" y1="10" x2="18" y2="10" stroke="#4fd1c5" strokeWidth="1.4" />
      <line x1="13" y1="14" x2="18" y2="14" stroke="#4fd1c5" strokeWidth="1.4" />
    </svg>
  )
}
function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <path d="M14 4a5 5 0 00-6.9 5.9L3 14l3 3 4.1-4.1A5 5 0 0016 7l-3 3-2-2z" stroke="#4fd1c5" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
function HeadlampIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <circle cx="12" cy="12" r="6" stroke="#4fd1c5" strokeWidth="1.6" />
      <path d="M2 12h4M18 12h4" stroke="#4fd1c5" strokeWidth="1.6" />
    </svg>
  )
}

const KEYPAD_CIPHER: Record<string, string> = { A: '2', B: '2', C: '2', D: '3', E: '3', F: '3', G: '4', H: '4', I: '4', J: '5', K: '5', L: '5', M: '6', N: '6', O: '6', P: '7', Q: '7', R: '7', S: '7', T: '8', U: '8', V: '8', W: '9', X: '9', Y: '9', Z: '9' }

function Page({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

export const abyssalTheme: ThemeManifest = {
  id: 'abyssal',
  title: 'Abyssal Station 7',
  tagline: 'Four kilometres down, something sealed every door but yours.',
  synopsis:
    'You wake from cryo-sleep to a dead station and a very much awake AI. Repair the airlock protocol and get out before Station 7 finishes whatever it started without you.',
  difficulty: 3.5,
  palette: { primary: '#1f4f5f', secondary: '#0b1c22', accent: '#4fd1c5', bg: '#04090b', paper: '#dbeff0', ink: '#08262b' },
  coverArt: CoverArt,
  boxClue: BoxClue,

  intro: [
    {
      id: 'intro-1', order: 0, narrationUrl: introVoice, title: 'Cryo-Wake', body: () => (
        <Page>
          <p>Pressure: nominal. Depth: 4,120 meters. Cryo-wake successful — technician designation only, no name given.</p>
          <p>The station's voice, MERIDIAN, greets you before your eyes fully focus: "Emergency wake protocol engaged. All egress sealed pending diagnostic. Please remain calm." Every door reads the same word: SEALED.</p>
        </Page>
      ),
    },
    {
      id: 'intro-2', order: 1, title: 'Station Protocol', body: () => (
        <Page>
          <p>Every system on Station 7 confirms itself the same way: solve the diagnostic, derive a code or word, and log it at the terminal (the Answer Deck). Wrong codes sometimes return their own log pages. MERIDIAN files everything.</p>
          <p>Symbol diagnostics route through the airlock's manual override dial — three concentric rings. Its housing has a reverse side; station engineering never etched anything without cause. Three tiers of troubleshooting notes are filed under each system's icon.</p>
        </Page>
      ),
    },
  ],

  storyPages: {
    'log-found': {
      id: 'log-found', order: 2, title: 'The Last Log', body: () => (
        <Page>
          <p>The drawer holds a stack of personal logs, half-encrypted out of habit, and a laminated crew roster:</p>
          <p className="mono" style={{ fontSize: '0.9rem' }}>
            STATION 7 — ACTIVE ROSTER<br />
            T. OKAFOR — systems<br />
            K. REYES — lead researcher<br />
            M. SANTOS — medical<br />
            J. PIRET — geology
          </p>
          <p>One of them wrote the final entry. The signature is five digits of keypad cipher.</p>
        </Page>
      ),
    },
    'valves-found': { id: 'valves-found', order: 3, title: 'Manual Override', body: () => <Page><p>The reactor deck has a manual valve trio, hand-stamped with the same icons as the airlock dial — and a brass plate: "BLEED IN ORDER OF PRESSURE. HIGHEST FIRST, TO THE OUTER RING." Someone built this station expecting the AI to fail exactly like this.</p></Page> },
    'oxygen-found': { id: 'oxygen-found', order: 4, title: 'Recalculating', body: () => <Page><p>MERIDIAN's voice changes pitch slightly. "Oxygen reserves: recalculated. Recommend expedience." It sounds, almost, like it's rooting for you. The observation dome above the airlock has begun to clear of frost.</p></Page> },
  },

  winPage: {
    id: 'win', order: 99, narrationUrl: winVoice, title: 'Surface Protocol',
    body: () => (
      <Page>
        <p>The airlock cycles for the first time in longer than the station will admit. Cold Pacific water floods out; cold Pacific air rushes in.</p>
        <p>"Escape pod launch confirmed," MERIDIAN says, quieter than before. "For what it's worth — Dr. Reyes would have been proud. I certainly am." The pod breaks the surface into blinding daylight.</p>
      </Page>
    ),
  },

  startingRed: ['A'],
  finalRedCard: 'I',

  redCards: {
    A: {
      id: 'A', letter: 'A', title: 'First Light', symbol: 'wave', inputMode: 'text', difficulty: 1,
      solution: 'meridian',
      entryHint: 'Enter the decoded word.',
      component: () => <MorsePanel prompt="A comm buzzer under the console keeps repeating the same pattern. Press play and decode it." message="MERIDIAN" />,
    },
    B: {
      id: 'B', letter: 'B', title: 'The Signed Log', symbol: 'key', inputMode: 'text', difficulty: 2,
      solution: 'reyes',
      entryHint: 'Enter the surname that fits the cipher.',
      component: () => (
        <CipherPanel
          prompt="The final log entry ends with five digits — an old phone-keypad cipher, one digit per letter. Four crew members could have written it. The roster in your story booklet knows which surnames are even possible."
          cipherText="7 3 9 3 7"
          keyMap={KEYPAD_CIPHER}
        />
      ),
    },
    C: {
      id: 'C', letter: 'C', title: 'Warning Grid', symbol: 'eye', inputMode: 'text', difficulty: 2,
      solution: '11',
      entryHint: 'Enter the number of logged faults.',
      component: () => (
        <SymbolCounter
          prompt="The reactor status board is a wall of indicator lights. MERIDIAN wants a fault count before it will open the deck hatch."
          targetGlyph="🟠"
          cells={[
            '🟢','🟠','🟢',{ glyph: '🟠', blink: true },'🟠','🟢',
            '🟠','🟢','🟢','🟠','🟢','🟠',
            { glyph: '🟠', blink: true },'🟠','🟢','🟢','🟠','🟢',
            '🟠','🟢',{ glyph: '🟠', blink: true },'🟠','🟢','🟠',
            '🟢','🟢','🟠',{ glyph: '🟠', blink: true },'🟢','🟢',
          ]}
          fine={'Maintenance standing order, taped to the board: "LOG STEADY FAULTS ONLY. A FLICKERING LIGHT IS A DYING BULB, NOT A FAULT."'}
        />
      ),
    },
    D: {
      id: 'D', letter: 'D', title: 'Manual Valve Trio', symbol: 'gear', inputMode: 'decoder', difficulty: 2,
      solution: '105',
      entryHint: 'Bleed order = ring order. Read the gauges, then the dial windows.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            Three manual valves, each stamped with an icon and wearing a pressure gauge.
            The brass plate is adamant: <em>"BLEED IN ORDER OF PRESSURE. HIGHEST FIRST, TO THE
            OUTER RING; LOWEST LAST, TO THE HEART."</em>
          </p>
          <div className="gauge-row">
            <div style={{ textAlign: 'center' }}>
              <LockIcon symbol="key" size={26} />
              <DialGauge label="valve · key" value={45} max={100} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <LockIcon symbol="wave" size={26} />
              <DialGauge label="valve · wave" value={10} max={100} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <LockIcon symbol="gear" size={26} />
              <DialGauge label="valve · gear" value={80} max={100} />
            </div>
          </div>
        </div>
      ),
    },
    E: {
      id: 'E', letter: 'E', title: 'Inverted HUD', symbol: 'compass', inputMode: 'text', difficulty: 1,
      solution: 'kaia',
      entryHint: 'Enter the first name signed on the frame.',
      component: () => <MirrorPanel prompt="A diagnostic camera feed is frozen, running mirrored — a known fault on the aft units. Something is signed across the bottom of the frame." mirroredText="KAIA · DR" />,
    },
    F: {
      id: 'F', letter: 'F', title: 'Crew Manifest', symbol: 'skull', inputMode: 'text', difficulty: 3,
      solution: 'four',
      entryHint: 'Enter the occupied cabin, spelled out as a word.',
      component: () => (
        <LogicGridPanel
          prompt="Four cabins. The manifest map shows one still drawing life support, but the sensor column is corrupted. The maintenance notes survive:"
          clues={[
            'The occupied cabin has an even number.',
            "Cabin Two's heater failed the day the frost came — nothing has drawn power there since.",
            'Exactly one cabin still draws life-support power.',
            'Cabin One evacuated its occupant on the final supply run.',
            'Cabin Three logged frost damage the same week as its neighbor Cabin Two.',
          ]}
          rows={['Cabin One', 'Cabin Two', 'Cabin Three', 'Cabin Four']}
          cols={['Evacuated', 'Frost', 'No Power', 'Occupied']}
        />
      ),
    },
    G: {
      id: 'G', letter: 'G', title: 'Pressure Ritual', symbol: 'clock', inputMode: 'text', difficulty: 2,
      solution: '55',
      entryHint: "Enter day six's predicted reading.",
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            Five days of pressure readings, one gauge per day. MERIDIAN refuses to stabilize
            the cycle until you predict day six. "The pattern is organic," it adds, unhelpfully.
          </p>
          <div className="gauge-row">
            <DialGauge label="day 1" value={5} max={60} ticks={6} size={92} />
            <DialGauge label="day 2" value={8} max={60} ticks={6} size={92} />
            <DialGauge label="day 3" value={13} max={60} ticks={6} size={92} />
            <DialGauge label="day 4" value={21} max={60} ticks={6} size={92} />
            <DialGauge label="day 5" value={34} max={60} ticks={6} size={92} />
          </div>
        </div>
      ),
    },
    H: {
      id: 'H', letter: 'H', title: 'Thermal Bloom', symbol: 'flame', inputMode: 'text', difficulty: 3,
      solution: 'oxygen',
      entryHint: 'Enter the six letters, hottest conduit first.',
      component: ({ inventory }) => (
        <LensPanel
          prompt="The deck schematic looks blank under normal light — its conduit labels were printed in thermochromic ink. Dr. Reyes's headlamp has a thermal mode, if you've found it."
          lensLabel="Switch the headlamp to thermal"
          tint="rgba(220, 60, 30, 0.18)"
          requiresItem={{ id: 'headlamp', hint: 'You need a thermal light source. Keep exploring — someone on this station owned one.' }}
          inventory={inventory}
          base={<p style={{ opacity: 0.6, fontStyle: 'italic' }}>…six unlabeled conduits cross the schematic…</p>}
          hidden={
            <div style={{ display: 'flex', gap: '1.3rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '1.35rem' }}>
              <span>G<small style={{ display: 'block', fontSize: '0.55rem' }}>52°</small></span>
              <span>O<small style={{ display: 'block', fontSize: '0.55rem' }}>84°</small></span>
              <span>N<small style={{ display: 'block', fontSize: '0.55rem' }}>20°</small></span>
              <span>Y<small style={{ display: 'block', fontSize: '0.55rem' }}>65°</small></span>
              <span>E<small style={{ display: 'block', fontSize: '0.55rem' }}>38°</small></span>
              <span>X<small style={{ display: 'block', fontSize: '0.55rem' }}>71°</small></span>
            </div>
          }
        />
      ),
    },
    I: {
      id: 'I', letter: 'I', title: 'The Observation Dome', symbol: 'star', inputMode: 'decoder', difficulty: 3,
      solution: '997',
      entryHint: 'The three brightest stars name the rings, brightest to faintest, outer to inner.',
      component: () => (
        <ConstellationPanel
          prompt="Above the airlock, the frost has cleared from the observation dome. Stars — real ones, the first you've seen in months. The airlock manual's final page reads: 'WHEN ALL ELSE FAILS: THE THREE BRIGHTEST GUIDE YOU HOME. BRIGHTEST TO THE OUTER RING.' Each bright star wears an engineer's icon, scratched into the dome glass beside it."
          stars={[
            { id: 'eye', x: 70, y: 60, size: 7, label: '◉ eye' },
            { id: 'compass', x: 210, y: 40, size: 5.2, label: '✧ compass' },
            { id: 'star', x: 150, y: 150, size: 4, label: '★ star' },
            { id: 'd1', x: 40, y: 160, size: 2.2, label: 'wave' },
            { id: 'd2', x: 260, y: 120, size: 2.6, label: 'skull' },
            { id: 'd3', x: 120, y: 100, size: 1.8, label: 'gear' },
            { id: 'd4', x: 250, y: 180, size: 1.4 },
            { id: 'd5', x: 30, y: 30, size: 1.6 },
          ]}
        />
      ),
    },
  },

  blueCards: {
    meridian: { id: 'meridian', outcome: 'advance', narrative: '"MERIDIAN" — the station answers to its own name, oddly pleased. A drawer under the console unlocks: encrypted personal logs and a laminated crew roster.', unlocksRed: ['B'], unlocksBooklet: ['log-found'] },
    reyes: { id: 'reyes', outcome: 'advance', narrative: 'REYES. 7-3-9-3-7 fits no other name on the roster. The log unlocks: a fault-count challenge on the reactor board, and coordinates for a maintenance hatch.', unlocksRed: ['C', 'D'] },
    '11': { id: '11', outcome: 'advance', narrative: 'Eleven steady faults — the flickering bulbs fooled nobody today. The reactor deck hatch releases. Inside: a security keycard and a frozen, mirrored camera feed.', unlocksRed: ['E'], grantsObjects: ['keycard'] },
    '105': { id: '105', outcome: 'advance', narrative: 'One-zero-five — highest pressure to the outer ring, exactly as the plate demanded. A locker beside the valves opens: a crew manifest tablet, a hand wrench, and pressure logs.', unlocksRed: ['F', 'G'], grantsObjects: ['wrench'], unlocksBooklet: ['valves-found'] },
    kaia: { id: 'kaia', outcome: 'advance', narrative: "KAIA. Dr. Reyes signed her own diagnostic frame. Her locker accepts the name — inside, her headlamp, thermal mode intact.", unlocksRed: ['H'], grantsObjects: ['headlamp'] },
    four: { id: 'four', outcome: 'advance', narrative: 'Cabin Four — the only even cabin still drawing power. Whatever is in there, it isn\'t your problem tonight. The pressure ritual unlocks.', unlocksRed: ['G'] },
    '55': { id: '55', outcome: 'advance', narrative: 'Fifty-five. "Organic," MERIDIAN repeats, satisfied — each day the sum of the two before. The thermal schematic prints itself from the nearest terminal.', unlocksRed: ['H'] },
    oxygen: { id: 'oxygen', outcome: 'advance', narrative: 'OXYGEN — read from the hottest conduit down to the coldest. MERIDIAN recalculates your reserves out loud, and for the first time sounds almost relieved. Above the airlock, the dome frost is clearing.', unlocksRed: ['I'], unlocksBooklet: ['oxygen-found'] },
    '997': { id: '997', outcome: 'win', narrative: 'Nine-nine-seven. The three brightest stars, brightest first. The airlock finally, finally cycles.' },
    piret: { id: 'piret', outcome: 'decoy', narrative: 'The terminal blinks: "J. PIRET — geology — no log entries this cycle." A five-letter name, yes. But run his letters through the keypad: 7-4-7-3-8. The second digit betrays you.' },
    '15': { id: '15', outcome: 'decoy', narrative: 'MERIDIAN sighs — an odd sound from a station AI. "Fifteen includes four dying bulbs. Re-read the standing order taped to the board."' },
    '203': { id: '203', outcome: 'decoy', narrative: 'The valves shudder and re-seal. "Backwards," MERIDIAN notes. "The plate says HIGHEST first, technician."' },
    '404': { id: '404', outcome: 'decoy', narrative: 'MERIDIAN\'s voice flattens: "Resource not found." Somewhere, a very old joke lands on absolutely no one. Try again.' },
    '000': { id: '000', outcome: 'decoy', narrative: 'The terminal returns a null log — just a timestamp from before the station was even crewed. Not your answer.' },
  },

  greenCards: {
    wave: { id: 'wave', symbol: 'wave', hints: [
      'That buzzer pattern is Morse code, not random static.',
      'Press play and write down each short and long pulse as a dot or a dash — eight letters.',
      'The decoded word is MERIDIAN.',
    ] },
    key: { id: 'key', symbol: 'key', hints: [
      'Five digits, five letters — and only four possible authors. The roster is in your story booklet.',
      'OKAFOR and SANTOS are the wrong length. Between REYES and PIRET, check each letter against the keypad: only one fits 7-3-9-3-7.',
      'R=7, E=3, Y=9, E=3, S=7 — the answer is REYES.',
    ] },
    eye: { id: 'eye', symbol: 'eye', hints: [
      'Not every amber light is a fault. Read the note taped to the board.',
      'Blinking lights are dying bulbs, not faults — count only the steady amber lights.',
      'There are 11 steady amber lights.',
    ] },
    gear: { id: 'gear', symbol: 'gear', hints: [
      'The plate ties bleed order to ring order — and the gauges tell you the bleed order.',
      'Gear reads 80, key 45, wave 10. Highest to the outer ring: gear outer, key middle, wave inner.',
      'Set outer=gear, middle=key, inner=wave. The windows read 105.',
    ] },
    compass: { id: 'compass', symbol: 'compass', hints: [
      'The camera feed is mirrored — a hardware fault, not a cipher.',
      'Flip the lens. The frame reads "DR · KAIA" — the plaque wants the first name only.',
      'The answer is KAIA.',
    ] },
    skull: { id: 'skull', symbol: 'skull', hints: [
      'Start with the parity clue — it halves the field immediately.',
      'The occupied cabin is even: Two or Four. Cabin Two has drawn no power since the frost, and the occupied cabin still draws power.',
      'The answer is FOUR.',
    ] },
    clock: { id: 'clock', symbol: 'clock', hints: [
      'Read each needle carefully first — the values matter more than the pictures.',
      'The readings run 5, 8, 13, 21, 34 — each day is the sum of the two before ("organic," as MERIDIAN says).',
      'Day six reads 21 + 34 = 55.',
    ] },
    flame: { id: 'flame', symbol: 'flame', hints: [
      "The schematic isn't blank — its ink responds to heat. Dr. Reyes owned something that can see heat.",
      'With the headlamp in thermal mode, six letters appear with temperatures. Read hottest to coldest, not left to right.',
      '84°, 71°, 65°, 52°, 38°, 20° spell O-X-Y-G-E-N.',
    ] },
    star: { id: 'star', symbol: 'star', hints: [
      'The manual cares about brightness, and each bright star wears an icon from the dial.',
      'Trace the three visibly largest stars, largest first: the eye, then the compass, then the star. That is your ring order, outer to inner.',
      'Set outer=eye, middle=compass, inner=star. The windows read 997.',
    ] },
  },

  objects: {
    keycard: { id: 'keycard', name: 'Reactor Keycard', description: "A worn keycard from the reactor deck hatch. Still warm, somehow.", icon: KeycardIcon },
    wrench: { id: 'wrench', name: 'Hand Wrench', description: 'A well-used maintenance wrench. Station-issue, station-worn.', icon: WrenchIcon },
    headlamp: { id: 'headlamp', name: "Reyes's Headlamp", description: "Dr. Reyes's headlamp. The selector has two positions: VISIBLE and THERMAL. It smells faintly of ozone.", icon: HeadlampIcon },
  },

  decoder: {
    rings: [
      { segments: [
        { symbol: 'wave', digit: 2 }, { symbol: 'key', digit: 5 }, { symbol: 'eye', digit: 9 }, { symbol: 'skull', digit: 0 },
        { symbol: 'clock', digit: 6 }, { symbol: 'compass', digit: 3 }, { symbol: 'star', digit: 8 }, { symbol: 'gear', digit: 1 },
      ] },
      { segments: [
        { symbol: 'wave', digit: 7 }, { symbol: 'key', digit: 0 }, { symbol: 'eye', digit: 4 }, { symbol: 'skull', digit: 8 },
        { symbol: 'clock', digit: 2 }, { symbol: 'compass', digit: 9 }, { symbol: 'star', digit: 1 }, { symbol: 'gear', digit: 5 },
      ] },
      { segments: [
        { symbol: 'wave', digit: 5 }, { symbol: 'key', digit: 8 }, { symbol: 'eye', digit: 1 }, { symbol: 'skull', digit: 6 },
        { symbol: 'clock', digit: 0 }, { symbol: 'compass', digit: 4 }, { symbol: 'star', digit: 7 }, { symbol: 'gear', digit: 3 },
      ] },
    ],
    backClue: () => (
      <div>
        <h3 className="display-font">Etched into the dial's housing</h3>
        <p>"Pressure decides the order of things down here. When it doesn't, look up: the bright ones will."</p>
        <p style={{ opacity: 0.7, fontStyle: 'italic' }}>— station engineering, pre-launch</p>
      </div>
    ),
  },

  music: { baseFreq: 82, scale: [0, 2, 3, 7, 8, 12], waveform: 'sine', tempoMs: 3400, filterFreq: 500, mood: 'cold' },
}
