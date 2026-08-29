"""Sentence segmentation with source offsets, via pysbd."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import pysbd


@dataclass
class Sentence:
    text: str
    # Offsets into the unwrapped paragraph text; combined with the
    # paragraph's own span these locate the sentence in the source file.
    start: int
    end: int


@lru_cache(maxsize=1)
def _segmenter() -> pysbd.Segmenter:
    return pysbd.Segmenter(language="en", clean=False, char_span=True)


def unwrap(paragraph: str) -> str:
    """Join hard-wrapped lines into one line without changing offsets' meaning
    beyond newline->space (a 1:1 character substitution)."""
    return paragraph.replace("\n", " ").strip()


def split_sentences(paragraph_text: str) -> list[Sentence]:
    text = unwrap(paragraph_text)
    return [
        Sentence(text=span.sent.strip(), start=span.start, end=span.end)
        for span in _segmenter().segment(text)
        if span.sent.strip()
    ]
