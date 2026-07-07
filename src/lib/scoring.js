// NHQI scoring engine — ported from nhqi-platform.jsx, generalized for multi-facility use.
// Cut points are NOT hardcoded here: they come from the loaded dataset (src/data/nhqi_2023.json)
// and are resolved per-facility by region, since DOH regionally adjusts some measures
// (e.g. nursing staff turnover differs for MARO vs. WRO/CNYRO/CDRO).
//
// This module deliberately has no dependency on cmsAutofill.js (which does a bare
// `import cmsData from "../data/cms_autofill.json"`) — scripts/fetch-cms-data.mjs
// imports MEASURES from here under plain Node ESM, where a bare JSON import throws
// ERR_IMPORT_ATTRIBUTE_MISSING. The "live" CMS cut points are instead passed in by
// the caller (a `getLiveCutpoints(measureId)` lookup) rather than imported directly.

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
    note: "Q1=10 · Q2=8 · Q3=6 · Q4=2 · Q5=0",
    notTrackable: true,
    notTrackableNote: "Cannot be self-tracked — requires DOH's MDS→SPARCS claims match, which is only available when DOH publishes the next NHQI cycle. Rather than guess, it's excluded entirely from your current projection (scored out of 80, not 90) — the facility's last recorded score is shown here for reference only. DOH's real cycle will still include PAH once calculated.",
  },
];

export const MEASURE_BY_ID = Object.fromEntries(MEASURES.map(m => [m.id, m]));

// Points available from measures that CAN actually be entered for a 2025 projection
// (excludes PAH, which requires DOH's MDS→SPARCS match and can't be self-tracked).
export const TRACKABLE_MEASURES = MEASURES.filter(m => !m.notTrackable);
export const TRACKABLE_MAX = TRACKABLE_MEASURES.reduce((a, m) => a + m.maxPts, 0);

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
    // Strict ">", not ">=" — verified against DOH's own published per-row
    // Quintile/Points values for every higherIsBetter measure (2,053 rows,
    // 0 mismatches): a value exactly at a cutpoint boundary lands in the
    // lower quintile, not the upper one (e.g. HPRD Q1/Q2 boundary is 4.0 —
    // a facility at exactly 4.0 is Q2, not Q1; only values >4.0 are Q1).
    if (v > cutpoints[0]) return 1;
    if (v > cutpoints[1]) return 2;
    if (v > cutpoints[2]) return 3;
    if (v > cutpoints[3]) return 4;
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

export function estimateQuintile(totalPts, max = TOTAL_MAX) {
  const pct = (totalPts / max) * 100;
  return pct >= 80 ? 1 : pct >= 60 ? 2 : pct >= 40 ? 3 : pct >= 20 ? 4 : 5;
}

// 2025 points for a single trackable measure (returns null for PAH — see
// computeFacilitySummary for why it's excluded from the projection rather than
// carried forward from its last recorded value).
export function getDisplayed2025Points(dataset, facility, m, vals, starVals, binaryVals) {
  if (m.notTrackable) return null;
  const cutpoints = getCutpoints(dataset, m.id, facility.region);
  return getPoints(m, vals[m.id], starVals[m.id], binaryVals[m.id], cutpoints);
}

// Computes a facility's 2023 actual vs. entered full-year projection summary,
// used by both the Portfolio table and the per-facility Dashboard tab.
//
// PAH (and any other notTrackable measure) is excluded from the 2025 projection
// entirely rather than carrying forward its last recorded score — a stale number
// isn't a real projection of 2025 performance, and silently folding it in would
// misrepresent both the projected total and the improvement delta. So score2025
// is out of TRACKABLE_MAX (80, not 90), and ptsDelta compares like-for-like by
// also stripping PAH out of the 2023 side.
//
// `getLiveCutpoints` is the caller's cmsAutofill.js lookup (see module note
// above). The live track scores the SAME entered `vals` as the DOH track,
// out of the SAME TRACKABLE_MAX total, so the two are directly comparable —
// just ranked against the live NY-wide cut points instead of the frozen DOH
// ones wherever a live split actually exists. For measures with no live
// equivalent (threshold/star/binary scoring, which aren't quintile splits at
// all, or a quintile measure with no CMS data to derive a split from — e.g.
// staff flu vaccination), the DOH-computed points carry over into the live
// total unchanged: there's no "live version" of a pass/fail threshold or a
// five-star rating, so both tracks agree on those measures by construction.
export function computeFacilitySummary(dataset, facility, inputs, getLiveCutpoints) {
  // facility.totalScore is DOH's published score: (points earned / max
  // attainable) x 100, NOT a raw point sum out of 90. Max attainable shrinks
  // below 90 when DOH excludes a measure for small sample size (marked "SS"
  // in actuals) — so this is a normalized 0-100 figure, always comparable
  // across facilities, not "points out of 90". Verified against real data:
  // a facility with SS-excluded measures and 50 raw points out of an
  // adjusted 75-point max published totalScore 66.7 (=50/75x100), not 50/90.
  const score2023 = facility.totalScore ?? totalFromActuals(facility.actuals);
  const quintile2023 = facility.overallQuintile ?? null;
  // ptsDelta needs to compare like-for-like raw point totals against
  // score2025 (also raw points), so it's built from totalFromActuals (raw
  // points), not from the normalized score2023 above — subtracting PAH's
  // raw points from a 0-100 normalized figure would mix units.
  const score2023Trackable = totalFromActuals(facility.actuals) - MEASURES
    .filter(m => m.notTrackable)
    .reduce((a, m) => a + (facility.actuals[m.id]?.points ?? 0), 0);

  const vals = inputs?.vals ?? {};
  const starVals = inputs?.starVals ?? {};
  const binaryVals = inputs?.binaryVals ?? {};

  let score2025 = 0, entered = 0;
  let score2025Live = 0;
  for (const m of TRACKABLE_MEASURES) {
    const cutpoints = getCutpoints(dataset, m.id, facility.region);
    const p = getPoints(m, vals[m.id], starVals[m.id], binaryVals[m.id], cutpoints);
    if (p !== null) { score2025 += p; entered++; }

    const liveCutpoints = (m.scoring === "quintile" && getLiveCutpoints) ? getLiveCutpoints(m.id) : null;
    if (liveCutpoints) {
      const pLive = getPoints(m, vals[m.id], null, null, liveCutpoints);
      if (pLive !== null) score2025Live += pLive;
    } else if (p !== null) {
      score2025Live += p;
    }
  }
  const liveMax = TRACKABLE_MAX;

  const hasEntries = entered > 0;
  const round1 = n => Math.round(n * 10) / 10;
  return {
    score2023,
    // Same raw-point basis as score2025 (TRACKABLE_MAX, PAH excluded) — use
    // this, not score2023, when displaying a 2023 figure next to score2025.
    // score2023 is DOH's normalized 0-100 score across all measures
    // including PAH; it isn't on the same scale and can't be compared to
    // score2025 directly.
    score2023Trackable,
    quintile2023,
    // Facilities with a J/K/L (immediate jeopardy) health inspection
    // deficiency are excluded from NHQI quintile ranking entirely per DOH's
    // methodology — surfaced so the UI can flag that this facility's
    // quintile isn't part of the official ranked pool.
    jklDeficiency: !!facility.jklDeficiency,
    score2025: hasEntries ? score2025 : null,
    entered,
    quintile2027: hasEntries ? estimateQuintile(score2025, TRACKABLE_MAX) : null,
    ptsDelta: hasEntries ? round1(score2025 - score2023Trackable) : null,
    // "Live" track: same entered values and same total (TRACKABLE_MAX), just
    // ranked against the live NY-wide quintile benchmark instead of the frozen
    // DOH cut points wherever a live split exists — a directional second
    // opinion, not a DOH-certified figure.
    score2025Live: hasEntries ? score2025Live : null,
    liveMax,
    quintile2027Live: hasEntries ? estimateQuintile(score2025Live, liveMax) : null,
  };
}
