// Thin color-logic helpers built on the shared design tokens (src/lib/designTokens.js).
// Signatures are unchanged from before the token refactor, so existing call sites
// (QuintileBadge.jsx, MeasureRow family) don't need to change.
import { colors, quintileScale } from "./designTokens.js";

export function qColor(q) {
  if (!q || q === "threshold" || q === "star" || q === "binary") return colors.accent;
  const n = typeof q === "string" ? parseInt(q) : q;
  return quintileScale[n] ?? colors.red;
}

export function ptsColor(pts, max) {
  if (pts === null || pts === undefined) return colors.neutralBorder;
  const r = pts / max;
  if (r >= 1) return colors.green;
  if (r >= 0.6) return quintileScale[2];
  if (r >= 0.2) return colors.amberText;
  return colors.red;
}

// Per-measure trend indicator (2023 actual vs. entered 2025 value) — distinct from
// the overall facility points-delta concept, which was removed from most of the UI.
export function deltaColor(delta, higherIsBetter) {
  if (delta === null) return colors.inkMuted;
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  if (improved) return colors.green;
  if (delta === 0) return colors.inkSecondary;
  return colors.red;
}

export function deltaArrow(delta, higherIsBetter) {
  if (delta === null || delta === 0) return "→";
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  return improved ? "↑" : "↓";
}
