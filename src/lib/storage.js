// Local persistence for the tracked facility portfolio and 2025 user inputs.
// Data model mirrors the suggested Supabase schema (see supabase/schema.sql) so
// swapping in Supabase later is a matter of replacing these functions' bodies —
// callers only depend on this module's exported API.

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
