"""Voice casting for THE NOCTURNE TAPES.

One entry per character. `vid` is the ElevenLabs voice id; `settings` tunes the
performance. `model` defaults to eleven_v3 (supports acting tags like [whispers]).

The Archivist deliberately shares Vera's voice id — the whole endgame rests on it.
The disguise is applied in post as a real, reversible resample (see fx.py).
"""

MODEL_PERF = "eleven_v3"            # acting tags, best delivery
MODEL_PLAIN = "eleven_multilingual_v2"  # steadier, for flat/official reads


def _s(stability=0.4, similarity=0.8, style=0.3, speed=1.0):
    return {
        "stability": stability,
        "similarity_boost": similarity,
        "style": style,
        "use_speaker_boost": True,
        "speed": speed,
    }


VOICES = {
    # --- the vanished -------------------------------------------------------
    "VERA": {
        "vid": "pFZP5JQG7iQjIQuC4Bku",  # Lily — velvety actress, British
        "name": "Vera Lyle",
        "settings": _s(0.35, 0.85, 0.45),
    },
    # The Archivist IS Vera. Same voice, pitched down 0.78x in post.
    "ARCHIVIST": {
        "vid": "pFZP5JQG7iQjIQuC4Bku",
        "name": "The Archivist",
        "settings": _s(0.45, 0.85, 0.30, speed=1.06),
        "fx": "archivist",
    },
    # --- the station --------------------------------------------------------
    "KESTREL": {
        "vid": "pqHfZKP75CvOlQylNhV4",  # Bill — wise, mature, old American
        "name": "Marlow Kestrel",
        "settings": _s(0.45, 0.8, 0.35),
    },
    "DOT": {
        "vid": "cgSgspJ2msm6clMCkdW9",  # Jessica — bright, warm
        "name": "Dorothy 'Dot' Vance",
        "settings": _s(0.35, 0.8, 0.45),
    },
    "EDDIE": {
        "vid": "CwhRBWXzGAHq8TQ4Fs17",  # Roger — laid-back, casual
        "name": "Eddie Ferris",
        "settings": _s(0.4, 0.8, 0.4),
    },
    "ANNOUNCER": {
        "vid": "onwK4e9ZLuTAKqWW03F9",  # Daniel — steady broadcaster
        "name": "KBLK Continuity",
        "settings": _s(0.6, 0.8, 0.25),
    },
    "JULIAN": {
        "vid": "JBFqnCBsd6RMkjVDRZzb",  # George — warm storyteller, British
        "name": "Julian Vane",
        "settings": _s(0.4, 0.8, 0.45),
    },
    # --- the others ---------------------------------------------------------
    "RUTH": {
        "vid": "hpp4J3VqNfWAUOO0d1Us",  # Bella — warm
        "name": "Ruth Kestrel",
        "settings": _s(0.4, 0.8, 0.4),
    },
    "DOYLE": {
        "vid": "N2lVS1w4EtoT3dr4eOWO",  # Callum — husky trickster
        "name": "Cal Doyle",
        "settings": _s(0.4, 0.8, 0.4),
    },
    "HALLIGAN": {
        "vid": "pNInz6obpgDQGcFmaJgB",  # Adam — firm
        "name": "Det. Sgt. Halligan",
        "settings": _s(0.5, 0.8, 0.3),
    },
    "PEGGY": {
        "vid": "FGY2WhTYpPnrIDTdsKH5",  # Laura — young, quirky
        "name": "Peggy Nash",
        "settings": _s(0.35, 0.8, 0.45),
    },
    "IRIS": {
        "vid": "Xb7hH8MSUJpSbSDYk0k2",  # Alice — clear, British
        "name": "Iris Bell",
        "settings": _s(0.35, 0.85, 0.45),
    },
    "CLERK": {
        "vid": "bIHbv24MWmeRgasZH58o",  # Will — young American
        "name": "Night Clerk",
        "settings": _s(0.5, 0.8, 0.25),
    },
    "CONSOLE": {
        "vid": "SAz9YHcvj6GT2YYXdXww",  # River — neutral
        "name": "Console",
        "settings": _s(0.7, 0.75, 0.1),
        "model": MODEL_PLAIN,
    },
}
