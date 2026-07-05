import type { ThemeManifest } from '../types'
import type { DrawnRed } from '../store'
import { LockIcon } from '../icons'
import './drawnBoard.css'

interface DrawnBoardProps {
  theme: ThemeManifest
  drawnRed: Record<string, DrawnRed>
  onSelect: (id: string) => void
}

export function DrawnBoard({ theme, drawnRed, onSelect }: DrawnBoardProps) {
  const entries = Object.values(drawnRed).sort((a, b) => a.id.localeCompare(b.id))

  if (entries.length === 0) {
    return (
      <div className="drawn-board empty">
        <p>No puzzle cards on your table yet — open the Puzzle Deck to draw your first card.</p>
      </div>
    )
  }

  return (
    <div className="drawn-board">
      {entries.map((d) => {
        const red = theme.redCards[d.id]
        return (
          <button
            key={d.id}
            className={`drawn-tile fade-up ${d.solved ? 'solved' : ''}`}
            onClick={() => onSelect(d.id)}
          >
            <div className="drawn-tile-band">
              <span>{red.letter}</span>
              <LockIcon symbol={red.symbol} size={15} color="#f0dcb8" />
              {d.solved && <div className="drawn-tile-check">✓</div>}
            </div>
            <div className="drawn-tile-body">
              <div className="drawn-tile-watermark">
                <LockIcon symbol={red.symbol} color="#000" />
              </div>
              <div className="drawn-tile-title">{red.title}</div>
              {red.difficulty && (
                <div className="drawn-tile-diff">{'●'.repeat(red.difficulty)}{'○'.repeat(3 - red.difficulty)}</div>
              )}
              {!d.solved && d.hintLevel > 0 && <div className="drawn-tile-hintmark">hint {d.hintLevel}/3</div>}
            </div>
          </button>
        )
      })}
    </div>
  )
}
