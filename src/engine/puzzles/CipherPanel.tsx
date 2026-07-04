import '../puzzles/puzzles.css'

interface CipherPanelProps {
  prompt: string
  cipherText: string
  keyMap: Record<string, string>
}

/** Substitution-cipher display: ciphered text plus its key legend.
 * Decoding happens in the player's head — matches the physical game exactly. */
export function CipherPanel({ prompt, cipherText, keyMap }: CipherPanelProps) {
  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <div className="cipher-text">{cipherText}</div>
      <div className="cipher-key-table">
        {Object.entries(keyMap).map(([k, v]) => (
          <div className="cipher-key-cell" key={k}>
            <b>{k}</b>{v}
          </div>
        ))}
      </div>
    </div>
  )
}
