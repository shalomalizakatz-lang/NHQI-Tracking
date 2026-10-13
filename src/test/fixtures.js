// Real facilities from the bundled 2023 DOH dataset, selected by the property a
// test needs rather than hardcoded IDs -- so UI tests exercise real data, not
// fabricated numbers, matching the trust-layer pass's own fixture policy.
import dataset from "../data/nhqi_2023.json";

function findFacility(predicate) {
  const f = dataset.facilities.find(predicate);
  if (!f) throw new Error("No facility in the bundled 2023 dataset matches this fixture predicate");
  return f;
}

export function getDataset() {
  return dataset;
}

export function getJklDeficiencyFacility() {
  return findFacility(f => f.jklDeficiency);
}

export function getClosedFacility() {
  return findFacility(f => f.closed);
}

export function getFullCoverageFacility() {
  return findFacility(f =>
    Object.keys(f.actuals).length >= 15 &&
    Object.values(f.actuals).every(a => a.value !== null && a.value !== undefined)
  );
}

export function getIncompleteCoverageFacility() {
  return findFacility(f => {
    const vals = Object.values(f.actuals);
    const missing = vals.filter(a => a.value === null || a.value === undefined);
    return missing.length > 0 && missing.length < vals.length;
  });
}

export function getLongNameFacility() {
  return dataset.facilities.reduce((longest, f) => (f.name.length > longest.name.length ? f : longest));
}
