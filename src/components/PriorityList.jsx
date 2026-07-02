import { MEASURES, getQuintile, getGapToNext, getCutpoints } from "../lib/scoring.js";
import { qColor } from "../lib/colors.js";

const QUINTILE_POINTS = { quintile: [5, 3, 1, 0, 0], quintile_pah: [10, 8, 6, 2, 0] };

export default function PriorityList({ dataset, facility, vals }) {
  const items = MEASURES
    .filter(m => !m.notTrackable && (m.scoring === "quintile" || m.scoring === "quintile_pah"))
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
    <div style={{ color: "#94a3b8", fontSize: 13, padding: "30px 0", textAlign: "center" }}>
      Enter this facility's current full-year numbers in "Enter Current Numbers" to generate its improvement plan.
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>
        Ranked by remaining point opportunity
      </div>
      {items.some(x => x.m.pointsApproximate) && (
        <div style={{ fontSize: 11, color: "#b45309", marginBottom: 10 }}>
          ⚠ = DOH's real points for this measure sometimes differ ±1 from the standard quintile table — treat this projection as directional.
        </div>
      )}
      {items.map((x, i) => (
        <div key={x.m.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#cbd5e1", fontFamily: "monospace", minWidth: 28 }}>#{i + 1}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>{x.m.short}{x.m.pointsApproximate ? " ⚠" : ""}</span>
              <span style={{ fontSize: 10, background: qColor(x.q) + "14", color: qColor(x.q), border: `1px solid ${qColor(x.q)}40`, padding: "1px 6px", borderRadius: 99 }}>Q{x.q} now</span>
              <span style={{ fontSize: 10, color: "#cbd5e1" }}>→</span>
              <span style={{ fontSize: 10, background: qColor(x.q - 1) + "14", color: qColor(x.q - 1), border: `1px solid ${qColor(x.q - 1)}40`, padding: "1px 6px", borderRadius: 99 }}>Q{x.q - 1} target</span>
            </div>
            <div style={{ fontSize: 12, color: "#d97706" }}>
              {x.m.higherIsBetter ? "↑" : "↓"} Need {x.gapInfo ? `${x.gapInfo.gap.toFixed(1)}${x.m.unit === "%" ? "%" : ` ${x.m.unit}`} improvement` : "—"}
              {x.gapInfo ? ` · target ${x.gapInfo.target}${x.m.unit === "%" ? "%" : ` ${x.m.unit}`}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "center", background: "#f0fdf4", borderRadius: 8, padding: "6px 14px", minWidth: 58 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", fontFamily: "monospace" }}>+{x.ptGain}</div>
            <div style={{ fontSize: 9, color: "#16a34a" }}>points</div>
          </div>
        </div>
      ))}
    </div>
  );
}
