// Reads the CMS Care Compare auto-fill snapshot refreshed by
// .github/workflows/refresh-cms-data.yml (see scripts/fetch-cms-data.mjs).
// Values are keyed by CMS Certification Number (CCN) — our facilities'
// `medicareNumber` field — so they can be joined regardless of which DOH
// dataset year is currently loaded.

import cmsData from "../data/cms_autofill.json";

export const CMS_AUTOFILL_MEASURE_IDS = new Set(Object.keys(cmsData.measures || {}));

export function getAutofillValue(measureId, medicareNumber) {
  if (!medicareNumber) return null;
  const table = cmsData.measures?.[measureId];
  if (!table) return null;
  const v = table[String(medicareNumber).trim().toUpperCase()];
  return typeof v === "number" ? v : null;
}

// Average daily census (CMS Provider Info's "Average Number of Residents per
// Day") — used to convert a measure's percentage/rate gap into a concrete
// headcount plan (see src/lib/actionPlan.js). Not a scored measure, so it's
// stored separately from `measures`.
export function getCensus(medicareNumber) {
  if (!medicareNumber) return null;
  const v = cmsData.census?.[String(medicareNumber).trim().toUpperCase()];
  return typeof v === "number" ? v : null;
}

export const cmsAutofillMeta = {
  generatedAt: cmsData.generatedAt || null,
  source: cmsData.source || "CMS Care Compare (data.cms.gov)",
};

// Live NY-wide quintile boundaries computed from real CMS facility data (see
// computeLiveCutpoints in scripts/fetch-cms-data.mjs) — a directional
// benchmark alongside the frozen DOH cut points in src/data/nhqi_2023.json,
// not a DOH-certified figure. Same array shape as getCutpoints() in
// scoring.js, so getQuintile()/getPoints() work unchanged against either.
export function getLiveCutpoints(measureId) {
  return cmsData.liveCutpoints?.[measureId]?.boundaries || null;
}

