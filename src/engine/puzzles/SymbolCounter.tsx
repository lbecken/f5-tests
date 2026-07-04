import { useState } from 'react'
import '../puzzles/puzzles.css'

interface SymbolCounterProps {
  prompt: string
  cells: string[] // emoji/glyph per cell, in a busy grid
  targetGlyph: string
}

/** Hidden-object counting puzzle: tally how many of a target glyph appear
 * among distractors. Clicking cells is just a convenience tally aid. */
export function SymbolCounter({ prompt, cells, targetGlyph }: SymbolCounterProps) {
  const [tallied, setTallied] = useState<Set<number>>(new Set())

  const toggle = (i: number) =>
    setTallied((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <div className="symbol-grid">
        {cells.map((glyph, i) => (
          <div key={i} className={`symbol-cell ${tallied.has(i) ? 'tallied' : ''}`} onClick={() => toggle(i)}>
            {glyph}
          </div>
        ))}
      </div>
      <p className="symbol-tally">
        Looking for: <strong>{targetGlyph}</strong> — click each one you find to keep count ({tallied.size} tallied)
      </p>
    </div>
  )
}
