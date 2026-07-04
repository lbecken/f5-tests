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
            <div className="drawn-tile-letter">{red.letter}</div>
            <LockIcon symbol={red.symbol} size={22} color={theme.palette.primary} />
            <div className="drawn-tile-title">{red.title}</div>
            {d.solved && <div className="drawn-tile-check">✓</div>}
            {!d.solved && d.hintLevel > 0 && <div className="drawn-tile-hintmark">hint {d.hintLevel}/3</div>}
          </button>
        )
      })}
    </div>
  )
}
