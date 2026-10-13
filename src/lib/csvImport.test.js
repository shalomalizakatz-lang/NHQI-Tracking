import { describe, it, expect } from "vitest";
import { parseNhqiCsv } from "./csvImport.js";

const HEADER = [
  "Measurement Year", "Facility Name", "Facility ID", "Facility OPCERT", "Facility Medicare Number",
  "Measure ID Number", "First Quintile", "Second Quintile", "Third Quintile", "Fourth Quintile", "Fifth Quintile",
  "Numeric Value", "Character Value", "Quintile", "Points", "City", "County", "Region", "Location",
].join(",");

// A single weight_loss (measure 10, lowerIsBetter) row — cutpoints given in the real 5-column
// DOH shape (lowerIsBetter uses the first 4, drops the 5th).
function row({ year = "2025", fid = "1", name = "Test Facility", measureId = "10", cp = ["3.9", "5.2", "6.3", "7.8", "18.2"], numValue = "4.5", charValue = "", quintile = "2", points = "3", region = "MARO" }) {
  return [year, name, fid, "OPCERT1", "MED1", measureId, ...cp, numValue, charValue, quintile, points, "City", "County", region, "(0,0)"].join(",");
}

function csv(rows) {
  return [HEADER, ...rows].join("\n");
}

describe("parseNhqiCsv — required columns", () => {
  it("throws naming every missing required column by its real CSV header text", () => {
    const badHeader = "Facility Name,Facility ID,Points";
    expect(() => parseNhqiCsv(badHeader + "\n" + "x,1,5")).toThrow(/Measurement Year/);
    expect(() => parseNhqiCsv(badHeader + "\n" + "x,1,5")).toThrow(/Measure ID Number/);
  });
  it("throws for an empty file", () => {
    expect(() => parseNhqiCsv("")).toThrow(/empty/i);
  });
  it("throws when every data row is missing a Facility ID", () => {
    expect(() => parseNhqiCsv(csv([row({ fid: "" })]))).toThrow(/No facility rows/i);
  });
});

describe("parseNhqiCsv — happy path", () => {
  it("parses a minimal valid CSV with no warnings", () => {
    const parsed = parseNhqiCsv(csv([row({})]));
    expect(parsed.year).toBe("2025");
    expect(parsed.facilities).toHaveLength(1);
    expect(parsed.facilities[0].actuals.weight_loss.value).toBe(4.5);
    expect(parsed.facilities[0].actuals.weight_loss.quintile).toBe("2");
    expect(parsed.validation.warnings).toEqual([]);
    expect(parsed.validation.measuresRecognized).toBe(1);
  });
});

describe("parseNhqiCsv — year consistency", () => {
  it("warns when rows span multiple Measurement Year values", () => {
    const parsed = parseNhqiCsv(csv([
      row({ fid: "1", year: "2025" }),
      row({ fid: "2", year: "2024" }),
    ]));
    expect(parsed.validation.warnings.some(w => /different Measurement Year/.test(w))).toBe(true);
    expect(parsed.year).toBe("2025"); // first-seen year wins, explicitly, not silently
  });
});

describe("parseNhqiCsv — unmapped measure IDs", () => {
  it("skips an unrecognized measure ID and warns about it, rather than silently dropping with no trace", () => {
    const parsed = parseNhqiCsv(csv([row({ measureId: "999" })]));
    expect(parsed.facilities[0].actuals).toEqual({});
    expect(parsed.validation.warnings.some(w => /999/.test(w))).toBe(true);
    expect(parsed.validation.measuresRecognized).toBe(0);
  });
});

describe("parseNhqiCsv — duplicate facility/measure rows", () => {
  it("warns when the same facility+measure appears twice", () => {
    const parsed = parseNhqiCsv(csv([
      row({ fid: "1", measureId: "10", numValue: "4.5" }),
      row({ fid: "1", measureId: "10", numValue: "9.9" }),
    ]));
    expect(parsed.validation.warnings.some(w => /appeared more than once/.test(w))).toBe(true);
    expect(parsed.facilities[0].actuals.weight_loss.value).toBe(9.9); // last row wins, as documented
  });
});

describe("parseNhqiCsv — numeric sentinels and invalid values", () => {
  it('"NA" is treated as a missing value, not a warning-worthy invalid one', () => {
    const parsed = parseNhqiCsv(csv([row({ numValue: "NA" })]));
    expect(parsed.facilities[0].actuals.weight_loss.value).toBeNull();
    expect(parsed.validation.warnings.some(w => /Numeric Value/.test(w))).toBe(false);
  });
  it('"SS" (DOH small-sample-size sentinel) arrives in the Character Value column when Numeric Value is blank, and is preserved as-is', () => {
    const parsed = parseNhqiCsv(csv([row({ numValue: "", charValue: "SS", quintile: "" })]));
    expect(parsed.facilities[0].actuals.weight_loss.value).toBe("SS");
    expect(parsed.validation.warnings.some(w => /Numeric Value/.test(w))).toBe(false);
  });
  it("genuine garbage text in Numeric Value is flagged as a validation warning", () => {
    const parsed = parseNhqiCsv(csv([row({ numValue: "garbage" })]));
    expect(parsed.validation.warnings.some(w => /Numeric Value/.test(w))).toBe(true);
    expect(parsed.validation.invalidNumericValues).toHaveLength(1);
    expect(parsed.validation.invalidNumericValues[0]).toMatchObject({ facilityId: "1", measureId: "weight_loss", raw: "garbage" });
  });
});

describe("parseNhqiCsv — cutpoint direction trimming still works alongside validation", () => {
  it("a higherIsBetter measure (pneumo_vax, id 6.2) drops the first (dummy) cutpoint column", () => {
    const parsed = parseNhqiCsv(csv([row({ measureId: "6.2", cp: ["99", "84", "76", "66", "54"] })]));
    expect(parsed.measures.pneumo_vax.cutpoints.default).toEqual([84, 76, 66, 54]);
  });
  it("a lowerIsBetter measure (weight_loss, id 10) drops the fifth (dummy) cutpoint column", () => {
    const parsed = parseNhqiCsv(csv([row({})]));
    expect(parsed.measures.weight_loss.cutpoints.default).toEqual([3.9, 5.2, 6.3, 7.8]);
  });
});
