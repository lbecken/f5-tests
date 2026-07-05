import { useEffect, useState } from 'react'
import type { ThemeManifest } from '../types'
import { playChime, playVoice, stopVoice } from '../audio'
import { themeArt } from '../assets'
import './winScreen.css'

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface WinScreenProps {
  theme: ThemeManifest
  elapsedMs: number
  hintsUsed: number
  wrongAttempts: number
  onMenu: () => void
}

export function WinScreen({ theme, elapsedMs, hintsUsed, wrongAttempts, onMenu }: WinScreenProps) {
  const Win = theme.winPage.body
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    playChime('win')
    return () => stopVoice()
  }, [])
  let rating = 'Escape Artist'
  const minutes = elapsedMs / 60000
  if (minutes > 90 || hintsUsed > 6) rating = 'Needs More Practice'
  else if (minutes > 60 || hintsUsed > 3) rating = 'Clever Explorer'
  else if (minutes > 30) rating = 'Sharp Detective'

  return (
    <div className="deck-modal-overlay">
      <div className="panel win-screen fade-up">
        <h2 className="display-font win-title">You Escaped!</h2>
        {theme.winPage.narrationUrl && (
          <button
            className="btn secondary"
            style={{ marginBottom: '0.8rem' }}
            onClick={() => {
              if (speaking) {
                stopVoice()
                setSpeaking(false)
              } else {
                const el = playVoice(theme.winPage.narrationUrl!)
                el.onended = () => setSpeaking(false)
                setSpeaking(true)
              }
            }}
          >
            {speaking ? '◼ Stop' : '🔊 Hear the ending'}
          </button>
        )}
        {themeArt(theme.id, 'page', 'win') && <img className="win-art" src={themeArt(theme.id, 'page', 'win')} alt="" />}
        <div className="win-body"><Win /></div>
        <div className="win-stats">
          <div><span>Time</span><strong>{formatTime(elapsedMs)}</strong></div>
          <div><span>Hints Used</span><strong>{hintsUsed}</strong></div>
          <div><span>Wrong Attempts</span><strong>{wrongAttempts}</strong></div>
          <div><span>Rating</span><strong>{rating}</strong></div>
        </div>
        <button className="btn" onClick={onMenu}>Return to Menu</button>
      </div>
    </div>
  )
}
