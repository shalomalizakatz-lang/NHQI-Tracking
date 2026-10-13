# NHQI trust-layer correctness pass — deliverable

Branch: `nhqi-trust-layer-pass` (off `main`). **Not committed, pushed, or merged.** Everything
below describes the working-tree diff as of this writeup, for review before any of those
actions.

## 1. Diff summary, files changed, tests

```
 package.json                          |   4 +
 docs/trust-layer-pass-1.md            | new
 src/components/MeasureRow.jsx         | rewritten
 src/components/PriorityList.jsx       | rewritten
 src/lib/actionPlan.js                 | deleted
 src/lib/csvImport.js                  | validation added
 src/lib/csvImport.test.js             | new
 src/lib/nhqi/attainment.js            | new
 src/lib/nhqi/attainment.test.js       | new
 src/lib/nhqi/benchmarks.js            | new
 src/lib/nhqi/improvementMatrix.js     | new
 src/lib/nhqi/improvementMatrix.test.js| new
 src/lib/nhqi/measures/2025.js         | new
 src/lib/nhqi/normalization.js         | new
 src/lib/nhqi/normalization.test.js    | new
 src/lib/nhqi/observation.js           | new
 src/lib/nhqi/observation.test.js      | new
 src/lib/nhqi/scorer.js                | new
 src/lib/nhqi/scorer.test.js           | new
 src/lib/pdfExport.jsx                 | rewritten
 src/lib/scoring.js                    | trimmed (3 functions removed, rest kept as primitives)
 src/lib/storage.js                    | rewritten (schema v2, provenance)
 src/lib/storage/migrate.js            | new
 src/lib/storage/migrate.test.js       | new
 src/pages/FacilityTracker.jsx         | rewritten
 src/pages/Portfolio.jsx               | rewritten
 src/pages/Settings.jsx                | import preview + backup/restore added
```
12 files changed in the existing tree (1,060 insertions / 811 deletions), plus 14 new files.

**Tests:** `npm test` → **7 files, 141 tests, all passing.** `npm run build` succeeds.
Real-browser verification (Playwright + the pre-installed Chromium) against `npm run dev`:
zero console/page errors across every scenario exercised (listed in §3), including a live PDF
export opened and read back.

## 2. Data/rule model and source ledger

### What's grounded (verified against real data, not assumed)
- **2025 attainment table, improvement matrix, eligible-measure set, thresholds, PAH point
  map**: taken verbatim from the requester's brief, which relays the published 2025
  methodology. `.gov` is unreachable from this sandbox (confirmed: `ENOTFOUND` on both
  `health.ny.gov` and `cms.gov`), so these were **not independently re-fetched** — they're
  encoded as given, not re-derived, and every file that uses them says so in its header
  comment.
- **DOH's score-normalization formula** (`points earned ÷ max attainable × 100`): verified
  against real bundled 2023 facility data, not just the brief's worked example — Highland Care
  Center (29 raw points / 90 max → 32.2) and a small-sample-excluded facility (50/75 → 66.7)
  both reproduce their real published `totalScore` exactly. `src/lib/nhqi/normalization.js`.
- **Quintile boundary comparison convention** (strict `>` for higherIsBetter, inclusive `≤` for
  lowerIsBetter): verified earlier this session against 5,070 real DOH rows with 0 mismatches;
  reused unchanged by the new engine via `scoring.js`'s `getQuintile`, not re-implemented.
- **The off-by-one DOH cutpoint bug** (first published "quintile" column for higherIsBetter
  measures is a non-boundary reference value) was already fixed in a prior pass and is
  unaffected by this one.

### What's a real gap, recorded rather than papered over
- **This app has 2025's RULES but not DOH's 2025 CUTPOINT TABLES.** The numeric quintile
  boundaries for the 2025 cycle were never published to this app, and `.gov` is unreachable.
  `scoreFacility()` therefore takes an explicit `benchmark` argument (2023 official cutpoints,
  or the live CMS-derived benchmark) and labels it honestly in every output — **never** "2025
  official cutpoints," because that data doesn't exist here. See `src/lib/nhqi/scorer.js`'s
  module header.
- **Exact 2024 PBJ quarter boundaries, exact flu-season date ranges beyond what the brief gave,
  and PAH's 2025 measurement period** aren't sourced. `measures/2025.js` marks each one's
  `measurementPeriod.source` as either the brief's text or `"unresolved"` (PAH) — nothing is
  invented.
- **Statewide peer cohort and tie-break method for ranking**: not sourced at all. Overall
  quintile is **never modeled** for the current cycle anywhere in this app — `overallQuintile:
  {modeled: false, reason: "..."}` is returned unconditionally, with the real reason, instead
  of reusing the old fixed-20%-band shortcut.

## 3. Before/after evidence

Screenshots (390px and 1280px) and a sample PDF are available in the scratchpad at
`screens/` and `highland.pdf`. Scenarios captured, each verified for zero console/page errors:

1. Empty portfolio
2. Populated portfolio (after adding Highland Care Center)
3. Facility overview, incomplete (11/16 resolved, "Overall quintile: Not modeled" with real
   reason, PAH scenario selector)
4. Measures tab, missing compliance inputs visible with explicit "Not entered" states
5. Invalid field (150% entered for a percentage measure) — shows "Invalid value," no quintile
   badge, no points, contributes to "unresolved," never silently scored
6. Threshold measure missed (Contract/Agency Staff at 12%, threshold <10%) — "Threshold missed
   — 0 pts"
7. Mostly-complete scenario (16/16 resolved) — normalized score appears, since the engine only
   shows one when every measure is actually resolved
8. PAH sensitivity scenario selected (6 pts) — known/unresolved totals update accordingly
9. Improvement Plan — real point gains only, ranked, plus a separate missing-evidence list
10. A seeded pre-trust-layer legacy value (`localStorage` written directly, bypassing the new
    schema) — migrates transparently and reads as **"Legacy value, period unverified,"** not as
    current data. This is the one case I found by testing, not by reasoning about the code:
    my first wiring hard-coded every non-empty value as "manual," which would have silently
    hidden this exact case. Fixed in `scorer.js`/`FacilityTracker.jsx` before this screenshot.
11. Settings page (CMS refresh link, CSV import, backup/restore)
12. CSV import preview — the real 571-facility, 11,420-row DOH source file, parsed with **0
    validation warnings**, previewed before activation (not applied until "Activate" is
    clicked)

**Bugs found and fixed during this verification** (listed because the brief asked for honesty
about what shipped vs. what was caught late):
- A real PDF rendering bug: `≤` isn't in the PDF's WinAnsi-encoded font and rendered as a
  garbled "d" — e.g. "target d23" instead of "target ≤23". Fixed in `pdfSafe()`.
- A real PDF layout bug: the measures table + 5 opportunities overflowed onto a near-empty
  second page. Fixed by tightening table/row padding.
- A real copy bug: "Modeled against Modeled against 2023 NY DOH cutpoints" (double prefix) in
  three places, because `benchmark.label` already includes "Modeled against" and the
  surrounding sentence added it again.
- A real mobile layout bug: the "Points by section" row ran its label into its stats text at
  390px width (`flexWrap` was missing).
- The gap described in §5 below (hard-coded "manual" verification).

## 4. Historical backtest

The repo has exactly one official completed cycle bundled (2023 — `src/data/nhqi_2023.json`,
571 facilities). I do **not** have that cycle's own improvement-matrix/threshold rules (`.gov`
unreachable; the brief supplied only 2025's numbers), so reproducing 2023's official ranks with
the 2025 engine would be comparing two different rule sets and reporting a false pass. What was
actually checked:

- **Primitive-level regression**: `scorer.test.js`'s "real Highland Care Center facility"
  suite scores Highland's own 2023 actual values against the bundled 2023 cutpoints and asserts
  the resulting quintile matches DOH's own published per-measure quintile for all 10
  quintile-scored measures. **10/10 match.**
- **Normalization formula**: reproduces 2 real published `totalScore` values exactly (see §2).
- **2025 coefficients**: unit-tested as given data (all 25 improvement-matrix cells, all
  threshold boundaries, the PAH point map, the star map) — this confirms the engine implements
  the supplied numbers correctly, **not** that the supplied numbers themselves match DOH's
  live 2025 publication, which I couldn't independently verify.
- **Statewide rank/tie-break reproduction: untested.** No official tie-break method is sourced
  in this environment, and the app doesn't attempt to produce a ranked quintile at all for the
  current cycle (see §2), so there's nothing to backtest there by design.

No accuracy percentage is reported anywhere, because there's no held-out official 2025 outcome
to score against — the 2025 cycle isn't complete yet, and fabricating a confidence number
would be exactly the thing this pass exists to remove.

## 5. Deterministic / scenario / unmodeled

**Deterministic (same inputs always produce the same, correct output, covered by tests):**
- Threshold boundary exactness (falls/UTI ≤5.0%, agency <10%)
- All 25 improvement-matrix cells, gated correctly by each measure's 2025 eligibility
- Missing prior-year quintile → unresolved, never a fabricated improvement value
- Quintile boundary precision (strict/inclusive, both directions), including the "never show
  0.0 needed at an uncrossed strict boundary" fix
- Missing vs. true zero vs. officially-suppressed ("SS") vs. invalid input — four genuinely
  different states, never collapsed into each other
- The denominator never shrinks because a field is merely blank
- Legacy (pre-trust-layer) values read as stale, not current
- PAH's five supported sensitivity scenarios, plus "use official," plus the unresolved default
- J/K/L exclusion is surfaced (flag + reason) independent of the facility's score
- CSV import: year-consistency, duplicate-row, unmapped-measure-ID, and invalid-numeric-value
  detection, all surfaced before activation

**Explicitly a scenario, never presented as official:**
- Every "known/unresolved points" figure for the current cycle (benchmark-labeled, cycle-
  labeled)
- The normalized score shown only when all measures are resolved
- PAH's non-"official" scenario buttons
- The Live CMS benchmark toggle

**Unmodeled, with the reason visible in-product, not just in this doc:**
- Overall quintile for the current cycle (`overallQuintile.modeled: false`) — no sourced peer
  cohort or tie-break method
- DOH's actual 2025 cutpoint tables (only 2023 official and live-CMS benchmarks exist here)
- Several exact measurement periods (PAH's, in particular) — marked `"unresolved"`, not guessed

## 6. Follow-up work (explicitly not attempted this pass)

- Dollar/payment-pool modeling (correct Medicaid rate/days, statewide weights, eligibility) —
  needs its own sourced methodology and is out of scope per the original brief
- Claims-data (SPARCS) integration for real-time PAH
- A full CSV ingestion service beyond the hardened manual-upload path
- Statewide-calibrated forecasts / confidence scores
- Durable shared team storage (this is still single-device `localStorage`, now with
  export/import backup as a stopgap)
- Audit/security controls
- The full visual/interaction redesign (navigation, the measures "card wall," onboarding,
  naming) — explicitly sequenced as later passes per the requester's own plan, not started here
