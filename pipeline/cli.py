"""Pipeline entry points.

  python -m pipeline.cli corpus         # full run: fetch -> extract -> /data
  python -m pipeline.cli retwist        # re-derive presentation over /data
  python -m pipeline.cli dump-windows   # list windows awaiting extraction
  python -m pipeline.cli curate FILE    # import offline editorial review
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from . import emit, extract, filters, twists, uniqueness, verify
from .gutenberg import fetch_source
from .normalize import normalize
from .textprep import parse_essays

log = logging.getLogger("pipeline")

REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / "data"


def _build_levels(min_len: int, max_len: int) -> list[dict]:
    raw = fetch_source()
    essays = parse_essays(raw)
    normalized_source = normalize(raw)
    wordlist = filters.load_wordlist()
    index = uniqueness.build_index(wordlist)

    extracted = extract.extract_all(essays, min_len=min_len, max_len=max_len)
    stats = {"extracted": 0, "verbatim_fail": 0, "filtered": 0, "ambiguous": 0, "kept": 0}
    accepted: list[tuple[str, str]] = []  # (normalized sentence, essay title)
    seen: set[str] = set()
    for essay_title, sentences in extracted.items():
        for s in sentences:
            stats["extracted"] += 1
            v = verify.verify_verbatim(s.sentence, normalized_source)
            if not v.ok:
                stats["verbatim_fail"] += 1
                continue
            f = filters.check(v.normalized, wordlist, min_len, max_len)
            if not f.ok:
                stats["filtered"] += 1
                log.info("filtered: %s (%s)", v.normalized, f.reason)
                continue
            if uniqueness.count_solutions(v.normalized, index, cap=2) != 1:
                stats["ambiguous"] += 1
                log.info("ambiguous cipher, rejected: %s", v.normalized)
                continue
            if v.normalized in seen:
                continue
            seen.add(v.normalized)
            stats["kept"] += 1
            accepted.append((v.normalized, essay_title))

    log.warning(
        "extraction stats: %s (rejection rate %.0f%%)",
        stats,
        100 * (1 - stats["kept"] / stats["extracted"]) if stats["extracted"] else 0,
    )

    # Shorter sentences make earlier (easier) levels.
    accepted.sort(key=lambda pair: (len(pair[0]), pair[0]))
    levels = []
    for pos, (sentence, essay_title) in enumerate(accepted):
        level_id = pos + 1
        tier = twists.assign_tier(pos)
        solution = sentence.upper()
        tw = twists.derive_twists(level_id, solution, twists.progress_frac(pos))
        levels.append(emit.level_json(level_id, tier, solution, tw, essay_title))
    return levels


def cmd_corpus(args) -> int:
    levels = _build_levels(args.min_len, args.max_len)
    if not levels:
        log.error("no levels produced; nothing emitted")
        return 1
    manifest = emit.emit(levels, DATA_DIR)
    print(
        f"emitted {manifest['totalLevels']} levels in "
        f"{len(manifest['batches'])} batches, dataVersion {manifest['dataVersion']}"
    )
    return 0


def cmd_retwist(args) -> int:
    """Re-derive every level's presentation (tier, reveals, locks) from the
    already-emitted corpus, leaving the sentences untouched. Offline: needs
    neither the source text nor the extraction cache."""
    manifest = json.loads((DATA_DIR / "manifest.json").read_text(encoding="utf-8"))
    old_levels: list[dict] = []
    for batch in manifest["batches"]:
        body = json.loads((DATA_DIR / batch["file"]).read_text(encoding="utf-8"))
        old_levels.extend(body["levels"])
    levels = []
    for pos, old in enumerate(old_levels):
        level_id = old["id"]
        tier = twists.assign_tier(pos)
        tw = twists.derive_twists(level_id, old["solution"], twists.progress_frac(pos))
        levels.append(
            emit.level_json(level_id, tier, old["solution"], tw, old["attribution"]["essay"])
        )
    new_manifest = emit.emit(levels, DATA_DIR)
    print(
        f"retwisted {new_manifest['totalLevels']} levels, "
        f"dataVersion {new_manifest['dataVersion']}"
    )
    return 0


def cmd_dump_windows(args) -> int:
    raw = fetch_source()
    essays = parse_essays(raw)
    wordlist = filters.load_wordlist()
    windows = extract.build_windows(essays)
    pending = extract.pending_windows(windows, wordlist, args.min_len, args.max_len)
    out = [
        {"hash": w.digest, "essay": w.essay_title, "text": w.text} for w in pending
    ]
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
    print(file=sys.stderr)
    print(
        f"{len(pending)} windows pending extraction ({len(windows)} total)",
        file=sys.stderr,
    )
    return 0


def cmd_curate(args) -> int:
    """Import an offline editorial review: {hash: [{sentence, reason_kept}]}.

    Writes the same cache entries the API extractor would, so a later
    `corpus` run proceeds without network access."""
    reviewed = json.loads(Path(args.file).read_text(encoding="utf-8"))
    raw = fetch_source()
    essays = parse_essays(raw)
    windows = {w.digest: w for w in extract.build_windows(essays)}
    written = 0
    for digest, sentences in reviewed.items():
        if digest not in windows:
            log.warning("unknown window hash %s; skipped", digest)
            continue
        extract.write_cache(
            windows[digest],
            extract.ExtractionResponse(
                sentences=[extract.ExtractedSentence(**s) for s in sentences]
            ),
        )
        written += 1
    print(f"wrote {written} extraction cache entries")
    return 0


def main() -> int:
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(prog="pipeline")
    sub = parser.add_subparsers(dest="command", required=True)

    p_corpus = sub.add_parser("corpus")
    p_corpus.add_argument("--min-len", type=int, default=filters.MIN_LEN)
    p_corpus.add_argument("--max-len", type=int, default=filters.MAX_LEN)
    p_corpus.set_defaults(func=cmd_corpus)

    p_retwist = sub.add_parser("retwist")
    p_retwist.set_defaults(func=cmd_retwist)

    p_dump = sub.add_parser("dump-windows")
    p_dump.add_argument("--min-len", type=int, default=filters.MIN_LEN)
    p_dump.add_argument("--max-len", type=int, default=filters.MAX_LEN)
    p_dump.set_defaults(func=cmd_dump_windows)

    p_curate = sub.add_parser("curate")
    p_curate.add_argument("file")
    p_curate.set_defaults(func=cmd_curate)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
