import { MEASURES, getQuintile, getGapToNext, getCutpoints } from "../lib/scoring.js";
import { qColor } from "../lib/colors.js";
import { getCensus, getLiveCutpoints } from "../lib/cmsAutofill.js";
import { getActionPlan } from "../lib/actionPlan.js";

const QUINTILE_POINTS = { quintile: [5, 3, 1, 0, 0], quintile_pah: [10, 8, 6, 2, 0] };
const LIVE_COLOR = "#6d28d9";

export default function PriorityList({ dataset, facility, vals }) {
  const census = getCensus(facility.medicareNumber);
  const items = MEASURES
    .filter(m => !m.notTrackable && (m.scoring === "quintile" || m.scoring === "quintile_pah"))
    .map(m => {
      const cutpoints = getCutpoints(dataset, m.id, facility.region);
      const q = getQuintile(m, vals[m.id], cutpoints);
      const gapInfo = q && q > 1 ? getGapToNext(m, vals[m.id], q, cutpoints) : null;
      const table = QUINTILE_POINTS[m.scoring];
      const ptGain = q ? table[q - 2] - table[q - 1] : 0;
      const actionPlan = getActionPlan(m, gapInfo, census);

      // Live cut-point target — ranks the same entered value against the live
      // NY-wide benchmark instead of DOH's frozen cut points. Only exists for
      // quintile-scored measures with a live split available (see hasLive
      // gating throughout the rest of the app).
      const liveCutpoints = m.scoring === "quintile" ? getLiveCutpoints(m.id) : null;
      const qLive = liveCutpoints ? getQuintile(m, vals[m.id], liveCutpoints) : null;
      const gapInfoLive = liveCutpoints && qLive && qLive > 1 ? getGapToNext(m, vals[m.id], qLive, liveCutpoints) : null;
      const actionPlanLive = getActionPlan(m, gapInfoLive, census);
      const ptGainLive = qLive && qLive > 1 ? table[qLive - 2] - table[qLive - 1] : 0;

      return { m, q, gapInfo, ptGain, actionPlan, qLive, gapInfoLive, actionPlanLive, ptGainLive };
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
      {items.some(x => x.actionPlan) && (
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
          → = a rough headcount plan based on this facility's average daily census from CMS — an estimate, since NHQI measures track long-stay residents specifically, not the full census.
        </div>
      )}
      {items.map((x, i) => (
        <div key={x.m.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#cbd5e1", fontFamily: "monospace", minWidth: 28 }}>#{i + 1}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 600, marginBottom: 4 }}>{x.m.short}{x.m.pointsApproximate ? " ⚠" : ""}</div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", fontSize: 12, marginBottom: 2 }}>
              <span style={{ fontSize: 9, color: "#94a3b8", minWidth: 26 }}>DOH:</span>
              <span style={{ color: qColor(x.q), fontWeight: 600 }}>Q{x.q} → Q{x.q - 1}</span>
              <span style={{ color: "#d97706" }}>
                {x.m.higherIsBetter ? "↑" : "↓"} need {x.gapInfo ? `${x.gapInfo.gap.toFixed(1)}${x.m.unit === "%" ? "%" : ` ${x.m.unit}`} (target ${x.gapInfo.target}${x.m.unit === "%" ? "%" : ` ${x.m.unit}`})` : "—"}
                {x.actionPlan ? ` · ${x.actionPlan}` : ""}
              </span>
            </div>

            {x.qLive !== null && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", fontSize: 12 }}>
                <span style={{ fontSize: 9, color: LIVE_COLOR, minWidth: 26 }}>Live:</span>
                {x.qLive > 1 ? (
                  <>
                    <span style={{ color: qColor(x.qLive), fontWeight: 600 }}>Q{x.qLive} → Q{x.qLive - 1}</span>
                    <span style={{ color: LIVE_COLOR }}>
                      {x.m.higherIsBetter ? "↑" : "↓"} need {x.gapInfoLive ? `${x.gapInfoLive.gap.toFixed(1)}${x.m.unit === "%" ? "%" : ` ${x.m.unit}`} (target ${x.gapInfoLive.target}${x.m.unit === "%" ? "%" : ` ${x.m.unit}`})` : "—"}
                      {x.actionPlanLive ? ` · ${x.actionPlanLive}` : ""}
                    </span>
                  </>
                ) : (
                  <span style={{ color: qColor(x.qLive), fontWeight: 600 }}>Q{x.qLive} — already top quintile</span>
                )}
              </div>
            )}
          </div>
          <div style={{ textAlign: "center", background: "#f0fdf4", borderRadius: 8, padding: "6px 14px", minWidth: 58 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", fontFamily: "monospace" }}>+{x.ptGain}</div>
            <div style={{ fontSize: 9, color: "#16a34a" }}>pts (DOH)</div>
            {x.qLive !== null && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: LIVE_COLOR, fontFamily: "monospace", marginTop: 4 }}>+{x.ptGainLive}</div>
                <div style={{ fontSize: 9, color: LIVE_COLOR }}>pts (Live)</div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
