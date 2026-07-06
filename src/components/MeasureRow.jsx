import { getQuintile, getPoints, getGapToNext } from "../lib/scoring.js";
import { qColor, ptsColor, deltaColor, deltaArrow } from "../lib/colors.js";
import { getLiveCutpoints, getLiveCutpointsFacilityCount } from "../lib/cmsAutofill.js";

const LIVE_COLOR = "#6d28d9";

// Only quintile-scored measures get a live NY benchmark (see QUINTILE_MEASURE_IDS
// in scripts/fetch-cms-data.mjs) — threshold/star/binary measures aren't split into
// quintiles at all, and flu_vax_staff has no public CMS data source to compute one from.
function liveUnavailableNote(m) {
  if (m.scoring === "threshold") return "Threshold-scored measure (pass/fail vs. a fixed bar) — no live quintile benchmark applies.";
  if (m.scoring === "star_map") return "Scored via CMS's own five-star rating — no separate live quintile benchmark applies.";
  if (m.scoring === "binary") return "Binary submission measure — no live quintile benchmark applies.";
  if (m.id === "flu_vax_staff") return "CMS's public data catalog doesn't include employee flu vaccination rates — no live benchmark available.";
  return null;
}

export default function MeasureRow({ m, actual, cutpoints, val, starVal, binaryVal, onValChange, onStarChange, onBinaryChange, year, isAutofilled }) {
  if (m.notTrackable) return <NotTrackableMeasureRow m={m} actual={actual} year={year} />;

  const liveCutpoints = m.scoring === "quintile" ? getLiveCutpoints(m.id) : null;
  const hasLive = !!liveCutpoints;
  const liveCount = hasLive ? getLiveCutpointsFacilityCount(m.id) : null;

  const q2025 = (m.scoring === "quintile" || m.scoring === "quintile_pah") ? getQuintile(m, val, cutpoints) : null;
  const qLive = hasLive ? getQuintile(m, val, liveCutpoints) : null;
  const ptsLive = hasLive ? getPoints(m, val, starVal, binaryVal, liveCutpoints) : null;
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
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>
            {m.short}
            {isAutofilled && <span title="Pre-filled from CMS Care Compare — verify and edit to override" style={{ color: "#0d9488", marginLeft: 4 }}>*</span>}
            {m.pointsApproximate && <span style={{ color: "#d97706", marginLeft: 6 }}>⚠</span>}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{m.full}</div>
          {m.note && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{m.note}</div>}
          {!hasLive && liveUnavailableNote(m) && (
            <div style={{ fontSize: 10, color: "#c4b5fd", marginTop: 2, fontStyle: "italic" }}>{liveUnavailableNote(m)}</div>
          )}
          {hasLive && m.id === "turnover" && (
            <div style={{ fontSize: 10, color: LIVE_COLOR, marginTop: 2, fontStyle: "italic" }}>
              Live benchmark below is a single statewide split — DOH's official cut point is regionally adjusted (see note above).
            </div>
          )}
        </div>
        {ptsDelta !== null && ptsDelta !== 0 && (
          <div style={{ color: ptsDelta > 0 ? "#16a34a" : "#dc2626", fontSize: 12, fontWeight: 700, flexShrink: 0, marginLeft: 10, whiteSpace: "nowrap" }}>
            {ptsDelta > 0 ? `+${ptsDelta}` : ptsDelta} pts
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>

        <div style={{ background: "#fafaf9", borderRadius: 8, padding: "10px 12px", flex: "1 1 150px", minWidth: 150 }}>
          <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.03em", marginBottom: 4 }}>{year} DOH OFFICIAL</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#475569", fontFamily: "monospace", lineHeight: 1, marginBottom: 4 }}>
            {typeof a.value === "number" ? `${a.value}` : (a.value ?? "—")}
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{m.unit}</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {typeof aQuintileNum === "number" && !isNaN(aQuintileNum) && (
              <span style={{ fontSize: 10, background: qc2023 + "14", color: qc2023, border: `1px solid ${qc2023}40`, padding: "1px 6px", borderRadius: 99, fontWeight: 600 }}>Q{aQuintileNum}</span>
            )}
            <span style={{ fontSize: 10, color: "#94a3b8" }}>{a.points}/{m.maxPts} pts</span>
          </div>
        </div>

        {hasLive && (
          <div style={{ background: "#f5f3ff", borderRadius: 8, padding: "10px 12px", flex: "1 1 150px", minWidth: 150 }}>
            <div style={{ fontSize: 10, color: LIVE_COLOR, letterSpacing: "0.03em", marginBottom: 4 }}>LIVE CMS PROJECTION</div>
            {hasVal ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#475569", fontFamily: "monospace", lineHeight: 1, marginBottom: 4 }}>
                  {val}<span style={{ fontSize: 11, color: "#94a3b8" }}>{m.unit}</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {qLive && (
                    <span style={{ fontSize: 10, background: qColor(qLive) + "14", color: qColor(qLive), border: `1px solid ${qColor(qLive)}40`, padding: "1px 6px", borderRadius: 99, fontWeight: 600 }}>Q{qLive}</span>
                  )}
                  {ptsLive !== null && <span style={{ fontSize: 10, color: LIVE_COLOR }}>{ptsLive}/{m.maxPts} pts</span>}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 10, color: "#c4b5fd", marginBottom: 4 }}>enter current value to compare</div>
            )}
            <div style={{ fontSize: 9, color: "#a78bfa", marginTop: 4 }}>vs. {liveCount} NY facilities · directional, not DOH-certified</div>
          </div>
        )}

        <div style={{ background: "#f0fdfa", borderRadius: 8, padding: "10px 12px", flex: "1 1 150px", minWidth: 150 }}>
          <div style={{ fontSize: 10, color: "#0d9488", letterSpacing: "0.03em", marginBottom: 4 }}>CURRENT FULL-YEAR</div>

          {(m.scoring === "quintile" || m.scoring === "quintile_pah" || m.scoring === "threshold") && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <input type="number" value={val} onChange={e => onValChange(e.target.value)}
                placeholder="—" step="0.1"
                style={{ background: "#fff", border: "1px solid #ccfbf1", borderRadius: 6, color: "#0f172a", padding: "4px 8px", fontSize: 17, fontWeight: 700, width: 80, fontFamily: "monospace", outline: "none" }} />
              <span style={{ fontSize: 11, color: "#64748b" }}>{m.unit}</span>
            </div>
          )}

          {m.scoring === "star_map" && (
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => onStarChange(s.toString())}
                  style={{ padding: "3px 6px", borderRadius: 6, border: `1px solid ${starVal === s.toString() ? "#d97706" : "#ccfbf1"}`, background: starVal === s.toString() ? "#fef3c7" : "#fff", color: starVal === s.toString() ? "#b45309" : "#94a3b8", fontSize: 11, cursor: "pointer" }}>
                  {s}★
                </button>
              ))}
            </div>
          )}

          {m.scoring === "binary" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              {["yes", "no"].map(opt => (
                <button key={opt} onClick={() => onBinaryChange(opt)}
                  style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${binaryVal === opt ? "#0d9488" : "#ccfbf1"}`, background: binaryVal === opt ? "#0d9488" : "#fff", color: binaryVal === opt ? "#fff" : "#64748b", fontSize: 11, cursor: "pointer" }}>
                  {opt === "yes" ? "✓ Yes" : "✗ No"}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {q2025 && (
              <span style={{ fontSize: 10, background: qc2025 + "14", color: qc2025, border: `1px solid ${qc2025}40`, padding: "1px 6px", borderRadius: 99, fontWeight: 600 }}>Q{q2025}</span>
            )}
            {pts2025 !== null && (
              <span style={{ fontSize: 10, color: "#0d9488" }}>{pts2025}/{m.maxPts} pts</span>
            )}
            {!hasVal && m.scoring !== "star_map" && m.scoring !== "binary" && <span style={{ fontSize: 10, color: "#5eead4" }}>enter value</span>}
          </div>
          {delta !== null && (
            <div style={{ fontSize: 9, color: dc, marginTop: 4 }}>{da} {Math.abs(delta).toFixed(1)} vs {year}</div>
          )}
        </div>
      </div>

      {cutpoints.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: hasLive ? 4 : 8, flexWrap: "wrap", alignItems: "center" }}>
          {hasLive && <span style={{ fontSize: 9, color: "#94a3b8", marginRight: 2 }}>DOH:</span>}
          {[1, 2, 3, 4, 5].map(qi => {
            const isActive2025 = q2025 === qi;
            const isActive2023 = aQuintileNum === qi;
            const label = m.higherIsBetter
              ? qi === 1 ? `≥${cutpoints[0]}` : qi === 5 ? `<${cutpoints[3]}` : `${cutpoints[qi - 1]}–${cutpoints[qi - 2]}`
              : qi === 1 ? `≤${cutpoints[0]}` : qi === 5 ? `>${cutpoints[3]}` : `${cutpoints[qi - 2]}–${cutpoints[qi - 1]}`;
            const c = qColor(qi);
            return (
              <div key={qi} style={{ padding: "2px 7px", borderRadius: 99, fontSize: 10, background: isActive2025 ? c + "1c" : "#fafaf9", border: `1px solid ${isActive2025 ? c + "60" : "#f0efed"}`, color: isActive2025 ? c : "#94a3b8", fontWeight: isActive2025 ? 600 : 400 }}>
                Q{qi}: {label}{m.unit === "/10k days" || m.unit === "hrs" ? ` ${m.unit}` : "%"}
                {isActive2023 && !isActive2025 && <span style={{ marginLeft: 3, opacity: 0.7 }}>·{String(year).slice(-2)}</span>}
              </div>
            );
          })}
        </div>
      )}

      {hasLive && (
        <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#a78bfa", marginRight: 2 }}>Live:</span>
          {[1, 2, 3, 4, 5].map(qi => {
            const isActiveLive = qLive === qi;
            const label = m.higherIsBetter
              ? qi === 1 ? `≥${liveCutpoints[0]}` : qi === 5 ? `<${liveCutpoints[3]}` : `${liveCutpoints[qi - 1]}–${liveCutpoints[qi - 2]}`
              : qi === 1 ? `≤${liveCutpoints[0]}` : qi === 5 ? `>${liveCutpoints[3]}` : `${liveCutpoints[qi - 2]}–${liveCutpoints[qi - 1]}`;
            return (
              <div key={qi} style={{ padding: "2px 7px", borderRadius: 99, fontSize: 10, background: isActiveLive ? LIVE_COLOR + "14" : "#faf5ff", border: `1px solid ${isActiveLive ? LIVE_COLOR + "60" : "#f3e8ff"}`, color: isActiveLive ? LIVE_COLOR : "#c4b5fd", fontWeight: isActiveLive ? 600 : 400 }}>
                Q{qi}: {label}{m.unit === "/10k days" || m.unit === "hrs" ? ` ${m.unit}` : "%"}
              </div>
            );
          })}
        </div>
      )}

      {(m.scoring === "quintile" || m.scoring === "quintile_pah") && hasVal && q2025 && (
        q2025 === 1 ? (
          <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>▲ Top quintile — best possible score</div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 11 }}>
              <span style={{ color: "#94a3b8" }}>Gap to Q{q2025 - 1}</span>
              <span style={{ color: "#d97706", fontWeight: 600 }}>
                {m.higherIsBetter ? "↑" : "↓"} {gapInfo ? `${gapInfo.gap.toFixed(1)}${m.unit === "%" ? "%" : ` ${m.unit}`} needed` : "—"}
                {gapInfo ? ` · target ${gapInfo.target}${m.unit === "%" ? "%" : ` ${m.unit}`}` : ""}
              </span>
            </div>
            <div style={{ background: "#f0efed", borderRadius: 3, height: 5 }}>
              <div style={{ width: `${progressPct}%`, height: "100%", background: progressPct > 66 ? "#16a34a" : progressPct > 33 ? "#d97706" : "#dc2626", borderRadius: 3, transition: "width 0.3s" }} />
            </div>
          </div>
        )
      )}

      {m.scoring === "threshold" && hasVal && pts2025 !== null && (
        <div style={{ fontSize: 12, color: pts2025 > 0 ? "#16a34a" : "#dc2626" }}>
          {pts2025 > 0 ? `✓ Threshold met — ${pts2025} pts` : `✗ Threshold missed — 0 pts · need ${m.thresholdDir === "lte" ? "≤" : "<"}${m.threshold}%`}
        </div>
      )}
    </div>
  );
}

function NotTrackableMeasureRow({ m, actual, year }) {
  const a = actual || { value: null, quintile: null, points: 0 };
  const aQuintileNum = typeof a.quintile === "string" ? parseInt(a.quintile) : a.quintile;
  const qc2023 = qColor(typeof aQuintileNum === "number" && !isNaN(aQuintileNum) ? aQuintileNum : null);

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>{m.short}</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{m.full}</div>
        {m.note && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{m.note}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 32px 1fr", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <div style={{ background: "#fafaf9", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.03em", marginBottom: 4 }}>LAST RECORDED SCORE</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#475569", fontFamily: "monospace", lineHeight: 1, marginBottom: 4 }}>
            {typeof a.value === "number" ? `${a.value}` : (a.value ?? "—")}
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{m.unit}</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {typeof aQuintileNum === "number" && !isNaN(aQuintileNum) && (
              <span style={{ fontSize: 10, background: qc2023 + "14", color: qc2023, border: `1px solid ${qc2023}40`, padding: "1px 6px", borderRadius: 99, fontWeight: 600 }}>Q{aQuintileNum}</span>
            )}
            <span style={{ fontSize: 10, color: "#94a3b8" }}>{a.points}/{m.maxPts} pts</span>
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 15, color: "#cbd5e1" }}>→</div>

        <div style={{ background: "#fafaf9", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.03em", marginBottom: 4 }}>CURRENT FULL-YEAR</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>Not self-trackable</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Excluded from your current projection</div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#b45309", lineHeight: 1.5 }}>
        ⚠ {m.notTrackableNote}
      </div>
    </div>
  );
}
