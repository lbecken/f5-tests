import '../puzzles/puzzles.css'

interface CipherPanelProps {
  prompt: string
  cipherText: string
  /** Full substitution key. Omit it to make the player FIND the rule themselves —
   * a plain alphabet strip is shown as scratch reference instead. */
  keyMap?: Record<string, string>
  /** Extra engraved fragment displayed under the ciphertext (often the rule, hidden in flavor) */
  engraving?: string
}

/** Substitution-cipher display. Decoding happens in the player's head — the
 * engine never validates here, matching the physical game exactly. */
export function CipherPanel({ prompt, cipherText, keyMap, engraving }: CipherPanelProps) {
  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <div className="cipher-text">{cipherText}</div>
      {engraving && <p className="cipher-engraving">{engraving}</p>}
      {keyMap ? (
        <div className="cipher-key-table">
          {Object.entries(keyMap).map(([k, v]) => (
            <div className="cipher-key-cell" key={k}>
              <b>{k}</b>{v}
            </div>
          ))}
        </div>
      ) : (
        <div className="cipher-alphabet mono">
          A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
        </div>
      )}
    </div>
  )
}
