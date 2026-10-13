import { describe, it, expect } from "vitest";
import { normalizeOfficialScore, normalizeOfficialScoreWhole } from "./normalization.js";

describe("normalizeOfficialScore — worked example from the 2025 methodology Table 4", () => {
  it("75/90 -> 83 (whole-number display convention from the methodology table)", () => {
    expect(normalizeOfficialScoreWhole(75, 90)).toBe(83);
  });
  it("75/80 -> 94 (small-sample-size max reduction raises the normalized score)", () => {
    expect(normalizeOfficialScoreWhole(75, 80)).toBe(94);
  });
  it("same raw points against a smaller max always yields a higher or equal score", () => {
    expect(normalizeOfficialScoreWhole(75, 80)).toBeGreaterThan(normalizeOfficialScoreWhole(75, 90));
  });
});

describe("normalizeOfficialScore — real published-data ground truth (1-decimal precision)", () => {
  it("Highland Care Center: 29 raw points / 90 max -> 32.2 (matches published totalScore)", () => {
    expect(normalizeOfficialScore(29, 90)).toBe(32.2);
  });
  it("Absolut Center (2 SS-excluded 5pt measures): 50 / 75 -> 66.7 (matches published totalScore)", () => {
    expect(normalizeOfficialScore(50, 75)).toBe(66.7);
  });
});

describe("normalizeOfficialScore — edge cases", () => {
  it("returns null for a zero or missing max attainable rather than dividing by zero", () => {
    expect(normalizeOfficialScore(10, 0)).toBeNull();
    expect(normalizeOfficialScore(10, null)).toBeNull();
    expect(normalizeOfficialScore(10, undefined)).toBeNull();
  });
  it("a perfect score normalizes to 100 regardless of the reduced max", () => {
    expect(normalizeOfficialScoreWhole(80, 80)).toBe(100);
    expect(normalizeOfficialScoreWhole(90, 90)).toBe(100);
  });
});
