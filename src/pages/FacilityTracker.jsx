import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { loadActiveDataset, findFacilityById } from "../lib/dataset.js";
import { getInputs, saveInputs, resetInputs, renameFacility, getPortfolio } from "../lib/storage.js";
import { MEASURES, SECTION_MAX, getCutpoints, getQuintile, computeFacilitySummary, getDisplayed2025Points } from "../lib/scoring.js";
import { qColor, ptsColor } from "../lib/colors.js";
import MeasureRow from "../components/MeasureRow.jsx";
import PriorityList from "../components/PriorityList.jsx";
import { downloadFacilityPdf } from "../lib/pdfExport.jsx";

const SECTIONS = [
  { key: "quality", label: "Quality Measures" },
  { key: "compliance", label: "Compliance" },
  { key: "efficiency", label: "Efficiency — PAH" },
];

export default function FacilityTracker() {
  const { facilityId } = useParams();
  const navigate = useNavigate();
  const [dataset] = useState(() => loadActiveDataset());
  const facility = useMemo(() => findFacilityById(dataset, facilityId), [dataset, facilityId]);
  const portfolioEntry = useMemo(() => getPortfolio().find(p => p.facilityId === facilityId), [facilityId]);

  const [tab, setTab] = useState("dashboard");
  const [vals, setVals] = useState({});
  const [starVals, setStarVals] = useState({});
  const [binaryVals, setBinaryVals] = useState({});
  const [saveStatus, setSaveStatus] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    const stored = getInputs(facilityId);
    setVals(stored.vals || {});
    setStarVals(stored.starVals || {});
    setBinaryVals(stored.binaryVals || {});
  }, [facilityId]);

  // Keep a ref to the latest values so the unmount-flush effect below (which
  // must have empty deps to only fire on true unmount) can still read them.
  const latestRef = useRef({ vals, starVals, binaryVals, facilityId });
  latestRef.current = { vals, starVals, binaryVals, facilityId };

  useEffect(() => {
    setSaveStatus("saving");
    const t = setTimeout(() => {
      saveInputs(facilityId, { vals, starVals, binaryVals });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 1500);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals, starVals, binaryVals, facilityId]);

  // Flush any pending debounced save immediately when navigating away —
  // otherwise a route change within the 500ms debounce window silently
  // discards the last edit (the cleanup above only cancels the timer).
  useEffect(() => {
    return () => {
      const latest = latestRef.current;
      saveInputs(latest.facilityId, { vals: latest.vals, starVals: latest.starVals, binaryVals: latest.binaryVals });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!facility) {
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto text-center text-slate-400">
        Facility not found in the active dataset.
        <div className="mt-4"><Link to="/" className="text-blue-400 hover:underline">← Back to Portfolio</Link></div>
      </div>
    );
  }

  const setVal = (id, v) => setVals(p => ({ ...p, [id]: v }));
  const setStar = (id, v) => setStarVals(p => ({ ...p, [id]: v }));
  const setBinary = (id, v) => setBinaryVals(p => ({ ...p, [id]: v }));

  const displayName = portfolioEntry?.displayName || facility.name;
  const summary = computeFacilitySummary(dataset, facility, { vals, starVals, binaryVals });
  const qc = summary.quintile2027 !== null ? qColor(summary.quintile2027) : "#374151";

  function handleRename() {
    if (nameDraft.trim()) renameFacility(facilityId, nameDraft.trim());
    setRenaming(false);
  }

  function handleReset() {
    if (!window.confirm("Clear all entered 2025 data for this facility?")) return;
    setVals({}); setStarVals({}); setBinaryVals({});
    resetInputs(facilityId);
  }

  const TAB = active => ({
    padding: "8px 18px", border: "none", background: "transparent",
    color: active ? "#f1f5f9" : "#64748b", fontSize: 13, fontWeight: active ? 600 : 400,
    cursor: "pointer", borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
    fontFamily: "inherit",
  });

  return (
    <div>
      <div style={{ borderBottom: "1px solid #1e293b", padding: "14px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 5, height: 26, background: "#3b82f6", borderRadius: 2 }} />
          <div>
            <Link to="/" style={{ fontSize: 11, color: "#3b82f6", textDecoration: "none" }}>← Portfolio</Link>
            {renaming ? (
              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleRename()}
                  style={{ background: "#1e293b", border: "1px solid #3b82f6", borderRadius: 4, color: "#f1f5f9", padding: "2px 6px", fontSize: 14 }} />
                <button onClick={handleRename} style={{ fontSize: 11, color: "#22c55e", background: "none", border: "none", cursor: "pointer" }}>Save</button>
                <button onClick={() => setRenaming(false)} style={{ fontSize: 11, color: "#64748b", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
              </div>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                {displayName}
                <button onClick={() => { setNameDraft(displayName); setRenaming(true); }}
                  style={{ fontSize: 10, color: "#475569", background: "none", border: "none", cursor: "pointer" }}>✎ rename</button>
              </div>
            )}
            <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.08em" }}>
              NY DOH NHQI · {dataset.year} Actual vs. 2025 Full-Year · {facility.city}, {facility.county} ({facility.region})
            </div>
            {saveStatus === "saving" && <div style={{ fontSize: 9, color: "#f59e0b", fontFamily: "monospace", marginTop: 2 }}>● Saving...</div>}
            {saveStatus === "saved" && <div style={{ fontSize: 9, color: "#22c55e", fontFamily: "monospace", marginTop: 2 }}>✓ Saved</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.1em" }}>{dataset.year} SCORE</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#94a3b8", fontFamily: "monospace" }}>{summary.score2023}<span style={{ fontSize: 11, color: "#374151" }}>/90</span></div>
          </div>
          {summary.score2025 !== null && (
            <>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "#60a5fa", fontFamily: "monospace", letterSpacing: "0.1em" }}>2025 SCORE</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", fontFamily: "monospace" }}>{summary.score2025}<span style={{ fontSize: 11, color: "#374151" }}>/90</span></div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: summary.ptsDelta > 0 ? "#22c55e" : summary.ptsDelta < 0 ? "#ef4444" : "#64748b", fontFamily: "monospace" }}>
                    {summary.ptsDelta > 0 ? `+${summary.ptsDelta}` : summary.ptsDelta}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "#60a5fa", fontFamily: "monospace", letterSpacing: "0.1em" }}>EST. 2027 QUINTILE</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: qc, fontFamily: "monospace" }}>Q{summary.quintile2027}</div>
              </div>
            </>
          )}
          <button
            onClick={() => downloadFacilityPdf({ dataset, facility, displayName, vals, starVals, binaryVals, summary })}
            style={{ background: "#1d4ed8", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, padding: "8px 14px", cursor: "pointer", fontWeight: 600 }}
          >
            ⬇ Export PDF
          </button>
        </div>
      </div>

      <div style={{ borderBottom: "1px solid #1e293b", padding: "0 22px", display: "flex", gap: 2 }}>
        <button style={TAB(tab === "dashboard")} onClick={() => setTab("dashboard")}>📊 Dashboard</button>
        <button style={TAB(tab === "measures")} onClick={() => setTab("measures")}>📋 Enter 2025 Numbers</button>
        <button style={TAB(tab === "priority")} onClick={() => setTab("priority")}>🎯 2027 Prediction</button>
      </div>

      <div style={{ padding: "20px 22px", maxWidth: 820, margin: "0 auto" }}>
        {tab === "dashboard" && (
          <DashboardTab dataset={dataset} facility={facility} summary={summary} vals={vals} starVals={starVals} binaryVals={binaryVals} qc={qc} />
        )}
        {tab === "measures" && (
          <MeasuresTab dataset={dataset} facility={facility} vals={vals} starVals={starVals} binaryVals={binaryVals}
            setVal={setVal} setStar={setStar} setBinary={setBinary} onReset={handleReset} />
        )}
        {tab === "priority" && (
          <div>
            <div style={{ background: "#0c1a3a", border: "1px solid #1d4ed8", borderRadius: 7, padding: "9px 14px", marginBottom: 16, fontSize: 12, color: "#93c5fd", fontFamily: "monospace" }}>
              ▸ {dataset.year}: <strong>{summary.score2023}/90 pts → {summary.quintile2023 ? `Q${summary.quintile2023}` : "—"}</strong>
              {summary.score2025 !== null && (
                <span> · 2025: <strong style={{ color: qc }}>{summary.score2025}/90 pts → est. Q{summary.quintile2027}</strong>
                  <span style={{ color: summary.ptsDelta > 0 ? "#22c55e" : "#ef4444", marginLeft: 6 }}>{summary.ptsDelta > 0 ? `+${summary.ptsDelta}` : summary.ptsDelta} pts from {dataset.year}</span>
                </span>
              )}
            </div>
            <PriorityList dataset={dataset} facility={facility} vals={vals} />
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardTab({ dataset, facility, summary, vals, starVals, binaryVals, qc }) {
  const bySection = key => MEASURES.filter(m => m.section === key);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {[
          { label: `${dataset.year} ACTUAL SCORE`, val: `${summary.score2023}/90`, sub: `Actual · drove ${dataset.year} payment`, color: "#94a3b8" },
          { label: "2025 FULL-YEAR SCORE", val: summary.score2025 !== null ? `${summary.score2025}/90` : "—", sub: summary.entered > 0 ? `${summary.entered}/${MEASURES.length} measures entered` : "Enter current data", color: "#60a5fa" },
          { label: "EST. 2027 QUINTILE", val: summary.quintile2027 !== null ? `Q${summary.quintile2027}` : "—", sub: summary.quintile2027 !== null ? (summary.quintile2027 <= 3 ? "Quality Pool: positive +" : "Quality Pool: negative −") : "Projected from 2025 rates", color: qc },
        ].map(c => (
          <div key={c.label} style={{ flex: "1 1 200px", background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 9, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: c.color, fontFamily: "monospace", lineHeight: 1, marginBottom: 4 }}>{c.val}</div>
            <div style={{ fontSize: 11, color: "#475569" }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 12 }}>SCORE BY SECTION — {dataset.year} ACTUAL vs. 2025 FULL-YEAR</div>
        {[
          { key: "quality", label: `Quality (${bySection("quality").length} measures)` },
          { key: "compliance", label: `Compliance (${bySection("compliance").length} measures)` },
          { key: "efficiency", label: "Efficiency — PAH" },
        ].map(sec => {
          const measures = bySection(sec.key);
          const max = SECTION_MAX[sec.key];
          const pts23 = measures.reduce((a, m) => a + (facility.actuals[m.id]?.points ?? 0), 0);
          const pts25 = measures.reduce((a, m) => {
            const p = getDisplayed2025Points(dataset, facility, m, vals, starVals, binaryVals, summary.entered > 0);
            return a + (p ?? 0);
          }, 0);
          const pct23 = (pts23 / max) * 100;
          const pct25 = (pts25 / max) * 100;
          return (
            <div key={sec.key} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: "#94a3b8" }}>{sec.label}</span>
                <span style={{ fontFamily: "monospace" }}>
                  <span style={{ color: "#64748b" }}>{dataset.year}: {pts23}/{max}</span>
                  {summary.entered > 0 && <span style={{ color: "#60a5fa", marginLeft: 12 }}>2025: {pts25}/{max}</span>}
                </span>
              </div>
              <div style={{ position: "relative", background: "#1e293b", borderRadius: 3, height: 8 }}>
                <div style={{ position: "absolute", left: 0, top: 0, width: `${pct23}%`, height: "100%", background: "#475569", borderRadius: 3 }} />
                {summary.entered > 0 && <div style={{ position: "absolute", left: 0, top: 0, width: `${pct25}%`, height: "100%", background: "#3b82f6", borderRadius: 3, opacity: 0.8 }} />}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 10 }}>ALL MEASURES AT A GLANCE</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px" }}>
          {MEASURES.map(m => {
            const cutpoints = getCutpoints(dataset, m.id, facility.region);
            const q25 = (!m.notTrackable && (m.scoring === "quintile" || m.scoring === "quintile_pah")) ? getQuintile(m, vals[m.id], cutpoints) : null;
            const pts25 = getDisplayed2025Points(dataset, facility, m, vals, starVals, binaryVals, summary.entered > 0);
            const a = facility.actuals[m.id] || { quintile: null, points: 0 };
            const aQ = typeof a.quintile === "string" ? parseInt(a.quintile) : a.quintile;
            const moved = typeof aQ === "number" && !isNaN(aQ) && q25 !== null && q25 !== aQ;
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: "1px solid #0f172a" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: pts25 !== null ? ptsColor(pts25, m.maxPts) : "#1e293b", flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 11, color: pts25 !== null ? "#e2e8f0" : "#374151" }}>{m.short}</div>
                <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>
                  {typeof aQ === "number" && !isNaN(aQ) ? <span style={{ color: qColor(aQ) }}>Q{aQ}</span> : <span>—</span>}
                  {q25 && <span style={{ color: moved ? (q25 < aQ ? "#22c55e" : "#ef4444") : "#475569" }}> → Q{q25}</span>}
                </div>
                <div style={{ fontSize: 10, fontFamily: "monospace", minWidth: 50, textAlign: "right", color: "#475569" }}>
                  <span style={{ color: "#64748b" }}>{a.points ?? 0}</span>
                  {pts25 !== null && <span style={{ color: "#60a5fa" }}> → {pts25}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 12, padding: "9px 12px", background: "#0a1628", border: "1px solid #1e293b", borderRadius: 6, fontSize: 10, color: "#475569", fontFamily: "monospace" }}>
        ℹ {dataset.year} actuals pulled directly from NY DOH NHQI dataset for {facility.name} (Facility ID {facility.id}). 2025 full-year values are internal tracking numbers. Cut points from the {dataset.year} NY DOH dataset, regionally adjusted where applicable ({facility.region}) — actual future quintile placement depends on that year's statewide distribution. PAH cannot be self-tracked; it requires DOH's MDS→SPARCS match, so treat that measure's 2025 entry as an estimate only.
      </div>
    </div>
  );
}

function MeasuresTab({ dataset, facility, vals, starVals, binaryVals, setVal, setStar, setBinary, onReset }) {
  const bySection = key => MEASURES.filter(m => m.section === key);
  return (
    <div>
      <div style={{ background: "#0c1a3a", border: "1px solid #1d4ed8", borderRadius: 7, padding: "9px 14px", marginBottom: 16, fontSize: 12, color: "#93c5fd", fontFamily: "monospace" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>▸ Enter this facility's 2025 full-year numbers — these will drive its projected 2027 NHQI payment. Compared against {dataset.year} actuals and gaps to next quintile.</span>
          <button onClick={onReset} style={{ background: "transparent", border: "1px solid #374151", borderRadius: 4, color: "#64748b", fontSize: 10, padding: "3px 10px", cursor: "pointer", fontFamily: "monospace", flexShrink: 0, marginLeft: 12 }}>
            Reset
          </button>
        </div>
      </div>

      {SECTIONS.map(sec => (
        <div key={sec.key}>
          <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.1em", margin: "18px 0 10px" }}>
            {sec.label.toUpperCase()} — {SECTION_MAX[sec.key]} PTS MAX
          </div>
          {bySection(sec.key).map(m => {
            const cutpoints = getCutpoints(dataset, m.id, facility.region);
            return (
              <MeasureRow key={m.id} m={m} actual={facility.actuals[m.id]} cutpoints={cutpoints}
                val={vals[m.id] ?? ""} starVal={starVals[m.id] ?? ""} binaryVal={binaryVals[m.id] ?? ""}
                onValChange={v => setVal(m.id, v)} onStarChange={v => setStar(m.id, v)} onBinaryChange={v => setBinary(m.id, v)} />
            );
          })}
        </div>
      ))}
    </div>
  );
}
