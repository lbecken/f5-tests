import { useState } from 'react'
import '../puzzles/puzzles.css'

interface MirrorPanelProps {
  prompt: string
  mirroredText: string
  /** If set, the player must hold this object before the mirror works */
  requiresItem?: { id: string; hint: string }
  inventory?: string[]
}

/** Mirror-writing puzzle: text is printed backwards; holding a mirror up
 * (optionally an inventory item, like the physical games' strange items)
 * flips it via CSS so it reads normally. */
export function MirrorPanel({ prompt, mirroredText, requiresItem, inventory = [] }: MirrorPanelProps) {
  const [usingMirror, setUsingMirror] = useState(false)
  const hasItem = !requiresItem || inventory.includes(requiresItem.id)
  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <div className="mirror-box" style={{ transform: usingMirror && hasItem ? 'none' : 'scaleX(-1)' }}>{mirroredText}</div>
      {hasItem ? (
        <button className="btn secondary" onClick={() => setUsingMirror((v) => !v)}>
          {usingMirror ? 'Put the mirror down' : 'Hold up to a mirror'}
        </button>
      ) : (
        <p className="lens-missing">🔒 {requiresItem!.hint}</p>
      )}
    </div>
  )
}
