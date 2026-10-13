import { qColor } from "../lib/colors.js";
import { getNextTierGain } from "../lib/nhqi/scorer.js";

const LIVE_COLOR = "#6d28d9";

// Consumes scorer.js's output directly — no independent point math here. Two kinds of rows:
// real positive point gains (ranked by size), and missing-evidence tasks (measures where the
// input itself is unresolved, so there's nothing to score yet) — never disguised as the same
// thing, and never showing a 0-point "opportunity" dressed up as one.
export default function PriorityList({ scored }) {
  const opportunities = scored.perMeasure
    .filter(r => (r.measure.scoringRule === "quintile" || r.measure.scoringRule === "quintile_pah") && r.currentQuintile && r.currentQuintile > 1)
    .map(r => ({ row: r, gain: getNextTierGain(r) }))
    .filter(x => x.gain !== null && x.gain > 0)
    .sort((a, b) => b.gain - a.gain);

  const missingEvidence = scored.perMeasure.filter(r => r.observation.state === "missing_input" || r.observation.state === "invalid_input");

  if (opportunities.length === 0 && missingEvidence.length === 0) {
    return (
      <div style={{ color: "#94a3b8", fontSize: 13, padding: "30px 0", textAlign: "center" }}>
        No real positive point gains identified from the current entries, and no missing inputs. Everything resolved is at its best tier for the selected benchmark.
      </div>
    );
  }

  return (
    <div>
      {opportunities.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>
            Ranked by attainable point gain — only moves that actually earn points under the applicable 2025 rule for that measure.
          </div>
          {opportunities.map((x, i) => {
            const { row } = x;
            const m = row.measure;
            const label = m.higherIsBetter ? "↑" : "↓";
            return (
              <div key={m.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#cbd5e1", fontFamily: "monospace", minWidth: 28 }}>#{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 600, marginBottom: 4 }}>{m.displayName}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", fontSize: 12 }}>
                    <span style={{ color: qColor(row.currentQuintile), fontWeight: 600 }}>Q{row.currentQuintile} → Q{row.currentQuintile - 1}</span>
                    {row.gapInfo && (
                      <span style={{ color: "#d97706" }}>
                        {label} {row.gapInfo.gap.toFixed(1)}{m.unit === "%" ? "%" : ` ${m.unit}`} needed · target {row.gapInfo.displayTarget}{m.unit === "%" ? "%" : ` ${m.unit}`}
                      </span>
                    )}
                    {row.pointsBasis === "attainment_plus_improvement" && (
                      <span style={{ fontSize: 10, color: LIVE_COLOR }}>(improvement-eligible, prior Q{row.priorQuintile})</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "center", background: "#f0fdf4", borderRadius: 8, padding: "6px 14px", minWidth: 58 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", fontFamily: "monospace" }}>+{x.gain}</div>
                  <div style={{ fontSize: 9, color: "#16a34a" }}>points</div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {missingEvidence.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "#64748b", margin: "18px 0 12px" }}>
            Missing evidence — entering these would resolve a currently-unresolved measure, not a guaranteed gain:
          </div>
          {missingEvidence.map(r => (
            <div key={r.measure.id} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 6, fontSize: 12, color: "#92400e" }}>
              <strong>{r.measure.displayName}</strong> — {r.observation.state === "invalid_input" ? "entered value is invalid" : "not entered"}. Up to {r.measure.maxPoints} pts at stake, period: {r.measure.measurementPeriod?.label ?? "unspecified"}.
            </div>
          ))}
        </>
      )}
    </div>
  );
}
