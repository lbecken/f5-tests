import type { ReactNode } from 'react'
import type { ThemeManifest } from '../../engine/types'
import { CipherPanel, SymbolCounter, SequencePanel, MirrorPanel, LogicGridPanel, MorsePanel, OverlayPanel } from '../../engine/puzzles'

function CoverArt() {
  return (
    <svg viewBox="0 0 200 160" width="100%" height="100%">
      <circle cx="100" cy="80" r="55" fill="none" stroke="#c9a24b" strokeWidth="3" />
      <circle cx="100" cy="80" r="6" fill="#c9a24b" />
      <line x1="100" y1="80" x2="100" y2="42" stroke="#c9a24b" strokeWidth="3" strokeLinecap="round" />
      <line x1="100" y1="80" x2="126" y2="92" stroke="#c9a24b" strokeWidth="3" strokeLinecap="round" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2
        const x1 = 100 + Math.cos(a) * 48, y1 = 80 + Math.sin(a) * 48
        const x2 = 100 + Math.cos(a) * 54, y2 = 80 + Math.sin(a) * 54
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c9a24b" strokeWidth="2" />
      })}
      <circle cx="40" cy="130" r="16" fill="none" stroke="#8a6d3b" strokeWidth="2" />
      <circle cx="160" cy="30" r="12" fill="none" stroke="#8a6d3b" strokeWidth="2" />
    </svg>
  )
}

function BoxClue() {
  return <p>"Tick tock — the hour on my clocks is never what it seems. Trust the count, not the face." <br />— a brass plate riveted under the box lid</p>
}

function KeyObjectIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <circle cx="8" cy="8" r="4.5" stroke="#c9a24b" strokeWidth="1.6" />
      <path d="M11 11l9 9M17 17l3-3M14 14l3-3" stroke="#c9a24b" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
function MirrorObjectIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <ellipse cx="12" cy="10" rx="7" ry="9" stroke="#c9a24b" strokeWidth="1.6" />
      <line x1="12" y1="19" x2="12" y2="23" stroke="#c9a24b" strokeWidth="1.6" />
    </svg>
  )
}
function OilCanIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <path d="M5 12a4 4 0 018 0v7H5z" stroke="#c9a24b" strokeWidth="1.6" />
      <path d="M13 12l7-5" stroke="#c9a24b" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

const CAESAR_TABLE: Record<string, string> = {}
for (let i = 0; i < 26; i++) {
  const plain = String.fromCharCode(65 + i)
  const cipher = String.fromCharCode(65 + ((i + 3) % 26))
  CAESAR_TABLE[plain] = cipher
}

function Page({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

export const clockmakerTheme: ThemeManifest = {
  id: 'clockmaker',
  title: "The Clockmaker's Last Wind",
  tagline: 'A workshop, a vanished master, a hundred years of silence.',
  synopsis:
    'Locked in after hours to witness a legendary automaton rewind for the first time in a century, you must out-think a dead man\'s workshop before the last gear stops turning.',
  palette: { primary: '#6b4226', secondary: '#2b2118', accent: '#c9a24b', bg: '#14100c', paper: '#ece0c4', ink: '#201509' },
  coverArt: CoverArt,
  boxClue: BoxClue,

  intro: [
    {
      id: 'intro-1', order: 0, title: 'An Invitation After Hours',
      body: () => (
        <Page>
          <p>You are apprenticed to Master Aurelius Voss, the finest horologist the city has known in two generations. Tonight he asked you to stay after closing — the Sentinel, his masterwork automaton, was due its first rewinding in a hundred years, and he wanted a witness.</p>
          <p>At the stroke of midnight, the workshop's brass door sealed itself with a click you had never heard before. Master Voss was nowhere to be found. Only a note, pinned to his workbench with a spare cog, waited in his place.</p>
        </Page>
      ),
    },
    {
      id: 'intro-2', order: 1, title: 'How This Workshop Works',
      body: () => (
        <Page>
          <p>Every puzzle you solve here resolves to a word or number. Whatever you derive, you'll enter it beside the puzzle card — the workshop's logbook (the Answer Deck) will tell you whether you're right, and if so, which drawer or cabinet to search next.</p>
          <p>Some puzzles instead give you symbols. For those, turn the workshop's decoder — three brass rings, each stamped with symbols — until the ones you've been shown line up, and read off the number that appears.</p>
          <p>If you're ever stuck, three tiers of Master Voss's own marginalia (Hint Cards) are filed by the same symbol as your puzzle. Draw them one at a time.</p>
        </Page>
      ),
    },
  ],

  storyPages: {
    'note-found': {
      id: 'note-found', order: 2, title: 'The Note, Decoded',
      body: () => <Page><p>"Find the pendulum," it read, in the shift-cipher he taught you last spring. Beneath the words, a small brass key had been taped to the paper.</p></Page>,
    },
    'triptych-found': {
      id: 'triptych-found', order: 3, title: 'Three Stamps',
      body: () => <Page><p>Stamped into the Sentinel's chest plate are three tiny marks — a cog, a key, a lamp flame — worn smooth by a century of winding. The decoder's rings seem built for exactly these.</p></Page>,
    },
    'final-approach': {
      id: 'final-approach', order: 4, title: 'One Gear Left',
      body: () => <Page><p>The ledger's ink is nearly dry. Whatever Master Voss intended, it ends at the Sentinel itself — and the last gear it's still waiting for.</p></Page>,
    },
  },

  winPage: {
    id: 'win', order: 99, title: 'The Last Wind',
    body: () => (
      <Page>
        <p>The final gear clicks into place. Somewhere deep in its chest, the Sentinel's heart begins, impossibly, to tick.</p>
        <p>The brass door sighs open on its own. On the threshold stands Master Voss, pocket watch in hand, smiling like a man who has been timing you the entire evening. "Not bad," he says. "Not bad at all."</p>
      </Page>
    ),
  },

  startingRed: ['A'],
  finalRedCard: 'I',

  redCards: {
    A: {
      id: 'A', letter: 'A', title: "The Apprentice's Note", symbol: 'gear', inputMode: 'text',
      solution: 'pendulum',
      entryHint: 'Enter the decoded word.',
      component: () => (
        <CipherPanel
          prompt="Master Voss's private shift-cipher, taught to you last spring. Shift every letter back by three."
          cipherText="SHQGXOXP"
          keyMap={CAESAR_TABLE}
        />
      ),
    },
    B: {
      id: 'B', letter: 'B', title: 'Shelf of Curiosities', symbol: 'key', inputMode: 'text',
      solution: '13',
      entryHint: 'Enter how many keys are in the workshop tonight.',
      component: () => (
        <SymbolCounter
          prompt="The cabinet drawer is a clutter of loose gears — but not everything in it is a gear. A margin note in Master Voss's hand asks: 'How many keys in the workshop tonight?'"
          targetGlyph="🔑"
          cells={['⚙️','⚙️','🔑','⚙️','⚙️','🔑','⚙️','⚙️','⚙️','🔑','⚙️','🔑','⚙️','🔑','⚙️','⚙️','🔑','⚙️','🔑','⚙️','🔑','⚙️','⚙️','🔑','⚙️','🔑','⚙️','🔑','⚙️','🔑']}
        />
      ),
    },
    C: {
      id: 'C', letter: 'C', title: "The Grandfather's Riddle", symbol: 'clock', inputMode: 'text',
      solution: '64',
      entryHint: 'Enter the missing number.',
      component: () => <SequencePanel prompt="Carved into the grandfather clock's base, a sequence of gear-teeth counts:" items={['4', '8', '16', '32', '?']} />,
    },
    D: {
      id: 'D', letter: 'D', title: 'Triptych of Symbols', symbol: 'compass', inputMode: 'decoder',
      solution: '319',
      entryHint: "Set the decoder: outer ring to the gear, middle ring to the key, inner ring to the flame.",
      component: () => (
        <p className="puzzle-prompt">
          Stamped into the Sentinel's chest plate are three worn marks: a cog, a key, and a lamp flame.
          Turn the workshop's decoder so the outer ring shows the cog, the middle ring the key, and the inner ring the flame — then read the number it reveals.
        </p>
      ),
    },
    E: {
      id: 'E', letter: 'E', title: 'Mirror of Vanity', symbol: 'eye', inputMode: 'text',
      solution: 'aurelius',
      entryHint: 'Enter the word once it reads correctly.',
      component: () => <MirrorPanel prompt="A note tucked into the frame of the shaving mirror on the desk makes no sense at all — until you actually use the mirror." mirroredText="AURELIUS" />,
    },
    F: {
      id: 'F', letter: 'F', title: 'The Weighted Cogs', symbol: 'leaf', inputMode: 'text',
      solution: 'iron',
      entryHint: 'Enter the name of the heaviest cog.',
      component: () => (
        <LogicGridPanel
          prompt="Four cogs sit on the bench, each a different metal. A card beside them lists what you know:"
          clues={[
            'Silver is heavier than Copper, but lighter than Brass.',
            'Iron is the heaviest of all four.',
            'Brass is heavier than Silver, but not the heaviest.',
            'Copper is the lightest of all four.',
          ]}
          rows={['Copper', 'Silver', 'Brass', 'Iron']}
          cols={['Lightest', 'Light', 'Heavy', 'Heaviest']}
        />
      ),
    },
    G: {
      id: 'G', letter: 'G', title: 'Song of the Signal Lamp', symbol: 'flame', inputMode: 'text',
      solution: 'voss',
      entryHint: 'Enter the decoded word.',
      component: () => <MorsePanel prompt="An old signal lamp in the corner still has oil in it. Its trigger clicks like it wants to be pressed." message="VOSS" />,
    },
    H: {
      id: 'H', letter: 'H', title: 'The Feathered Ledger', symbol: 'feather', inputMode: 'text',
      solution: 'wound',
      entryHint: 'Read the highlighted letters in order and enter the word.',
      component: () => (
        <OverlayPanel
          prompt="The workshop ledger is dense with figures — but a handful of letters are inked in a different color entirely. Drag the loose sheet of wax paper aside and read them in order."
          base={
            <p style={{ fontSize: '0.85rem', lineHeight: 1.7, textAlign: 'left' }}>
              Deliveries this fortnight: 4 barrels oil, 2 crates brass stock.{' '}
              <b style={{ color: '#8a1f1f' }}>W</b>orkshop swept, benches{' '}
              <b style={{ color: '#8a1f1f' }}>O</b>iled and dust cleared. Sentinel joints{' '}
              <b style={{ color: '#8a1f1f' }}>U</b>nlatched for inspection, spring tension checked twice, chest plate re-set{' '}
              <b style={{ color: '#8a1f1f' }}>N</b>early flush, mainspring{' '}
              <b style={{ color: '#8a1f1f' }}>D</b>rawn taut and left ready.
            </p>
          }
          overlay={<div style={{ background: 'rgba(201,162,75,0.35)', width: '100%', height: '100%', borderRadius: 8 }} />}
        />
      ),
    },
    I: {
      id: 'I', letter: 'I', title: "The Sentinel's Final Gear", symbol: 'star', inputMode: 'decoder',
      solution: '726',
      entryHint: 'Set the decoder: outer ring to the moon, middle ring to the flame, inner ring to the star.',
      component: () => (
        <p className="puzzle-prompt">
          Beneath the chest plate, one last dial waits — engraved with a crescent moon, a lamp flame, and a star, in that order, outer to inner.
          Set the decoder to match and read the final number.
        </p>
      ),
    },
  },

  blueCards: {
    pendulum: { id: 'pendulum', outcome: 'advance', narrative: '"Find the pendulum," the note read once unshifted. Taped beneath the words: a small brass key.', unlocksRed: ['B'], grantsObjects: ['brass_key'], unlocksBooklet: ['note-found'] },
    '13': { id: '13', outcome: 'advance', narrative: 'Thirteen keys, thirteen drawers. The thirteenth drawer holds the grandfather clock\'s winding crank — and a folded diagram.', unlocksRed: ['C', 'D'] },
    '64': { id: '64', outcome: 'advance', narrative: 'Sixty-four. The clock face swings open on a hidden hinge, revealing a shaving mirror tucked behind it.', unlocksRed: ['E'], grantsObjects: ['shaving_mirror'] },
    '319': { id: '319', outcome: 'advance', narrative: 'Three-one-nine. A hidden compartment in the workbench opens, holding a weighing scale, four cogs, and a small can of oil.', unlocksRed: ['F', 'G'], grantsObjects: ['oil_can'], unlocksBooklet: ['triptych-found'] },
    aurelius: { id: 'aurelius', outcome: 'advance', narrative: 'His own name, staring back at you. Folded beneath the mirror\'s stand: a ledger page, densely written.', unlocksRed: ['H'] },
    iron: { id: 'iron', outcome: 'advance', narrative: 'Iron, heaviest of the four — and etched underneath, barely visible: a few bars of musical notation that turn out to be Morse.', unlocksRed: ['G'] },
    voss: { id: 'voss', outcome: 'advance', narrative: 'His own surname again, spelled out in light. The signal lamp\'s base swings open, revealing the ledger you\'d already begun reading.', unlocksRed: ['H'] },
    wound: { id: 'wound', outcome: 'advance', narrative: 'WOUND. Of course. The Sentinel itself has been waiting the entire evening. Its chest plate has one dial left unset.', unlocksRed: ['I'], unlocksBooklet: ['final-approach'] },
    '726': { id: '726', outcome: 'win', narrative: 'Seven-two-six. The final gear turns home.' },
    '12': { id: '12', outcome: 'decoy', narrative: 'The ledger page for 12 is a sketch of the cabinet drawer, with a margin note: "Counted only the drawer, did you? A workshop is bigger than a drawer — and so is a pocket." Check your items.' },
    '99': { id: '99', outcome: 'decoy', narrative: 'The ledger page for 99 shows only a smudged inkblot and Master Voss\'s initials, underlined twice. Not what you were looking for.' },
    '007': { id: '007', outcome: 'decoy', narrative: 'Page 007 is a receipt for pipe tobacco. Master Voss apparently had a sense of humor about round numbers. Keep looking.' },
  },

  greenCards: {
    gear: { id: 'gear', symbol: 'gear', hints: [
      'Master Voss taught you a simple cipher last spring — each letter shifts forward by the same small number.',
      'Try shifting each ciphered letter three places back through the alphabet.',
      'The decoded word is PENDULUM.',
    ] },
    key: { id: 'key', symbol: 'key', hints: [
      "Some of the shapes in the drawer aren't gears at all — look for a different silhouette in the clutter. And read the question carefully: it asks about the workshop, not just the drawer.",
      "There are twelve keys in the drawer — but haven't you already picked up a key somewhere else tonight?",
      'Twelve keys in the drawer, plus the brass key taped beneath Master Voss\'s note: the answer is 13.',
    ] },
    clock: { id: 'clock', symbol: 'clock', hints: [
      'Look at how each number in the sequence relates to the one before it.',
      'Each term is exactly double the one before it.',
      'The missing number is 64.',
    ] },
    compass: { id: 'compass', symbol: 'compass', hints: [
      'Three parts of the automaton bear stamped symbols: a cog, a key, and a lamp flame.',
      'Turn the decoder so the outer ring shows the cog, the middle ring the key, and the inner ring the flame.',
      'The revealed number is 319.',
    ] },
    eye: { id: 'eye', symbol: 'eye', hints: [
      'The note by the mirror looks like nonsense until you actually use the mirror.',
      'Hold the page up to a mirror — in the workshop, that means flipping the lens.',
      'The word is AURELIUS.',
    ] },
    leaf: { id: 'leaf', symbol: 'leaf', hints: [
      'Work through the four cogs one comparison at a time — start with the clue that names an extreme.',
      'The order, lightest to heaviest, is Copper, Silver, Brass, Iron.',
      'The heaviest cog is IRON.',
    ] },
    flame: { id: 'flame', symbol: 'flame', hints: [
      'The signal lamp in the corner still has oil in it — try lighting the play button.',
      'Each burst of short and long flashes is a letter. There are four letters total.',
      'The message is VOSS.',
    ] },
    feather: { id: 'feather', symbol: 'feather', hints: [
      "Not every word in the ledger is written in the same ink.",
      'Read only the red-inked letters, left to right, top to bottom.',
      'They spell WOUND.',
    ] },
    star: { id: 'star', symbol: 'star', hints: [
      "You'll need everything you've learned about this workshop's stars, moons, and flames for this last dial.",
      'Set the outer ring to the moon, the middle ring to the flame, and the inner ring to the star.',
      'The final number is 726.',
    ] },
  },

  objects: {
    brass_key: { id: 'brass_key', name: 'Brass Key', description: 'A small brass key, taped beneath Master Voss\'s note. It doesn\'t seem to fit the door — perhaps it opens something smaller.', icon: KeyObjectIcon },
    shaving_mirror: { id: 'shaving_mirror', name: 'Shaving Mirror', description: 'A hinged mirror from the desk. Handy for reading anything written backwards.', icon: MirrorObjectIcon },
    oil_can: { id: 'oil_can', name: 'Oil Can', description: 'A small can of clock oil, half full. The signal lamp in the corner looks thirsty.', icon: OilCanIcon },
  },

  decoder: {
    rings: [
      { segments: [
        { symbol: 'gear', digit: 3 }, { symbol: 'moon', digit: 7 }, { symbol: 'flame', digit: 1 }, { symbol: 'key', digit: 9 },
        { symbol: 'clock', digit: 0 }, { symbol: 'feather', digit: 5 }, { symbol: 'star', digit: 2 }, { symbol: 'compass', digit: 8 },
      ] },
      { segments: [
        { symbol: 'clock', digit: 4 }, { symbol: 'gear', digit: 6 }, { symbol: 'key', digit: 1 }, { symbol: 'moon', digit: 9 },
        { symbol: 'flame', digit: 2 }, { symbol: 'star', digit: 7 }, { symbol: 'feather', digit: 0 }, { symbol: 'compass', digit: 5 },
      ] },
      { segments: [
        { symbol: 'key', digit: 8 }, { symbol: 'clock', digit: 3 }, { symbol: 'gear', digit: 5 }, { symbol: 'flame', digit: 9 },
        { symbol: 'moon', digit: 1 }, { symbol: 'star', digit: 6 }, { symbol: 'feather', digit: 4 }, { symbol: 'compass', digit: 0 },
      ] },
    ],
    backClue: () => (
      <div>
        <h3 className="display-font">Engraved on the reverse</h3>
        <p>"Three rings, three truths. A cog remembers, a key admits, a flame confesses." — A. Voss</p>
      </div>
    ),
  },

  music: { baseFreq: 110, scale: [0, 3, 5, 7, 10, 12], waveform: 'sawtooth', tempoMs: 2600, filterFreq: 900, mood: 'mechanical' },
}
