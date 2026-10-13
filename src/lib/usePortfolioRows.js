import { useEffect, useMemo, useState } from "react";
import { loadActiveDataset, findFacilityById } from "./dataset.js";
import { getPortfolio, getAllPlainInputs } from "./storage.js";
import { scoreFacility, buildPriorYearQuintilesFrom2023Actuals } from "./nhqi/scorer.js";
import { official2023Benchmark } from "./nhqi/benchmarks.js";
import { getTopOpportunity } from "./opportunities.js";

// One row-building pass, consumed by both Portfolio's desktop table and its
// mobile card list -- so the two layouts can never drift apart on what a
// given facility's numbers actually are.
export default function usePortfolioRows() {
  const [dataset] = useState(() => loadActiveDataset());
  const [portfolio, setPortfolio] = useState(() => getPortfolio());

  useEffect(() => setPortfolio(getPortfolio()), []);

  const rows = useMemo(() => {
    const inputsAll = getAllPlainInputs();
    return portfolio
      .map(entry => {
        const facility = findFacilityById(dataset, entry.facilityId);
        if (!facility) return null;
        const benchmark = official2023Benchmark(dataset, facility);
        const priorYearQuintiles = buildPriorYearQuintilesFrom2023Actuals(facility);
        const inputs = inputsAll[entry.facilityId] || { vals: {}, starVals: {}, binaryVals: {}, pahScenario: null };
        const scored = scoreFacility({ facility, inputs, benchmark, priorYearQuintiles });
        const topOpportunity = getTopOpportunity(scored);
        const hasInvalidOrStale = scored.perMeasure.some(
          r => r.observation.state === "invalid_input" || r.observation.state === "stale_noncomparable"
        );
        return {
          facilityId: entry.facilityId,
          name: entry.displayName || facility.name,
          city: facility.city,
          county: facility.county,
          closed: facility.closed,
          jklDeficiency: facility.jklDeficiency,
          score2023: facility.totalScore ?? null,
          quintile2023: facility.overallQuintile ?? null,
          datasetYear: dataset.year,
          coverage: scored.coverage,
          knownPoints: scored.knownEarnedPoints,
          unresolvedMax: scored.unresolvedMaxPoints,
          fullEligibleMax: scored.fullEligibleMax,
          benchmarkLabel: scored.benchmark?.label ?? null,
          topOpportunity,
          hasInvalidOrStale,
          needsData: scored.coverage.measuresKnown < scored.coverage.measuresTotal,
        };
      })
      .filter(Boolean);
  }, [portfolio, dataset]);

  return { dataset, rows, refresh: () => setPortfolio(getPortfolio()) };
}
