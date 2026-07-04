import { useState } from 'react'
import { playChime } from '../audio'
import './codeEntry.css'

interface CodeEntryProps {
  entryHint?: string
  wrongAttempts: number
  disabled: boolean
  onSubmit: (code: string) => 'correct' | 'wrong' | 'decoy'
  onOpenDecoder?: () => void
  showDecoderButton?: boolean
}

export function CodeEntry({ entryHint, wrongAttempts, disabled, onSubmit, onOpenDecoder, showDecoderButton }: CodeEntryProps) {
  const [value, setValue] = useState('')
  const [shake, setShake] = useState(false)
  const [flash, setFlash] = useState<'correct' | 'decoy' | null>(null)

  const submit = () => {
    if (!value.trim() || disabled) return
    const result = onSubmit(value)
    if (result === 'wrong') {
      setShake(true)
      playChime('wrong')
      window.setTimeout(() => setShake(false), 500)
    } else {
      setFlash(result === 'decoy' ? 'decoy' : 'correct')
      window.setTimeout(() => setFlash(null), 900)
      setValue('')
    }
  }

  return (
    <div className={`code-entry ${shake ? 'shake' : ''}`}>
      {entryHint && <p className="code-entry-hint">{entryHint}</p>}
      <div className="code-entry-row">
        <input
          className="mono code-input"
          placeholder="Enter code…"
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="btn" disabled={disabled || !value.trim()} onClick={submit}>Submit</button>
        {showDecoderButton && onOpenDecoder && (
          <button className="btn secondary" onClick={onOpenDecoder}>Open Decoder</button>
        )}
      </div>
      {wrongAttempts > 0 && !disabled && (
        <p className="code-entry-attempts">{wrongAttempts} incorrect attempt{wrongAttempts > 1 ? 's' : ''} so far — a hint may help.</p>
      )}
      {flash === 'correct' && <p className="code-entry-flash correct">✓ Correct — go find the matching card in the Answer Deck.</p>}
      {flash === 'decoy' && <p className="code-entry-flash decoy">That number leads somewhere… but not forward. Check the Answer Deck.</p>}
    </div>
  )
}
