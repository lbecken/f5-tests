import type { ComponentType } from 'react'

/** Shared vocabulary of "lock" symbols. A red card's puzzle is tagged with one;
 * the matching green (hint) card carries the same symbol so players can find
 * hints by icon alone, exactly like the physical game's symbol-indexed decks. */
export type LockSymbol =
  | 'gear' | 'moon' | 'flame' | 'wave' | 'eye'
  | 'leaf' | 'skull' | 'star' | 'key' | 'clock'
  | 'feather' | 'compass'

export interface PuzzleRenderProps {
  /** Called by the puzzle widget once the player has derived the answer symbols/digits,
   * before they dial the decoder / type a code. Purely for flavor state (e.g. "solved locally");  */
  solved: boolean
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
  mood: 'mechanical' | 'cold' | 'eerie'
}

export interface ThemeManifest {
  id: string
  title: string
  tagline: string
  synopsis: string
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
