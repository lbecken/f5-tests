import { useState } from 'react'
import '../puzzles/puzzles.css'

const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..',
  J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
  '6': '-....', '7': '--...', '8': '---..', '9': '----.',
}

function playMorse(text: string) {
  const ctx = new AudioContext()
  const unit = 0.09
  let t = ctx.currentTime + 0.1
  for (const ch of text.toUpperCase()) {
    if (ch === ' ') { t += unit * 4; continue }
    const code = MORSE[ch]
    if (!code) continue
    for (const sym of code) {
      const dur = sym === '.' ? unit : unit * 3
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.frequency.value = 620
      osc.connect(g); g.connect(ctx.destination)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      osc.start(t); osc.stop(t + dur + 0.02)
      t += dur + unit
    }
    t += unit * 2
  }
  window.setTimeout(() => ctx.close(), (t - ctx.currentTime + 0.5) * 1000)
}

interface MorsePanelProps {
  prompt: string
  message: string // plaintext that gets played as morse; player decodes by ear
}

export function MorsePanel({ prompt, message }: MorsePanelProps) {
  const [revealedStrip, setRevealedStrip] = useState(false)
  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <button className="btn" onClick={() => playMorse(message)}>▶ Play Signal</button>
      <button className="btn secondary" onClick={() => setRevealedStrip((v) => !v)}>
        {revealedStrip ? 'Hide dots/dashes' : 'Show as dots & dashes'}
      </button>
      {revealedStrip && (
        <div className="morse-strip">
          {message.toUpperCase().split('').map((c) => MORSE[c] ?? (c === ' ' ? '  /  ' : c)).join(' ')}
        </div>
      )}
      <div className="cipher-key-table">
        {Object.entries(MORSE).map(([k, v]) => (
          <div className="cipher-key-cell" key={k}><b>{k}</b>{v}</div>
        ))}
      </div>
    </div>
  )
}
