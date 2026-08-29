"""Verbatim verification: every extracted sentence must literally occur in
the source text (after shared normalization). Non-matching sentences are
dropped, never repaired."""

from __future__ import annotations

import difflib
import logging
from dataclasses import dataclass

from .normalize import normalize

log = logging.getLogger(__name__)


@dataclass
class VerifyResult:
    ok: bool
    normalized: str = ""
    diff: str = ""


def verify_verbatim(candidate: str, normalized_source: str) -> VerifyResult:
    norm = normalize(candidate)
    if norm and norm in normalized_source:
        return VerifyResult(True, normalized=norm)
    # Show what the model changed: diff against the closest source window.
    diff = _closest_diff(norm, normalized_source)
    log.warning("verbatim check failed; model output diverges from source:\n%s", diff)
    return VerifyResult(False, normalized=norm, diff=diff)


def _closest_diff(norm: str, source: str) -> str:
    if not norm:
        return "(empty after normalization)"
    matcher = difflib.SequenceMatcher(a=source, b=norm, autojunk=False)
    match = matcher.find_longest_match(0, len(source), 0, len(norm))
    lo = max(0, match.a - match.b)
    window = source[lo : lo + len(norm) + 40]
    return "\n".join(
        difflib.unified_diff(
            [window], [norm], fromfile="source", tofile="model", lineterm=""
        )
    )
