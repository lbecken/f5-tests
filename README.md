# THE NOCTURNE TAPES

**An audio-only mystery in five reels.**

October 31st, 1957. During the live Halloween broadcast of the radio drama *Nocturne*,
KBLK's star actress Vera Lyle stops mid-scene. Eleven minutes later the episode ends on
schedule, every line delivered. She is never seen again.

Sixty years on, a box of tapes arrives at your door with no return address.

---

## Play

```sh
cd game && python3 -m http.server 8000
# then open http://localhost:8000
```

It is a static page — no build step, no dependencies, no network. Any static host works.

> **Wear headphones.** Half the evidence is in one ear and not the other.
> On speakers you will lose it.

Runtime is roughly 90 minutes. Progress saves to `localStorage`.

---

## What kind of game this is

Two things stitched together on purpose:

* **Echo** — the audio-only card game. Cards are *sounds*. You solve by matching,
  ordering and recognising what you hear, not by reading.
* **Exit** — the escape-room books. A chain of locks, each opened by a code you
  have to deduce, with tools that combine in non-obvious ways.

The join between them is the rule the whole game is built on: **every lock is opened by
an act of listening.** Not one code is written down anywhere. You hear it, or you don't
get in.

### The console is the game

Four controls, each a different way of listening, each taught by a puzzle before it is
required by one:

| Control | What it does |
| --- | --- |
| **SPEED** | Playback rate — and pitch follows it, exactly like a tape machine |
| **DIRECTION** | Plays the reel backwards |
| **FILTER** | Sweeps low-pass ↔ off ↔ high-pass |
| **BALANCE** | Isolates one channel of a stereo tape |

Plus scrub and an A–B loop, so you can worry at four seconds of tape until it gives up.

Because these are real transforms on real audio, everything hidden by speed can be
recovered by speed. That is not a metaphor — the last puzzle in the game depends on it
literally.

### The five reels

1. **Sign-Off** — the last broadcast, with the programme on one channel and the control
   room on the other. A damaged reel that isn't damaged, only slow.
2. **The Foley Room** — nine objects on a shelf. Rebuild a scene from the sounds it was
   made of, then find the one sound in it that was never made in that room.
3. **Party Line** — a rotary telephone dialled on a wire recording, and three
   conversations sharing one line.
4. **Backward** — a message recorded by someone who knew which way a policeman would run
   a tape, and a reel of silence that isn't silent.
5. **Nocturne** — a voice lineup, and eleven minutes performed by someone who was not in
   the building.

---

## How it was made

Everything audible was generated: 92 spoken lines across 13 voices (ElevenLabs `eleven_v3`),
a noir score, and a Foley library — then assembled into 40 composite evidence tapes with a
timeline mixer and given period tape colour.

Two production rules keep it honest, and both are enforced by tests:

**1. Nothing puzzle-critical is generated.** Every sound the player has to *count* or
*decode* — the rotary pulses, the Morse, the tones — is synthesised sample-exact in
`tools/synth.py`. A puzzle answer has to be a fact about the file, not a hope about a
prompt.

**2. Montages are built from the same files as the cards.** The scene you rebuild in reel
two is assembled from the very audio the Foley cards play, so matching is fair regardless
of how any individual effect happens to read. That is the Echo principle.

`tools/verify.py` then decodes the *shipped mp3s* and recovers each answer the way a
player's ear is meant to — it counts the dial pulses, decodes the Morse through the tape
chain, measures whether the stereo puzzles actually separate, and checks that the voice
lineup's correct answer really is the same voice as the recording in question. A
regression in the processing chain fails the build instead of the player.

```
tools/
  script_text.py   every spoken line
  case.py          effects library, tape timelines, cards, locks
  voices.py        casting
  synth.py         sample-exact puzzle audio
  fx.py            bands, tape colour, the Archivist transform
  assemble.py      timeline resolver and mixer
  build.py         orchestrates everything, emits game/data.js
  verify.py        solvability checks
```

### Rebuilding

```sh
export ELEVENLABS_API_KEY=...   # voice, effects, score
export RECRAFT_API_KEY=...      # card art
python3 tools/build.py          # everything (content-hash cached)
python3 tools/gen_art.py
python3 tools/verify.py
```

Every asset is cached by a hash of its own inputs, so re-running costs nothing unless a
line actually changed. `--no-api` assembles from cache alone.

Generating the current build spent **~29,000 of 131,000** ElevenLabs credits.

---

`DESIGN.md` has the full case, the fair-play clue trail, and the solution.
Don't read it first.
