import { describe, it, expect } from "vitest";
import { qColor, ptsColor, deltaColor, deltaArrow } from "./colors.js";

// Locks in the exact hex output of colors.js, now sourced from
// src/lib/designTokens.js. The secondary/muted ink shades and all 5 quintile
// colors are intentionally darker than the "stock" Tailwind -600 swatch (see
// designTokens.js's quintileScale comment) so they clear WCAG 2.2 AA
// contrast as plain text on a light surface -- confirmed both by
// scripts/check-contrast.mjs and a real axe-core sweep (not just asserted
// here), since qColor()'s result is used as a bare inline text color in
// several places (e.g. PriorityList's "Q2 -> Q1" label).
describe("qColor", () => {
  it("maps quintiles 1-5 to their published colors", () => {
    expect(qColor(1)).toBe("#15803d");
    expect(qColor(2)).toBe("#4d7c0f");
    expect(qColor(3)).toBe("#92400e");
    expect(qColor(4)).toBe("#c2410c");
    expect(qColor(5)).toBe("#dc2626");
  });
  it("accepts string quintiles", () => {
    expect(qColor("3")).toBe("#92400e");
  });
  it("returns the accent teal for non-quintile scoring rules", () => {
    expect(qColor("threshold")).toBe("#0d9488");
    expect(qColor("star")).toBe("#0d9488");
    expect(qColor("binary")).toBe("#0d9488");
    expect(qColor(null)).toBe("#0d9488");
  });
  it("falls back to danger red for an unrecognized numeric quintile", () => {
    expect(qColor(9)).toBe("#dc2626");
  });
});

describe("ptsColor", () => {
  it("bands by points/max ratio", () => {
    expect(ptsColor(5, 5)).toBe("#15803d");
    expect(ptsColor(3, 5)).toBe("#4d7c0f");
    expect(ptsColor(1, 5)).toBe("#92400e");
    expect(ptsColor(0, 5)).toBe("#dc2626");
  });
  it("returns neutral for missing points", () => {
    expect(ptsColor(null, 5)).toBe("#cbd5e1");
    expect(ptsColor(undefined, 5)).toBe("#cbd5e1");
  });
});

describe("deltaColor / deltaArrow", () => {
  it("treats a positive delta as improved when higher is better", () => {
    expect(deltaColor(2, true)).toBe("#15803d");
    expect(deltaArrow(2, true)).toBe("↑");
  });
  it("treats a negative delta as improved when lower is better (arrow means improved, not raw direction)", () => {
    expect(deltaColor(-2, false)).toBe("#15803d");
    expect(deltaArrow(-2, false)).toBe("↑");
  });
  it("treats a worsening delta as danger red", () => {
    expect(deltaColor(-2, true)).toBe("#dc2626");
    expect(deltaArrow(-2, true)).toBe("↓");
  });
  it("treats a zero delta as neutral secondary with a flat arrow", () => {
    expect(deltaColor(0, true)).toBe("#475569");
    expect(deltaArrow(0, true)).toBe("→");
  });
  it("treats a null delta as muted with a flat arrow", () => {
    expect(deltaColor(null, true)).toBe("#64748b");
    expect(deltaArrow(null, true)).toBe("→");
  });
});
