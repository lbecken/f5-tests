/** Convention-over-configuration asset registry.
 *
 * Generated assets drop into src/assets/{art,voice,music} with conventional
 * names and are picked up here automatically — no per-theme imports:
 *   art/<theme>-card-<letter>.svg     red-card banner illustration
 *   art/<theme>-page-<pageId>.svg     booklet page / win illustration
 *   art/<theme>-obj-<objectId>.svg    inventory object icon
 *   art/<theme>-deck-<red|blue>.svg   deck-back pattern
 *   voice/<theme>-blue-<blueId>.mp3   answer-card narration ('regina argent' → 'regina_argent')
 *   voice/<theme>-page-<pageId>.mp3   booklet narration (intro/win already wired via manifest)
 *   music/<theme>-<main|finale|win>.mp3
 */
const art = import.meta.glob('../assets/art/*.svg', { eager: true, import: 'default' }) as Record<string, string>
const voice = import.meta.glob('../assets/voice/*.mp3', { eager: true, import: 'default' }) as Record<string, string>
const music = import.meta.glob('../assets/music/*.mp3', { eager: true, import: 'default' }) as Record<string, string>

const slug = (s: string) => s.replace(/\s+/g, '_')

export function themeArt(themeId: string, kind: 'card' | 'page' | 'obj' | 'deck', key: string): string | undefined {
  return art[`../assets/art/${themeId}-${kind}-${slug(key)}.svg`]
}

export function blueVoice(themeId: string, blueId: string): string | undefined {
  return voice[`../assets/voice/${themeId}-blue-${slug(blueId)}.mp3`]
}

export function pageVoice(themeId: string, pageId: string): string | undefined {
  return voice[`../assets/voice/${themeId}-page-${slug(pageId)}.mp3`]
}

export function themeMusic(themeId: string): { main?: string; finale?: string; win?: string } | undefined {
  const main = music[`../assets/music/${themeId}-main.mp3`]
  const finale = music[`../assets/music/${themeId}-finale.mp3`]
  const win = music[`../assets/music/${themeId}-win.mp3`]
  if (!main && !finale && !win) return undefined
  return { main, finale, win }
}
