import { useState, type ReactNode } from 'react'
import '../puzzles/puzzles.css'

interface LensPanelProps {
  prompt: string
  /** e.g. "Hold up the UV lamp", "Switch to thermal view", "Wait for moonlight" */
  lensLabel: string
  /** Content always visible */
  base: ReactNode
  /** Content that only appears while the lens is active (rendered above base) */
  hidden: ReactNode
  /** Tint wash while the lens is on, e.g. 'rgba(80,40,160,0.35)' for UV */
  tint?: string
  /** If set, the lens only works when this object is in the player's tray */
  requiresItem?: { id: string; hint: string }
  inventory?: string[]
}

/** The digital "blacklight": a lamp the player must actively hold on (pointer down,
 * or toggled via keyboard) to expose invisible ink. Optionally gated on an inventory
 * item, mirroring the physical games' strange-item dependencies. */
export function LensPanel({ prompt, lensLabel, base, hidden, tint, requiresItem, inventory = [] }: LensPanelProps) {
  const [held, setHeld] = useState(false)
  const [locked, setLocked] = useState(false) // keyboard/accessibility toggle
  const hasItem = !requiresItem || inventory.includes(requiresItem.id)
  const active = hasItem && (held || locked)

  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <div className={`lens-stage ${active ? 'lens-on' : ''}`}>
        <div className="lens-base">{base}</div>
        <div className="lens-hidden" aria-hidden={!active}>{hidden}</div>
        {active && tint && <div className="lens-tint" style={{ background: tint }} />}
      </div>
      {hasItem ? (
        <button
          className="btn secondary"
          onPointerDown={() => setHeld(true)}
          onPointerUp={() => setHeld(false)}
          onPointerLeave={() => setHeld(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLocked((v) => !v) } }}
        >
          {active ? 'Keep holding…' : lensLabel}
        </button>
      ) : (
        <p className="lens-missing">🔒 {requiresItem!.hint}</p>
      )}
    </div>
  )
}
