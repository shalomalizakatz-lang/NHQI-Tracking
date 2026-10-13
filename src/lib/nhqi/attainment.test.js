import { describe, it, expect } from "vitest";
import { getFlatAttainmentPoints, getThresholdPoints, getStarMapPoints, getBinaryPoints, getPahPoints } from "./attainment.js";
import { MEASURE_2025_BY_ID } from "./measures/2025.js";

describe("getFlatAttainmentPoints — 2025 quintile table [5,3,1,0,0]", () => {
  it.each([[1, 5], [2, 3], [3, 1], [4, 0], [5, 0]])("Q%i -> %i points", (q, pts) => {
    expect(getFlatAttainmentPoints("2025", "quintile", q)).toBe(pts);
  });
  it("returns null for an unresolved quintile (0, null, out of range)", () => {
    expect(getFlatAttainmentPoints("2025", "quintile", null)).toBeNull();
    expect(getFlatAttainmentPoints("2025", "quintile", 0)).toBeNull();
    expect(getFlatAttainmentPoints("2025", "quintile", 6)).toBeNull();
  });
  it("returns null for an unsourced cycle rather than silently reusing 2025's table", () => {
    expect(getFlatAttainmentPoints("2024", "quintile", 1)).toBeNull();
    expect(getFlatAttainmentPoints("2023", "quintile", 1)).toBeNull();
  });
});

describe("getPahPoints — PAH quintile map [10,8,6,2,0]", () => {
  it.each([[1, 10], [2, 8], [3, 6], [4, 2], [5, 0]])("Q%i -> %i points", (q, pts) => {
    expect(getPahPoints(MEASURE_2025_BY_ID.pah, q)).toBe(pts);
  });
});

describe("getThresholdPoints — exact boundary cases", () => {
  it("falls <=5.0% earns 5, just above earns 0 (inclusive lte)", () => {
    const falls = MEASURE_2025_BY_ID.falls;
    expect(getThresholdPoints(falls, 5.0)).toBe(5);
    expect(getThresholdPoints(falls, 5.01)).toBe(0);
    expect(getThresholdPoints(falls, 4.99)).toBe(5);
  });
  it("UTI <=5.0% earns 5, just above earns 0 (inclusive lte)", () => {
    const uti = MEASURE_2025_BY_ID.uti;
    expect(getThresholdPoints(uti, 5.0)).toBe(5);
    expect(getThresholdPoints(uti, 5.001)).toBe(0);
  });
  it("agency staff <10% earns 5; exactly 10% earns 0 (strict lt)", () => {
    const agency = MEASURE_2025_BY_ID.contract_staff;
    expect(getThresholdPoints(agency, 9.99)).toBe(5);
    expect(getThresholdPoints(agency, 10)).toBe(0);
    expect(getThresholdPoints(agency, 10.01)).toBe(0);
  });
  it("returns null for missing/non-numeric input rather than treating it as 0", () => {
    const falls = MEASURE_2025_BY_ID.falls;
    expect(getThresholdPoints(falls, "")).toBeNull();
    expect(getThresholdPoints(falls, null)).toBeNull();
    expect(getThresholdPoints(falls, undefined)).toBeNull();
    expect(getThresholdPoints(falls, "abc")).toBeNull();
    expect(getThresholdPoints(falls, NaN)).toBeNull();
    expect(getThresholdPoints(falls, Infinity)).toBeNull();
  });
});

describe("getStarMapPoints — 5/4/3/2/1 -> 10/7/4/2/0", () => {
  it.each([[5, 10], [4, 7], [3, 4], [2, 2], [1, 0]])("%i star -> %i points", (s, pts) => {
    expect(getStarMapPoints(MEASURE_2025_BY_ID.health_inspect, s)).toBe(pts);
  });
  it("returns null for an unanswered or out-of-range star rating", () => {
    const m = MEASURE_2025_BY_ID.health_inspect;
    expect(getStarMapPoints(m, null)).toBeNull();
    expect(getStarMapPoints(m, "")).toBeNull();
    expect(getStarMapPoints(m, 0)).toBeNull();
    expect(getStarMapPoints(m, 6)).toBeNull();
  });
});

describe("getBinaryPoints — timely filing", () => {
  it("yes -> 5, verified no -> 0, unanswered -> null (not 0)", () => {
    const m = MEASURE_2025_BY_ID.flu_timely;
    expect(getBinaryPoints(m, "yes")).toBe(5);
    expect(getBinaryPoints(m, "no")).toBe(0);
    expect(getBinaryPoints(m, null)).toBeNull();
    expect(getBinaryPoints(m, undefined)).toBeNull();
    expect(getBinaryPoints(m, "")).toBeNull();
  });
});
