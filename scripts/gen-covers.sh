#!/usr/bin/env bash
# Generate box-cover art for each theme via Recraft (vector_illustration → native SVG).
# Usage: RECRAFT_API_KEY=... ./scripts/gen-covers.sh [theme ...]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=src/assets/art

declare -A PROMPTS=(
  [witch]="Vintage board game box cover art, gothic fairytale: a crooked witch cottage in a stormy midnight forest, glowing amber windows, a large hourglass with falling sand on the doorstep, drying herbs and a raven on the roof, crescent moon behind ragged clouds, deep violet and parchment cream palette, mysterious escape-room aesthetic, ornate border, no text"
  [abyssal]="Vintage board game box cover art, retro sci-fi: a deep-sea research station on the ocean floor at 4000 meters, glowing teal portholes and searchlights in black water, a giant shadow passing behind it, bubbles and pressure lines, dark teal and cyan on near-black palette, eerie escape-room aesthetic, ornate technical border, no text"
  [zephyr]="Vintage board game box cover art, 1920s art deco travel poster: a streamlined express train bursting out of an alpine tunnel at night, dramatic speed lines, a faceted diamond gleaming above the locomotive, geometric sunburst sky, gold and deep navy two-tone palette, elegant mystery escape-room aesthetic, deco border, no text"
  [ninthseal]="Vintage board game box cover art, 1930s Egyptology adventure: torchlit descent into a pharaoh tomb, a massive stone door bearing nine wax seals and a blank cartouche, hieroglyph walls, an explorer silhouette with an oil lamp, sand drifting down stone stairs, gold ochre and deep indigo palette, mysterious escape-room aesthetic, hieroglyphic border, no text"
)

for theme in "${@:-witch abyssal zephyr ninthseal}"; do
  for t in $theme; do
    echo "=== $t ==="
    resp=$(curl -sS -X POST https://external.api.recraft.ai/v1/images/generations \
      -H "Authorization: Bearer $RECRAFT_API_KEY" -H "Content-Type: application/json" \
      -d "$(python3 -c "
import json, sys
print(json.dumps({
  'prompt': '''${PROMPTS[$t]}''',
  'style': 'vector_illustration',
  'model': 'recraftv3',
  'size': '1024x1365',
}))")")
    url=$(echo "$resp" | python3 -c "import json,sys;print(json.load(sys.stdin)['data'][0]['url'])")
    curl -sSL "$url" -o "$OUT/$t-cover.svg"
    echo "saved $OUT/$t-cover.svg ($(stat -c%s "$OUT/$t-cover.svg") bytes)"
  done
done
