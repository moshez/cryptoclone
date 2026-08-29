"""Strip Gutenberg boilerplate and split the book into essay paragraphs.

Keeps only essay body paragraphs, each with its character offset span in the
raw file so any sentence can be traced back to the source.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

START_MARKER = re.compile(r"\*\*\* START OF THE PROJECT GUTENBERG EBOOK [^\n]*\*\*\*")
END_MARKER = re.compile(r"\*\*\* END OF THE PROJECT GUTENBERG EBOOK [^\n]*\*\*\*")

_FOOTNOTE_REF = re.compile(r"\[\d+\]")
_PARAGRAPH = re.compile(r"(?:[^\n]*\S[^\n]*\n?)+")
_CONTENTS_LINE = re.compile(r"^(.+?)\s{2,}\d+$")

_MINOR_WORDS = {"a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to"}


@dataclass
class Paragraph:
    text: str  # raw paragraph text (line breaks intact)
    start: int  # character offset into the raw file
    end: int


@dataclass
class Essay:
    title: str  # display title, e.g. "An Essay in Aesthetics"
    paragraphs: list[Paragraph] = field(default_factory=list)


def _display_title(upper: str) -> str:
    words = upper.replace("Æ", "Ae").replace("’", "'").lower().split()
    out = []
    for i, w in enumerate(words):
        if i > 0 and w in _MINOR_WORDS:
            out.append(w)
        else:
            out.append("-".join(part[:1].upper() + part[1:] for part in w.split("-")))
    return " ".join(out)


def _contents_titles(body: str) -> list[str]:
    m = re.search(r"\n[ \t]*CONTENTS[ \t]*\n(.*?)\n[ \t]*LIST OF ILLUSTRATIONS[ \t]*\n", body, re.DOTALL)
    if not m:
        raise ValueError("could not locate CONTENTS section")
    titles = []
    for line in m.group(1).splitlines():
        lm = _CONTENTS_LINE.match(line.strip())
        if lm and lm.group(1).strip() != "PAGE":
            titles.append(lm.group(1).strip())
    if not titles:
        raise ValueError("CONTENTS section parsed to zero titles")
    return titles


def parse_essays(raw: str, min_essays: int = 10) -> list[Essay]:
    start_m = START_MARKER.search(raw)
    end_m = END_MARKER.search(raw)
    if not start_m or not end_m:
        raise ValueError("Project Gutenberg START/END markers not found")
    body_start = start_m.end()
    body = raw[body_start : end_m.start()]

    titles = _contents_titles(body)
    title_set = set(titles)

    essays: list[Essay] = []
    current: Essay | None = None
    in_illustration = False
    done = False
    pending_caps = ""  # headings sometimes wrap across paragraph breaks

    for m in _PARAGRAPH.finditer(body):
        if done:
            break
        para = m.group(0)
        stripped = para.strip()
        if in_illustration:
            if "]" in para:
                in_illustration = False
            continue
        if stripped.startswith("[Illustration"):
            if "]" not in stripped:
                in_illustration = True
            continue
        heading = _FOOTNOTE_REF.sub("", " ".join(stripped.split())).strip()
        if heading == "INDEX":
            done = True
            continue
        if pending_caps and f"{pending_caps} {heading}" in title_set:
            heading = f"{pending_caps} {heading}"
        if heading in title_set:
            current = Essay(title=_display_title(heading))
            essays.append(current)
            pending_caps = ""
            continue
        if not any(c.islower() for c in heading) and len(heading) < 100:
            # A stray all-caps fragment: a heading piece or subheading,
            # never prose. Remember it in case the next paragraph
            # completes a wrapped essay title.
            pending_caps = heading
            continue
        pending_caps = ""
        if current is None:
            continue  # front matter before the first essay
        text = _FOOTNOTE_REF.sub("", para)
        current.paragraphs.append(
            Paragraph(text=text, start=body_start + m.start(), end=body_start + m.end())
        )

    if len(essays) < min_essays:
        raise ValueError(f"only {len(essays)} essays parsed; stripping is broken")
    return essays
