// NHQI scoring engine — ported from nhqi-platform.jsx, generalized for multi-facility use.
// Cut points are NOT hardcoded here: they come from the loaded dataset (src/data/nhqi_2023.json)
// and are resolved per-facility by region, since DOH regionally adjusts some measures
// (e.g. nursing staff turnover differs for MARO vs. WRO/CNYRO/CDRO).

export const SECTION_MAX = { quality: 65, compliance: 15, efficiency: 10 };
export const TOTAL_MAX = 90;

export const MEASURES = [
  {
    id: "pressure_ulcer",
    short: "LS Pressure Ulcers",
    full: "% of long stay HIGH-RISK residents with pressure ulcers",
    unit: "%", higherIsBetter: false, scoring: "quintile", maxPts: 5, section: "quality",
  },
  {
    id: "weight_loss",
    short: "LS Weight Loss",
    full: "% of long stay residents who lose too much weight",
    unit: "%", higherIsBetter: false, scoring: "quintile", maxPts: 5, section: "quality",
    pointsApproximate: true,
  },
  {
    id: "falls",
    short: "LS Falls w/ Major Injury",
    full: "% of long stay residents experiencing one or more falls with major injury",
    unit: "%", higherIsBetter: false, scoring: "threshold",
    threshold: 5.0, thresholdDir: "lte", maxPts: 5, section: "quality",
    note: "5 pts if ≤5.0%",
  },
  {
    id: "depression",
    short: "LS Depressive Symptoms",
    full: "% of long stay residents who have depressive symptoms",
    unit: "%", higherIsBetter: false, scoring: "quintile", maxPts: 5, section: "quality",
    pointsApproximate: true,
  },
  {
    id: "adl",
    short: "LS ADL Increase",
    full: "% of long stay residents whose need for help with ADLs has increased",
    unit: "%", higherIsBetter: false, scoring: "quintile", maxPts: 5, section: "quality",
  },
  {
    id: "uti",
    short: "LS UTI",
    full: "% of long stay residents with a urinary tract infection",
    unit: "%", higherIsBetter: false, scoring: "threshold",
    threshold: 5.0, thresholdDir: "lte", maxPts: 5, section: "quality",
    note: "5 pts if ≤5.0%",
  },
  {
    id: "incontinence",
    short: "LS Bowel/Bladder Loss",
    full: "% of long stay LOW-RISK residents who lose control of bowel or bladder",
    unit: "%", higherIsBetter: false, scoring: "quintile", maxPts: 5, section: "quality",
  },
  {
    id: "pneumo_vax",
    short: "LS Pneumococcal Vaccine",
    full: "% of long stay residents who received the pneumococcal vaccine",
    unit: "%", higherIsBetter: true, scoring: "quintile", maxPts: 5, section: "quality",
    pointsApproximate: true,
  },
  {
    id: "flu_vax_resident",
    short: "LS Resident Flu Vaccine",
    full: "% of long stay residents who received the seasonal influenza vaccine",
    unit: "%", higherIsBetter: true, scoring: "quintile", maxPts: 5, section: "quality",
    pointsApproximate: true,
  },
  {
    id: "contract_staff",
    short: "Contract/Agency Staff",
    full: "% of contract/agency staff used",
    unit: "%", higherIsBetter: false, scoring: "threshold",
    threshold: 10.0, thresholdDir: "lt", maxPts: 5, section: "quality",
    note: "5 pts if <10%",
  },
  {
    id: "flu_vax_staff",
    short: "Staff Flu Vaccination",
    full: "% of employees vaccinated for the flu",
    unit: "%", higherIsBetter: true, scoring: "quintile", maxPts: 5, section: "quality",
    pointsApproximate: true,
  },
  {
    id: "hprd",
    short: "Staffing Hours / Resident Day",
    full: "Rate of staffing hours per resident per day (NY case-mix adjusted)",
    unit: "hrs", higherIsBetter: true, scoring: "quintile", maxPts: 5, section: "quality",
  },
  {
    id: "turnover",
    short: "Nursing Staff Turnover",
    full: "% of nursing staff that left the nursing home over twelve months",
    unit: "%", higherIsBetter: false, scoring: "quintile", maxPts: 5, section: "quality",
    note: "Cut points are regionally adjusted by DOH office (WRO/CNYRO/CDRO vs. MARO differ)",
    pointsApproximate: true,
  },
  {
    id: "health_inspect",
    short: "Health Inspection Stars (NY)",
    full: "NYS regionally adjusted five-star quality rating for health inspections",
    unit: "★", higherIsBetter: true, scoring: "star_map", maxPts: 10, section: "compliance",
    note: "5★=10 · 4★=7 · 3★=4 · 2★=2 · 1★=0",
    starMap: { 5: 10, 4: 7, 3: 4, 2: 2, 1: 0 },
  },
  {
    id: "flu_timely",
    short: "Flu Data Submission",
    full: "Timely submission of employee influenza immunization data",
    unit: "", scoring: "binary", maxPts: 5, section: "compliance",
    note: "5 pts if submitted on time",
  },
  {
    id: "pah",
    short: "Potentially Avoidable Hospitalizations",
    full: "Potentially avoidable hospitalizations per 10,000 long stay days",
    unit: "/10k days", higherIsBetter: false, scoring: "quintile_pah", maxPts: 10, section: "efficiency",
    note: "Q1=10 · Q2=8 · Q3=6 · Q4=2 · Q5=0 · Cannot be self-tracked — requires DOH's MDS→SPARCS match",
  },
];

export const MEASURE_BY_ID = Object.fromEntries(MEASURES.map(m => [m.id, m]));

// Resolve a measure's cut points for a given facility region from the loaded dataset.
export function getCutpoints(dataset, measureId, region) {
  const entry = dataset?.measures?.[measureId];
  if (!entry) return [];
  return entry.cutpoints[region] || entry.cutpoints.default || [];
}

export function getQuintile(m, val, cutpoints) {
  if (val === "" || val === null || val === undefined) return null;
  const v = parseFloat(val);
  if (isNaN(v) || !cutpoints || cutpoints.length < 4) return null;
  if (m.higherIsBetter) {
    if (v >= cutpoints[0]) return 1;
    if (v >= cutpoints[1]) return 2;
    if (v >= cutpoints[2]) return 3;
    if (v >= cutpoints[3]) return 4;
    return 5;
  } else {
    if (v <= cutpoints[0]) return 1;
    if (v <= cutpoints[1]) return 2;
    if (v <= cutpoints[2]) return 3;
    if (v <= cutpoints[3]) return 4;
    return 5;
  }
}

export function getPoints(m, val, starVal, binaryVal, cutpoints) {
  if (m.scoring === "quintile") {
    const q = getQuintile(m, val, cutpoints);
    if (q === null) return null;
    return [5, 3, 1, 0, 0][q - 1];
  }
  if (m.scoring === "quintile_pah") {
    const q = getQuintile(m, val, cutpoints);
    if (q === null) return null;
    return [10, 8, 6, 2, 0][q - 1];
  }
  if (m.scoring === "threshold") {
    if (val === "" || val === null || val === undefined) return null;
    const v = parseFloat(val);
    if (isNaN(v)) return null;
    return m.thresholdDir === "lte" ? (v <= m.threshold ? m.maxPts : 0) : (v < m.threshold ? m.maxPts : 0);
  }
  if (m.scoring === "star_map") {
    if (!starVal) return null;
    return m.starMap[parseInt(starVal)] ?? null;
  }
  if (m.scoring === "binary") {
    if (!binaryVal) return null;
    return binaryVal === "yes" ? m.maxPts : 0;
  }
  return null;
}

export function getGapToNext(m, val, q, cutpoints) {
  if (!q || q <= 1) return null;
  const v = parseFloat(val);
  if (isNaN(v) || !cutpoints) return null;
  const target = cutpoints[q - 2];
  if (target === undefined) return null;
  return { gap: Math.abs(m.higherIsBetter ? target - v : v - target), target };
}

// Sum an actuals object (measureId -> {value, quintile, points}) to a total score out of 90.
export function totalFromActuals(actuals) {
  return MEASURES.reduce((acc, m) => acc + (actuals[m.id]?.points ?? 0), 0);
}

export function sectionScore(actuals, section) {
  return MEASURES.filter(m => m.section === section)
    .reduce((acc, m) => acc + (actuals[m.id]?.points ?? 0), 0);
}

export function estimateQuintile(totalPts) {
  const pct = (totalPts / TOTAL_MAX) * 100;
  return pct >= 80 ? 1 : pct >= 60 ? 2 : pct >= 40 ? 3 : pct >= 20 ? 4 : 5;
}

// Computes a facility's 2023 actual vs. entered full-year projection summary,
// used by both the Portfolio table and the per-facility Dashboard tab.
export function computeFacilitySummary(dataset, facility, inputs) {
  const score2023 = facility.totalScore ?? totalFromActuals(facility.actuals);
  const quintile2023 = facility.overallQuintile ?? null;

  const vals = inputs?.vals ?? {};
  const starVals = inputs?.starVals ?? {};
  const binaryVals = inputs?.binaryVals ?? {};

  let score2025 = 0, entered = 0;
  for (const m of MEASURES) {
    const cutpoints = getCutpoints(dataset, m.id, facility.region);
    const p = getPoints(m, vals[m.id], starVals[m.id], binaryVals[m.id], cutpoints);
    if (p !== null) { score2025 += p; entered++; }
  }

  const round1 = n => Math.round(n * 10) / 10;
  const hasEntries = entered > 0;
  return {
    score2023,
    quintile2023,
    score2025: hasEntries ? score2025 : null,
    entered,
    quintile2027: hasEntries ? estimateQuintile(score2025) : null,
    ptsDelta: hasEntries ? round1(score2025 - score2023) : null,
  };
}
