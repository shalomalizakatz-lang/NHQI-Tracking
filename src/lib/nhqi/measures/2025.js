// NHQI 2025 cycle measure definitions (methodology updated January 2026).
//
// SOURCE STATUS: the authoritative pages (health.ny.gov/.../nhqi/2025/methodology.htm and
// cms.gov/medicare/quality/nursing-home-improvement/quality-measures) were NOT reachable from
// this environment — both resolved ENOTFOUND (the sandbox's standing .gov network block).
// Every coefficient below (attainment table, improvement matrix, thresholds, point maps,
// measurement periods) was supplied directly by the requester as the published 2025 rule set,
// not independently re-fetched or re-derived here. Fields marked `sourceEvidence:
// "gov_unreachable_unverified"` are taken as given rather than cross-checked against the
// primary source. Do not silently extend this file's rules to any other cycle — a 2023 or
// 2024 measure definition needs its own file with its own verified coefficients.
//
// Measure ids are shared with the legacy src/lib/scoring.js MEASURES list (same facilities,
// same dataset keys) so this file can be read alongside facility.actuals[id] and the bundled
// DOH cutpoints without a remapping layer.

export const CYCLE = "2025";

// Boundary convention for quintile-scored measures is shared with scoring.js's getQuintile():
// strict ">" for higherIsBetter (a value exactly at a cutpoint lands in the LOWER quintile),
// inclusive "<=" for lowerIsBetter. Verified against DOH's own published per-row 2023
// Quintile/Points columns (5,070 rows, 0 mismatches) — that verification is about the
// *comparison operator*, which this cycle's definitions reuse; it says nothing about whether
// 2025's own cutpoint values match 2023's (they don't — cutpoints come from the loaded
// dataset, not this file).

const GOV_UNVERIFIED = "gov_unreachable_unverified";
const USER_SUPPLIED = "user_supplied_2025_methodology";

export const MEASURES_2025 = [
  {
    id: "pressure_ulcer",
    officialName: "Percentage of long-stay high-risk residents with pressure ulcers",
    displayName: "LS Pressure Ulcers",
    unit: "%", higherIsBetter: false,
    adjustmentBasis: "ny_adjusted", // NY risk-adjusts this measure (brief §4) — exact coefficients not sourced
    scoringRule: "quintile", maxPoints: 5, section: "quality",
    measurementPeriod: { start: "2024-01-01", end: "2024-12-31", label: "Calendar year 2024 (MDS)", source: GOV_UNVERIFIED },
    improvementEligible: false, // 2025: replaced measure, no improvement credit this cycle
    applicability: { note: "Replaced measure for 2025 — attainment only, no improvement matrix.", evidence: USER_SUPPLIED },
    benchmarkCohort: { description: "NY eligible nursing facilities, 2025 cycle cutpoints", evidence: GOV_UNVERIFIED },
  },
  {
    id: "incontinence",
    officialName: "Percentage of long-stay low-risk residents who lose control of bowel or bladder",
    displayName: "LS Bowel/Bladder Loss",
    unit: "%", higherIsBetter: false,
    adjustmentBasis: "ny_adjusted", // NY risk-adjusts (brief §4)
    scoringRule: "quintile", maxPoints: 5, section: "quality",
    measurementPeriod: { start: "2024-01-01", end: "2024-12-31", label: "Calendar year 2024 (MDS)", source: GOV_UNVERIFIED },
    improvementEligible: false, // 2025: replaced measure, no improvement credit this cycle
    applicability: { note: "Replaced measure for 2025 — attainment only, no improvement matrix.", evidence: USER_SUPPLIED },
    benchmarkCohort: { description: "NY eligible nursing facilities, 2025 cycle cutpoints", evidence: GOV_UNVERIFIED },
  },
  {
    id: "weight_loss",
    officialName: "Percentage of long-stay residents who lose too much weight",
    displayName: "LS Weight Loss",
    unit: "%", higherIsBetter: false,
    adjustmentBasis: "raw",
    scoringRule: "quintile", maxPoints: 5, section: "quality",
    measurementPeriod: { start: "2024-01-01", end: "2024-12-31", label: "Calendar year 2024 (MDS)", source: GOV_UNVERIFIED },
    improvementEligible: true,
    benchmarkCohort: { description: "NY eligible nursing facilities, 2025 cycle cutpoints", evidence: GOV_UNVERIFIED },
  },
  {
    id: "depression",
    officialName: "Percentage of long-stay residents who have depressive symptoms",
    displayName: "LS Depressive Symptoms",
    unit: "%", higherIsBetter: false,
    adjustmentBasis: "raw",
    scoringRule: "quintile", maxPoints: 5, section: "quality",
    measurementPeriod: { start: "2024-01-01", end: "2024-12-31", label: "Calendar year 2024 (MDS)", source: GOV_UNVERIFIED },
    improvementEligible: true,
    benchmarkCohort: { description: "NY eligible nursing facilities, 2025 cycle cutpoints", evidence: GOV_UNVERIFIED },
  },
  {
    id: "adl",
    officialName: "Percentage of long-stay residents whose need for help with ADLs has increased",
    displayName: "LS ADL Increase",
    unit: "%", higherIsBetter: false,
    adjustmentBasis: "raw",
    scoringRule: "quintile", maxPoints: 5, section: "quality",
    measurementPeriod: { start: "2024-01-01", end: "2024-12-31", label: "Calendar year 2024, four-quarter basis resumed for 2025 (MDS)", source: USER_SUPPLIED },
    improvementEligible: false, // 2025: resumes four-quarter periods, no improvement credit this cycle
    benchmarkCohort: { description: "NY eligible nursing facilities, 2025 cycle cutpoints", evidence: GOV_UNVERIFIED },
  },
  {
    id: "pneumo_vax",
    officialName: "Percentage of long-stay residents who received the pneumococcal vaccine",
    displayName: "LS Pneumococcal Vaccine",
    unit: "%", higherIsBetter: true,
    adjustmentBasis: "raw",
    scoringRule: "quintile", maxPoints: 5, section: "quality",
    measurementPeriod: { start: "2024-01-01", end: "2024-12-31", label: "Calendar year 2024 (MDS)", source: GOV_UNVERIFIED },
    improvementEligible: true,
    benchmarkCohort: { description: "NY eligible nursing facilities, 2025 cycle cutpoints", evidence: GOV_UNVERIFIED },
  },
  {
    id: "flu_vax_resident",
    officialName: "Percentage of long-stay residents who received the seasonal influenza vaccine",
    displayName: "LS Resident Flu Vaccine",
    unit: "%", higherIsBetter: true,
    adjustmentBasis: "raw",
    scoringRule: "quintile", maxPoints: 5, section: "quality",
    measurementPeriod: { start: "2023-10-01", end: "2024-06-30", label: "Oct 1, 2023 – Jun 30, 2024 flu season (MDS)", source: USER_SUPPLIED },
    improvementEligible: true,
    benchmarkCohort: { description: "NY eligible nursing facilities, 2025 cycle cutpoints", evidence: GOV_UNVERIFIED },
  },
  {
    id: "contract_staff",
    officialName: "Percentage of contract/agency staff used",
    displayName: "Contract/Agency Staff",
    unit: "%", higherIsBetter: false,
    adjustmentBasis: "raw",
    scoringRule: "threshold", threshold: 10.0, thresholdDir: "lt", maxPoints: 5, section: "quality",
    note: "5 pts if <10%, else 0",
    measurementPeriod: { start: "2024-01-01", end: "2024-12-31", label: "Four 2024 PBJ quarters", source: USER_SUPPLIED },
    improvementEligible: false, // threshold measures: no improvement credit
    benchmarkCohort: null, // single fixed cutoff, not a peer-ranked cutpoint
  },
  {
    id: "flu_vax_staff",
    officialName: "Percentage of employees vaccinated for the flu",
    displayName: "Staff Flu Vaccination",
    unit: "%", higherIsBetter: true,
    adjustmentBasis: "raw",
    scoringRule: "quintile", maxPoints: 5, section: "quality",
    measurementPeriod: { start: "2024-10-01", end: "2025-03-31", label: "2024–25 staff flu season", source: USER_SUPPLIED },
    improvementEligible: true,
    benchmarkCohort: { description: "NY eligible nursing facilities, 2025 cycle cutpoints", evidence: GOV_UNVERIFIED },
  },
  {
    id: "hprd",
    officialName: "Rate of staffing hours per resident per day",
    displayName: "Staffing Hours / Resident Day",
    unit: "hrs", higherIsBetter: true,
    adjustmentBasis: "ny_adjusted", // NY case-mix adjusted
    scoringRule: "quintile", maxPoints: 5, section: "quality",
    measurementPeriod: { start: "2024-01-01", end: "2024-12-31", label: "2024, four-quarter PBJ basis resumed for 2025", source: USER_SUPPLIED },
    improvementEligible: false, // 2025: resumes four-quarter periods, no improvement credit this cycle
    benchmarkCohort: { description: "NY eligible nursing facilities, 2025 cycle cutpoints", evidence: GOV_UNVERIFIED },
  },
  {
    id: "turnover",
    officialName: "Percentage of nursing staff that left the nursing home over twelve months",
    displayName: "Nursing Staff Turnover",
    unit: "%", higherIsBetter: false,
    adjustmentBasis: "ny_regional", // DOH regionally adjusts (WRO/CNYRO/CDRO vs MARO)
    scoringRule: "quintile", maxPoints: 5, section: "quality",
    measurementPeriod: { start: "2024-01-01", end: "2024-12-31", label: "2024 staffing/turnover basis", source: USER_SUPPLIED },
    improvementEligible: true,
    benchmarkCohort: { description: "NY eligible nursing facilities, 2025 cycle cutpoints, regionally adjusted", evidence: GOV_UNVERIFIED },
  },
  {
    id: "uti",
    officialName: "Percentage of long-stay residents with a urinary tract infection",
    displayName: "LS UTI",
    unit: "%", higherIsBetter: false,
    adjustmentBasis: "raw",
    scoringRule: "threshold", threshold: 5.0, thresholdDir: "lte", maxPoints: 5, section: "quality",
    note: "5 pts if ≤5.0%, else 0",
    measurementPeriod: { start: "2024-01-01", end: "2024-12-31", label: "Calendar year 2024 (MDS)", source: GOV_UNVERIFIED },
    improvementEligible: false,
    benchmarkCohort: null,
  },
  {
    id: "falls",
    officialName: "Percentage of long-stay residents experiencing one or more falls with major injury",
    displayName: "LS Falls w/ Major Injury",
    unit: "%", higherIsBetter: false,
    adjustmentBasis: "raw",
    scoringRule: "threshold", threshold: 5.0, thresholdDir: "lte", maxPoints: 5, section: "quality",
    note: "5 pts if ≤5.0%, else 0",
    measurementPeriod: { start: "2024-01-01", end: "2024-12-31", label: "Calendar year 2024 (MDS)", source: GOV_UNVERIFIED },
    improvementEligible: false,
    benchmarkCohort: null,
  },
  {
    id: "health_inspect",
    officialName: "NY regionally adjusted health inspection star rating",
    displayName: "Health Inspection Stars (NY)",
    unit: "★", higherIsBetter: true,
    adjustmentBasis: "ny_regional",
    scoringRule: "star_map", maxPoints: 10, section: "compliance",
    starMap: { 5: 10, 4: 7, 3: 4, 2: 2, 1: 0 },
    note: "Must be the NY regionally adjusted rating for the applicable snapshot, not the headline national CMS star.",
    measurementPeriod: { start: "2025-04-01", end: "2025-04-30", label: "April 2025 inspection snapshot", source: USER_SUPPLIED },
    improvementEligible: false,
    benchmarkCohort: null,
  },
  {
    id: "flu_timely",
    officialName: "Timely submission of employee influenza immunization data",
    displayName: "Flu Data Submission",
    unit: "", higherIsBetter: true,
    adjustmentBasis: "raw",
    scoringRule: "binary", maxPoints: 5, section: "compliance",
    note: "5 pts if submitted on time; verified late/no = 0 pts; unanswered is unknown, not 0.",
    measurementPeriod: { start: "2024-10-01", end: "2025-03-31", label: "2024–25 staff flu season submission window", source: USER_SUPPLIED },
    improvementEligible: false,
    benchmarkCohort: null,
  },
  {
    id: "pah",
    officialName: "Potentially avoidable hospitalizations per 10,000 long-stay days",
    displayName: "Potentially Avoidable Hospitalizations",
    unit: "/10k days", higherIsBetter: false,
    adjustmentBasis: "ny_adjusted", // risk-adjusted quarterly MDS + SPARCS match, averaged annually
    scoringRule: "quintile_pah", maxPoints: 10, section: "efficiency",
    pahPointMap: [10, 8, 6, 2, 0], // quintile 1..5
    measurementPeriod: { start: null, end: null, label: "Not specified in source brief — period unresolved", source: "unresolved" },
    improvementEligible: false,
    applicability: {
      note: "Cannot be self-tracked — requires DOH's quarterly MDS→SPARCS claims match, averaged annually. A facility's own hospitalization log is NOT official PAH. Only DOH's published cycle result or an explicitly labeled sensitivity scenario (one of the five supported point awards: 0/2/6/8/10) may be shown — never a silent zero, carry-forward, or exclusion presented as the complete official outcome.",
      evidence: USER_SUPPLIED,
    },
    benchmarkCohort: { description: "NY eligible nursing facilities, 2025 cycle PAH quintiles", evidence: GOV_UNVERIFIED },
  },
];

export const MEASURE_2025_BY_ID = Object.fromEntries(MEASURES_2025.map(m => [m.id, m]));

// Measures eligible for the 2025 attainment+improvement matrix (src/lib/nhqi/improvementMatrix.js).
export const IMPROVEMENT_ELIGIBLE_2025 = MEASURES_2025.filter(m => m.improvementEligible).map(m => m.id);

export const SECTION_MAX_2025 = { quality: 65, compliance: 15, efficiency: 10 };
export const TOTAL_MAX_2025 = 90;
export const TRACKABLE_MEASURES_2025 = MEASURES_2025.filter(m => m.id !== "pah");
export const TRACKABLE_MAX_2025 = TRACKABLE_MEASURES_2025.reduce((a, m) => a + m.maxPoints, 0);
