import type { ReactNode } from 'react'
import type { ThemeManifest } from '../../engine/types'
import coverUrl from '../../assets/art/zephyr-cover.svg'
import introVoice from '../../assets/voice/zephyr-intro.mp3'
import winVoice from '../../assets/voice/zephyr-win.mp3'
import {
  AnagramPanel, GridLookupPanel, ScalePanel, TearPanel, FoldPanel,
  RubbingPanel, MazePanel,
} from '../../engine/puzzles'
import { LockIcon } from '../../engine/icons'

function CoverArt() {
  return <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
}

/** Load-bearing: the initials on this label are the last confirmation for card J. */
function BoxClue() {
  return <p>Pasted under the box, a first-class luggage label, gold on navy: <br />"PROPERTY OF R. A. — IF LOST, RETURN TO NO ONE."</p>
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <path d="M4 10l8-6 8 6v10H4z" stroke="#d4af5a" strokeWidth="1.5" strokeLinejoin="round" />
      <text x="12" y="17" textAnchor="middle" fontSize="7" fill="#d4af5a" fontFamily="monospace">47</text>
    </svg>
  )
}
function TimetableIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="#d4af5a" strokeWidth="1.5" />
      <line x1="7" y1="8" x2="17" y2="8" stroke="#d4af5a" strokeWidth="1.2" />
      <line x1="7" y1="12" x2="17" y2="12" stroke="#d4af5a" strokeWidth="1.2" />
      <line x1="7" y1="16" x2="13" y2="16" stroke="#d4af5a" strokeWidth="1.2" />
    </svg>
  )
}
function ConductorKeyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <circle cx="8" cy="8" r="4.5" stroke="#d4af5a" strokeWidth="1.6" />
      <path d="M11 11l9 9M16 16l3-3" stroke="#d4af5a" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function Page({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

export const zephyrTheme: ThemeManifest = {
  id: 'zephyr',
  title: 'The Zephyr Vanishes',
  tagline: 'Ninety seconds of darkness. One empty safe. Milan in an hour.',
  synopsis:
    'Paris to Istanbul aboard the Zephyr Aurore, 1928. In the Simplon tunnel the lights fail — and the Lucerne Diamond fails with them. You are the railway detective, and the thief steps off at Milan unless you name them first.',
  difficulty: 4,
  palette: { primary: '#14384f', secondary: '#0a1c28', accent: '#d4af5a', bg: '#071019', paper: '#efe6d0', ink: '#1b2733' },
  coverArt: CoverArt,
  boxClue: BoxClue,

  intro: [
    {
      id: 'intro-1', order: 0, narrationUrl: introVoice, title: 'Ninety Seconds', body: () => (
        <Page>
          <p>The Zephyr Aurore is the fastest, vainest train in Europe — art deco from cowcatcher to caboose, and tonight, custodian of the Lucerne Diamond, riding in the mail-car safe under three locks.</p>
          <p>At 21:12, in the black of the Simplon tunnel, every light on the train dies for ninety seconds. When they flare back, the safe stands open, empty, and politely shut again. The mail car was locked from the inside.</p>
          <p>You carry a railway detective's warrant. The conductor has sealed the corridors and given you until Milan. After that, every passenger — and the diamond — walks.</p>
        </Page>
      ),
    },
    {
      id: 'intro-2', order: 1, title: "A Detective's Method", body: () => (
        <Page>
          <p>Everything you solve resolves to a word or number — log it beside its card, and the conductor's telegraph (the Answer Deck) confirms or scolds. Symbol-answers route through the conductor's cipher dial: three rings, and an engraving on its reverse he seems embarrassed about.</p>
          <p>This case is cumulative. Evidence from one card will convict nobody by itself — keep everything: names, tags, initials, even the box this game arrived in. The finale asks for all of it at once.</p>
        </Page>
      ),
    },
  ],

  storyPages: {
    'manifest-page': {
      id: 'manifest-page', order: 2, title: 'The Sealed Manifest', body: () => (
        <Page>
          <p>The conductor surrenders the passenger manifest with the expression of a man handing over his own diary. "First class is above suspicion," he says, entirely wrong.</p>
          <p>The Zephyr runs four passenger cars, I through IV, plus the dining car and the mail car. Whoever cracked the safe knew the train's rhythms — the tunnel, the generator, the ninety seconds.</p>
        </Page>
      ),
    },
    'tunnel-page': {
      id: 'tunnel-page', order: 3, title: 'What the Tunnel Knew', body: () => (
        <Page>
          <p>The false-bottomed trunk held a chef's uniform — never worn, tags still on — and a copy of the Simplon tunnel schedule with 21:12 circled twice. The thief didn't ride this train. The thief studied it.</p>
        </Page>
      ),
    },
    'chase-page': {
      id: 'chase-page', order: 4, title: 'The Route Remembers', body: () => (
        <Page>
          <p>Lucerne. The diamond's own name, hidden in the junctions of its escape route. The thief has a sense of theatre — and theatrical people sign their work. Check everything with initials on it. Everything.</p>
        </Page>
      ),
    },
  },

  winPage: {
    id: 'win', order: 99, narrationUrl: winVoice, title: 'Milano Centrale',
    body: () => (
      <Page>
        <p>She's in the dining car, of course — third table, facing the door, halfway through a coffee she never intended to finish. Regina Argent. The trunks named her family; the window named her; the luggage label under your own game box has been carrying her initials since before you opened it.</p>
        <p>"Detective," she says, and slides the sugar bowl across the table. Inside, wrapped in a chef's glove: the Lucerne Diamond.</p>
        <p>"I only ever steal things back," she says, as the brakes begin to sing for Milan. "Ask the museum where they got it. Then decide whether to hold the train."</p>
      </Page>
    ),
  },

  startingRed: ['A'],
  finalRedCard: 'J',

  redCards: {
    A: {
      id: 'A', letter: 'A', title: 'The Torn Ticket', symbol: 'feather', inputMode: 'text', difficulty: 1,
      solution: '312',
      entryHint: 'Three digits: car, then seat.',
      component: () => (
        <TearPanel
          prompt="One first-class ticket lies in the mail car, its holder's name smeared into a comma of ink. The seat assignment is printed on the stub — and the stub is still folded shut behind its perforation."
          tearLabel="Tear the stub open"
          intact={
            <div style={{ fontFamily: "'JetBrains Mono', monospace", textAlign: 'center' }}>
              <p style={{ letterSpacing: '0.2em', margin: 0 }}>ZEPHYR AURORE · PREMIÈRE CLASSE</p>
              <p style={{ fontSize: '1.1rem', margin: '0.4em 0' }}>M. A■■■■R</p>
              <p style={{ opacity: 0.6, margin: 0 }}>CAR — · SEAT — <em>(see stub)</em></p>
            </div>
          }
          revealed={
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.2rem' }}>
              CAR III · SEAT 12
            </div>
          }
        />
      ),
    },
    B: {
      id: 'B', letter: 'B', title: 'The Passenger Manifest', symbol: 'eye', inputMode: 'text', difficulty: 2,
      solution: '47',
      entryHint: "Enter the luggage-tag number of the ticket's owner.",
      component: () => (
        <GridLookupPanel
          prompt="The manifest cross-indexes every berth with its passenger and luggage tag. You have a car and a seat from somewhere. Use them."
          colHeaders={['SEAT 10', 'SEAT 11', 'SEAT 12', 'SEAT 14']}
          rowHeaders={['CAR I', 'CAR II', 'CAR III', 'CAR IV']}
          cells={[
            ['H. BLUM · tag 31', 'vacant', 'C. FOSSATI · tag 22', 'E. DENEUVE · tag 58'],
            ['R. OKONKWO · tag 19', 'T. MARELLI · tag 63', 'vacant', 'P. SANDS · tag 40'],
            ['G. VOGEL · tag 75', 'vacant', 'M. AIGNER · tag 47', 'L. WEISS · tag 06'],
            ['vacant', 'B. CHANDRA · tag 88', 'A. RUIZ · tag 51', 'vacant'],
          ]}
          caption="Berth grid, first class. The porter's hand, the conductor's spelling."
        />
      ),
    },
    C: {
      id: 'C', letter: 'C', title: 'The Name That Is Not a Name', symbol: 'moon', inputMode: 'text', difficulty: 2,
      solution: 'regina',
      entryHint: 'Enter the first name hiding in the alias.',
      component: () => (
        <AnagramPanel
          prompt={'"M. AIGNER" appears on no census, no consulate list, no bank ledger — the conductor checked at the last telegraph stop. Aliases are rarely inventions; they are rearrangements. The M., you suspect, is only a chauffeur\'s-cap "Monsieur".'}
          letters={['A', 'I', 'G', 'N', 'E', 'R']}
        />
      ),
    },
    D: {
      id: 'D', letter: 'D', title: 'Four Identical Trunks', symbol: 'leaf', inputMode: 'text', difficulty: 2,
      solution: 'basel',
      entryHint: 'Enter the city on the heaviest trunk\'s sticker.',
      component: () => (
        <ScalePanel
          prompt="Tag 47 leads to the luggage van and four steamer trunks, identical down to the scuffs — the porter swears they boarded together. A lead-lined false bottom weighs more than any wardrobe. The van's freight scale still works."
          items={[
            { id: 'paris', label: 'PARIS sticker', weight: 3 },
            { id: 'lyon', label: 'LYON sticker', weight: 4 },
            { id: 'basel', label: 'BASEL sticker', weight: 7 },
            { id: 'stresa', label: 'STRESA sticker', weight: 4 },
          ]}
        />
      ),
    },
    E: {
      id: 'E', letter: 'E', title: 'The Circled Timetable', symbol: 'clock', inputMode: 'decoder', difficulty: 3,
      solution: '803',
      entryHint: 'Departure order is ring order. The dial\'s reverse agrees.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            Inside the false bottom: a chef's uniform, unworn, and the Simplon route timetable.
            Three stations are circled in grease pencil, each defaced with one of the cipher
            dial's symbols. Nothing says which symbol comes first — except the departures column.
          </p>
          <table className="grid-lookup-table" style={{ margin: '0 auto' }}>
            <thead><tr><th>station</th><th>departs</th><th>mark</th></tr></thead>
            <tbody>
              <tr><td>BRIG</td><td className="mono">08:14</td><td><LockIcon symbol="clock" size={20} /></td></tr>
              <tr><td>DOMODOSSOLA</td><td className="mono">11:02</td><td><LockIcon symbol="key" size={20} /></td></tr>
              <tr><td>MILANO</td><td className="mono">21:40</td><td><LockIcon symbol="star" size={20} /></td></tr>
            </tbody>
          </table>
        </div>
      ),
    },
    F: {
      id: 'F', letter: 'F', title: "The Dining Car Bill", symbol: 'flame', inputMode: 'text', difficulty: 3,
      solution: '86',
      entryHint: 'Enter the amount, in francs, the fold confesses.',
      component: () => (
        <FoldPanel
          prompt="Seat 12's final dinner bill was 'settled in cash, exact'. The waiter kept the carbon — a strange one, printed in halves, with a dotted crease across its middle and half a numeral on either side. Bills like this are read folded."
          topContent={
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '2.6rem', opacity: 0.85 }}>
              ⌐8 <span style={{ opacity: 0.4, fontSize: '1rem' }}>· · fold · ·</span> 6⌐
            </div>
          }
          bottomContent={
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1rem', opacity: 0.6 }}>
              …the lower half is only tablecloth and a tip line…
            </div>
          }
          foldedContent={
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '3rem' }}>
              86 <span style={{ fontSize: '1rem' }}>francs</span>
            </div>
          }
        />
      ),
    },
    G: {
      id: 'G', letter: 'G', title: 'The Smoke-Stained Window', symbol: 'wave', inputMode: 'text', difficulty: 3,
      solution: 'argent',
      entryHint: 'Enter the surname on the glass.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            The mail car's one window is filmed with tunnel soot — except where a gloved finger
            wrote on it <em>from the outside</em>, sometime before the tunnel. Writing meant to be
            read from your side of the glass is written backwards from theirs. Clear the soot first.
          </p>
          <RubbingPanel
            prompt=""
            maskColor="#3b3b41"
            maskLabel="soot — rub to clear"
            hidden={<span style={{ fontFamily: "'Cinzel', serif", fontSize: '2rem', letterSpacing: '0.15em', transform: 'scaleX(-1)', display: 'inline-block' }}>ARGENT</span>}
            height={130}
          />
        </div>
      ),
    },
    H: {
      id: 'H', letter: 'H', title: 'The Getaway Route', symbol: 'compass', inputMode: 'text', difficulty: 3,
      solution: 'lucerne',
      entryHint: 'Enter what the junction letters spell along the only clear route.',
      component: () => (
        <MazePanel
          prompt="Folded into the chef's uniform: a junction map of the escape route, drawn by someone who plans in ink. Half the junctions are crossed out — points failures, no doubt arranged. Trace the only clear route from the mail car (▶) to the depot (■), collecting junction letters as you go."
          nodes={[
            { id: 'start', x: 20, y: 100, label: '▶' },
            { id: 'n1', x: 70, y: 60, label: 'L' },
            { id: 'n2', x: 70, y: 145, label: 'B' },
            { id: 'n3', x: 120, y: 40, label: 'U' },
            { id: 'n4', x: 120, y: 110, label: 'C' },
            { id: 'n5', x: 165, y: 70, label: 'E' },
            { id: 'n6', x: 165, y: 160, label: 'K' },
            { id: 'n7', x: 210, y: 40, label: 'R' },
            { id: 'n8', x: 215, y: 115, label: 'N' },
            { id: 'n9', x: 255, y: 75, label: 'E' },
            { id: 'end', x: 285, y: 130, label: '■' },
          ]}
          edges={[
            ['start', 'n1'], ['start', 'n2'],
            ['n1', 'n3'], ['n2', 'n4'],
            ['n3', 'n4'], ['n4', 'n5'],
            ['n5', 'n6'], ['n5', 'n7'],
            ['n7', 'n8'], ['n6', 'n8'],
            ['n8', 'n9'], ['n9', 'end'],
          ]}
          startId="start"
          endId="end"
        />
      ),
    },
    I: {
      id: 'I', letter: 'I', title: 'The Mail-Car Safe', symbol: 'key', inputMode: 'decoder', difficulty: 3,
      solution: '241',
      entryHint: 'Three plates, three classes. First class rides the outer ring.',
      component: ({ inventory }) => (
        <div className="puzzle-widget">
          {inventory.includes('conductors_key') ? (
            <>
              <p className="puzzle-prompt">
                The conductor's key opens the safe's inspection panel. Behind it, three brass
                plates, each stamped with a cipher symbol and a tiny class numeral in the corner —
                the thief reset the combination and left it labeled, the way a magician leaves a
                signed card.
              </p>
              <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', padding: '0.6rem 0', alignItems: 'flex-end' }}>
                <span style={{ textAlign: 'center' }}><LockIcon symbol="gear" size={44} /><div style={{ fontSize: '0.7rem' }}>cl. I</div></span>
                <span style={{ textAlign: 'center' }}><LockIcon symbol="flame" size={44} /><div style={{ fontSize: '0.7rem' }}>cl. II</div></span>
                <span style={{ textAlign: 'center' }}><LockIcon symbol="wave" size={44} /><div style={{ fontSize: '0.7rem' }}>cl. III</div></span>
              </div>
            </>
          ) : (
            <p className="lens-missing">🔒 The safe's inspection panel is locked. Only the conductor's key opens it — and the conductor only trusts a detective who has traced the whole route.</p>
          )}
        </div>
      ),
    },
    J: {
      id: 'J', letter: 'J', title: 'The Unmasking', symbol: 'skull', inputMode: 'text', difficulty: 3,
      solution: 'regina argent',
      entryHint: 'Full name — given name first, surname last.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            Milan in eight minutes. The conductor hands you a blank telegraph form and keeps his
            eyes on the corridor. "One name, detective. In full. I will hold the train for a name."
          </p>
          <div className="cipher-text" style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>
            EVIDENCE ON FILE:<br />
            · an alias, unscrambled to a given name<br />
            · a surname written on soot, from outside<br />
            · four trunks that share a family name with that window<br />
            · and a luggage label pasted somewhere no passenger would ever look —
            somewhere underneath everything — bearing two initials
          </div>
        </div>
      ),
    },
  },

  blueCards: {
    '312': { id: '312', outcome: 'advance', narrative: 'Car III, seat 12. The conductor exhales through his moustache and unlocks the manifest cabinet.', unlocksRed: ['B'], unlocksBooklet: ['manifest-page'] },
    '47': { id: '47', outcome: 'advance', narrative: 'Tag 47 — booked by "M. AIGNER", a name the telegraph office has never heard of, attached to more luggage than any one passenger needs. Two threads to pull: the name, and the trunks.', unlocksRed: ['C', 'D'], grantsObjects: ['brass_tag'] },
    regina: { id: 'regina', outcome: 'advance', narrative: 'REGINA. Six letters that were never trying very hard to hide. A given name — now it needs a family.', unlocksRed: [] },
    basel: { id: 'basel', outcome: 'advance', narrative: 'The BASEL trunk sinks the freight scale — lead-lined, false-bottomed. Inside: an unworn chef\'s uniform and the Simplon timetable, 21:12 circled twice.', unlocksRed: ['E'], grantsObjects: ['tunnel_timetable'], unlocksBooklet: ['tunnel-page'] },
    '803': { id: '803', outcome: 'advance', narrative: 'Eight-zero-three — Brig before Domodossola before Milano, exactly as trains insist. The timetable\'s back page unfolds into a dinner bill carbon and a soot-dark window that suddenly interests you.', unlocksRed: ['F', 'G'] },
    '86': { id: '86', outcome: 'advance', narrative: 'Eighty-six francs, folded — the exact price of the chef\'s tasting menu, which seat 12 ordered without seeing a menu. Someone knew this train\'s dining car by heart. A junction map falls from the bill\'s fold.', unlocksRed: ['H'] },
    argent: { id: 'argent', outcome: 'advance', narrative: 'ARGENT — written from outside the moving train, which tells you the thief\'s nerve, and written for YOU, which tells you their vanity. The junction map is now doubly interesting.', unlocksRed: ['H'] },
    lucerne: { id: 'lucerne', outcome: 'advance', narrative: 'L-U-C-E-R-N-E. The diamond\'s own name, spelled by its escape route. The conductor goes pale, then hands you his personal key. "The safe. Whatever is left in it, detective."', unlocksRed: ['I'], grantsObjects: ['conductors_key'], unlocksBooklet: ['chase-page'] },
    '241': { id: '241', outcome: 'advance', narrative: 'Two-four-one, first class to the outer rail. The safe opens on: nothing. Nothing except a telegraph form, blank, and the certainty that you already know the name to write on it.', unlocksRed: ['J'] },
    'regina argent': { id: 'regina argent', outcome: 'win', narrative: 'The conductor reads the form once, nods, and holds the train.' },
    '213': { id: '213', outcome: 'decoy', narrative: 'The telegraph clacks back: "CAR II SEAT 13 IS THE LAVATORY. — MILAN DISPATCH." Read the stub again: car first, then seat.' },
    aigner: { id: 'aigner', outcome: 'decoy', narrative: '"AIGNER" is the alias, detective — the costume, not the woman. Aliases are rearrangements. Rearrange.' },
    '68': { id: '68', outcome: 'decoy', narrative: 'Sixty-eight francs buys no tasting menu on this train. You read the bill upside down — fold it the other way.' },
    'regina aigner': { id: 'regina aigner', outcome: 'decoy', narrative: 'The conductor lowers the form. "Aigner boarded at Lausanne, detective. Nobody BORN Aigner did." Her real family name was on the glass — and under your box.' },
    '000': { id: '000', outcome: 'decoy', narrative: 'The telegraph hums and returns nothing but line static. Milan does not acknowledge.' },
  },

  greenCards: {
    feather: { id: 'feather', symbol: 'feather', hints: [
      'The seat assignment is on the stub, and the stub is still sealed behind its perforation.',
      'Tear the stub. Then respect railway grammar: car before seat.',
      'Car III, seat 12 → the answer is 312.',
    ] },
    eye: { id: 'eye', symbol: 'eye', hints: [
      'You already know a car and a seat from the ticket. The manifest is a grid — use them as coordinates.',
      'Car III row, seat 12 column: "M. AIGNER · tag 47".',
      'The tag number is 47.',
    ] },
    moon: { id: 'moon', symbol: 'moon', hints: [
      'The conductor confirmed AIGNER exists nowhere. Aliases are rearrangements, and the M. is just "Monsieur".',
      'Six tiles: A, I, G, N, E, R. Try starting with the R.',
      'AIGNER rearranges to REGINA.',
    ] },
    leaf: { id: 'leaf', symbol: 'leaf', hints: [
      'A lead-lined false bottom cannot hide from a freight scale. Weigh trunk against trunk and keep the winner.',
      'BASEL outweighs LYON and STRESA, which outweigh PARIS.',
      'The heaviest trunk wears the BASEL sticker — the answer is BASEL.',
    ] },
    clock: { id: 'clock', symbol: 'clock', hints: [
      'Three symbols, no stated order — but each mark sits next to a departure time.',
      'Chronological: 08:14 (clock), 11:02 (key), 21:40 (star). Earliest departure rides the outer ring — the dial\'s reverse says the same.',
      'Set outer=clock, middle=key, inner=star. The windows read 803.',
    ] },
    flame: { id: 'flame', symbol: 'flame', hints: [
      'The carbon is printed in halves with a crease — bills like this are read folded, half-numerals joining.',
      'Fold the card. The half-strokes complete each other into two digits.',
      'Folded, the bill reads 86 francs.',
    ] },
    wave: { id: 'wave', symbol: 'wave', hints: [
      'Two layers here: the soot, and the direction of the writing.',
      'Rub the soot away. The word was written from OUTSIDE the glass — it reads reversed from your side.',
      'The reversed word is ARGENT.',
    ] },
    compass: { id: 'compass', symbol: 'compass', hints: [
      'Only one route survives the crossed-out junctions. Trace it and write the letters down in order.',
      'From ▶ the clear route runs through L, U, C, E… and does not detour through B or K.',
      'The junction letters spell LUCERNE.',
    ] },
    key: { id: 'key', symbol: 'key', hints: [
      'The panel needs the conductor\'s key — he hands it over once the route puzzle is solved. Then: three plates, three class numerals.',
      'Class I to the outer ring, class II to the middle, class III to the heart: gear, flame, wave.',
      'Set outer=gear, middle=flame, inner=wave. The windows read 241.',
    ] },
    skull: { id: 'skull', symbol: 'skull', hints: [
      'Four pieces of evidence, one of them not inside the game at all: the given name, the surname, the trunks\' family, and the initials somewhere no passenger looks.',
      'The anagram gave REGINA. The window gave ARGENT. The label under the game box reads "R. A." — it has agreed with you all along.',
      'Write REGINA ARGENT — given name first, surname last.',
    ] },
  },

  objects: {
    brass_tag: { id: 'brass_tag', name: 'Brass Tag 47', description: 'Luggage tag 47, surrendered by the porter. It opens nothing — it accuses.', icon: TagIcon },
    tunnel_timetable: { id: 'tunnel_timetable', name: 'Simplon Timetable', description: 'The tunnel schedule from the false-bottomed trunk, 21:12 circled twice in grease pencil. The thief studied this train like scripture.', icon: TimetableIcon },
    conductors_key: { id: 'conductors_key', name: "Conductor's Key", description: 'The conductor\'s personal key, given — not lent, he stresses — to open the mail-car safe\'s inspection panel.', icon: ConductorKeyIcon },
  },

  decoder: {
    rings: [
      { segments: [
        { symbol: 'clock', digit: 8 }, { symbol: 'gear', digit: 2 }, { symbol: 'moon', digit: 5 }, { symbol: 'key', digit: 1 },
        { symbol: 'star', digit: 9 }, { symbol: 'flame', digit: 6 }, { symbol: 'wave', digit: 3 }, { symbol: 'compass', digit: 0 },
      ] },
      { segments: [
        { symbol: 'key', digit: 0 }, { symbol: 'flame', digit: 4 }, { symbol: 'star', digit: 6 }, { symbol: 'clock', digit: 1 },
        { symbol: 'gear', digit: 9 }, { symbol: 'moon', digit: 3 }, { symbol: 'wave', digit: 8 }, { symbol: 'compass', digit: 5 },
      ] },
      { segments: [
        { symbol: 'star', digit: 3 }, { symbol: 'wave', digit: 1 }, { symbol: 'key', digit: 7 }, { symbol: 'clock', digit: 5 },
        { symbol: 'flame', digit: 0 }, { symbol: 'gear', digit: 6 }, { symbol: 'moon', digit: 2 }, { symbol: 'compass', digit: 9 },
      ] },
    ],
    backClue: () => (
      <div>
        <h3 className="display-font">Engraved on the dial's reverse</h3>
        <p>"A train is read like a timetable: whatever departs first rides the outer rail."</p>
        <p style={{ opacity: 0.7, fontStyle: 'italic' }}>— property of the Compagnie du Zephyr; conductors will be billed for loss</p>
      </div>
    ),
  },

  music: { baseFreq: 147, scale: [0, 2, 4, 7, 9, 12], waveform: 'triangle', tempoMs: 2200, filterFreq: 850, mood: 'deco' },
}
