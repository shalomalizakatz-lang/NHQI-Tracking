// Converts a quintile measure's remaining gap (percentage points, or hours
// for hprd) into a concrete, facility-sized action plan — e.g. "≈3 fewer
// residents with pressure ulcers" instead of just "5.5% improvement needed".
//
// Uses the facility's average daily census (CMS Provider Info's "Average
// Number of Residents per Day") as the denominator. That's a proxy, not an
// exact match — NHQI's measures are defined over the long-stay resident
// cohort specifically, and CMS's census figure covers all residents — so
// this is a reasonable estimate, not a precise headcount.
//
// Measures whose denominator is staff (turnover, flu_vax_staff) return null:
// converting "% of nursing staff that left" into a headcount would need a
// total staff count, which isn't data this app has access to.

const RESIDENT_OUTCOME_LABELS = {
  pressure_ulcer: r => `fewer ${r} with pressure ulcers`,
  weight_loss: r => `fewer ${r} losing significant weight`,
  depression: r => `fewer ${r} with depressive symptoms`,
  adl: r => `fewer ${r} needing increased ADL help`,
  incontinence: r => `fewer ${r} with new/worsened incontinence`,
  pneumo_vax: r => `more ${r} vaccinated (pneumococcal)`,
  flu_vax_resident: r => `more ${r} vaccinated (flu)`,
};

export function getActionPlan(m, gapInfo, census) {
  if (!gapInfo || !census || census <= 0) return null;

  const labelFor = RESIDENT_OUTCOME_LABELS[m.id];
  if (labelFor) {
    const n = Math.round(census * (gapInfo.gap / 100));
    if (n < 1) return null;
    return `≈${n} ${labelFor(n === 1 ? "resident" : "residents")}`;
  }

  if (m.id === "hprd") {
    const hoursPerDay = Math.round(gapInfo.gap * census * 10) / 10;
    if (hoursPerDay < 0.1) return null;
    const fte = Math.round(hoursPerDay / 8);
    return `≈${hoursPerDay} more staffing hrs/day (~${fte} FTE)`;
  }

  return null;
}
