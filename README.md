# NHQI Multi-Facility Tracker

Tracks NY DOH Nursing Home Quality Initiative (NHQI) scores across multiple SNF
facilities: 2023 actuals, 2025 full-year projections, estimated 2027 quintile
placement, and a ranked improvement plan per facility.

## Stack

- React + Vite + TailwindCSS
- React Router (Portfolio / per-facility tracker / Settings)
- `@react-pdf/renderer` for per-facility PDF export
- Persistence: `localStorage` by default (works with zero setup). A Supabase
  schema is included at `supabase/schema.sql` for moving the portfolio to a
  shared backend later — see `src/lib/storage.js`, which is the only module
  that would need to change.

## Data

- `src/data/nhqi_2023.json` — 571 NY facilities' 2023 NHQI actuals, converted
  from the DOH export (`nhqi 2023 only.csv`) at the repo root. Cut points are
  stored per measure, with a region-specific override for nursing staff
  turnover (DOH regionally adjusts that measure — MARO differs from
  WRO/CNYRO/CDRO).
- Use **Settings → Refresh Cut Points** to upload a new DOH CSV export (same
  long-format structure) when DOH publishes updated cut points; the tracked
  portfolio and entered 2025 numbers are preserved.

## Scoring

16 measures: 13 quality (65 pts) + 2 compliance (15 pts) + 1 efficiency PAH
(10 pts) = 90 pts max. See `src/lib/scoring.js` for the full measure
definitions and point tables. PAH cannot be self-tracked in real time — it
requires DOH's MDS→SPARCS match — so treat entered PAH values as estimates.

## Development

```bash
npm install
npm run dev
npm run build
```
