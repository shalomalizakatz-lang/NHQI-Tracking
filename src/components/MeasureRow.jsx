import { getQuintile, getPoints, getGapToNext } from "../lib/scoring.js";
import { qColor, ptsColor, deltaColor, deltaArrow } from "../lib/colors.js";

export default function MeasureRow({ m, actual, cutpoints, val, starVal, binaryVal, onValChange, onStarChange, onBinaryChange }) {
  if (m.notTrackable) return <NotTrackableMeasureRow m={m} actual={actual} />;

  const q2025 = (m.scoring === "quintile" || m.scoring === "quintile_pah") ? getQuintile(m, val, cutpoints) : null;
  const pts2025 = getPoints(m, val, starVal, binaryVal, cutpoints);
  const hasVal = val !== "" && val !== null && val !== undefined;
  const gapInfo = (m.scoring === "quintile" || m.scoring === "quintile_pah") && q2025 && q2025 > 1
    ? getGapToNext(m, val, q2025, cutpoints) : null;

  const a = actual || { value: null, quintile: null, points: 0 };
  const numVal2025 = hasVal ? parseFloat(val) : null;
  const delta = numVal2025 !== null && typeof a.value === "number" ? numVal2025 - a.value : null;
  const dc = deltaColor(delta, m.higherIsBetter);
  const da = deltaArrow(delta, m.higherIsBetter);

  const ptsDelta = pts2025 !== null ? pts2025 - a.points : null;

  let progressPct = 0;
  if (gapInfo && cutpoints.length >= 2 && q2025 > 1) {
    const curBound = cutpoints[q2025 - 1];
    const nextBound = cutpoints[q2025 - 2];
    if (m.higherIsBetter) {
      const span = nextBound - curBound;
      progressPct = span > 0 ? Math.min(100, ((parseFloat(val) - curBound) / span) * 100) : 0;
    } else {
      const span = curBound - nextBound;
      progressPct = span > 0 ? Math.min(100, ((curBound - parseFloat(val)) / span) * 100) : 0;
    }
  }

  const qc2025 = qColor(q2025);
  const aQuintileNum = typeof a.quintile === "string" ? parseInt(a.quintile) : a.quintile;
  const qc2023 = qColor(typeof aQuintileNum === "number" && !isNaN(aQuintileNum) ? aQuintileNum : null);

  return (
    <div style={{ background: "#0a1628", border: `1px solid ${hasVal && pts2025 !== null ? ptsColor(pts2025, m.maxPts) + "33" : "#1e293b"}`, borderRadius: 9, padding: "14px 16px", marginBottom: 8 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{m.short}</div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>{m.full}</div>
          {m.note && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{m.note}</div>}
          {m.pointsApproximate && (
            <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>
              ⚠ DOH's real points for this measure sometimes differ ±1 from the standard quintile table (seen in ~18-22% of 2023 facility rows) — likely a statistical-significance adjustment we can't reproduce from published data. Treat 2025 points here as directional.
            </div>
          )}
        </div>
        {ptsDelta !== null && (
          <div style={{ background: ptsDelta > 0 ? "#14532d" : ptsDelta < 0 ? "#450a0a" : "#1e293b", border: `1px solid ${ptsDelta > 0 ? "#22c55e" : ptsDelta < 0 ? "#ef4444" : "#374151"}`, borderRadius: 6, padding: "3px 10px", textAlign: "center", fontSize: 12, fontFamily: "monospace", color: ptsDelta > 0 ? "#22c55e" : ptsDelta < 0 ? "#ef4444" : "#64748b", fontWeight: 700, flexShrink: 0, marginLeft: 10 }}>
            {ptsDelta > 0 ? `+${ptsDelta}` : ptsDelta} pts
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 8, marginBottom: 12, alignItems: "center" }}>

        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 7, padding: "10px 12px" }}>
          <div style={{ fontSize: 9, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 4 }}>2023 ACTUAL</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#94a3b8", fontFamily: "monospace", lineHeight: 1, marginBottom: 4 }}>
            {typeof a.value === "number" ? `${a.value}` : (a.value ?? "—")}
            <span style={{ fontSize: 11, color: "#475569" }}>{m.unit}</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {typeof aQuintileNum === "number" && !isNaN(aQuintileNum) && (
              <span style={{ fontSize: 10, background: qc2023 + "22", color: qc2023, border: `1px solid ${qc2023}`, padding: "1px 6px", borderRadius: 3, fontFamily: "monospace", fontWeight: 700 }}>Q{aQuintileNum}</span>
            )}
            <span style={{ fontSize: 10, color: ptsColor(a.points, m.maxPts), fontFamily: "monospace" }}>{a.points}/{m.maxPts} pts</span>
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          {delta !== null ? (
            <div>
              <div style={{ fontSize: 16, color: dc, fontWeight: 700 }}>{da}</div>
              <div style={{ fontSize: 9, color: dc, fontFamily: "monospace" }}>{Math.abs(delta).toFixed(1)}</div>
            </div>
          ) : (
            <div style={{ fontSize: 16, color: "#1e293b" }}>→</div>
          )}
        </div>

        <div style={{ background: "#0f172a", border: `1px solid ${hasVal && pts2025 !== null ? ptsColor(pts2025, m.maxPts) + "66" : "#374151"}`, borderRadius: 7, padding: "10px 12px" }}>
          <div style={{ fontSize: 9, color: "#60a5fa", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 4 }}>2025 FULL-YEAR</div>

          {(m.scoring === "quintile" || m.scoring === "quintile_pah" || m.scoring === "threshold") && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <input type="number" value={val} onChange={e => onValChange(e.target.value)}
                placeholder="—" step="0.1"
                style={{ background: "#1e293b", border: "none", borderRadius: 4, color: "#f1f5f9", padding: "4px 6px", fontSize: 18, fontWeight: 700, width: 80, fontFamily: "monospace", outline: "none" }} />
              <span style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{m.unit}</span>
            </div>
          )}

          {m.scoring === "star_map" && (
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => onStarChange(s.toString())}
                  style={{ padding: "3px 6px", borderRadius: 3, border: `1px solid ${starVal === s.toString() ? "#f59e0b" : "#374151"}`, background: starVal === s.toString() ? "#78350f" : "#1e293b", color: starVal === s.toString() ? "#fbbf24" : "#6b7280", fontSize: 11, cursor: "pointer" }}>
                  {s}★
                </button>
              ))}
            </div>
          )}

          {m.scoring === "binary" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              {["yes", "no"].map(opt => (
                <button key={opt} onClick={() => onBinaryChange(opt)}
                  style={{ padding: "4px 12px", borderRadius: 4, border: `1px solid ${binaryVal === opt ? "#3b82f6" : "#374151"}`, background: binaryVal === opt ? "#1d4ed8" : "#1e293b", color: binaryVal === opt ? "#fff" : "#6b7280", fontSize: 11, cursor: "pointer" }}>
                  {opt === "yes" ? "✓ Yes" : "✗ No"}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {q2025 && (
              <span style={{ fontSize: 10, background: qc2025 + "22", color: qc2025, border: `1px solid ${qc2025}`, padding: "1px 6px", borderRadius: 3, fontFamily: "monospace", fontWeight: 700 }}>Q{q2025}</span>
            )}
            {pts2025 !== null && (
              <span style={{ fontSize: 10, color: ptsColor(pts2025, m.maxPts), fontFamily: "monospace" }}>{pts2025}/{m.maxPts} pts</span>
            )}
            {!hasVal && m.scoring !== "star_map" && m.scoring !== "binary" && <span style={{ fontSize: 10, color: "#374151" }}>enter value</span>}
          </div>
        </div>
      </div>

      {cutpoints.length > 0 && (
        <div style={{ display: "flex", gap: 3, marginBottom: 8, flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5].map(qi => {
            const isActive2025 = q2025 === qi;
            const isActive2023 = aQuintileNum === qi;
            const label = m.higherIsBetter
              ? qi === 1 ? `≥${cutpoints[0]}` : qi === 5 ? `<${cutpoints[3]}` : `${cutpoints[qi - 1]}–${cutpoints[qi - 2]}`
              : qi === 1 ? `≤${cutpoints[0]}` : qi === 5 ? `>${cutpoints[3]}` : `${cutpoints[qi - 2]}–${cutpoints[qi - 1]}`;
            const border = isActive2025 ? qColor(qi) : isActive2023 ? qColor(qi) + "88" : "#1e293b";
            return (
              <div key={qi} style={{ padding: "2px 7px", borderRadius: 3, fontSize: 9, fontFamily: "monospace", background: isActive2025 ? qColor(qi) + "33" : isActive2023 ? qColor(qi) + "11" : "#0f172a", border: `1px solid ${border}`, color: isActive2025 ? qColor(qi) : isActive2023 ? qColor(qi) + "88" : "#374151", fontWeight: isActive2025 ? 700 : 400 }}>
                Q{qi}: {label}{m.unit === "/10k days" || m.unit === "hrs" ? ` ${m.unit}` : "%"}
                {isActive2023 && !isActive2025 && <span style={{ fontSize: 8, marginLeft: 3, opacity: 0.6 }}>↑23</span>}
                {isActive2025 && <span style={{ fontSize: 8, marginLeft: 3 }}>●</span>}
              </div>
            );
          })}
        </div>
      )}

      {(m.scoring === "quintile" || m.scoring === "quintile_pah") && hasVal && q2025 && (
        q2025 === 1 ? (
          <div style={{ fontSize: 11, color: "#22c55e", fontFamily: "monospace", fontWeight: 600 }}>▲ TOP QUINTILE — best possible score</div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 10, fontFamily: "monospace" }}>
              <span style={{ color: "#64748b" }}>GAP TO Q{q2025 - 1}</span>
              <span style={{ color: "#f59e0b", fontWeight: 600 }}>
                {m.higherIsBetter ? "↑" : "↓"} {gapInfo ? `${gapInfo.gap.toFixed(1)}${m.unit === "%" ? "%" : ` ${m.unit}`} needed` : "—"}
                {gapInfo ? ` · target: ${gapInfo.target}${m.unit === "%" ? "%" : ` ${m.unit}`}` : ""}
              </span>
            </div>
            <div style={{ background: "#1e293b", borderRadius: 2, height: 5 }}>
              <div style={{ width: `${progressPct}%`, height: "100%", background: progressPct > 66 ? "#22c55e" : progressPct > 33 ? "#f59e0b" : "#ef4444", borderRadius: 2, transition: "width 0.3s" }} />
            </div>
          </div>
        )
      )}

      {m.scoring === "threshold" && hasVal && pts2025 !== null && (
        <div style={{ fontSize: 11, fontFamily: "monospace", color: pts2025 > 0 ? "#22c55e" : "#ef4444" }}>
          {pts2025 > 0 ? `✓ Threshold met → ${pts2025} pts` : `✗ Threshold missed → 0 pts · Need ${m.thresholdDir === "lte" ? "≤" : "<"}${m.threshold}%`}
        </div>
      )}
    </div>
  );
}

function NotTrackableMeasureRow({ m, actual }) {
  const a = actual || { value: null, quintile: null, points: 0 };
  const aQuintileNum = typeof a.quintile === "string" ? parseInt(a.quintile) : a.quintile;
  const qc2023 = qColor(typeof aQuintileNum === "number" && !isNaN(aQuintileNum) ? aQuintileNum : null);

  return (
    <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 9, padding: "14px 16px", marginBottom: 8 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{m.short}</div>
        <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>{m.full}</div>
        {m.note && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{m.note}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 7, padding: "10px 12px" }}>
          <div style={{ fontSize: 9, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 4 }}>LAST RECORDED SCORE</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#94a3b8", fontFamily: "monospace", lineHeight: 1, marginBottom: 4 }}>
            {typeof a.value === "number" ? `${a.value}` : (a.value ?? "—")}
            <span style={{ fontSize: 11, color: "#475569" }}>{m.unit}</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {typeof aQuintileNum === "number" && !isNaN(aQuintileNum) && (
              <span style={{ fontSize: 10, background: qc2023 + "22", color: qc2023, border: `1px solid ${qc2023}`, padding: "1px 6px", borderRadius: 3, fontFamily: "monospace", fontWeight: 700 }}>Q{aQuintileNum}</span>
            )}
            <span style={{ fontSize: 10, color: ptsColor(a.points, m.maxPts), fontFamily: "monospace" }}>{a.points}/{m.maxPts} pts</span>
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 16, color: "#1e293b" }}>→</div>

        <div style={{ background: "#0f172a", border: "1px solid #374151", borderRadius: 7, padding: "10px 12px" }}>
          <div style={{ fontSize: 9, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 4 }}>2025 FULL-YEAR</div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Not self-trackable</div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>Carried forward from last recorded score</div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#f59e0b", fontFamily: "monospace", lineHeight: 1.5 }}>
        ⚠ {m.notTrackableNote}
      </div>
    </div>
  );
}
