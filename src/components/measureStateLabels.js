// Shared between MeasureListRow and MeasureDetail so a given observation
// state reads identically whichever view it's seen in.
export const STATE_LABEL = {
  missing_input: "Not entered",
  unavailable_source: "No source data",
  invalid_input: "Invalid value",
  stale_noncomparable: "Legacy value, period unverified",
  suppressed_official: "Officially suppressed (small sample)",
};
