#!/usr/bin/env node
// Full narration pass: every blue answer card (extracted from theme sources so the
// audio can never drift from the text), remaining booklet pages, and extra SFX.
// Resumable — skips existing files. Usage: ELEVENLABS_API_KEY=... node scripts/gen-voices.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const VOICE_OUT = resolve(import.meta.dirname, '../src/assets/voice')
const SFX_OUT = resolve(import.meta.dirname, '../src/assets/sfx')
const KEY = process.env.ELEVENLABS_API_KEY
const MODEL = 'eleven_multilingual_v2'

const VOICES = {
  clockmaker: 'JBFqnCBsd6RMkjVDRZzb', // George
  witch: 'pFZP5JQG7iQjIQuC4Bku',      // Lily
  abyssal: 'SAz9YHcvj6GT2YYXdXww',     // River
  zephyr: 'N2lVS1w4EtoT3dr4eOWO',      // Callum
  ninthseal: 'pqHfZKP75CvOlQylNhV4',   // Bill
}

const slug = (s) => s.replace(/\s+/g, '_')

function tts(file, voiceId, text) {
  const path = `${VOICE_OUT}/${file}.mp3`
  if (existsSync(path) && statSync(path).size > 5000) return 'skip'
  writeFileSync('/tmp/tts-req.json', JSON.stringify({ text, model_id: MODEL }))
  execFileSync('curl', ['-sS', '-X', 'POST',
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    '-H', `xi-api-key: ${KEY}`, '-H', 'Content-Type: application/json',
    '-d', '@/tmp/tts-req.json', '-o', path], { timeout: 120000 })
  const head = readFileSync(path).slice(0, 3).toString('latin1')
  if (head !== 'ID3' && head.charCodeAt(0) !== 0xff) throw new Error(readFileSync(path, 'utf8').slice(0, 150))
  return 'ok'
}

function sfx(name, prompt, seconds) {
  const path = `${SFX_OUT}/${name}.mp3`
  if (existsSync(path) && statSync(path).size > 3000) return 'skip'
  writeFileSync('/tmp/sfx-req.json', JSON.stringify({ text: prompt, duration_seconds: seconds, prompt_influence: 0.4 }))
  execFileSync('curl', ['-sS', '-X', 'POST', 'https://api.elevenlabs.io/v1/sound-generation',
    '-H', `xi-api-key: ${KEY}`, '-H', 'Content-Type: application/json',
    '-d', '@/tmp/sfx-req.json', '-o', path], { timeout: 120000 })
  return 'ok'
}

/** Pull every blue card's id + narrative out of a theme source file. */
function extractBlues(themeFile) {
  const src = readFileSync(resolve(import.meta.dirname, '..', themeFile), 'utf8')
  const block = src.split('blueCards: {')[1].split('\n  },')[0]
  const out = []
  const re = /narrative:\s*(?:'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`|"((?:[^"\\]|\\.)*)")/g
  const idRe = /(?:'([^']+)'|([A-Za-z_][\w ]*)):\s*\{\s*id:/g
  const ids = []
  let m
  while ((m = idRe.exec(block))) ids.push(m[1] ?? m[2])
  const texts = []
  while ((m = re.exec(block))) {
    let t = (m[1] ?? m[2] ?? m[3])
      .replace(/\\'/g, "'")
      .replace(/\$\{strokes\(\d+\)\}\s*/g, '') // tally glyphs aren't speakable; the "(N strokes)" phrase is
    texts.push(t)
  }
  if (ids.length !== texts.length) throw new Error(`${themeFile}: ${ids.length} ids vs ${texts.length} narratives`)
  return ids.map((id, i) => ({ id, text: texts[i] }))
}

const THEME_FILES = {
  clockmaker: 'src/themes/clockmaker/theme.tsx',
  witch: 'src/themes/witch/theme.tsx',
  abyssal: 'src/themes/abyssal/theme.tsx',
  zephyr: 'src/themes/zephyr/theme.tsx',
  ninthseal: 'src/themes/ninthseal/theme.tsx',
}

/** Booklet pages not yet narrated: how-to intro page + the three story pages per theme. */
const PAGE_TEXTS = {
  clockmaker: {
    'note-found': 'Find the pendulum, it read, once you\'d unwound his cipher. Beneath the words, a small brass key had been taped to the paper. You pocket it. In this workshop, you suspect, nothing stays unused for long.',
    'triptych-found': 'Stamped into the Sentinel\'s chest plate are three marks of very different sizes — a cog broad as a coin, a key half that, a lamp flame barely a scratch. Worn smooth by a century of thumbs, as if the sizes themselves were the point.',
    'final-approach': 'The ledger\'s ink is nearly dry. Whatever Master Voss intended, it ends at the Sentinel itself — and the last dial it\'s still waiting for. The order of its three keyholes is written nowhere in the room. Which leaves the things you carried in with you.',
  },
  witch: {
    'name-found': 'Ashwood. The wards on this cottage all answer to the family name. Carved into a candle stub on the mantle, half-melted, you also find a first initial: M.',
    'sigils-found': 'The spellbook\'s clasp bears three tiny sigils — a moon, a leaf, a flame — worn shiny by a thumb that opened it a thousand times. In what order did that thumb press them? The amulet on the mantle has two faces, and you\'ve only been reading one.',
    'midnight-found': 'The hourglass is nearly empty. Whatever Morrigan meant to finish ends behind the cellar door — and its ward wants a second verse you have already carried past a hundred times.',
  },
  abyssal: {
    'log-found': 'The drawer holds a stack of personal logs, half-encrypted out of habit, and a laminated crew roster: Okafor, systems. Reyes, lead researcher. Santos, medical. Piret, geology. One of them wrote the final entry. The signature is five digits of keypad cipher.',
    'valves-found': 'The reactor deck has a manual valve trio, hand-stamped with the same icons as the airlock dial — and a brass plate: bleed in order of pressure. Highest first, to the outer ring. Someone built this station expecting the AI to fail exactly like this.',
    'oxygen-found': 'MERIDIAN\'s voice changes pitch slightly. Oxygen reserves: recalculated. Recommend expedience. It sounds, almost, like it\'s rooting for you. The observation dome above the airlock has begun to clear of frost.',
  },
  zephyr: {
    'manifest-page': 'The conductor surrenders the passenger manifest with the expression of a man handing over his own diary. First class is above suspicion, he says, entirely wrong.',
    'tunnel-page': 'The false-bottomed trunk held a chef\'s uniform — never worn, tags still on — and a copy of the Simplon tunnel schedule with twenty-one twelve circled twice. The thief didn\'t ride this train. The thief studied it.',
    'chase-page': 'Lucerne. The diamond\'s own name, hidden in the junctions of its escape route. The thief has a sense of theatre — and theatrical people sign their work. Check everything with initials on it. Everything.',
  },
  ninthseal: {
    'duat-page': 'Duat — the world below. The grid on the offering wall was a map the whole time, and this tomb is its legend. Three gates lead deeper, each crowned with carved stars. The night sky in here is architectural.',
    'priest-page': 'Ankhef, lector-priest, sealed himself in with his king rather than unlearn the name. His papyri survive him: verse after verse in ink that only shows itself to lamplight.',
    'guardian-page': 'The ninth door has a voice. It is polite, patient, and has been asking its riddle for three thousand years. It does not seem worried that you will get it right. That is the most unnerving part.',
  },
}

let ok = 0, skip = 0, err = 0
const run = (fn, label) => {
  try {
    const r = fn()
    r === 'skip' ? skip++ : ok++
    if (r !== 'skip') console.log('ok ', label)
  } catch (e) {
    err++
    console.log('ERR', label, String(e.message).slice(0, 150))
  }
}

for (const [theme, file] of Object.entries(THEME_FILES)) {
  for (const { id, text } of extractBlues(file)) {
    run(() => tts(`${theme}-blue-${slug(id)}`, VOICES[theme], text), `${theme}-blue-${id}`)
  }
  for (const [pageId, text] of Object.entries(PAGE_TEXTS[theme])) {
    run(() => tts(`${theme}-page-${pageId}`, VOICES[theme], text), `${theme}-page-${pageId}`)
  }
}

run(() => sfx('fold', 'a stiff card being folded once with a crisp paper crease, short', 0.8), 'sfx fold')
run(() => sfx('rub', 'fingertips rubbing dust and soot off a rough stone surface, short brushing scratch', 1.0), 'sfx rub')
run(() => sfx('scale', 'a small brass balance scale tilting with a gentle metallic clink of weights', 0.9), 'sfx scale')
run(() => sfx('page', 'a single parchment page turning in a quiet room, soft', 0.8), 'sfx page')
run(() => sfx('hint', 'a small card sliding out of a paper envelope, soft whisper of paper', 0.8), 'sfx hint')
run(() => sfx('story', 'a short mysterious harp arpeggio flourish, four rising notes, intimate', 1.6), 'sfx story')

console.log(`ok=${ok} skip=${skip} err=${err}`)
execFileSync('curl', ['-sS', 'https://api.elevenlabs.io/v1/user/subscription', '-H', `xi-api-key: ${KEY}`],
  { encoding: 'utf8' }).replace(/.*"character_count":(\d+),"character_limit":(\d+).*/s, (_, a, b) => console.log(`quota: ${a}/${b}`) ?? '')
