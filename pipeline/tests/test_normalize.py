from pipeline.normalize import normalize


def test_gutenberg_typography_normalizes():
    src = "the du Barry’s “what-nots”--strewn pell-mell about the æsthetic room"
    assert (
        normalize(src)
        == "the du Barry's \"what-nots\"—strewn pell-mell about the aesthetic room"
    )


def test_whitespace_collapses():
    assert normalize("a  hard-wrapped\nline\n\twith   tabs ") == "a hard-wrapped line with tabs"


def test_original_vs_smoothed_pair_differ():
    # A hand-built pair: the original and a lightly model-smoothed version.
    # The smoothed one reads better; normalization must NOT make them equal,
    # or the verbatim check would silently accept text Fry did not write.
    original = normalize(
        "Art, then, is an expression and a stimulus of this imaginative life,\n"
        "which is separated from actual life by the absence of responsive action."
    )
    smoothed = normalize(
        "Art, then, is an expression and a stimulus of the imaginative life, "
        "which is separated from actual life by the absence of responsive action."
    )
    assert original != smoothed


def test_smoothing_punctuation_still_detected():
    original = normalize("It is irrelevant to ask it, while we are enjoying it")
    smoothed = normalize("It is irrelevant to ask it while we are enjoying it")
    assert original != smoothed
