from pipeline.cli import derive_levels
from pipeline.twists import HORIZON

ACCEPTED = [
    ("ART IS SIGNIFICANT FORM, AND NOTHING ELSE MATTERS HERE TODAY.", "Essay A"),
    ("THE ARTIST ALONE SEES THE THING ITSELF, NOT ITS USES OR LABELS.", "Essay B"),
    ("EVERY DESIGN QUESTION COMES BACK TO VISION IN THE END, ALWAYS.", "Essay C"),
]


def test_empty_corpus_yields_no_levels():
    assert derive_levels([]) == []


def test_corpus_cycles_to_the_full_horizon():
    levels = derive_levels(ACCEPTED)
    assert len(levels) == HORIZON
    assert [lv["id"] for lv in levels] == list(range(1, HORIZON + 1))
    for pos, level in enumerate(levels):
        assert level["solution"] == ACCEPTED[pos % len(ACCEPTED)][0]
        assert level["attribution"]["essay"] == ACCEPTED[pos % len(ACCEPTED)][1]


def test_repeated_sentence_gets_a_fresh_presentation():
    levels = derive_levels(ACCEPTED)
    first, repeat = levels[0], levels[len(ACCEPTED)]
    assert first["solution"] == repeat["solution"]
    assert first["cipher"] != repeat["cipher"] or (
        first["revealedIndices"] != repeat["revealedIndices"]
    )


def test_difficulty_still_ramps_across_the_horizon():
    levels = derive_levels(ACCEPTED)
    tiers = [lv["tier"] for lv in levels]
    assert tiers[0] == 1 and tiers[-1] == 5
    assert tiers == sorted(tiers)
    assert len(levels[0]["revealedIndices"]) > 0
    assert levels[-1]["revealedIndices"] == []
