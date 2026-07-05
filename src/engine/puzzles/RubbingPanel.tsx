import { useEffect, useRef, type ReactNode } from 'react'
import { playChime } from '../audio'
import '../puzzles/puzzles.css'

interface RubbingPanelProps {
  prompt: string
  /** What emerges beneath the rubbing */
  hidden: ReactNode
  /** Color of the obscuring layer (soot, dust, frost, wax…) */
  maskColor?: string
  maskLabel?: string
  height?: number
}

/** The pencil-rubbing / scratch-off classic: an opaque layer of soot or frost that
 * the player physically rubs away with the pointer to expose what's underneath. */
export function RubbingPanel({ prompt, hidden, maskColor = '#3a3126', maskLabel = 'rub to clear', height = 170 }: RubbingPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rubbing = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.fillStyle = maskColor
    ctx.fillRect(0, 0, rect.width, rect.height)
    // grainy texture so it reads as soot/frost rather than flat paint
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`
      ctx.fillRect(Math.random() * rect.width, Math.random() * rect.height, 2, 2)
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '13px serif'
    ctx.textAlign = 'center'
    ctx.fillText(maskLabel, rect.width / 2, rect.height / 2)
  }, [maskColor, maskLabel])

  const rub = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!rubbing.current) return
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')!
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(e.clientX - rect.left, e.clientY - rect.top, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }

  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <div className="rubbing-stage" style={{ height }}>
        <div className="rubbing-hidden">{hidden}</div>
        <canvas
          ref={canvasRef}
          className="rubbing-mask"
          onPointerDown={(e) => { rubbing.current = true; playChime('rub'); (e.target as HTMLElement).setPointerCapture(e.pointerId); rub(e) }}
          onPointerMove={rub}
          onPointerUp={() => { rubbing.current = false }}
        />
      </div>
    </div>
  )
}
