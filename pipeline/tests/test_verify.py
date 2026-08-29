from pipeline.normalize import normalize
from pipeline.verify import verify_verbatim

SOURCE = normalize(
    "In the ﬁrst place, he had built himself a house which was\n"
    "preternaturally hideous; his taste was deplorable--and his manners\n"
    "indifferent; but he had a dream of the æsthetic life."
)


def test_exact_sentence_verifies():
    ok = verify_verbatim(
        "he had built himself a house which was preternaturally hideous", SOURCE
    )
    assert ok.ok


def test_typography_differences_are_forgiven():
    # The candidate uses plain ASCII where the source has ligatures/dashes.
    ok = verify_verbatim("his taste was deplorable—and his manners indifferent", SOURCE)
    assert ok.ok


def test_smoothed_text_is_dropped_with_diff():
    res = verify_verbatim(
        "he built himself a house which was preternaturally hideous", SOURCE
    )
    assert not res.ok
    assert res.diff  # the drop is logged with a diff, never repaired
