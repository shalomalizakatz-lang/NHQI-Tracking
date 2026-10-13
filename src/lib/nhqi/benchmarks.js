// Benchmark providers for scorer.js. See scorer.js's module note: this app has the 2025
// methodology's RULES but not DOH's 2025 cutpoint tables, so both benchmarks here are
// honestly labeled by what they actually are -- never "2025 official."

import { getCutpoints as getLegacyCutpoints } from "../scoring.js";

// The bundled 2023 official DOH cutpoints (src/data/nhqi_2023.json). Real, dated, sourced --
// just not the 2025 cycle's own cutpoints, which this app doesn't have.
export function official2023Benchmark(dataset, facility) {
  return {
    id: "2023_official_cutpoints",
    label: "Modeled against 2023 NY DOH cutpoints",
    asOf: dataset?.year ? `${dataset.year} official cycle` : null,
    getCutpoints: measureId => getLegacyCutpoints(dataset, measureId, facility?.region),
  };
}

// The live CMS-derived percentile benchmark (src/data/cms_autofill.json, refreshed monthly
// by scripts/fetch-cms-data.mjs). Dated by its own generatedAt -- a real, current peer
// distribution, not a DOH-certified cutpoint table.
export function liveCmsBenchmark(getLiveCutpointsFn, generatedAt) {
  return {
    id: "live_cms",
    label: "Latest public NY benchmark (CMS Care Compare)",
    asOf: generatedAt ?? null,
    getCutpoints: measureId => getLiveCutpointsFn(measureId),
  };
}
