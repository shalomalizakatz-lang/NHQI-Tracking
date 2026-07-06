import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { loadActiveDataset, findFacilityById } from "../lib/dataset.js";
import { getInputs, saveInputs, resetInputs, renameFacility, getPortfolio } from "../lib/storage.js";
import { MEASURES, TRACKABLE_MEASURES, TRACKABLE_MAX, SECTION_MAX, getCutpoints, getQuintile, computeFacilitySummary, getDisplayed2025Points } from "../lib/scoring.js";
import { qColor, ptsColor } from "../lib/colors.js";
import { getAutofillValue, cmsAutofillMeta, getLiveCutpoints } from "../lib/cmsAutofill.js";
import MeasureRow from "../components/MeasureRow.jsx";
import PriorityList from "../components/PriorityList.jsx";
import { downloadFacilityPdf } from "../lib/pdfExport.jsx";

const SECTIONS = [
  { key: "quality", label: "Quality Measures" },
  { key: "compliance", label: "Compliance" },
  { key: "efficiency", label: "Efficiency — PAH" },
];

// Builds the initial vals/starVals/binaryVals for a facility, pre-filling any
// trackable field the user hasn't entered yet with a CMS Care Compare default
// (see src/lib/cmsAutofill.js). Fields still at their CMS default are tracked
// in autoSet so the UI can mark them with an asterisk — editing a field removes
// it from that set, since it's now the user's own number.
function buildPrefill(facility, facilityId) {
  const stored = getInputs(facilityId);
  const storedVals = stored.vals || {};
  const vals = { ...storedVals };
  const autoSet = new Set();
  for (const m of TRACKABLE_MEASURES) {
    const hasStored = storedVals[m.id] !== undefined && storedVals[m.id] !== "";
    if (hasStored) continue;
    const auto = getAutofillValue(m.id, facility.medicareNumber);
    if (auto !== null) { vals[m.id] = String(auto); autoSet.add(m.id); }
  }
  return { vals, starVals: stored.starVals || {}, binaryVals: stored.binaryVals || {}, autoSet };
}

export default function FacilityTracker() {
  const { facilityId } = useParams();
  const [dataset] = useState(() => loadActiveDataset());
  const facility = useMemo(() => findFacilityById(dataset, facilityId), [dataset, facilityId]);
  const portfolioEntry = useMemo(() => getPortfolio().find(p => p.facilityId === facilityId), [facilityId]);

  const [tab, setTab] = useState("dashboard");
  const [vals, setVals] = useState({});
  const [starVals, setStarVals] = useState({});
  const [binaryVals, setBinaryVals] = useState({});
  const [autoFilled, setAutoFilled] = useState(new Set());
  const [saveStatus, setSaveStatus] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    if (!facility) return;
    const { vals, starVals, binaryVals, autoSet } = buildPrefill(facility, facilityId);
    setVals(vals);
    setStarVals(starVals);
    setBinaryVals(binaryVals);
    setAutoFilled(autoSet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="mt-4"><Link to="/" className="text-blue-600 hover:underline">← Back to Portfolio</Link></div>
      </div>
    );
  }

  const setVal = (id, v) => {
    setVals(p => ({ ...p, [id]: v }));
    setAutoFilled(p => (p.has(id) ? new Set([...p].filter(x => x !== id)) : p));
  };
  const setStar = (id, v) => setStarVals(p => ({ ...p, [id]: v }));
  const setBinary = (id, v) => setBinaryVals(p => ({ ...p, [id]: v }));

  const displayName = portfolioEntry?.displayName || facility.name;
  const getLiveValue = measureId => getAutofillValue(measureId, facility.medicareNumber);
  const summary = computeFacilitySummary(dataset, facility, { vals, starVals, binaryVals }, getLiveCutpoints, getLiveValue);
  const qc = summary.quintile2027 !== null ? qColor(summary.quintile2027) : "#94a3b8";
  const qcLive = summary.quintile2027Live !== null ? qColor(summary.quintile2027Live) : "#94a3b8";

  function handleRename() {
    if (nameDraft.trim()) renameFacility(facilityId, nameDraft.trim());
    setRenaming(false);
  }

  function handleReset() {
    if (!window.confirm("Clear all entered current data for this facility?")) return;
    resetInputs(facilityId);
    const { vals, starVals, binaryVals, autoSet } = buildPrefill(facility, facilityId);
    setVals(vals); setStarVals(starVals); setBinaryVals(binaryVals); setAutoFilled(autoSet);
  }

  const TAB = active => ({
    padding: "8px 18px", border: "none", background: "transparent",
    color: active ? "#0f172a" : "#94a3b8", fontSize: 13, fontWeight: active ? 600 : 400,
    cursor: "pointer", borderBottom: active ? "2px solid #0d9488" : "2px solid transparent",
    fontFamily: "inherit",
  });

  return (
    <div>
      <div style={{ borderBottom: "1px solid #e2e8f0", background: "#fff", padding: "14px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 5, height: 26, background: "#0d9488", borderRadius: 2 }} />
          <div>
            <Link to="/" style={{ fontSize: 12, color: "#0d9488", textDecoration: "none" }}>← Portfolio</Link>
            {renaming ? (
              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleRename()}
                  style={{ background: "#fff", border: "1px solid #0d9488", borderRadius: 6, color: "#0f172a", padding: "2px 6px", fontSize: 14 }} />
                <button onClick={handleRename} style={{ fontSize: 12, color: "#16a34a", background: "none", border: "none", cursor: "pointer" }}>Save</button>
                <button onClick={() => setRenaming(false)} style={{ fontSize: 12, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
              </div>
            ) : (
              <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: "#0f172a" }}>
                {displayName}
                <button onClick={() => { setNameDraft(displayName); setRenaming(true); }}
                  style={{ fontSize: 11, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>✎ rename</button>
              </div>
            )}
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {dataset.year} Actual vs. Current Full-Year · {facility.city}, {facility.county}
            </div>
            {saveStatus === "saving" && <div style={{ fontSize: 10, color: "#d97706", marginTop: 2 }}>● Saving…</div>}
            {saveStatus === "saved" && <div style={{ fontSize: 10, color: "#16a34a", marginTop: 2 }}>✓ Saved</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{dataset.year} Score</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#475569", fontFamily: "monospace" }}>{summary.score2023}<span style={{ fontSize: 11, color: "#cbd5e1" }}>/90</span></div>
          </div>
          {summary.score2025 !== null && (
            <>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#0d9488" }}>Current Score (excl. PAH)</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "monospace" }}>{summary.score2025}<span style={{ fontSize: 11, color: "#cbd5e1" }}>/{TRACKABLE_MAX}</span></div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#0d9488" }}>Est. Quintile</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: qc, fontFamily: "monospace" }}>Q{summary.quintile2027}</div>
              </div>
            </>
          )}
          <button
            onClick={() => downloadFacilityPdf({ dataset, facility, displayName, vals, starVals, binaryVals, summary })}
            style={{ background: "#0d9488", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, padding: "8px 16px", cursor: "pointer", fontWeight: 600 }}
          >
            ⬇ Export PDF
          </button>
        </div>
      </div>

      <div style={{ borderBottom: "1px solid #e2e8f0", background: "#fff", padding: "0 22px", display: "flex", gap: 2 }}>
        <button style={TAB(tab === "dashboard")} onClick={() => setTab("dashboard")}>Dashboard</button>
        <button style={TAB(tab === "measures")} onClick={() => setTab("measures")}>Enter Current Numbers</button>
        <button style={TAB(tab === "priority")} onClick={() => setTab("priority")}>Est. Results</button>
      </div>

      <div style={{ padding: "20px 22px", maxWidth: 820, margin: "0 auto" }}>
        {tab === "dashboard" && (
          <DashboardTab dataset={dataset} facility={facility} summary={summary} vals={vals} starVals={starVals} binaryVals={binaryVals} qc={qc} qcLive={qcLive} />
        )}
        {tab === "measures" && (
          <MeasuresTab dataset={dataset} facility={facility} vals={vals} starVals={starVals} binaryVals={binaryVals} autoFilled={autoFilled}
            setVal={setVal} setStar={setStar} setBinary={setBinary} onReset={handleReset} />
        )}
        {tab === "priority" && (
          <div>
            <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8, padding: "10px 14px", marginBottom: 8, fontSize: 13, color: "#115e59" }}>
              {dataset.year}: <strong>{summary.score2023}/90 pts → {summary.quintile2023 ? `Q${summary.quintile2023}` : "—"}</strong>
              {summary.score2025 !== null && (
                <span> &nbsp;·&nbsp; Current (DOH cut points): <strong style={{ color: qc }}>{summary.score2025}/{TRACKABLE_MAX} pts → est. Q{summary.quintile2027}</strong></span>
              )}
            </div>
            {summary.score2025Live !== null && (
              <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#5b21b6" }}>
                Live CMS benchmark (this facility's actual current CMS data): <strong style={{ color: qcLive }}>{summary.score2025Live}/{summary.liveMax} pts → est. Q{summary.quintile2027Live}</strong>
                <span style={{ fontSize: 11, color: "#8b5cf6", marginLeft: 8 }}>scored out of {summary.liveMax} (only measures with live CMS data for this facility) — directional, not DOH-certified</span>
              </div>
            )}
            <PriorityList dataset={dataset} facility={facility} vals={vals} />
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardTab({ dataset, facility, summary, vals, starVals, binaryVals, qc, qcLive }) {
  const bySection = key => MEASURES.filter(m => m.section === key);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {[
          { label: `${dataset.year} Actual Score`, val: `${summary.score2023}/90`, sub: `Actual · drove ${dataset.year} payment`, color: "#475569" },
          { label: "Current Score (excl. PAH)", val: summary.score2025 !== null ? `${summary.score2025}/${TRACKABLE_MAX}` : "—", sub: summary.entered > 0 ? `${summary.entered}/${TRACKABLE_MEASURES.length} trackable measures entered` : "Enter current data", color: "#0d9488" },
          { label: "Est. Quintile (DOH)", val: summary.quintile2027 !== null ? `Q${summary.quintile2027}` : "—", sub: summary.quintile2027 !== null ? (summary.quintile2027 <= 3 ? "Quality Pool: positive" : "Quality Pool: negative") : "Projected from current rates", color: qc },
          { label: "Est. Quintile (Live CMS)", val: summary.quintile2027Live !== null ? `Q${summary.quintile2027Live}` : "—", sub: summary.score2025Live !== null ? `${summary.score2025Live}/${summary.liveMax} pts from this facility's own current CMS data` : "No current CMS data for this facility", color: qcLive },
        ].map(c => (
          <div key={c.label} style={{ flex: "1 1 200px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: c.color, fontFamily: "monospace", lineHeight: 1, marginBottom: 4 }}>{c.val}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 12 }}>Score by section</div>
        {[
          { key: "quality", label: `Quality (${bySection("quality").length} measures)` },
          { key: "compliance", label: `Compliance (${bySection("compliance").length} measures)` },
          { key: "efficiency", label: "Efficiency — PAH" },
        ].map(sec => {
          const measures = bySection(sec.key);
          const allNotTrackable = measures.every(m => m.notTrackable);
          const max = SECTION_MAX[sec.key];
          const pts23 = measures.reduce((a, m) => a + (facility.actuals[m.id]?.points ?? 0), 0);
          const pts25 = measures.reduce((a, m) => {
            const p = getDisplayed2025Points(dataset, facility, m, vals, starVals, binaryVals);
            return a + (p ?? 0);
          }, 0);
          const pct23 = (pts23 / max) * 100;
          const pct25 = (pts25 / max) * 100;
          return (
            <div key={sec.key} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "#475569" }}>{sec.label}</span>
                <span style={{ fontFamily: "monospace" }}>
                  <span style={{ color: "#94a3b8" }}>{dataset.year}: {pts23}/{max}</span>
                  {allNotTrackable ? (
                    <span style={{ color: "#d97706", marginLeft: 12, fontFamily: "inherit" }}>excluded from current projection</span>
                  ) : (
                    summary.entered > 0 && <span style={{ color: "#0d9488", marginLeft: 12 }}>Current: {pts25}/{max}</span>
                  )}
                </span>
              </div>
              <div style={{ position: "relative", background: "#f0efed", borderRadius: 3, height: 7 }}>
                <div style={{ position: "absolute", left: 0, top: 0, width: `${pct23}%`, height: "100%", background: "#cbd5e1", borderRadius: 3 }} />
                {!allNotTrackable && summary.entered > 0 && <div style={{ position: "absolute", left: 0, top: 0, width: `${pct25}%`, height: "100%", background: "#0d9488", borderRadius: 3, opacity: 0.85 }} />}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 10 }}>All measures at a glance</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "2px 16px" }}>
          {MEASURES.map(m => {
            const cutpoints = getCutpoints(dataset, m.id, facility.region);
            const q25 = (!m.notTrackable && (m.scoring === "quintile" || m.scoring === "quintile_pah")) ? getQuintile(m, vals[m.id], cutpoints) : null;
            const pts25 = getDisplayed2025Points(dataset, facility, m, vals, starVals, binaryVals);
            const a = facility.actuals[m.id] || { quintile: null, points: 0 };
            const aQ = typeof a.quintile === "string" ? parseInt(a.quintile) : a.quintile;
            const moved = typeof aQ === "number" && !isNaN(aQ) && q25 !== null && q25 !== aQ;
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", borderBottom: "1px solid #f0efed" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: pts25 !== null ? ptsColor(pts25, m.maxPts) : "#e2e8f0", flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 12, color: pts25 !== null ? "#0f172a" : "#cbd5e1" }}>{m.short}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                  {typeof aQ === "number" && !isNaN(aQ) ? <span style={{ color: qColor(aQ) }}>Q{aQ}</span> : <span>—</span>}
                  {q25 && <span style={{ color: moved ? (q25 < aQ ? "#16a34a" : "#dc2626") : "#94a3b8" }}> → Q{q25}</span>}
                </div>
                <div style={{ fontSize: 11, fontFamily: "monospace", minWidth: 50, textAlign: "right", color: "#94a3b8" }}>
                  <span>{a.points ?? 0}</span>
                  {m.notTrackable ? <span style={{ color: "#d97706" }}> n/a</span> : pts25 !== null && <span style={{ color: "#0d9488" }}> → {pts25}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 12, padding: "10px 14px", background: "#fafaf9", border: "1px solid #f0efed", borderRadius: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
        {dataset.year} actuals from NY DOH NHQI dataset for {facility.name}. Current values are internal tracking numbers. Cut points regionally adjusted where applicable ({facility.region}). PAH can't be self-tracked (requires DOH's MDS→SPARCS match), so the current score above is out of {TRACKABLE_MAX} points, excluding it entirely rather than estimating it. Est. Quintile (DOH) uses your entered current numbers against the frozen {dataset.year} DOH cut points; Est. Quintile (Live CMS) instead uses this facility's own actual current CMS Care Compare values (not your entries) against a live NY-wide benchmark, scored out of however many measures have live CMS data for this facility — a directional second opinion computed from independent real data, not a DOH-certified figure. Est. results are directional, not guaranteed.
      </div>
    </div>
  );
}

function MeasuresTab({ dataset, facility, vals, starVals, binaryVals, autoFilled, setVal, setStar, setBinary, onReset }) {
  const bySection = key => MEASURES.filter(m => m.section === key);
  const refreshedDate = cmsAutofillMeta.generatedAt
    ? new Date(cmsAutofillMeta.generatedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;
  return (
    <div>
      <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#115e59" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span>Enter this facility's current full-year numbers to project its NHQI payment, compared against {dataset.year} actuals.</span>
          <button onClick={onReset} style={{ background: "#fff", border: "1px solid #99f6e4", borderRadius: 6, color: "#0d9488", fontSize: 11, padding: "4px 10px", cursor: "pointer", flexShrink: 0 }}>
            Reset
          </button>
        </div>
      </div>

      {autoFilled.size > 0 && (
        <div style={{ fontSize: 11, color: "#0d9488", marginBottom: 12 }}>
          * = pre-filled from CMS Care Compare (data.cms.gov), not NY DOH's regionally-adjusted figures — verify against your own records and edit freely to override.
          {refreshedDate && ` Last CMS pull: ${refreshedDate}.`}
        </div>
      )}

      {MEASURES.some(m => m.pointsApproximate) && (
        <div style={{ fontSize: 11, color: "#b45309", marginBottom: 12 }}>
          ⚠ = DOH's real points for this measure sometimes differ ±1 from the standard quintile table — treat current points as directional.
        </div>
      )}

      {SECTIONS.map(sec => (
        <div key={sec.key}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, margin: "18px 0 10px" }}>
            {sec.label} — {SECTION_MAX[sec.key]} pts max
          </div>
          {bySection(sec.key).map(m => {
            const cutpoints = getCutpoints(dataset, m.id, facility.region);
            return (
              <MeasureRow key={m.id} m={m} actual={facility.actuals[m.id]} cutpoints={cutpoints} year={dataset.year}
                val={vals[m.id] ?? ""} starVal={starVals[m.id] ?? ""} binaryVal={binaryVals[m.id] ?? ""} isAutofilled={autoFilled.has(m.id)}
                medicareNumber={facility.medicareNumber}
                onValChange={v => setVal(m.id, v)} onStarChange={v => setStar(m.id, v)} onBinaryChange={v => setBinary(m.id, v)} />
            );
          })}
        </div>
      ))}
    </div>
  );
}
