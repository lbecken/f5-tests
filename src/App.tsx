import { useMemo } from 'react'
import { useGameStore } from './engine/store'
import { ThemeSelect } from './engine/components/ThemeSelect'
import { GameScreen } from './engine/components/GameScreen'
import { clockmakerTheme } from './themes/clockmaker/theme'
import { abyssalTheme } from './themes/abyssal/theme'
import { witchTheme } from './themes/witch/theme'

const THEMES = [clockmakerTheme, abyssalTheme, witchTheme]

export default function App() {
  const currentThemeId = useGameStore((s) => s.currentThemeId)
  const startTheme = useGameStore((s) => s.startTheme)
  const resetTheme = useGameStore((s) => s.resetTheme)
  const exitToMenu = useGameStore((s) => s.exitToMenu)
  const saves = useGameStore((s) => s.saves)

  const currentTheme = useMemo(() => THEMES.find((t) => t.id === currentThemeId) ?? null, [currentThemeId])

  if (currentTheme) {
    return <GameScreen theme={currentTheme} onExit={exitToMenu} />
  }

  return (
    <ThemeSelect
      themes={THEMES}
      onPlay={(t) => startTheme(t)}
      hasSave={(id) => Boolean(saves[id])}
      onReset={(id) => resetTheme(id)}
    />
  )
}
