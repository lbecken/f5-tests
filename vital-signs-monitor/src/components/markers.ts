import {
  symbol,
  symbolCircle,
  symbolCross,
  symbolDiamond,
  symbolSquare,
  symbolStar,
  symbolTriangle,
} from "d3";
import type { SymbolType } from "d3";
import type { SymbolName } from "../vitals";

const SYMBOL_TYPES: Record<SymbolName, SymbolType> = {
  circle: symbolCircle,
  square: symbolSquare,
  triangle: symbolTriangle,
  diamond: symbolDiamond,
  cross: symbolCross,
  star: symbolStar,
};

const cache = new Map<string, string>();

/** Path data for a marker symbol, centered at the origin. `size` is area in px². */
export function markerPath(name: SymbolName, size: number): string {
  const key = `${name}:${size}`;
  let d = cache.get(key);
  if (!d) {
    d = symbol(SYMBOL_TYPES[name], size)() ?? "";
    cache.set(key, d);
  }
  return d;
}
