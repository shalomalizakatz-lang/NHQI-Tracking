// Typed observation/applicability states. An unanswered field, a CMS sentinel, a DOH small-
// sample-size suppression, and a stale legacy value are all DIFFERENT things — conflating any
// of them with "0" or with "current valid data" is exactly the bug class this pass removes.
// Raw data is always preserved alongside the classified state; the state and the
// verification/source are tracked separately (two different questions: "what kind of value is
// this" vs. "where did it come from and do we trust it").

export const OBSERVATION_STATES = Object.freeze({
  VALID: "valid",
  MISSING_INPUT: "missing_input", // user hasn't entered a value yet
  UNAVAILABLE_SOURCE: "unavailable_source", // e.g. CMS has no matching row for this facility/measure
  INVALID_INPUT: "invalid_input", // NaN, out of logical bounds, non-finite
  STALE_NONCOMPARABLE: "stale_noncomparable", // value exists but its period/version isn't confirmed comparable
  SUPPRESSED_OFFICIAL: "suppressed_official", // official small-sample-size or similar DOH-applied suppression
});

export const VERIFICATION = Object.freeze({
  MANUAL: "manual", // user-entered
  CMS_AUTOFILL: "cms_autofill", // pre-filled from CMS Care Compare, not yet overridden
  OFFICIAL: "official", // from the official DOH NHQI dataset
  LEGACY_UNVERIFIED: "legacy_unverified", // pre-existing stored value with no recorded provenance
});

// DOH's own small-sample-size sentinel in the bundled dataset (see src/data/nhqi_2023.json —
// e.g. a facility's `actuals.pah.value === "SS"`). A facility-side hospitalization log or any
// other self-reported substitute for an officially suppressed measure is NOT a valid override
// of this state — see the PAH applicability note in measures/2025.js.
const OFFICIAL_SUPPRESSION_SENTINELS = new Set(["SS"]);
const MISSING_SENTINELS = new Set(["", "NA", "N/A", null, undefined]);

// Classifies a raw value (string, number, null/undefined) into an Observation. `bounds`, when
// given, is the logical range for the unit (e.g. {min:0, max:100} for a percentage) — a value
// outside it is invalid_input, not silently clamped or accepted.
export function classifyRawValue(raw, { bounds = null } = {}) {
  if (MISSING_SENTINELS.has(raw)) {
    return { state: OBSERVATION_STATES.MISSING_INPUT, rawValue: raw, numericValue: null };
  }
  if (typeof raw === "string" && OFFICIAL_SUPPRESSION_SENTINELS.has(raw.trim().toUpperCase())) {
    return { state: OBSERVATION_STATES.SUPPRESSED_OFFICIAL, rawValue: raw, numericValue: null };
  }
  const n = typeof raw === "number" ? raw : parseFloat(raw);
  if (!Number.isFinite(n)) {
    return { state: OBSERVATION_STATES.INVALID_INPUT, rawValue: raw, numericValue: null };
  }
  if (bounds && (n < bounds.min || n > bounds.max)) {
    return { state: OBSERVATION_STATES.INVALID_INPUT, rawValue: raw, numericValue: n };
  }
  return { state: OBSERVATION_STATES.VALID, rawValue: raw, numericValue: n };
}

// Builds a full Observation with provenance. `period`/`fetchedAt`/`sourceCitation` are kept
// even when the state isn't VALID, so a missing/invalid/suppressed field still carries exactly
// what was checked and when.
export function makeObservation({
  state,
  rawValue = null,
  numericValue = null,
  verification,
  sourceCitation = null,
  period = null,
  fetchedAt = null,
  overrideOf = null,
}) {
  return { state, rawValue, numericValue, verification, sourceCitation, period, fetchedAt, overrideOf };
}

export function isUsable(observation) {
  return observation?.state === OBSERVATION_STATES.VALID;
}
