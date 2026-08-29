from pipeline.filters import check, load_wordlist, words_of

WORDLIST = load_wordlist()

GOOD = "Art is an expression and a stimulus of the imaginative life, quite bereft of joy."


def test_good_sentence_passes():
    assert check(GOOD, WORDLIST).ok


def test_length_bounds():
    assert not check("Too short a sentence.", WORDLIST).ok
    assert not check(GOOD + " " + GOOD, WORDLIST).ok


def test_length_window_is_configurable():
    s = "The quick brown fox jumps over the lazy sleeping dog."
    assert not check(s, WORDLIST).ok
    assert check(s, WORDLIST, min_len=40).ok


def test_charset_whitelist():
    s = "Art is an expression & a stimulus of the imaginative life, quite bereft of joy."
    r = check(s, WORDLIST)
    assert not r.ok and "disallowed" in r.reason


def test_distinct_letters_floor():
    r = check("An ant and a tan rat ran at a tin can and a rat sat on a tan cat.", WORDLIST)
    assert not r.ok and "distinct" in r.reason


def test_unknown_word_rejected():
    s = "Art is an expression and a stimulus of the imaginative life of Cezanne always."
    r = check(s, WORDLIST)
    assert not r.ok and "cezanne" in r.reason


def test_words_of_keeps_contractions_whole():
    assert words_of("Don't stop; it's fine.") == ["don't", "stop", "it's", "fine"]
