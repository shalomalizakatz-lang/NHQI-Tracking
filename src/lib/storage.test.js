import { describe, it, expect, beforeEach } from "vitest";
import { addFacility, getPortfolio, removeFacility, restoreFacility, saveManualFieldValue, getFacilityInputs } from "./storage.js";

beforeEach(() => {
  localStorage.clear();
});

describe("removeFacility / restoreFacility", () => {
  it("removes the facility and its inputs, and returns what was removed", () => {
    addFacility("1711", { displayName: "Highland Care Center" });
    saveManualFieldValue("1711", "vals", "weight_loss", "4.9");

    const result = removeFacility("1711");
    expect(getPortfolio().some(f => f.facilityId === "1711")).toBe(false);
    expect(result.removedEntry.facilityId).toBe("1711");
    expect(result.removedInputs.vals.weight_loss.value).toBe("4.9");
  });

  it("restoreFacility puts the facility and its inputs back exactly as removed", () => {
    addFacility("1711", { displayName: "Highland Care Center" });
    saveManualFieldValue("1711", "vals", "weight_loss", "4.9");
    const { removedEntry, removedInputs } = removeFacility("1711");

    restoreFacility(removedEntry, removedInputs);

    expect(getPortfolio().some(f => f.facilityId === "1711")).toBe(true);
    expect(getFacilityInputs("1711").vals.weight_loss.value).toBe("4.9");
  });

  it("restoreFacility is a no-op when given a null entry (nothing was removed to restore)", () => {
    const before = getPortfolio();
    restoreFacility(null, null);
    expect(getPortfolio()).toEqual(before);
  });

  it("restoreFacility does not duplicate an entry if the facility was re-added before the undo fired", () => {
    addFacility("1711", { displayName: "Highland Care Center" });
    const { removedEntry, removedInputs } = removeFacility("1711");
    addFacility("1711", { displayName: "Highland Care Center" }); // user re-added it manually

    restoreFacility(removedEntry, removedInputs);

    expect(getPortfolio().filter(f => f.facilityId === "1711")).toHaveLength(1);
  });
});
