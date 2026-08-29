from pipeline.twists import (
    assign_tier,
    derive_twists,
    letter_mapping,
    simulate_unlock,
    word_spans,
)

SOLUTION = "ART IS SIGNIFICANT FORM, AND NOTHING ELSE MATTERS HERE TODAY."


def test_word_spans():
    assert word_spans("AB, CD") == [(0, 2), (4, 6)]


def test_derivation_is_deterministic():
    a = derive_twists(137, 3, SOLUTION)
    b = derive_twists(137, 3, SOLUTION)
    assert (a.cipher, a.revealed, a.locked_indices, a.half_locked) == (
        b.cipher,
        b.revealed,
        b.locked_indices,
        b.half_locked,
    )
    # A different level id gives a different presentation.
    c = derive_twists(138, 3, SOLUTION)
    assert a.cipher != c.cipher or a.revealed != c.revealed


def test_cipher_covers_letters_only():
    t = derive_twists(1, 1, SOLUTION)
    for ch, num in zip(SOLUTION, t.cipher):
        if ch.isalpha():
            assert 1 <= num <= 26
        else:
            assert num == -1
    # Substitution is consistent: same letter, same number.
    mapping = {}
    for ch, num in zip(SOLUTION, t.cipher):
        if ch.isalpha():
            assert mapping.setdefault(ch, num) == num


def test_tier_controls_reveals():
    t1 = derive_twists(5, 1, SOLUTION)
    t5 = derive_twists(5, 5, SOLUTION)
    assert len(t1.revealed) > len(t5.revealed)
    assert len(t5.revealed) == 0
    assert len(t1.locked_indices) == 0


def test_mapping_is_bijective():
    m = letter_mapping(7, 4)
    assert sorted(m.values()) == list(range(1, 27))


def test_deadlocked_configuration_rejected():
    # Two adjacent locked cells in a two-letter word can never unlock:
    # neither ever has a visible same-word neighbour.
    assert not simulate_unlock("IT IS", [0, 1], {})
    # The same cells in a longer word unlock from the right.
    assert simulate_unlock("ITEM", [0, 1], {})


def test_half_lock_direction_respected():
    # Cell 0 locked "left" has no left neighbour: unreachable.
    assert not simulate_unlock("ITEM", [0], {0: "left"})
    assert simulate_unlock("ITEM", [0], {0: "right"})


def test_derived_locked_cells_always_reachable():
    for level_id in range(1, 40):
        for tier in (3, 4, 5):
            t = derive_twists(level_id, tier, SOLUTION)
            assert simulate_unlock(SOLUTION, t.locked_indices, t.half_locked)


def test_assign_tier_ramps():
    total = 100
    tiers = [assign_tier(i, total) for i in range(total)]
    assert tiers[0] == 1 and tiers[-1] == 5
    assert tiers == sorted(tiers)
