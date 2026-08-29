from pipeline.twists import (
    HORIZON,
    assign_tier,
    derive_twists,
    hinted_letter_count,
    letter_mapping,
    progress_frac,
    simulate_unlock,
    word_spans,
)

SOLUTION = "ART IS SIGNIFICANT FORM, AND NOTHING ELSE MATTERS HERE TODAY."


def test_word_spans():
    assert word_spans("AB, CD") == [(0, 2), (4, 6)]


def test_derivation_is_deterministic():
    a = derive_twists(137, SOLUTION, 0.5)
    b = derive_twists(137, SOLUTION, 0.5)
    assert (a.cipher, a.revealed_indices, a.locked_indices, a.half_locked) == (
        b.cipher,
        b.revealed_indices,
        b.locked_indices,
        b.half_locked,
    )
    # A different level id gives a different presentation.
    c = derive_twists(138, SOLUTION, 0.5)
    assert a.cipher != c.cipher or a.revealed_indices != c.revealed_indices


def test_cipher_covers_letters_only():
    t = derive_twists(1, SOLUTION, 0.0)
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


def test_reveals_are_one_cell_per_letter():
    t = derive_twists(3, SOLUTION, 0.0)
    letters = [SOLUTION[i] for i in t.revealed_indices]
    assert len(letters) == len(set(letters))
    for i in t.revealed_indices:
        assert SOLUTION[i].isalpha()
    # A hinted letter with several occurrences still has unrevealed cells
    # for the player to fill in by hand.
    revealed = set(t.revealed_indices)
    for i in t.revealed_indices:
        occurrences = [j for j, ch in enumerate(SOLUTION) if ch == SOLUTION[i]]
        if len(occurrences) >= 2:
            assert any(j not in revealed for j in occurrences)


def test_early_levels_hint_all_but_one_letter():
    distinct = len({ch for ch in SOLUTION if ch.isalpha()})
    t = derive_twists(1, SOLUTION, progress_frac(0))
    assert len(t.revealed_indices) == distinct - 1


def test_progression_decays_slowly_to_zero():
    distinct = 18
    counts = [
        hinted_letter_count(distinct, progress_frac(pos)) for pos in range(HORIZON)
    ]
    assert counts[0] == distinct - 1
    assert counts[-1] == 0
    assert counts == sorted(counts, reverse=True)
    # Slow: the hint count never drops by more than one letter at a time.
    for a, b in zip(counts, counts[1:]):
        assert a - b <= 1


def test_progression_clamps_beyond_horizon():
    assert progress_frac(HORIZON + 500) == 1.0
    assert assign_tier(HORIZON + 500) == 5


def test_tier_controls_reveals_and_locks():
    t1 = derive_twists(5, SOLUTION, 0.0)
    t5 = derive_twists(5, SOLUTION, 1.0)
    assert len(t1.revealed_indices) > len(t5.revealed_indices)
    assert len(t5.revealed_indices) == 0
    assert len(t1.locked_indices) == 0
    assert len(t5.locked_indices) > 0


def test_reveals_never_target_locked_cells():
    for level_id in range(1, 40):
        for frac in (0.5, 0.7, 0.9):
            t = derive_twists(level_id, SOLUTION, frac)
            assert not set(t.revealed_indices) & set(t.locked_indices)


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
        for frac in (0.5, 0.7, 0.95):
            t = derive_twists(level_id, SOLUTION, frac)
            assert simulate_unlock(SOLUTION, t.locked_indices, t.half_locked)


def test_assign_tier_ramps_over_horizon():
    tiers = [assign_tier(i) for i in range(HORIZON)]
    assert tiers[0] == 1 and tiers[-1] == 5
    assert tiers == sorted(tiers)
    # Slow: each tier owns a fifth of the horizon.
    assert tiers.count(1) >= HORIZON // 5 - 1
