import { describe, it, expect } from "vitest";
import { scoreFacility, getGapToNextQuintile, buildPriorYearQuintilesFrom2023Actuals, getNextTierGain, CYCLE } from "./scorer.js";
import { official2023Benchmark } from "./benchmarks.js";
import { MEASURE_2025_BY_ID } from "./measures/2025.js";

const nhqi2023 = (await import("../../data/nhqi_2023.json", { with: { type: "json" } })).default;

function fakeBenchmark(cutpointsByMeasure, overrides = {}) {
  return { id: "fake", label: "Test benchmark", asOf: "test", getCutpoints: id => cutpointsByMeasure[id] || null, ...overrides };
}

function highlandFacility() {
  return nhqi2023.facilities.find(f => f.id === "1711");
}

describe("quintile boundary precision — strict (higherIsBetter) vs inclusive (lowerIsBetter)", () => {
  it("higherIsBetter: a value exactly at the boundary lands in the LOWER quintile (strict >)", () => {
    const bench = fakeBenchmark({ hprd: [4, 3.5, 3.3, 3] });
    const r = scoreFacility({
      facility: { actuals: {} },
      inputs: { vals: { hprd: "4" } }, // exactly at the Q1/Q2 boundary
      benchmark: bench,
    });
    const hprd = r.perMeasure.find(m => m.measure.id === "hprd");
    expect(hprd.currentQuintile).toBe(2); // NOT 1
  });
  it("higherIsBetter: just above the boundary IS the upper quintile", () => {
    const bench = fakeBenchmark({ hprd: [4, 3.5, 3.3, 3] });
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { hprd: "4.01" } }, benchmark: bench });
    expect(r.perMeasure.find(m => m.measure.id === "hprd").currentQuintile).toBe(1);
  });
  it("lowerIsBetter: a value exactly at the boundary lands in the UPPER (better) quintile (inclusive <=)", () => {
    const bench = fakeBenchmark({ adl: [10, 12, 16, 19] });
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { adl: "10" } }, benchmark: bench });
    expect(r.perMeasure.find(m => m.measure.id === "adl").currentQuintile).toBe(1);
  });
  it("lowerIsBetter: just above the boundary falls to the next quintile", () => {
    const bench = fakeBenchmark({ adl: [10, 12, 16, 19] });
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { adl: "10.1" } }, benchmark: bench });
    expect(r.perMeasure.find(m => m.measure.id === "adl").currentQuintile).toBe(2);
  });
});

describe('never shows "0.0 needed" at a strict boundary the facility hasn\'t actually crossed', () => {
  it("sitting exactly at a strict (>) boundary reports a real, non-zero increment needed", () => {
    const gap = getGapToNextQuintile(MEASURE_2025_BY_ID.hprd, 4.0, 2, [4, 3.5, 3.3, 3]);
    expect(gap.gap).toBeGreaterThan(0);
    expect(gap.mustStrictlyCross).toBe(true);
    expect(gap.displayTarget).toBe(">4");
  });
  it("an inclusive (<=) boundary at the exact target legitimately has zero gap (already in that quintile)", () => {
    // adl at exactly 10 is already Q1 (see above) so there's no "gap to next" to compute at all
    const gap = getGapToNextQuintile(MEASURE_2025_BY_ID.adl, 10, 1, [10, 12, 16, 19]);
    expect(gap).toBeNull(); // currentQuintile <= 1 has no "next" to show
  });
});

describe("overall quintile — no fixed 20% band mapping remains", () => {
  it("overallQuintile.modeled is always false this pass, with an explicit reason", () => {
    const bench = fakeBenchmark({});
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: {} }, benchmark: bench });
    expect(r.overallQuintile.modeled).toBe(false);
    expect(r.overallQuintile.reason).toMatch(/peer cohort/i);
  });
  it("is true even for a facility scoring the maximum on every measure", () => {
    const bench = fakeBenchmark({
      weight_loss: [1, 2, 3, 4], depression: [1, 2, 3, 4], adl: [1, 2, 3, 4], incontinence: [1, 2, 3, 4],
      pressure_ulcer: [1, 2, 3, 4], pneumo_vax: [90, 80, 70, 60], flu_vax_resident: [90, 80, 70, 60],
      flu_vax_staff: [90, 80, 70, 60], hprd: [5, 4, 3, 2], turnover: [1, 2, 3, 4],
    });
    const priorYearQuintiles = { weight_loss: 1, depression: 1, pneumo_vax: 1, flu_vax_resident: 1, flu_vax_staff: 1, turnover: 1 };
    const r = scoreFacility({
      facility: { actuals: {} },
      inputs: {
        vals: { weight_loss: 0, depression: 0, adl: 0, incontinence: 0, pressure_ulcer: 0, pneumo_vax: 100, flu_vax_resident: 100, flu_vax_staff: 100, hprd: 6, turnover: 0, uti: 0, falls: 0, contract_staff: 0 },
        starVals: { health_inspect: "5" }, binaryVals: { flu_timely: "yes" }, pahScenario: 10,
      },
      benchmark: bench,
      priorYearQuintiles,
    });
    expect(r.knownEarnedPoints).toBe(90); // confirms a genuinely maxed-out scenario (Q1 at Q1 prior = flat 5 via the matrix diagonal)
    expect(r.overallQuintile.modeled).toBe(false); // still not ranked -- no invented algorithm
  });
});

describe("missing vs true zero vs official-suppressed input, end to end", () => {
  const bench = fakeBenchmark({ weight_loss: [1, 2, 3, 4] });

  it("a blank field is unresolved (missing_input), not scored as 0 points", () => {
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { weight_loss: "" } }, benchmark: bench });
    const row = r.perMeasure.find(m => m.measure.id === "weight_loss");
    expect(row.points).toBeNull();
    expect(row.observation.state).toBe("missing_input");
    expect(r.unresolvedMaxPoints).toBeGreaterThanOrEqual(5);
  });

  it("a true zero value is scored normally, not treated as missing", () => {
    // pressure_ulcer (not improvement-eligible) isolates "is zero valid" from "is prior known"
    const bench2 = fakeBenchmark({ pressure_ulcer: [1, 2, 3, 4] });
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { pressure_ulcer: "0" } }, benchmark: bench2 });
    const row = r.perMeasure.find(m => m.measure.id === "pressure_ulcer");
    expect(row.observation.state).toBe("valid");
    expect(row.points).not.toBeNull();
  });

  it('an "SS" sentinel is suppressed_official, not 0 and not counted toward unresolved like a blank', () => {
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { weight_loss: "SS" } }, benchmark: bench });
    const row = r.perMeasure.find(m => m.measure.id === "weight_loss");
    expect(row.observation.state).toBe("suppressed_official");
    expect(row.points).toBeNull();
  });

  it("a blank field never reduces the full eligible denominator (90), only the known numerator", () => {
    const r1 = scoreFacility({ facility: { actuals: {} }, inputs: { vals: {} }, benchmark: bench });
    const r2 = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { weight_loss: "0" } }, benchmark: bench });
    expect(r1.fullEligibleMax).toBe(90);
    expect(r2.fullEligibleMax).toBe(90);
  });
});

describe("invalid / sentinel input handling", () => {
  const bench = fakeBenchmark({ weight_loss: [1, 2, 3, 4] });
  it("non-numeric text is invalid_input, never silently coerced to a score", () => {
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { weight_loss: "abc" } }, benchmark: bench });
    const row = r.perMeasure.find(m => m.measure.id === "weight_loss");
    expect(row.observation.state).toBe("invalid_input");
    expect(row.points).toBeNull();
  });
  it("a percentage outside 0-100 is invalid_input", () => {
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { weight_loss: "150" } }, benchmark: bench });
    expect(r.perMeasure.find(m => m.measure.id === "weight_loss").observation.state).toBe("invalid_input");
  });
  it("Infinity/NaN never produce a score", () => {
    const r1 = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { weight_loss: Infinity } }, benchmark: bench });
    const r2 = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { weight_loss: NaN } }, benchmark: bench });
    expect(r1.perMeasure.find(m => m.measure.id === "weight_loss").points).toBeNull();
    expect(r2.perMeasure.find(m => m.measure.id === "weight_loss").points).toBeNull();
  });
});

describe("improvement matrix wired end to end through scoreFacility", () => {
  const bench = fakeBenchmark({ weight_loss: [10, 20, 30, 40] }); // lowerIsBetter

  it("eligible measure + known prior quintile -> matrix award, not flat table", () => {
    // value 25 -> between cp[1]=20 and cp[2]=30 -> Q3 (since 25<=30, >20)
    const r = scoreFacility({
      facility: { actuals: {} },
      inputs: { vals: { weight_loss: "25" } },
      benchmark: bench,
      priorYearQuintiles: { weight_loss: 4 }, // Q3 current, Q4 prior -> matrix[2][3] = 2 (improvement bonus over flat 1)
    });
    const row = r.perMeasure.find(m => m.measure.id === "weight_loss");
    expect(row.currentQuintile).toBe(3);
    expect(row.points).toBe(2); // NOT the flat-table 1 -- improvement credit applied
    expect(row.pointsBasis).toBe("attainment_plus_improvement");
  });

  it("eligible measure + unknown prior -> unresolved, never fabricates a value", () => {
    const r = scoreFacility({
      facility: { actuals: {} },
      inputs: { vals: { weight_loss: "25" } },
      benchmark: bench,
      priorYearQuintiles: {},
    });
    const row = r.perMeasure.find(m => m.measure.id === "weight_loss");
    expect(row.points).toBeNull();
    expect(row.unresolvedReason).toMatch(/prior-year quintile unavailable/);
  });

  it("ineligible measure (pressure_ulcer) uses flat attainment regardless of prior quintile", () => {
    const bench2 = fakeBenchmark({ pressure_ulcer: [10, 20, 30, 40] });
    const r = scoreFacility({
      facility: { actuals: {} },
      inputs: { vals: { pressure_ulcer: "5" } }, // Q1
      benchmark: bench2,
      priorYearQuintiles: { pressure_ulcer: 5 }, // even with a huge "improvement" from Q5, no credit this cycle
    });
    const row = r.perMeasure.find(m => m.measure.id === "pressure_ulcer");
    expect(row.points).toBe(5); // flat table Q1 = 5, not some inflated improvement value
    expect(row.pointsBasis).toBe("flat_attainment");
  });

  it("a Q5->Q4 move on a measure with no improvement rule earns 0, not a fake point gain", () => {
    const bench2 = fakeBenchmark({ adl: [10, 20, 30, 40] }); // adl: not improvement-eligible in 2025
    const r = scoreFacility({
      facility: { actuals: {} },
      inputs: { vals: { adl: "35" } }, // between 30 and 40 -> Q4
      benchmark: bench2,
      priorYearQuintiles: { adl: 5 },
    });
    const row = r.perMeasure.find(m => m.measure.id === "adl");
    expect(row.currentQuintile).toBe(4);
    expect(row.points).toBe(0); // flat table Q4 = 0 -- the "move" from Q5 earns nothing
  });
});

describe("PAH — all five scenario point awards, plus default-unresolved and official modes", () => {
  it("default (no pahScenario given) is unresolved, not silently 0", () => {
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: {} }, benchmark: fakeBenchmark({}) });
    const pah = r.perMeasure.find(m => m.measure.id === "pah");
    expect(pah.points).toBeNull();
    expect(pah.observation.state).toBe("missing_input");
    expect(pah.unresolvedReason).toMatch(/not self-trackable/);
  });

  it.each([0, 2, 6, 8, 10])("sensitivity scenario %i is accepted and labeled as a scenario, not observed", (pts) => {
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: {}, pahScenario: pts }, benchmark: fakeBenchmark({}) });
    const pah = r.perMeasure.find(m => m.measure.id === "pah");
    expect(pah.points).toBe(pts);
    expect(pah.pointsBasis).toBe("sensitivity_scenario");
    expect(pah.scenario).toBe(pts);
  });

  it("an unsupported PAH point value is rejected, not coerced to the nearest valid one", () => {
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: {}, pahScenario: 7 }, benchmark: fakeBenchmark({}) });
    const pah = r.perMeasure.find(m => m.measure.id === "pah");
    expect(pah.points).toBeNull();
  });

  it('"official" mode uses the real bundled 2023 result, explicitly labeled as prior-cycle, not current', () => {
    const highland = highlandFacility();
    const r = scoreFacility({ facility: highland, inputs: { vals: {}, pahScenario: "official" }, benchmark: fakeBenchmark({}) });
    const pah = r.perMeasure.find(m => m.measure.id === "pah");
    expect(pah.points).toBe(highland.actuals.pah.points); // 6, from the real dataset
    expect(pah.pointsBasis).toBe("official_prior_cycle");
    expect(pah.observation.period).toMatch(/2023/);
  });
});

describe("J/K/L exclusion blocks ranking/award eligibility", () => {
  it("a facility with jklDeficiency is flagged, with a reason, independent of its score", () => {
    const r = scoreFacility({ facility: { actuals: {}, jklDeficiency: true }, inputs: { vals: {} }, benchmark: fakeBenchmark({}) });
    expect(r.eligibilityBlocked).toBe(true);
    expect(r.eligibilityReason).toMatch(/J\/K\/L/);
  });
  it("a facility without the flag is not blocked", () => {
    const r = scoreFacility({ facility: { actuals: {}, jklDeficiency: false }, inputs: { vals: {} }, benchmark: fakeBenchmark({}) });
    expect(r.eligibilityBlocked).toBe(false);
  });
  it("an old flag on a different cycle's data does not by itself prove PRESENT-cycle eligibility either way -- it's surfaced, not silently trusted or discarded", () => {
    // The flag is read as-is from the loaded facility record; scorer.js doesn't infer or
    // override it, it just surfaces whatever the currently active dataset says.
    const highland = highlandFacility();
    const r = scoreFacility({ facility: highland, inputs: { vals: {} }, benchmark: fakeBenchmark({}) });
    expect(r.eligibilityBlocked).toBe(highland.jklDeficiency);
  });
});

describe("misaligned period/version/adjustment inputs cannot silently become comparable", () => {
  it("benchmark gaps (no cutpoints available) are reported as unresolved, not scored against a wrong benchmark", () => {
    const bench = fakeBenchmark({}); // no cutpoints for anything
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { weight_loss: "10" } }, benchmark: bench });
    const row = r.perMeasure.find(m => m.measure.id === "weight_loss");
    expect(row.points).toBeNull();
    expect(row.unresolvedReason).toMatch(/no cutpoints available/);
  });
  it("the benchmark identity and asOf date are always echoed in the result, never implied", () => {
    const bench = fakeBenchmark({});
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: {} }, benchmark: bench });
    expect(r.benchmark).toEqual({ id: "fake", label: "Test benchmark", asOf: "test" });
  });
  it("no benchmark supplied at all is handled explicitly (benchmark: null), not a silent default", () => {
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { weight_loss: "10" } } });
    expect(r.benchmark).toBeNull();
    expect(r.perMeasure.find(m => m.measure.id === "weight_loss").points).toBeNull();
  });
});

describe("real Highland Care Center facility — reproducibility check against bundled 2023 data", () => {
  it("prior-year quintiles built from the real dataset match the official per-measure quintiles", () => {
    const highland = highlandFacility();
    const prior = buildPriorYearQuintilesFrom2023Actuals(highland);
    expect(prior.incontinence).toBe(4);
    expect(prior.turnover).toBe(3);
    expect(prior.weight_loss).toBe(2);
  });

  it("scoring Highland's own 2023 values against the 2023 official benchmark reproduces its real per-measure quintiles", () => {
    const highland = highlandFacility();
    const bench = official2023Benchmark(nhqi2023, highland);
    const vals = {};
    for (const id of ["pressure_ulcer", "weight_loss", "depression", "adl", "incontinence", "pneumo_vax", "flu_vax_resident", "flu_vax_staff", "hprd", "turnover"]) {
      vals[id] = String(highland.actuals[id].value);
    }
    const r = scoreFacility({ facility: highland, inputs: { vals }, benchmark: bench });
    for (const id of Object.keys(vals)) {
      const row = r.perMeasure.find(m => m.measure.id === id);
      const officialQuintile = parseInt(highland.actuals[id].quintile, 10);
      expect(row.currentQuintile, `${id} quintile mismatch`).toBe(officialQuintile);
    }
  });

  it("CYCLE constant is 2025, never silently defaulting to a different cycle", () => {
    expect(CYCLE).toBe("2025");
  });
});

describe("getNextTierGain — only real, attainable point gains", () => {
  it("a Q5->Q4 move on a measure with no improvement credit earns 0, never a fake gain", () => {
    const bench = fakeBenchmark({ adl: [10, 20, 30, 40] }); // adl: no improvement credit in 2025
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { adl: "45" } }, benchmark: bench }); // Q5
    const row = r.perMeasure.find(m => m.measure.id === "adl");
    expect(row.currentQuintile).toBe(5);
    expect(getNextTierGain(row)).toBe(0); // flat table Q4(0) - Q5(0) = 0, not a sold "opportunity"
  });

  it("a Q2->Q1 move on a non-eligible measure is a real +2 (flat table 5-3)", () => {
    const bench = fakeBenchmark({ pressure_ulcer: [10, 20, 30, 40] });
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { pressure_ulcer: "15" } }, benchmark: bench }); // Q2
    const row = r.perMeasure.find(m => m.measure.id === "pressure_ulcer");
    expect(getNextTierGain(row)).toBe(2);
  });

  it("an improvement-eligible measure's next-tier gain depends on the known prior quintile", () => {
    const bench = fakeBenchmark({ weight_loss: [10, 20, 30, 40] });
    const r = scoreFacility({
      facility: { actuals: {} }, inputs: { vals: { weight_loss: "35" } }, benchmark: bench, // Q4
      priorYearQuintiles: { weight_loss: 1 },
    });
    const row = r.perMeasure.find(m => m.measure.id === "weight_loss");
    // current Q4/prior Q1 = matrix[3][0] = 0; next-tier Q3/prior Q1 = matrix[2][0] = 1 -> gain = 1
    expect(getNextTierGain(row)).toBe(1);
  });

  it("returns null (not a guessed gain) when the current measure itself is unresolved", () => {
    const bench = fakeBenchmark({ weight_loss: [10, 20, 30, 40] });
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { weight_loss: "" } }, benchmark: bench });
    const row = r.perMeasure.find(m => m.measure.id === "weight_loss");
    expect(getNextTierGain(row)).toBeNull();
  });

  it("returns null for a measure already at Q1 (no next tier)", () => {
    const bench = fakeBenchmark({ pressure_ulcer: [10, 20, 30, 40] });
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { pressure_ulcer: "5" } }, benchmark: bench });
    const row = r.perMeasure.find(m => m.measure.id === "pressure_ulcer");
    expect(getNextTierGain(row)).toBeNull();
  });
});

describe("legacy_unverified values read as stale, not current", () => {
  it("a value with no recorded verification override defaults to manual (unaffected)", () => {
    const bench = fakeBenchmark({ pressure_ulcer: [10, 20, 30, 40] });
    const r = scoreFacility({ facility: { actuals: {} }, inputs: { vals: { pressure_ulcer: "5" } }, benchmark: bench });
    expect(r.perMeasure.find(m => m.measure.id === "pressure_ulcer").observation.state).toBe("valid");
  });

  it("a value explicitly marked legacy_unverified is downgraded to stale_noncomparable, not scored as current", () => {
    const bench = fakeBenchmark({ pressure_ulcer: [10, 20, 30, 40] });
    const r = scoreFacility({
      facility: { actuals: {} },
      inputs: { vals: { pressure_ulcer: "5" }, verifications: { vals: { pressure_ulcer: "legacy_unverified" }, starVals: {}, binaryVals: {} } },
      benchmark: bench,
    });
    const row = r.perMeasure.find(m => m.measure.id === "pressure_ulcer");
    expect(row.observation.state).toBe("stale_noncomparable");
    expect(row.points).toBeNull(); // not silently treated as a current, scorable value
  });

  it("applies the same override to threshold and binary measures, not just quintile ones", () => {
    const r = scoreFacility({
      facility: { actuals: {} },
      inputs: {
        vals: { falls: "4" }, binaryVals: { flu_timely: "yes" },
        verifications: { vals: { falls: "legacy_unverified" }, starVals: {}, binaryVals: { flu_timely: "legacy_unverified" } },
      },
      benchmark: fakeBenchmark({}),
    });
    expect(r.perMeasure.find(m => m.measure.id === "falls").observation.state).toBe("stale_noncomparable");
    expect(r.perMeasure.find(m => m.measure.id === "flu_timely").observation.state).toBe("stale_noncomparable");
  });

  it("a legacy_unverified value that is ALSO invalid stays invalid, not stale (invalid takes precedence)", () => {
    const bench = fakeBenchmark({ pressure_ulcer: [10, 20, 30, 40] });
    const r = scoreFacility({
      facility: { actuals: {} },
      inputs: { vals: { pressure_ulcer: "abc" }, verifications: { vals: { pressure_ulcer: "legacy_unverified" }, starVals: {}, binaryVals: {} } },
      benchmark: bench,
    });
    expect(r.perMeasure.find(m => m.measure.id === "pressure_ulcer").observation.state).toBe("invalid_input");
  });
});
