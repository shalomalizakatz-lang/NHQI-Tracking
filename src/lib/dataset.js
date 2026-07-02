import seedDataset from "../data/nhqi_2023.json";

const CUSTOM_DATASET_KEY = "nhqi_custom_dataset_v1";

// Returns the active DOH dataset: a user-uploaded refresh (see cutpoints refresh
// feature) if one exists in storage, otherwise the bundled 2023 dataset.
export function loadActiveDataset() {
  try {
    const raw = localStorage.getItem(CUSTOM_DATASET_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return seedDataset;
}

export function saveCustomDataset(dataset) {
  localStorage.setItem(CUSTOM_DATASET_KEY, JSON.stringify(dataset));
}

export function clearCustomDataset() {
  localStorage.removeItem(CUSTOM_DATASET_KEY);
}

export function hasCustomDataset() {
  return localStorage.getItem(CUSTOM_DATASET_KEY) !== null;
}

export function findFacilityById(dataset, id) {
  return dataset.facilities.find(f => f.id === id) || null;
}

export function searchFacilities(dataset, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return dataset.facilities
    .filter(f => f.name.toLowerCase().includes(q) || f.city.toLowerCase().includes(q) || f.county.toLowerCase().includes(q))
    .slice(0, 25);
}
