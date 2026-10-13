import { useState, useMemo, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { loadActiveDataset, findFacilityById } from "../lib/dataset.js";
import { getFacilityInputs, saveManualFieldValue, saveCmsAutofillField, savePahScenario, resetInputs, renameFacility, getPortfolio } from "../lib/storage.js";
import { MEASURES_2025, TRACKABLE_MEASURES_2025, SECTION_MAX_2025, CYCLE } from "../lib/nhqi/measures/2025.js";
import { scoreFacility, buildPriorYearQuintilesFrom2023Actuals } from "../lib/nhqi/scorer.js";
import { official2023Benchmark, liveCmsBenchmark } from "../lib/nhqi/benchmarks.js";
import { getAutofillValue, cmsAutofillMeta, getLiveCutpoints } from "../lib/cmsAutofill.js";
import MeasuresPanel from "../components/MeasuresPanel.jsx";
import PriorityList from "../components/PriorityList.jsx";
import { downloadFacilityPdf } from "../lib/pdfExport.jsx";
import Tabs from "../components/ui/Tabs.jsx";
import Card from "../components/ui/Card.jsx";
import Number from "../components/ui/Number.jsx";
import SourceDetail from "../components/ui/SourceDetail.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import { FOCUS_RING, cx } from "../components/ui/classNames.js";

const VALID_TABS = ["overview", "measures", "improvement-plan"];

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
  const { facilityId, tab: tabParam } = useParams();
  const [dataset] = useState(() => loadActiveDataset());
  const facility = useMemo(() => findFacilityById(dataset, facilityId), [dataset, facilityId]);
  const portfolioEntry = useMemo(() => getPortfolio().find(p => p.facilityId === facilityId), [facilityId]);

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
      <div className="px-6 py-10 max-w-3xl mx-auto text-center text-slate-500">
        Facility not found in the active dataset.
        <div className="mt-4"><Link to="/" className="text-blue-600 hover:underline">← Back to Portfolio</Link></div>
      </div>
    );
  }

  // Garbage/legacy tab segments redirect to Overview rather than crash.
  if (!VALID_TABS.includes(tabParam)) {
    return <Navigate to={`/facility/${facilityId}/overview`} replace />;
  }
  const tab = tabParam;

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

  const tabItems = [
    { key: "overview", label: "Overview", to: `/facility/${facilityId}/overview` },
    { key: "measures", label: "Measures", to: `/facility/${facilityId}/measures` },
    { key: "improvement-plan", label: "Improvement Plan", to: `/facility/${facilityId}/improvement-plan` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/" className={cx("text-xs font-medium text-teal-700 hover:text-teal-800", FOCUS_RING)}>
            ← Portfolio
          </Link>
          {renaming ? (
            <div className="mt-1 flex items-center gap-2">
              <input
                autoFocus
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") setRenaming(false);
                }}
                aria-label="Facility display name"
                className={cx("rounded-[var(--radius-control)] border border-slate-500/50 px-2 py-1 text-base text-slate-900", FOCUS_RING)}
              />
              <button type="button" onClick={handleRename} className={cx("text-sm font-medium text-green-700", FOCUS_RING)}>
                Save
              </button>
              <button type="button" onClick={() => setRenaming(false)} className={cx("text-sm text-slate-500", FOCUS_RING)}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{displayName}</h1>
              <button
                type="button"
                onClick={() => {
                  setNameDraft(displayName);
                  setRenaming(true);
                }}
                aria-label={`Rename ${displayName}`}
                className={cx("rounded-[var(--radius-control)] px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-600", FOCUS_RING)}
              >
                rename
              </button>
            </div>
          )}
          <p className="mt-0.5 text-sm text-slate-500">
            {facility.city}, {facility.county} · NHQI cycle {CYCLE} · Saved on this device
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="sr-only" htmlFor="benchmark-choice">
            Benchmark
          </label>
          <select
            id="benchmark-choice"
            value={benchmarkChoice}
            onChange={e => setBenchmarkChoice(e.target.value)}
            className={cx("rounded-[var(--radius-control)] border border-slate-500/50 px-2.5 py-1.5 text-sm text-slate-900", FOCUS_RING)}
          >
            <option value="2023">Modeled against 2023 NY DOH cutpoints</option>
            <option value="live">Latest public NY benchmark (CMS)</option>
          </select>
          <button
            type="button"
            onClick={() => downloadFacilityPdf({ dataset, facility, displayName, vals, starVals, binaryVals, verifications, pahScenario, benchmarkChoice, priorYearQuintiles })}
            className={cx("rounded-[var(--radius-control)] bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800", FOCUS_RING)}
          >
            Export PDF
          </button>
        </div>
      </div>

      {scored.eligibilityBlocked && (
        <div className="rounded-[var(--radius-control)] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          {scored.eligibilityReason}
        </div>
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-[var(--radius-control)] border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-600">
        <span>
          Coverage: <strong className="tabular-nums text-slate-900">{scored.coverage.measuresKnown}/{scored.coverage.measuresTotal}</strong> measures resolved
        </span>
        <span>
          Known points: <strong className="tabular-nums text-teal-700">{scored.knownEarnedPoints}</strong>
        </span>
        <span>
          Unresolved: <strong className="tabular-nums text-amber-800">{scored.unresolvedMaxPoints}</strong> of {scored.fullEligibleMax} max
        </span>
        <span>
          Benchmark: <strong className="text-slate-900">{scored.benchmark?.label}</strong>
          {scored.benchmark?.asOf ? ` (${scored.benchmark.asOf})` : ""}
        </span>
      </div>

      {missingFields.length > 0 && (
        <div className="rounded-[var(--radius-control)] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          Incomplete — {missingFields.length} input{missingFields.length === 1 ? "" : "s"} missing: {missingFields.join(", ")}
        </div>
      )}

      <Tabs items={tabItems} activeKey={tab} label="Facility sections" />

      <div className="mx-auto w-full max-w-3xl">
        {tab === "overview" && (
          <OverviewTab dataset={dataset} facility={facility} scored={scored} pahScenario={pahScenario} setPah={setPah} />
        )}
        {tab === "measures" && (
          <MeasuresPanel
            key={facilityId}
            dataset={dataset}
            facility={facility}
            vals={vals}
            starVals={starVals}
            binaryVals={binaryVals}
            autoFilled={autoFilled}
            scored={scored}
            benchmark={benchmark}
            pahScenario={pahScenario}
            setPah={setPah}
            setVal={setVal}
            setStar={setStar}
            setBinary={setBinary}
            onReset={handleReset}
          />
        )}
        {tab === "improvement-plan" && (
          <div>
            <div className="mb-4 rounded-[var(--radius-control)] border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-sm text-teal-900">
              <strong className="font-semibold">{scored.benchmark?.label}</strong>
              {scored.benchmark?.asOf ? ` (${scored.benchmark.asOf})` : ""} · cycle {CYCLE}. Overall quintile is not modeled this pass — see Overview.
            </div>
            <PriorityList scored={scored} />
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ dataset, facility, scored, pahScenario, setPah }) {
  const official2023Total = facility.totalScore ?? null;
  const official2023Quintile = facility.overallQuintile ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Card className="flex-1 basis-56 p-4">
          <SourceDetail label={`Official ${dataset.year} result`} />
          <Number value={official2023Total} denominator="100" size="lg" />
          <p className="mt-1 text-xs text-slate-500">
            {official2023Quintile ? `Published quintile Q${official2023Quintile}` : "No published quintile on file"}
          </p>
        </Card>

        <Card className="flex-1 basis-56 p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-teal-700">Known points, cycle {CYCLE}</span>
          <Number value={scored.knownEarnedPoints} denominator={String(scored.fullEligibleMax)} size="lg" className="mt-1" />
          <p className="mt-1 text-xs text-slate-500">
            {scored.unresolvedMaxPoints} point{scored.unresolvedMaxPoints === 1 ? "" : "s"} unresolved · {scored.coverage.measuresKnown}/{scored.coverage.measuresTotal} measures
          </p>
        </Card>

        <Card className="flex-1 basis-56 p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Overall quintile</span>
          <p className="mt-1 text-lg font-semibold text-slate-500">Not modeled</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{scored.overallQuintile.reason}</p>
        </Card>
      </div>

      {scored.normalizedScore && (
        <Card className="p-4 text-sm text-slate-600">
          Normalized score (all {scored.coverage.measuresTotal} measures resolved): <strong className="tabular-nums text-slate-900">{scored.normalizedScore.value}</strong> ({scored.normalizedScore.basis}) — {scored.benchmark?.label}, not an official figure.
        </Card>
      )}

      <Card className="p-4">
        <SectionHeading className="mb-3">Points by section</SectionHeading>
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
            <div key={sec} className="mb-4 last:mb-0">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-1 text-xs">
                <span className="font-semibold capitalize text-slate-600">{sec}</span>
                <span className="tabular-nums text-slate-500">
                  official {pts23}/{max} · known {ptsCurrent}/{max} ({known.length}/{sectionRows.length} resolved)
                </span>
              </div>
              <div className="mb-0.5 text-[10px] text-slate-500">official {dataset.year}</div>
              <div className="mb-1 h-1.5 rounded-full bg-[var(--color-border-subtle)]">
                <div className="h-full rounded-full bg-slate-300" style={{ width: `${pct23}%` }} />
              </div>
              <div className="mb-0.5 text-[10px] text-slate-500">known, cycle {CYCLE}</div>
              <div className="h-1.5 rounded-full bg-[var(--color-border-subtle)]">
                <div className="h-full rounded-full bg-teal-600" style={{ width: `${pctCurrent}%` }} />
              </div>
            </div>
          );
        })}
      </Card>

      <Card className="p-4">
        <SectionHeading className="mb-1">Potentially Avoidable Hospitalizations (PAH)</SectionHeading>
        <p className="mb-3 text-xs text-slate-500">
          Official {dataset.year}: {facility.actuals?.pah?.value ?? "—"} {facility.actuals?.pah ? "/10k days" : ""} · {facility.actuals?.pah?.points ?? "—"}/10 pts. Not
          self-trackable — requires DOH's quarterly MDS→SPARCS match.
        </p>
        <p className="mb-2 text-sm text-slate-600">Scenario for cycle {CYCLE} planning:</p>
        <div className="flex flex-wrap gap-1.5">
          {[null, "official", 0, 2, 6, 8, 10].map(opt => (
            <button
              key={String(opt)}
              type="button"
              onClick={() => setPah(opt)}
              aria-pressed={pahScenario === opt}
              className={cx(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                pahScenario === opt ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                FOCUS_RING
              )}
            >
              {opt === null ? "Unresolved" : opt === "official" ? `Use official ${dataset.year}` : `${opt} pts`}
            </button>
          ))}
        </div>
      </Card>

      <p className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[#fafaf9] px-3.5 py-2.5 text-xs leading-relaxed text-slate-500">
        Official {dataset.year} results are NY DOH's published NHQI figures for {facility.name}, from {dataset.source}. Known/unresolved points above are modeled against cycle {CYCLE} rules
        (attainment + improvement matrix where applicable) and the selected benchmark — not an official DOH-certified figure. An overall quintile is not modeled this pass: NY's statewide peer
        cohort and tie-break method aren't sourced in this environment. Independent planning tool. Not affiliated with NY DOH.
      </p>
    </div>
  );
}

