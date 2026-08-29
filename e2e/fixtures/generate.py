"""Regenerate the committed e2e fixture corpus (60 deterministic levels).

Run from the repo root:  python3 e2e/fixtures/generate.py

Kept separate from the real /data corpus so regenerating the real corpus
never invalidates e2e expectations or visual baselines.
"""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from pipeline import emit, twists  # noqa: E402

ONES = "ZERO ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT NINE TEN ELEVEN TWELVE THIRTEEN FOURTEEN FIFTEEN SIXTEEN SEVENTEEN EIGHTEEN NINETEEN".split()
TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY"]


def spell(n: int) -> str:
    if n < 20:
        return ONES[n]
    tens, ones = divmod(n, 10)
    return TENS[tens] + ("" if ones == 0 else " " + ONES[ones])


def solution_for(n: int) -> str:
    return f"THE QUICK BROWN FOX JUMPS OVER LAZY DOG {spell(n)}."


def main() -> None:
    out_dir = Path(__file__).parent / "data"
    levels = []
    total = 60
    for level_id in range(1, total + 1):
        # Compress the whole 1000-level progression into the fixture corpus
        # so every difficulty phase (hints, locks, half-locks) is exercised.
        frac = (level_id - 1) / (total - 1)
        tier = twists.tier_for(frac)
        solution = solution_for(level_id)
        tw = twists.derive_twists(level_id, solution, frac)
        levels.append(emit.level_json(level_id, tier, solution, tw, "Fixture Essay"))
    manifest = emit.emit(levels, out_dir)
    print(f"fixtures: {manifest['totalLevels']} levels, dataVersion {manifest['dataVersion']}")


if __name__ == "__main__":
    main()
