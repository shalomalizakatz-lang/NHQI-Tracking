// Local persistence for the tracked facility portfolio and 2025 user inputs.
// Data model mirrors the suggested Supabase schema (see supabase/schema.sql) so
// swapping in Supabase later is a matter of replacing these functions' bodies —
// callers only depend on this module's exported API.

const PORTFOLIO_KEY = "nhqi_portfolio_v1";
const INPUTS_KEY = "nhqi_inputs_v1";
const SEEDED_KEY = "nhqi_seeded_v1";

// Pre-loads Highland Care Center and Achieve Rehab & Nursing on first run only.
// Runs once ever (tracked via SEEDED_KEY) so a user who removes them isn't stuck
// with them reappearing.
export function ensureSeedPortfolio() {
  if (localStorage.getItem(SEEDED_KEY)) return;
  localStorage.setItem(SEEDED_KEY, "1");
  const portfolio = getPortfolio();
  if (portfolio.length > 0) return;
  write(PORTFOLIO_KEY, [
    { facilityId: "1711", displayName: null, beds: null, addedAt: new Date().toISOString() },
    { facilityId: "962", displayName: null, beds: null, addedAt: new Date().toISOString() },
  ]);
}

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
  const inputs = read(INPUTS_KEY, {});
  delete inputs[facilityId];
  write(INPUTS_KEY, inputs);
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

// 2025 inputs: { [facilityId]: { vals: {measureId: value}, starVals: {...}, binaryVals: {...}, updatedAt } }
export function getInputs(facilityId) {
  const all = read(INPUTS_KEY, {});
  return all[facilityId] || { vals: {}, starVals: {}, binaryVals: {} };
}

export function getAllInputs() {
  return read(INPUTS_KEY, {});
}

export function saveInputs(facilityId, { vals, starVals, binaryVals }) {
  const all = read(INPUTS_KEY, {});
  all[facilityId] = { vals, starVals, binaryVals, updatedAt: new Date().toISOString() };
  write(INPUTS_KEY, all);
}

export function resetInputs(facilityId) {
  const all = read(INPUTS_KEY, {});
  delete all[facilityId];
  write(INPUTS_KEY, all);
}
