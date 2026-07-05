import type { ComponentType } from 'react'

/** Shared vocabulary of "lock" symbols. A red card's puzzle is tagged with one;
 * the matching green (hint) card carries the same symbol so players can find
 * hints by icon alone, exactly like the physical game's symbol-indexed decks. */
export type LockSymbol =
  | 'gear' | 'moon' | 'flame' | 'wave' | 'eye'
  | 'leaf' | 'skull' | 'star' | 'key' | 'clock'
  | 'feather' | 'compass'

export interface PuzzleRenderProps {
  solved: boolean
  /** Object ids currently in the player's item tray — lets puzzles gate their
   * interactions on possessing a specific item (mirror, lamp, lens…), the way
   * physical EXIT puzzles need a strange item from the box. */
  inventory: string[]
}

export interface RedCard {
  id: string
  /** Letter shown on the card face, A..Z (matches physical deck lettering) */
  letter: string
  title: string
  symbol: LockSymbol
  /** The puzzle widget rendered on the card face */
  component: ComponentType<PuzzleRenderProps>
  /** Normalized answer the player must enter (case-insensitive, trimmed) OR the decoder code */
  solution: string
  /** How the player is expected to resolve this puzzle into their answer */
  inputMode: 'decoder' | 'text'
  /** Optional flavor hint shown near the code-entry field */
  entryHint?: string
  /** 1 = warm-up, 2 = solid, 3 = devious. Shown as pips on the card. */
  difficulty?: 1 | 2 | 3
}

export interface BlueCard {
  id: string
  narrative: string
  outcome: 'advance' | 'decoy' | 'win'
  unlocksRed?: string[]
  grantsObjects?: string[]
  unlocksBooklet?: string[]
}

export interface GreenCard {
  id: string
  symbol: LockSymbol
  hints: [string, string, string]
}

export interface ObjectItem {
  id: string
  name: string
  description: string
  icon: ComponentType
  detail?: ComponentType
}

export interface BookletPage {
  id: string
  title: string
  body: ComponentType
  order: number
  /** Optional produced narration clip (mp3/ogg) — a "read aloud" button appears when set. */
  narrationUrl?: string
}

export interface DecoderSegment {
  symbol: LockSymbol | string
  digit: number
}

export interface DecoderRingConfig {
  segments: DecoderSegment[]
}

export interface DecoderConfig {
  rings: [DecoderRingConfig, DecoderRingConfig, DecoderRingConfig]
  backClue: ComponentType
}

export interface ThemePalette {
  primary: string
  secondary: string
  accent: string
  bg: string
  paper: string
  ink: string
}

export interface AmbientProfile {
  baseFreq: number
  scale: number[]
  waveform: OscillatorType
  tempoMs: number
  filterFreq: number
  mood: 'mechanical' | 'cold' | 'eerie' | 'deco' | 'ancient'
  /** Optional produced audio files (looping OGG/MP3). When present they replace the
   * procedural bed: `main` loops during play, `finale` takes over past ~75% progress,
   * `win` plays once on escape. See docs/PRODUCTION.md for the asset pipeline. */
  tracks?: Partial<Record<'main' | 'finale' | 'win', string>>
}

export interface ThemeManifest {
  id: string
  title: string
  tagline: string
  synopsis: string
  /** Overall box difficulty, 1 (novice) – 5 (expert), shown as padlocks on the box. */
  difficulty: number
  palette: ThemePalette
  coverArt: ComponentType
  boxClue: ComponentType
  intro: BookletPage[]
  storyPages: Record<string, BookletPage>
  winPage: BookletPage
  startingRed: string[]
  finalRedCard: string
  redCards: Record<string, RedCard>
  blueCards: Record<string, BlueCard>
  greenCards: Record<string, GreenCard>
  objects: Record<string, ObjectItem>
  decoder: DecoderConfig
  music: AmbientProfile
}
