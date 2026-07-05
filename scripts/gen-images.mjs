#!/usr/bin/env node
// Full-pass Recraft image generation. Resumable: skips files that already exist.
// Usage: RECRAFT_API_KEY=... node scripts/gen-images.mjs
import { execFileSync } from 'node:child_process'
import { writeFileSync, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = resolve(import.meta.dirname, '../src/assets/art')
const KEY = process.env.RECRAFT_API_KEY

const STYLE = {
  clockmaker: 'vintage two-tone woodcut vector illustration, warm cream on deep oxblood brown, Victorian steampunk clockmaker workshop, ornate, mysterious escape-room aesthetic, no text, no letters',
  witch: 'vintage storybook vector illustration, parchment cream on deep violet, gothic fairytale witch cottage, moonlit, mysterious escape-room aesthetic, no text, no letters',
  abyssal: 'retro sci-fi vector illustration, pale teal on near-black, deep sea research station interior, eerie glow, escape-room aesthetic, no text, no letters',
  zephyr: '1920s art deco travel poster vector illustration, gold on deep navy, luxury express train, geometric, elegant mystery escape-room aesthetic, no text, no letters',
  ninthseal: '1930s Egyptology adventure vector illustration, gold ochre on deep indigo, torchlit pharaoh tomb, hieroglyphic decoration, mysterious escape-room aesthetic, no text, no letters',
}

const CARDS = {
  clockmaker: {
    A: 'a handwritten ciphered note pinned to a workbench with a spare cog, a brass winding crank beside it, candlelight',
    B: 'an open cabinet drawer overflowing with loose gears and old keys, some keys rusted, magnifier resting on the edge',
    C: 'a towering grandfather clock with an ornate repainted face, stopped hands, hidden hinge glinting',
    D: 'the chest plate of a brass automaton stamped with three marks of different sizes, worn smooth',
    E: 'a gentleman\'s desk with a locked drawer, name plaque, and a hinged shaving mirror reflecting candlelight',
    F: 'a balance scale on a workbench with four metal cogs of different metals waiting to be weighed',
    G: 'an old brass signal lamp in a dark corner, shutter half open, aimed at a tall wall mirror',
    H: 'an open leather ledger, its last page blank, an oil lamp casting violet-tinged light across it',
    I: 'the automaton\'s final dial: three keyholes shaped as crescent moon, flame and star arranged in a circle',
  },
  witch: {
    A: 'a crooked cottage doorway with runes carved above the lintel and a weathered key scratched into the frame',
    B: 'bundles of dried herbs hanging from dark beams, some sprigs fresh and dark, others wilted grey',
    C: 'a black cauldron ringed by seven small labeled jars, the seventh jar buried under soot',
    D: 'a heavy spellbook with a brass clasp bearing three tiny sigils: moon, leaf and flame',
    E: 'a tarnished round scrying mirror above a stone washbasin, backwards letters etched in the glass',
    F: 'five unlabeled potion bottles on a shelf catching firelight, one amber bottle glinting strangely',
    G: 'a raven perched at a dark cottage window, tapping the glass, moonlight behind ragged clouds',
    H: 'an old star chart pinned open on a wooden table, silver locket resting on its corner, moon phases in the margins',
    I: 'a low cellar door in shadow bearing a ward of three sigils: star, feather and key, hourglass nearly empty beside it',
  },
  abyssal: {
    A: 'a dim station console with a small comm buzzer, a single indicator pulsing, cables and pipes',
    B: 'a laminated crew roster and stack of personal log tablets in an open drawer, cold light',
    C: 'a wall panel dense with small round indicator lights, a taped paper note at its corner',
    D: 'three heavy manual valves with round pressure gauges, hand-stamped icons, brass instruction plate',
    E: 'a frozen security camera feed on a cracked monitor, image mirrored, static at the edges',
    F: 'a corridor of four crew cabin doors, one door\'s indicator still lit, frost on the others',
    G: 'a row of five analog pressure gauges on a bulkhead, needles at different positions',
    H: 'a deck schematic on a light table viewed through a thermal lens, conduits glowing with heat',
    I: 'a domed observation window above an airlock, frost clearing, bright stars in dark water above',
  },
  zephyr: {
    A: 'a first-class train ticket lying on a mail car floor, name smeared, stub folded shut behind perforation',
    B: 'an open leather passenger manifest ledger with a berth grid, conductor\'s fountain pen resting on it',
    C: 'six loose letter tiles scattered on a fold-down train table, telegraph form beneath',
    D: 'four identical steamer trunks with city stickers in a luggage van, freight scale beside them',
    E: 'a railway timetable with three stations circled in grease pencil, pocket watch on top',
    F: 'a dining car bill printed in halves with a dotted crease, crystal glass and silverware nearby',
    G: 'a train window filmed with tunnel soot, a gloved hand\'s writing showing through from outside',
    H: 'a hand-drawn railway junction map with crossed-out points, unfolding from a chef\'s uniform',
    I: 'a mail car safe with inspection panel open showing three stamped brass plates, conductor\'s key in the lock',
    J: 'a dining car table with a coffee cup and a sugar bowl, an elegant woman\'s silhouette, Milan approaching outside',
  },
  ninthseal: {
    A: 'a stone lintel half buried in drifted sand, tally strokes carved beneath, oil lamp light',
    B: 'four canopic jars beside a bronze feather on a stone offering table, balance scale',
    C: 'a five-by-five grid of carved letters on a tomb wall, painted linen strip with coordinates below',
    D: 'three stone gates each crowned with a band of carved stars, one star, four stars, seven stars',
    E: 'a burial chamber ceiling painted as a night sky, stars of many sizes, cornice inscription',
    F: 'a blank papyrus roll on a priest\'s cot, held toward an oil lamp flame, hidden verses beginning to show',
    G: 'a passage closed by a knotted linen cord sealed in wax, ancient and untouched',
    H: 'a bronze door bearing three symbols in a ring: leaf, wave and feather, torch light',
    I: 'a massive dark door with a speaking grille, faint light within, three thousand years of dust',
    J: 'a blank royal cartouche carved in stone with a chisel on a chain hanging beside it, nine broken seals around',
  },
}

const PAGES = {
  clockmaker: {
    'note-found': 'a decoded note with a small brass key taped beneath the words, candlelit workbench',
    'triptych-found': 'close view of three stamps of different sizes worn into a brass chest plate',
    'final-approach': 'a ledger with drying ink beside the silhouette of a waiting automaton',
    win: 'a brass automaton coming alive, clock heart glowing, workshop door open with dawn light, the old clockmaker in the doorway',
  },
  witch: {
    'name-found': 'a half-melted candle stub with a name carved in the wax, mantle shelf',
    'sigils-found': 'a spellbook clasp with three worn sigils shining by hearth light',
    'midnight-found': 'an hourglass nearly out of sand beside a shadowed cellar door',
    win: 'a cottage door swinging open onto a rain-washed forest dawn, warm light spilling out, hourglass empty',
  },
  abyssal: {
    'log-found': 'a crew roster and encrypted logs spread under a cold desk lamp',
    'valves-found': 'a reactor deck with three stamped valves and a brass instruction plate',
    'oxygen-found': 'an oxygen readout recalculating on an old display, frost clearing from a dome above',
    win: 'an escape pod breaking the ocean surface into blinding daylight, station lights far below',
  },
  zephyr: {
    'manifest-page': 'a conductor reluctantly handing over a leather manifest in a swaying corridor',
    'tunnel-page': 'a chef\'s uniform and circled tunnel timetable inside a lead-lined trunk',
    'chase-page': 'a junction map with a route traced through letters, magnifying glass on top',
    win: 'a grand art deco station platform at night, a woman in an elegant coat handing over a sugar bowl, train steam',
  },
  ninthseal: {
    'duat-page': 'a carved map of the underworld on a tomb wall, three gates leading down',
    'priest-page': 'a priest\'s cell with papyri and an oil lamp, verses glowing faintly',
    'guardian-page': 'a vast dark door with a patient presence behind it, single riddle grille',
    win: 'nine broken seals falling from a great stone door, stairs rising into storm light, a lapis scarab on the last step',
  },
}

const OBJECTS = {
  clockmaker: {
    brass_key: 'a single small ornate brass key',
    shaving_mirror: 'a hinged gentleman\'s shaving mirror on a stand',
    oil_can: 'a small vintage oil can with a long spout',
  },
  witch: {
    brass_thimble: 'a tarnished brass sewing thimble',
    silver_locket: 'a silver locket engraved with a raven in flight',
    raven_feather: 'a single black raven feather',
  },
  abyssal: {
    keycard: 'a worn security keycard with a chip',
    wrench: 'a well-used steel hand wrench',
    headlamp: 'a diver\'s headlamp with a mode selector',
  },
  zephyr: {
    brass_tag: 'a brass luggage tag on a leather strap',
    tunnel_timetable: 'a folded railway timetable with circled entries',
    conductors_key: 'an ornate railway conductor\'s key',
  },
  ninthseal: {
    feather_maat: 'a bronze feather of Maat, ceremonial',
    oil_lamp: 'an ancient clay oil lamp with a small flame',
    scarab_amulet: 'a lapis lazuli scarab amulet',
  },
}

const jobs = []
for (const [theme, cards] of Object.entries(CARDS))
  for (const [k, scene] of Object.entries(cards))
    jobs.push({ file: `${theme}-card-${k}.svg`, size: '1365x1024', prompt: `${STYLE[theme]}, ${scene}` })
for (const [theme, pages] of Object.entries(PAGES))
  for (const [k, scene] of Object.entries(pages))
    jobs.push({ file: `${theme}-page-${k}.svg`, size: '1365x1024', prompt: `${STYLE[theme]}, ${scene}` })
for (const [theme, objs] of Object.entries(OBJECTS))
  for (const [k, scene] of Object.entries(objs))
    jobs.push({ file: `${theme}-obj-${k}.svg`, size: '1024x1024', prompt: `${STYLE[theme]}, single object icon centered on a plain dark background: ${scene}` })
for (const theme of Object.keys(STYLE)) {
  jobs.push({ file: `${theme}-deck-red.svg`, size: '1024x1365', prompt: `${STYLE[theme]}, ornate symmetrical playing-card back pattern in deep crimson red and gold tones, ${theme === 'abyssal' ? 'technical linework' : 'filigree'} border, centered emblem, no text` })
  jobs.push({ file: `${theme}-deck-blue.svg`, size: '1024x1365', prompt: `${STYLE[theme]}, ornate symmetrical playing-card back pattern in deep navy blue and silver tones, ${theme === 'abyssal' ? 'technical linework' : 'filigree'} border, centered emblem, no text` })
}

console.log(`${jobs.length} images in manifest`)
let done = 0, skipped = 0, failed = 0
for (const job of jobs) {
  const path = `${OUT}/${job.file}`
  if (existsSync(path) && statSync(path).size > 5000) { skipped++; continue }
  const body = JSON.stringify({ prompt: job.prompt, style: 'vector_illustration', model: 'recraftv3', size: job.size })
  writeFileSync('/tmp/recraft-req.json', body)
  try {
    const resp = execFileSync('curl', ['-sS', '-X', 'POST', 'https://external.api.recraft.ai/v1/images/generations',
      '-H', `Authorization: Bearer ${KEY}`, '-H', 'Content-Type: application/json', '-d', `@/tmp/recraft-req.json`],
      { encoding: 'utf8', timeout: 120000 })
    const url = JSON.parse(resp)?.data?.[0]?.url
    if (!url) throw new Error(resp.slice(0, 200))
    execFileSync('curl', ['-sSL', url, '-o', path], { timeout: 120000 })
    done++
    console.log(`ok  ${job.file}`)
  } catch (e) {
    failed++
    console.log(`ERR ${job.file}: ${String(e.message).slice(0, 200)}`)
  }
}
console.log(`done=${done} skipped=${skipped} failed=${failed}`)
