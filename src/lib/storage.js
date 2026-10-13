// Local persistence for the tracked facility portfolio and current-cycle inputs.
// Data model mirrors the suggested Supabase schema (see supabase/schema.sql) so
// swapping in Supabase later is a matter of replacing these functions' bodies —
// callers only depend on this module's exported API.
//
// Inputs are stored in the versioned, provenance-aware shape from
// src/lib/storage/migrate.js (schema v2) — every field is {value, verification, period,
// fetchedAt, overrideOf, updatedAt}, not a bare string, so a saved value's source is never
// lost on reload and a CMS refresh can never silently clobber a manual entry. A pre-existing
// v1 blob (bare strings, no provenance) is migrated in place on first read, with every field
// preserved and marked "legacy_unverified" rather than presented as current.

import { ensureMigratedInputs, makeFieldRecord, applyCmsRefreshToField, VERIFICATION } from "./storage/migrate.js";

const PORTFOLIO_KEY = "nhqi_portfolio_v1";
const INPUTS_KEY = "nhqi_inputs_v1";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readInputsBlob() {
  const migrated = ensureMigratedInputs(read(INPUTS_KEY, null));
  write(INPUTS_KEY, migrated); // persist the migration so it only runs once
  return migrated;
}

function emptyFacilityBucket() {
  return { vals: {}, starVals: {}, binaryVals: {}, pahScenario: null, updatedAt: null };
}

// Portfolio: the list of DOH facilities the user is tracking.
// Entry shape: { facilityId, displayName, beds, addedAt }
export function getPortfolio() {
  return read(PORTFOLIO_KEY, []);
}

export function isTracked(facilityId) {
  return getPortfolio().some(f => f.facilityId === facilityId);
}

export function addFacility(facilityId, { displayName, beds } = {}) {
  const portfolio = getPortfolio();
  if (portfolio.some(f => f.facilityId === facilityId)) return portfolio;
  const next = [...portfolio, { facilityId, displayName: displayName || null, beds: beds || null, addedAt: new Date().toISOString() }];
  write(PORTFOLIO_KEY, next);
  return next;
}

export function removeFacility(facilityId) {
  const next = getPortfolio().filter(f => f.facilityId !== facilityId);
  write(PORTFOLIO_KEY, next);
  const blob = readInputsBlob();
  delete blob[facilityId];
  write(INPUTS_KEY, blob);
  return next;
}

export function renameFacility(facilityId, displayName) {
  const next = getPortfolio().map(f => f.facilityId === facilityId ? { ...f, displayName } : f);
  write(PORTFOLIO_KEY, next);
  return next;
}

export function setBeds(facilityId, beds) {
  const next = getPortfolio().map(f => f.facilityId === facilityId ? { ...f, beds } : f);
  write(PORTFOLIO_KEY, next);
  return next;
}

// Returns the full provenance-aware bucket for one facility: { vals, starVals, binaryVals,
// pahScenario, updatedAt }, where each vals/starVals/binaryVals entry is a FieldRecord
// ({value, verification, period, fetchedAt, overrideOf, updatedAt}), not a bare string.
export function getFacilityInputs(facilityId) {
  const blob = readInputsBlob();
  return blob[facilityId] || emptyFacilityBucket();
}

export function getAllFacilityInputs() {
  const blob = readInputsBlob();
  const { schemaVersion, ...facilities } = blob;
  return facilities;
}

// Convenience view for callers that only need raw values (e.g. feeding the scorer), not
// provenance -- unwraps each FieldRecord to its .value. Use getFacilityInputs directly
// wherever the UI needs to show source/period/verification.
export function getPlainInputs(facilityId) {
  const bucket = getFacilityInputs(facilityId);
  const unwrap = category => Object.fromEntries(Object.entries(bucket[category] || {}).map(([id, rec]) => [id, rec.value]));
  return { vals: unwrap("vals"), starVals: unwrap("starVals"), binaryVals: unwrap("binaryVals"), pahScenario: bucket.pahScenario ?? null };
}

export function getAllPlainInputs() {
  const all = getAllFacilityInputs();
  return Object.fromEntries(Object.keys(all).map(id => [id, getPlainInputs(id)]));
}

// Saves one field as a manual entry. This is the only path user-driven edits should go
// through -- it always marks the field MANUAL, which is what protects it from being
// overwritten by a later CMS refresh (see applyCmsRefreshToField / saveCmsAutofillField).
export function saveManualFieldValue(facilityId, category, measureId, rawValue) {
  const blob = readInputsBlob();
  const bucket = blob[facilityId] || emptyFacilityBucket();
  if (rawValue === "" || rawValue === null || rawValue === undefined) {
    delete bucket[category][measureId];
  } else {
    bucket[category][measureId] = makeFieldRecord({ value: rawValue, verification: VERIFICATION.MANUAL });
  }
  bucket.updatedAt = new Date().toISOString();
  blob[facilityId] = bucket;
  write(INPUTS_KEY, blob);
  return bucket;
}

// Stages a CMS auto-fill value for a field, respecting manual overrides (see
// applyCmsRefreshToField in storage/migrate.js). Returns whether it actually changed anything,
// so a refresh UI can report "N fields updated" truthfully instead of assuming success.
export function saveCmsAutofillField(facilityId, category, measureId, proposedValue, { period, fetchedAt }) {
  const blob = readInputsBlob();
  const bucket = blob[facilityId] || emptyFacilityBucket();
  const existing = bucket[category][measureId] || null;
  const result = applyCmsRefreshToField(existing, proposedValue, { period, fetchedAt });
  if (result.changed) {
    bucket[category][measureId] = result.record;
    bucket.updatedAt = new Date().toISOString();
    blob[facilityId] = bucket;
    write(INPUTS_KEY, blob);
  }
  return result;
}

export function savePahScenario(facilityId, scenario) {
  const blob = readInputsBlob();
  const bucket = blob[facilityId] || emptyFacilityBucket();
  bucket.pahScenario = scenario;
  bucket.updatedAt = new Date().toISOString();
  blob[facilityId] = bucket;
  write(INPUTS_KEY, blob);
  return bucket;
}

export function resetInputs(facilityId) {
  const blob = readInputsBlob();
  delete blob[facilityId];
  write(INPUTS_KEY, blob);
}

// Full local backup/restore -- an export/import path for the data this app keeps only "on
// this device". Covers portfolio + inputs; does not include an uploaded custom dataset
// (src/lib/dataset.js's own key), which is refresh-sourced data rather than user input.
export function exportBackup() {
  return {
    exportedAt: new Date().toISOString(),
    portfolio: getPortfolio(),
    inputs: readInputsBlob(),
  };
}

export function importBackup(backup) {
  if (!backup || typeof backup !== "object") throw new Error("Backup file is not valid JSON.");
  if (!Array.isArray(backup.portfolio)) throw new Error("Backup is missing a portfolio array.");
  if (!backup.inputs || typeof backup.inputs !== "object") throw new Error("Backup is missing an inputs object.");
  write(PORTFOLIO_KEY, backup.portfolio);
  write(INPUTS_KEY, ensureMigratedInputs(backup.inputs));
}
