import { useMemo, useState } from 'react'
import type { ThemeManifest } from '../types'
import { FlipCard, CardBack, LockedCardBack } from './Card'
import { LockIcon } from '../icons'
import { themeArt } from '../assets'
import './deckBrowser.css'

interface DeckBrowserProps {
  theme: ThemeManifest
  deck: 'red' | 'blue'
  open: boolean
  onClose: () => void
  unlockedIds: string[]
  drawnIds: string[]
  highlightId?: string | null
  onDraw: (id: string) => void
}

/** Modal "search the deck" UI — mirrors thumbing through a physical lettered/numbered
 * deck to find the one card you've been instructed to draw. */
export function DeckBrowser({ theme, deck, open, onClose, unlockedIds, drawnIds, highlightId, onDraw }: DeckBrowserProps) {
  const [flipped, setFlipped] = useState<string | null>(null)

  const ids = useMemo(() => {
    const source = deck === 'red' ? theme.redCards : theme.blueCards
    return Object.keys(source).sort((a, b) =>
      deck === 'red' ? a.localeCompare(b) : Number(a) - Number(b) || a.localeCompare(b),
    )
  }, [theme, deck])

  if (!open) return null

  return (
    <div className="deck-modal-overlay" onClick={onClose}>
      <div className="deck-modal panel" onClick={(e) => e.stopPropagation()}>
        <div className="deck-modal-header">
          <h2 className="display-font">{deck === 'red' ? 'Puzzle Deck' : 'Answer Deck'}</h2>
          <button className="btn secondary" onClick={onClose}>Close</button>
        </div>
        <p className="deck-modal-sub">
          {deck === 'red'
            ? 'Find the card whose letter the story pointed you to.'
            : highlightId
              ? `Find card № ${highlightId} — it holds your answer.`
              : 'Cards you have already revealed.'}
        </p>
        <div className="deck-grid">
          {ids.map((id) => {
            const isUnlocked = deck === 'red' ? unlockedIds.includes(id) : drawnIds.includes(id) || id === highlightId
            const isDrawn = deck === 'red' ? drawnIds.includes(id) : drawnIds.includes(id)
            const isHighlight = highlightId === id
            const label = deck === 'red' ? theme.redCards[id].letter : id
            const canInteract = deck === 'red' ? isUnlocked && !isDrawn : isHighlight || isDrawn
            return (
              <div
                key={id}
                className={`deck-slot ${isHighlight ? 'highlight' : ''} ${isDrawn && deck === 'red' ? 'already-drawn' : ''}`}
              >
                <FlipCard
                  flipped={flipped === id}
                  front={
                    isUnlocked || isHighlight ? (
                      <CardBack
                        label={label}
                        deck={deck}
                        accent={theme.palette.accent}
                        icon={deck === 'red' ? <LockIcon symbol={theme.redCards[id].symbol} /> : undefined}
                        bgUrl={themeArt(theme.id, 'deck', deck)}
                      />
                    ) : (
                      <LockedCardBack label="" />
                    )
                  }
                  back={
                    deck === 'red' ? (
                      <div className="deck-front-peek">
                        <span>{theme.redCards[id].title}</span>
                      </div>
                    ) : (
                      <div className="deck-front-peek blue-reveal">{theme.blueCards[id].narrative}</div>
                    )
                  }
                  onClick={() => {
                    if (deck === 'red') {
                      if (!canInteract) return
                      onDraw(id)
                      onClose()
                    } else if (isHighlight) {
                      setFlipped(id)
                      window.setTimeout(() => onDraw(id), 550)
                    } else if (isDrawn) {
                      setFlipped((cur) => (cur === id ? null : id))
                    }
                  }}
                  ariaLabel={`Card ${label}`}
                  className={canInteract ? 'interactive' : 'inert'}
                />
                {isDrawn && deck === 'red' && <div className="drawn-badge">on board</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
