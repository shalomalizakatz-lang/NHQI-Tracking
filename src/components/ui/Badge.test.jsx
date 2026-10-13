import { describe, it, expect } from "vitest";
import { toneForObservationState } from "./Badge.jsx";

describe("toneForObservationState", () => {
  it("returns null for 'valid' (no status badge for plain, resolved data) -- not 'neutral'", () => {
    // Regression test: OBSERVATION_STATE_COLOR.valid is an explicit `null`, and the
    // original implementation used `?? "neutral"`, which treats that null as
    // "missing" and silently rendered an empty gray badge on every resolved row.
    expect(toneForObservationState("valid")).toBeNull();
  });

  it("maps each real unresolved/invalid state to its real tone", () => {
    expect(toneForObservationState("missing_input")).toBe("amber");
    expect(toneForObservationState("stale_noncomparable")).toBe("amber");
    expect(toneForObservationState("invalid_input")).toBe("red");
    expect(toneForObservationState("unavailable_source")).toBe("neutral");
    expect(toneForObservationState("suppressed_official")).toBe("neutral");
  });

  it("falls back to neutral for an unrecognized state", () => {
    expect(toneForObservationState("not_a_real_state")).toBe("neutral");
  });
});
