import { useState } from 'react'
import type { ThemeManifest } from '../types'
import { useGameStore, useThemeSave } from '../store'
import { LockIcon } from '../icons'
import { HintPanel } from './HintPanel'
import { CodeEntry } from './CodeEntry'
import './puzzleModal.css'

interface PuzzleModalProps {
  theme: ThemeManifest
  redId: string
  onClose: () => void
  onOpenDecoder: () => void
}

export function PuzzleModal({ theme, redId, onClose, onOpenDecoder }: PuzzleModalProps) {
  const [showHints, setShowHints] = useState(false)
  const save = useThemeSave(theme.id)
  const submitCode = useGameStore((s) => s.submitCode)
  const requestHint = useGameStore((s) => s.useHint)

  const red = theme.redCards[redId]
  const drawn = save?.drawnRed[redId]
  const green = theme.greenCards[red.symbol] ?? Object.values(theme.greenCards).find((g) => g.symbol === red.symbol)
  if (!drawn) return null

  return (
    <div className="deck-modal-overlay" onClick={onClose}>
      <div className="puzzle-modal panel" onClick={(e) => e.stopPropagation()}>
        <div className="puzzle-modal-header">
          <div className="puzzle-modal-title">
            <LockIcon symbol={red.symbol} color={theme.palette.primary} />
            <h2 className="display-font">{red.letter}. {red.title}</h2>
          </div>
          <button className="btn secondary" onClick={onClose}>Close</button>
        </div>

        <div className="puzzle-modal-body">
          <div className="puzzle-stage">
            <red.component solved={drawn.solved} />
          </div>

          {!drawn.solved ? (
            <>
              <CodeEntry
                entryHint={red.entryHint}
                wrongAttempts={drawn.wrongAttempts}
                disabled={drawn.solved}
                onSubmit={(code) => submitCode(theme, redId, code)}
                onOpenDecoder={onOpenDecoder}
                showDecoderButton={red.inputMode === 'decoder'}
              />
              {green && (
                <div className="puzzle-hint-toggle">
                  <button className="btn secondary" onClick={() => setShowHints((v) => !v)}>
                    {showHints ? 'Hide Hints' : 'Stuck? Draw a Hint Card'}
                  </button>
                  {showHints && (
                    <HintPanel
                      green={green}
                      accent={theme.palette.accent}
                      level={drawn.hintLevel}
                      onReveal={() => requestHint(redId)}
                    />
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="puzzle-solved-banner">✓ Solved — this card is resolved.</p>
          )}
        </div>
      </div>
    </div>
  )
}
