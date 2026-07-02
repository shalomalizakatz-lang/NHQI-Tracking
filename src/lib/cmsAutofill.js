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

export const cmsAutofillMeta = {
  generatedAt: cmsData.generatedAt || null,
  source: cmsData.source || "CMS Care Compare (data.cms.gov)",
};
