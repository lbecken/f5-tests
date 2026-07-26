"""THE NOCTURNE TAPES — case structure.

Single source of truth for: the effects library, generated sound, music cues,
the composite evidence tapes, the cards the player holds, and every lock.
`build.py` emits game/data.js from this file.
"""

# ═══════════════════════════════════════════════════════════════════════════
# THE EFFECTS LIBRARY  (Dot Vance's catalogue — the game's Rosetta stone)
# ═══════════════════════════════════════════════════════════════════════════
# `cat` matches the numbers Dot reads aloud in r1_dot_index. The montages are
# assembled from these exact files, so matching is always self-consistent.

FOLEY = {
    "fx_door": dict(
        cat=1, object="Slam box",
        prompt="a heavy solid wooden interior door swinging shut and latching, close mic, "
               "dry indoor room, no music, no voices",
        dur=3),
    "fx_gravel": dict(
        cat=2, object="Gravel tray",
        prompt="slow deliberate footsteps crunching on a tray of loose gravel, close mic, "
               "dry studio, no music, no voices",
        dur=4),
    "fx_glass": dict(
        cat=3, object="Crash box",
        prompt="a pane of glass shattering and tinkling onto a hard floor, close mic, dry, "
               "no music, no voices",
        dur=3),
    "fx_train": dict(
        cat=4, object="Whistle rig",
        prompt="a distant steam train whistle, two long mournful notes across open country "
               "at night, no music, no voices",
        dur=4),
    "fx_rain": dict(
        cat=5, object="Rain drum",
        prompt="steady rain pattering against a window pane, dried peas rolling on a snare "
               "drum head, close mic, no music, no voices",
        dur=5),
    "fx_horse": dict(
        cat=6, object="Coconut hooves",
        prompt="a single horse walking at a slow steady walk on cobblestones, coconut shell "
               "foley, close mic, no music, no voices",
        dur=4),
    "fx_wind": dict(
        cat=7, object="Wind machine",
        prompt="a hand cranked wind machine, canvas over a wooden drum, rising high moaning "
               "wind, studio foley, no music, no voices",
        dur=5),
    "fx_birdcage": dict(
        cat=8, object="Birdcage",
        prompt="a small wire birdcage door opening and swinging, thin wire rattling and "
               "ringing, close mic, empty, no music, no voices",
        dur=3),
    "fx_thunder": dict(
        cat=9, object="Thunder sheet",
        prompt="a large hanging sheet of thin steel shaken hard, rolling metallic thunder, "
               "studio foley, no music, no voices",
        dur=5),
    "fx_cabbage": dict(
        cat=None, object="Cabbage & knife",
        prompt="a heavy blade chopping hard into a cabbage, wet fibrous splitting, close mic, "
               "no music, no voices",
        dur=3),
}

# Effect #17 — the crash layer. Iris's voice is mixed under this in assemble.py.
CRASH_17 = dict(
    prompt="an enormous heavy wooden crate toppling over and slamming onto a concrete floor, "
           "splintering wood, a long low rumble and settling debris, no music, no voices",
    dur=6)


# ═══════════════════════════════════════════════════════════════════════════
# ATMOSPHERE & TRANSPORT  (generated; not puzzle-critical)
# ═══════════════════════════════════════════════════════════════════════════

SFX = {
    "amb_studio": dict(prompt="the quiet room tone of a small 1950s radio studio, faint "
                              "valve amplifier hum, distant building, no music, no voices", dur=12),
    "amb_rain_street": dict(prompt="heavy rain on a wet city street at night, water running in "
                                   "a gutter, distant traffic, no music, no voices", dur=15),
    "amb_foleyroom": dict(prompt="a small cluttered windowless storage room, dead acoustics, "
                                 "faint electrical hum, no music, no voices", dur=10),
    "tr_reel_start": dict(prompt="a 1950s reel to reel tape machine, heavy mechanical clunk, "
                                 "motor spinning up, tape leader slapping", dur=3),
    "tr_reel_stop": dict(prompt="a 1950s reel to reel tape machine stopping, mechanical clunk, "
                                "capstan slowing, tape leader flapping to a halt", dur=3),
    "tr_switch": dict(prompt="a single heavy bakelite toggle switch clicking on a metal console", dur=1),
    "tel_ring": dict(prompt="a 1950s bakelite telephone ringing, mechanical bell hammer, "
                            "twice, in an empty hallway", dur=6),
    "tel_pickup": dict(prompt="a heavy bakelite telephone handset being lifted from its cradle, "
                              "a click and a line opening", dur=2),
    "door_alley": dict(prompt="a heavy steel alley door, a chain being drawn through a hasp, "
                              "the door pushed open onto rain", dur=5),
    "sting_organ": dict(prompt="a dramatic theatre organ sting, minor chord swelling and cutting "
                               "off, 1950s radio drama, ominous", dur=4),
    "safe_open": dict(prompt="a heavy steel office safe, combination dial spinning, tumblers "
                             "falling, the handle thrown and the door swinging open", dur=5),
}

MUSIC = {
    "mus_theme": dict(prompt="1950s radio noir main theme: lonely muted trumpet over sustained "
                             "strings and brushed snare, minor key, rain soaked, melancholy, "
                             "period mono recording, sparse and slow", ms=32000),
    "mus_reel2": dict(prompt="sparse noir underscore, low upright bass pizzicato, distant vibraphone, "
                            "unresolved, tense, very quiet, 1950s mono", ms=24000),
    "mus_reel3": dict(prompt="uneasy noir underscore, muted trumpet fragments, clock like ticking "
                            "percussion, minor, restrained, 1950s mono", ms=24000),
    "mus_reel4": dict(prompt="cold sustained strings, single piano notes, deep unease, almost silent, "
                            "noir underscore, 1950s mono", ms=24000),
    "mus_finale": dict(prompt="noir finale: solo muted trumpet resolving over warm strings, bittersweet, "
                             "a slow release of tension, 1950s mono recording", ms=40000),
    "mus_nocturne_bed": dict(prompt="1950s radio drama underscore, theatre organ sustained minor chords, "
                                    "eerie, gothic, very quiet under dialogue", ms=40000),
}


# ═══════════════════════════════════════════════════════════════════════════
# COMPOSITE EVIDENCE TAPES
# ═══════════════════════════════════════════════════════════════════════════
# A composite is a timeline of layers. Each layer:
#   src    asset id (dialog line, foley, sfx, music, or a synth id)
#   at     start time, seconds
#   gain   dB
#   pan    -1.0 hard left .. +1.0 hard right
#   band   None | "telephone" | "muffled" | "broadcast"
#   speed  playback multiplier baked into the asset
#   rev    reverse this layer
# `tape` applies the shared period-colour chain (hiss, wow/flutter, saturation).

COMPOSITES = {

# ── REEL 1 ────────────────────────────────────────────────────────────────
# The last broadcast. LEFT = programme as transmitted. RIGHT = control-room
# talkback mic. Centred they smear; hard-panned they separate.
"tape_broadcast": dict(
    tape="broadcast", pad_out=3.0,
    layers=[
        # --- LEFT: the programme ---
        dict(src="mus_nocturne_bed", at=0.0,  gain=-22, pan=-1.0),
        dict(src="r1_bcast_L1",      at=1.0,  gain=0,   pan=-1.0),
        dict(src="sting_organ",      at="after:r1_bcast_L1+0.3", gain=-8, pan=-1.0),
        dict(src="fx_train",         at="after:sting_organ+0.4", gain=-7, pan=-1.0),  # #4
        dict(src="r1_bcast_L2",      at="after:fx_train+0.5",    gain=0,  pan=-1.0),
        dict(src="r1_bcast_L3",      at="after:r1_bcast_L2+0.4", gain=0,  pan=-1.0),
        dict(src="fx_thunder",       at="after:r1_bcast_L3+0.2", gain=-6, pan=-1.0),  # #9
        dict(src="r1_bcast_L4",      at="after:fx_thunder+0.3",  gain=0,  pan=-1.0),
        dict(src="fx_gravel",        at="after:r1_bcast_L4+0.2", gain=-7, pan=-1.0),  # #2
        dict(src="r1_bcast_L5",      at="after:fx_gravel+0.6",   gain=0,  pan=-1.0),
        dict(src="r1_bcast_L6",      at="after:r1_bcast_L5+1.6", gain=0,  pan=-1.0),
        dict(src="r1_bcast_L7",      at="after:r1_bcast_L6+0.5", gain=0,  pan=-1.0),
        # --- RIGHT: the control room ---
        dict(src="amb_studio",       at=0.0,  gain=-26, pan=1.0, loop=True),
        dict(src="r1_bcast_R1",      at=2.0,  gain=-9,  pan=1.0, band="muffled"),
        dict(src="r1_bcast_R2",      at="sync:fx_gravel-1.2", gain=-9, pan=1.0, band="muffled"),
        # the eleven seconds
        dict(src="r1_bcast_R3",      at="sync:r1_bcast_L5+end", gain=-6, pan=1.0, band="muffled"),
        dict(src="r1_bcast_R4",      at="after:r1_bcast_R3+0.3", gain=-7, pan=1.0, band="muffled"),
        dict(src="r1_bcast_R5",      at="after:r1_bcast_R4+0.4", gain=-7, pan=1.0, band="muffled"),
        dict(src="r1_bcast_R6",      at="after:r1_bcast_R5+0.2", gain=-7, pan=1.0, band="muffled"),
    ],
    # Foley order the Reel 1 lock depends on: train(4), thunder(9), gravel(2)
    meta=dict(foley_order=["fx_train", "fx_thunder", "fx_gravel"]),
),

# "Reel 4B, damaged." Baked at 0.571x so the player must run it at ~1.75x.
"tape_warped": dict(
    tape="warped", pad_out=1.0,
    layers=[
        dict(src="amb_studio",     at=0.0, gain=-24, loop=True),
        dict(src="r1_warped_vera", at=0.6, gain=0, speed=0.571),
    ],
),

"tape_eddie": dict(tape="wire", pad_out=1.0, layers=[
    dict(src="amb_studio", at=0.0, gain=-28, loop=True),
    dict(src="r1_eddie_statement", at=0.5, gain=0, band="telephone"),
]),

"tape_halligan": dict(tape="wire", pad_out=1.0, layers=[
    dict(src="r1_halligan_brief", at=0.4, gain=0, band="telephone"),
]),

"tape_index": dict(tape="worn", pad_out=1.0, layers=[
    dict(src="amb_foleyroom", at=0.0, gain=-26, loop=True),
    dict(src="r1_dot_index", at=0.5, gain=0),
]),

# ── REEL 2 ────────────────────────────────────────────────────────────────
# Episode 88 scene 3 — built ONLY from library objects.
# Answer order: rain(5) door(1) gravel(2) wind(7) glass(3)
"tape_scene88": dict(
    tape="broadcast", pad_out=2.0,
    layers=[
        dict(src="mus_reel2",  at=0.0, gain=-26),
        dict(src="fx_rain",    at=0.8,  gain=-6),
        dict(src="fx_door",    at=6.0,  gain=-4),
        dict(src="fx_gravel",  at=9.5,  gain=-5),
        dict(src="fx_wind",    at=14.0, gain=-7),
        dict(src="fx_glass",   at=19.5, gain=-4),
    ],
    meta=dict(answer=["fx_rain", "fx_door", "fx_gravel", "fx_wind", "fx_glass"]),
),

# The same scene as it was actually transmitted — with #17 spliced in.
"tape_scene88x": dict(
    tape="broadcast", pad_out=2.0,
    layers=[
        dict(src="mus_reel2",  at=0.0, gain=-26),
        dict(src="fx_rain",    at=0.8,  gain=-6),
        dict(src="fx_door",    at=6.0,  gain=-4),
        dict(src="fx_gravel",  at=9.5,  gain=-5),
        dict(src="cat17",      at=13.0, gain=-3),
        dict(src="fx_wind",    at=19.0, gain=-7),
        dict(src="fx_glass",   at=24.5, gain=-4),
    ],
    meta=dict(intruder="cat17"),
),

# Effect #17 itself. The voices are baked in at 1.7x — slowing to ~0.59x
# restores them. This is a real transform, not a claimed one.
"cat17": dict(
    tape="worn", pad_out=0.5,
    layers=[
        dict(src="amb_foleyroom",     at=0.0, gain=-24, loop=True),
        dict(src="r2_x17_iris_1",     at=0.5, gain=-11, speed=1.7, band="muffled"),
        dict(src="r2_x17_kestrel_1",  at="after:r2_x17_iris_1+0.15", gain=-12, speed=1.7, band="muffled"),
        dict(src="r2_x17_iris_2",     at="after:r2_x17_kestrel_1+0.2", gain=-10, speed=1.7, band="muffled"),
        dict(src="fx_thunder",        at="after:r2_x17_iris_2-0.3", gain=-14),
        dict(src="crash",             at="after:r2_x17_iris_2-0.1", gain=0),
    ],
),

"tape_iris_audition": dict(tape="worn", pad_out=1.0, layers=[
    dict(src="amb_studio", at=0.0, gain=-27, loop=True),
    dict(src="r2_iris_audition", at=0.5, gain=0),
]),

"tape_dot_interview": dict(tape="wire", pad_out=1.0, layers=[
    dict(src="amb_foleyroom", at=0.0, gain=-27, loop=True),
    dict(src="r2_dot_interview", at=0.4, gain=0),
]),

"tape_dot_seventeen": dict(tape="wire", pad_out=1.0, layers=[
    dict(src="r2_dot_seventeen", at=0.4, gain=0),
]),

# ── REEL 3 ────────────────────────────────────────────────────────────────
# The dial. Pulses are synthesised sample-exact by synth.py.
"tape_dial": dict(
    tape="wire", pad_out=1.5,
    layers=[
        dict(src="amb_studio", at=0.0, gain=-30, loop=True),
        dict(src="tel_pickup", at=0.5, gain=-6),
        dict(src="syn_dial",   at=2.0, gain=-2),
        dict(src="tel_ring",   at="after:syn_dial+2.6", gain=-10),  # clear of the last digit
    ],
),

"tape_answering": dict(tape="wire", pad_out=1.5, layers=[
    dict(src="tel_pickup",     at=0.2, gain=-8),
    dict(src="r3_clerk_answer", at=1.0, gain=0, band="telephone"),
    dict(src="syn_beep",        at="after:r3_clerk_answer+0.4", gain=-8),
    dict(src="r3_vera_message", at="after:syn_beep+0.5", gain=0, band="telephone"),
]),

# Three conversations sharing one line. Only BALANCE + FILTER separate them.
"tape_partyline": dict(
    tape="wire", pad_out=2.0,
    layers=[
        dict(src="syn_linenoise", at=0.0, gain=-24, loop=True),
        # LEFT — telephone band: Kestrel & Doyle
        dict(src="r3_party_L1", at=1.0, gain=-2, pan=-0.95, band="telephone"),
        dict(src="r3_party_L2", at="after:r3_party_L1+0.3", gain=-2, pan=-0.95, band="telephone"),
        dict(src="r3_party_L3", at="after:r3_party_L2+0.2", gain=-2, pan=-0.95, band="telephone"),
        dict(src="r3_party_L4", at="after:r3_party_L3+0.3", gain=-2, pan=-0.95, band="telephone"),
        dict(src="r3_party_L5", at="after:r3_party_L4+0.4", gain=-2, pan=-0.95, band="telephone"),
        dict(src="r3_party_L6", at="after:r3_party_L5+0.4", gain=-2, pan=-0.95, band="telephone"),
        dict(src="r3_party_L7", at="after:r3_party_L6+0.3", gain=-2, pan=-0.95, band="telephone"),
        # RIGHT — the neighbours on the shared line. Enters after the call is
        # already running, so each conversation gets a moment in the clear.
        dict(src="r3_party_R1", at=9.0, gain=-4, pan=0.95, band="neighbour"),
        dict(src="r3_party_R2", at="after:r3_party_R1+0.2", gain=-4, pan=0.95, band="neighbour"),
        dict(src="r3_party_R3", at="after:r3_party_R2+0.3", gain=-4, pan=0.95, band="neighbour"),
        dict(src="r3_party_R4", at="after:r3_party_R3+0.2", gain=-4, pan=0.95, band="neighbour"),
        dict(src="r3_party_R5", at="after:r3_party_R4+0.3", gain=-4, pan=0.95, band="neighbour"),
        # CENTRE — behind a wall: Dot and Vera. Lives below 600 Hz, where
        # neither of the other two conversations reaches.
        dict(src="r3_party_C1", at=17.0, gain=-3, pan=0.0, band="wall"),
        dict(src="r3_party_C2", at="after:r3_party_C1+0.3", gain=-3, pan=0.0, band="wall"),
        dict(src="r3_party_C3", at="after:r3_party_C2+0.4", gain=-3, pan=0.0, band="wall"),
        dict(src="r3_party_C4", at="after:r3_party_C3+0.3", gain=-3, pan=0.0, band="wall"),
    ],
),

# ── REEL 4 ────────────────────────────────────────────────────────────────
# Laid onto the reel backwards.
"tape_backward": dict(
    tape="worn", pad_out=1.0,
    layers=[
        dict(src="amb_studio",      at=0.0, gain=-26, loop=True),
        dict(src="r4_vera_backward", at=0.8, gain=0, rev=True),
    ],
    meta=dict(reversed=True),
),

# "Blank." Room tone with Morse sitting above 5 kHz, where no needle jumps.
"tape_blank": dict(
    tape="opentop", pad_out=0.5,   # nothing may cut above the 5.2 kHz carrier
    layers=[
        dict(src="amb_studio", at=0.0, gain=-20, loop=True),
        dict(src="syn_morse",  at=1.0, gain=-20),
    ],
    meta=dict(morse="1103"),
),

"tape_ledger": dict(tape="disc", pad_out=1.5, layers=[
    dict(src="r4_kestrel_ledger", at=0.6, gain=0),
]),

# ── REEL 5 ────────────────────────────────────────────────────────────────
"tape_last11": dict(
    tape="broadcast", pad_out=2.0,
    layers=[
        dict(src="mus_nocturne_bed", at=0.0, gain=-24),
        dict(src="r5_understudy_1", at=1.0, gain=0),
        dict(src="r5_understudy_2", at="after:r5_understudy_1+0.6", gain=0),
        dict(src="fx_wind",         at="after:r5_understudy_2+0.1", gain=-16),
        dict(src="r5_understudy_3", at="after:r5_understudy_2+0.8", gain=0),
        dict(src="r5_understudy_4", at="after:r5_understudy_3+0.7", gain=0),
        dict(src="sting_organ",     at="after:r5_understudy_4+0.4", gain=-9),
        dict(src="r5_announcer_signoff", at="after:sting_organ+0.5", gain=0),
    ],
),

"tape_peggy": dict(tape="wire", pad_out=1.0, layers=[
    dict(src="r5_peggy", at=0.4, gain=0, band="telephone"),
]),
"tape_halligan_close": dict(tape="wire", pad_out=1.0, layers=[
    dict(src="amb_rain_street", at=0.0, gain=-28, loop=True),
    dict(src="r5_halligan_close", at=0.5, gain=0),
]),
"tape_kestrel_interview": dict(tape="broadcast", pad_out=1.0, layers=[
    dict(src="r5_kestrel_interview", at=0.4, gain=0),
]),
"tape_dot_final": dict(tape="clean", pad_out=1.5, layers=[
    dict(src="amb_foleyroom", at=0.0, gain=-30, loop=True),
    dict(src="r5_dot_final", at=0.5, gain=0),
]),
}

# Narration and endings: light tape colour, no layering needed.
SIMPLE_TAPES = {
    "tape_arch_open":       ("r1_archivist_open",            "worn",  "mus_theme"),
    "tape_arch_console":    ("r1_archivist_console",         "worn",  None),
    "tape_arch_r2":         ("r2_archivist_open",            "worn",  "mus_reel2"),
    "tape_arch_x17":        ("r2_archivist_x17",             "worn",  None),
    "tape_arch_r3":         ("r3_archivist_open",            "worn",  "mus_reel3"),
    "tape_arch_r3close":    ("r3_archivist_close",           "worn",  None),
    "tape_arch_hiss":       ("r4_archivist_hiss",            "worn",  "mus_reel4"),
    "tape_arch_ledger":     ("r4_archivist_ledger",          "worn",  None),
    "tape_arch_r5":         ("r5_archivist_open",            "worn",  None),
    "tape_arch_lineup":     ("r5_archivist_lineup",          "worn",  None),
    "tape_station_break":   ("r5_station_break",             "broadcast", None),
    # The four lineup references get identical treatment, so the only thing that
    # differs between them is the woman.
    "ref_vera":             ("ref_line_vera",                "wire",  None),
    "ref_peggy":            ("ref_line_peggy",               "wire",  None),
    "ref_iris":             ("ref_line_iris",                "wire",  None),
    "ref_ruth":             ("ref_line_ruth",                "wire",  None),
    "tape_arch_accuse":     ("r5_archivist_before_accusation","worn", None),
    "tape_arch_lockhint":   ("r1_lock_hint",                 "worn",  None),
    "tape_end_correct":     ("r5_ending_correct",            "worn",  "mus_finale"),
    "tape_end_wrong":       ("r5_ending_wrong",              "worn",  None),
    "tape_end_partial":     ("r5_ending_partial",            "worn",  None),
    # The unmasking: Vera's own voice, no disguise, no tape colour.
    "tape_epilogue":        ("r5_epilogue_unmasked",         "clean", "mus_finale"),
}


# ═══════════════════════════════════════════════════════════════════════════
# THE PUZZLE-CRITICAL SYNTHESISED AUDIO  (exact, generated by synth.py)
# ═══════════════════════════════════════════════════════════════════════════

SYNTH = {
    "syn_dial":      dict(kind="rotary", digits="6305274"),
    "syn_morse":     dict(kind="morse", text="1103", wpm=9, freq=5200),
    "syn_beep":      dict(kind="beep", freq=1000, dur=0.45),
    "syn_linenoise": dict(kind="linenoise", dur=12),
    "syn_hiss":      dict(kind="hiss", dur=12),
}


# ═══════════════════════════════════════════════════════════════════════════
# CARDS  — what the player holds. Echo-style: an image and a sound.
# ═══════════════════════════════════════════════════════════════════════════

def C(id, reel, title, sub, audio, art, kind="tape"):
    return dict(id=id, reel=reel, title=title, sub=sub, audio=audio, art=art, kind=kind)


# Rendered as genuine period evidence photographs. The deck's amber cast is
# applied in CSS rather than baked in, so every card stays tonally identical.
ART = "1957 police evidence photograph, high contrast black and white, grainy 35mm film, " \
      "dramatic low key lighting, deep shadows, single subject, centred, plain background, "

# The Foley object cards — the Echo deck proper.
FOLEY_ART = {
    "fx_door":     ART + "a wooden studio slam box, a miniature hinged door in a frame on a bench",
    "fx_gravel":   ART + "a shallow wooden tray filled with loose gravel on a studio floor",
    "fx_glass":    ART + "a wooden crash box full of broken glass shards and scrap metal",
    "fx_train":    ART + "a brass steam whistle rig mounted on a wooden stand",
    "fx_rain":     ART + "a snare drum with dried peas scattered across the drum head",
    "fx_horse":    ART + "two halves of a hollow coconut shell resting on a tray of sand",
    "fx_wind":     ART + "a hand cranked wooden wind machine, a slatted drum wrapped in canvas",
    "fx_birdcage": ART + "a small empty wire birdcage with its door hanging open",
    "fx_thunder":  ART + "a large thin sheet of steel hanging from a studio ceiling frame",
    "fx_cabbage":  ART + "a heavy kitchen knife and a split cabbage on a wooden board",
    "crash":       ART + "a large splintered wooden crate lying broken on a concrete floor",
}

CARDS = [
    # ── reel 1
    C("c_arch_open", 1, "A voice on reel one", "No return address",
      "tape_arch_open", ART + "a plain cardboard box of quarter inch audio tape reels on a table"),
    C("c_console", 1, "How the console works", "The Archivist",
      "tape_arch_console", ART + "a vintage tape restoration console with four large bakelite knobs"),
    C("c_broadcast", 1, "The last broadcast", "31 Oct 1957 · 22:49 · STEREO",
      "tape_broadcast", ART + "a radio studio microphone from 1957 with a music stand and scattered script pages"),
    C("c_index", 1, "Effects index", "D. Vance, read for the file",
      "tape_index", ART + "a handwritten card index box full of numbered index cards on a workbench"),
    C("c_warped", 1, "Reel 4B — DAMAGED", "Recovered from the studio floor",
      "tape_warped", ART + "a warped buckled reel of quarter inch magnetic tape, damaged, spilling loose"),
    C("c_eddie", 1, "Statement: E. Ferris", "Board engineer",
      "tape_eddie", ART + "a radio engineer's mixing desk with VU meters and faders, 1950s"),
    C("c_halligan", 1, "Case 441-57", "Det. Sgt. Halligan",
      "tape_halligan", ART + "a police case file folder with a typed report and a paperclip"),

    # ── reel 2
    C("c_arch_r2", 2, "Reel two", "The Archivist",
      "tape_arch_r2", ART + "a cluttered windowless foley room packed floor to ceiling with props"),
    C("c_dot_int", 2, "Interview: D. Vance", "Foley artist",
      "tape_dot_interview", ART + "a young woman's hands holding two coconut halves over a tray of sand"),
    C("c_scene88", 2, "Nocturne, ep. 88 sc. 3", "Rehearsal pass — effects only",
      "tape_scene88", ART + "a script page on a music stand marked with grease pencil cues"),
    C("c_scene88x", 2, "Ep. 88 sc. 3 — AS TRANSMITTED", "Six elements, not five",
      "tape_scene88x", ART + "a radio transmitter tower on a hill at night in heavy rain"),
    C("c_iris", 2, "Audition slate: I. Bell", "1955 — station archive",
      "tape_iris_audition", ART + "a single acetate audition disc in a paper sleeve with a handwritten label"),
    C("c_dot_17", 2, "D. Vance on #17", "She would not explain",
      "tape_dot_seventeen", ART + "a wooden shelf of numbered effects reels, one gap where a reel is missing"),
    C("c_cat17", 2, "Effect #17", "CRATE, FALLING, LARGE",
      "cat17", ART + "a large splintered wooden crate lying on its side on a concrete floor"),
    C("c_arch_x17", 2, "What #17 is", "The Archivist",
      "tape_arch_x17", ART + "a grease pencil resting on a reel of tape labelled with a number"),

    # ── reel 3
    C("c_arch_r3", 3, "Reel three", "The Archivist",
      "tape_arch_r3", ART + "a black bakelite rotary telephone on a hall table"),
    C("c_dial", 3, "Wire recording — 22:52", "Police exhibit 9",
      "tape_dial", ART + "a close view of a rotary telephone dial finger wheel in motion"),
    C("c_partyline", 3, "Party line intercept", "Three conversations, one wire",
      "tape_partyline", ART + "telephone wires crossing against a stormy night sky, silhouetted"),
    C("c_answering", 3, "The call that was answered", "Halloway Bay Answering Service",
      "tape_answering", ART + "a telephone answering service switchboard with cords and a message pad"),
    C("c_arch_r3c", 3, "Meridian", "The Archivist",
      "tape_arch_r3close", ART + "a contract page with a signature line and a magnifying glass"),

    # ── reel 4
    C("c_arch_hiss", 4, "Reel four", "The Archivist",
      "tape_arch_hiss", ART + "an empty reel of tape spinning on a machine, nothing on the meters"),
    C("c_backward", 4, "Unlabelled reel", "Found in the lining of a coat",
      "tape_backward", ART + "a small reel of tape hidden inside the torn lining of a woman's coat"),
    C("c_blank", 4, "Reel 11 — BLANK", "Police notation: 'nothing on it'",
      "tape_blank", ART + "a reel of tape with a blank white label and no writing at all"),
    C("c_morse", 4, "Morse chart", "From the station wall",
      None, ART + "a printed international morse code chart pinned to a studio wall", kind="ref"),
    C("c_ledger", 4, "Dictation disc", "M. Kestrel — 'file the disc'",
      "tape_ledger", ART + "an office safe standing open with a stack of acetate discs inside"),
    C("c_arch_ledger", 4, "Eleven thousand five hundred", "The Archivist",
      "tape_arch_ledger", ART + "a ledger book of handwritten accounts with columns of figures"),

    # ── reel 5
    C("c_arch_r5", 5, "Reel five", "The Archivist",
      "tape_arch_r5", ART + "an empty radio studio with a single microphone and an open door"),
    C("c_last11", 5, "The eleven minutes", "After she stopped",
      "tape_last11", ART + "a studio clock at ten minutes to eleven, hands blurred"),
    C("c_peggy", 5, "Statement: P. Nash", "Understudy",
      "tape_peggy", ART + "a young woman's headshot photograph, 1950s, curling at the corner"),
    C("c_halligan2", 5, "Halligan, eleven years on", "Off the record",
      "tape_halligan_close", ART + "a detective's raincoat and hat on a hook by a rain streaked window"),
    C("c_kestrel", 5, "M. Kestrel — press statement", "Recorded for broadcast",
      "tape_kestrel_interview", ART + "an older man in a double breasted suit behind a radio microphone"),
    C("c_dot_final", 5, "D. Vance, forty years later", "'I filed a person'",
      "tape_dot_final", ART + "an elderly woman's hands resting on an old tray of gravel"),
    C("c_lineup", 5, "Voice lineup", "Four women, one line",
      "tape_arch_lineup", ART + "four acetate discs laid in a row on a police desk, numbered"),
    C("c_break", 1, "Station break", "KBLK continuity, 22:59",
      "tape_station_break", ART + "a lit radio dial and tuning needle glowing in a dark room"),
    C("c_arch_accuse", 5, "Say it", "The Archivist",
      "tape_arch_accuse", ART + "a box of tape reels with the lid beside it, ready to be closed"),
]


# ═══════════════════════════════════════════════════════════════════════════
# LOCKS
# ═══════════════════════════════════════════════════════════════════════════

SUSPECTS = [
    dict(id="vera",    name="Vera Lyle",      role="The star. Vanished."),
    dict(id="kestrel", name="Marlow Kestrel", role="Station owner."),
    dict(id="dot",     name="Dorothy Vance",  role="Foley artist."),
    dict(id="eddie",   name="Eddie Ferris",   role="Board engineer."),
    dict(id="doyle",   name="Cal Doyle",      role="Meridian Broadcast Holdings."),
    dict(id="peggy",   name="Peggy Nash",     role="Understudy."),
    dict(id="halligan",name="Det. Halligan",  role="Investigating officer."),
]

LOCKS = [
    dict(
        id="lock1", reel=1, type="keypad", length=3, answer="492",
        title="Reel canister — 3-digit dial",
        prompt="Three effects play under the final scene. Dot numbered every effect in that "
               "building. Their numbers, in the order you hear them.",
        unlocks_reel=2,
    ),
    dict(
        id="lock2a", reel=2, type="sequence", answer=["fx_rain", "fx_door", "fx_gravel", "fx_wind", "fx_glass"],
        pool=["fx_rain", "fx_door", "fx_gravel", "fx_wind", "fx_glass", "fx_thunder",
              "fx_horse", "fx_birdcage", "fx_cabbage"],
        title="Rebuild scene 3",
        prompt="Five objects from the Foley room made that scene. Lay them out in the order "
               "they were played.",
    ),
    dict(
        id="lock2b", reel=2, type="choice",
        answer="cat17",
        options=[dict(id="fx_thunder", label="Thunder sheet"), dict(id="fx_glass", label="Crash box"),
                 dict(id="cat17", label="Effect #17"), dict(id="fx_cabbage", label="Cabbage & knife"),
                 dict(id="fx_horse", label="Coconut hooves")],
        title="The sixth element",
        prompt="As transmitted, that scene had six sounds in it, not five. One of them was "
               "never made in that room. Which?",
        unlocks_reel=3,
    ),
    dict(
        id="lock3", reel=3, type="keypad", length=7, answer="6305274",
        title="Place the call",
        prompt="Count the pulses. One click is a 1. Ten clicks is a 0.",
        unlocks_card="c_answering", unlocks_reel=4,
    ),
    dict(
        id="lock4", reel=4, type="keypad", length=4, answer="1103",
        title="Kestrel's safe — 4 digits",
        prompt="Behind the Nocturne plaque. Dot left the number where she leaves everything: "
               "above where anybody thinks to listen.",
        unlocks_card="c_ledger", unlocks_reel=5,
    ),
    dict(
        id="lock5a", reel=5, type="choice",
        answer="vera",
        sample=dict(audio="tape_last11",
                    label="The questioned recording — the last eleven minutes"),
        options=[
            dict(id="peggy", label="Peggy Nash — the understudy", audio="ref_peggy"),
            dict(id="vera",  label="Vera Lyle",                   audio="ref_vera"),
            dict(id="iris",  label="Iris Bell",                   audio="ref_iris"),
            dict(id="ruth",  label="Ruth Kestrel",                audio="ref_ruth"),
        ],
        title="The voice lineup",
        prompt="Four women read the same line into the same microphone. One of them is "
               "reading Vera Lyle's part in the last eleven minutes. Listen to where she "
               "takes her breath — a performer breathes in the same place every time she "
               "says the same word.",
    ),
    dict(
        id="lock5", reel=5, type="accusation",
        title="The accusation",
        parts=[
            dict(id="who", question="Who took Vera Lyle out of Studio A?",
                 options=[s["id"] for s in SUSPECTS], answer="vera"),
            dict(id="what", question="What is really on effect #17?",
                 options=["crate", "storm", "iris_death", "vera_death", "nothing"],
                 labels=dict(crate="A wooden crate falling",
                             storm="A thunder rig collapsing",
                             iris_death="The death of Iris Bell",
                             vera_death="The death of Vera Lyle",
                             nothing="Nothing — the reel is blank"),
                 answer="iris_death"),
            dict(id="killer", question="Who killed Iris Bell?",
                 options=[s["id"] for s in SUSPECTS], answer="kestrel"),
        ],
    ),
]

# The coda: the player must run the Archivist's own narration through the console
# at true speed. 1/0.78 = 1.282 — a tolerance band, not a pixel hunt.
CODA = dict(
    id="coda", target_speed=1.282, tolerance=0.055,
    # Every tape the Archivist speaks on, so the discovery lands wherever the
    # player happens to try it rather than only on the three we guessed.
    tracks=sorted(set(
        [k for k in SIMPLE_TAPES if k.startswith("tape_arch_")]
        + ["tape_end_correct", "tape_end_wrong", "tape_end_partial"]
        + ["tape_" + h for hs in
           [["hint_r1_1", "hint_r1_2", "hint_r1_3"], ["hint_r2_1", "hint_r2_2", "hint_r2_3"],
            ["hint_r3_1", "hint_r3_2", "hint_r3_3"], ["hint_r4_1", "hint_r4_2", "hint_r4_3"],
            ["hint_r5_1", "hint_r5_2", "hint_r5_3"]] for h in hs]
    )),
    reveal="tape_epilogue",
)

REELS = [
    dict(n=1, title="Sign-Off",        sub="31 October 1957, 22:49"),
    dict(n=2, title="The Foley Room",  sub="Eleven feet by nine, no window"),
    dict(n=3, title="Party Line",      sub="Three conversations, one wire"),
    dict(n=4, title="Backward",        sub="They only imagined tape going one direction"),
    dict(n=5, title="Nocturne",        sub="Eleven minutes"),
]

HINTS = {
    1: ["hint_r1_1", "hint_r1_2", "hint_r1_3"],
    2: ["hint_r2_1", "hint_r2_2", "hint_r2_3"],
    3: ["hint_r3_1", "hint_r3_2", "hint_r3_3"],
    4: ["hint_r4_1", "hint_r4_2", "hint_r4_3"],
    5: ["hint_r5_1", "hint_r5_2", "hint_r5_3"],
}
