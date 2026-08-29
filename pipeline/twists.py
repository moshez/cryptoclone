"""Difficulty presentation: cipher numbering, revealed cells, and locked
cells, all derived deterministically from (levelId, tier).

Hints are per-cell, not per-letter: a hinted letter gets exactly ONE of its
occurrences pre-filled, and the player fills the remaining occurrences of
that letter by hand (a known-plaintext attack: nothing is ever auto-filled
for them). Progression is therefore about how many letters get that single
pre-filled cell, and it decays slowly across a 1000-level horizon: early
levels hint all but one letter (mostly mechanical filling), the last
levels hint nothing.
"""

from __future__ import annotations

import hashlib
import random
import string
from dataclasses import dataclass, field

# The progression is tuned across this many levels; corpora shorter than
# the horizon simply stop earlier along the same (slow) ramp.
HORIZON = 1000

# Fraction of the level's distinct letters left UNhinted, from the first
# level (almost everything hinted) to the horizon (nothing hinted).
UNHINTED_START = 0.08

LOCKED_COUNTS = {1: 0, 2: 0, 3: 2, 4: 4, 5: 6}
MAX_PLACEMENT_ATTEMPTS = 50


def progress_frac(position: int) -> float:
    """0.0 at the first level, 1.0 at the horizon, clamped beyond it."""
    return min(max(position, 0), HORIZON - 1) / (HORIZON - 1)


def tier_for(frac: float) -> int:
    return 1 + min(4, int(frac * 5))


def assign_tier(position: int) -> int:
    """Tier ramps with absolute position along the 1000-level horizon."""
    return tier_for(progress_frac(position))


def rng_for(level_id: int, tier: int, purpose: str) -> random.Random:
    digest = hashlib.sha256(f"{level_id}:{tier}:{purpose}".encode()).digest()
    return random.Random(int.from_bytes(digest[:8], "big"))


@dataclass
class Twists:
    cipher: list[int]  # per character; -1 for non-letters
    revealed_indices: list[int]  # cell indices pre-filled with their letter
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


def hinted_letter_count(letters_present: int, frac: float) -> int:
    unhinted_frac = UNHINTED_START + (1 - UNHINTED_START) * frac
    unhinted = min(letters_present, max(1, round(letters_present * unhinted_frac)))
    return letters_present - unhinted


def derive_twists(level_id: int, solution: str, frac: float) -> Twists:
    tier = tier_for(frac)
    mapping = letter_mapping(level_id, tier)
    cipher = [mapping[ch] if ch.isalpha() else -1 for ch in solution]

    spans = word_spans(solution)
    multi_word_cells = [i for s, e in spans if e - s >= 2 for i in range(s, e)]
    locked_rng = rng_for(level_id, tier, "locked")
    locked_n = min(LOCKED_COUNTS[tier], len(multi_word_cells) // 4)
    locked: list[int] = []
    half_locked: dict[int, str] = {}
    while locked_n > 0:
        placed = False
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
                placed = True
                break
        if placed:
            break
        locked, half_locked = [], {}
        locked_n -= 1  # placement kept deadlocking; ease off

    letters_present = sorted({ch for ch in solution if ch.isalpha()})
    rng = rng_for(level_id, tier, "reveal")
    hinted_n = hinted_letter_count(len(letters_present), frac)
    locked_set = set(locked)
    revealed_indices: list[int] = []
    for ch in sorted(rng.sample(letters_present, hinted_n)):
        cells = [i for i, c in enumerate(solution) if c == ch and i not in locked_set]
        if cells:
            revealed_indices.append(rng.choice(cells))
    revealed_indices.sort()

    return Twists(cipher, revealed_indices, locked, half_locked)
