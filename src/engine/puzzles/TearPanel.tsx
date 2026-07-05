import { useState, type ReactNode } from 'react'
import '../puzzles/puzzles.css'

interface TearPanelProps {
  prompt: string
  /** The intact face of the card/ticket */
  intact: ReactNode
  /** What the tear exposes (under-layer, stub edge…) */
  revealed: ReactNode
  tearLabel?: string
}

/** The series' signature destructive act, digitized: press and hold the perforation
 * to tear the card — a progress rip crosses the card and the torn state is final
 * for the session. The hesitation before tearing is part of the experience. */
export function TearPanel({ prompt, intact, revealed, tearLabel = 'Hold to tear along the perforation' }: TearPanelProps) {
  const [progress, setProgress] = useState(0)
  const [timer, setTimer] = useState<number | null>(null)
  const torn = progress >= 100

  const startTear = () => {
    if (torn || timer) return
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { window.clearInterval(id); return 100 }
        return p + 4
      })
    }, 40)
    setTimer(id)
  }
  const stopTear = () => {
    if (timer) window.clearInterval(timer)
    setTimer(null)
    if (!torn) setProgress(0)
  }

  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <div className={`tear-stage ${torn ? 'torn' : ''}`}>
        <div className="tear-intact" style={{ clipPath: torn ? 'polygon(0 0, 100% 0, 100% 34%, 96% 38%, 91% 34%, 85% 39%, 79% 35%, 72% 40%, 64% 35%, 57% 39%, 49% 35%, 42% 40%, 35% 36%, 28% 40%, 20% 35%, 13% 39%, 6% 35%, 0 38%)' : undefined }}>
          {intact}
        </div>
        {torn && <div className="tear-revealed fade-up">{revealed}</div>}
        {!torn && progress > 0 && (
          <div className="tear-progress" style={{ width: `${progress}%` }} />
        )}
      </div>
      {!torn && (
        <button
          className="btn secondary"
          onPointerDown={startTear}
          onPointerUp={stopTear}
          onPointerLeave={stopTear}
        >
          ✂ {tearLabel}
        </button>
      )}
      {torn && <p className="symbol-tally">Torn. There is no taping it back together.</p>}
    </div>
  )
}
