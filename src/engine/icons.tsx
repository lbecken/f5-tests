import type { ComponentType } from 'react'
import type { LockSymbol } from './types'

interface IconProps {
  size?: number
  color?: string
  className?: string
}

/** Hand-drawn SVG icon set shared by every theme — used to tag red-card
 * puzzles and their matching green hint cards so players can pair them by
 * sight alone, the way the physical decks use printed symbols. */

export function GearIcon({ size = 24, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M12 2.5l1.2 2.4 2.6-.6 1 2.5 2.5 1-.6 2.6 2.4 1.2-1.2 2.4-2.4 1.2.6 2.6-2.5 1-1-2.5-2.6.6-1.2-2.4-2.4.6-1-2.5-2.5-1 .6-2.6-2.4-1.2 1.2-2.4 2.4-1.2-.6-2.6 2.5-1 1 2.5z"
        stroke={color} strokeWidth="1.3" strokeLinejoin="round" transform="translate(0 .2) scale(.94)" />
      <circle cx="12" cy="12" r="3.4" stroke={color} strokeWidth="1.3" />
    </svg>
  )
}

export function MoonIcon({ size = 24, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M15.5 3.5a8.5 8.5 0 100 17 7 7 0 010-17z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

export function FlameIcon({ size = 24, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M12 2.5c1 2.7-2.4 4-2.4 7 0 1 .4 1.8 1 2.4-.8-.3-1.7-1.1-1.9-2.4-1.4 1.4-2.2 3-2.2 4.7A5.5 5.5 0 0012 20a5.5 5.5 0 005.5-6.3c-.3-2-1.6-3.2-2.6-4.5.1 1-.2 1.8-.8 2.4.5-2.6-.4-5.3-2.1-9.1z"
        stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

export function WaveIcon({ size = 24, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M2 9c2 0 2 2.5 4 2.5S8 9 10 9s2 2.5 4 2.5S16 9 18 9s2 2.5 4 2.5"
        stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M2 15c2 0 2 2.5 4 2.5S8 15 10 15s2 2.5 4 2.5S16 15 18 15s2 2.5 4 2.5"
        stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function EyeIcon({ size = 24, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.8" stroke={color} strokeWidth="1.3" />
    </svg>
  )
}

export function LeafIcon({ size = 24, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M20 4C10 4 4 10 4 19c9 0 15-6 16-15z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6 18C10 14 14 10 19 5" stroke={color} strokeWidth="1.1" />
    </svg>
  )
}

export function SkullIcon({ size = 24, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M12 3a7 7 0 00-7 7c0 2.6 1.3 4.3 2.6 5.6.5.5.4 1 .4 2.4h8c0-1.4-.1-1.9.4-2.4C17.7 14.3 19 12.6 19 10a7 7 0 00-7-7z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="9.3" cy="10.5" r="1.4" fill={color} />
      <circle cx="14.7" cy="10.5" r="1.4" fill={color} />
      <path d="M10 18v2M14 18v2" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function StarIcon({ size = 24, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M12 2.5l2.6 6 6.4.6-4.9 4.3 1.5 6.3L12 16.4 6.4 19.7l1.5-6.3-4.9-4.3 6.4-.6z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

export function KeyIcon({ size = 24, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="7.5" cy="8.5" r="4" stroke={color} strokeWidth="1.3" />
      <path d="M10.5 11.5L20 21M17 18l2.2-2.2M14.3 15.3l2.2-2.2" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function ClockIcon({ size = 24, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.3" />
      <path d="M12 7v5l3.5 2" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function FeatherIcon({ size = 24, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M20 4c-8 0-14 6-14 14l14-14z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6 18l11-11M9 15l3-3M12 12l3-3" stroke={color} strokeWidth="1" />
    </svg>
  )
}

export function CompassIcon({ size = 24, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.3" />
      <path d="M15 9l-2 5-4 1 2-5z" stroke={color} strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  )
}

export const LOCK_ICONS: Record<LockSymbol, ComponentType<IconProps>> = {
  gear: GearIcon,
  moon: MoonIcon,
  flame: FlameIcon,
  wave: WaveIcon,
  eye: EyeIcon,
  leaf: LeafIcon,
  skull: SkullIcon,
  star: StarIcon,
  key: KeyIcon,
  clock: ClockIcon,
  feather: FeatherIcon,
  compass: CompassIcon,
}

export function LockIcon({ symbol, ...rest }: { symbol: LockSymbol } & IconProps) {
  const Cmp = LOCK_ICONS[symbol]
  return <Cmp {...rest} />
}
