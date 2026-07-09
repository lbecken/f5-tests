"""Font discovery: find a serif TTF family (regular/bold/italic/bold-italic)
on the host system so the PDF embeds real Unicode fonts.

Search order favors classic book faces on macOS, then the common Linux
families. A specific family or directory can be forced from the CLI.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict, List, Optional

# candidate families: name -> {style: [filename candidates]}
FAMILIES: List[dict] = [
    {
        "name": "Georgia",
        "files": {
            "": ["Georgia.ttf"],
            "B": ["Georgia Bold.ttf", "Georgia-Bold.ttf"],
            "I": ["Georgia Italic.ttf", "Georgia-Italic.ttf"],
            "BI": ["Georgia Bold Italic.ttf", "Georgia-BoldItalic.ttf"],
        },
    },
    {
        "name": "Times New Roman",
        "files": {
            "": ["Times New Roman.ttf", "times.ttf"],
            "B": ["Times New Roman Bold.ttf", "timesbd.ttf"],
            "I": ["Times New Roman Italic.ttf", "timesi.ttf"],
            "BI": ["Times New Roman Bold Italic.ttf", "timesbi.ttf"],
        },
    },
    {
        "name": "DejaVu Serif",
        "files": {
            "": ["DejaVuSerif.ttf"],
            "B": ["DejaVuSerif-Bold.ttf"],
            "I": ["DejaVuSerif-Italic.ttf"],
            "BI": ["DejaVuSerif-BoldItalic.ttf"],
        },
    },
    {
        "name": "Liberation Serif",
        "files": {
            "": ["LiberationSerif-Regular.ttf"],
            "B": ["LiberationSerif-Bold.ttf"],
            "I": ["LiberationSerif-Italic.ttf"],
            "BI": ["LiberationSerif-BoldItalic.ttf"],
        },
    },
    {
        "name": "Noto Serif",
        "files": {
            "": ["NotoSerif-Regular.ttf"],
            "B": ["NotoSerif-Bold.ttf"],
            "I": ["NotoSerif-Italic.ttf"],
            "BI": ["NotoSerif-BoldItalic.ttf"],
        },
    },
]

MONO_FAMILIES: List[dict] = [
    {"name": "Menlo", "files": {"": ["Menlo-Regular.ttf"]}},
    {"name": "DejaVu Sans Mono", "files": {"": ["DejaVuSansMono.ttf"]}},
    {"name": "Liberation Mono", "files": {"": ["LiberationMono-Regular.ttf"]}},
    {"name": "Noto Sans Mono", "files": {"": ["NotoSansMono-Regular.ttf"]}},
]

SEARCH_DIRS = [
    # macOS
    "/System/Library/Fonts/Supplemental",
    "/System/Library/Fonts",
    "/Library/Fonts",
    os.path.expanduser("~/Library/Fonts"),
    # Linux
    "/usr/share/fonts/truetype/dejavu",
    "/usr/share/fonts/truetype/liberation",
    "/usr/share/fonts/truetype/noto",
    "/usr/share/fonts/dejavu",
    "/usr/share/fonts/TTF",
    "/usr/local/share/fonts",
    os.path.expanduser("~/.fonts"),
    os.path.expanduser("~/.local/share/fonts"),
]


@dataclass
class FontSet:
    """Paths to the four text styles plus a mono face. Empty paths mean
    'fall back to a PDF core font' (Latin-1 only)."""
    name: str
    paths: Dict[str, str]           # style key "": regular, "B", "I", "BI"
    mono_name: str = ""
    mono_path: str = ""

    @property
    def embedded(self) -> bool:
        return bool(self.paths.get(""))


def _find_family(family: dict, dirs: List[str]) -> Optional[Dict[str, str]]:
    found: Dict[str, str] = {}
    for style, names in family["files"].items():
        for d in dirs:
            for n in names:
                p = os.path.join(d, n)
                if os.path.isfile(p):
                    found[style] = p
                    break
            if style in found:
                break
    if "" not in found:
        return None
    # missing styles fall back to regular; fpdf can't fake bold but a wrong
    # weight beats a crash
    for style in ("B", "I", "BI"):
        found.setdefault(style, found[""])
    return found


def discover_fonts(family: str = "", extra_dirs: Optional[List[str]] = None) -> FontSet:
    dirs = list(extra_dirs or []) + SEARCH_DIRS
    candidates = FAMILIES
    if family:
        wanted = family.lower()
        candidates = [f for f in FAMILIES if wanted in f["name"].lower()]
        if not candidates:
            raise ValueError(
                f"unknown font family {family!r}; known: "
                + ", ".join(f["name"] for f in FAMILIES)
            )
    for fam in candidates:
        paths = _find_family(fam, dirs)
        if paths:
            fs = FontSet(name=fam["name"], paths=paths)
            for mono in MONO_FAMILIES:
                mp = _find_family(mono, dirs)
                if mp:
                    fs.mono_name, fs.mono_path = mono["name"], mp[""]
                    break
            return fs
    # Nothing found: PDF core fonts (Helvetica/Times/Courier, Latin-1 only)
    return FontSet(name="", paths={})
