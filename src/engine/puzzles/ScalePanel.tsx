import { useMemo, useState } from 'react'
import '../puzzles/puzzles.css'

interface WeighItem {
  id: string
  label: string
  /** Hidden from the player — only expressed through the beam's tilt */
  weight: number
}

interface ScalePanelProps {
  prompt: string
  items: WeighItem[]
}

/** An interactive balance scale: the player loads any combination of items onto the
 * two pans and reads the tilt. Weights are never printed — like the physical games'
 * deduction puzzles, the ordering must be established experimentally. */
export function ScalePanel({ prompt, items }: ScalePanelProps) {
  const [pans, setPans] = useState<Record<string, 'left' | 'right' | null>>(
    () => Object.fromEntries(items.map((i) => [i.id, null])),
  )

  const { left, right } = useMemo(() => {
    let left = 0
    let right = 0
    for (const item of items) {
      if (pans[item.id] === 'left') left += item.weight
      if (pans[item.id] === 'right') right += item.weight
    }
    return { left, right }
  }, [pans, items])

  const tilt = Math.max(-9, Math.min(9, (right - left) * 1.2))

  const cycle = (id: string) =>
    setPans((p) => {
      const cur = p[id]
      const next = cur === null ? 'left' : cur === 'left' ? 'right' : null
      return { ...p, [id]: next }
    })

  const panItems = (side: 'left' | 'right') => items.filter((i) => pans[i.id] === side)

  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <div className="scale-stage">
        <svg viewBox="0 0 300 130" className="scale-svg">
          <line x1="150" y1="118" x2="150" y2="30" stroke="currentColor" strokeWidth="5" />
          <path d="M130 118h40l6 8h-52z" fill="currentColor" />
          <g transform={`rotate(${tilt} 150 32)`}>
            <line x1="55" y1="32" x2="245" y2="32" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            <line x1="55" y1="32" x2="55" y2="58" stroke="currentColor" strokeWidth="2" />
            <line x1="245" y1="32" x2="245" y2="58" stroke="currentColor" strokeWidth="2" />
            <path d="M30 58 h50 l-8 14 h-34 z" fill="currentColor" opacity="0.85" />
            <path d="M220 58 h50 l-8 14 h-34 z" fill="currentColor" opacity="0.85" />
            <text x="55" y="70" textAnchor="middle" fontSize="10" fill="var(--paper)">
              {panItems('left').map((i) => i.label.slice(0, 2)).join('·')}
            </text>
            <text x="245" y="70" textAnchor="middle" fontSize="10" fill="var(--paper)">
              {panItems('right').map((i) => i.label.slice(0, 2)).join('·')}
            </text>
          </g>
          <circle cx="150" cy="32" r="5" fill="currentColor" />
        </svg>
        <p className="scale-verdict">
          {left === 0 && right === 0
            ? 'Both pans empty.'
            : left === right
              ? '⚖ Perfectly balanced.'
              : tilt > 0
                ? '↘ The right pan sinks.'
                : '↙ The left pan sinks.'}
        </p>
      </div>
      <div className="scale-items">
        {items.map((item) => (
          <button
            key={item.id}
            className={`scale-chip ${pans[item.id] ?? 'off'}`}
            onClick={() => cycle(item.id)}
          >
            {item.label}
            <span className="scale-chip-side">{pans[item.id] === 'left' ? '← left pan' : pans[item.id] === 'right' ? 'right pan →' : 'on the bench'}</span>
          </button>
        ))}
      </div>
      <p className="symbol-tally">Click an item to move it: bench → left pan → right pan → bench.</p>
    </div>
  )
}
