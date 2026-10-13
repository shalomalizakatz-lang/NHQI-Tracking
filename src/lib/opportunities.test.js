import { describe, it, expect } from "vitest";
import { scoreFacility, buildPriorYearQuintilesFrom2023Actuals } from "./nhqi/scorer.js";
import { official2023Benchmark } from "./nhqi/benchmarks.js";
import { getAllOpportunities, getTopOpportunity, getMissingEvidence } from "./opportunities.js";
import { getFullCoverageFacility, getDataset } from "../test/fixtures.js";

// Scores a real 2023 facility against its own 2023 actuals (entered as this
// cycle's current values) so quintiles come from real DOH numbers, not
// invented test data.
function scoreRealFacility(facility) {
  const dataset = getDataset();
  const benchmark = official2023Benchmark(dataset, facility);
  const priorYearQuintiles = buildPriorYearQuintilesFrom2023Actuals(facility);
  const vals = {};
  for (const [id, a] of Object.entries(facility.actuals)) {
    if (typeof a.value === "number") vals[id] = String(a.value);
  }
  return scoreFacility({ facility, inputs: { vals }, benchmark, priorYearQuintiles });
}

describe("getAllOpportunities / getTopOpportunity", () => {
  it("only includes quintile measures above the top tier with a real, positive supported gain", () => {
    const scored = scoreRealFacility(getFullCoverageFacility());
    const opportunities = getAllOpportunities(scored);
    expect(opportunities.length).toBeGreaterThan(0);
    for (const { row, gain } of opportunities) {
      expect(["quintile", "quintile_pah"]).toContain(row.measure.scoringRule);
      expect(row.currentQuintile).toBeGreaterThan(1);
      expect(gain).toBeGreaterThan(0);
    }
  });

  it("sorts opportunities by gain, descending", () => {
    const scored = scoreRealFacility(getFullCoverageFacility());
    const gains = getAllOpportunities(scored).map(o => o.gain);
    const sorted = [...gains].sort((a, b) => b - a);
    expect(gains).toEqual(sorted);
  });

  it("getTopOpportunity returns the single largest gain, or null when there are none", () => {
    const scored = scoreRealFacility(getFullCoverageFacility());
    const top = getTopOpportunity(scored);
    const all = getAllOpportunities(scored);
    expect(top).toEqual(all[0]);

    const noGainsScored = { perMeasure: [] };
    expect(getTopOpportunity(noGainsScored)).toBeNull();
  });
});

describe("getMissingEvidence", () => {
  it("lists only measures with an unresolved (missing or invalid) input, never a resolved one", () => {
    const scored = scoreRealFacility(getFullCoverageFacility());
    const missing = getMissingEvidence(scored);
    for (const row of missing) {
      expect(["missing_input", "invalid_input"]).toContain(row.observation.state);
    }
  });
});
