import { useState } from 'react'
import '../puzzles/puzzles.css'

interface MirrorPanelProps {
  prompt: string
  mirroredText: string
}

/** Mirror-writing puzzle: text is printed backwards; a "hold to a mirror" lens toggle
 * flips it via CSS so it reads normally. */
export function MirrorPanel({ prompt, mirroredText }: MirrorPanelProps) {
  const [usingMirror, setUsingMirror] = useState(false)
  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <div className="mirror-box" style={{ transform: usingMirror ? 'none' : 'scaleX(-1)' }}>{mirroredText}</div>
      <button className="btn secondary" onClick={() => setUsingMirror((v) => !v)}>
        {usingMirror ? 'Put the mirror down' : 'Hold up to a mirror'}
      </button>
    </div>
  )
}
