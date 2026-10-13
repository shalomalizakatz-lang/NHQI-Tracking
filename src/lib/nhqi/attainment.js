// Cycle-keyed flat attainment tables and threshold/star/binary point rules.
// These are the PURE lookup tables — no eligibility or improvement logic here (see
// improvementMatrix.js for that). A quintile-scored measure's final award is only equal to
// this flat table when the measure isn't improvement-eligible for the cycle, or when prior-
// year quintile is unavailable and the caller has chosen to report attainment-only as a
// labeled partial result (never as the final official-looking figure — see scorer.js).

export const ATTAINMENT_TABLES = {
  2025: {
    quintile: [5, 3, 1, 0, 0], // index 0 = Q1 ... index 4 = Q5
    quintile_pah: [10, 8, 6, 2, 0],
  },
};

export function getFlatAttainmentPoints(cycle, scoringRule, quintile) {
  if (!quintile || quintile < 1 || quintile > 5) return null;
  const table = ATTAINMENT_TABLES[cycle]?.[scoringRule];
  if (!table) return null;
  return table[quintile - 1];
}

// Threshold-measure point rules (pass/fail against a single cutoff, not a quintile split).
// Matches each measure's own `threshold`/`thresholdDir`/`maxPoints` in measures/2025.js;
// this function is the single place that applies the inclusive/exclusive comparison so it
// can be unit-tested at the exact boundary independent of the UI.
export function getThresholdPoints(measureDef, rawValue) {
  if (rawValue === "" || rawValue === null || rawValue === undefined) return null;
  const v = typeof rawValue === "number" ? rawValue : parseFloat(rawValue);
  if (!Number.isFinite(v)) return null;
  const { threshold, thresholdDir, maxPoints } = measureDef;
  if (thresholdDir === "lte") return v <= threshold ? maxPoints : 0;
  if (thresholdDir === "lt") return v < threshold ? maxPoints : 0;
  if (thresholdDir === "gte") return v >= threshold ? maxPoints : 0;
  if (thresholdDir === "gt") return v > threshold ? maxPoints : 0;
  return null;
}

export function getStarMapPoints(measureDef, starValue) {
  if (starValue === "" || starValue === null || starValue === undefined) return null;
  const s = typeof starValue === "number" ? starValue : parseInt(starValue, 10);
  if (!Number.isInteger(s) || s < 1 || s > 5) return null;
  return measureDef.starMap?.[s] ?? null;
}

export function getBinaryPoints(measureDef, binaryValue) {
  // binaryValue: "yes" | "no" | null/undefined (unanswered — distinct from "no").
  if (binaryValue !== "yes" && binaryValue !== "no") return null;
  return binaryValue === "yes" ? measureDef.maxPoints : 0;
}

export function getPahPoints(measureDef, quintile) {
  if (!quintile || quintile < 1 || quintile > 5) return null;
  return measureDef.pahPointMap[quintile - 1];
}
