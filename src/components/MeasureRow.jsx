import { qColor, deltaColor, deltaArrow } from "../lib/colors.js";

// Renders one measure's editable "current" input plus its scored result, where `scored` is
// the exact per-measure object scorer.js produced for this measure — this component no
// longer computes quintiles/points itself (that used to duplicate scoring.js's logic and is
// why the quintile-range pills used to render on threshold/star/binary rows that don't even
// use quintile cutpoints). `benchmark` is whichever single benchmark is currently selected
// (2023 official cutpoints or the live CMS benchmark) — only one benchmark's pills are shown
// at a time; switching benchmarks is a toggle one level up, not a second column here.

const STATE_LABEL = {
  missing_input: "Not entered",
  unavailable_source: "No source data",
  invalid_input: "Invalid value",
  stale_noncomparable: "Legacy value, period unverified",
  suppressed_official: "Officially suppressed (small sample)",
};
const STATE_COLOR = {
  missing_input: "#94a3b8",
  unavailable_source: "#94a3b8",
  invalid_input: "#dc2626",
  stale_noncomparable: "#d97706",
  suppressed_official: "#64748b",
};

export default function MeasureRow({ m, actual, scored, benchmark, val, starVal, binaryVal, onValChange, onStarChange, onBinaryChange, isAutofilled, year }) {
  if (m.id === "pah") return <PahMeasureRow m={m} actual={actual} scored={scored} year={year} />;

  const isQuintile = m.scoringRule === "quintile";
  const observation = scored?.observation;
  const hasVal = val !== "" && val !== null && val !== undefined;
  const currentQuintile = scored?.currentQuintile ?? null;
  const points = scored?.points ?? null;
  const cutpoints = isQuintile ? benchmark?.getCutpoints?.(m.id) : null;

  const a = actual || { value: null, quintile: null, points: 0 };
  const numVal = hasVal ? parseFloat(val) : null;
  const delta = numVal !== null && typeof a.value === "number" ? numVal - a.value : null;
  const dc = deltaColor(delta, m.higherIsBetter);
  const da = deltaArrow(delta, m.higherIsBetter);

  const aQuintileNum = typeof a.quintile === "string" ? parseInt(a.quintile) : a.quintile;
  const qc2023 = qColor(typeof aQuintileNum === "number" && !isNaN(aQuintileNum) ? aQuintileNum : null);
  const qcCurrent = qColor(currentQuintile);

  let progressPct = 0;
  if (scored?.gapInfo && currentQuintile > 1) {
    const { target } = scored.gapInfo;
    const curBound = cutpoints?.[currentQuintile - 1];
    if (m.higherIsBetter) {
      const span = target - curBound;
      progressPct = span > 0 ? Math.min(100, ((numVal - curBound) / span) * 100) : 0;
    } else {
      const span = curBound - target;
      progressPct = span > 0 ? Math.min(100, ((curBound - numVal) / span) * 100) : 0;
    }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>
            {m.displayName}
            {isAutofilled && <span title="Pre-filled from CMS Care Compare — verify and edit to override" style={{ color: "#0d9488", marginLeft: 4 }}>*</span>}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{m.officialName}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
            Period: {m.measurementPeriod?.label ?? "unspecified"}
            {m.measurementPeriod?.source?.startsWith("gov_unreachable") && " (not independently verified)"}
          </div>
          {m.note && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{m.note}</div>}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div style={{ background: "#fafaf9", borderRadius: 8, padding: "10px 12px", flex: "1 1 150px", minWidth: 150 }}>
          <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.03em", marginBottom: 4 }}>OFFICIAL {year} RESULT</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#475569", fontFamily: "monospace", lineHeight: 1, marginBottom: 4 }}>
            {typeof a.value === "number" ? `${a.value}` : (a.value ?? "—")}
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{m.unit}</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {typeof aQuintileNum === "number" && !isNaN(aQuintileNum) && (
              <span style={{ fontSize: 10, background: qc2023 + "14", color: qc2023, border: `1px solid ${qc2023}40`, padding: "1px 6px", borderRadius: 99, fontWeight: 600 }}>Q{aQuintileNum}</span>
            )}
            <span style={{ fontSize: 10, color: "#94a3b8" }}>{a.points}/{m.maxPoints} pts</span>
          </div>
        </div>

        <div style={{ background: "#f0fdfa", borderRadius: 8, padding: "10px 12px", flex: "1 1 150px", minWidth: 150 }}>
          <div style={{ fontSize: 10, color: "#0d9488", letterSpacing: "0.03em", marginBottom: 4 }}>CURRENT ENTRY</div>

          {(m.scoringRule === "quintile" || m.scoringRule === "threshold") && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <input type="number" value={val} onChange={e => onValChange(e.target.value)}
                placeholder="—" step="0.1"
                style={{ background: "#fff", border: "1px solid #ccfbf1", borderRadius: 6, color: "#0f172a", padding: "4px 8px", fontSize: 17, fontWeight: 700, width: 80, fontFamily: "monospace", outline: "none" }} />
              <span style={{ fontSize: 11, color: "#64748b" }}>{m.unit}</span>
            </div>
          )}

          {m.scoringRule === "star_map" && (
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => onStarChange(s.toString())}
                  style={{ padding: "3px 6px", borderRadius: 6, border: `1px solid ${starVal === s.toString() ? "#d97706" : "#ccfbf1"}`, background: starVal === s.toString() ? "#fef3c7" : "#fff", color: starVal === s.toString() ? "#b45309" : "#94a3b8", fontSize: 11, cursor: "pointer" }}>
                  {s}★
                </button>
              ))}
            </div>
          )}

          {m.scoringRule === "binary" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              {["yes", "no"].map(opt => (
                <button key={opt} onClick={() => onBinaryChange(opt)}
                  style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${binaryVal === opt ? "#0d9488" : "#ccfbf1"}`, background: binaryVal === opt ? "#0d9488" : "#fff", color: binaryVal === opt ? "#fff" : "#64748b", fontSize: 11, cursor: "pointer" }}>
                  {opt === "yes" ? "✓ Yes" : "✗ No"}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {observation && observation.state !== "valid" ? (
              <span style={{ fontSize: 10, color: STATE_COLOR[observation.state] }}>{STATE_LABEL[observation.state]}</span>
            ) : (
              <>
                {isQuintile && currentQuintile && (
                  <span style={{ fontSize: 10, background: qcCurrent + "14", color: qcCurrent, border: `1px solid ${qcCurrent}40`, padding: "1px 6px", borderRadius: 99, fontWeight: 600 }}>Q{currentQuintile}</span>
                )}
                {points !== null ? (
                  <span style={{ fontSize: 10, color: "#0d9488" }}>{points}/{m.maxPoints} pts{scored?.pointsBasis === "attainment_plus_improvement" ? " (incl. improvement)" : ""}</span>
                ) : (
                  <span style={{ fontSize: 10, color: "#b45309" }}>Unresolved{scored?.unresolvedReason ? `: ${scored.unresolvedReason}` : ""}</span>
                )}
              </>
            )}
          </div>
          {delta !== null && (
            <div style={{ fontSize: 9, color: dc, marginTop: 4 }}>{da} {Math.abs(delta).toFixed(1)} vs official {year}</div>
          )}
        </div>
      </div>

      {isQuintile && cutpoints && cutpoints.length >= 4 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#94a3b8", marginRight: 2 }}>{benchmark.label}:</span>
          {[1, 2, 3, 4, 5].map(qi => {
            const isActiveCurrent = currentQuintile === qi;
            const isActiveOfficial = aQuintileNum === qi;
            const label = m.higherIsBetter
              ? qi === 1 ? `>${cutpoints[0]}` : qi === 5 ? `≤${cutpoints[3]}` : `${cutpoints[qi - 1]}–${cutpoints[qi - 2]}`
              : qi === 1 ? `≤${cutpoints[0]}` : qi === 5 ? `>${cutpoints[3]}` : `${cutpoints[qi - 2]}–${cutpoints[qi - 1]}`;
            const c = qColor(qi);
            return (
              <div key={qi} style={{ padding: "2px 7px", borderRadius: 99, fontSize: 10, background: isActiveCurrent ? c + "1c" : "#fafaf9", border: `1px solid ${isActiveCurrent ? c + "60" : "#f0efed"}`, color: isActiveCurrent ? c : "#94a3b8", fontWeight: isActiveCurrent ? 600 : 400 }}>
                Q{qi}: {label}{m.unit}
                {isActiveOfficial && !isActiveCurrent && <span style={{ marginLeft: 3, opacity: 0.7 }}>·official</span>}
              </div>
            );
          })}
        </div>
      )}

      {isQuintile && hasVal && currentQuintile && (
        currentQuintile === 1 ? (
          <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>▲ Top quintile, {benchmark?.label ?? "selected benchmark"}</div>
        ) : scored?.gapInfo ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 11 }}>
              <span style={{ color: "#94a3b8" }}>Gap to Q{currentQuintile - 1}</span>
              <span style={{ color: "#d97706", fontWeight: 600 }}>
                {m.higherIsBetter ? "↑" : "↓"} {scored.gapInfo.gap.toFixed(1)}{m.unit === "%" ? "%" : ` ${m.unit}`} needed · target {scored.gapInfo.displayTarget}{m.unit === "%" ? "%" : ` ${m.unit}`}
              </span>
            </div>
            <div style={{ background: "#f0efed", borderRadius: 3, height: 5 }}>
              <div style={{ width: `${progressPct}%`, height: "100%", background: progressPct > 66 ? "#16a34a" : progressPct > 33 ? "#d97706" : "#dc2626", borderRadius: 3, transition: "width 0.3s" }} />
            </div>
          </div>
        ) : null
      )}

      {m.scoringRule === "threshold" && hasVal && points !== null && (
        <div style={{ fontSize: 12, color: points > 0 ? "#16a34a" : "#dc2626" }}>
          {points > 0 ? `✓ Threshold met — ${points} pts` : `✗ Threshold missed — 0 pts · need ${m.thresholdDir === "lte" ? "≤" : "<"}${m.threshold}%`}
        </div>
      )}

      {isQuintile && scored?.unresolvedReason && scored.unresolvedReason.includes("prior-year") && (
        <div style={{ fontSize: 11, color: "#b45309", marginTop: 6 }}>
          This measure earns improvement credit in the 2025 methodology, but the prior-year quintile needed to resolve it isn't known
          {scored.priorQuintile === null ? " for this facility." : "."}
        </div>
      )}
    </div>
  );
}

function PahMeasureRow({ m, actual, scored, year }) {
  const a = actual || { value: null, quintile: null, points: 0 };
  const aQuintileNum = typeof a.quintile === "string" ? parseInt(a.quintile) : a.quintile;
  const qc2023 = qColor(typeof aQuintileNum === "number" && !isNaN(aQuintileNum) ? aQuintileNum : null);

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>{m.displayName}</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{m.officialName}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 32px 1fr", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <div style={{ background: "#fafaf9", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.03em", marginBottom: 4 }}>OFFICIAL {year} RESULT</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#475569", fontFamily: "monospace", lineHeight: 1, marginBottom: 4 }}>
            {typeof a.value === "number" ? `${a.value}` : (a.value ?? "—")}
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{m.unit}</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {typeof aQuintileNum === "number" && !isNaN(aQuintileNum) && (
              <span style={{ fontSize: 10, background: qc2023 + "14", color: qc2023, border: `1px solid ${qc2023}40`, padding: "1px 6px", borderRadius: 99, fontWeight: 600 }}>Q{aQuintileNum}</span>
            )}
            <span style={{ fontSize: 10, color: "#94a3b8" }}>{a.points}/{m.maxPoints} pts</span>
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 15, color: "#cbd5e1" }}>→</div>

        <div style={{ background: "#fafaf9", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.03em", marginBottom: 4 }}>CURRENT CYCLE</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {scored?.scenario === "official" ? `Using official ${year} result` : scored?.scenario !== null && scored?.scenario !== undefined ? `Scenario: ${scored.scenario} pts` : "Not self-trackable"}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            {scored?.points !== null ? `${scored.points}/${m.maxPoints} pts` : "Unresolved"}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#b45309", lineHeight: 1.5 }}>
        ⚠ {m.applicability?.note}
      </div>
    </div>
  );
}
