import { MEASURES, getQuintile, getPoints, getGapToNext, getCutpoints } from "../lib/scoring.js";
import { qColor } from "../lib/colors.js";

const QUINTILE_POINTS = { quintile: [5, 3, 1, 0, 0], quintile_pah: [10, 8, 6, 2, 0] };

export default function PriorityList({ dataset, facility, vals }) {
  const items = MEASURES
    .filter(m => m.scoring === "quintile" || m.scoring === "quintile_pah")
    .map(m => {
      const cutpoints = getCutpoints(dataset, m.id, facility.region);
      const q = getQuintile(m, vals[m.id], cutpoints);
      const gapInfo = q && q > 1 ? getGapToNext(m, vals[m.id], q, cutpoints) : null;
      const table = QUINTILE_POINTS[m.scoring];
      const ptGain = q ? table[q - 2] - table[q - 1] : 0;
      return { m, q, gapInfo, ptGain };
    })
    .filter(x => x.q && x.q > 1)
    .sort((a, b) => b.ptGain !== a.ptGain ? b.ptGain - a.ptGain : (a.gapInfo?.gap ?? 999) - (b.gapInfo?.gap ?? 999));

  if (items.length === 0) return (
    <div style={{ color: "#475569", fontSize: 13, padding: "30px 0", textAlign: "center" }}>
      Enter this facility's 2025 full-year numbers in "Enter 2025 Numbers" to generate its improvement plan.
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 12 }}>
        WHERE THIS FACILITY LANDS IN 2027 — RANKED BY REMAINING POINT OPPORTUNITY
      </div>
      {items.some(x => x.m.pointsApproximate) && (
        <div style={{ fontSize: 10, color: "#f59e0b", marginBottom: 10 }}>
          ⚠ = DOH's real points for this measure sometimes differ ±1 from the standard quintile table — treat this projection as directional.
        </div>
      )}
      {items.map((x, i) => (
        <div key={x.m.id} style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 8, padding: "12px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1e3a5f", fontFamily: "monospace", minWidth: 30 }}>#{i + 1}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{x.m.short}{x.m.pointsApproximate ? " ⚠" : ""}</span>
              <span style={{ fontSize: 10, background: qColor(x.q) + "22", color: qColor(x.q), border: `1px solid ${qColor(x.q)}`, padding: "1px 6px", borderRadius: 3, fontFamily: "monospace" }}>Q{x.q} now</span>
              <span style={{ fontSize: 10, color: "#475569" }}>→</span>
              <span style={{ fontSize: 10, background: qColor(x.q - 1) + "22", color: qColor(x.q - 1), border: `1px solid ${qColor(x.q - 1)}`, padding: "1px 6px", borderRadius: 3, fontFamily: "monospace" }}>Q{x.q - 1} target</span>
            </div>
            <div style={{ fontSize: 11, color: "#f59e0b", fontFamily: "monospace" }}>
              {x.m.higherIsBetter ? "↑" : "↓"} Need {x.gapInfo ? `${x.gapInfo.gap.toFixed(1)}${x.m.unit === "%" ? "%" : ` ${x.m.unit}`} improvement` : "—"}
              {x.gapInfo ? ` · target: ${x.gapInfo.target}${x.m.unit === "%" ? "%" : ` ${x.m.unit}`}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "center", background: "#14532d", border: "1px solid #22c55e", borderRadius: 6, padding: "6px 12px", minWidth: 60 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#22c55e", fontFamily: "monospace" }}>+{x.ptGain}</div>
            <div style={{ fontSize: 9, color: "#16a34a" }}>POINTS</div>
          </div>
        </div>
      ))}
    </div>
  );
}
