// The one pure scoring function for the 2025 cycle. FacilityTracker, Portfolio, and
// pdfExport all call this and read its output shape directly — no file computes points
// independently anymore.
//
// IMPORTANT GAP, recorded rather than papered over: this app has the 2025 methodology's
// RULES (attainment table, improvement matrix, measurement periods, eligibility — supplied
// in the requester's brief) but does NOT have DOH's actual 2025 statewide CUTPOINT TABLES
// (the numeric quintile boundaries). Those were never published to this app and .gov is
// unreachable from this environment. The only cutpoint sources that actually exist here are
// (a) the bundled 2023 official DOH cutpoints, and (b) the live CMS-derived benchmark. Both
// are real and dated, neither is "2025 official." `scoreFacility` therefore takes an explicit
// `benchmark` argument and always echoes its identity/asOf date in the result, so the UI can
// never imply "ranked against 2025 DOH cutpoints" — that data doesn't exist in this app.

import { MEASURES_2025, MEASURE_2025_BY_ID, TRACKABLE_MEASURES_2025, TRACKABLE_MAX_2025 } from "./measures/2025.js";
import { getFlatAttainmentPoints, getThresholdPoints, getStarMapPoints, getBinaryPoints } from "./attainment.js";
import { getAttainmentAward, isImprovementEligible } from "./improvementMatrix.js";
import { classifyRawValue, makeObservation, OBSERVATION_STATES, VERIFICATION } from "./observation.js";
import { getQuintile } from "../scoring.js";

export const CYCLE = "2025";
const PAH_MAX = MEASURE_2025_BY_ID.pah.maxPoints;
const FULL_ELIGIBLE_MAX = TRACKABLE_MAX_2025 + PAH_MAX;

function round1(n) {
  return Math.round(n * 10) / 10;
}

// Gap to the next better quintile, with full precision kept until display and the strict-
// boundary case handled explicitly — never reports "0.0 needed" for a measure where the
// facility sits exactly at a strict (">") boundary without having actually crossed it.
export function getGapToNextQuintile(measureDef, numericValue, currentQuintile, cutpoints, { minIncrement = 0.1 } = {}) {
  if (!currentQuintile || currentQuintile <= 1 || numericValue === null || !cutpoints) return null;
  const target = cutpoints[currentQuintile - 2];
  if (target === undefined) return null;
  const higherIsBetter = measureDef.higherIsBetter;
  let gap = Math.abs(higherIsBetter ? target - numericValue : numericValue - target);
  const mustStrictlyCross = higherIsBetter; // higherIsBetter boundaries are strict ">"
  if (mustStrictlyCross && gap === 0) gap = minIncrement; // sitting exactly at the boundary has NOT crossed it
  return {
    gap,
    target,
    mustStrictlyCross,
    displayTarget: mustStrictlyCross ? `>${target}` : `≤${target}`,
  };
}

// A value that's otherwise VALID but was saved with no recorded provenance (a pre-trust-layer
// legacy entry, migrated by storage/migrate.js) is downgraded to stale_noncomparable here —
// "a legacy number with no measurement period is 'legacy value, period unverified', not
// silently current." Every other state passes through unchanged.
function withStaleOverride(observation, verification) {
  if (observation.state === OBSERVATION_STATES.VALID && verification === "legacy_unverified") {
    return { ...observation, state: OBSERVATION_STATES.STALE_NONCOMPARABLE };
  }
  return observation;
}

function scoreQuintileMeasure(measureDef, { rawValue, verification, benchmark, priorQuintile }) {
  const bounds = measureDef.unit === "%" ? { min: 0, max: 100 } : measureDef.unit === "hrs" ? { min: 0, max: 24 } : null;
  const observation = withStaleOverride(classifyRawValue(rawValue, { bounds }), verification);
  if (observation.state !== OBSERVATION_STATES.VALID) {
    return {
      measure: measureDef, observation: makeObservation({ ...observation, verification }),
      currentQuintile: null, priorQuintile: priorQuintile ?? null, points: null, pointsBasis: null,
      unresolvedReason: `measure value is ${observation.state}`,
    };
  }

  const cutpoints = benchmark?.getCutpoints?.(measureDef.id);
  if (!cutpoints || cutpoints.length < 4) {
    return {
      measure: measureDef, observation: makeObservation({ ...observation, verification }),
      currentQuintile: null, priorQuintile: priorQuintile ?? null, points: null, pointsBasis: null,
      unresolvedReason: `no cutpoints available for this measure from benchmark "${benchmark?.id ?? "none"}"`,
    };
  }

  const currentQuintile = getQuintile(measureDef, observation.numericValue, cutpoints);
  const gapInfo = getGapToNextQuintile(measureDef, observation.numericValue, currentQuintile, cutpoints);

  if (isImprovementEligible(CYCLE, measureDef.id)) {
    const award = getAttainmentAward(CYCLE, measureDef.id, currentQuintile, priorQuintile);
    return {
      measure: measureDef, observation: makeObservation({ ...observation, verification }),
      currentQuintile, priorQuintile: priorQuintile ?? null, gapInfo,
      points: award.points, pointsBasis: award.points !== null ? "attainment_plus_improvement" : null,
      unresolvedReason: award.unresolved ? award.reason : null,
    };
  }

  const points = getFlatAttainmentPoints(CYCLE, "quintile", currentQuintile);
  return {
    measure: measureDef, observation: makeObservation({ ...observation, verification }),
    currentQuintile, priorQuintile: priorQuintile ?? null, gapInfo,
    points, pointsBasis: "flat_attainment", unresolvedReason: null,
  };
}

function scoreThresholdMeasure(measureDef, { rawValue, verification }) {
  const observation = withStaleOverride(classifyRawValue(rawValue, { bounds: measureDef.unit === "%" ? { min: 0, max: 100 } : null }), verification);
  if (observation.state !== OBSERVATION_STATES.VALID) {
    return {
      measure: measureDef, observation: makeObservation({ ...observation, verification }),
      points: null, pointsBasis: null, unresolvedReason: `measure value is ${observation.state}`,
    };
  }
  const points = getThresholdPoints(measureDef, observation.numericValue);
  return { measure: measureDef, observation: makeObservation({ ...observation, verification }), points, pointsBasis: "threshold", unresolvedReason: null };
}

function scoreStarMapMeasure(measureDef, { rawValue, verification }) {
  const observation = withStaleOverride(classifyRawValue(rawValue, { bounds: { min: 1, max: 5 } }), verification);
  if (observation.state !== OBSERVATION_STATES.VALID) {
    return {
      measure: measureDef, observation: makeObservation({ ...observation, verification }),
      points: null, pointsBasis: null, unresolvedReason: `measure value is ${observation.state}`,
    };
  }
  const points = getStarMapPoints(measureDef, observation.numericValue);
  return { measure: measureDef, observation: makeObservation({ ...observation, verification }), points, pointsBasis: "star_map", unresolvedReason: null };
}

function scoreBinaryMeasure(measureDef, { rawValue, verification }) {
  // binary values are "yes"/"no" strings, not numeric -- classify directly rather than via classifyRawValue.
  if (rawValue !== "yes" && rawValue !== "no") {
    return {
      measure: measureDef, observation: makeObservation({ state: OBSERVATION_STATES.MISSING_INPUT, rawValue: rawValue ?? null, verification }),
      points: null, pointsBasis: null, unresolvedReason: "measure value is missing_input",
    };
  }
  if (verification === "legacy_unverified") {
    return {
      measure: measureDef,
      observation: makeObservation({ state: OBSERVATION_STATES.STALE_NONCOMPARABLE, rawValue, verification }),
      points: null, pointsBasis: null, unresolvedReason: "measure value is stale_noncomparable",
    };
  }
  const points = getBinaryPoints(measureDef, rawValue);
  return {
    measure: measureDef,
    observation: makeObservation({ state: OBSERVATION_STATES.VALID, rawValue, verification }),
    points, pointsBasis: "binary", unresolvedReason: null,
  };
}

function scoreOneMeasure(measureDef, ctx) {
  if (measureDef.scoringRule === "quintile") return scoreQuintileMeasure(measureDef, ctx);
  if (measureDef.scoringRule === "threshold") return scoreThresholdMeasure(measureDef, ctx);
  if (measureDef.scoringRule === "star_map") return scoreStarMapMeasure(measureDef, ctx);
  if (measureDef.scoringRule === "binary") return scoreBinaryMeasure(measureDef, ctx);
  throw new Error(`Unknown scoring rule for measure ${measureDef.id}: ${measureDef.scoringRule}`);
}

// PAH cannot be self-tracked (requires DOH's quarterly MDS->SPARCS match). `pahScenario` is
// one of: null (unresolved, default), "official" (use the bundled 2023 official result,
// labeled as such, NOT as a current observation), or one of the five supported point awards
// (0, 2, 6, 8, 10) as an explicitly labeled sensitivity scenario. Never silently zero,
// carried forward, or excluded as if that were the complete official outcome.
function scorePah(facility, pahScenario) {
  const measureDef = MEASURE_2025_BY_ID.pah;
  if (pahScenario === "official") {
    const a = facility?.actuals?.pah;
    if (!a || typeof a.points !== "number") {
      return { measure: measureDef, observation: makeObservation({ state: OBSERVATION_STATES.MISSING_INPUT, verification: VERIFICATION.OFFICIAL }), points: null, pointsBasis: null, scenario: "official", unresolvedReason: "no official PAH result on file for this facility" };
    }
    return {
      measure: measureDef,
      observation: makeObservation({ state: OBSERVATION_STATES.VALID, rawValue: a.value, numericValue: typeof a.value === "number" ? a.value : null, verification: VERIFICATION.OFFICIAL, period: "2023 official cycle (not 2025)" }),
      points: a.points, pointsBasis: "official_prior_cycle", scenario: "official", unresolvedReason: null,
    };
  }
  if (typeof pahScenario === "number" && measureDef.pahPointMap.includes(pahScenario)) {
    return {
      measure: measureDef,
      observation: makeObservation({ state: OBSERVATION_STATES.VALID, rawValue: pahScenario, numericValue: pahScenario, verification: VERIFICATION.MANUAL }),
      points: pahScenario, pointsBasis: "sensitivity_scenario", scenario: pahScenario, unresolvedReason: null,
    };
  }
  return {
    measure: measureDef,
    observation: makeObservation({ state: OBSERVATION_STATES.MISSING_INPUT, verification: VERIFICATION.MANUAL }),
    points: null, pointsBasis: null, scenario: null,
    unresolvedReason: "PAH requires DOH's quarterly MDS→SPARCS match — not self-trackable. Choose an explicit sensitivity scenario or leave unresolved.",
  };
}

// Prior-year quintile source for the improvement matrix: the only grounded option bundled in
// this app is the official 2023 per-measure quintile already stored in facility.actuals (see
// scorer.js module note). Exposed as a separate helper so callers can see exactly where
// "prior" comes from, and tests can supply an arbitrary map without needing a full facility.
export function buildPriorYearQuintilesFrom2023Actuals(facility) {
  const map = {};
  for (const m of MEASURES_2025) {
    const q = facility?.actuals?.[m.id]?.quintile;
    const n = typeof q === "string" ? parseInt(q, 10) : q;
    map[m.id] = Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  }
  return map;
}

// benchmark: { id: string, label: string, asOf: string|null, getCutpoints(measureId) => number[]|null }
// inputs: { vals, starVals, binaryVals: {measureId: raw}, verifications: {vals, starVals, binaryVals:
//   {measureId: "manual"|"cms_autofill"|"legacy_unverified"}}, pahScenario }. `verifications` is
// optional -- when omitted, any non-empty value is treated as manual (used by tests and the
// Portfolio table, which doesn't need per-field provenance for its summary columns).
// priorYearQuintiles: { measureId: 1-5 | null } -- typically buildPriorYearQuintilesFrom2023Actuals(facility)
export function scoreFacility({ facility, inputs, benchmark, priorYearQuintiles = {} }) {
  const vals = inputs?.vals ?? {};
  const starVals = inputs?.starVals ?? {};
  const binaryVals = inputs?.binaryVals ?? {};
  const verifications = inputs?.verifications ?? {};

  const perMeasure = TRACKABLE_MEASURES_2025.map(m => {
    const category = m.scoringRule === "star_map" ? "starVals" : m.scoringRule === "binary" ? "binaryVals" : "vals";
    const rawValue = category === "starVals" ? starVals[m.id] : category === "binaryVals" ? binaryVals[m.id] : vals[m.id];
    const hasValue = rawValue !== undefined && rawValue !== null && rawValue !== "";
    const verification = verifications[category]?.[m.id] ?? (hasValue ? VERIFICATION.MANUAL : null);
    return scoreOneMeasure(m, { rawValue, verification, benchmark, priorQuintile: priorYearQuintiles[m.id] ?? null });
  });

  const pahResult = scorePah(facility, inputs?.pahScenario ?? null);
  const allResults = [...perMeasure, pahResult];

  const known = allResults.filter(r => r.points !== null);
  const knownEarnedPoints = known.reduce((a, r) => a + r.points, 0);
  const unresolvedMaxPoints = allResults.filter(r => r.points === null).reduce((a, r) => a + r.measure.maxPoints, 0);

  // Full eligible denominator is reduced only by a GROUNDED official applicability rule.
  // No such rule is in play for the modeled "current" scenario (small-sample suppression is
  // an official-dataset fact, not something this app can determine for an in-progress year),
  // so it stays at the full 90 -- a blank field shrinks the numerator via unresolvedMaxPoints,
  // never the denominator.
  const fullEligibleMax = FULL_ELIGIBLE_MAX;

  const allResolved = allResults.every(r => r.points !== null);
  const normalizedScore = allResolved
    ? { value: round1((knownEarnedPoints / fullEligibleMax) * 100), basis: `${knownEarnedPoints}/${fullEligibleMax}` }
    : null;

  const eligibilityBlocked = !!facility?.jklDeficiency;

  return {
    cycle: CYCLE,
    benchmark: benchmark ? { id: benchmark.id, label: benchmark.label, asOf: benchmark.asOf ?? null } : null,
    perMeasure: allResults,
    knownEarnedPoints,
    unresolvedMaxPoints,
    fullEligibleMax,
    coverage: {
      measuresKnown: known.length,
      measuresTotal: allResults.length,
      pointsKnown: knownEarnedPoints,
      pointsPotential: fullEligibleMax,
    },
    normalizedScore,
    // Overall quintile is never modeled for the "current" scenario this pass: no grounded
    // statewide peer cohort or tie-break method is sourced. Showing a ranked quintile here
    // would be an invented algorithm, not a calculation -- exactly what this pass removes.
    overallQuintile: {
      modeled: false,
      reason: "Statewide peer cohort and tie-break method for this scenario are not sourced (NY DOH methodology pages are unreachable from this environment) -- a ranked quintile would be invented, not calculated.",
    },
    eligibilityBlocked,
    eligibilityReason: eligibilityBlocked
      ? "This facility has a J/K/L (immediate jeopardy) health inspection deficiency on file. DOH excludes facilities with this flag from NHQI ranking and award eligibility -- any score/quintile shown is directional only, not an eligible ranked result."
      : null,
  };
}

// Real, attainable point gain from moving ONE quintile tier better on a measure, using the
// SAME attainment/improvement logic as scoreFacility -- the single place this math happens,
// so PriorityList/pdfExport never independently assume "better quintile = more points" (a
// Q5->Q4 move on a measure with no improvement credit this cycle is a real 0, not a gain).
// Returns null when either side is unresolved (never fabricates a gain from incomplete data).
export function getNextTierGain(measureResult) {
  const { measure, currentQuintile, priorQuintile, points } = measureResult;
  if (!currentQuintile || currentQuintile <= 1 || points === null) return null;
  const nextQuintile = currentQuintile - 1;
  const nextPoints = isImprovementEligible(CYCLE, measure.id)
    ? getAttainmentAward(CYCLE, measure.id, nextQuintile, priorQuintile).points
    : getFlatAttainmentPoints(CYCLE, measure.scoringRule, nextQuintile);
  if (nextPoints === null) return null;
  return nextPoints - points;
}
