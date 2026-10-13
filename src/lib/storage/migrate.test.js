import { describe, it, expect } from "vitest";
import { ensureMigratedInputs, migrateFacilityInputsV1toV2, applyCmsRefreshToField, isV2, CURRENT_SCHEMA_VERSION, VERIFICATION } from "./migrate.js";

describe("legacy storage migration (v1 -> v2)", () => {
  it("a null/missing blob becomes an empty v2 shell, not an error", () => {
    const r = ensureMigratedInputs(null);
    expect(isV2(r)).toBe(true);
    expect(Object.keys(r)).toEqual(["schemaVersion"]);
  });

  it("an already-v2 blob passes through unchanged (idempotent)", () => {
    const v2 = { schemaVersion: CURRENT_SCHEMA_VERSION, "123": { vals: {}, starVals: {}, binaryVals: {}, pahScenario: null, updatedAt: null } };
    expect(ensureMigratedInputs(v2)).toBe(v2);
  });

  it("migrates a v1 blob, preserving every existing raw value", () => {
    const v1 = {
      "1711": {
        vals: { weight_loss: "4.9", adl: "17" },
        starVals: { health_inspect: "2" },
        binaryVals: { flu_timely: "yes" },
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    };
    const v2 = ensureMigratedInputs(v1);
    expect(isV2(v2)).toBe(true);
    expect(v2["1711"].vals.weight_loss.value).toBe("4.9");
    expect(v2["1711"].vals.adl.value).toBe("17");
    expect(v2["1711"].starVals.health_inspect.value).toBe("2");
    expect(v2["1711"].binaryVals.flu_timely.value).toBe("yes");
  });

  it("every migrated field is marked legacy_unverified, never presented as current manual/CMS data", () => {
    const v1 = { "1711": { vals: { weight_loss: "4.9" }, starVals: {}, binaryVals: {}, updatedAt: null } };
    const v2 = ensureMigratedInputs(v1);
    expect(v2["1711"].vals.weight_loss.verification).toBe(VERIFICATION.LEGACY_UNVERIFIED);
  });

  it("a legacy value with no period is marked unverified rather than assumed current", () => {
    const migrated = migrateFacilityInputsV1toV2({ vals: { hprd: "3.2" }, starVals: {}, binaryVals: {}, updatedAt: null });
    expect(migrated.vals.hprd.period).toBeNull();
    expect(migrated.vals.hprd.verification).toBe(VERIFICATION.LEGACY_UNVERIFIED);
  });

  it("migration never invents a PAH scenario for v1 data that had no such concept", () => {
    const migrated = migrateFacilityInputsV1toV2({ vals: {}, starVals: {}, binaryVals: {}, updatedAt: null });
    expect(migrated.pahScenario).toBeNull();
  });

  it("empty-string legacy fields are dropped (treated as never entered), not migrated as empty records", () => {
    const migrated = migrateFacilityInputsV1toV2({ vals: { weight_loss: "" }, starVals: {}, binaryVals: {}, updatedAt: null });
    expect(migrated.vals.weight_loss).toBeUndefined();
  });

  it("migrates multiple facilities in one blob independently", () => {
    const v1 = {
      "1711": { vals: { weight_loss: "4.9" }, starVals: {}, binaryVals: {}, updatedAt: null },
      "962": { vals: { adl: "12" }, starVals: {}, binaryVals: {}, updatedAt: null },
    };
    const v2 = ensureMigratedInputs(v1);
    expect(v2["1711"].vals.weight_loss.value).toBe("4.9");
    expect(v2["962"].vals.adl.value).toBe("12");
  });
});

describe("manual override survives a CMS refresh", () => {
  it("a manual entry is never overwritten by a fresh CMS pull, even if the CMS value differs", () => {
    const manual = { value: "10", verification: VERIFICATION.MANUAL, period: null, fetchedAt: null, overrideOf: null, updatedAt: "2026-01-01" };
    const result = applyCmsRefreshToField(manual, "15", { period: "2024", fetchedAt: "2026-10-01" });
    expect(result.changed).toBe(false);
    expect(result.record).toBe(manual);
  });

  it("a legacy_unverified value IS safely restaged by a refresh (nothing manual to protect)", () => {
    const legacy = { value: "10", verification: VERIFICATION.LEGACY_UNVERIFIED, period: null, fetchedAt: null, overrideOf: null, updatedAt: null };
    const result = applyCmsRefreshToField(legacy, "15", { period: "2024", fetchedAt: "2026-10-01" });
    expect(result.changed).toBe(true);
    expect(result.record.value).toBe("15");
    expect(result.record.verification).toBe(VERIFICATION.CMS_AUTOFILL);
  });

  it("an existing cms_autofill value restages only when the underlying value actually changed", () => {
    const stale = { value: "10", verification: VERIFICATION.CMS_AUTOFILL, period: "2023", fetchedAt: "2026-09-01", overrideOf: null, updatedAt: null };
    const same = applyCmsRefreshToField(stale, "10", { period: "2024", fetchedAt: "2026-10-01" });
    expect(same.changed).toBe(false);
    const changed = applyCmsRefreshToField(stale, "12", { period: "2024", fetchedAt: "2026-10-01" });
    expect(changed.changed).toBe(true);
    expect(changed.record.value).toBe("12");
    expect(changed.record.overrideOf).toBe("10");
  });

  it("an empty existing field is safely filled by a refresh", () => {
    const result = applyCmsRefreshToField(null, "15", { period: "2024", fetchedAt: "2026-10-01" });
    expect(result.changed).toBe(true);
    expect(result.record.verification).toBe(VERIFICATION.CMS_AUTOFILL);
  });
});
