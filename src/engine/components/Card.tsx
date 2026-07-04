import { type ReactNode } from 'react'
import './card.css'

interface CardProps {
  front: ReactNode
  back: ReactNode
  flipped: boolean
  onClick?: () => void
  className?: string
  ariaLabel?: string
}

export function FlipCard({ front, back, flipped, onClick, className, ariaLabel }: CardProps) {
  return (
    <div
      className={`exit-card card-scene ${className ?? ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={ariaLabel}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick()
      }}
    >
      <div className={`card-flip ${flipped ? 'is-flipped' : ''}`}>
        <div className="card-face front">{front}</div>
        <div className="card-face back">{back}</div>
      </div>
    </div>
  )
}

export function CardBack({
  label,
  deck,
  accent,
  icon,
}: {
  label: string
  deck: 'red' | 'blue' | 'green'
  accent: string
  icon?: ReactNode
}) {
  const deckColor = deck === 'red' ? '#7a1f1f' : deck === 'blue' ? '#1f3f6b' : '#1f5c34'
  return (
    <div className="card-back" style={{ background: `linear-gradient(155deg, ${deckColor}, ${deckColor}dd)`, borderColor: accent }}>
      <div className="card-back-frame" style={{ borderColor: accent }}>
        <div className="card-back-icon" style={{ color: accent }}>{icon}</div>
        <div className="card-back-label" style={{ color: accent }}>{label}</div>
      </div>
    </div>
  )
}

export function LockedCardBack({ label }: { label: string }) {
  return (
    <div className="card-back locked">
      <div className="card-back-frame locked">
        <div className="card-back-label">{label}</div>
        <div className="lock-glyph">?</div>
      </div>
    </div>
  )
}
