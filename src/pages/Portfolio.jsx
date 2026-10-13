import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadActiveDataset, findFacilityById } from "../lib/dataset.js";
import { getPortfolio, addFacility, removeFacility, getAllPlainInputs } from "../lib/storage.js";
import { scoreFacility, buildPriorYearQuintilesFrom2023Actuals } from "../lib/nhqi/scorer.js";
import { official2023Benchmark } from "../lib/nhqi/benchmarks.js";
import { CYCLE } from "../lib/nhqi/measures/2025.js";
import FacilitySearch from "../components/FacilitySearch.jsx";
import QuintileBadge from "../components/QuintileBadge.jsx";

const columns = [
  { key: "name", label: "Facility" },
  { key: "score2023", label: "Official result" },
  { key: "coverage", label: "Coverage" },
  { key: "knownPoints", label: `Known points, cycle ${CYCLE}` },
];

export default function Portfolio() {
  const navigate = useNavigate();
  const [dataset] = useState(() => loadActiveDataset());
  const [portfolio, setPortfolio] = useState(() => getPortfolio());
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => setPortfolio(getPortfolio()), []);

  const rows = useMemo(() => {
    const inputsAll = getAllPlainInputs();
    return portfolio
      .map(entry => {
        const facility = findFacilityById(dataset, entry.facilityId);
        if (!facility) return null;
        const benchmark = official2023Benchmark(dataset, facility);
        const priorYearQuintiles = buildPriorYearQuintilesFrom2023Actuals(facility);
        const inputs = inputsAll[entry.facilityId] || { vals: {}, starVals: {}, binaryVals: {}, pahScenario: null };
        const scored = scoreFacility({ facility, inputs, benchmark, priorYearQuintiles });
        return {
          facilityId: entry.facilityId,
          name: entry.displayName || facility.name,
          city: facility.city,
          county: facility.county,
          closed: facility.closed,
          jklDeficiency: facility.jklDeficiency,
          score2023: facility.totalScore ?? null,
          quintile2023: facility.overallQuintile ?? null,
          coverage: scored.coverage,
          knownPoints: scored.knownEarnedPoints,
          unresolvedMax: scored.unresolvedMaxPoints,
          fullEligibleMax: scored.fullEligibleMax,
        };
      })
      .filter(Boolean);
  }, [portfolio, dataset]);

  const sortedRows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const key = sortKey === "coverage" ? "coverage" : sortKey;
      const av = key === "coverage" ? a.coverage.measuresKnown : a[sortKey];
      const bv = key === "coverage" ? b.coverage.measuresKnown : b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
  }, [rows, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function handleAdd(facilityId) {
    addFacility(facilityId);
    setPortfolio(getPortfolio());
  }

  function handleRemove(facilityId) {
    if (!window.confirm("Remove this facility from your tracked portfolio? Its entered current-cycle data will be deleted.")) return;
    removeFacility(facilityId);
    setPortfolio(getPortfolio());
  }

  const trackedIds = useMemo(() => new Set(portfolio.map(p => p.facilityId)), [portfolio]);

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <FacilitySearch dataset={dataset} onAdd={handleAdd} alreadyTrackedIds={trackedIds} />

      <div className="mt-2 text-xs text-slate-400">
        Modeled against 2023 NY DOH cutpoints · cycle {CYCLE} rules · Saved on this device · Independent planning tool. Not affiliated with NY DOH.
      </div>

      <div className="mt-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-900">
          Portfolio — {sortedRows.length} facilit{sortedRows.length === 1 ? "y" : "ies"} tracked
        </div>
        {sortedRows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">
            No facilities tracked yet. Search above to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                {columns.map(c => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className="px-4 py-2 text-xs text-slate-400 cursor-pointer select-none hover:text-slate-600"
                  >
                    {c.label}{sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(r => (
                <tr
                  key={r.facilityId}
                  className="border-b border-slate-50 hover:bg-stone-50 cursor-pointer"
                  onClick={() => navigate(`/facility/${r.facilityId}`)}
                >
                  <td className="px-4 py-3">
                    <div className="text-slate-900 font-medium">{r.name}</div>
                    <div className="text-xs text-slate-400">
                      {r.city}, {r.county}{r.closed ? " · closed" : ""}
                      {r.jklDeficiency && <span className="text-amber-600"> · ⚠ JKL, excluded from ranking</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-slate-500">{r.score2023 ?? "—"}/100</div>
                    <QuintileBadge quintile={r.quintile2023} />
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">{r.coverage.measuresKnown}/{r.coverage.measuresTotal}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">
                    {r.knownPoints}/{r.fullEligibleMax}
                    {r.unresolvedMax > 0 && <div className="text-[10px] text-amber-600 font-sans">{r.unresolvedMax} unresolved</div>}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleRemove(r.facilityId)}
                      className="text-xs text-slate-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <ul className="mt-4 px-4 py-3 bg-stone-100 border border-stone-200 rounded-lg text-xs text-slate-500 leading-relaxed list-disc list-inside space-y-1">
        <li>Official result: DOH's published 0–100 score and ranked quintile for {dataset.year} (points ÷ max attainable, reduced only for DOH's own small-sample-size exclusions).</li>
        <li>Known points (cycle {CYCLE}): modeled against 2023 NY DOH cutpoints using the 2025 attainment + improvement rules, out of a {90}-point maximum. Unresolved points come from missing or unscoreable inputs, not from a reduced denominator.</li>
        <li>Overall quintile is not modeled for the current cycle anywhere in this app — NY's statewide peer cohort and tie-break method aren't sourced in this environment.</li>
        <li>All current-cycle figures are directional planning estimates, not official DOH results.</li>
      </ul>
    </div>
  );
}
