"""Text normalization shared by the verbatim check and the mechanical filters.

Normalization maps the Gutenberg transcription's typography (curly quotes,
double-hyphen em-dashes, ligatures) onto the small character set the game
ships, and collapses whitespace. Both the source text and every candidate
sentence go through the same function, so the verbatim substring check
compares like with like.
"""

from __future__ import annotations

import re

# Multi-character replacements first: the Gutenberg text renders em-dashes
# as "--".
_MULTI = [
    ("--", "—"),
    ("…", "..."),
]

_SINGLE = str.maketrans(
    {
        "‘": "'",  # left single quote
        "’": "'",  # right single quote / apostrophe
        "“": '"',  # left double quote
        "”": '"',  # right double quote
        "–": "-",  # en dash
        "æ": "ae",  # ae ligature
        "Æ": "Ae",
        "œ": "oe",
        "Œ": "Oe",
        "ﬁ": "fi",
        "ﬂ": "fl",
        " ": " ",
    }
)

_WS = re.compile(r"\s+")


def normalize(text: str) -> str:
    for old, new in _MULTI:
        text = text.replace(old, new)
    text = text.translate(_SINGLE)
    return _WS.sub(" ", text).strip()
