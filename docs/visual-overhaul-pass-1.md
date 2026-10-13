# NHQI visual/interaction overhaul — deliverable

Branch: `nhqi-visual-overhaul-pass` (off `main`, which already has the trust-layer pass).
**Not committed, pushed, or merged.** Everything below describes the working-tree diff as
of this writeup, for review before any of those actions.

## 1. Files changed, diff summary, tests

```
 package.json                        |   5 +
 src/App.jsx                         |  51 +--  (routing + AppShell)
 src/index.css                       |  11 +    (Tailwind v4 @theme tokens)
 vite.config.js                      |   4 +    (vitest jsdom environment)
 src/lib/designTokens.js             | new      (single source of truth for literal colors)
 src/lib/colors.js                   |  28 +-   (reads designTokens.js; quintile scale darkened)
 src/lib/colors.test.js              | new
 src/lib/theme.js                    | deleted  (dead code, zero imports, confirmed)
 src/lib/opportunities.js            | new      (shared opportunity-selection, was duplicated 2x)
 src/lib/opportunities.test.js       | new
 src/lib/usePortfolioRows.js         | new
 src/lib/storage.js                  |  28 +-   (+removeFacility/restoreFacility undo pair)
 src/lib/storage.test.js             | new
 src/lib/pdfExport.jsx               |  92 +-   (teal branding, opportunities.js, wrap={false})
 src/components/ui/*                 | new      (13 shared primitives, 3 with their own tests)
 src/components/MeasureRow.jsx       | deleted  (246 lines; replaced by the 3 files below)
 src/components/MeasuresPanel.jsx    | new
 src/components/MeasureListRow.jsx   | new
 src/components/MeasureDetail.jsx    | new
 src/components/measureStateLabels.js| new
 src/components/PriorityList.jsx     | 123 +-   (opportunities.js, primitives)
 src/components/FacilitySearch.jsx   |  17 +-   (no own card chrome; lives inside a Dialog)
 src/components/QuintileBadge.jsx    |   2 +-   (contrast fix)
 src/pages/FacilityTracker.jsx       | 351 +-   (chrome + Overview + routing + Measures wiring)
 src/pages/Portfolio.jsx             | 480 +-   (table/mobile split, dialogs, filters, undo)
 src/pages/Settings.jsx              | 146 +-   (copy/visual re-tone, a11y label fix)
 scripts/check-contrast.mjs          | new
 src/test/{setup.js,fixtures.js}     | new
```
16 files changed in the existing tree (1,644 insertions / 784 deletions), plus ~20 new files.

**Tests:** `npm test` → **14 files, 176 tests, all passing** (141 existing scoring tests
untouched and still passing + 35 new: 3 colors.js regression tests locking in the darkened
palette, 4 Dialog focus/keyboard tests including 2 Tab-wrap regression tests, 3 Badge tests,
3 Field tests, 3 Table tests, 4 storage.js remove/restore tests, 4 opportunities.js tests,
rest incidental). `npm run lint` → 0 errors (6 pre-existing warnings, unrelated to this pass,
unchanged from before it started). `npm run build` → succeeds. `node scripts/check-contrast.mjs`
→ all 16 checked color pairs pass WCAG 2.2 AA. Real-browser verification (Playwright + the
pre-installed Chromium) against `npm run dev`: **zero console/page errors** across every
scenario exercised (listed in §3), and an `@axe-core/playwright` sweep of all 6 major screens
→ **zero violations** (after fixing 3 real findings it surfaced — see §3).

## 2. Component/token map and rationale

**Tokens** (`src/lib/designTokens.js` + `src/index.css`'s `@theme` block): nearly every
repeated raw hex literal in the old inline-style files turned out to be an exact stock
Tailwind color, so the "token layer" is mostly *stop hand-writing hex, use the Tailwind
classes that already exist* rather than a new parallel palette. The one genuinely bespoke
value (`#f0efed`, a subtle divider) is in the `@theme` block as `--color-border-subtle`.
`designTokens.js` is the one place react-pdf's `StyleSheet` (a different render target that
can't read CSS custom properties) and the CSS tokens both draw their literal values from —
documented, not code-generated, flagged as a minor known seam.

**Shared primitives** (`src/components/ui/`): `AppShell`, `PageHeader`, `Tabs`, `Toolbar`/
`SearchInput`/`FilterChip`, `Field`, `Badge`, `Number`, `SourceDetail`, `EmptyState`, `Table`/
`Th`/`TableRow`, `Card`, `Dialog`, `SectionHeading`. Each replaces a pattern that was
previously hand-copied per file (e.g. the `background:#fff;border:1px solid #e2e8f0` card
chrome appeared ~15 times verbatim before this pass). `Dialog` is built on the native
`<dialog>` element (real `showModal()`-driven backdrop and `cancel` event) with a jsdom
compatibility fallback for unit tests, **plus a manual Tab/Shift+Tab wrap** — real Chromium
testing showed `showModal()` alone does not reliably trap Tab-key cycling (see §3).

**App shell**: kept a compact top bar rather than building a sidebar rail — with only two
top-level destinations (Portfolio, Data & settings), a rail would be the "enormous empty
sidebar" the brief explicitly warns against. `FacilityTracker`'s old *second*, differently-
styled header (duplicating Shell's visual language) is gone; the facility page now uses the
same `PageHeader`-shaped pattern as every other page.

**Routing**: `/facility/:facilityId/:tab` is now real, with `/facility/:facilityId` redirecting
to `.../overview` (old links keep working) and garbage tab segments redirecting the same way
rather than crashing. Verified in a real browser: reload preserves the tab, browser back/forward
moves between tabs, `aria-current="page"` reflects the active one.

**Measures collapse**: `MeasureRow.jsx` (246 lines, always-expanded cards, no interaction state)
is deleted, replaced by `MeasuresPanel.jsx` (toolbar, section grouping, one lifted
`expandedMeasureId`) + `MeasureListRow.jsx` (compact row, local-draft inline editing committed
on Enter/blur, discarded on Escape) + `MeasureDetail.jsx` (one function per scoring rule —
`QuintileDetail`, `ThresholdDetail`, `StarMapDetail`, `BinaryDetail`, `PahDetail` — opened in a
`Dialog` with `placement="right"`, which is a true full-width sheet on narrow viewports and a
448px-capped drawer on wide ones from the same component). The Measures tab-content wrapper
gets `key={facilityId}`, so switching facilities resets any in-progress draft/expanded state
instead of leaking across facilities. **Measured, not assumed**: desktop page height for
Highland's 16 measures went from the reviewed ~4,755px to **1,814px**; mobile (390px) went
from ~5,823px to **3,026px** — both confirmed via a real Chromium `document.body.scrollHeight`
read, not estimated.

**Opportunity selection** (`src/lib/opportunities.js`): the identical filter/sort expression
for "positive point opportunities" previously existed separately in `PriorityList.jsx` and
`pdfExport.jsx`; Portfolio's new "next opportunity" column needed a third copy. Extracted once,
deliberately living outside `src/lib/nhqi/` so that directory stays visibly untouched by this
pass. `getMissingEvidence()` is shared the same way.

**Facility removal / undo**: `storage.js`'s `removeFacility` now returns what it removed, and
a new `restoreFacility` puts it back — backing a real confirmation dialog (disclosing what will
be deleted) plus a transient, **in-memory-only** "Undo" toast (~8s, lost on refresh). This was
an explicit decision point (not a persisted undo, since no snapshot/tombstone concept exists in
storage) — resolved with you before implementation.

## 3. Real bugs found and fixed during verification

Caught by testing (automated + real-browser), not just code review:

- **`toneForObservationState("valid")` returned `"neutral"` instead of no badge.**
  `OBSERVATION_STATE_COLOR.valid` is deliberately `null`, but the original implementation used
  `OBSERVATION_STATE_COLOR[state] ?? "neutral"` — `??` treats an explicit `null` as "missing"
  and silently fell back to `"neutral"`, rendering an **empty gray pill on every resolved
  measure row** (points were computed correctly; they just never displayed). Caught visually in
  a desktop screenshot, confirmed via DOM inspection, fixed by checking `state in
  OBSERVATION_STATE_COLOR` instead of `??`. Regression test added (`Badge.test.jsx`).
- **Dialog focus containment was incomplete.** Playwright testing against real Chromium showed
  Tab from the last focusable element inside a `showModal()` dialog escaped to `<body>` instead
  of wrapping back to the first — native `<dialog>` does not fully guarantee this on its own.
  Fixed with an explicit Tab/Shift+Tab wrap handler; 2 regression tests added confirming the
  wrap in both directions.
- **3 real axe-core findings, all fixed, not suppressed:**
  - `text-slate-400` (Tailwind v4's `#90a1b9`) measured 2.51:1 against the app's `#fafaf9`
    page background on several real disclaimer/footer lines — below the 4.5:1 minimum for
    normal text. Swapped to `text-slate-500` app-wide (9 files) and re-verified.
  - The full quintile color scale (`quintileScale` in `designTokens.js`) used the "stock"
    Tailwind -600 swatches for lime/amber/orange, which measured 3.08–3.56:1 as plain inline
    text color (e.g. PriorityList's "Q2 → Q1" label) — below 4.5:1. Darkened to the -700/-800
    tier (lime-700, amber-800, orange-700; green/red were already fixed in the trust-layer
    pass). `scripts/check-contrast.mjs` now checks all 5 quintile shades as a permanent
    regression guard, not just the base token pairs.
  - Portfolio's trailing "Remove" table column had an empty header (`empty-table-header`) and
    Settings' CSV-upload `<input type="file">` had no accessible name (`label`, critical
    impact) — both fixed (`sr-only` header text; `aria-label`).
- **PDF branding mismatch**: the export used blue (`#1d4ed8`) for its header bar and section
  titles — a leftover from an earlier pass, inconsistent with the app's teal accent. Fixed to
  read from `designTokens.js` like everything else; re-verified the generated PDF visually.

## 4. Before/after evidence

Real-browser screenshots (320/390/640/768/1280px as applicable) and a generated PDF are in the
scratchpad. Scenarios captured, each verified for zero console/page errors and (where noted)
zero axe-core violations:

1. Empty portfolio (320px, 1280px)
2. Populated portfolio — 3 facilities including a 66-character name, wraps cleanly; desktop
   table + mobile (390px) stacked-card parity, same underlying data via `usePortfolioRows`
3. Portfolio "no results" state (search with Clear filters action) and filter chips with live
   counts (All/Needs data/Invalid-stale/Opportunities)
4. Facility Overview: incomplete (1280px, 390px) and **fully resolved** (16/16, 90/90 known
   points, normalized score 100 shown, dual section bars fully overlapping)
5. Measures: compact list (1280px, 768px — confirmed no horizontal scroll), search, an invalid
   value (150% on a percentage field → red "Invalid value" badge, denominator never shrinks),
   no-results filter state
6. Expanded detail drawers for all 5 scoring-rule types: quintile (cutpoints + gap-to-next),
   threshold (pass/fail rule text), star_map (NY-adjusted star picker + point table), binary
   (on-time/late filing picker), PAH (historical value + explicit scenario picker, never an
   editable "official" rate)
7. Improvement Plan: real ranked opportunities with missing-evidence tasks listed separately,
   and a **true zero-opportunity, zero-missing-evidence state** (verified against the actual
   empty-state branch, not just read in source)
8. A hypothetical PAH scenario visibly distinct from observed data (labeled "Scenario: N pts",
   never shown as the official current value)
9. Settings/Data page with the CSV import preview flow and backup/restore, re-toned copy
10. 640px reflow check (200%-zoom-equivalent CSS viewport) on the densest page (Measures) —
    confirmed `scrollWidth` does not exceed `clientWidth`, no horizontal scroll
11. Real generated PDF (`pdf()` from `@react-pdf/renderer`, not a mock) — 1 page, teal branding
    matching the app, correct `≤`/`≥` character substitution, Missing Evidence section added
    for parity with the UI's PriorityList

## 5. Tests / contrast / keyboard / reflow results

- `npm test`: 176/176 passing (see §1 for breakdown)
- `node scripts/check-contrast.mjs`: 16/16 pairs pass, including all 5 quintile text shades
- `@axe-core/playwright` sweep of Portfolio (empty + populated), Facility Overview, Measures
  list, Improvement Plan, Settings: **0 violations** (after the 3 fixes in §3)
- Keyboard-only walkthrough of the Add-facility dialog: focus lands on the close button on
  open; Tab cycles only among the dialog's own focusable elements across 8 presses; Escape
  closes it. Verified programmatically against real Chromium, not assumed from the native
  `<dialog>` spec.
- 640px reflow: no horizontal scroll on the Measures list, the densest real page

## 6. Remaining limitations (reported, not faked)

- **"Change on same basis" Portfolio column**: not built. `scoreFacility` is stateless over
  current inputs; `storage.js` has no history/snapshot primitive, and the only other number
  available (the official prior-cycle total) is a different basis the brief itself bars
  implying a delta against. Would need a small future `storage.js` addition (e.g. a
  `{date, knownEarnedPoints, benchmarkId}` snapshot appended on each view/export).
- **Facility-removal undo is transient only**, not persisted — by explicit decision (see §2),
  since no snapshot/tombstone concept exists in storage. Lost on page refresh.
- **No true multi-page "repeating table header"** in the PDF export — `react-pdf` has no
  native per-page header-row repeat for a `<View>`-based table. The outer header block (title/
  score cards/benchmark line) is marked `fixed` so it would repeat if content ever overflowed
  one page, and every row/card gets `wrap={false}` so nothing splits mid-row — but the actual
  16-row measures table repeating its column headers on a hypothetical page 2 isn't
  implemented, since the content fits one page (verified: `pdfinfo` reports `Pages: 1`) and a
  fragile fixed-position hack wasn't worth building for a case that doesn't occur yet.
- **Command search**: re-checked the full redesign brief — not actually required anywhere in
  it (only the existing facility-add search and the new Measures-tab search, both scoped/
  local). Nothing built, nothing skipped.
- Desktop Measures-list density target ("~16 rows within two 900px screens") was measured
  honestly (1,814px, right at ~2×900px) rather than assumed to pass.
- The separate "product add-on pass" (name proposals, "Where are my points?" hero, 3-step
  onboarding, first-run empty-state copy, shareable PDF summary first page) is explicitly
  sequenced to run after this pass is reviewed — not started here, per your own brief's
  ordering.

## 7. Confirmation

Every visible number, badge, chart, and action in the redesigned UI maps to a real field
already exposed by `src/lib/nhqi/scorer.js` or `src/lib/storage.js` — nothing in this pass
added a new metric, changed a scoring rule, or invented a capability (owners/deadlines/
persisted undo) the data model doesn't support. `src/lib/nhqi/` is untouched; `git diff
--stat` confirms no files under it appear in this changeset.
