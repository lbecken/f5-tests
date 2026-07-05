import { useEffect, useMemo, useState } from 'react'
import type { ThemeManifest } from '../types'
import { playVoice, stopVoice, playChime } from '../audio'
import { themeArt, pageVoice } from '../assets'
import './booklet.css'

interface BookletProps {
  theme: ThemeManifest
  unlockedIds: string[]
  open: boolean
  onClose: () => void
}

export function Booklet({ theme, unlockedIds, open, onClose }: BookletProps) {
  const [pageIdx, setPageIdx] = useState(0)

  const pages = useMemo(() => {
    const extra = unlockedIds.map((id) => theme.storyPages[id]).filter(Boolean)
    return [...theme.intro, ...extra].sort((a, b) => a.order - b.order)
  }, [theme, unlockedIds])

  const [speaking, setSpeaking] = useState(false)
  useEffect(() => () => stopVoice(), [])
  useEffect(() => { stopVoice(); setSpeaking(false) }, [pageIdx, open])

  if (!open) return null
  const page = pages[Math.min(pageIdx, pages.length - 1)]
  const Body = page?.body
  const narration = page ? (page.narrationUrl ?? pageVoice(theme.id, page.id)) : undefined
  const pageArt = page ? themeArt(theme.id, 'page', page.id) : undefined

  return (
    <div className="deck-modal-overlay" onClick={onClose}>
      <div className="booklet panel" onClick={(e) => e.stopPropagation()}>
        <div className="booklet-header">
          <h2 className="display-font">The Story So Far</h2>
          <button className="btn secondary" onClick={onClose}>Close</button>
        </div>
        <div className="booklet-page fade-up" key={page?.id}>
          {page && (
            <>
              <h3 className="display-font booklet-page-title">
                {page.title}
                {narration && (
                  <button
                    className="btn secondary booklet-listen"
                    onClick={() => {
                      if (speaking) {
                        stopVoice()
                        setSpeaking(false)
                      } else {
                        const el = playVoice(narration!)
                        el.onended = () => setSpeaking(false)
                        setSpeaking(true)
                      }
                    }}
                  >
                    {speaking ? '◼ Stop' : '🔊 Read aloud'}
                  </button>
                )}
              </h3>
              {pageArt && <img className="booklet-page-art" src={pageArt} alt="" />}
              <div className="booklet-page-body">
                <Body />
              </div>
            </>
          )}
        </div>
        <div className="booklet-nav">
          <button className="btn secondary" disabled={pageIdx === 0} onClick={() => { playChime('page'); setPageIdx((i) => Math.max(0, i - 1)) }}>
            ← Previous
          </button>
          <span className="booklet-page-count">{pageIdx + 1} / {pages.length}</span>
          <button
            className="btn secondary"
            disabled={pageIdx >= pages.length - 1}
            onClick={() => { playChime('page'); setPageIdx((i) => Math.min(pages.length - 1, i + 1)) }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
