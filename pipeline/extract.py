"""LLM extraction pass: send paragraph windows to the Claude API and collect
the sentences worth turning into puzzles.

Responses are cached under pipeline/cache/extraction/ keyed by a hash of the
window text, so re-runs (and reviewed regenerations) only pay for new
windows. The cache entry format is the same whether it was written by the
API call or by `python -m pipeline.cli curate` (offline editorial review).
"""

from __future__ import annotations

import asyncio
import hashlib
import itertools
import json
from dataclasses import dataclass
from pathlib import Path

from pydantic import BaseModel

from .filters import MAX_LEN, MIN_LEN, check, load_wordlist
from .normalize import normalize
from .segment import split_sentences
from .textprep import Essay

CACHE_DIR = Path(__file__).parent / "cache" / "extraction"
DEFAULT_MODEL = "claude-opus-5"
MAX_WINDOW_CHARS = 2000
MIN_WINDOW_CHARS = 200
CONCURRENCY = 4

SYSTEM_PROMPT = """\
You select sentences from Roger Fry's *Vision and Design* (1920) for use as
cryptogram puzzles. The player sees only the single sentence, with no
surrounding context and no artwork.

From the paragraph you are given, return ONLY sentences (or a run of two
adjacent sentences that together stay short) that satisfy ALL of:

- Standalone: makes full sense with nothing before or after it. Reject
  anything with unbound pronouns, "such", "the former", opening connectives
  like "Thus", "Hence", "But", or references to an argument already under
  way.
- Not ekphrastic: reject sentences whose meaning depends on a particular
  artwork, artist, plate, or a spatial reference within a picture. Keep
  general claims about art, perception, form, and aesthetic response.
- Actually says something: an observation or claim a modern reader would
  find interesting; not a transitional remark or art-historical bookkeeping.
- Shippable: this is a 1920 text. Reject anything whose framing would be
  objectionable today, including sentences that read neutrally in isolation
  but carry the period's assumptions about race, "primitive" peoples, or
  cultural hierarchy.
- Verbatim: return the sentence EXACTLY as it appears in the paragraph. Do
  not modernize, trim, tidy punctuation, or drop clauses.

Most paragraphs contain zero usable sentences. Return an empty list rather
than stretching the criteria."""


class ExtractedSentence(BaseModel):
    sentence: str
    reason_kept: str


class ExtractionResponse(BaseModel):
    sentences: list[ExtractedSentence]


@dataclass
class Window:
    essay_title: str
    text: str

    @property
    def digest(self) -> str:
        return hashlib.sha256(self.text.encode()).hexdigest()[:16]


def build_windows(essays: list[Essay]) -> list[Window]:
    """Paragraph-sized windows; short paragraphs are merged with the next."""
    windows = []
    for essay in essays:
        buf: list[str] = []
        for para in essay.paragraphs:
            buf.append(para.text)
            merged = "\n\n".join(buf)
            if len(merged) >= MIN_WINDOW_CHARS:
                windows.append(Window(essay.title, merged))
                buf = []
        if buf:
            windows.append(Window(essay.title, "\n\n".join(buf)))
    # Windows above the cap get split back into their paragraphs.
    out = []
    for w in windows:
        if len(w.text) <= MAX_WINDOW_CHARS:
            out.append(w)
        else:
            out.extend(Window(w.essay_title, p) for p in w.text.split("\n\n"))
    return out


def window_has_candidate(
    window: Window,
    wordlist: frozenset[str],
    min_len: int = MIN_LEN,
    max_len: int = MAX_LEN,
) -> bool:
    """Cheap deterministic pre-gate: only windows containing at least one
    mechanically-plausible sentence (alone or as an adjacent pair) are worth
    an API call. Windows skipped here could only ever produce sentences the
    mechanical filters would reject."""
    for para in window.text.split("\n\n"):
        sentences = split_sentences(para)
        texts = [normalize(s.text) for s in sentences]
        combos = itertools.chain(
            texts, (f"{a} {b}" for a, b in zip(texts, texts[1:]))
        )
        for cand in combos:
            if check(cand, wordlist, min_len, max_len).ok:
                return True
    return False


def cache_path(window: Window) -> Path:
    return CACHE_DIR / f"{window.digest}.json"


def read_cache(window: Window) -> ExtractionResponse | None:
    p = cache_path(window)
    if not p.exists():
        return None
    return ExtractionResponse.model_validate_json(p.read_text(encoding="utf-8"))


def write_cache(window: Window, response: ExtractionResponse) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path(window).write_text(
        json.dumps(response.model_dump(), ensure_ascii=False, indent=1),
        encoding="utf-8",
    )


def pending_windows(
    windows: list[Window],
    wordlist: frozenset[str],
    min_len: int = MIN_LEN,
    max_len: int = MAX_LEN,
) -> list[Window]:
    return [
        w
        for w in windows
        if read_cache(w) is None and window_has_candidate(w, wordlist, min_len, max_len)
    ]


async def _extract_one(client, sem: asyncio.Semaphore, window: Window, model: str) -> None:
    async with sem:
        response = await client.messages.parse(
            model=model,
            max_tokens=16000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": window.text}],
            output_format=ExtractionResponse,
        )
    if response.stop_reason == "refusal":
        # A refused window is treated as "nothing usable here" — the same
        # judgment the shippability criterion would reach.
        write_cache(window, ExtractionResponse(sentences=[]))
        return
    write_cache(window, response.parsed_output)


async def _extract_pending(windows: list[Window], model: str) -> None:
    import anthropic

    client = anthropic.AsyncAnthropic()
    sem = asyncio.Semaphore(CONCURRENCY)
    await asyncio.gather(*(_extract_one(client, sem, w, model) for w in windows))


def extract_all(
    essays: list[Essay],
    model: str = DEFAULT_MODEL,
    min_len: int = MIN_LEN,
    max_len: int = MAX_LEN,
) -> dict[str, list[ExtractedSentence]]:
    """Return {essay_title: extracted sentences}, calling the API for any
    windows not already cached."""
    wordlist = load_wordlist()
    windows = build_windows(essays)
    pending = pending_windows(windows, wordlist, min_len, max_len)
    if pending:
        asyncio.run(_extract_pending(pending, model))
    results: dict[str, list[ExtractedSentence]] = {}
    for w in windows:
        cached = read_cache(w)
        if cached is None:
            continue
        results.setdefault(w.essay_title, []).extend(cached.sentences)
    return results
