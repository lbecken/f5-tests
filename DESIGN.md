# THE NOCTURNE TAPES
### An audio investigation in five reels

> *"A microphone is an honest thing in a room full of liars."*

---

## 1. What this is

An **audio-only mystery game**. There is no board and no scene to look at. Everything the
player needs is in the sound. The screen exists only to hold the evidence, offer the
restoration tools, and take the player's answers.

Two inspirations, deliberately fused:

| From **Echo** (audio-only card game) | From **Exit / escape-room books** |
| --- | --- |
| Cards are *sounds*, not text | A chain of locks, each opened by a deduced code |
| You solve by matching, ordering, and recognising audio | Tools combine with clues in non-obvious ways |
| The fiction is delivered entirely through the ear | One continuous story, escalating |

The fusion is the point: **every lock in this game is opened by an act of listening.**
Not one code is written down anywhere. You hear it, or you don't get in.

---

## 2. The diegetic excuse for audio-only

The player is sent an anonymous box of quarter-inch tape and a restoration console.
Everything is a recording, because everything *is* a recording. This is not a game that
happens to have no visuals — it is a game about the fact that tape remembers more than
people meant it to.

---

## 3. The case

**October 31, 1957. KBLK "The Blackbird", 1120 AM. Halloway Bay.**

During the live Halloween broadcast of the anthology drama *Nocturne*, the station's
star, **Vera Lyle**, stops mid-scene. Eleven minutes later the episode ends on schedule,
every line delivered. Vera Lyle is never seen again.

Sixty years later a box of tapes arrives at the player's door with no return address.
A voice on the first reel calls itself **the Archivist**.

### The cast

| Character | Role | Voice |
| --- | --- | --- |
| **Vera Lyle** | The star. Vanished. | Lily (velvety, British) |
| **The Archivist** | Your anonymous guide | *Vera, pitched down 0.78×* |
| **Marlow Kestrel** | Station owner | Bill (old, American) |
| **Dorothy "Dot" Vance** | Foley artist | Jessica |
| **Eddie Ferris** | Board engineer | Roger |
| **Ruth Kestrel** | Marlow's wife; Iris's friend | Bella |
| **Cal Doyle** | The syndicate's man | Callum |
| **Det. Sgt. Halligan** | Investigating officer | Adam |
| **Peggy Nash** | The understudy | Laura |
| **Iris Bell** | The *previous* lead. Dead two years. | Alice |
| **The Announcer** | KBLK continuity | Daniel |
| **Julian Vane** | *Nocturne* co-star | George |

### The truth (the solution)

1. Two years earlier the previous *Nocturne* lead, **Iris Bell**, died in the Foley room.
   Ruled an accident — a counterweight off the thunder rig.
2. It was not an accident. **Marlow Kestrel** had been selling master recordings of his
   actresses' voices to a syndicate — a "voice library" — under contracts that stripped
   their names from the work in perpetuity. Iris found the ledger. She died that night.
3. The sound of her death was captured by accident: Dot's Foley reel was still rolling.
   Dot, terrified and alone, hid it the only way a sound woman could — she **filed it in
   the effects library** as stock effect **#17, "CRATE, FALLING, LARGE."** It sat in plain
   hearing for two years, played on air dozens of times.
4. Vera found it. A tape alone proves nothing and Kestrel owned the precinct; if she
   walked into a police station she would be the next accident.
5. So she used the only weapon she had — **the transmitter**. She vanished *on air* to make
   the story too loud to bury. And the eleven minutes after she "vanished" were read
   **by Vera herself**, doing the understudy's voice. She was in the studio the whole time.
   She walked out at sign-off with reel #17 in her coat.
6. **The Archivist is Vera Lyle.** The disguise is audio: her narration is pitched down.
   Run the narrator through the player's own console and she is exactly herself.

### The three-part accusation (the final lock)

| Question | Answer |
| --- | --- |
| Who took Vera Lyle? | **Vera Lyle** |
| What is really on effect #17? | **The death of Iris Bell** |
| Who killed Iris Bell? | **Marlow Kestrel** |

---

## 4. The restoration console — the verbs of the game

The console is the whole interface. Four controls, each of which is a *way of listening*,
and each of which is taught by a puzzle before it is required by one.

| Control | What it does | Physically honest? |
| --- | --- | --- |
| **SPEED** 0.5×–2.0× | Playback rate; pitch follows, exactly like a tape machine | Yes — `playbackRate` |
| **DIRECTION** ▶ / ◀ | Plays the reel backwards | Yes — reversed buffer |
| **FILTER** | Sweeps low-pass ↔ off ↔ high-pass | Yes — BiquadFilter |
| **BALANCE** | L/R focus, to isolate one channel of a stereo tape | Yes — channel gain |

Plus scrub, and an **A–B loop** so a player can worry at four seconds of tape until it
gives up its secret.

Because pitch follows speed, the Archivist's disguise is not a trick of the fiction — it
is a real, reversible transform the player's own tools can undo. That is the design
principle for the whole game: **nothing is hidden by assertion, everything is hidden by
physics the player can operate.**

---

## 5. The five reels

### REEL ONE — *Sign-Off* · teaches SPEED and BALANCE
- **The last broadcast** is a stereo tape: **left = the on-air programme**, **right = the
  control-room talkback mic.** Centred, they smear together. Hard right at 2:40 and you
  hear Eddie, off-air: *"She's not at the mic. Marlow — she's gone. …Keep reading.
  Whoever that is, keep reading."*
- **Reel 4B, damaged** plays as a low unintelligible groan. At ~1.75× it resolves into
  Vera, close and off-mic: *"…tell Dot: seventeen. Tell her I said seventeen."*
- **Dot's library index** — Dot reading her effects catalogue aloud, with numbers. This
  card is the Rosetta stone for the entire game.
- **LOCK — 3 digits.** The reel canister's combination is the catalogue numbers of the
  three Foley effects heard under the final scene, *in the order they occur*. → **492**

> Fairness note: the montage is assembled from the **exact same audio files** as the
> library cards. The player matches sound to sound, never sound to real-world knowledge.
> This is the Echo principle, and it makes the puzzle robust regardless of how any
> individual effect "reads."

### REEL TWO — *The Foley Room* · the Echo core
- Nine object cards, each an image and a sound: thunder sheet, coconut hooves, gravel
  tray, rain drum, slam box, wind machine, birdcage, glass crash, cabbage & knife.
- **Episode 88, scene 3** is 45 seconds built entirely from those objects. Reproduce the
  order. → **sequence lock**
- Then the same scene again — with one element that *is not in the room*. Identify the
  intruder. It is **#17**. Isolated and slowed, #17 is not a crate. It is a woman.
- **LOCK — sequence, then identification.**

### REEL THREE — *Party Line* · teaches FILTER
- A **rotary telephone** being dialled, synthesised pulse-accurate. Count the clicks in
  each group. Seven digits. → dial it to place the call.
- A **party line**: three conversations at once. One hard left through a telephone band,
  one hard right and full range, one centred and muffled behind a wall. Only BALANCE and
  FILTER can separate them. Kestrel and Cal Doyle, discussing "the library" and "the girl
  who's been asking."
- **LOCK — a name.** Who Vera called at 10:52pm. → **RUTH**

### REEL FOUR — *Backward* · teaches DIRECTION
- Vera's private message, recorded **backwards**, because she was a radio actress and knew
  exactly who would be listening forwards.
- A reel of "silence." Room tone, nothing on it. High-pass it and there is a faint tone
  above 4 kHz that has been there the whole time: **Morse**, left by Dot. It spells a date.
- **LOCK — 4 digits.** The safe. → **1103**, the night Iris Bell died.

### REEL FIVE — *Nocturne* · the reveal
- The eleven minutes after Vera vanished — the "understudy" reading her lines.
- Peggy Nash's statement: *"I wasn't in the building. I was in Sacramento."*
- A **voice lineup**. The tell is real and audible: the same intake of breath before the
  same word, in both voices. (The understudy's lines are generated with **Vera's own
  voice**, lightly processed — so a careful listener is hearing an actual match, not a
  claimed one.)
- **LOCK — the three-part accusation.**
- **Coda.** The Archivist signs off. And the last thing the game asks is the thing it has
  been teaching for five reels: *put the narrator through the console.*

---

## 6. Audio production rules

These are the constraints that keep the game honest and solvable.

1. **Puzzle-critical audio is never AI-generated.** Every count, code, chime, pulse and
   dot is synthesised procedurally in Python, sample-exact. Generative audio is used for
   atmosphere and for Echo-style matching only, where self-consistency (same file in the
   library and in the montage) guarantees fairness.
2. **Every composite is built from named source files**, so the montage and the card can
   never drift apart.
3. **Period colour is applied, not faked**: tape hiss, wow/flutter, a 1957 broadcast
   band-pass, valve saturation, room tone. Applied as a chain in ffmpeg so it is uniform.
4. **Nothing is hidden below the noise floor by accident.** A verification script asserts
   that every hidden signal is present at a measurable level, and that every lock's answer
   is derivable from cards the player already holds when the lock appears.

---

## 7. Budget

| Item | Plan |
| --- | --- |
| TTS characters | ~120,800 available; target ≤ 70,000, leaving room to re-cut lines |
| Sound effects | ElevenLabs sound-generation (does not draw on the character budget) |
| Score | ElevenLabs Music — noir cues, one per reel |
| Card art | Recraft, 40 credits/image |
| Procedural | Free and exact — all puzzle audio |

Every generated asset is content-hashed and cached, so re-running the pipeline costs
nothing unless a line actually changed.
