import { useState } from 'react'
import '../puzzles/puzzles.css'

export type CounterCell = string | { glyph: string; blink?: boolean; dim?: boolean }

interface SymbolCounterProps {
  prompt: string
  /** Glyphs in a busy grid. Object form supports `blink` (animated distractor —
   * "count only the steady ones") and `dim` (faded variant — "only the fresh ones"). */
  cells: CounterCell[]
  targetGlyph: string
  /** Extra line under the grid, e.g. the exclusion rule the player must notice */
  fine?: string
  columns?: number
}

/** Hidden-object counting with exclusion rules: not everything that matches the
 * glyph should be counted — variants (blinking, faded) are the trap. Clicking
 * cells is only a tally aid; the engine never confirms the count here. */
export function SymbolCounter({ prompt, cells, targetGlyph, fine, columns = 6 }: SymbolCounterProps) {
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
      <div className="symbol-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {cells.map((cell, i) => {
          const c = typeof cell === 'string' ? { glyph: cell } : cell
          return (
            <div
              key={i}
              className={`symbol-cell ${tallied.has(i) ? 'tallied' : ''} ${c.blink ? 'blinking' : ''} ${c.dim ? 'dimmed' : ''}`}
              onClick={() => toggle(i)}
            >
              {c.glyph}
            </div>
          )
        })}
      </div>
      <p className="symbol-tally">
        Looking for: <strong>{targetGlyph}</strong> — click to tally ({tallied.size} tallied)
      </p>
      {fine && <p className="symbol-fine">{fine}</p>}
    </div>
  )
}
