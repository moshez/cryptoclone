# Vision & Cipher

A substitution-cipher (cryptogram) puzzle game built from Roger Fry's
*Vision and Design* (1920, Project Gutenberg ebook 54154). Installable,
offline-capable PWA deployed to
[GitHub Pages](https://moshez.github.io/cryptoclone/).

**Play it: <https://moshez.github.io/cryptoclone/>**

## Layout

| Path | What |
| --- | --- |
| `/pipeline` | Python corpus pipeline: fetch, strip, segment, LLM extraction, verbatim verification, mechanical filters, uniqueness solver, twist derivation, batch emission |
| `/app` | The game: Vite + React + TypeScript PWA |
| `/data` | Generated puzzle data, committed; the app build copies it in |
| `/e2e` | Playwright specs and the committed fixture corpus |
| `/tools` | Dev-only vision review loop |
| `/.github/workflows` | CI, Pages deploy, corpus regeneration |

## The corpus

`make corpus` runs the pipeline (needs `ANTHROPIC_API_KEY` for uncached
windows). Every emitted level has passed, in order:

1. **Verbatim verification** — the sentence is a literal substring of the
   normalized source; non-matches are dropped, never repaired.
2. **Mechanical filters** — length window, character whitelist, ≥12
   distinct letters, every word present in the committed SCOWL-60 wordlist.
3. **Uniqueness** — a backtracking constraint search proves the ciphertext
   admits exactly one all-dictionary solution.

The length window runs at 60–200 characters (`--max-len 200` in the
Makefile): Fry's standalone aphorisms mostly run long, and the uniqueness
check rejects heavily below ~100 characters.

The LLM extraction pass caches responses under `pipeline/cache/extraction/`
keyed by window-text hash. `python -m pipeline.cli dump-windows` lists
windows awaiting extraction; `python -m pipeline.cli curate reviewed.json`
imports an offline editorial review in the same cache format, which is how
the initial committed corpus was selected. The
`Regenerate corpus` workflow (manual dispatch) reruns the pipeline with the
API key from secrets and opens a PR so regeneration is reviewable.

Difficulty is presentation, not sentence choice: each level's tier (1–5)
sets how many cipher→plaintext mappings start revealed and how many cells
are locked (number hidden until an adjacent cell in the same word is
correctly filled; some tier-5 cells are half-locked and only open from one
side). Twists derive deterministically from `(levelId, tier)`, and a
simulation proves every locked cell reachable before emission.

## Development

```sh
pip install -r pipeline/requirements.txt
make pipeline-test          # pytest

cd app
npm ci
npm run dev                 # local dev server (no service worker)
npm test                    # vitest: game logic + data invariants
npm run build               # dist/ with sw.js, 404.html, .nojekyll, data/

cd ../e2e
npm ci
npx playwright install --with-deps chromium webkit
npm test                    # builds fixture app twice, serves, runs specs
```

The e2e suite runs against the committed fixture corpus
(`e2e/fixtures/data`, regenerate with `python3 e2e/fixtures/generate.py`),
never the real `/data`, so corpus regeneration doesn't invalidate tests.

### Vision review loop

`npm run vision-review` in `/tools` captures deterministic screenshots at
three viewports and sends them to Claude with a layout-defect rubric. It is
a dev-time discovery tool and never gates CI; every real finding gets a
deterministic assertion in `/e2e` and a row in `e2e/vision-findings.md`.

## Service worker contract

A reload always gives the current deployed version; the game still works
with no network. Hashed assets are precached cache-first; navigations and
`manifest.json` are network-first with cache fallback; content-hashed
batches are cache-first immutable. The build stamps `BUILD_ID` (the commit
SHA in deploys) into `sw.js` so every deploy changes the worker byte-wise,
and the staleness e2e test enforces the reload behaviour.
