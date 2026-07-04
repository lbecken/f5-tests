import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { DecoderConfig, DecoderRingConfig } from '../types'
import './decoder.css'

const RING_RADII = [2.55, 1.8, 1.05] as const
const RING_TRACK_COLOR = ['#3a2d1a', '#4a381f', '#5a4324']

function drawGlyph(ctx: CanvasRenderingContext2D, symbol: string) {
  ctx.save()
  ctx.translate(64, 44)
  ctx.lineWidth = 5
  switch (symbol) {
    case 'gear':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.save()
        ctx.rotate(a)
        ctx.fillRect(-4, -26, 8, 10)
        ctx.restore()
      }
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke()
      break
    case 'moon':
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill()
      break
    case 'flame':
      ctx.beginPath()
      ctx.moveTo(0, -22)
      ctx.bezierCurveTo(16, -6, 12, 10, 0, 22)
      ctx.bezierCurveTo(-12, 10, -16, -6, 0, -22)
      ctx.fill()
      break
    case 'wave':
      ctx.beginPath()
      ctx.moveTo(-24, -6)
      for (let x = -24; x <= 24; x += 4) ctx.lineTo(x, Math.sin(x / 6) * 10 - 6)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-24, 10)
      for (let x = -24; x <= 24; x += 4) ctx.lineTo(x, Math.sin(x / 6) * 10 + 10)
      ctx.stroke()
      break
    case 'eye':
      ctx.beginPath(); ctx.ellipse(0, 0, 24, 13, 0, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill()
      break
    case 'leaf':
      ctx.beginPath()
      ctx.moveTo(-18, 18); ctx.quadraticCurveTo(-20, -20, 20, -20); ctx.quadraticCurveTo(18, 20, -18, 18)
      ctx.fill()
      break
    case 'skull':
      ctx.beginPath(); ctx.arc(0, -4, 18, Math.PI, 0); ctx.lineTo(14, 14); ctx.lineTo(-14, 14); ctx.closePath(); ctx.fill()
      ctx.fillStyle = RING_TRACK_COLOR[0]
      ctx.beginPath(); ctx.arc(-7, -2, 4, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(7, -2, 4, 0, Math.PI * 2); ctx.fill()
      break
    case 'star': {
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 22 : 9
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2
        const x = Math.cos(a) * r
        const y = Math.sin(a) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath(); ctx.fill()
      break
    }
    case 'key':
      ctx.beginPath(); ctx.arc(-8, -8, 10, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(-1, -1); ctx.lineTo(20, 20); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(12, 12); ctx.lineTo(18, 6); ctx.stroke()
      break
    case 'clock':
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -13); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, 4); ctx.stroke()
      break
    case 'feather':
      ctx.beginPath(); ctx.moveTo(18, -20); ctx.quadraticCurveTo(-20, -18, -18, 20); ctx.stroke()
      for (let i = -14; i < 16; i += 8) { ctx.beginPath(); ctx.moveTo(i * -0.5 + 4, i * 0.6); ctx.lineTo(i, i + 8); ctx.stroke() }
      break
    case 'compass':
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(6, 0); ctx.lineTo(0, 16); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill()
      break
    default:
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

function makeSegmentTexture(symbol: string, digit: number, ink: string, paper: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.beginPath()
  ctx.arc(64, 64, 58, 0, Math.PI * 2)
  ctx.fillStyle = paper
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = ink
  ctx.stroke()
  ctx.strokeStyle = ink
  ctx.fillStyle = ink
  drawGlyph(ctx, symbol)
  ctx.font = 'bold 30px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(digit), 64, 100)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function planeAngle(clientX: number, clientY: number, camera: THREE.Camera, dom: HTMLElement) {
  const rect = dom.getBoundingClientRect()
  const x = ((clientX - rect.left) / rect.width) * 2 - 1
  const y = -((clientY - rect.top) / rect.height) * 2 + 1
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  const point = new THREE.Vector3()
  raycaster.ray.intersectPlane(plane, point)
  return Math.atan2(point.y, point.x)
}

interface RingProps {
  radius: number
  config: DecoderRingConfig
  trackColor: string
  ink: string
  paper: string
  onAligned: (idx: number) => void
}

function Ring({ radius, config, trackColor, ink, paper, onAligned }: RingProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const { camera, gl } = useThree()
  const dragging = useRef(false)
  const startAngle = useRef(0)
  const startRotation = useRef(0)
  const lastIdx = useRef(-1)
  const n = config.segments.length
  const step = (Math.PI * 2) / n

  const textures = useMemo(
    () => config.segments.map((seg) => makeSegmentTexture(seg.symbol, seg.digit, ink, paper)),
    [config, ink, paper],
  )

  const computeIdx = useCallback((rot: number) => {
    const raw = Math.round(-rot / step)
    return ((raw % n) + n) % n
  }, [n, step])

  useFrame(() => {
    if (!groupRef.current) return
    const idx = computeIdx(groupRef.current.rotation.z)
    if (idx !== lastIdx.current) {
      lastIdx.current = idx
      onAligned(idx)
    }
  })

  const onPointerDown = (e: any) => {
    e.stopPropagation()
    dragging.current = true
    startAngle.current = planeAngle(e.clientX, e.clientY, camera, gl.domElement)
    startRotation.current = groupRef.current.rotation.z
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return
      const angle = planeAngle(e.clientX, e.clientY, camera, gl.domElement)
      groupRef.current.rotation.z = startRotation.current + (angle - startAngle.current)
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      const idx = computeIdx(groupRef.current.rotation.z)
      groupRef.current.rotation.z = -idx * step
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [camera, gl, computeIdx, step])

  return (
    <>
      <mesh onPointerDown={onPointerDown}>
        <ringGeometry args={[radius - 0.42, radius + 0.42, 64]} />
        <meshBasicMaterial color={trackColor} side={THREE.DoubleSide} />
      </mesh>
      <group ref={groupRef}>
        {config.segments.map((_, i) => {
          const a = Math.PI / 2 + i * step
          return (
            <mesh key={i} position={[Math.cos(a) * radius, Math.sin(a) * radius, 0.01]}>
              <planeGeometry args={[0.62, 0.62]} />
              <meshBasicMaterial map={textures[i]} transparent />
            </mesh>
          )
        })}
      </group>
    </>
  )
}

function PointerMarker() {
  return (
    <mesh position={[0, RING_RADII[0] + 0.55, 0.02]} rotation={[0, 0, Math.PI]}>
      <coneGeometry args={[0.14, 0.28, 3]} />
      <meshBasicMaterial color="#c9a24b" />
    </mesh>
  )
}

interface DecoderSceneProps {
  config: DecoderConfig
  ink: string
  paper: string
  onCodeChange: (code: string) => void
}

function DecoderScene({ config, ink, paper, onCodeChange }: DecoderSceneProps) {
  const digits = useRef<number[]>([0, 0, 0])

  const handleAligned = (ringIdx: number) => (segIdx: number) => {
    digits.current[ringIdx] = config.rings[ringIdx].segments[segIdx].digit
    onCodeChange(digits.current.join(''))
  }

  return (
    <Canvas orthographic camera={{ position: [0, 0, 10], zoom: 62 }} style={{ background: 'transparent' }}>
      <mesh position={[0, 0, -0.1]}>
        <circleGeometry args={[RING_RADII[0] + 0.9, 64]} />
        <meshBasicMaterial color="#100c08" />
      </mesh>
      {RING_RADII.map((r, i) => (
        <Ring
          key={i}
          radius={r}
          config={config.rings[i]}
          trackColor={RING_TRACK_COLOR[i]}
          ink={ink}
          paper={paper}
          onAligned={handleAligned(i)}
        />
      ))}
      <PointerMarker />
    </Canvas>
  )
}

export function Decoder({ config, ink, paper }: { config: DecoderConfig; ink: string; paper: string }) {
  const [code, setCode] = useState('000')
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="decoder-wrap">
      <div className={`decoder-flip ${flipped ? 'is-flipped' : ''}`}>
        <div className="decoder-face front">
          <div className="decoder-canvas-box">
            <DecoderScene config={config} ink={ink} paper={paper} onCodeChange={setCode} />
          </div>
          <div className="decoder-readout mono">{code}</div>
          <p className="decoder-instructions">Drag each ring to align the clue's symbols under the marker.</p>
        </div>
        <div className="decoder-face back panel">
          <config.backClue />
        </div>
      </div>
      <button className="btn secondary decoder-flip-btn" onClick={() => setFlipped((v) => !v)}>
        {flipped ? 'Show Dials' : 'Turn Decoder Over'}
      </button>
    </div>
  )
}
