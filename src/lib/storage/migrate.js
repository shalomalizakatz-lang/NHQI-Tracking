// Pure (no localStorage access) schema versioning + migration for the per-facility "current
// full-year" inputs blob. Kept storage-agnostic so it's testable without a DOM/localStorage
// shim; src/lib/storage.js is the thin localStorage-specific wrapper that calls into this.
//
// v1 shape (pre-trust-layer): { [facilityId]: { vals: {measureId: rawString}, starVals: {...},
// binaryVals: {...}, updatedAt } } -- a bare string per field, no provenance at all.
//
// v2 shape: each field becomes a record carrying where the value came from and when, so a
// saved CMS value can never silently read as an unexplained manual number, and a legacy value
// with no recorded provenance is never presented as current:
//   { schemaVersion: 2, [facilityId]: {
//       vals: { [measureId]: FieldRecord }, starVals: { [measureId]: FieldRecord },
//       binaryVals: { [measureId]: FieldRecord }, pahScenario: number|"official"|null,
//       updatedAt,
//   } }
//   FieldRecord = { value, verification, period, fetchedAt, overrideOf, updatedAt }

export const CURRENT_SCHEMA_VERSION = 2;

export const VERIFICATION = Object.freeze({
  MANUAL: "manual",
  CMS_AUTOFILL: "cms_autofill",
  LEGACY_UNVERIFIED: "legacy_unverified",
});

export function makeFieldRecord({ value, verification, period = null, fetchedAt = null, overrideOf = null, updatedAt = null }) {
  return { value, verification, period, fetchedAt, overrideOf, updatedAt: updatedAt ?? new Date().toISOString() };
}

function wrapLegacyBucket(bucket, updatedAt) {
  const out = {};
  for (const [measureId, rawValue] of Object.entries(bucket || {})) {
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;
    out[measureId] = makeFieldRecord({ value: rawValue, verification: VERIFICATION.LEGACY_UNVERIFIED, updatedAt });
  }
  return out;
}

// Migrates one facility's v1 input bucket to v2. Preserves every existing value -- nothing is
// dropped -- but marks it "legacy_unverified" rather than claiming it's a current manual entry
// or a fresh CMS pull, since the v1 schema recorded neither.
export function migrateFacilityInputsV1toV2(v1Facility) {
  const updatedAt = v1Facility?.updatedAt ?? null;
  return {
    vals: wrapLegacyBucket(v1Facility?.vals, updatedAt),
    starVals: wrapLegacyBucket(v1Facility?.starVals, updatedAt),
    binaryVals: wrapLegacyBucket(v1Facility?.binaryVals, updatedAt),
    pahScenario: null, // v1 had no PAH scenario concept at all -- stays unresolved, not guessed
    updatedAt,
  };
}

export function isV2(blob) {
  return !!blob && blob.schemaVersion === CURRENT_SCHEMA_VERSION;
}

// Takes whatever was read from storage (null, a bare v1 blob, or an already-v2 blob) and
// returns a guaranteed-v2 blob. Idempotent -- migrating an already-v2 blob is a no-op.
export function ensureMigratedInputs(rawBlob) {
  if (!rawBlob) return { schemaVersion: CURRENT_SCHEMA_VERSION };
  if (isV2(rawBlob)) return rawBlob;
  // v1: every top-level key except schemaVersion is a facilityId -> {vals,starVals,binaryVals,updatedAt}
  const migrated = { schemaVersion: CURRENT_SCHEMA_VERSION };
  for (const [facilityId, bucket] of Object.entries(rawBlob)) {
    if (facilityId === "schemaVersion") continue;
    migrated[facilityId] = migrateFacilityInputsV1toV2(bucket);
  }
  return migrated;
}

// A CMS refresh must never clobber a manual entry or a confirmed override -- it only writes a
// field that is currently empty, legacy_unverified, or itself a not-yet-overridden
// cms_autofill value whose underlying CMS value actually changed. Returns the field unchanged
// (with the proposed value staged separately) whenever a manual/override value is present.
export function applyCmsRefreshToField(existingRecord, proposedValue, { period, fetchedAt }) {
  if (!existingRecord || existingRecord.verification === VERIFICATION.LEGACY_UNVERIFIED) {
    // Nothing to protect, or no recorded provenance to trust -- safe to stage the fresh pull.
    return { changed: true, record: makeFieldRecord({ value: proposedValue, verification: VERIFICATION.CMS_AUTOFILL, period, fetchedAt }) };
  }
  if (existingRecord.verification === VERIFICATION.MANUAL) {
    return { changed: false, record: existingRecord, reason: "manual entry preserved" };
  }
  // existing is cms_autofill: only restage if the underlying value actually changed.
  if (existingRecord.value === proposedValue) {
    return { changed: false, record: existingRecord, reason: "unchanged" };
  }
  return { changed: true, record: makeFieldRecord({ value: proposedValue, verification: VERIFICATION.CMS_AUTOFILL, period, fetchedAt, overrideOf: existingRecord.value }) };
}
