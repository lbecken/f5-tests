import { useState, type ReactNode } from 'react'
import { playChime } from '../audio'
import '../puzzles/puzzles.css'

interface FoldPanelProps {
  prompt: string
  topContent: ReactNode
  bottomContent: ReactNode
  foldedContent: ReactNode
}

/** Fold puzzle: the card's top half hinges down (CSS 3D rotateX) onto the bottom
 * half, replicating the physical "fold this card in half" mechanic — the folded
 * state reveals a composite that wasn't visible either half alone. */
export function FoldPanel({ prompt, topContent, bottomContent, foldedContent }: FoldPanelProps) {
  const [folded, setFolded] = useState(false)
  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <div className="fold-scene">
        <div className={`fold-card ${folded ? 'folded' : ''}`}>
          <div className="fold-half fold-bottom">{folded ? foldedContent : bottomContent}</div>
          <div className="fold-half fold-top">{topContent}</div>
        </div>
      </div>
      <button className="btn secondary" onClick={() => { playChime('fold'); setFolded((v) => !v) }}>
        {folded ? 'Unfold the card' : 'Fold the card in half'}
      </button>
    </div>
  )
}
