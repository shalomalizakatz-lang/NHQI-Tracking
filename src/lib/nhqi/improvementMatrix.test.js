import { describe, it, expect } from "vitest";
import { getAttainmentAward, isImprovementEligible, IMPROVEMENT_MATRICES } from "./improvementMatrix.js";
import { IMPROVEMENT_ELIGIBLE_2025, MEASURES_2025 } from "./measures/2025.js";

// The full matrix as given, rows=current(1..5), cols=prior(1..5).
const EXPECTED_MATRIX = [
  [5, 5, 5, 5, 5],
  [3, 3, 4, 4, 4],
  [1, 1, 1, 2, 2],
  [0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0],
];

describe("2025 improvement matrix — all 25 cells", () => {
  for (let cur = 1; cur <= 5; cur++) {
    for (let prior = 1; prior <= 5; prior++) {
      it(`current Q${cur}, prior Q${prior} -> ${EXPECTED_MATRIX[cur - 1][prior - 1]} points`, () => {
        const award = getAttainmentAward("2025", "weight_loss", cur, prior);
        expect(award.points).toBe(EXPECTED_MATRIX[cur - 1][prior - 1]);
        expect(award.unresolved).toBe(false);
      });
    }
  }

  it("the matrix diagonal matches the flat attainment table (no improvement = flat attainment)", () => {
    expect(IMPROVEMENT_MATRICES["2025"][0][0]).toBe(5); // Q1/Q1
    expect(IMPROVEMENT_MATRICES["2025"][1][1]).toBe(3); // Q2/Q2
    expect(IMPROVEMENT_MATRICES["2025"][2][2]).toBe(1); // Q3/Q3
    expect(IMPROVEMENT_MATRICES["2025"][3][3]).toBe(0); // Q4/Q4
    expect(IMPROVEMENT_MATRICES["2025"][4][4]).toBe(0); // Q5/Q5
  });
});

describe("2025 eligible measure set — exactly the 6 named in the brief", () => {
  it("matches exactly: flu_vax_staff, depression, weight_loss, pneumo_vax, flu_vax_resident, turnover", () => {
    expect(new Set(IMPROVEMENT_ELIGIBLE_2025)).toEqual(
      new Set(["flu_vax_staff", "depression", "weight_loss", "pneumo_vax", "flu_vax_resident", "turnover"])
    );
  });

  it("pressure_ulcer and incontinence are replaced measures with NO improvement credit", () => {
    expect(isImprovementEligible("2025", "pressure_ulcer")).toBe(false);
    expect(isImprovementEligible("2025", "incontinence")).toBe(false);
  });

  it("adl and hprd resume 4-quarter periods with NO improvement credit this cycle", () => {
    expect(isImprovementEligible("2025", "adl")).toBe(false);
    expect(isImprovementEligible("2025", "hprd")).toBe(false);
  });

  it("threshold measures (falls, uti, contract_staff) have no improvement credit", () => {
    expect(isImprovementEligible("2025", "falls")).toBe(false);
    expect(isImprovementEligible("2025", "uti")).toBe(false);
    expect(isImprovementEligible("2025", "contract_staff")).toBe(false);
  });

  it("every measure id referenced is a real 2025 measure (no typo'd ids silently no-op)", () => {
    const allIds = new Set(MEASURES_2025.map(m => m.id));
    for (const id of IMPROVEMENT_ELIGIBLE_2025) expect(allIds.has(id)).toBe(true);
  });
});

describe("ineligible measure -> flat table, not matrix", () => {
  it("returns unresolved:false with an explicit reason, not a fabricated matrix lookup", () => {
    const award = getAttainmentAward("2025", "pressure_ulcer", 4, 2);
    expect(award.points).toBeNull();
    expect(award.unresolved).toBe(false);
    expect(award.reason).toMatch(/not improvement-eligible/);
  });
});

describe("missing prior-year quintile never fabricates improvement points", () => {
  it("eligible measure + unknown prior -> unresolved, points null (no blanket +1)", () => {
    const award = getAttainmentAward("2025", "weight_loss", 2, null);
    expect(award.points).toBeNull();
    expect(award.unresolved).toBe(true);
    expect(award.reason).toMatch(/prior-year quintile unavailable/);
  });
  it("same for prior quintile 0 or out of range", () => {
    expect(getAttainmentAward("2025", "turnover", 3, 0).unresolved).toBe(true);
    expect(getAttainmentAward("2025", "turnover", 3, 6).unresolved).toBe(true);
  });
  it("unknown current quintile is unresolved regardless of eligibility", () => {
    const award = getAttainmentAward("2025", "weight_loss", null, 2);
    expect(award.points).toBeNull();
    expect(award.unresolved).toBe(true);
  });
});

describe("an unsourced cycle never silently reuses 2025's matrix", () => {
  it("getAttainmentAward for cycle 2024 returns unresolved with an explicit reason", () => {
    const award = getAttainmentAward("2024", "weight_loss", 2, 1);
    expect(award.unresolved).toBe(true);
    expect(award.reason).toMatch(/no improvement matrix sourced/);
  });
});
