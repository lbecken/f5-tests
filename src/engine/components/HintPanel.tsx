import { useState } from 'react'
import type { GreenCard } from '../types'
import { LockIcon } from '../icons'
import { playChime } from '../audio'
import './hintPanel.css'

interface HintPanelProps {
  green: GreenCard
  accent: string
  level: 0 | 1 | 2 | 3
  onReveal: () => void
}

/** The green "hint" deck, scoped to one puzzle's symbol — three progressively
 * more revealing tiers, each requiring a deliberate click so players don't
 * accidentally spoil themselves. */
export function HintPanel({ green, accent, level, onReveal }: HintPanelProps) {
  const [confirmTier, setConfirmTier] = useState<number | null>(null)

  return (
    <div className="hint-panel">
      <div className="hint-panel-header">
        <LockIcon symbol={green.symbol} size={20} color={accent} />
        <span>Hint Cards</span>
      </div>
      <div className="hint-tiers">
        {[0, 1, 2].map((tierIdx) => {
          const tier = tierIdx + 1
          const revealed = level > tierIdx
          const isNext = level === tierIdx
          return (
            <div key={tier} className={`hint-tier ${revealed ? 'revealed' : ''}`}>
              <div className="hint-tier-label">Tier {tier}</div>
              {revealed ? (
                <p className="fade-up">{green.hints[tierIdx]}</p>
              ) : isNext ? (
                confirmTier === tier ? (
                  <div className="hint-confirm">
                    <span>{tier === 3 ? 'This reveals the full answer.' : 'Reveal this hint?'}</span>
                    <div className="hint-confirm-actions">
                      <button
                        className="btn"
                        onClick={() => {
                          onReveal()
                          playChime('hint')
                          setConfirmTier(null)
                        }}
                      >
                        Yes, reveal
                      </button>
                      <button className="btn secondary" onClick={() => setConfirmTier(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button className="btn secondary hint-btn" onClick={() => setConfirmTier(tier)}>
                    Draw Hint {tier}
                  </button>
                )
              ) : (
                <p className="hint-locked">🔒 locked until Tier {tier - 1}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
