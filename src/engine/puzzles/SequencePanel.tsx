import '../puzzles/puzzles.css'

interface SequencePanelProps {
  prompt: string
  items: string[] // use '?' for the blank slot
}

/** Pattern-completion / arithmetic-sequence puzzle: a row of terms with one
 * blank the player must derive from the pattern. */
export function SequencePanel({ prompt, items }: SequencePanelProps) {
  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <div className="sequence-row">
        {items.map((it, i) => (
          <span key={i} className={`sequence-item ${it === '?' ? 'blank' : ''}`}>{it}</span>
        ))}
      </div>
    </div>
  )
}
