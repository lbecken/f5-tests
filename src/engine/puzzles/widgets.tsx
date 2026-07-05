import '../puzzles/puzzles.css'

const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']

interface ClockFaceProps {
  /** Numeral printed at each of the 12 positions, clockwise from the top.
   * Defaults to the honest XII..XI — pass a scrambled array for a lying face. */
  numerals?: string[]
  /** Which POSITION (0 = top, clockwise) each hand points at */
  hourPos: number
  minutePos: number
  size?: number
  caption?: string
}

/** An ornate clock face whose numerals may lie. The positional count and the
 * printed numeral only agree on an honest clock — the gap between them is
 * exactly where a puzzle can live. */
export function ClockFace({ numerals = ROMAN, hourPos, minutePos, size = 200, caption }: ClockFaceProps) {
  const hourAngle = hourPos * 30
  const minuteAngle = minutePos * 30
  return (
    <figure className="clockface-fig">
      <svg viewBox="-110 -110 220 220" width={size} height={size}>
        <circle r="104" fill="none" stroke="currentColor" strokeWidth="5" />
        <circle r="96" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        {numerals.map((n, i) => {
          const a = (i * 30 - 90) * (Math.PI / 180)
          return (
            <text
              key={i}
              x={Math.cos(a) * 82}
              y={Math.sin(a) * 82 + 5}
              textAnchor="middle"
              fontSize="15"
              fontFamily="serif"
              fill="currentColor"
            >
              {n}
            </text>
          )
        })}
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i * 6 - 90) * (Math.PI / 180)
          const long = i % 5 === 0
          return (
            <line
              key={i}
              x1={Math.cos(a) * (long ? 90 : 94)} y1={Math.sin(a) * (long ? 90 : 94)}
              x2={Math.cos(a) * 97} y2={Math.sin(a) * 97}
              stroke="currentColor" strokeWidth={long ? 2 : 1} opacity="0.7"
            />
          )
        })}
        <line x1="0" y1="8" x2={Math.cos((hourAngle - 90) * Math.PI / 180) * 48} y2={Math.sin((hourAngle - 90) * Math.PI / 180) * 48} stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <line x1="0" y1="10" x2={Math.cos((minuteAngle - 90) * Math.PI / 180) * 72} y2={Math.sin((minuteAngle - 90) * Math.PI / 180) * 72} stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <circle r="6" fill="currentColor" />
      </svg>
      {caption && <figcaption className="widget-caption">{caption}</figcaption>}
    </figure>
  )
}

interface DialGaugeProps {
  label: string
  /** 0..max, needle position */
  value: number
  max: number
  /** How many major ticks to draw */
  ticks?: number
  size?: number
}

/** A round analog gauge — reading the needle is itself a small act of attention,
 * and a row of gauges hides a sequence in plain sight. */
export function DialGauge({ label, value, max, ticks = 10, size = 110 }: DialGaugeProps) {
  const start = -210
  const sweep = 240
  const angle = start + (value / max) * sweep
  return (
    <figure className="gauge-fig">
      <svg viewBox="-60 -60 120 120" width={size} height={size}>
        <circle r="55" fill="rgba(0,0,0,0.15)" stroke="currentColor" strokeWidth="3" />
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const a = (start + (i / ticks) * sweep) * (Math.PI / 180)
          return (
            <g key={i}>
              <line
                x1={Math.cos(a) * 42} y1={Math.sin(a) * 42}
                x2={Math.cos(a) * 50} y2={Math.sin(a) * 50}
                stroke="currentColor" strokeWidth="2"
              />
              <text x={Math.cos(a) * 33} y={Math.sin(a) * 33 + 3} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.8">
                {Math.round((i / ticks) * max)}
              </text>
            </g>
          )
        })}
        <line
          x1="0" y1="0"
          x2={Math.cos(angle * Math.PI / 180) * 40}
          y2={Math.sin(angle * Math.PI / 180) * 40}
          stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"
        />
        <circle r="4" fill="var(--accent)" />
      </svg>
      <figcaption className="widget-caption">{label}</figcaption>
    </figure>
  )
}
