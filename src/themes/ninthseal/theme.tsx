import type { ReactNode } from 'react'
import type { ThemeManifest } from '../../engine/types'
import {
  RubbingPanel, ScalePanel, GridLookupPanel, ConstellationPanel,
  LensPanel, TearPanel,
} from '../../engine/puzzles'
import { LockIcon } from '../../engine/icons'

function CoverArt() {
  return (
    <svg viewBox="0 0 200 160" width="100%" height="100%">
      {/* pyramid against a star field */}
      {Array.from({ length: 26 }).map((_, i) => (
        <circle key={i} cx={(i * 47 + 11) % 200} cy={(i * 29 + 5) % 70} r="1" fill="#e0b34f" opacity="0.7" />
      ))}
      <path d="M100 28 L168 132 L32 132 Z" fill="none" stroke="#e0b34f" strokeWidth="3" strokeLinejoin="round" />
      <path d="M100 28 L128 132" stroke="#e0b34f" strokeWidth="1.4" opacity="0.6" />
      {/* the ninth seal: a cartouche, name scratched out */}
      <rect x="72" y="88" width="56" height="20" rx="10" fill="none" stroke="#e0b34f" strokeWidth="2" />
      <line x1="78" y1="98" x2="122" y2="98" stroke="#e0b34f" strokeWidth="3" opacity="0.85" />
      <line x1="60" y1="146" x2="140" y2="146" stroke="#e0b34f" strokeWidth="2" />
      <text x="100" y="152" textAnchor="middle" fontSize="8" fill="#e0b34f" opacity="0.7">𓋹 𓊽 𓋹</text>
    </svg>
  )
}

function BoxClue() {
  return <p>Burned into the box's underside, as if with a magnifying glass: "NINE SEALS. NINE LETTERS. THE TOMB REMEMBERS WHAT THE KINGDOM ERASED — IN ORDER."</p>
}

function LampIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <path d="M4 14c0-2 2-4 6-4 5 0 8 2 10 1-1 3-4 5-8 5s-8-1-8-2z" stroke="#e0b34f" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18 9c.5-1.5 1.5-2 1.5-2s.5 1.5-.3 2.6" stroke="#e0b34f" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
function FeatherIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <path d="M19 4c-7 0-13 5-13 13l1 3" stroke="#e0b34f" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 17C10 13 14 9 19 4M8 14l4-1M10 11l4-1M13 8l3-1" stroke="#e0b34f" strokeWidth="1" />
    </svg>
  )
}
function ScarabIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <ellipse cx="12" cy="13" rx="5" ry="6.5" stroke="#e0b34f" strokeWidth="1.5" />
      <path d="M12 6.5V4M8 8L5 5M16 8l3-3M7 13H3M17 13h4M8 18l-3 3M16 18l3 3" stroke="#e0b34f" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="12" y1="7" x2="12" y2="19" stroke="#e0b34f" strokeWidth="1" />
    </svg>
  )
}

function Page({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

/** Egyptian tally strokes for the fragment numbering */
function strokes(n: number) {
  return '𓏺'.repeat(n)
}

export const ninthSealTheme: ThemeManifest = {
  id: 'ninthseal',
  title: 'The Ninth Seal',
  tagline: 'They erased his name from every stone. The tomb kept a copy.',
  synopsis:
    'Egypt, 1936. Your expedition finds a tomb missing from every record — its king unnamed by decree, its door held by nine seals. The sandstorm that traps you inside is the least of your problems: the only way out is to give the dead man his name back.',
  difficulty: 4.5,
  palette: { primary: '#7a5a28', secondary: '#241a08', accent: '#e0b34f', bg: '#120d04', paper: '#efe3c4', ink: '#2a1f0a' },
  coverArt: CoverArt,
  boxClue: BoxClue,

  intro: [
    {
      id: 'intro-1', order: 0, title: 'The Unrecorded Door', body: () => (
        <Page>
          <p>The kings' lists skip a reign. Between two well-fed pharaohs there is a gap the length of a lifetime, and every stele of that lifetime has had its cartouche chiselled blank. Damnatio memoriae — the punishment of being forgotten.</p>
          <p>Your expedition found what the punishment missed: a tomb with nine seals and no name. You were four levels down cataloguing the antechamber when the sandstorm came, and the door you entered by decided it had never existed.</p>
          <p>Above the inner gate, in hieratic: "SPEAK MY NAME AND WALK OUT. FORGET IT, AND STAY TO REMEMBER."</p>
        </Page>
      ),
    },
    {
      id: 'intro-2', order: 1, title: "Expedition Standing Orders", body: () => (
        <Page>
          <p>Everything resolves to a word or number, logged beside its card; the expedition ledger (the Answer Deck) confirms or corrects. Symbols route through the bronze cipher wheel from the antechamber — three rings, and an inscription on its back you should read early.</p>
          <p><strong>Field note, underlined twice:</strong> every broken seal bares a single carved letter with a stroke-count beneath it. Log them. The ninth door will ask for all nine, in stroke order — not in the order you broke them. Revealed ledger pages can be re-read in the Answer Deck at any time.</p>
        </Page>
      ),
    },
  ],

  storyPages: {
    'duat-page': {
      id: 'duat-page', order: 2, title: 'The Map of Below', body: () => (
        <Page>
          <p>DUAT — the world below. The grid on the offering wall was a map the whole time, and this tomb is its legend. Three gates lead deeper, each crowned with carved stars. The night sky in here is architectural.</p>
        </Page>
      ),
    },
    'priest-page': {
      id: 'priest-page', order: 3, title: "The Priest Who Stayed", body: () => (
        <Page>
          <p>Ankhef, lector-priest, sealed himself in with his king rather than unlearn the name. His papyri survive him: verse after verse in ink that only shows itself to lamplight, ordering the sons of Horus like a man laying the table for eternity.</p>
        </Page>
      ),
    },
    'guardian-page': {
      id: 'guardian-page', order: 4, title: 'The Thing at the Door', body: () => (
        <Page>
          <p>The ninth door has a voice. It is polite, patient, and has been asking its riddle for three thousand years. It does not seem worried that you will get it right. That is the most unnerving part.</p>
        </Page>
      ),
    },
  },

  winPage: {
    id: 'win', order: 99, title: 'Spoken',
    body: () => (
      <Page>
        <p>NEFERKARA. The syllables leave your mouth and the tomb inhales — three thousand years of held breath going out of the stones all at once. Nine seals fall in sequence like a slow drumroll, and behind the ninth: stairs, and storm-light, and air.</p>
        <p>On the last step lies a scarab of lapis, placed — not dropped — where you cannot miss it. Payment, perhaps. Or a receipt: one name, returned to its owner, paid in full.</p>
      </Page>
    ),
  },

  startingRed: ['A'],
  finalRedCard: 'J',

  redCards: {
    A: {
      id: 'A', letter: 'A', title: 'What the Sand Kept', symbol: 'compass', inputMode: 'text', difficulty: 2,
      solution: '7',
      entryHint: 'Enter the count the lintel was carved to keep.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            The first seal's lintel is drifted over with three millennia of sand. Your brush is
            gone with the storm — your thumb will have to do. The carving beneath is a tally,
            and above it: "COUNT WHAT THE SAND KEPT. THE SHALLOW SCRATCHES ARE THE MASON'S — THEY KEEP NOTHING."
          </p>
          <RubbingPanel
            prompt=""
            maskColor="#c8b183"
            maskLabel="sand — rub to clear"
            hidden={
              <div style={{ fontSize: '1.7rem', letterSpacing: '0.18em' }}>
                𓏺𓏺𓏺𓏺𓏺𓏺𓏺 <span style={{ opacity: 0.35, fontSize: '1.1rem' }}>𓏺𓏺</span>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.4em' }}>seven deep-cut strokes; two shallow mason's scratches, worn almost away</div>
              </div>
            }
            height={140}
          />
        </div>
      ),
    },
    B: {
      id: 'B', letter: 'B', title: 'The Weighing of Hearts', symbol: 'feather', inputMode: 'text', difficulty: 2,
      solution: 'baboon',
      entryHint: 'Enter the animal on the honest jar\'s lid.',
      component: () => (
        <ScalePanel
          prompt="Four canopic jars wait at the offering table beside a bronze feather — the Feather of Ma'at, truth's own counterweight. The inscription: 'ONLY THE HONEST HEART RISES: LIGHTER THAN TRUTH ITSELF. TAKE ITS JAR AND NOTHING ELSE.'"
          items={[
            { id: 'feather', label: "Feather of Ma'at", weight: 3 },
            { id: 'falcon', label: 'Falcon jar', weight: 5 },
            { id: 'jackal', label: 'Jackal jar', weight: 6 },
            { id: 'baboon', label: 'Baboon jar', weight: 2 },
            { id: 'human', label: 'Human-head jar', weight: 4 },
          ]}
        />
      ),
    },
    C: {
      id: 'C', letter: 'C', title: 'The Offering Wall', symbol: 'eye', inputMode: 'text', difficulty: 3,
      solution: 'duat',
      entryHint: 'Enter the four-letter word the coordinates spell.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            The honest jar holds no organs — only a strip of linen painted with four coordinate
            pairs, row-stroke then column-stroke:
          </p>
          <p className="cipher-text" style={{ textAlign: 'center' }}>
            ( 𓏺𓏺 , 𓏺𓏺𓏺𓏺 ) · ( 𓏺𓏺𓏺𓏺𓏺 , 𓏺 ) · ( 𓏺 , 𓏺𓏺𓏺 ) · ( 𓏺𓏺𓏺 , 𓏺𓏺𓏺𓏺𓏺 )
          </p>
          <GridLookupPanel
            prompt="The offering wall behind the table is carved as a five-by-five grid of Greek trade letters — the tomb was old before it was ever sealed."
            colHeaders={['𓏺', '𓏺𓏺', '𓏺𓏺𓏺', '𓏺𓏺𓏺𓏺', '𓏺𓏺𓏺𓏺𓏺']}
            rowHeaders={['𓏺', '𓏺𓏺', '𓏺𓏺𓏺', '𓏺𓏺𓏺𓏺', '𓏺𓏺𓏺𓏺𓏺']}
            cells={[
              ['K', 'R', 'A', 'M', 'E'],
              ['O', 'S', 'H', 'D', 'B'],
              ['N', 'I', 'P', 'W', 'T'],
              ['F', 'L', 'C', 'G', 'Y'],
              ['U', 'X', 'V', 'Q', 'Z'],
            ]}
            caption="Row first, then column — the linen strip is explicit about that."
          />
        </div>
      ),
    },
    D: {
      id: 'D', letter: 'D', title: 'The Three Gates', symbol: 'moon', inputMode: 'decoder', difficulty: 3,
      solution: '316',
      entryHint: 'The stars above each gate decide its ring. The wheel\'s back knows the rule.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            Three gates lead down from the offering chamber, each crowned with a cipher symbol
            and a band of carved stars — one star over the first, four over the second, seven
            over the third. No inscription orders them. Not on this side of the wheel, anyway.
          </p>
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', padding: '0.6rem 0', alignItems: 'flex-end' }}>
            <span style={{ textAlign: 'center' }}><div style={{ fontSize: '0.8rem' }}>★</div><LockIcon symbol="eye" size={44} /></span>
            <span style={{ textAlign: 'center' }}><div style={{ fontSize: '0.8rem' }}>★★★★</div><LockIcon symbol="moon" size={44} /></span>
            <span style={{ textAlign: 'center' }}><div style={{ fontSize: '0.8rem' }}>★★★★★★★</div><LockIcon symbol="skull" size={44} /></span>
          </div>
        </div>
      ),
    },
    E: {
      id: 'E', letter: 'E', title: 'The Star Ceiling', symbol: 'star', inputMode: 'text', difficulty: 3,
      solution: 'sothis',
      entryHint: 'Enter the name the five brightest spell, brightest first.',
      component: () => (
        <ConstellationPanel
          prompt="The burial-chamber ceiling is a sky: painted stars of every size, each wearing a small trade letter. A verse runs around the cornice: 'SHE RETURNS WHEN THE FLOOD RETURNS. JOIN HER FIVE BRIGHTEST LIGHTS, GREATEST TO LEAST, AND READ HER NAME.'"
          stars={[
            { id: 's1', x: 60, y: 50, size: 7.5, label: 'S' },
            { id: 's2', x: 200, y: 35, size: 6.2, label: 'O' },
            { id: 's3', x: 130, y: 110, size: 5.1, label: 'T' },
            { id: 's4', x: 255, y: 95, size: 4.2, label: 'H' },
            { id: 's5', x: 40, y: 160, size: 3.4, label: 'I' },
            { id: 's6', x: 175, y: 170, size: 3.3, label: 'S' },
            { id: 'd1', x: 100, y: 30, size: 2, label: 'A' },
            { id: 'd2', x: 290, y: 40, size: 2.2, label: 'R' },
            { id: 'd3', x: 230, y: 150, size: 1.8, label: 'M' },
            { id: 'd4', x: 90, y: 190, size: 1.5, label: 'K' },
          ]}
        />
      ),
    },
    F: {
      id: 'F', letter: 'F', title: "The Priest's Papyrus", symbol: 'flame', inputMode: 'text', difficulty: 3,
      solution: 'ankhef',
      entryHint: 'Enter the name signed at the bottom of the hidden verses.',
      component: ({ inventory }) => (
        <LensPanel
          prompt="A papyrus roll lies across the priest's cot, blank as bone. The dead do not write for daylight — this ink answers only to flame."
          lensLabel="Hold the papyrus to the oil lamp"
          tint="rgba(224, 140, 40, 0.22)"
          requiresItem={{ id: 'oil_lamp', hint: 'You need living flame. One of the gates below should yield a lamp — keep going.' }}
          inventory={inventory}
          base={<p style={{ opacity: 0.6, fontStyle: 'italic' }}>…the papyrus stays blank, and somehow smug about it…</p>}
          hidden={
            <div style={{ fontSize: '0.92rem', lineHeight: 1.7, textAlign: 'center' }}>
              "THE LEAF DRINKS FIRST.<br />
              THE WAVE FOLLOWS AFTER.<br />
              THE FEATHER IS ALWAYS LAST TO SETTLE."<br />
              <span style={{ fontFamily: "'Cinzel', serif", fontSize: '1.25rem', display: 'inline-block', marginTop: '0.5em' }}>— ANKHEF, who stayed</span>
            </div>
          }
        />
      ),
    },
    G: {
      id: 'G', letter: 'G', title: "The Priest's Knot", symbol: 'key', inputMode: 'text', difficulty: 3,
      solution: 'west',
      entryHint: 'Enter the direction the dead — and you — must walk.',
      component: () => (
        <TearPanel
          prompt="The passage past the priest's cell is closed by a cord of linen, knotted and sealed in wax — the old sign meaning 'a priest stands behind this'. There is no priest left to object. There is only the knot, and what tearing it costs you."
          tearLabel="Break the priest's knot"
          intact={
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', margin: '0.2em 0' }}>𓋹</p>
              <p style={{ fontStyle: 'italic', opacity: 0.8, margin: 0 }}>The wax bears Ankhef's seal. Unbroken for three thousand years.</p>
            </div>
          }
          revealed={
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: '1.1rem' }}>
              Inside the knot, a sliver of papyrus:<br />
              "THE SUN DIES IN THE WEST. THE DEAD WALK WEST. WALK WITH THEM."
            </div>
          }
        />
      ),
    },
    H: {
      id: 'H', letter: 'H', title: 'The Sons of Horus', symbol: 'wave', inputMode: 'decoder', difficulty: 3,
      solution: '590',
      entryHint: 'Three symbols on the door; their order is in a dead man\'s verses.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            The western passage ends at a bronze door bearing three cipher symbols in a ring —
            a leaf, a wave, a feather — with no order carved anywhere on it. Ankhef's papyri
            were not idle poetry. Priests never wrote anything down twice.
          </p>
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', padding: '0.6rem 0' }}>
            <LockIcon symbol="leaf" size={44} />
            <LockIcon symbol="wave" size={44} />
            <LockIcon symbol="feather" size={44} />
          </div>
        </div>
      ),
    },
    I: {
      id: 'I', letter: 'I', title: 'The Guardian', symbol: 'skull', inputMode: 'text', difficulty: 3,
      solution: 'shadow',
      entryHint: 'One word. The guardian is patient.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            The voice behind the ninth door speaks Middle Egyptian, then Greek, then — resignedly —
            your own tongue:
          </p>
          <div className="cipher-text" style={{ fontStyle: 'italic', lineHeight: 1.7 }}>
            "At dawn I am long, and I walk to the west.<br />
            At noon I hide beneath your feet.<br />
            At dusk I am long, and I walk to the east.<br />
            In the dark I am everyone's twin, and no one's.<br />
            The sun makes me and cannot keep me.<br />
            What am I?"
          </div>
        </div>
      ),
    },
    J: {
      id: 'J', letter: 'J', title: 'The Ninth Seal', symbol: 'gear', inputMode: 'text', difficulty: 3,
      solution: 'neferkara',
      entryHint: 'Nine letters, in stroke order. The Answer Deck remembers every seal you broke.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            The ninth door has no lock at all — only a blank cartouche and a chisel on a chain,
            and above them: "NINE SEALS BARED NINE LETTERS, EACH WITH ITS COUNT. CARVE THE NAME
            IN THE ORDER OF THE STROKES, NOT THE ORDER OF YOUR COMING. THE TOMB REMEMBERS.
            SO SHOULD YOU."
          </p>
          <p className="symbol-tally">
            Every seal you broke (every solved answer card) ended with a carved letter and a
            stroke-count. Re-read them in the Answer Deck — then assemble the name, stroke 𓏺
            through stroke {strokes(9)}.
          </p>
        </div>
      ),
    },
  },

  blueCards: {
    '7': { id: '7', outcome: 'advance', narrative: `Seven true strokes — the mason's scratches kept nothing, as promised. The first seal cracks, baring a carved letter: R — beneath it, ${strokes(8)} (eight strokes).`, unlocksRed: ['B'] },
    baboon: { id: 'baboon', outcome: 'advance', narrative: `The baboon jar rises against the feather — the one honest heart in the room. The second seal cracks, baring a carved letter: E — beneath it, ${strokes(4)} (four strokes).`, unlocksRed: ['C'], grantsObjects: ['feather_maat'] },
    duat: { id: 'duat', outcome: 'advance', narrative: `DUAT. The offering wall was a map of the world below, and now you hold its legend. The third seal cracks, baring a carved letter: A — beneath it, ${strokes(7)} (seven strokes). Three gates lead down.`, unlocksRed: ['D', 'E'], unlocksBooklet: ['duat-page'] },
    '316': { id: '316', outcome: 'advance', narrative: `Three-one-six — the night deepening, gate by gate, exactly as the wheel's back orders. The fourth seal cracks, baring a carved letter: E — beneath it, ${strokes(2)} (two strokes). Behind the gates: the priest's cell, and his oil lamp, still full.`, unlocksRed: ['F'], grantsObjects: ['oil_lamp'] },
    sothis: { id: 'sothis', outcome: 'advance', narrative: `SOTHIS — the flood-bringer, brightest first, just as the cornice sang. The fifth seal cracks, baring a carved letter: F — beneath it, ${strokes(3)} (three strokes).`, unlocksRed: ['F'] },
    ankhef: { id: 'ankhef', outcome: 'advance', narrative: `ANKHEF — the priest who stayed. His verses about leaf, wave and feather feel less like poetry every time you read them. The sixth seal cracks, baring a carved letter: K — beneath it, ${strokes(6)} (six strokes).`, unlocksRed: ['G'], unlocksBooklet: ['priest-page'] },
    west: { id: 'west', outcome: 'advance', narrative: `WEST — with the dying sun and the walking dead. The knot is broken and cannot be re-tied; some doors only open one way. The seventh seal cracks, baring a carved letter: N — beneath it, ${strokes(1)} (one stroke).`, unlocksRed: ['H'], grantsObjects: ['scarab_amulet'] },
    '590': { id: '590', outcome: 'advance', narrative: `Five-nine-zero: leaf drinks first, wave follows, feather settles last — Ankhef wrote the combination into his own funeral verses. The eighth seal cracks, baring a carved letter: A — beneath it, ${strokes(9)} (nine strokes).`, unlocksRed: ['I'] },
    shadow: { id: 'shadow', outcome: 'advance', narrative: `"SHADOW," you say, and the guardian sighs like a tutor whose worst student finally passed. The final approach opens. In passing it murmurs the last gift: a carved letter, R — beneath it, ${strokes(5)} (five strokes).`, unlocksRed: ['J'], unlocksBooklet: ['guardian-page'] },
    neferkara: { id: 'neferkara', outcome: 'win', narrative: 'The chisel bites nine times. The cartouche is blank no longer.' },
    '9': { id: '9', outcome: 'decoy', narrative: 'Nine counts the mason\'s shallow scratches too. The lintel warned you about those — the sand did not keep them.' },
    falcon: { id: 'falcon', outcome: 'decoy', narrative: 'The falcon jar sinks the pan outright. An honest heart rises against the feather — weigh again.' },
    neferkare: { id: 'neferkare', outcome: 'decoy', narrative: 'Close — agonizingly close. But the ninth-stroke letter was carved, not guessed. Re-read the seal that bore nine strokes.' },
    osiris: { id: 'osiris', outcome: 'decoy', narrative: 'The guardian is politely amused. "He is not buried here, and his name was never in danger of being forgotten. Try the strokes."' },
    '000': { id: '000', outcome: 'decoy', narrative: 'The ledger returns a page of pure sand. Somewhere, three thousand years away, a scribe shakes his head.' },
  },

  greenCards: {
    compass: { id: 'compass', symbol: 'compass', hints: [
      'Rub the whole lintel clear before counting anything.',
      'Deep-cut strokes are the tally; the faint, shallow scratches are the mason\'s and "keep nothing."',
      'Seven deep strokes: the answer is 7.',
    ] },
    feather: { id: 'feather', symbol: 'feather', hints: [
      'The feather is not one of the candidates — it is the measuring stick. Weigh jars AGAINST it.',
      'Put the feather on one pan and a jar on the other. Only one jar makes the feather sink.',
      'The baboon jar is lighter than the feather: the answer is BABOON.',
    ] },
    eye: { id: 'eye', symbol: 'eye', hints: [
      'The linen strip gives coordinate pairs in tally strokes: row first, then column.',
      'Count strokes carefully: (2,4), (5,1), (1,3), (3,5).',
      'Row 2 col 4 = D, row 5 col 1 = U, row 1 col 3 = A, row 3 col 5 = T: the word is DUAT.',
    ] },
    moon: { id: 'moon', symbol: 'moon', hints: [
      'The gates differ only in their star counts — and the cipher wheel has a back.',
      'The wheel\'s reverse: "Enter as the night deepens." Fewest stars stands at the threshold — the outer ring.',
      'Set outer=eye (1 star), middle=moon (4), inner=skull (7). The windows read 316.',
    ] },
    star: { id: 'star', symbol: 'star', hints: [
      'Size is brightness. Ignore the letters on the small stars entirely.',
      'The five largest, in shrinking order, carry the letters S, O, T, H, I… and one more S.',
      'Brightest to least spells SOTHIS.',
    ] },
    flame: { id: 'flame', symbol: 'flame', hints: [
      'The papyrus wants flame, and the tomb has exactly one lamp — behind the three gates.',
      'With the oil lamp held close, verses appear about leaf, wave and feather… signed by their author.',
      'The signature reads ANKHEF.',
    ] },
    key: { id: 'key', symbol: 'key', hints: [
      'The knot must be broken to be read. There is no gentle way; that is the point.',
      'Inside the knot, a sliver of papyrus talks about the sun, the dead, and a direction.',
      'The answer is WEST.',
    ] },
    wave: { id: 'wave', symbol: 'wave', hints: [
      'The door gives symbols but no order. A priest already wrote the order down — in fire-ink.',
      'Ankhef\'s verses: the leaf drinks FIRST, the wave FOLLOWS, the feather is LAST to settle.',
      'Set outer=leaf, middle=wave, inner=feather. The windows read 590.',
    ] },
    skull: { id: 'skull', symbol: 'skull', hints: [
      'Follow the riddle through one full day: long at dawn, gone at noon, long again at dusk.',
      'It is made by the sun, walks opposite the sun, and doubles every person in the dark of the tomb.',
      'The answer is SHADOW.',
    ] },
    gear: { id: 'gear', symbol: 'gear', hints: [
      'Every solved answer card ended with "a carved letter … beneath it, N strokes." Re-open the Answer Deck and re-read your solved cards.',
      'Sort the nine letters by their stroke counts, 1 to 9: N(1), E(2), F(3), E(4), R(5), K(6)… keep going.',
      'Stroke order 1→9 gives N-E-F-E-R-K-A-R-A: the name is NEFERKARA.',
    ] },
  },

  objects: {
    feather_maat: { id: 'feather_maat', name: "Feather of Ma'at", description: 'A bronze feather, heavier than any real one and lighter than most consciences. Truth\'s own counterweight.', icon: FeatherIcon },
    oil_lamp: { id: 'oil_lamp', name: 'Oil Lamp', description: "The priest's oil lamp, wick trimmed three thousand years ago and still willing. Some inks only answer to its flame.", icon: LampIcon },
    scarab_amulet: { id: 'scarab_amulet', name: 'Scarab Amulet', description: 'A lapis scarab from inside the priest\'s knot. It is facing west. It is always, somehow, facing west.', icon: ScarabIcon },
  },

  decoder: {
    rings: [
      { segments: [
        { symbol: 'eye', digit: 3 }, { symbol: 'leaf', digit: 5 }, { symbol: 'moon', digit: 8 }, { symbol: 'wave', digit: 1 },
        { symbol: 'skull', digit: 6 }, { symbol: 'feather', digit: 2 }, { symbol: 'star', digit: 9 }, { symbol: 'flame', digit: 0 },
      ] },
      { segments: [
        { symbol: 'moon', digit: 1 }, { symbol: 'wave', digit: 9 }, { symbol: 'eye', digit: 4 }, { symbol: 'feather', digit: 6 },
        { symbol: 'leaf', digit: 2 }, { symbol: 'skull', digit: 7 }, { symbol: 'star', digit: 0 }, { symbol: 'flame', digit: 8 },
      ] },
      { segments: [
        { symbol: 'skull', digit: 6 }, { symbol: 'feather', digit: 0 }, { symbol: 'moon', digit: 3 }, { symbol: 'leaf', digit: 9 },
        { symbol: 'wave', digit: 5 }, { symbol: 'eye', digit: 1 }, { symbol: 'star', digit: 4 }, { symbol: 'flame', digit: 7 },
      ] },
    ],
    backClue: () => (
      <div>
        <h3 className="display-font">Inscribed on the wheel's back</h3>
        <p>"ENTER AS THE NIGHT DEEPENS: THE FEWEST STARS STAND AT THE THRESHOLD, THE MOST AT THE HEART."</p>
        <p style={{ opacity: 0.7, fontStyle: 'italic' }}>— and below, smaller, in a different, older hand: "he was kind. remember that instead."</p>
      </div>
    ),
  },

  music: { baseFreq: 98, scale: [0, 1, 4, 5, 7, 8, 11], waveform: 'triangle', tempoMs: 3600, filterFreq: 550, mood: 'ancient' },
}
