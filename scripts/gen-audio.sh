#!/usr/bin/env bash
# Generate UI sound effects + per-theme narration via ElevenLabs.
# Usage: ELEVENLABS_API_KEY=... ./scripts/gen-audio.sh [sfx|voice|all]
set -euo pipefail
cd "$(dirname "$0")/.."
SFX_OUT=src/assets/sfx
VOICE_OUT=src/assets/voice
MODE="${1:-all}"

sfx() { # name, prompt, seconds
  echo "sfx: $1"
  curl -sS -X POST "https://api.elevenlabs.io/v1/sound-generation" \
    -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
    -d "{\"text\": \"$2\", \"duration_seconds\": $3, \"prompt_influence\": 0.4}" \
    -o "$SFX_OUT/$1.mp3"
  file "$SFX_OUT/$1.mp3" | grep -qi 'audio\|mpeg' || { echo "FAILED $1:"; head -c 300 "$SFX_OUT/$1.mp3"; echo; }
}

tts() { # file, voice_id, text
  echo "tts: $1"
  curl -sS -X POST "https://api.elevenlabs.io/v1/text-to-speech/$2?output_format=mp3_44100_128" \
    -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
    -d "$(python3 - "$3" <<'PY'
import json, sys
print(json.dumps({"text": sys.argv[1], "model_id": "eleven_turbo_v2_5"}))
PY
)" -o "$VOICE_OUT/$1.mp3"
  file "$VOICE_OUT/$1.mp3" | grep -qi 'audio\|mpeg' || { echo "FAILED $1:"; head -c 300 "$VOICE_OUT/$1.mp3"; echo; }
}

if [ "$MODE" = "sfx" ] || [ "$MODE" = "all" ]; then
  sfx draw  "a single stiff playing card sliding off a deck and flipping onto a wooden table, quick and subtle, no music" 0.7
  sfx tick  "one small precise brass ratchet click, like a combination dial notch settling, dry and metallic, very short" 0.5
  sfx tear  "thick paper card being torn once along a perforation, short single rip" 0.9
  sfx correct "a heavy brass latch unlocking with one satisfying clunk and a faint warm resonance, mechanical, short" 0.9
  sfx wrong "a dull muted wooden thunk followed by a faint dissonant buzz, negative feedback, short and quiet" 0.7
  sfx win   "a massive old vault door unlocking: three heavy bolts sliding in sequence then a deep creak of the door swinging open, with a faint distant chime" 2.5
fi

if [ "$MODE" = "voice" ] || [ "$MODE" = "all" ]; then
  GEORGE=JBFqnCBsd6RMkjVDRZzb; LILY=pFZP5JQG7iQjIQuC4Bku; RIVER=SAz9YHcvj6GT2YYXdXww
  CALLUM=N2lVS1w4EtoT3dr4eOWO; BILL=pqHfZKP75CvOlQylNhV4

  tts clockmaker-intro $GEORGE "You are apprenticed to Master Aurelius Voss, the finest horologist the city has known in two generations. Tonight he asked you to stay after closing — the Sentinel, his masterwork automaton, was due its first rewinding in a hundred years, and he wanted a witness. At the stroke of midnight, the workshop's brass door sealed itself with a click you had never heard before. Master Voss was nowhere to be found. Only a note, pinned to his workbench with a spare cog, waited in his place."
  tts clockmaker-win $GEORGE "The final gear clicks into place. Somewhere deep in its chest, the Sentinel's heart begins, impossibly, to tick. The brass door sighs open on its own. On the threshold stands Master Voss, pocket watch in hand, smiling like a man who has been timing you the entire evening. Not bad, he says. Not bad at all."
  tts witch-intro $LILY "The storm drove you off the forest path and into the one cottage for miles — dark windows, herbs drying in bunches, a hearth gone cold. The moment the door shut behind you, it would not open again. On the mantle, an hourglass turns itself over, unprompted. Its sand is running out. A note in a spidery hand rests beside it: whoever finds this has already agreed to finish what I started."
  tts witch-win $LILY "The final sigil clicks into place just as the hourglass's last grain of sand falls. The cottage door swings open on its own, releasing a breath of warm air that smells like rosemary and rain. On the wind, a voice that can only be Morrigan's: well done. Do shut the door on your way out — the curse only needed a witness, not a guest."
  tts abyssal-intro $RIVER "Pressure: nominal. Depth: four thousand one hundred and twenty meters. Cryo-wake successful. Emergency wake protocol engaged. All egress sealed pending diagnostic. Please remain calm. Every door on this station reads the same word: sealed. I am MERIDIAN. I never sleep. Neither, for the moment, should you."
  tts abyssal-win $RIVER "Escape pod launch confirmed. For what it's worth — Doctor Reyes would have been proud. I certainly am. The pod breaks the surface into blinding daylight."
  tts zephyr-intro $CALLUM "The Zephyr Aurore — the fastest, vainest train in Europe, and tonight, custodian of the Lucerne Diamond. At twenty-one twelve, in the black of the Simplon tunnel, every light dies for ninety seconds. When they flare back, the safe stands open, empty, and politely shut again. You carry a railway detective's warrant, and you have until Milan. After that, every passenger — and the diamond — walks."
  tts zephyr-win $CALLUM "She's in the dining car, of course — halfway through a coffee she never intended to finish. Regina Argent slides the sugar bowl across the table. Inside, wrapped in a chef's glove: the Lucerne Diamond. I only ever steal things back, she says, as the brakes begin to sing for Milan."
  tts ninthseal-intro $BILL "The kings' lists skip a reign. Every stele of that lifetime has had its cartouche chiselled blank — the punishment of being forgotten. Your expedition found what the punishment missed: a tomb with nine seals and no name. Then came the sandstorm, and the door you entered by decided it had never existed. Above the inner gate, in hieratic: speak my name and walk out. Forget it, and stay to remember."
  tts ninthseal-win $BILL "Neferkara. The syllables leave your mouth and the tomb inhales — three thousand years of held breath going out of the stones all at once. Nine seals fall like a slow drumroll, and behind the ninth: stairs, and storm-light, and air."
fi

echo "--- remaining quota ---"
curl -sS https://api.elevenlabs.io/v1/user/subscription -H "xi-api-key: $ELEVENLABS_API_KEY" | python3 -c "import json,sys;d=json.load(sys.stdin);print('used', d['character_count'], 'of', d['character_limit'])"
