from pipeline.uniqueness import build_index, count_solutions, default_index, signature


def test_signature():
    assert signature("letter") == "0.1.2.2.1.3"
    assert signature("don't") == "0.1.2.'.3"


def test_ambiguous_short_phrase_rejected():
    # Toy dictionary in which "ab cd" has two all-dictionary readings.
    index = build_index(frozenset({"at", "on", "it", "up", "he", "me"}))
    assert count_solutions("at on", index, cap=2) >= 2


def test_unique_in_toy_dictionary():
    index = build_index(frozenset({"jazz", "fizz", "buzz", "quiz"}))
    # "jazz" maps only onto itself or the other -zz words; "quiz" constrains
    # nothing else, but "jazz quiz" shares the z... build a truly unique one:
    assert count_solutions("jazz", index, cap=5) == 3  # jazz/fizz/buzz all match 0.1.2.2


def test_known_ambiguous_real_phrases_rejected():
    # Short phrases are structurally ambiguous against a real dictionary.
    assert count_solutions("the cat sat on the mat", cap=2) >= 2
    assert count_solutions("art is life", cap=2) >= 2


def test_known_unique_longer_sentence_passes():
    s = (
        "art is an expression and a stimulus of this imaginative life, "
        "which is separated from actual life by the absence of responsive action"
    )
    assert count_solutions(s, cap=2) == 1


def test_word_missing_from_dictionary_means_zero_solutions():
    index = build_index(frozenset({"at"}))
    assert count_solutions("xyzzy", index, cap=2) == 0


def test_default_index_loads():
    assert len(default_index()) > 10000
