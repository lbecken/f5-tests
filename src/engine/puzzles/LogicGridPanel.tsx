import { useState } from 'react'
import '../puzzles/puzzles.css'

interface LogicGridPanelProps {
  prompt: string
  clues: string[]
  rows: string[]
  cols: string[]
}

type Mark = '' | 'yes' | 'no'

/** Logic-grid deduction puzzle: clues plus a scratch grid the player can click
 * to mark yes/no while eliminating possibilities. Purely a thinking aid — the
 * derived answer is typed into the code field. */
export function LogicGridPanel({ prompt, clues, rows, cols }: LogicGridPanelProps) {
  const [marks, setMarks] = useState<Record<string, Mark>>({})

  const cycle = (key: string) =>
    setMarks((m) => {
      const cur = m[key] ?? ''
      const next: Mark = cur === '' ? 'yes' : cur === 'yes' ? 'no' : ''
      return { ...m, [key]: next }
    })

  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <ul className="logic-clues">
        {clues.map((c, i) => <li key={i}>{i + 1}. {c}</li>)}
      </ul>
      <table className="logic-grid-table">
        <thead>
          <tr><th />{cols.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th>{r}</th>
              {cols.map((c) => {
                const key = `${r}|${c}`
                const mark = marks[key] ?? ''
                return (
                  <td key={c} className={mark === 'yes' ? 'mark-yes' : mark === 'no' ? 'mark-no' : ''} onClick={() => cycle(key)}>
                    {mark === 'yes' ? '✓' : mark === 'no' ? '✗' : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
