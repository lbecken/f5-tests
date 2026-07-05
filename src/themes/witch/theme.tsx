import type { ReactNode } from 'react'
import type { ThemeManifest } from '../../engine/types'
import {
  CipherPanel, SymbolCounter, MirrorPanel, MorsePanel, LogicGridPanel,
  LensPanel, RubbingPanel,
} from '../../engine/puzzles'
import { LockIcon } from '../../engine/icons'

function CoverArt() {
  return (
    <svg viewBox="0 0 200 160" width="100%" height="100%">
      <path d="M100 30a35 35 0 100 70 28 28 0 010-70z" fill="#b98cce" opacity="0.85" />
      {Array.from({ length: 40 }).map((_, i) => {
        const x = (i * 37) % 200
        const y = (i * 53) % 60
        return <circle key={i} cx={x} cy={y} r={0.9} fill="#f0e6da" opacity={0.6} />
      })}
      <path d="M60 140c10-30 70-30 80 0" stroke="#7fbf7f" strokeWidth="3" fill="none" opacity="0.7" />
    </svg>
  )
}

function BoxClue() {
  return <p>Scratched into the underside in a spidery hand: "The last grain falls at midnight. Count carefully — I always did. And mind the wilted ones; they never counted for anything."</p>
}

function FeatherObjectIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <path d="M20 4c-8 0-14 6-14 14l14-14z" stroke="#b98cce" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 18l11-11M9 15l3-3M12 12l3-3" stroke="#b98cce" strokeWidth="1" />
    </svg>
  )
}
function ThimbleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <path d="M7 12a5 5 0 0110 0v8H7z" stroke="#b98cce" strokeWidth="1.6" />
      <line x1="9" y1="10" x2="9.4" y2="10" stroke="#b98cce" strokeWidth="1.2" />
      <line x1="12" y1="9" x2="12.4" y2="9" stroke="#b98cce" strokeWidth="1.2" />
      <line x1="15" y1="10" x2="15.4" y2="10" stroke="#b98cce" strokeWidth="1.2" />
    </svg>
  )
}
function LocketIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <circle cx="12" cy="14" r="6.5" stroke="#b98cce" strokeWidth="1.6" />
      <path d="M9 8c0-3 6-3 6 0" stroke="#b98cce" strokeWidth="1.6" />
    </svg>
  )
}

/* Elder-futhark-flavored glyphs for the lintel runes */
const RUNE: Record<string, string> = { A: 'ᚨ', S: 'ᛋ', H: 'ᚻ', W: 'ᚹ', O: 'ᛟ', D: 'ᛞ' }

function Page({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

const PHASE_ORDER = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘']

export const witchTheme: ThemeManifest = {
  id: 'witch',
  title: "The Witch's Hourglass",
  tagline: 'A storm, a cottage, and a curse that counts down in sand.',
  synopsis:
    'Caught in a storm, you shelter in the cottage of Morrigan Ashwood — vanished, cursed, and very particular about how her secrets are found.',
  difficulty: 3,
  palette: { primary: '#3d2b56', secondary: '#1a1226', accent: '#b98cce', bg: '#0d0714', paper: '#f0e6da', ink: '#241a30' },
  coverArt: CoverArt,
  boxClue: BoxClue,

  intro: [
    {
      id: 'intro-1', order: 0, title: 'Shelter From the Storm', body: () => (
        <Page>
          <p>The storm drove you off the forest path and into the one cottage for miles — dark windows, herbs drying in bunches, a hearth gone cold. The moment the door shut behind you, it would not open again.</p>
          <p>On the mantle, an hourglass turns itself over, unprompted. Its sand is running out. A note in a spidery hand rests beside it: "Whoever finds this has already agreed to finish what I started." The old stories call this place the Ashwood cottage, after the witch who built it.</p>
        </Page>
      ),
    },
    {
      id: 'intro-2', order: 1, title: "The Cottage's Rules", body: () => (
        <Page>
          <p>Everything here answers to a word or a number, once puzzled out — write it beside whatever asked, and the cottage confirms you're right and shows you where to look next. Wrong-but-tempting answers sometimes get their own scolding page. The cottage enjoys those.</p>
          <p>Sigil-answers route through the brass amulet on the mantle — three turning rings. The amulet has two faces, and Morrigan engraved both for a reason. So did whoever scratched words into the underside of the box this game came in.</p>
          <p>Three tiers of Morrigan's marginalia wait under each puzzle's symbol, if you're well and truly stuck.</p>
        </Page>
      ),
    },
  ],

  storyPages: {
    'name-found': { id: 'name-found', order: 2, title: 'A Name in the Wax', body: () => <Page><p>ASHWOOD. The wards on this cottage all answer to the family name. Carved into a candle stub on the mantle, half-melted, you also find a first initial: "M."</p></Page> },
    'sigils-found': { id: 'sigils-found', order: 3, title: 'The Spellbook Clasp', body: () => <Page><p>The spellbook's clasp bears three tiny sigils — a moon, a leaf, a flame — worn shiny by a thumb that opened it a thousand times. In what order did that thumb press them? The amulet on the mantle has two faces, and you've only been reading one.</p></Page> },
    'midnight-found': { id: 'midnight-found', order: 4, title: 'What Waits at Midnight', body: () => <Page><p>The hourglass is nearly empty. Whatever Morrigan meant to finish ends behind the cellar door — and its ward wants a second verse you have already carried past a hundred times.</p></Page> },
  },

  winPage: {
    id: 'win', order: 99, title: 'The Last Grain',
    body: () => (
      <Page>
        <p>The final sigil clicks into place just as the hourglass's last grain of sand falls. The cottage door — sealed since the moment you entered — swings open on its own, releasing a breath of warm air that smells like rosemary and rain.</p>
        <p>On the wind, or perhaps just in your head, a voice that can only be Morrigan's says: "Well done. Do shut the door on your way out — the curse only needed a witness, not a guest."</p>
      </Page>
    ),
  },

  startingRed: ['A'],
  finalRedCard: 'I',

  redCards: {
    A: {
      id: 'A', letter: 'A', title: 'The Warded Threshold', symbol: 'moon', inputMode: 'text', difficulty: 2,
      solution: 'ashwood',
      entryHint: 'Enter the family name the wards answer to.',
      component: () => (
        <CipherPanel
          prompt="Seven runes are carved above the door lintel. A key was scratched into the doorframe below — but a century of weather has eaten two of its entries clean away. The old stories about who built this cottage may have to fill the gaps."
          cipherText={`${RUNE.A} ${RUNE.S} ${RUNE.H} ${RUNE.W} ${RUNE.O} ${RUNE.O} ${RUNE.D}`}
          keyMap={{ [RUNE.S]: 'S', [RUNE.H]: 'H', [RUNE.W]: 'W', [RUNE.O]: 'O', [RUNE.A]: '▨ weathered', [RUNE.D]: '▨ weathered' }}
        />
      ),
    },
    B: {
      id: 'B', letter: 'B', title: 'The Drying Herbs', symbol: 'leaf', inputMode: 'text', difficulty: 2,
      solution: '9',
      entryHint: 'Enter the number of sprigs with any power left in them.',
      component: () => (
        <SymbolCounter
          prompt="Bundles hang from every beam: common rosemary, and — darker, jagged-leaved — nightshade. The recipe wants nightshade. The box this game came in had an opinion about which sprigs count."
          targetGlyph="🌿"
          cells={[
            '🌾','🌿','🌾',{ glyph: '🌿', dim: true },'🌿','🌾',
            '🌿','🌾','🌾','🌿','🌾','🌿',
            { glyph: '🌿', dim: true },'🌾','🌿','🌾','🌿','🌾',
            '🌿',{ glyph: '🌿', dim: true },'🌿','🌾','🌾','🌾',
          ]}
          fine="Some of the nightshade has wilted grey and papery. The wilted ones… where did you read something about wilted ones?"
        />
      ),
    },
    C: {
      id: 'C', letter: 'C', title: "The Cauldron's Measure", symbol: 'flame', inputMode: 'text', difficulty: 2,
      solution: '21',
      entryHint: 'Enter the eighth measure, in drops.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            Seven jars circle the cauldron's rim, each labeled with its measure in drops —
            1, 1, 2, 3, 5, 8 — but the seventh jar's label is buried under years of soot,
            and the recipe scrawled above them demands <em>the eighth measure</em>. There is no
            eighth jar.
          </p>
          <RubbingPanel
            prompt=""
            maskColor="#2b241c"
            maskLabel="soot — rub to clear"
            hidden={<span style={{ fontFamily: "'Cinzel', serif", fontSize: '2.2rem' }}>13</span>}
            height={120}
          />
        </div>
      ),
    },
    D: {
      id: 'D', letter: 'D', title: "The Spellbook's Clasp", symbol: 'eye', inputMode: 'decoder', difficulty: 2,
      solution: '454',
      entryHint: 'The clasp names three sigils. Only the amulet knows their order — and not on the face you dial.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            The spellbook's brass clasp bears three worn sigils, arranged in a triangle with no
            beginning: a crescent moon, a leaf, a small flame. Nothing on the book says which
            comes first. Morrigan engraved her amulet on both faces for a reason.
          </p>
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', padding: '0.6rem 0' }}>
            <LockIcon symbol="moon" size={44} />
            <LockIcon symbol="leaf" size={44} />
            <LockIcon symbol="flame" size={44} />
          </div>
        </div>
      ),
    },
    E: {
      id: 'E', letter: 'E', title: 'The Scrying Glass', symbol: 'skull', inputMode: 'text', difficulty: 2,
      solution: 'morrigan',
      entryHint: 'Enter the name her mother gave her.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            A tarnished scrying mirror hangs above the washbasin, and etched across its face —
            backwards, as scrying mirrors insist — are two names. The basin's rim is blunt about
            it: "SPEAK THE NAME HER MOTHER GAVE HER."
          </p>
          <MirrorPanel prompt="" mirroredText="DOOWHSA · NAGIRROM" />
        </div>
      ),
    },
    F: {
      id: 'F', letter: 'F', title: 'Five Bottled Potions', symbol: 'feather', inputMode: 'text', difficulty: 3,
      solution: 'amber',
      entryHint: 'Enter the color of the cursed bottle.',
      component: () => (
        <LogicGridPanel
          prompt="Five unlabeled bottles on the shelf, one of them the bottled curse itself. Morrigan's margin notes survive:"
          clues={[
            'Only two of the five catch the firelight strangely: the amber one and the violet one.',
            'The cursed potion catches the firelight.',
            'The violet bottle wears years of undisturbed dust. The curse was bottled this season.',
            'The blue bottle smells of lavender, the green of mint, the clear of nothing at all — the curse has no scent to hide.',
          ]}
          rows={['Clear', 'Green', 'Blue', 'Violet', 'Amber']}
          cols={['Firelight', 'Dusty', 'Scented', 'Cursed']}
        />
      ),
    },
    G: {
      id: 'G', letter: 'G', title: "The Raven's Tapping", symbol: 'key', inputMode: 'text', difficulty: 2,
      solution: 'raven',
      entryHint: 'Enter what the bird is actually saying.',
      component: () => (
        <MorsePanel
          prompt="A raven at the windowsill taps the glass in a pattern that repeats and repeats. Under the sill, carved small: 'SHE TAUGHT IT TO SPEAK THE WAY MIRRORS DO.'"
          message="NEVAR"
        />
      ),
    },
    H: {
      id: 'H', letter: 'H', title: 'The Star Chart', symbol: 'star', inputMode: 'text', difficulty: 3,
      solution: 'midnight',
      entryHint: 'Enter the word, read as the moon walks its month.',
      component: ({ inventory }) => (
        <LensPanel
          prompt="A star chart is pinned open on the table, seemingly unfinished — great gaps between the constellations. The margin reads: 'MOONLIGHT CAUGHT IN SILVER SHOWS THE REST. READ AS THE MOON WALKS: NEW, WAXING, FULL, WANING.'"
          lensLabel="Catch the moonlight in the silver locket"
          tint="rgba(150, 160, 255, 0.22)"
          requiresItem={{ id: 'silver_locket', hint: 'You need moonlight caught in silver. Somewhere in this cottage there is something silver worth opening.' }}
          inventory={inventory}
          base={<p style={{ opacity: 0.6, fontStyle: 'italic' }}>…the chart's gaps stay stubbornly dark…</p>}
          hidden={
            <div style={{ display: 'flex', gap: '1.05rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', fontFamily: "'Cinzel', serif", fontSize: '1.3rem' }}>
              <span>G<small style={{ display: 'block', fontSize: '0.6rem' }}>{PHASE_ORDER[5]}</small></span>
              <span>M<small style={{ display: 'block', fontSize: '0.6rem' }}>{PHASE_ORDER[0]}</small></span>
              <span>T<small style={{ display: 'block', fontSize: '0.6rem' }}>{PHASE_ORDER[7]}</small></span>
              <span>D<small style={{ display: 'block', fontSize: '0.6rem' }}>{PHASE_ORDER[2]}</small></span>
              <span>N<small style={{ display: 'block', fontSize: '0.6rem' }}>{PHASE_ORDER[3]}</small></span>
              <span>I<small style={{ display: 'block', fontSize: '0.6rem' }}>{PHASE_ORDER[1]}</small></span>
              <span>H<small style={{ display: 'block', fontSize: '0.6rem' }}>{PHASE_ORDER[6]}</small></span>
              <span>I<small style={{ display: 'block', fontSize: '0.6rem' }}>{PHASE_ORDER[4]}</small></span>
            </div>
          }
        />
      ),
    },
    I: {
      id: 'I', letter: 'I', title: 'The Cellar Ward', symbol: 'clock', inputMode: 'decoder', difficulty: 3,
      solution: '695',
      entryHint: 'The ward names its sigils. The amulet already told you their order — the second verse.',
      component: () => (
        <div className="puzzle-widget">
          <p className="puzzle-prompt">
            The cellar door, until now just a shadow in the corner, is suddenly very much a door.
            Its ward bears three sigils in a ring — a star, a feather, a key — and a single line
            of Morrigan's hand: "YOU HAVE CARRIED MY VERSES ALL NIGHT. THE SECOND ONE IS YOURS."
          </p>
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', padding: '0.6rem 0' }}>
            <LockIcon symbol="star" size={44} />
            <LockIcon symbol="feather" size={44} />
            <LockIcon symbol="key" size={44} />
          </div>
        </div>
      ),
    },
  },

  blueCards: {
    ashwood: { id: 'ashwood', outcome: 'advance', narrative: 'ASHWOOD — the weathered runes could only ever have spelled the name the whole forest knows. The candle gutters and a drawer beneath the mantle slides open, full of drying herbs.', unlocksRed: ['B'], unlocksBooklet: ['name-found'] },
    '9': { id: '9', outcome: 'advance', narrative: 'Nine sprigs still holding their power — the wilted ones never counted, just as the box warned. The cauldron begins to simmer by itself, a recipe rising in curling script.', unlocksRed: ['C', 'D'] },
    '21': { id: '21', outcome: 'advance', narrative: 'Twenty-one drops — thirteen under the soot, plus eight, the way this recipe has always grown. The spellbook springs open to a page about scrying and clasps.', unlocksRed: ['D'] },
    '454': { id: '454', outcome: 'advance', narrative: 'Four-five-four — moon, then leaf, then flame, exactly as the amulet\'s far face has been whispering all night. The scrying mirror clears of tarnish, and five unlabeled bottles catch the firelight.', unlocksRed: ['E', 'F'], grantsObjects: ['brass_thimble'], unlocksBooklet: ['sigils-found'] },
    morrigan: { id: 'morrigan', outcome: 'advance', narrative: 'MORRIGAN — the name her mother gave her; Ashwood came from the forest. Something rustles at the windowsill — a raven, watching. On the basin\'s edge lies a silver locket you\'d swear wasn\'t there before.', unlocksRed: ['G'], grantsObjects: ['silver_locket'] },
    amber: { id: 'amber', outcome: 'advance', narrative: 'The amber bottle — fresh, scentless, and drinking the firelight. Corked tight, it rattles once and goes still. A star chart unrolls itself across the table.', unlocksRed: ['H'], grantsObjects: ['raven_feather'] },
    raven: { id: 'raven', outcome: 'advance', narrative: 'RAVEN — the bird was tapping its own name, mirror-wise, the way she taught it. It caws once, almost approvingly, and the star chart on the table stops curling at the edges.', unlocksRed: ['H'] },
    midnight: { id: 'midnight', outcome: 'advance', narrative: 'MIDNIGHT — new moon to full and out the other side. Of course. The last grain falls at midnight; the box told you that before you ever opened it. The cellar door is waiting.', unlocksRed: ['I'], unlocksBooklet: ['midnight-found'] },
    '695': { id: '695', outcome: 'win', narrative: 'Six-nine-five. Star, then feather, then key — her second verse, carried all night on the amulet\'s back. The last ward breaks.' },
    '12': { id: '12', outcome: 'decoy', narrative: 'The cottage rustles disapprovingly. Twelve counts the wilted grey sprigs too — and Morrigan was very clear about those, somewhere you may not have looked yet.' },
    '13': { id: '13', outcome: 'decoy', narrative: 'Thirteen is the SEVENTH measure — the one under the soot. The recipe demands the eighth, and this recipe grows the way it always has.' },
    nevar: { id: 'nevar', outcome: 'decoy', narrative: 'The raven cackles at you. You wrote down exactly what it tapped — but she taught it to speak the way mirrors do.' },
    '666': { id: '666', outcome: 'decoy', narrative: 'The cottage seems almost offended. A page flutters shut in what can only be described as a huff. Not that one.' },
    '000': { id: '000', outcome: 'decoy', narrative: 'Nothing happens at all, which is somehow worse than something happening. Try again.' },
  },

  greenCards: {
    moon: { id: 'moon', symbol: 'moon', hints: [
      'Two runes in the key are weathered beyond reading — but the intro pages told you whose cottage this is.',
      'The readable runes give ▨-S-H-W-O-O-▨. The stories name the witch of this wood.',
      'The family name is ASHWOOD.',
    ] },
    leaf: { id: 'leaf', symbol: 'leaf', hints: [
      'Rosemary doesn\'t count, and neither does everything that is nightshade. Something outside the cottage — before you even began — warned you about part of this bundle.',
      'The box underside: "mind the wilted ones; they never counted for anything." Count only the fresh, dark nightshade sprigs.',
      'There are 9 fresh nightshade sprigs.',
    ] },
    flame: { id: 'flame', symbol: 'flame', hints: [
      'Two problems: the sooted label, and the missing eighth jar. Solve the soot with your fingers.',
      'Rub the soot away: the seventh measure is 13. Now look at how each measure relates to the two before it (1, 1, 2, 3, 5, 8, 13…).',
      'The eighth measure is 8 + 13 = 21.',
    ] },
    eye: { id: 'eye', symbol: 'eye', hints: [
      'The clasp gives you the sigils but never the order. Morrigan engraved BOTH faces of the amulet.',
      'Turn the decoder over. Its back speaks of the wheel of the year: "Moon, then leaf, then flame…"',
      'Set outer=moon, middle=leaf, inner=flame. The windows read 454.',
    ] },
    skull: { id: 'skull', symbol: 'skull', hints: [
      'Two names hide in the glass, and the basin is fussy about which one it wants.',
      'Mirrored, the etching reads MORRIGAN · ASHWOOD. Her mother gave her the first — the forest gave her the second.',
      'The answer is MORRIGAN.',
    ] },
    feather: { id: 'feather', symbol: 'feather', hints: [
      'Start with the firelight clue — it narrows five bottles to two.',
      'Amber and violet catch the firelight; the cursed one does too. But the violet is dusty with years, and the curse is fresh this season.',
      'The cursed bottle is AMBER.',
    ] },
    key: { id: 'key', symbol: 'key', hints: [
      'Decode the taps first. If the word looks almost right, re-read the carving under the sill.',
      'The taps spell N-E-V-A-R — and she taught the bird to speak the way mirrors do.',
      'NEVAR reversed is RAVEN.',
    ] },
    star: { id: 'star', symbol: 'star', hints: [
      'The chart wants moonlight caught in silver — something silver came to you at the washbasin.',
      'With the locket, eight letters appear, each under a moon phase. Read them in the moon\'s own order: new 🌑, waxing 🌒🌓🌔, full 🌕, waning 🌖🌗🌘.',
      'In lunar order the letters read M-I-D-N-I-G-H-T.',
    ] },
    clock: { id: 'clock', symbol: 'clock', hints: [
      'The ward\'s three sigils need an order, and Morrigan says you\'ve been carrying her verses all night.',
      'The amulet\'s back has two verses. The first opened the spellbook. The second: "star, then feather, then key."',
      'Set outer=star, middle=feather, inner=key. The windows read 695.',
    ] },
  },

  objects: {
    brass_thimble: { id: 'brass_thimble', name: 'Brass Thimble', description: "A tarnished thimble from Morrigan's sewing kit. It hums faintly when held near the spellbook.", icon: ThimbleIcon },
    silver_locket: { id: 'silver_locket', name: 'Silver Locket', description: 'A silver locket engraved with a raven in flight. Its polished inner face catches any light you show it — even moonlight.', icon: LocketIcon },
    raven_feather: { id: 'raven_feather', name: 'Raven Feather', description: 'A single black feather, still warm. It fell from nowhere in particular.', icon: FeatherObjectIcon },
  },

  decoder: {
    rings: [
      { segments: [
        { symbol: 'moon', digit: 4 }, { symbol: 'leaf', digit: 7 }, { symbol: 'flame', digit: 2 }, { symbol: 'eye', digit: 9 },
        { symbol: 'skull', digit: 0 }, { symbol: 'star', digit: 6 }, { symbol: 'feather', digit: 3 }, { symbol: 'key', digit: 8 },
      ] },
      { segments: [
        { symbol: 'moon', digit: 1 }, { symbol: 'leaf', digit: 5 }, { symbol: 'flame', digit: 8 }, { symbol: 'eye', digit: 3 },
        { symbol: 'skull', digit: 6 }, { symbol: 'star', digit: 0 }, { symbol: 'feather', digit: 9 }, { symbol: 'key', digit: 2 },
      ] },
      { segments: [
        { symbol: 'moon', digit: 7 }, { symbol: 'leaf', digit: 0 }, { symbol: 'flame', digit: 4 }, { symbol: 'eye', digit: 6 },
        { symbol: 'skull', digit: 1 }, { symbol: 'star', digit: 3 }, { symbol: 'feather', digit: 8 }, { symbol: 'key', digit: 5 },
      ] },
    ],
    backClue: () => (
      <div>
        <h3 className="display-font">Engraved along the amulet's rim, in two verses</h3>
        <p>"Moon, then leaf, then flame — so turns the young year."</p>
        <p>"Star, then feather, then key — so the old year is put to bed."</p>
        <p style={{ opacity: 0.7, fontStyle: 'italic' }}>— M. Ashwood</p>
      </div>
    ),
  },

  music: { baseFreq: 196, scale: [0, 2, 3, 5, 7, 8, 11], waveform: 'triangle', tempoMs: 3000, filterFreq: 700, mood: 'eerie' },
}
