"""Emit /data: manifest.json plus content-hashed batch files of 50 levels."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

BATCH_SIZE = 50


def level_json(
    level_id: int,
    tier: int,
    solution: str,
    twists,
    essay_title: str,
) -> dict:
    level = {
        "id": level_id,
        "tier": tier,
        "cipher": twists.cipher,
        "solution": solution,
        "revealed": [[num, letter] for num, letter in twists.revealed],
        "lockedIndices": twists.locked_indices,
        "attribution": {
            "author": "Roger Fry",
            "work": "Vision and Design",
            "year": 1920,
            "essay": essay_title,
        },
    }
    if twists.half_locked:
        level["halfLocked"] = {str(k): v for k, v in sorted(twists.half_locked.items())}
    return level


def emit(levels: list[dict], out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    for stale in out_dir.glob("batch-*.json"):
        stale.unlink()
    batches = []
    batch_hashes = []
    for index in range(0, len(levels), BATCH_SIZE):
        batch_levels = levels[index : index + BATCH_SIZE]
        body = json.dumps(
            {"levels": batch_levels}, ensure_ascii=False, separators=(",", ":")
        ).encode("utf-8")
        sha = hashlib.sha256(body).hexdigest()
        batch_index = index // BATCH_SIZE
        name = f"batch-{batch_index:03d}.{sha[:6]}.json"
        (out_dir / name).write_bytes(body)
        batch_hashes.append(sha)
        batches.append(
            {
                "index": batch_index,
                "file": name,
                "sha256": sha,
                "levelIds": [batch_levels[0]["id"], batch_levels[-1]["id"]],
            }
        )
    data_version = hashlib.sha256("".join(batch_hashes).encode()).hexdigest()[:12]
    manifest = {
        "dataVersion": data_version,
        "totalLevels": len(levels),
        "batchSize": BATCH_SIZE,
        "batches": batches,
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    return manifest
