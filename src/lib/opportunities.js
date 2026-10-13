// Shared "what's a real, positive point opportunity" selection -- wraps
// getNextTierGain() from the trust-layer scorer (src/lib/nhqi/scorer.js) and
// never recomputes points itself. Lives outside src/lib/nhqi/ on purpose, so
// that directory stays visibly untouched by this redesign pass. Used by
// PriorityList.jsx, pdfExport.jsx, and Portfolio's per-row "next opportunity"
// column/card field, which previously each had their own copy of this filter.
import { getNextTierGain } from "./nhqi/scorer.js";

// Only quintile-scored measures (standard or PAH) above the top tier can have
// a *supported* next-quintile gain; a Q5-to-Q4 attainment-only step earns
// nothing unless getNextTierGain's underlying improvement rule says so --
// that's enforced by getNextTierGain itself, this just filters to candidates.
export function getAllOpportunities(scored) {
  return scored.perMeasure
    .filter(
      r =>
        (r.measure.scoringRule === "quintile" || r.measure.scoringRule === "quintile_pah") &&
        r.currentQuintile &&
        r.currentQuintile > 1
    )
    .map(row => ({ row, gain: getNextTierGain(row) }))
    .filter(x => x.gain !== null && x.gain > 0)
    .sort((a, b) => b.gain - a.gain);
}

export function getTopOpportunity(scored) {
  return getAllOpportunities(scored)[0] ?? null;
}

// Measures with an unresolved input -- nothing to score yet, not a gain.
export function getMissingEvidence(scored) {
  return scored.perMeasure.filter(
    r => r.observation.state === "missing_input" || r.observation.state === "invalid_input"
  );
}
