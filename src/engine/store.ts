import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeManifest } from './types'

export type HintLevel = 0 | 1 | 2 | 3

export interface DrawnRed {
  id: string
  solved: boolean
  wrongAttempts: number
  hintLevel: HintLevel
}

interface ThemeSave {
  /** Red-card letters the story has told the player to go find, but may not have drawn yet. */
  unlockedRed: string[]
  /** Red cards the player has actually pulled from the deck onto their board. */
  drawnRed: Record<string, DrawnRed>
  solvedBluePile: string[]
  decoyMessages: string[]
  inventory: string[]
  bookletUnlocked: string[]
  /** A blue card id the player needs to go search the blue deck for, after entering a code. */
  pendingBlue: { blueId: string; forRed: string; result: 'correct' | 'decoy' } | null
  startedAt: number
  won: boolean
  elapsedMs: number
}

function freshSave(theme: ThemeManifest): ThemeSave {
  return {
    unlockedRed: [...theme.startingRed],
    drawnRed: {},
    solvedBluePile: [],
    decoyMessages: [],
    inventory: [],
    bookletUnlocked: theme.intro.map((p) => p.id),
    pendingBlue: null,
    startedAt: Date.now(),
    won: false,
    elapsedMs: 0,
  }
}

interface GameState {
  currentThemeId: string | null
  saves: Record<string, ThemeSave>
  musicOn: boolean

  startTheme: (theme: ThemeManifest) => void
  resetTheme: (themeId: string) => void
  exitToMenu: () => void
  toggleMusic: () => void

  drawRed: (theme: ThemeManifest, redId: string) => void
  submitCode: (theme: ThemeManifest, redId: string, code: string) => 'correct' | 'wrong' | 'decoy'
  revealBlue: (theme: ThemeManifest) => void
  dismissPendingBlue: () => void
  useHint: (redId: string) => void
  tick: (deltaMs: number) => void
}

function updateSave(
  set: (fn: (s: GameState) => Partial<GameState>) => void,
  themeId: string,
  updater: (save: ThemeSave) => ThemeSave,
) {
  set((s) => {
    const save = s.saves[themeId]
    if (!save) return s
    return { saves: { ...s.saves, [themeId]: updater(save) } }
  })
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      currentThemeId: null,
      saves: {},
      musicOn: false,

      startTheme: (theme) =>
        set((s) => ({
          currentThemeId: theme.id,
          saves: { ...s.saves, [theme.id]: s.saves[theme.id] ?? freshSave(theme) },
        })),

      resetTheme: (themeId) =>
        set((s) => {
          const saves = { ...s.saves }
          delete saves[themeId]
          return { saves }
        }),

      exitToMenu: () => set({ currentThemeId: null }),

      toggleMusic: () => set((s) => ({ musicOn: !s.musicOn })),

      drawRed: (theme, redId) =>
        updateSave(set, theme.id, (save) => {
          if (!save.unlockedRed.includes(redId) || save.drawnRed[redId]) return save
          return {
            ...save,
            drawnRed: {
              ...save.drawnRed,
              [redId]: { id: redId, solved: false, wrongAttempts: 0, hintLevel: 0 },
            },
          }
        }),

      submitCode: (theme, redId, rawCode) => {
        const red = theme.redCards[redId]
        const code = rawCode.trim().toLowerCase()
        const solution = red.solution.trim().toLowerCase()
        let result: 'correct' | 'wrong' | 'decoy' = 'wrong'
        let blueId: string | null = null

        if (code === solution) {
          const blue = Object.values(theme.blueCards).find(
            (b) => b.outcome !== 'decoy' && b.id.toLowerCase() === solution,
          )
          result = 'correct'
          blueId = blue?.id ?? null
        } else {
          const decoy = Object.values(theme.blueCards).find(
            (b) => b.outcome === 'decoy' && b.id.toLowerCase() === code,
          )
          if (decoy) {
            result = 'decoy'
            blueId = decoy.id
          }
        }

        updateSave(set, theme.id, (save) => {
          const drawn = save.drawnRed[redId]
          if (!drawn || drawn.solved) return save
          if (result === 'wrong' || !blueId) {
            return {
              ...save,
              drawnRed: {
                ...save.drawnRed,
                [redId]: { ...drawn, wrongAttempts: drawn.wrongAttempts + 1 },
              },
            }
          }
          return { ...save, pendingBlue: { blueId, forRed: redId, result } }
        })

        return blueId ? result : 'wrong'
      },

      /** Called once the player has "found" the pending blue card in the deck browser
       * and flipped it — applies its narrative effects. */
      revealBlue: (theme) => {
        const themeId = theme.id
        updateSave(set, themeId, (save) => {
          const pending = save.pendingBlue
          if (!pending) return save
          const blue = theme.blueCards[pending.blueId]
          const drawn = save.drawnRed[pending.forRed]
          if (!blue || !drawn) return { ...save, pendingBlue: null }

          if (pending.result === 'decoy') {
            return {
              ...save,
              pendingBlue: null,
              decoyMessages: [blue.narrative, ...save.decoyMessages].slice(0, 6),
              drawnRed: {
                ...save.drawnRed,
                [pending.forRed]: { ...drawn, wrongAttempts: drawn.wrongAttempts + 1 },
              },
            }
          }

          const newUnlocked = [...new Set([...save.unlockedRed, ...(blue.unlocksRed ?? [])])]
          const won = blue.outcome === 'win' || pending.forRed === theme.finalRedCard
          return {
            ...save,
            pendingBlue: null,
            solvedBluePile: [...save.solvedBluePile, blue.id],
            unlockedRed: newUnlocked,
            drawnRed: { ...save.drawnRed, [pending.forRed]: { ...drawn, solved: true } },
            inventory: blue.grantsObjects
              ? [...new Set([...save.inventory, ...blue.grantsObjects])]
              : save.inventory,
            bookletUnlocked: blue.unlocksBooklet
              ? [...new Set([...save.bookletUnlocked, ...blue.unlocksBooklet])]
              : save.bookletUnlocked,
            won: won || save.won,
          }
        })
      },

      dismissPendingBlue: () => {
        const themeId = get().currentThemeId
        if (!themeId) return
        updateSave(set, themeId, (save) => ({ ...save, pendingBlue: null }))
      },

      useHint: (redId) => {
        const themeId = get().currentThemeId
        if (!themeId) return
        updateSave(set, themeId, (save) => {
          const drawn = save.drawnRed[redId]
          if (!drawn || drawn.hintLevel >= 3) return save
          return {
            ...save,
            drawnRed: { ...save.drawnRed, [redId]: { ...drawn, hintLevel: (drawn.hintLevel + 1) as HintLevel } },
          }
        })
      },

      tick: (deltaMs) => {
        const themeId = get().currentThemeId
        if (!themeId) return
        updateSave(set, themeId, (save) => (save.won ? save : { ...save, elapsedMs: save.elapsedMs + deltaMs }))
      },
    }),
    { name: 'exit-engine-save-v1' },
  ),
)

export function useThemeSave(themeId: string | null): ThemeSave | null {
  return useGameStore((s) => (themeId ? s.saves[themeId] ?? null : null))
}
