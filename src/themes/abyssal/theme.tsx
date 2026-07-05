import type { ReactNode } from 'react'
import type { ThemeManifest } from '../../engine/types'
import { MorsePanel, CipherPanel, SymbolCounter, MirrorPanel, LogicGridPanel, SequencePanel, OverlayPanel } from '../../engine/puzzles'

function CoverArt() {
  return (
    <svg viewBox="0 0 200 160" width="100%" height="100%">
      <circle cx="100" cy="80" r="50" fill="none" stroke="#4fd1c5" strokeWidth="3" />
      <path d="M60 90c10-20 30-30 40-30s30 10 40 30" fill="none" stroke="#4fd1c5" strokeWidth="2" opacity="0.6" />
      <circle cx="100" cy="80" r="10" fill="#4fd1c5" opacity="0.5" />
      {Array.from({ length: 6 }).map((_, i) => (
        <circle key={i} cx={30 + i * 28} cy={140} r="2.4" fill="#4fd1c5" opacity="0.5" />
      ))}
    </svg>
  )
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
  palette: { primary: '#1f4f5f', secondary: '#0b1c22', accent: '#4fd1c5', bg: '#04090b', paper: '#dbeff0', ink: '#08262b' },
  coverArt: CoverArt,
  boxClue: BoxClue,

  intro: [
    {
      id: 'intro-1', order: 0, title: 'Cryo-Wake', body: () => (
        <Page>
          <p>Pressure: nominal. Depth: 4,120 meters. Cryo-wake successful — technician designation only, no name given.</p>
          <p>The station's voice, MERIDIAN, greets you before your eyes fully focus: "Emergency wake protocol engaged. All egress sealed pending diagnostic. Please remain calm." Every door reads the same word: SEALED.</p>
        </Page>
      ),
    },
    {
      id: 'intro-2', order: 1, title: 'Station Protocol', body: () => (
        <Page>
          <p>Every system on Station 7 confirms itself the same way: solve the diagnostic, derive a code or word, and log it. The station's terminal (the Answer Deck) will confirm it and unlock whatever comes next.</p>
          <p>Some diagnostics resolve to raw symbols rather than numbers — for those, the airlock's manual override dial (three concentric rings) translates symbol to digit. Three tiers of MERIDIAN's own troubleshooting notes (Hint Cards) are filed under each system's icon, if you need them.</p>
        </Page>
      ),
    },
  ],

  storyPages: {
    'log-found': { id: 'log-found', order: 2, title: 'The Last Log', body: () => <Page><p>Dr. Kaia Reyes, lead researcher. Her final log, half-encrypted out of habit, mentions a containment breach she calls "routine" three separate times.</p></Page> },
    'valves-found': { id: 'valves-found', order: 3, title: 'Manual Override', body: () => <Page><p>The reactor deck has a manual valve trio, hand-stamped with the same icons as the airlock dial. Someone built this station expecting the AI to fail exactly like this.</p></Page> },
    'oxygen-found': { id: 'oxygen-found', order: 4, title: 'Recalculating', body: () => <Page><p>MERIDIAN's voice changes pitch slightly. "Oxygen reserves: recalculated. Recommend expedience." It sounds, almost, like it's rooting for you.</p></Page> },
  },

  winPage: {
    id: 'win', order: 99, title: 'Surface Protocol',
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
      id: 'A', letter: 'A', title: 'First Light', symbol: 'wave', inputMode: 'text',
      solution: 'meridian',
      entryHint: 'Enter the decoded word.',
      component: () => <MorsePanel prompt="A comm buzzer under the console keeps repeating the same pattern. Press play and decode it." message="MERIDIAN" />,
    },
    B: {
      id: 'B', letter: 'B', title: "Dr. Reyes's Log", symbol: 'key', inputMode: 'text',
      solution: 'reyes',
      entryHint: 'Enter the decoded name.',
      component: () => (
        <CipherPanel
          prompt="An old habit of Dr. Reyes's: she encrypted her personal logs with an old phone keypad cipher (A-C=2, D-F=3, …). The signature at the bottom of this entry:"
          cipherText="7 3 9 3 7"
          keyMap={KEYPAD_CIPHER}
        />
      ),
    },
    C: {
      id: 'C', letter: 'C', title: 'Warning Grid', symbol: 'eye', inputMode: 'text',
      solution: '11',
      entryHint: 'Enter the number of amber warning lights you counted.',
      component: () => (
        <SymbolCounter
          prompt="The reactor status board is a wall of small indicator lights — mostly steady green, but not all of them."
          targetGlyph="🟠"
          cells={['🟢','🟠','🟢','🟢','🟠','🟢','🟠','🟢','🟢','🟠','🟢','🟠','🟢','🟠','🟢','🟢','🟠','🟢','🟠','🟢','🟢','🟠','🟢','🟠','🟢','🟢','🟠','🟢','🟢','🟢']}
        />
      ),
    },
    D: {
      id: 'D', letter: 'D', title: 'Manual Valve Trio', symbol: 'gear', inputMode: 'decoder',
      solution: '105',
      entryHint: 'Set the decoder: outer ring to the gear, middle ring to the key, inner ring to the wave.',
      component: () => (
        <p className="puzzle-prompt">
          Three manual valves on the reactor deck are hand-stamped with a gear, a key, and a wave.
          Set the airlock override dial the same way — outer to gear, middle to key, inner to wave — and read the number.
        </p>
      ),
    },
    E: {
      id: 'E', letter: 'E', title: 'Inverted HUD', symbol: 'compass', inputMode: 'text',
      solution: 'kaia',
      entryHint: 'Enter the word once it reads correctly.',
      component: () => <MirrorPanel prompt="A diagnostic camera feed is running mirrored — a known fault on the aft units. A name is signed across the bottom of the frozen frame." mirroredText="KAIA" />,
    },
    F: {
      id: 'F', letter: 'F', title: 'Crew Manifest', symbol: 'skull', inputMode: 'text',
      solution: 'four',
      entryHint: 'Enter the occupied cabin number, spelled out as a word.',
      component: () => (
        <LogicGridPanel
          prompt="Four cabins, one still shows a heat signature on the manifest map. A maintenance note lists what's known:"
          clues={[
            'Cabin One reads cold — its occupant evacuated on the last supply run.',
            'Cabin Two and Cabin Three both show frost damage and no power.',
            'Exactly one cabin still draws life-support power.',
            'That cabin is not Cabin One, Two, or Three.',
          ]}
          rows={['Cabin One', 'Cabin Two', 'Cabin Three', 'Cabin Four']}
          cols={['Cold', 'Frost', 'No Power', 'Occupied']}
        />
      ),
    },
    G: {
      id: 'G', letter: 'G', title: 'Pressure Cycle', symbol: 'clock', inputMode: 'text',
      solution: '55',
      entryHint: 'Enter the missing number.',
      component: () => <SequencePanel prompt="A pressure gauge log, cycling in a familiar pattern:" items={['5', '8', '13', '21', '34', '?']} />,
    },
    H: {
      id: 'H', letter: 'H', title: 'Thermal Bloom', symbol: 'flame', inputMode: 'text',
      solution: 'oxygen',
      entryHint: 'Read the highlighted letters in order and enter the word.',
      component: () => (
        <OverlayPanel
          prompt="A thermal readout is layered over the deck schematic. Drag the warm-signature layer aside to read the lettered conduit labels underneath."
          base={
            <p style={{ fontSize: '0.85rem', lineHeight: 1.7, textAlign: 'left' }}>
              Deck schematic, conduits A through F, all nominal.{' '}
              <b style={{ color: '#c23b3b' }}>O</b>utflow valve{' '}
              <b style={{ color: '#c23b3b' }}>X</b>-braced against pressure,{' '}
              <b style={{ color: '#c23b3b' }}>Y</b>ield tested twice,{' '}
              <b style={{ color: '#c23b3b' }}>G</b>askets replaced last cycle,{' '}
              <b style={{ color: '#c23b3b' }}>E</b>mergency shutoff primed,{' '}
              <b style={{ color: '#c23b3b' }}>N</b>ozzle cleared of debris.
            </p>
          }
          overlay={<div style={{ background: 'rgba(79,209,197,0.35)', width: '100%', height: '100%', borderRadius: 8 }} />}
        />
      ),
    },
    I: {
      id: 'I', letter: 'I', title: 'Airlock Star Chart', symbol: 'star', inputMode: 'decoder',
      solution: '997',
      entryHint: 'Set the decoder: outer ring to the eye, middle ring to the compass, inner ring to the star.',
      component: () => (
        <p className="puzzle-prompt">
          The airlock's final override needs a scan-eye, a compass, and a star, outer to inner. Dial it in and read the code — this is the one that gets you out.
        </p>
      ),
    },
  },

  blueCards: {
    meridian: { id: 'meridian', outcome: 'advance', narrative: '"MERIDIAN" — the station answers to its own name, oddly pleased. A drawer under the console unlocks, holding a stack of encrypted logs.', unlocksRed: ['B'], unlocksBooklet: ['log-found'] },
    reyes: { id: 'reyes', outcome: 'advance', narrative: 'REYES. The log entry unlocks fully, revealing a warning-light diagnostic and a maintenance hatch on the reactor deck.', unlocksRed: ['C', 'D'] },
    '11': { id: '11', outcome: 'advance', narrative: 'Eleven. The reactor deck hatch releases, revealing a security camera feed frozen on a single mirrored frame.', unlocksRed: ['E'], grantsObjects: ['keycard'] },
    '105': { id: '105', outcome: 'advance', narrative: 'One-zero-five. A locker beside the valves opens: a crew manifest tablet and a hand tool.', unlocksRed: ['F', 'G'], grantsObjects: ['wrench'], unlocksBooklet: ['valves-found'] },
    kaia: { id: 'kaia', outcome: 'advance', narrative: "KAIA. Dr. Reyes's own first name. A thermal schematic prints itself from a nearby terminal.", unlocksRed: ['H'], grantsObjects: ['headlamp'] },
    four: { id: 'four', outcome: 'advance', narrative: 'Cabin Four. Still occupied, still drawing power — whatever that means, it isn\'t your problem tonight. The pressure log unlocks.', unlocksRed: ['G'] },
    '55': { id: '55', outcome: 'advance', narrative: 'Fifty-five. The pressure cycle stabilizes and the thermal overlay comes fully online.', unlocksRed: ['H'] },
    oxygen: { id: 'oxygen', outcome: 'advance', narrative: 'OXYGEN. MERIDIAN recalculates your reserves out loud, and for the first time sounds almost relieved. The airlock star chart illuminates.', unlocksRed: ['I'], unlocksBooklet: ['oxygen-found'] },
    '997': { id: '997', outcome: 'win', narrative: 'Nine-nine-seven. The airlock finally, finally cycles.' },
    '404': { id: '404', outcome: 'decoy', narrative: 'MERIDIAN\'s voice flattens: "Resource not found." Somewhere, a very old joke lands on absolutely no one. Try again.' },
    '000': { id: '000', outcome: 'decoy', narrative: 'The terminal returns a null log — just a timestamp from before the station was even crewed. Not your answer.' },
  },

  greenCards: {
    wave: { id: 'wave', symbol: 'wave', hints: [
      'That buzzer pattern is Morse code, not random static.',
      'Press play, then try writing down each short and long pulse as a dot or a dash.',
      'The decoded word is MERIDIAN.',
    ] },
    key: { id: 'key', symbol: 'key', hints: [
      'This is an old phone-keypad cipher — each digit maps to a small group of letters.',
      'The pattern narrows down fast once you realize it spells a common five-letter surname.',
      'The decoded name is REYES.',
    ] },
    eye: { id: 'eye', symbol: 'eye', hints: [
      'Two colors of light are mixed into that panel — count only one of them.',
      'Count only the amber lights, ignore every green one.',
      'There are 11 amber lights.',
    ] },
    gear: { id: 'gear', symbol: 'gear', hints: [
      'Three valves, three stamped icons — a gear, a key, a wave.',
      'Set the dial outer-to-inner in exactly that order: gear, key, wave.',
      'The revealed number is 105.',
    ] },
    compass: { id: 'compass', symbol: 'compass', hints: [
      'The camera feed is mirrored — a known hardware fault, not a puzzle in itself.',
      'Flip the lens to read the frozen frame the right way round.',
      'The word is KAIA.',
    ] },
    skull: { id: 'skull', symbol: 'skull', hints: [
      'Three of the four cabins are explicitly ruled out by the notes — work through them one at a time.',
      'Only Cabin Four is left once the other three are eliminated.',
      'The answer is FOUR.',
    ] },
    clock: { id: 'clock', symbol: 'clock', hints: [
      'Compare each number in the sequence to the two before it.',
      "It's a Fibonacci-style sequence: each term is the sum of the two before it.",
      'The missing number is 55.',
    ] },
    flame: { id: 'flame', symbol: 'flame', hints: [
      'Not every letter in that schematic is the same color.',
      'Read only the red-highlighted letters, left to right.',
      'They spell OXYGEN.',
    ] },
    star: { id: 'star', symbol: 'star', hints: [
      "This dial needs everything you've learned about this station's eyes, compasses and stars.",
      'Set outer to the scan-eye, middle to the compass, inner to the star.',
      'The final number is 997.',
    ] },
  },

  objects: {
    keycard: { id: 'keycard', name: 'Reactor Keycard', description: "A worn keycard from the reactor deck hatch. Still warm, somehow.", icon: KeycardIcon },
    wrench: { id: 'wrench', name: 'Hand Wrench', description: 'A well-used maintenance wrench. Station-issue, station-worn.', icon: WrenchIcon },
    headlamp: { id: 'headlamp', name: 'Headlamp', description: "Dr. Reyes's headlamp, still functional. It smells faintly of ozone.", icon: HeadlampIcon },
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
        <p>"Three rings, three failsafes. Trust the eye, then the compass, then the star." — station engineering, pre-launch</p>
      </div>
    ),
  },

  music: { baseFreq: 82, scale: [0, 2, 3, 7, 8, 12], waveform: 'sine', tempoMs: 3400, filterFreq: 500, mood: 'cold' },
}
