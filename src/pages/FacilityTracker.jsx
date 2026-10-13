import { useState, useMemo, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { loadActiveDataset, findFacilityById } from "../lib/dataset.js";
import { getFacilityInputs, saveManualFieldValue, saveCmsAutofillField, savePahScenario, resetInputs, renameFacility, getPortfolio } from "../lib/storage.js";
import { MEASURES_2025, TRACKABLE_MEASURES_2025, SECTION_MAX_2025, CYCLE } from "../lib/nhqi/measures/2025.js";
import { scoreFacility, buildPriorYearQuintilesFrom2023Actuals } from "../lib/nhqi/scorer.js";
import { official2023Benchmark, liveCmsBenchmark } from "../lib/nhqi/benchmarks.js";
import { getAutofillValue, cmsAutofillMeta, getLiveCutpoints } from "../lib/cmsAutofill.js";
import MeasureRow from "../components/MeasureRow.jsx";
import PriorityList from "../components/PriorityList.jsx";
import { downloadFacilityPdf } from "../lib/pdfExport.jsx";

const SECTIONS = [
  { key: "quality", label: "Quality Measures" },
  { key: "compliance", label: "Compliance" },
  { key: "efficiency", label: "Efficiency — PAH" },
];

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null;
}

// Loads this facility's stored inputs, unwraps FieldRecords to plain editable values (plus
// their real recorded verification, so a migrated legacy entry reads as stale, not current),
// and pre-fills any trackable field that has never been stored with a CMS Care Compare
// default — durably persisted right away as a cms_autofill record (not silently treated as a
// manual entry by a later bulk save), so provenance survives reload even before the user
// edits it.
function loadAndPrefill(facility, facilityId) {
  const stored = getFacilityInputs(facilityId);
  const vals = {};
  const verifications = { vals: {}, starVals: {}, binaryVals: {} };
  const autoSet = new Set();
  for (const [id, rec] of Object.entries(stored.vals)) { vals[id] = rec.value; verifications.vals[id] = rec.verification; }
  for (const m of TRACKABLE_MEASURES_2025) {
    if (m.scoringRule !== "quintile" && m.scoringRule !== "threshold") continue;
    if (vals[m.id] !== undefined) continue;
    const auto = getAutofillValue(m.id, facility.medicareNumber);
    if (auto === null) continue;
    const period = cmsAutofillMeta.generatedAt ? `CMS pull ${fmtDate(cmsAutofillMeta.generatedAt)}` : "CMS Care Compare";
    saveCmsAutofillField(facilityId, "vals", m.id, String(auto), { period, fetchedAt: cmsAutofillMeta.generatedAt });
    vals[m.id] = String(auto);
    verifications.vals[m.id] = "cms_autofill";
    autoSet.add(m.id);
  }
  const starVals = {};
  for (const [id, rec] of Object.entries(stored.starVals)) { starVals[id] = rec.value; verifications.starVals[id] = rec.verification; }
  const binaryVals = {};
  for (const [id, rec] of Object.entries(stored.binaryVals)) { binaryVals[id] = rec.value; verifications.binaryVals[id] = rec.verification; }
  return { vals, starVals, binaryVals, verifications, pahScenario: stored.pahScenario ?? null, autoSet };
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
  const [verifications, setVerifications] = useState({ vals: {}, starVals: {}, binaryVals: {} });
  const [pahScenario, setPahScenario] = useState(null);
  const [autoFilled, setAutoFilled] = useState(new Set());
  const [benchmarkChoice, setBenchmarkChoice] = useState("2023");
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    if (!facility) return;
    const { vals, starVals, binaryVals, verifications, pahScenario, autoSet } = loadAndPrefill(facility, facilityId);
    setVals(vals); setStarVals(starVals); setBinaryVals(binaryVals); setVerifications(verifications); setPahScenario(pahScenario); setAutoFilled(autoSet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId]);

  // Must run unconditionally (before any early return) -- Rules of Hooks.
  const priorYearQuintiles = useMemo(() => (facility ? buildPriorYearQuintilesFrom2023Actuals(facility) : {}), [facility]);

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
    setVerifications(p => ({ ...p, vals: { ...p.vals, [id]: "manual" } }));
    setAutoFilled(p => (p.has(id) ? new Set([...p].filter(x => x !== id)) : p));
    saveManualFieldValue(facilityId, "vals", id, v);
  };
  const setStar = (id, v) => {
    setStarVals(p => ({ ...p, [id]: v }));
    setVerifications(p => ({ ...p, starVals: { ...p.starVals, [id]: "manual" } }));
    saveManualFieldValue(facilityId, "starVals", id, v);
  };
  const setBinary = (id, v) => {
    setBinaryVals(p => ({ ...p, [id]: v }));
    setVerifications(p => ({ ...p, binaryVals: { ...p.binaryVals, [id]: "manual" } }));
    saveManualFieldValue(facilityId, "binaryVals", id, v);
  };
  const setPah = scenario => { setPahScenario(scenario); savePahScenario(facilityId, scenario); };

  const displayName = portfolioEntry?.displayName || facility.name;

  const benchmark = benchmarkChoice === "2023"
    ? official2023Benchmark(dataset, facility)
    : liveCmsBenchmark(getLiveCutpoints, cmsAutofillMeta.generatedAt);
  const scored = scoreFacility({ facility, inputs: { vals, starVals, binaryVals, verifications, pahScenario }, benchmark, priorYearQuintiles });

  const missingFields = scored.perMeasure.filter(r => r.observation.state === "missing_input").map(r => r.measure.displayName);

  function handleRename() {
    if (nameDraft.trim()) renameFacility(facilityId, nameDraft.trim());
    setRenaming(false);
  }

  function handleReset() {
    if (!window.confirm("Clear all entered current-cycle data for this facility? CMS pre-filled values will be re-applied; your manual entries will not.")) return;
    resetInputs(facilityId);
    const { vals, starVals, binaryVals, pahScenario, autoSet } = loadAndPrefill(facility, facilityId);
    setVals(vals); setStarVals(starVals); setBinaryVals(binaryVals); setPahScenario(pahScenario); setAutoFilled(autoSet);
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
              {facility.city}, {facility.county} · NHQI cycle {CYCLE}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>Saved on this device</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={benchmarkChoice} onChange={e => setBenchmarkChoice(e.target.value)}
            style={{ fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 8px", color: "#0f172a", background: "#fff" }}>
            <option value="2023">Modeled against 2023 NY DOH cutpoints</option>
            <option value="live">Latest public NY benchmark (CMS)</option>
          </select>
          <button
            onClick={() => downloadFacilityPdf({ dataset, facility, displayName, vals, starVals, binaryVals, verifications, pahScenario, benchmarkChoice, priorYearQuintiles })}
            style={{ background: "#0d9488", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, padding: "8px 16px", cursor: "pointer", fontWeight: 600 }}
          >
            ⬇ Export PDF
          </button>
        </div>
      </div>

      {scored.eligibilityBlocked && (
        <div style={{ background: "#fef3c7", borderBottom: "1px solid #fde68a", padding: "8px 22px", fontSize: 12, color: "#92400e" }}>
          ⚠ {scored.eligibilityReason}
        </div>
      )}

      <div style={{ background: "#fafaf9", borderBottom: "1px solid #e2e8f0", padding: "8px 22px", fontSize: 12, color: "#475569", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>Coverage: <strong>{scored.coverage.measuresKnown}/{scored.coverage.measuresTotal}</strong> measures resolved</span>
        <span>Known points: <strong style={{ color: "#0d9488" }}>{scored.knownEarnedPoints}</strong></span>
        <span>Unresolved: <strong style={{ color: "#b45309" }}>{scored.unresolvedMaxPoints}</strong> of {scored.fullEligibleMax} max</span>
        <span>Benchmark: <strong>{scored.benchmark?.label}</strong>{scored.benchmark?.asOf ? ` (${scored.benchmark.asOf})` : ""}</span>
      </div>

      {missingFields.length > 0 && (
        <div style={{ background: "#fffbeb", borderBottom: "1px solid #fde68a", padding: "8px 22px", fontSize: 12, color: "#92400e" }}>
          Incomplete — {missingFields.length} input{missingFields.length === 1 ? "" : "s"} missing: {missingFields.join(", ")}
        </div>
      )}

      <div style={{ borderBottom: "1px solid #e2e8f0", background: "#fff", padding: "0 22px", display: "flex", gap: 2 }}>
        <button style={TAB(tab === "dashboard")} onClick={() => setTab("dashboard")}>Overview</button>
        <button style={TAB(tab === "measures")} onClick={() => setTab("measures")}>Measures</button>
        <button style={TAB(tab === "priority")} onClick={() => setTab("priority")}>Improvement Plan</button>
      </div>

      <div style={{ padding: "20px 22px", maxWidth: 820, margin: "0 auto" }}>
        {tab === "dashboard" && (
          <DashboardTab dataset={dataset} facility={facility} scored={scored} pahScenario={pahScenario} setPah={setPah} />
        )}
        {tab === "measures" && (
          <MeasuresTab dataset={dataset} facility={facility} vals={vals} starVals={starVals} binaryVals={binaryVals} autoFilled={autoFilled}
            scored={scored} benchmark={benchmark}
            setVal={setVal} setStar={setStar} setBinary={setBinary} onReset={handleReset} />
        )}
        {tab === "priority" && (
          <div>
            <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#115e59" }}>
              <strong>{scored.benchmark?.label}</strong>{scored.benchmark?.asOf ? ` (${scored.benchmark.asOf})` : ""} · cycle {CYCLE}. Overall quintile is not modeled this pass — see Overview.
            </div>
            <PriorityList scored={scored} />
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardTab({ dataset, facility, scored, pahScenario, setPah }) {
  const official2023Total = facility.totalScore ?? null;
  const official2023Quintile = facility.overallQuintile ?? null;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>Official {dataset.year} result</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#475569", fontFamily: "monospace", lineHeight: 1 }}>
            {official2023Total ?? "—"}<span style={{ fontSize: 11, color: "#cbd5e1" }}>/100</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            {official2023Quintile ? `Published quintile Q${official2023Quintile}` : "No published quintile on file"}
          </div>
        </div>

        <div style={{ flex: "1 1 220px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, color: "#0d9488", marginBottom: 6 }}>Known points, cycle {CYCLE}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#0d9488", fontFamily: "monospace", lineHeight: 1 }}>
            {scored.knownEarnedPoints}<span style={{ fontSize: 11, color: "#cbd5e1" }}>/{scored.fullEligibleMax}</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            {scored.unresolvedMaxPoints} point{scored.unresolvedMaxPoints === 1 ? "" : "s"} unresolved · {scored.coverage.measuresKnown}/{scored.coverage.measuresTotal} measures
          </div>
        </div>

        <div style={{ flex: "1 1 220px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>Overall quintile</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#94a3b8" }}>Not modeled</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, lineHeight: 1.4 }}>{scored.overallQuintile.reason}</div>
        </div>
      </div>

      {scored.normalizedScore && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px", marginBottom: 14, fontSize: 13, color: "#475569" }}>
          Normalized score (all {scored.coverage.measuresTotal} measures resolved): <strong>{scored.normalizedScore.value}</strong> ({scored.normalizedScore.basis}) — {scored.benchmark?.label}, not an official figure.
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 12 }}>Points by section</div>
        {["quality", "compliance", "efficiency"].map(sec => {
          const measures = MEASURES_2025.filter(m => m.section === sec);
          const max = SECTION_MAX_2025[sec];
          const pts23 = measures.reduce((a, m) => a + (facility.actuals[m.id]?.points ?? 0), 0);
          const sectionRows = scored.perMeasure.filter(r => r.measure.section === sec);
          const known = sectionRows.filter(r => r.points !== null);
          const ptsCurrent = known.reduce((a, r) => a + r.points, 0);
          const pct23 = (pts23 / max) * 100;
          const pctCurrent = (ptsCurrent / max) * 100;
          return (
            <div key={sec} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4, fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "#475569", textTransform: "capitalize", fontWeight: 600 }}>{sec}</span>
                <span style={{ fontFamily: "monospace", fontSize: 11 }}>
                  official {pts23}/{max} · known {ptsCurrent}/{max} ({known.length}/{sectionRows.length} resolved)
                </span>
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>official {dataset.year}</div>
              <div style={{ position: "relative", background: "#f0efed", borderRadius: 3, height: 6, marginBottom: 4 }}>
                <div style={{ position: "absolute", left: 0, top: 0, width: `${pct23}%`, height: "100%", background: "#cbd5e1", borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>known, cycle {CYCLE}</div>
              <div style={{ position: "relative", background: "#f0efed", borderRadius: 3, height: 6 }}>
                <div style={{ position: "absolute", left: 0, top: 0, width: `${pctCurrent}%`, height: "100%", background: "#0d9488", borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>Potentially Avoidable Hospitalizations (PAH)</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
          Official {dataset.year}: {facility.actuals?.pah?.value ?? "—"} {facility.actuals?.pah ? "/10k days" : ""} · {facility.actuals?.pah?.points ?? "—"}/10 pts.
          Not self-trackable — requires DOH's quarterly MDS→SPARCS match.
        </div>
        <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>Scenario for cycle {CYCLE} planning:</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[null, "official", 0, 2, 6, 8, 10].map(opt => (
            <button key={String(opt)} onClick={() => setPah(opt)}
              style={{
                fontSize: 11, padding: "5px 10px", borderRadius: 6, cursor: "pointer",
                border: `1px solid ${pahScenario === opt ? "#0d9488" : "#e2e8f0"}`,
                background: pahScenario === opt ? "#0d9488" : "#fff",
                color: pahScenario === opt ? "#fff" : "#475569",
              }}>
              {opt === null ? "Unresolved" : opt === "official" ? `Use official ${dataset.year}` : `${opt} pts`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12, padding: "10px 14px", background: "#fafaf9", border: "1px solid #f0efed", borderRadius: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
        Official {dataset.year} results are NY DOH's published NHQI figures for {facility.name}, from {dataset.source}. Known/unresolved points above are modeled against cycle {CYCLE} rules (attainment + improvement matrix where applicable) and the selected benchmark — not an official DOH-certified figure. An overall quintile is not modeled this pass: NY's statewide peer cohort and tie-break method aren't sourced in this environment. Independent planning tool. Not affiliated with NY DOH.
      </div>
    </div>
  );
}

function MeasuresTab({ dataset, facility, vals, starVals, binaryVals, autoFilled, scored, benchmark, setVal, setStar, setBinary, onReset }) {
  const bySection = key => MEASURES_2025.filter(m => m.section === key);
  const refreshedDate = fmtDate(cmsAutofillMeta.generatedAt);
  const byId = Object.fromEntries(scored.perMeasure.map(r => [r.measure.id, r]));

  return (
    <div>
      <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#115e59" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span>Enter this facility's current-cycle numbers. Benchmark: {scored.benchmark?.label}.</span>
          <button onClick={onReset} style={{ background: "#fff", border: "1px solid #99f6e4", borderRadius: 6, color: "#0d9488", fontSize: 11, padding: "4px 10px", cursor: "pointer", flexShrink: 0 }}>
            Reset
          </button>
        </div>
      </div>

      {autoFilled.size > 0 && (
        <div style={{ fontSize: 11, color: "#0d9488", marginBottom: 12 }}>
          * = pre-filled from CMS Care Compare (data.cms.gov), not NY DOH's figures — verify and edit to override.
          {refreshedDate && ` Last CMS pull: ${refreshedDate}.`}
        </div>
      )}

      {SECTIONS.map(sec => (
        <div key={sec.key}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, margin: "18px 0 10px" }}>
            {sec.label} — {SECTION_MAX_2025[sec.key]} pts max
          </div>
          {bySection(sec.key).map(m => (
            <MeasureRow key={m.id} m={m} actual={facility.actuals[m.id]} scored={byId[m.id]} benchmark={benchmark} year={dataset.year}
              val={vals[m.id] ?? ""} starVal={starVals[m.id] ?? ""} binaryVal={binaryVals[m.id] ?? ""} isAutofilled={autoFilled.has(m.id)}
              onValChange={v => setVal(m.id, v)} onStarChange={v => setStar(m.id, v)} onBinaryChange={v => setBinary(m.id, v)} />
          ))}
        </div>
      ))}
    </div>
  );
}
