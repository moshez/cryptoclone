"""Fetch and cache the Project Gutenberg source text."""

from __future__ import annotations

import os
import ssl
import urllib.request
from pathlib import Path

EBOOK_ID = 54154
URL = f"https://www.gutenberg.org/cache/epub/{EBOOK_ID}/pg{EBOOK_ID}.txt"
CACHE_DIR = Path(__file__).parent / "cache"
CACHE_FILE = CACHE_DIR / f"pg{EBOOK_ID}.txt"


def fetch_source() -> str:
    """Return the raw ebook text, downloading it once into pipeline/cache/."""
    if CACHE_FILE.exists():
        return CACHE_FILE.read_text(encoding="utf-8")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cafile = os.environ.get("SSL_CERT_FILE") or None
    context = ssl.create_default_context(cafile=cafile)
    with urllib.request.urlopen(URL, context=context, timeout=60) as resp:
        raw = resp.read().decode("utf-8")
    CACHE_FILE.write_text(raw, encoding="utf-8")
    return raw
