import { useState } from 'react'
import '../puzzles/puzzles.css'

interface Star {
  id: string
  x: number
  y: number
  /** Visual size of the star — often the ordering key ("brightest first") */
  size: number
  label?: string
}

interface ConstellationPanelProps {
  prompt: string
  stars: Star[]
  width?: number
  height?: number
}

/** Connect-the-stars: the player clicks stars in whatever order they believe is
 * right; a line traces their path. The shape (or the visit order itself) is the
 * information — validation happens at the code entry, never here. */
export function ConstellationPanel({ prompt, stars, width = 320, height = 210 }: ConstellationPanelProps) {
  const [path, setPath] = useState<string[]>([])
  const byId = Object.fromEntries(stars.map((s) => [s.id, s]))

  const click = (id: string) =>
    setPath((p) => (p.includes(id) ? p : [...p, id]))

  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="constellation-svg">
        <rect width={width} height={height} fill="#0a0e1c" rx="8" />
        {Array.from({ length: 40 }).map((_, i) => (
          <circle key={i} cx={(i * 61) % width} cy={(i * 83 + 13) % height} r="0.7" fill="#8899bb" opacity="0.5" />
        ))}
        {path.slice(1).map((id, i) => (
          <line
            key={i}
            x1={byId[path[i]].x} y1={byId[path[i]].y}
            x2={byId[id].x} y2={byId[id].y}
            stroke="var(--accent)" strokeWidth="1.6" opacity="0.9"
          />
        ))}
        {stars.map((s) => (
          <g key={s.id} className="constellation-star" onClick={() => click(s.id)}>
            <circle cx={s.x} cy={s.y} r={s.size + 7} fill="transparent" />
            <circle cx={s.x} cy={s.y} r={s.size} fill={path.includes(s.id) ? 'var(--accent)' : '#e8ecff'} />
            {s.label && <text x={s.x + s.size + 4} y={s.y + 3.5} fontSize="9" fill="#aab4d4">{s.label}</text>}
          </g>
        ))}
      </svg>
      <div className="anagram-actions">
        <button className="btn secondary" onClick={() => setPath([])}>Clear tracing</button>
        <span className="symbol-tally">{path.length ? `Traced ${path.length} star${path.length > 1 ? 's' : ''}.` : 'Click stars to trace a line between them.'}</span>
      </div>
    </div>
  )
}
