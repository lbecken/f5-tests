import type { ReactNode } from 'react'
import type { ThemeManifest } from '../../engine/types'
import { CipherPanel, SymbolCounter, SequencePanel, MirrorPanel, LogicGridPanel, MorsePanel, OverlayPanel } from '../../engine/puzzles'

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
  return <p>Scratched into the underside in a spidery hand: "The last grain falls at midnight. Count carefully — I always did."</p>
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

const RUNE_TABLE: Record<string, string> = {}
const RUNES = 'ᚠᚢᚦᚨᚱᚷᚹᚻᛁᛇᛉᛋᛏᛒᛖᛗᛚᛜᛞᛡᛣᛦ᛫᛭ᛯᛱ'.split('')
for (let i = 0; i < 26; i++) RUNE_TABLE[String.fromCharCode(65 + i)] = RUNES[i]
function toRunes(word: string) {
  return word.toUpperCase().split('').map((c) => RUNE_TABLE[c] ?? c).join(' ')
}

function Page({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

export const witchTheme: ThemeManifest = {
  id: 'witch',
  title: "The Witch's Hourglass",
  tagline: 'A storm, a cottage, and a curse that counts down in sand.',
  synopsis:
    'Caught in a storm, you shelter in the cottage of Morrigan Ashwood — vanished, cursed, and very particular about how her secrets are found.',
  palette: { primary: '#3d2b56', secondary: '#1a1226', accent: '#b98cce', bg: '#0d0714', paper: '#f0e6da', ink: '#241a30' },
  coverArt: CoverArt,
  boxClue: BoxClue,

  intro: [
    {
      id: 'intro-1', order: 0, title: 'Shelter From the Storm', body: () => (
        <Page>
          <p>The storm drove you off the forest path and into the one cottage for miles — dark windows, herbs drying in bunches, a hearth gone cold. The moment the door shut behind you, it would not open again.</p>
          <p>On the mantle, an hourglass turns itself over, unprompted. Its sand is running out. A note in a spidery hand rests beside it: "Whoever finds this has already agreed to finish what I started."</p>
        </Page>
      ),
    },
    {
      id: 'intro-2', order: 1, title: "The Cottage's Rules", body: () => (
        <Page>
          <p>Everything in this cottage answers to a word or a number, once you've puzzled it out — speak it (or write it) beside whatever asked, and the cottage itself seems to confirm you're right, and shows you where to look next.</p>
          <p>Some answers come as symbols rather than numbers. For those, an old brass amulet on the mantle — three turning rings of sigils — translates symbol into digit. And if you're well and truly stuck, three tiers of Morrigan's own marginal notes wait, filed under the same symbol as whatever's troubling you.</p>
        </Page>
      ),
    },
  ],

  storyPages: {
    'name-found': { id: 'name-found', order: 2, title: 'A Name in the Wax', body: () => <Page><p>ASHWOOD. Carved into a candle stub, half-melted. This was her cottage — Morrigan Ashwood, if the old stories are to be believed.</p></Page> },
    'sigils-found': { id: 'sigils-found', order: 3, title: 'The Spellbook Clasp', body: () => <Page><p>The spellbook's clasp bears three tiny sigils — a moon, a leaf, a flame — worn shiny by a thumb that opened it a thousand times.</p></Page> },
    'midnight-found': { id: 'midnight-found', order: 4, title: 'What Waits at Midnight', body: () => <Page><p>The hourglass is nearly empty. Whatever Morrigan meant to finish, it ends here, at midnight, with whatever's behind the cellar door.</p></Page> },
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
      id: 'A', letter: 'A', title: 'The Warded Threshold', symbol: 'moon', inputMode: 'text',
      solution: 'ashwood',
      entryHint: 'Enter the decoded name.',
      component: () => (
        <CipherPanel
          prompt="Runes are carved above the door lintel. A key, scratched into the doorframe itself, maps each rune to a letter."
          cipherText={toRunes('ASHWOOD')}
          keyMap={RUNE_TABLE}
        />
      ),
    },
    B: {
      id: 'B', letter: 'B', title: 'The Drying Herbs', symbol: 'leaf', inputMode: 'text',
      solution: '9',
      entryHint: 'Enter the number of nightshade sprigs you counted.',
      component: () => (
        <SymbolCounter
          prompt="Bundles of dried herbs hang from every beam. Most are common rosemary — but not all of them."
          targetGlyph="🌿"
          cells={['🌾','🌿','🌾','🌾','🌿','🌾','🌿','🌾','🌾','🌿','🌾','🌿','🌾','🌾','🌿','🌾','🌿','🌾','🌿','🌾']}
        />
      ),
    },
    C: {
      id: 'C', letter: 'C', title: "The Cauldron's Measure", symbol: 'flame', inputMode: 'text',
      solution: '21',
      entryHint: 'Enter the missing number.',
      component: () => <SequencePanel prompt="A recipe scrawled on the cauldron's rim, measured in drops:" items={['1', '1', '2', '3', '5', '8', '13', '?']} />,
    },
    D: {
      id: 'D', letter: 'D', title: "The Spellbook's Clasp", symbol: 'eye', inputMode: 'decoder',
      solution: '454',
      entryHint: 'Set the amulet: outer ring to the moon, middle ring to the leaf, inner ring to the flame.',
      component: () => (
        <p className="puzzle-prompt">
          The spellbook's brass clasp bears three worn sigils: a crescent moon, a leaf, a small flame.
          Turn the mantle amulet the same way — outer to moon, middle to leaf, inner to flame — and read the number that shows.
        </p>
      ),
    },
    E: {
      id: 'E', letter: 'E', title: 'The Scrying Glass', symbol: 'skull', inputMode: 'text',
      solution: 'morrigan',
      entryHint: 'Enter the word once it reads correctly.',
      component: () => <MirrorPanel prompt="A tarnished scrying mirror hangs above the washbasin, and whatever's etched across its face reads as pure nonsense — until you actually look into a mirror." mirroredText="MORRIGAN" />,
    },
    F: {
      id: 'F', letter: 'F', title: 'Four Bottled Potions', symbol: 'feather', inputMode: 'text',
      solution: 'amber',
      entryHint: 'Enter the color of the cursed bottle.',
      component: () => (
        <LogicGridPanel
          prompt="Four unlabeled potion bottles sit on the shelf. A note in the margin of the spellbook narrows it down:"
          clues={[
            'The cursed potion is not clear and not green.',
            'The blue potion smells of lavender, not curses.',
            'Whatever is cursed catches the firelight strangely, the way amber and violet both do.',
            'The violet potion is a plain sleeping draught, nothing more.',
          ]}
          rows={['Clear', 'Green', 'Blue', 'Violet']}
          cols={['Lavender', 'Sleeping', 'Ruled Out', 'Cursed']}
        />
      ),
    },
    G: {
      id: 'G', letter: 'G', title: "The Raven's Tapping", symbol: 'key', inputMode: 'text',
      solution: 'raven',
      entryHint: 'Enter the decoded word.',
      component: () => <MorsePanel prompt="A raven perches on the windowsill, tapping its beak against the glass in a pattern that repeats and repeats." message="RAVEN" />,
    },
    H: {
      id: 'H', letter: 'H', title: 'The Star Chart', symbol: 'star', inputMode: 'text',
      solution: 'midnight',
      entryHint: 'Read the highlighted letters in order and enter the word.',
      component: () => (
        <OverlayPanel
          prompt="A star chart is pinned beneath a sheet of oiled parchment. Drag the parchment aside to read the letters marked in violet ink."
          base={
            <p style={{ fontSize: '0.85rem', lineHeight: 1.7, textAlign: 'left' }}>
              Star positions charted for the solstice, as always, in the old convention.{' '}
              <b style={{ color: '#7a3fa0' }}>M</b>oon rising due east,{' '}
              <b style={{ color: '#7a3fa0' }}>I</b>ron star fixed overhead,{' '}
              <b style={{ color: '#7a3fa0' }}>D</b>og-star low on the horizon,{' '}
              <b style={{ color: '#7a3fa0' }}>N</b>orth-mark unmoving as ever,{' '}
              <b style={{ color: '#7a3fa0' }}>I</b>nk fading near the margin,{' '}
              <b style={{ color: '#7a3fa0' }}>G</b>uide-light dim tonight,{' '}
              <b style={{ color: '#7a3fa0' }}>H</b>ourglass star, smallest of all,{' '}
              <b style={{ color: '#7a3fa0' }}>T</b>wilight edge of the chart.
            </p>
          }
          overlay={<div style={{ background: 'rgba(185,140,206,0.35)', width: '100%', height: '100%', borderRadius: 8 }} />}
        />
      ),
    },
    I: {
      id: 'I', letter: 'I', title: 'The Cellar Ward', symbol: 'clock', inputMode: 'decoder',
      solution: '695',
      entryHint: 'Set the amulet: outer ring to the star, middle ring to the feather, inner ring to the key.',
      component: () => (
        <p className="puzzle-prompt">
          The cellar door bears one final ward: a star, a feather, and a key, outer to inner.
          Set the amulet the same way and read the number — this is the one that breaks the curse.
        </p>
      ),
    },
  },

  blueCards: {
    ashwood: { id: 'ashwood', outcome: 'advance', narrative: 'ASHWOOD. The candle gutters and a drawer beneath the mantle slides open on its own, full of drying herbs.', unlocksRed: ['B'], unlocksBooklet: ['name-found'] },
    '9': { id: '9', outcome: 'advance', narrative: 'Nine sprigs of nightshade. The cauldron begins to simmer by itself, a recipe rising to the surface in curling script.', unlocksRed: ['C', 'D'] },
    '21': { id: '21', outcome: 'advance', narrative: 'Twenty-one drops. The spellbook, until now stuck shut, springs open to a page about scrying and clasps.', unlocksRed: ['D'] },
    '454': { id: '454', outcome: 'advance', narrative: 'Four-five-four. The scrying mirror clears of tarnish, and four unlabeled potion bottles catch the firelight for the first time.', unlocksRed: ['E', 'F'], grantsObjects: ['brass_thimble'], unlocksBooklet: ['sigils-found'] },
    morrigan: { id: 'morrigan', outcome: 'advance', narrative: 'MORRIGAN. Her own name in the glass. Something rustles at the windowsill — a raven, watching you with one bright eye.', unlocksRed: ['G'], grantsObjects: ['silver_locket'] },
    amber: { id: 'amber', outcome: 'advance', narrative: 'The amber bottle, cursed after all. Corked tight, it rattles once and goes still. A star chart unrolls itself across the table.', unlocksRed: ['H'], grantsObjects: ['raven_feather'] },
    raven: { id: 'raven', outcome: 'advance', narrative: 'RAVEN. The bird caws once, almost approvingly, and the star chart on the table stops curling at the edges.', unlocksRed: ['H'] },
    midnight: { id: 'midnight', outcome: 'advance', narrative: "MIDNIGHT. Of course. The cellar door, until now just a shadow in the corner, is suddenly very much a door — with one last ward on it.", unlocksRed: ['I'], unlocksBooklet: ['midnight-found'] },
    '695': { id: '695', outcome: 'win', narrative: 'Six-nine-five. The last ward breaks.' },
    '666': { id: '666', outcome: 'decoy', narrative: 'The cottage seems almost offended. A page flutters shut in what can only be described as a huff. Not that one.' },
    '000': { id: '000', outcome: 'decoy', narrative: 'Nothing happens at all, which is somehow worse than something happening. Try again.' },
  },

  greenCards: {
    moon: { id: 'moon', symbol: 'moon', hints: [
      'The doorframe itself has the key to the runes carved above it.',
      'Match each rune to its letter one at a time using the carved key.',
      'The decoded name is ASHWOOD.',
    ] },
    leaf: { id: 'leaf', symbol: 'leaf', hints: [
      'Two herbs are bundled together on those beams — count only one kind.',
      'Count only the darker, jagged-leaved sprigs — those are the nightshade.',
      'There are 9 sprigs of nightshade.',
    ] },
    flame: { id: 'flame', symbol: 'flame', hints: [
      'Compare each number in the recipe to the two before it.',
      "It's a Fibonacci-style sequence — each number is the sum of the two before it.",
      'The missing number is 21.',
    ] },
    eye: { id: 'eye', symbol: 'eye', hints: [
      "Three sigils are worn into the spellbook's clasp: a moon, a leaf, a flame.",
      'Set the amulet outer-to-inner in exactly that order: moon, leaf, flame.',
      'The revealed number is 454.',
    ] },
    skull: { id: 'skull', symbol: 'skull', hints: [
      "The scrying glass isn't cursed, it's just doing what mirrors do.",
      'Flip the lens to read the etching the right way round.',
      'The word is MORRIGAN.',
    ] },
    feather: { id: 'feather', symbol: 'feather', hints: [
      'Three of the four bottles are ruled out directly by the note — work through them first.',
      'Once clear, green and blue are eliminated, only amber is left to be cursed.',
      'The cursed bottle is AMBER.',
    ] },
    key: { id: 'key', symbol: 'key', hints: [
      "That tapping isn't random — it's Morse code, courtesy of a very clever bird.",
      'Play it and transcribe each short and long tap as a dot or dash.',
      'The decoded word is RAVEN.',
    ] },
    star: { id: 'star', symbol: 'star', hints: [
      'Not every letter on that chart is inked the same color.',
      'Read only the violet-inked letters, in order.',
      'They spell MIDNIGHT.',
    ] },
    clock: { id: 'clock', symbol: 'clock', hints: [
      "This last ward needs everything you've learned about this cottage's stars, feathers and keys.",
      'Set outer to the star, middle to the feather, inner to the key.',
      'The final number is 695.',
    ] },
  },

  objects: {
    brass_thimble: { id: 'brass_thimble', name: 'Brass Thimble', description: "A tarnished thimble from Morrigan's sewing kit. It hums faintly when held near the spellbook.", icon: ThimbleIcon },
    silver_locket: { id: 'silver_locket', name: 'Silver Locket', description: 'An empty locket, engraved with a raven in flight. The clasp is stiff with age.', icon: LocketIcon },
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
        <h3 className="display-font">Engraved along the amulet's rim</h3>
        <p>"Three rings turn as one turns the wheel of the year. Moon, then leaf, then flame; star, then feather, then key." — M. Ashwood</p>
      </div>
    ),
  },

  music: { baseFreq: 196, scale: [0, 2, 3, 5, 7, 8, 11], waveform: 'triangle', tempoMs: 3000, filterFreq: 700, mood: 'eerie' },
}
