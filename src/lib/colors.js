export function qColor(q) {
  if (!q || q === "threshold" || q === "star" || q === "binary") return "#60a5fa";
  const n = typeof q === "string" ? parseInt(q) : q;
  if (n === 1) return "#22c55e";
  if (n === 2) return "#84cc16";
  if (n === 3) return "#f59e0b";
  if (n === 4) return "#f97316";
  return "#ef4444";
}

export function ptsColor(pts, max) {
  if (pts === null || pts === undefined) return "#374151";
  const r = pts / max;
  if (r >= 1) return "#22c55e";
  if (r >= 0.6) return "#84cc16";
  if (r >= 0.2) return "#f59e0b";
  return "#ef4444";
}

export function deltaColor(delta, higherIsBetter) {
  if (delta === null) return "#475569";
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  if (improved) return "#22c55e";
  if (delta === 0) return "#64748b";
  return "#ef4444";
}

export function deltaArrow(delta, higherIsBetter) {
  if (delta === null || delta === 0) return "→";
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  return improved ? "↑" : "↓";
}
