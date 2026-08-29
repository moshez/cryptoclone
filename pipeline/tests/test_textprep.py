import textwrap

from pipeline.textprep import _display_title, parse_essays

FAKE_BOOK = textwrap.dedent(
    """\
    The Project Gutenberg eBook of Vision and Design

    *** START OF THE PROJECT GUTENBERG EBOOK VISION AND DESIGN ***

    [Illustration:

    Maya Sculpture

    Frontispiece]

    VISION AND DESIGN

    PREFACE

    This preface should be stripped along with the title page.

    CONTENTS

    ART AND LIFE                                     1

    AN ESSAY IN ÆSTHETICS                           11

    LIST OF ILLUSTRATIONS

    NEGRO SCULPTURE                                 66

    ART AND LIFE[1]

    First paragraph of the first essay,
    hard-wrapped across lines.

    I

    [Illustration: A caption to strip]

    Second paragraph mentioning art[2] with a footnote reference.

    AN ESSAY IN ÆSTHETICS

    A paragraph in the second essay.

    INDEX

    Albigensian crusade, 99

    [1] A footnote to strip.

    *** END OF THE PROJECT GUTENBERG EBOOK VISION AND DESIGN ***
    """
)


def test_stripping():
    essays = parse_essays(FAKE_BOOK, min_essays=2)
    titles = [e.title for e in essays]
    assert titles == ["Art and Life", "An Essay in Aesthetics"]
    body = " ".join(p.text for e in essays for p in e.paragraphs)
    assert "First paragraph" in body
    assert "Second paragraph mentioning art with a footnote" in body
    assert "preface" not in body.lower()
    assert "caption" not in body
    assert "Albigensian" not in body
    assert "footnote to strip" not in body
    assert "Frontispiece" not in body
    # Offsets point back into the raw file.
    first = essays[0].paragraphs[0]
    assert FAKE_BOOK[first.start : first.end].startswith("First paragraph")


def test_sanity_floor():
    import pytest

    with pytest.raises(ValueError):
        parse_essays(FAKE_BOOK, min_essays=5)


def test_display_title():
    assert _display_title("AN ESSAY IN ÆSTHETICS") == "An Essay in Aesthetics"
    assert _display_title("THE OTTOMAN AND THE WHATNOT") == "The Ottoman and the Whatnot"
    assert _display_title("DÜRER AND HIS CONTEMPORARIES") == "Dürer and His Contemporaries"
