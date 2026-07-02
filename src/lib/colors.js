// Quintile scale, shared across the app, tuned for readability on a light background.
const Q_COLORS = { 1: "#16a34a", 2: "#65a30d", 3: "#d97706", 4: "#ea580c", 5: "#dc2626" };

export function qColor(q) {
  if (!q || q === "threshold" || q === "star" || q === "binary") return "#0d9488";
  const n = typeof q === "string" ? parseInt(q) : q;
  return Q_COLORS[n] ?? "#dc2626";
}

export function ptsColor(pts, max) {
  if (pts === null || pts === undefined) return "#cbd5e1";
  const r = pts / max;
  if (r >= 1) return "#16a34a";
  if (r >= 0.6) return "#65a30d";
  if (r >= 0.2) return "#d97706";
  return "#dc2626";
}

// Per-measure trend indicator (2023 actual vs. entered 2025 value) — distinct from
// the overall facility points-delta concept, which was removed from most of the UI.
export function deltaColor(delta, higherIsBetter) {
  if (delta === null) return "#94a3b8";
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  if (improved) return "#16a34a";
  if (delta === 0) return "#64748b";
  return "#dc2626";
}

export function deltaArrow(delta, higherIsBetter) {
  if (delta === null || delta === 0) return "→";
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  return improved ? "↑" : "↓";
}
