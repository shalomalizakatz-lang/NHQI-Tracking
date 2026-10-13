import { describe, it, expect } from "vitest";
import { classifyRawValue, OBSERVATION_STATES } from "./observation.js";

describe("classifyRawValue — missing vs true zero vs suppressed vs invalid", () => {
  it("empty string, null, undefined -> missing_input (never treated as 0)", () => {
    expect(classifyRawValue("").state).toBe(OBSERVATION_STATES.MISSING_INPUT);
    expect(classifyRawValue(null).state).toBe(OBSERVATION_STATES.MISSING_INPUT);
    expect(classifyRawValue(undefined).state).toBe(OBSERVATION_STATES.MISSING_INPUT);
    expect(classifyRawValue("NA").state).toBe(OBSERVATION_STATES.MISSING_INPUT);
    expect(classifyRawValue("N/A").state).toBe(OBSERVATION_STATES.MISSING_INPUT);
  });

  it("a true zero is VALID, distinct from missing", () => {
    const z = classifyRawValue(0);
    expect(z.state).toBe(OBSERVATION_STATES.VALID);
    expect(z.numericValue).toBe(0);
    const zs = classifyRawValue("0");
    expect(zs.state).toBe(OBSERVATION_STATES.VALID);
    expect(zs.numericValue).toBe(0);
  });

  it('DOH\'s official small-sample-size sentinel "SS" -> suppressed_official, not 0', () => {
    const r = classifyRawValue("SS");
    expect(r.state).toBe(OBSERVATION_STATES.SUPPRESSED_OFFICIAL);
    expect(r.numericValue).toBeNull();
    // case/whitespace tolerant
    expect(classifyRawValue(" ss ").state).toBe(OBSERVATION_STATES.SUPPRESSED_OFFICIAL);
  });

  it("non-numeric / non-finite input -> invalid_input, never silently 0", () => {
    expect(classifyRawValue("abc").state).toBe(OBSERVATION_STATES.INVALID_INPUT);
    expect(classifyRawValue(NaN).state).toBe(OBSERVATION_STATES.INVALID_INPUT);
    expect(classifyRawValue(Infinity).state).toBe(OBSERVATION_STATES.INVALID_INPUT);
    expect(classifyRawValue(-Infinity).state).toBe(OBSERVATION_STATES.INVALID_INPUT);
  });

  it("a value outside the measure's logical bounds -> invalid_input, not clamped", () => {
    expect(classifyRawValue(150, { bounds: { min: 0, max: 100 } }).state).toBe(OBSERVATION_STATES.INVALID_INPUT);
    expect(classifyRawValue(-5, { bounds: { min: 0, max: 100 } }).state).toBe(OBSERVATION_STATES.INVALID_INPUT);
    expect(classifyRawValue(100, { bounds: { min: 0, max: 100 } }).state).toBe(OBSERVATION_STATES.VALID);
    expect(classifyRawValue(0, { bounds: { min: 0, max: 100 } }).state).toBe(OBSERVATION_STATES.VALID);
  });

  it("precision boundary values are preserved at full float precision", () => {
    const r = classifyRawValue("4.333333");
    expect(r.numericValue).toBeCloseTo(4.333333, 6);
  });
});
