// DOH's official normalized score: (points earned / max attainable) x 100, NOT a raw point
// sum out of 90. Max attainable shrinks below 90 only for a grounded official applicability
// reason (DOH's small-sample-size exclusion, marked "SS" in the source data — see
// observation.js's SUPPRESSED_OFFICIAL state). Verified earlier against real 2023 facility
// data: a facility with no exclusions summing to 29 points published totalScore 32.2
// (=29/90x100, rounded to 1 decimal); a facility with two SS-excluded 5pt measures summing to
// 50 points against an adjusted 75pt max published totalScore 66.7 (=50/75x100).
//
// Rounding precision note: the requester's worked example (Table 4 in the 2025 methodology)
// illustrates this same ratio-then-round method with whole-number results (75/90 -> 83,
// 75/80 -> 94) rather than 1-decimal results. That illustration's underlying METHOD (round
// the unrounded ratio once, at the end — never round sum or max first) is what's implemented
// and tested here; the 1-decimal precision used below matches the real, directly-verified
// published field (e.g. 32.2, 66.7) rather than the table's simplified whole-number display,
// since the real data is the stronger ground truth where the two appear to disagree on
// display precision alone.
export function normalizeOfficialScore(sumPoints, maxAttainable) {
  if (!maxAttainable || maxAttainable <= 0) return null;
  const ratio = sumPoints / maxAttainable;
  return Math.round(ratio * 1000) / 10;
}

// Whole-number variant matching the methodology table's own illustrated precision, for
// anywhere that display convention is specifically wanted.
export function normalizeOfficialScoreWhole(sumPoints, maxAttainable) {
  if (!maxAttainable || maxAttainable <= 0) return null;
  return Math.round((sumPoints / maxAttainable) * 100);
}
