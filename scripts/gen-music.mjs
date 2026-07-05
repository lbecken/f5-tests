#!/usr/bin/env node
// Stable Audio 2 music pass: main loop, finale loop, and win stinger per theme.
// Resumable — skips existing files. Each track costs ~20 Stability credits (~$0.20).
// Usage: STABLEAUDIO_API_KEY=... node scripts/gen-music.mjs [only-file-basename ...]
import { execFileSync } from 'node:child_process'
import { existsSync, statSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = resolve(import.meta.dirname, '../src/assets/music')
const KEY = process.env.STABLEAUDIO_API_KEY

const BASE = {
  clockmaker: 'clockwork music box and soft ticking percussion, warm cello, gentle mechanical rhythm, mysterious victorian workshop at night',
  witch: 'eerie folk lullaby, plucked dulcimer and glass harmonica, distant storm, gothic fairytale forest cottage',
  abyssal: 'dark ambient underwater drone, sonar pings, deep sub bass, cold synthesizer pads, abandoned deep sea station',
  zephyr: 'smoky 1920s jazz noir, muted trumpet and brushed drums, train rhythm clatter underneath, art deco mystery',
  ninthseal: 'ancient egyptian atmosphere, low frame drums, duduk and reed flute, deep male drone chant, torchlit tomb',
}

const jobs = []
for (const [theme, base] of Object.entries(BASE)) {
  jobs.push({ file: `${theme}-main.mp3`, duration: 95, prompt: `${base}, slow and patient, instrumental, seamless loop, no melody drift, subtle` })
  jobs.push({ file: `${theme}-finale.mp3`, duration: 70, prompt: `${base}, urgent final act, faster pulse, rising tension, instrumental, seamless loop` })
  jobs.push({ file: `${theme}-win.mp3`, duration: 25, prompt: `${base}, triumphant resolution, doors opening, warm and conclusive, instrumental, short outro` })
}

const only = process.argv.slice(2)
let ok = 0, skip = 0, err = 0
for (const job of jobs) {
  if (only.length && !only.includes(job.file)) continue
  const path = `${OUT}/${job.file}`
  if (existsSync(path) && statSync(path).size > 50000) { skip++; continue }
  try {
    execFileSync('curl', ['-sS', '-X', 'POST', 'https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio',
      '-H', `Authorization: Bearer ${KEY}`, '-H', 'Accept: audio/*',
      '-F', `prompt=${job.prompt}`, '-F', `duration=${job.duration}`, '-F', 'output_format=mp3',
      '-o', path], { timeout: 300000 })
    const head = readFileSync(path).slice(0, 3).toString('latin1')
    if (head !== 'ID3' && head.charCodeAt(0) !== 0xff) throw new Error(readFileSync(path, 'utf8').slice(0, 200))
    ok++
    console.log('ok ', job.file, statSync(path).size, 'bytes')
  } catch (e) {
    err++
    console.log('ERR', job.file, String(e.message).slice(0, 200))
  }
}
console.log(`ok=${ok} skip=${skip} err=${err}`)
execFileSync('curl', ['-sS', 'https://api.stability.ai/v1/user/balance', '-H', `Authorization: Bearer ${KEY}`],
  { stdio: 'inherit', timeout: 30000 })
