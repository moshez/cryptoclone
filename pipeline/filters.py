"""Mechanical filters applied to candidate sentences after normalization."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

WORDLIST_PATH = Path(__file__).parent / "wordlist.txt"

ALLOWED_PUNCT = set(".,;:'!?—- ")
_WORD = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)*")

MIN_LEN = 60
MAX_LEN = 120
MIN_DISTINCT_LETTERS = 12


def load_wordlist(path: Path = WORDLIST_PATH) -> frozenset[str]:
    words = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        w = line.strip().lower()
        if not w:
            continue
        # Single letters in a spellcheck-oriented list would let the
        # uniqueness solver treat any letter as a word; only real
        # single-letter English words belong in the dictionary.
        if len(w) == 1 and w not in {"a", "i", "o"}:
            continue
        words.add(w)
    return frozenset(words)


def words_of(sentence: str) -> list[str]:
    return [m.group(0).lower() for m in _WORD.finditer(sentence)]


@dataclass
class FilterResult:
    ok: bool
    reason: str = ""


def check(
    sentence: str,
    wordlist: frozenset[str],
    min_len: int = MIN_LEN,
    max_len: int = MAX_LEN,
) -> FilterResult:
    """Check an already-normalized sentence against the mechanical filters."""
    n = len(sentence)
    if not (min_len <= n <= max_len):
        return FilterResult(False, f"length {n} outside [{min_len}, {max_len}]")
    bad = {c for c in sentence if not (c.isascii() and c.isalpha()) and c not in ALLOWED_PUNCT}
    if bad:
        return FilterResult(False, f"disallowed characters: {sorted(bad)!r}")
    distinct = {c for c in sentence.lower() if c.isalpha()}
    if len(distinct) < MIN_DISTINCT_LETTERS:
        return FilterResult(False, f"only {len(distinct)} distinct letters")
    unknown = [w for w in words_of(sentence) if w not in wordlist]
    if unknown:
        return FilterResult(False, f"words not in wordlist: {unknown}")
    return FilterResult(True)
