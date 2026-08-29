# Vision review findings

Log of findings from the model-vision review loop (`npm run vision-review`
in `/tools`). The vision pass is a defect *discovery* tool — it is
nondeterministic and never gates CI. Every finding recorded here must be
converted into a deterministic assertion in `/e2e`; a finding without a
corresponding assertion is not done.

| ID | Date | Screenshot(s) | Severity | Finding | Deterministic assertion |
| --- | --- | --- | --- | --- | --- |
| VF-1 | 2026-08-29 | desktop-level1-midsolve, desktop-level60-tier5 | medium | Keyboard pinned to the bottom of a stretched column leaves a ~450px dead zone between the grid and the keys on 1280×800; content reads as two disconnected islands. Fixed by letting content stack on ≥900×700 screens and pinning only the footer. | `layout.spec.ts` › "no dead zone between grid and keyboard on desktop": grid-bottom → keyboard-top gap ≤ 240px on desktop viewports. |
| VF-2 | 2026-08-29 | small-level1-fresh, desktop-level1-midsolve | medium | Cipher numbers (~10px) and meta text rendered in `#8a8172` on white/ivory ≈ 3.4:1 contrast, below the 4.5:1 minimum for small text. Fixed by darkening `--muted` to `#665e50`. | `layout.spec.ts` › "small text has at least 4.5:1 contrast": computed fg/bg contrast of `.cell-num` (plain and selected), `.tier`, `.about` ≥ 4.5. |

Reviewed with no finding: word wrapping (words move as units), locked-cell
striping legibility, attribution card fit at all three viewports, keyboard
tap-target size, error-pip visibility. These are covered by pre-existing
assertions in `layout.spec.ts`.
