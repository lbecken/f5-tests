import type { ReactNode } from 'react'
import type { ThemeManifest } from '../../engine/types'
import coverUrl from '../../assets/art/clockmaker-cover.svg'
import introVoice from '../../assets/voice/clockmaker-intro.mp3'
import winVoice from '../../assets/voice/clockmaker-win.mp3'
import {
  CipherPanel, SymbolCounter, MirrorPanel, MorsePanel,
  LensPanel, ScalePanel, ClockFace,
} from '../../engine/puzzles'
import { LockIcon } from '../../engine/icons'

function CoverArt() {
  return <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
}

/** The box clue is load-bearing: puzzle C (the lying clock face) cannot be solved
 * honestly without it. */
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

function Page({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

/* Puzzle C: the repainted, lying clock face. Position-counting (per the box clue)
 * gives hour 6, minute-mark 4 → 64. Reading the painted numerals gives 9 and 8 →
 * the 98 decoy card. */
const LYING_NUMERALS = ['XI', 'VI', 'I', 'X', 'VIII', 'II', 'IX', 'V', 'XII', 'IV', 'VII', 'III']

export const clockmakerTheme: ThemeManifest = {
  id: 'clockmaker',
  title: "The Clockmaker's Last Wind",
  tagline: 'A workshop, a vanished master, a hundred years of silence.',
  synopsis:
    'Locked in after hours to witness a legendary automaton rewind for the first time in a century, you must out-think a dead man\'s workshop before the last gear stops turning.',
  difficulty: 2.5,
  palette: { primary: '#6b4226', secondary: '#2b2118', accent: '#c9a24b', bg: '#14100c', paper: '#ece0c4', ink: '#201509' },
  coverArt: CoverArt,
  boxClue: BoxClue,

  intro: [
    {
      id: 'intro-1', order: 0, narrationUrl: introVoice, title: 'An Invitation After Hours',
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
          <p>Every puzzle you solve here resolves to a word or number. Enter it beside the puzzle card — the workshop's logbook (the Answer Deck) will tell you whether you're right, and if so, where to search next. Wrong-but-tempting answers sometimes have their own logbook pages. Learn from them.</p>
          <p>Some puzzles yield symbols instead. Turn the workshop's decoder until those symbols line up under the marker and read the number from its windows. The decoder has a back side. So does the box you found this game in. Nothing in this workshop is decoration.</p>
          <p>Three tiers of Master Voss's own marginalia (Hint Cards) are filed under the same symbol as each puzzle. Draw them one at a time — the third tier always confesses the full answer.</p>
        </Page>
      ),
    },
  ],

  storyPages: {
    'note-found': {
      id: 'note-found', order: 2, title: 'The Note, Decoded',
      body: () => <Page><p>"Find the pendulum," it read, once you'd unwound his cipher. Beneath the words, a small brass key had been taped to the paper. You pocket it. In this workshop, you suspect, nothing stays unused for long.</p></Page>,
    },
    'triptych-found': {
      id: 'triptych-found', order: 3, title: 'Three Stamps',
      body: () => <Page><p>Stamped into the Sentinel's chest plate are three marks of very different sizes — a cog broad as a coin, a key half that, a lamp flame barely a scratch. Worn smooth by a century of thumbs, as if the sizes themselves were the point.</p></Page>,
    },
    'final-approach': {
      id: 'final-approach', order: 4, title: 'One Gear Left',
      body: () => <Page><p>The ledger's ink is nearly dry. Whatever Master Voss intended, it ends at the Sentinel itself — and the last dial it's still waiting for. The order of its three keyholes is written nowhere in the room. Which leaves the things you carried in with you.</p></Page>,
    },
  },

  winPage: {
    id: 'win', order: 99, narrationUrl: winVoice, title: 'The Last Wind',
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
      id: 'A', letter: 'A', title: "The Apprentice's Note", symbol: 'gear', inputMode: 'text', difficulty: 1,
      solution: 'pendulum',
      entryHint: 'Enter the decoded word.',
      component: () => (
        <CipherPanel
          prompt="Master Voss's note is in the private cipher he taught you last spring — every letter pushed the same distance along the alphabet. He never wrote the distance down. He didn't need to."
          cipherText="SHQGXOXP"
          engraving={'Stamped on the winding crank beside the note: "THRICE TURNED, ALWAYS THRICE."'}
        />
      ),
    },
    B: {
      id: 'B', letter: 'B', title: 'Shelf of Curiosities', symbol: 'key', inputMode: 'text', difficulty: 2,
      solution: '13',
      entryHint: 'Enter how many working keys are in the workshop tonight.',
      component: () => (
        <SymbolCounter
          prompt="The cabinet drawer is a clutter of loose gears — but not everything in it is a gear, and not every key in it has survived a century of damp. A margin note in Master Voss's hand asks: 'How many working keys in the workshop tonight?'"
          targetGlyph="🔑"
          cells={[
            '⚙️','⚙️','🔑','⚙️',{ glyph: '🔑', dim: true },'🔑',
            '⚙️','⚙️','⚙️','🔑','⚙️','🔑',
            '⚙️','🔑','⚙️',{ glyph: '🔑', dim: true },'🔑','⚙️',
            '🔑','⚙️','🔑','⚙️','⚙️','🔑',
            '⚙️','🔑','⚙️','🔑',{ glyph: '🔑', dim: true },'🔑',
          ]}
          fine={'"A key eaten by rust opens nothing at all." — the same margin, smaller writing. And is the drawer really the only place you\'ve seen a key tonight?'}
        />
      ),
    },
    C: {
      id: 'C', letter: 'C', title: 'The Grandfather Lies', symbol: 'clock', inputMode: 'text', difficulty: 2,
      solution: '64',
      entryHint: 'Two digits: what the clock truly says — hour, then minute mark.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            The grandfather clock stopped the moment the door sealed. Someone has repainted
            its numerals — hastily, or with great care, you can't yet tell. The hands, at least,
            haven't moved.
          </p>
          <ClockFace
            numerals={LYING_NUMERALS}
            hourPos={6}
            minutePos={4}
            caption="The short hand marks the hour; the long hand, the minute track."
          />
        </div>
      ),
    },
    D: {
      id: 'D', letter: 'D', title: 'Triptych of Stamps', symbol: 'compass', inputMode: 'decoder', difficulty: 2,
      solution: '319',
      entryHint: 'Align the three stamped symbols on the decoder — in the order the engraving demands — and read the windows.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            Three marks are stamped into the Sentinel's chest plate, each a different size,
            worn smooth by a century of winding:
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2rem', justifyContent: 'center', padding: '0.6rem 0' }}>
            <span title="a cog, broad as a coin"><LockIcon symbol="gear" size={72} /></span>
            <span title="a key, half that size"><LockIcon symbol="key" size={44} /></span>
            <span title="a lamp flame, barely a scratch"><LockIcon symbol="flame" size={24} /></span>
          </div>
          <p className="cipher-engraving">
            Engraved around the dial's rim: "THE LOUDEST VOICE SPEAKS FROM THE WIDEST RING; THE FAINTEST, FROM THE HEART."
          </p>
        </div>
      ),
    },
    E: {
      id: 'E', letter: 'E', title: 'Mirror of Vanity', symbol: 'eye', inputMode: 'text', difficulty: 2,
      solution: 'aurelius',
      entryHint: 'Enter the first name the drawer wants.',
      component: ({ inventory }) => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            A locked desk drawer bears a small plaque: "SPEAK MY FIRST NAME." Tucked into the
            desk blotter, a slip of paper carries two lines of writing that read as nonsense —
            written for a mirror, not for you.
          </p>
          <MirrorPanel
            prompt=""
            mirroredText={'REKAMKCOLC · SUILERUA'}
            requiresItem={{ id: 'shaving_mirror', hint: 'You need something reflective. The workshop must have one somewhere — keep solving.' }}
            inventory={inventory}
          />
        </div>
      ),
    },
    F: {
      id: 'F', letter: 'F', title: 'The Weighted Cogs', symbol: 'leaf', inputMode: 'text', difficulty: 2,
      solution: 'iron',
      entryHint: 'Enter the metal of the cog the mainspring needs.',
      component: () => (
        <ScalePanel
          prompt="Four replacement cogs sit by the balance scale, none of them labeled with a weight. The maintenance ledger is unambiguous: 'THE MAINSPRING TAKES ONLY THE HEAVIEST COG. WEIGH THEM.'"
          items={[
            { id: 'copper', label: 'Copper', weight: 2 },
            { id: 'silver', label: 'Silver', weight: 4 },
            { id: 'brass', label: 'Brass', weight: 5 },
            { id: 'iron', label: 'Iron', weight: 7 },
          ]}
        />
      ),
    },
    G: {
      id: 'G', letter: 'G', title: 'Song of the Signal Lamp', symbol: 'flame', inputMode: 'text', difficulty: 2,
      solution: 'voss',
      entryHint: 'Enter the word the lamp is spelling to its audience.',
      component: () => (
        <div className="puzzle-widget">
          <MorsePanel
            prompt="An old signal lamp in the corner still has oil in it, clicking out the same pattern over and over. But notice where it's pointed: not at you — at the tall mirror on the far wall."
            message="SSOV"
          />
        </div>
      ),
    },
    H: {
      id: 'H', letter: 'H', title: 'The Feathered Ledger', symbol: 'feather', inputMode: 'text', difficulty: 3,
      solution: 'wound',
      entryHint: 'Enter the five-letter word, in the order the times dictate.',
      component: ({ inventory }) => (
        <LensPanel
          prompt="The workshop ledger's last page looks blank except for the heading: 'READ ME BY LAMPLIGHT, IN THE ORDER OF THE DAY.' The signal lamp will serve — if it has oil left to burn."
          lensLabel="Hold the page to the lamp"
          tint="rgba(120, 70, 200, 0.25)"
          requiresItem={{ id: 'oil_can', hint: 'The lamp is dry. Somewhere in this workshop there must be oil.' }}
          inventory={inventory}
          base={
            <p style={{ fontSize: '1rem', opacity: 0.6, fontStyle: 'italic' }}>
              …the page appears utterly blank…
            </p>
          }
          hidden={
            <div style={{ display: 'flex', gap: '1.6rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', fontFamily: "'Cinzel', serif", fontSize: '1.5rem' }}>
              <span>D<small style={{ display: 'block', fontSize: '0.55rem' }}>5 o'clock</small></span>
              <span>U<small style={{ display: 'block', fontSize: '0.55rem' }}>3 o'clock</small></span>
              <span>W<small style={{ display: 'block', fontSize: '0.55rem' }}>1 o'clock</small></span>
              <span>N<small style={{ display: 'block', fontSize: '0.55rem' }}>4 o'clock</small></span>
              <span>O<small style={{ display: 'block', fontSize: '0.55rem' }}>2 o'clock</small></span>
            </div>
          }
        />
      ),
    },
    I: {
      id: 'I', letter: 'I', title: "The Sentinel's Final Dial", symbol: 'star', inputMode: 'decoder', difficulty: 3,
      solution: '726',
      entryHint: 'The keyholes name the symbols. Only the decoder itself knows their order.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            Beneath the chest plate, the last dial waits. Three keyholes are cut into it, arranged
            in a circle with no beginning — a crescent moon, a lamp flame, a five-pointed star.
            Nothing on the Sentinel, and nothing in the ledger, says which comes first.
          </p>
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', padding: '0.6rem 0' }}>
            <LockIcon symbol="moon" size={44} />
            <LockIcon symbol="flame" size={44} />
            <LockIcon symbol="star" size={44} />
          </div>
          <p className="cipher-engraving">
            Scratched faintly under the dial: "TURN ME OVER IN YOUR MIND — OR SIMPLY TURN ME OVER."
          </p>
        </div>
      ),
    },
  },

  blueCards: {
    pendulum: { id: 'pendulum', outcome: 'advance', narrative: '"Find the pendulum," the note read once unshifted — three letters back, as the crank promised. Taped beneath the words: a small brass key. Keep it. Everything in this workshop gets used eventually.', unlocksRed: ['B'], grantsObjects: ['brass_key'], unlocksBooklet: ['note-found'] },
    '13': { id: '13', outcome: 'advance', narrative: 'Thirteen keys — twelve sound ones in the drawer, and the thirteenth warming in your pocket. The pendulum case swings open, revealing the stopped grandfather clock and a maintenance hatch behind it.', unlocksRed: ['C', 'D'] },
    '64': { id: '64', outcome: 'advance', narrative: 'Six, then four — the positions, not the paint. The clock face swings open on a hidden hinge. Behind it: a gentleman\'s shaving mirror and a locked desk drawer with a name plaque.', unlocksRed: ['E'], grantsObjects: ['shaving_mirror'] },
    '319': { id: '319', outcome: 'advance', narrative: 'Three-one-nine — widest voice to faintest. A compartment in the workbench opens: a balance scale, four unlabeled cogs, and a half-full can of clock oil.', unlocksRed: ['F', 'G'], grantsObjects: ['oil_can'], unlocksBooklet: ['triptych-found'] },
    aurelius: { id: 'aurelius', outcome: 'advance', narrative: 'AURELIUS — his first name, not his trade. The drawer accepts it. Inside lies the workshop ledger, its final page apparently blank.', unlocksRed: ['H'] },
    iron: { id: 'iron', outcome: 'advance', narrative: 'Iron — heavier than brass, as the scale finally confessed. The mainspring accepts the cog with a satisfying clunk, and the signal lamp in the corner begins to click.', unlocksRed: ['G'] },
    voss: { id: 'voss', outcome: 'advance', narrative: 'VOSS. The lamp was spelling it backwards all along — it speaks to the mirror, and the mirror speaks to you. The lamp\'s base swings open, revealing the same ledger drawer key Aurelius\'s name unlocks.', unlocksRed: ['H'] },
    wound: { id: 'wound', outcome: 'advance', narrative: 'WOUND — one o\'clock to five o\'clock, in the order of the day. Of course. The Sentinel has been waiting to be wound the entire evening. Its chest plate releases, exposing one final dial.', unlocksRed: ['I'], unlocksBooklet: ['final-approach'] },
    '726': { id: '726', outcome: 'win', narrative: 'Seven-two-six. Night first, fire\'s middle course, and the light that outlives them both. The final gear turns home.' },
    '12': { id: '12', outcome: 'decoy', narrative: 'The ledger page for 12 is a sketch of the cabinet drawer, margin note: "Counted only the drawer, did you? A workshop is bigger than a drawer — and so is a pocket." Check your items.' },
    '15': { id: '15', outcome: 'decoy', narrative: 'Page 15 shows the drawer again, all keys circled — even the rust-eaten ones. Beneath, in red ink: "A ruined key is a decoration. Count only what still turns."' },
    '98': { id: '98', outcome: 'decoy', narrative: 'Page 98 is a portrait of the grandfather clock, and under it a single line: "You read the paint. The paint is new; the positions are old. What did the box lid tell you?"' },
    '99': { id: '99', outcome: 'decoy', narrative: 'The ledger page for 99 shows only a smudged inkblot and Master Voss\'s initials, underlined twice. Not what you were looking for.' },
  },

  greenCards: {
    gear: { id: 'gear', symbol: 'gear', hints: [
      'The cipher key was never written on the note. But something about the winding crank was worth stamping into the metal.',
      '"Thrice turned" — try walking each letter three steps back through the alphabet.',
      'Shift every letter back by 3: SHQGXOXP becomes PENDULUM.',
    ] },
    key: { id: 'key', symbol: 'key', hints: [
      "Two questions hide in this drawer: which keys still work, and whether the drawer is the only place keys live tonight.",
      'The faded, rust-eaten keys open nothing — exclude them. Then re-read the question: it asks about the workshop, not the drawer. What have you already pocketed?',
      'Twelve sound keys in the drawer, plus the brass key from the note: the answer is 13.',
    ] },
    clock: { id: 'clock', symbol: 'clock', hints: [
      'The numerals were repainted, but the hands never moved. Did anything you saw before opening the box mention clock faces?',
      'The box lid: "Trust the count, not the face." Ignore the painted numerals — count positions clockwise from the top.',
      'The hour hand sits on the 6th position, the minute hand on the 4th: the answer is 64.',
    ] },
    compass: { id: 'compass', symbol: 'compass', hints: [
      'Three stamps, three sizes, three rings. The rim engraving talks about voices — and about width.',
      '"The loudest voice speaks from the widest ring": the big cog goes to the outer ring, the tiny flame to the inner heart.',
      'Set outer=cog, middle=key, inner=flame. The windows read 319.',
    ] },
    eye: { id: 'eye', symbol: 'eye', hints: [
      'The slip has TWO mirrored lines, and the plaque is picky: it wants a first name.',
      'In a mirror the lines read CLOCKMAKER and AURELIUS. One is a trade, not a name.',
      'The drawer wants AURELIUS.',
    ] },
    leaf: { id: 'leaf', symbol: 'leaf', hints: [
      'No cog is labeled. The scale is not decoration — load the pans and watch the tilt.',
      'Weigh them in pairs and keep the winner: iron outweighs brass, brass outweighs silver, silver outweighs copper.',
      'The heaviest cog is IRON.',
    ] },
    flame: { id: 'flame', symbol: 'flame', hints: [
      'Decode the clicks first. If the result looks like nonsense, look at where the lamp is aimed.',
      'The lamp signals S-S-O-V — but it speaks to the mirror on the far wall, and mirrors reverse.',
      'SSOV reversed is VOSS.',
    ] },
    feather: { id: 'feather', symbol: 'feather', hints: [
      'A blank page and a heading about lamplight. The lamp in the corner is dry — something you found earlier can fix that.',
      'Oil the lamp (you need the oil can from the workbench). Under its light, five letters appear, each tagged with a time of day — read them in clock order, not page order.',
      "One o'clock to five o'clock the letters read W-O-U-N-D: the answer is WOUND.",
    ] },
    star: { id: 'star', symbol: 'star', hints: [
      'The keyholes name three symbols but no order. The dial\'s scratch suggests turning something over — something you have been using all night.',
      'Flip the decoder over. Its back is engraved: night first, fire\'s middle course, then the light that outlives both.',
      'Set outer=moon, middle=flame, inner=star. The windows read 726.',
    ] },
  },

  objects: {
    brass_key: { id: 'brass_key', name: 'Brass Key', description: 'A small brass key, taped beneath Master Voss\'s note. It doesn\'t fit the door — but a good apprentice counts everything in their pockets.', icon: KeyObjectIcon },
    shaving_mirror: { id: 'shaving_mirror', name: 'Shaving Mirror', description: 'A hinged gentleman\'s mirror from behind the clock face. Handy for reading anything written for a reflection.', icon: MirrorObjectIcon },
    oil_can: { id: 'oil_can', name: 'Oil Can', description: 'A half-full can of clock oil from the workbench. The signal lamp in the corner looks thirsty.', icon: OilCanIcon },
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
        <p>"Night comes first. The fire runs its middle course. The last light outlives them both."</p>
        <p style={{ opacity: 0.7, fontStyle: 'italic' }}>— A. Voss, who never engraved anything without a reason</p>
      </div>
    ),
  },

  music: { baseFreq: 110, scale: [0, 3, 5, 7, 10, 12], waveform: 'sawtooth', tempoMs: 2600, filterFreq: 900, mood: 'mechanical' },
}
