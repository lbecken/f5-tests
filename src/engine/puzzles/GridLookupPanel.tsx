import type { ReactNode } from 'react'
import '../puzzles/puzzles.css'

interface GridLookupPanelProps {
  prompt: string
  colHeaders: string[]
  rowHeaders: string[]
  /** cells[row][col] */
  cells: ReactNode[][]
  caption?: string
}

/** A coordinate grid (map, seating plan, star chart, storeroom shelf…): worthless
 * on its own — the coordinates that index into it live on other cards, in the
 * booklet, or on an item, forcing the cross-referencing the physical games love. */
export function GridLookupPanel({ prompt, colHeaders, rowHeaders, cells, caption }: GridLookupPanelProps) {
  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <div className="grid-lookup-scroll">
        <table className="grid-lookup-table">
          <thead>
            <tr>
              <th />
              {colHeaders.map((c) => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rowHeaders.map((r, ri) => (
              <tr key={r}>
                <th>{r}</th>
                {colHeaders.map((_, ci) => <td key={ci}>{cells[ri]?.[ci] ?? ''}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && <p className="symbol-tally">{caption}</p>}
    </div>
  )
}
