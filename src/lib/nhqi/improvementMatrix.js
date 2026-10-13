// 2025 Quality Attainment + Improvement matrix — verbatim from the requester's brief
// (relayed from the published 2025 NHQI methodology; not independently re-fetched, see
// measures/2025.js header for why). Rows = current-cycle quintile (1=best..5=worst),
// columns = prior-cycle quintile (1=best..5=worst). This table IS the full point award for
// an improvement-eligible measure — it already subsumes flat attainment (the diagonal and
// the Q1 row match attainment.js's ATTAINMENT_TABLES[2025].quintile exactly), so it's not
// something added on top of the flat table.

import { MEASURE_2025_BY_ID } from "./measures/2025.js";

const MATRIX_2025 = [
  // prior:   Q1  Q2  Q3  Q4  Q5
  /* cur Q1 */[5, 5, 5, 5, 5],
  /* cur Q2 */[3, 3, 4, 4, 4],
  /* cur Q3 */[1, 1, 1, 2, 2],
  /* cur Q4 */[0, 0, 0, 0, 1],
  /* cur Q5 */[0, 0, 0, 0, 0],
];

export const IMPROVEMENT_MATRICES = { 2025: MATRIX_2025 };

export function isImprovementEligible(cycle, measureId) {
  if (cycle !== "2025") return false;
  return !!MEASURE_2025_BY_ID[measureId]?.improvementEligible;
}

// Returns the final attainment+improvement point award for a quintile-scored measure.
//
// - Measure not improvement-eligible this cycle -> caller should use the flat attainment
//   table directly (attainment.js); this function returns null + reason to make that explicit
//   rather than silently falling through.
// - Eligible, but prior-year quintile unknown -> { points: null, unresolved: true } — NEVER
//   fabricates a value (no blanket +1, no inferring from a non-equivalent old metric).
// - Eligible, prior known -> the matrix cell.
export function getAttainmentAward(cycle, measureId, currentQuintile, priorQuintile) {
  if (!currentQuintile || currentQuintile < 1 || currentQuintile > 5) {
    return { points: null, unresolved: true, reason: "current-cycle quintile unavailable" };
  }
  const matrix = IMPROVEMENT_MATRICES[cycle];
  if (!matrix) {
    return { points: null, unresolved: true, reason: `no improvement matrix sourced for cycle ${cycle}` };
  }
  if (!isImprovementEligible(cycle, measureId)) {
    return { points: null, unresolved: false, reason: "not improvement-eligible this cycle — use flat attainment table" };
  }
  if (!priorQuintile || priorQuintile < 1 || priorQuintile > 5) {
    return { points: null, unresolved: true, reason: "prior-year quintile unavailable" };
  }
  return { points: matrix[currentQuintile - 1][priorQuintile - 1], unresolved: false, reason: null };
}
