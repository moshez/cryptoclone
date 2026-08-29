"""Uniqueness check: a puzzle is shippable only if its ciphertext admits a
single all-dictionary decipherment.

The plaintext itself acts as the cipher skeleton: any injective relabeling of
its letters that maps every word to a dictionary word is a "solution". If two
or more exist, a solver can legitimately reach a wrong answer, so the
sentence is rejected.
"""

from __future__ import annotations

from collections import defaultdict
from functools import lru_cache
from pathlib import Path

from .filters import WORDLIST_PATH, load_wordlist, words_of

ALPHABET = "abcdefghijklmnopqrstuvwxyz"


def signature(word: str) -> str:
    """Isomorphism signature: first-occurrence index per letter, apostrophes
    kept literally. e.g. letter -> '0.1.2.2.1.3'; don't -> "0.1.2.'.3"."""
    seen: dict[str, int] = {}
    parts = []
    for ch in word:
        if ch == "'":
            parts.append("'")
        else:
            if ch not in seen:
                seen[ch] = len(seen)
            parts.append(str(seen[ch]))
    return ".".join(parts)


def build_index(words: frozenset[str]) -> dict[str, list[str]]:
    index: dict[str, list[str]] = defaultdict(list)
    for w in sorted(words):
        index[signature(w)].append(w)
    return dict(index)


@lru_cache(maxsize=1)
def default_index() -> dict[str, list[str]]:
    return build_index(load_wordlist(Path(WORDLIST_PATH)))


def _compatible(word: str, cand: str, mapping: dict[str, str], used: set[str]) -> bool:
    local: dict[str, str] = {}
    local_used: set[str] = set()
    for a, b in zip(word, cand):
        if a == "'":
            continue
        assigned = mapping.get(a) or local.get(a)
        if assigned is not None:
            if assigned != b:
                return False
            continue
        if b in used or b in local_used:
            return False
        local[a] = b
        local_used.add(b)
    return True


def count_solutions(
    sentence: str, index: dict[str, list[str]] | None = None, cap: int = 2
) -> int:
    """Count distinct full letter-mappings (up to ``cap``) under which every
    word of ``sentence`` is a dictionary word."""
    if index is None:
        index = default_index()
    words = sorted(set(words_of(sentence)), key=len, reverse=True)
    if not words:
        return 0
    candidates = []
    for w in words:
        cands = index.get(signature(w), [])
        if not cands:
            return 0
        candidates.append(cands)

    count = 0

    def search(remaining: list[int], mapping: dict[str, str], used: set[str]) -> None:
        nonlocal count
        if count >= cap:
            return
        if not remaining:
            count += 1
            return
        # Most-constrained word first: fewest candidates compatible with the
        # current partial mapping.
        best_i = None
        best_cands: list[str] = []
        for i in remaining:
            compat = [c for c in candidates[i] if _compatible(words[i], c, mapping, used)]
            if best_i is None or len(compat) < len(best_cands):
                best_i, best_cands = i, compat
                if not compat:
                    return
                if len(compat) == 1:
                    break
        rest = [i for i in remaining if i != best_i]
        word = words[best_i]
        for cand in best_cands:
            new_map = dict(mapping)
            new_used = set(used)
            for a, b in zip(word, cand):
                if a != "'" and a not in new_map:
                    new_map[a] = b
                    new_used.add(b)
            search(rest, new_map, new_used)
            if count >= cap:
                return

    search(list(range(len(words))), {}, set())
    return count


def is_unique(sentence: str, index: dict[str, list[str]] | None = None) -> bool:
    return count_solutions(sentence, index, cap=2) == 1
