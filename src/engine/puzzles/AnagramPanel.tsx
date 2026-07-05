import { useState } from 'react'
import '../puzzles/puzzles.css'

interface AnagramPanelProps {
  prompt: string
  /** The scrambled letters as presented (the player rearranges a copy freely) */
  letters: string[]
  /** Optional glyph hints shown under each tile (e.g. tiny numbers found elsewhere) */
  marks?: (string | null)[]
}

/** Loose letter tiles the player can rearrange on a tray — click one tile, then
 * another, to swap them. The engine never validates here; the reordered word is
 * whatever the player convinces themselves of, then types into the code entry. */
export function AnagramPanel({ prompt, letters, marks }: AnagramPanelProps) {
  const [order, setOrder] = useState(() => letters.map((_, i) => i))
  const [picked, setPicked] = useState<number | null>(null)

  const clickTile = (pos: number) => {
    if (picked === null) {
      setPicked(pos)
    } else {
      setOrder((o) => {
        const next = [...o]
        ;[next[picked], next[pos]] = [next[pos], next[picked]]
        return next
      })
      setPicked(null)
    }
  }

  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <div className="anagram-tray">
        {order.map((letterIdx, pos) => (
          <button
            key={pos}
            className={`anagram-tile ${picked === pos ? 'picked' : ''}`}
            onClick={() => clickTile(pos)}
          >
            <span className="anagram-letter">{letters[letterIdx]}</span>
            {marks?.[letterIdx] && <span className="anagram-mark">{marks[letterIdx]}</span>}
          </button>
        ))}
      </div>
      <div className="anagram-actions">
        <button className="btn secondary" onClick={() => { setOrder(letters.map((_, i) => i)); setPicked(null) }}>
          Reset tiles
        </button>
        <span className="symbol-tally">Click two tiles to swap them.</span>
      </div>
    </div>
  )
}
