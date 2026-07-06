/**
 * Default categorical palettes for the timeline components.
 *
 * Both palettes were extracted from the reference designs and then retuned to
 * pass the accessibility checks of a categorical-palette validator
 * (lightness band, chroma floor, adjacent-pair color-vision-deficiency
 * separation) against their intended surfaces:
 *   - HORIZONTAL_PALETTE against the cream surface #f6efe7
 *   - VERTICAL_PALETTE   against white #ffffff
 *
 * Colors are assigned to items in fixed order by index. If a timeline has
 * more items than the palette has entries, assignment wraps around — that is
 * acceptable here because identity is never carried by color alone: every
 * item is directly labeled (year on the node / badge).
 */

export const HORIZONTAL_PALETTE: readonly string[] = [
  '#00709a', // deep teal
  '#21b2a4', // teal
  '#d3a63c', // gold
  '#c05320', // burnt orange
  '#3d87cc', // slate blue
  '#e0764a', // coral
  '#4255a4', // indigo slate
  '#bb64a4', // mauve
  '#0e8159', // pine green
  '#c28a3a', // amber tan
];

export const VERTICAL_PALETTE: readonly string[] = [
  '#1899d6', // cyan
  '#1cbfae', // turquoise
  '#569310', // green
  '#e7a112', // amber
  '#d55511', // orange
  '#e02c74', // pink
  '#ad3190', // magenta
  '#7d4ecc', // violet
];

export function resolveColor(
  explicit: string | undefined,
  index: number,
  palette: readonly string[],
): string {
  return explicit ?? palette[index % palette.length];
}
