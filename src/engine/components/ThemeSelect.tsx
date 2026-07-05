import { useState } from 'react'
import type { ThemeManifest } from '../types'
import './themeSelect.css'

interface ThemeSelectProps {
  themes: ThemeManifest[]
  onPlay: (theme: ThemeManifest) => void
  hasSave: (id: string) => boolean
  onReset: (id: string) => void
}

export function ThemeSelect({ themes, onPlay, hasSave, onReset }: ThemeSelectProps) {
  const [examined, setExamined] = useState<string | null>(null)

  return (
    <div className="theme-select">
      <header className="theme-select-header">
        <h1 className="display-font">EXIT ENGINE</h1>
        <p>Choose your escape. Click a box to examine it closely — some hide a clue before you even open them.</p>
      </header>
      <div className="theme-grid">
        {themes.map((t) => {
          const isExamined = examined === t.id
          return (
            <div key={t.id} className="theme-box-scene card-scene">
              <div className={`theme-box ${isExamined ? 'is-flipped' : ''}`} style={{ ['--tp' as any]: t.palette.primary, ['--ta' as any]: t.palette.accent }}>
                <div
                  className="theme-box-face front"
                  onClick={() => setExamined(isExamined ? null : t.id)}
                >
                  <div className="theme-box-art"><t.coverArt /></div>
                  <h2 className="display-font">{t.title}</h2>
                  <p className="theme-tagline">{t.tagline}</p>
                  <div className="theme-difficulty" title={`Difficulty ${t.difficulty}/5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={n <= Math.round(t.difficulty) ? 'lock on' : 'lock'}>🔒</span>
                    ))}
                    <span className="theme-difficulty-label">
                      {t.difficulty <= 2.5 ? 'middle' : t.difficulty <= 3.5 ? 'experienced' : 'expert'}
                    </span>
                  </div>
                  <span className="theme-examine-hint">click box to examine</span>
                </div>
                <div className="theme-box-face back" onClick={() => setExamined(null)}>
                  <h3 className="display-font">Hidden on the underside…</h3>
                  <div className="theme-box-clue"><t.boxClue /></div>
                  <span className="theme-examine-hint">click to turn back</span>
                </div>
              </div>
              <div className="theme-box-actions">
                <p className="theme-synopsis">{t.synopsis}</p>
                <div className="theme-box-buttons">
                  <button className="btn" onClick={() => onPlay(t)}>{hasSave(t.id) ? 'Continue' : 'Begin'}</button>
                  {hasSave(t.id) && (
                    <button className="btn secondary" onClick={() => onReset(t.id)}>Restart</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
