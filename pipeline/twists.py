"""Difficulty presentation: cipher numbering, revealed mappings, and locked
cells, all derived deterministically from (levelId, tier)."""

from __future__ import annotations

import hashlib
import random
import string
from dataclasses import dataclass, field

REVEAL_COUNTS = {1: 8, 2: 5, 3: 3, 4: 1, 5: 0}
LOCKED_COUNTS = {1: 0, 2: 0, 3: 2, 4: 4, 5: 6}
MAX_PLACEMENT_ATTEMPTS = 50


def rng_for(level_id: int, tier: int, purpose: str) -> random.Random:
    digest = hashlib.sha256(f"{level_id}:{tier}:{purpose}".encode()).digest()
    return random.Random(int.from_bytes(digest[:8], "big"))


def assign_tier(position: int, total: int) -> int:
    """Tier ramps with progression through the level list."""
    frac = position / max(total, 1)
    if frac < 0.08:
        return 1
    if frac < 0.20:
        return 2
    if frac < 0.45:
        return 3
    if frac < 0.75:
        return 4
    return 5


@dataclass
class Twists:
    cipher: list[int]  # per character; -1 for non-letters
    revealed: list[tuple[int, str]]  # (cipher number, plaintext letter)
    locked_indices: list[int]
    half_locked: dict[int, str] = field(default_factory=dict)  # index -> "left"|"right"


def letter_mapping(level_id: int, tier: int) -> dict[str, int]:
    numbers = list(range(1, 27))
    rng_for(level_id, tier, "mapping").shuffle(numbers)
    return dict(zip(string.ascii_uppercase, numbers))


def word_spans(solution: str) -> list[tuple[int, int]]:
    """Half-open [start, end) spans of maximal alphabetic runs."""
    spans = []
    start = None
    for i, ch in enumerate(solution):
        if ch.isalpha():
            if start is None:
                start = i
        elif start is not None:
            spans.append((start, i))
            start = None
    if start is not None:
        spans.append((start, len(solution)))
    return spans


def simulate_unlock(
    solution: str, locked: list[int], half_locked: dict[int, str]
) -> bool:
    """True iff every locked cell eventually becomes reachable, starting from
    the initially visible (unlocked letter) cells and repeatedly unlocking
    locked cells adjacent to a visible cell in the same word."""
    spans = word_spans(solution)
    word_of = {}
    for w, (s, e) in enumerate(spans):
        for i in range(s, e):
            word_of[i] = w
    visible = {i for i, ch in enumerate(solution) if ch.isalpha() and i not in set(locked)}
    still_locked = set(locked)
    changed = True
    while changed and still_locked:
        changed = False
        for i in sorted(still_locked):
            direction = half_locked.get(i, "both")
            can = False
            if direction in ("both", "left"):
                can = can or (i - 1 in visible and word_of.get(i - 1) == word_of.get(i))
            if direction in ("both", "right"):
                can = can or (i + 1 in visible and word_of.get(i + 1) == word_of.get(i))
            if can:
                visible.add(i)
                still_locked.discard(i)
                changed = True
    return not still_locked


def derive_twists(level_id: int, tier: int, solution: str) -> Twists:
    mapping = letter_mapping(level_id, tier)
    cipher = [mapping[ch] if ch.isalpha() else -1 for ch in solution]

    letters_present = sorted({ch for ch in solution if ch.isalpha()})
    rng = rng_for(level_id, tier, "reveal")
    # Always leave a majority of the letters unrevealed.
    reveal_n = min(REVEAL_COUNTS[tier], max(len(letters_present) - 6, 0))
    revealed = [(mapping[ch], ch) for ch in sorted(rng.sample(letters_present, reveal_n))]

    spans = word_spans(solution)
    multi_word_cells = [i for s, e in spans if e - s >= 2 for i in range(s, e)]
    locked_rng = rng_for(level_id, tier, "locked")
    locked_n = min(LOCKED_COUNTS[tier], len(multi_word_cells) // 4)
    locked: list[int] = []
    half_locked: dict[int, str] = {}
    while locked_n > 0:
        for _ in range(MAX_PLACEMENT_ATTEMPTS):
            locked = sorted(locked_rng.sample(multi_word_cells, locked_n))
            half_locked = {}
            if tier == 5:
                for i in locked:
                    roll = locked_rng.random()
                    if roll < 0.25:
                        half_locked[i] = "left"
                    elif roll < 0.5:
                        half_locked[i] = "right"
            if simulate_unlock(solution, locked, half_locked):
                return Twists(cipher, revealed, locked, half_locked)
        locked_n -= 1  # placement kept deadlocking; ease off
    return Twists(cipher, revealed, [], {})
