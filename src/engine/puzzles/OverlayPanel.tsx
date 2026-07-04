import { useRef, useState, type ReactNode, type PointerEvent } from 'react'
import '../puzzles/puzzles.css'

interface OverlayPanelProps {
  prompt: string
  base: ReactNode
  overlay: ReactNode
}

/** Transparency-overlay puzzle: drag a semi-transparent acetate layer over the
 * base image; only where marks overlap does the hidden message emerge. */
export function OverlayPanel({ prompt, base, overlay }: OverlayPanelProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 40, y: 40 })
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })

  const onDown = (e: PointerEvent) => {
    dragging.current = true
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    if (!dragging.current) return
    setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y })
  }
  const onUp = () => { dragging.current = false }

  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <div className="overlay-stage" ref={stageRef} onPointerMove={onMove} onPointerUp={onUp}>
        <div className="overlay-base">{base}</div>
        <div
          className="overlay-layer"
          style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, width: '70%', height: '70%' }}
          onPointerDown={onDown}
        >
          {overlay}
        </div>
      </div>
      <p className="symbol-tally">Drag the transparent sheet over the image to align it.</p>
    </div>
  )
}
