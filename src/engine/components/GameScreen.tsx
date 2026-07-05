import { useEffect, useState } from 'react'
import type { ThemeManifest } from '../types'
import { useGameStore, useThemeSave } from '../store'
import { ambientEngine, playChime, playVoice } from '../audio'
import { blueVoice, themeMusic } from '../assets'
import { DrawnBoard } from './DrawnBoard'
import { PuzzleModal } from './PuzzleModal'
import { DeckBrowser } from './DeckBrowser'
import { Booklet } from './Booklet'
import { ObjectTray } from './ObjectTray'
import { Decoder } from './Decoder'
import { WinScreen } from './WinScreen'
import './gameScreen.css'

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function GameScreen({ theme, onExit }: { theme: ThemeManifest; onExit: () => void }) {
  const save = useThemeSave(theme.id)
  const drawRed = useGameStore((s) => s.drawRed)
  const revealBlue = useGameStore((s) => s.revealBlue)
  const dismissPendingBlue = useGameStore((s) => s.dismissPendingBlue)
  const tick = useGameStore((s) => s.tick)
  const musicOn = useGameStore((s) => s.musicOn)
  const toggleMusic = useGameStore((s) => s.toggleMusic)

  const [selectedRed, setSelectedRed] = useState<string | null>(null)
  const [redDeckOpen, setRedDeckOpen] = useState(false)
  const [blueDeckOpen, setBlueDeckOpen] = useState(false)
  const [bookletOpen, setBookletOpen] = useState(false)
  const [decoderOpen, setDecoderOpen] = useState(false)

  useEffect(() => {
    document.documentElement.style.setProperty('--primary', theme.palette.primary)
    document.documentElement.style.setProperty('--secondary', theme.palette.secondary)
    document.documentElement.style.setProperty('--accent', theme.palette.accent)
    document.documentElement.style.setProperty('--bg', theme.palette.bg)
    document.documentElement.style.setProperty('--paper', theme.palette.paper)
    document.documentElement.style.setProperty('--ink', theme.palette.ink)
  }, [theme])

  const solvedCount = save ? Object.values(save.drawnRed).filter((d) => d.solved).length : 0
  const totalRed = Object.keys(theme.redCards).length
  const progress = totalRed ? solvedCount / totalRed : 0

  useEffect(() => {
    if (musicOn) ambientEngine.start({ ...theme.music, tracks: theme.music.tracks ?? themeMusic(theme.id) }, progress)
    else ambientEngine.stop()
    return () => ambientEngine.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicOn, theme])

  useEffect(() => {
    ambientEngine.setIntensity(progress)
  }, [progress])

  useEffect(() => {
    const id = window.setInterval(() => tick(1000), 1000)
    return () => window.clearInterval(id)
  }, [tick])

  useEffect(() => {
    if (save?.pendingBlue) setBlueDeckOpen(true)
  }, [save?.pendingBlue])

  if (!save) return null

  const hintsUsed = Object.values(save.drawnRed).reduce((sum, d) => sum + d.hintLevel, 0)
  const wrongAttempts = Object.values(save.drawnRed).reduce((sum, d) => sum + d.wrongAttempts, 0)

  return (
    <div className="game-screen">
      <header className="game-hud">
        <div className="game-hud-title">
          <button className="btn secondary" onClick={onExit}>← Menu</button>
          <h1 className="display-font">{theme.title}</h1>
        </div>
        <div className="game-hud-actions">
          <span className="mono game-timer">{formatTime(save.elapsedMs)}</span>
          <button className="btn secondary" onClick={toggleMusic}>{musicOn ? '♪ Music On' : '♪ Music Off'}</button>
        </div>
      </header>

      <div className="game-layout">
        <main className="game-main">
          <div className="game-main-toolbar">
            <button className="btn" onClick={() => setRedDeckOpen(true)}>Puzzle Deck</button>
            <button className="btn secondary" onClick={() => setBookletOpen(true)}>Story Booklet</button>
          </div>
          <DrawnBoard theme={theme} drawnRed={save.drawnRed} onSelect={setSelectedRed} />

          {save.decoyMessages.length > 0 && (
            <div className="decoy-log panel">
              <h3 className="display-font">Answer Deck Notes</h3>
              {save.decoyMessages.map((m, i) => (
                <p key={i} className="decoy-log-entry">{m}</p>
              ))}
            </div>
          )}
        </main>

        <aside className="game-sidebar">
          <div className="decoder-panel panel">
            <h3 className="display-font">Decoder</h3>
            <Decoder config={theme.decoder} ink={theme.palette.ink} paper={theme.palette.paper} />
          </div>
          <ObjectTray theme={theme} inventory={save.inventory} />
        </aside>
      </div>

      {selectedRed && (
        <PuzzleModal
          theme={theme}
          redId={selectedRed}
          onClose={() => setSelectedRed(null)}
          onOpenDecoder={() => setDecoderOpen(true)}
        />
      )}

      <DeckBrowser
        theme={theme}
        deck="red"
        open={redDeckOpen}
        onClose={() => setRedDeckOpen(false)}
        unlockedIds={save.unlockedRed}
        drawnIds={Object.keys(save.drawnRed)}
        onDraw={(id) => drawRed(theme, id)}
      />

      <DeckBrowser
        theme={theme}
        deck="blue"
        open={blueDeckOpen}
        onClose={() => {
          setBlueDeckOpen(false)
          if (save.pendingBlue) dismissPendingBlue()
        }}
        unlockedIds={[]}
        drawnIds={save.solvedBluePile}
        highlightId={save.pendingBlue?.blueId ?? null}
        onDraw={() => {
          const pending = save.pendingBlue
          if (pending) {
            const blue = theme.blueCards[pending.blueId]
            const narration = blueVoice(theme.id, pending.blueId)
            if (narration) {
              window.setTimeout(() => playVoice(narration), 500)
            } else if (pending.result === 'correct' && blue && (blue.unlocksBooklet?.length || blue.outcome === 'win')) {
              playChime('story')
            } else if (pending.result === 'correct') {
              playChime('correct')
            }
          }
          revealBlue(theme)
        }}
      />

      <Booklet theme={theme} unlockedIds={save.bookletUnlocked} open={bookletOpen} onClose={() => setBookletOpen(false)} />

      {decoderOpen && (
        <div className="deck-modal-overlay" onClick={() => setDecoderOpen(false)}>
          <div className="panel decoder-modal" onClick={(e) => e.stopPropagation()}>
            <div className="deck-modal-header">
              <h2 className="display-font">Decoder</h2>
              <button className="btn secondary" onClick={() => setDecoderOpen(false)}>Close</button>
            </div>
            <Decoder config={theme.decoder} ink={theme.palette.ink} paper={theme.palette.paper} />
          </div>
        </div>
      )}

      {save.won && (
        <WinScreen theme={theme} elapsedMs={save.elapsedMs} hintsUsed={hintsUsed} wrongAttempts={wrongAttempts} onMenu={onExit} />
      )}
    </div>
  )
}
