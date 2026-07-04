import { useRef, useState, type PointerEvent } from 'react'
import '../puzzles/puzzles.css'

interface Circle {
  id: string
  color: string
  x: number
  y: number
}

interface ColorMixerPanelProps {
  prompt: string
  circles: Circle[]
  legend: { color: string; label: string }[]
}

/** Color-mixing puzzle: drag semi-transparent colored circles over one another
 * (mix-blend-mode: multiply) to produce a target hue, then match it in the legend. */
export function ColorMixerPanel({ prompt, circles, legend }: ColorMixerPanelProps) {
  const [positions, setPositions] = useState(() => Object.fromEntries(circles.map((c) => [c.id, { x: c.x, y: c.y }])))
  const stageRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<string | null>(null)

  const onDown = (id: string) => (e: PointerEvent) => {
    dragging.current = id
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    if (!dragging.current || !stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setPositions((p) => ({ ...p, [dragging.current!]: { x, y } }))
  }
  const onUp = () => { dragging.current = null }

  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <div className="mixer-stage" ref={stageRef} onPointerMove={onMove} onPointerUp={onUp}>
        {circles.map((c) => (
          <div
            key={c.id}
            className="mixer-circle"
            style={{ background: c.color, left: positions[c.id].x - 45, top: positions[c.id].y - 45 }}
            onPointerDown={onDown(c.id)}
          />
        ))}
      </div>
      <div className="mixer-legend">
        {legend.map((l) => (
          <span className="mixer-legend-item" key={l.label}>
            <span className="mixer-swatch" style={{ background: l.color }} /> {l.label}
          </span>
        ))}
      </div>
    </div>
  )
}
