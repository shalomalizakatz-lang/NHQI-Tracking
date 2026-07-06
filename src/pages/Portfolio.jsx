import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadActiveDataset, findFacilityById } from "../lib/dataset.js";
import { getPortfolio, addFacility, removeFacility, getAllInputs, ensureSeedPortfolio } from "../lib/storage.js";
import { computeFacilitySummary, TRACKABLE_MAX } from "../lib/scoring.js";
import { getLiveCutpoints } from "../lib/cmsAutofill.js";
import FacilitySearch from "../components/FacilitySearch.jsx";
import QuintileBadge from "../components/QuintileBadge.jsx";

export default function Portfolio() {
  const navigate = useNavigate();
  const [dataset] = useState(() => loadActiveDataset());
  const columns = useMemo(() => [
    { key: "name", label: "Facility" },
    { key: "score2023", label: `${dataset.year} Score` },
    { key: "quintile2023", label: `${dataset.year} Quintile` },
    { key: "score2025", label: `Current Score (of ${TRACKABLE_MAX})` },
    { key: "quintile2027", label: "Est. Quintile" },
    { key: "ptsDelta", label: `Pts Delta (from ${dataset.year} DOH)` },
  ], [dataset.year]);
  const [portfolio, setPortfolio] = useState(() => { ensureSeedPortfolio(); return getPortfolio(); });
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => setPortfolio(getPortfolio()), []);

  const rows = useMemo(() => {
    const inputsAll = getAllInputs();
    return portfolio
      .map(entry => {
        const facility = findFacilityById(dataset, entry.facilityId);
        if (!facility) return null;
        const summary = computeFacilitySummary(dataset, facility, inputsAll[entry.facilityId], getLiveCutpoints);
        return {
          facilityId: entry.facilityId,
          name: entry.displayName || facility.name,
          city: facility.city,
          county: facility.county,
          closed: facility.closed,
          ...summary,
        };
      })
      .filter(Boolean);
  }, [portfolio, dataset]);

  const sortedRows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
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
    if (!window.confirm("Remove this facility from your tracked portfolio? Its entered current data will be deleted.")) return;
    removeFacility(facilityId);
    setPortfolio(getPortfolio());
  }

  const trackedIds = useMemo(() => new Set(portfolio.map(p => p.facilityId)), [portfolio]);

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <FacilitySearch dataset={dataset} onAdd={handleAdd} alreadyTrackedIds={trackedIds} />

      <div className="mt-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
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
                    <div className="text-xs text-slate-400">{r.city}, {r.county}{r.closed ? " · closed" : ""}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">{r.score2023}/90</td>
                  <td className="px-4 py-3"><QuintileBadge quintile={r.quintile2023} /></td>
                  <td className="px-4 py-3 font-mono text-slate-500">
                    <div><span className="text-[10px] text-slate-400 font-sans mr-1">DOH</span>{r.score2025 !== null ? `${r.score2025}/${TRACKABLE_MAX}` : "—"}</div>
                    {r.score2025Live !== null && <div className="text-purple-600"><span className="text-[10px] font-sans mr-1">Live</span>{r.score2025Live}/{r.liveMax}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1"><span className="text-[10px] text-slate-400">DOH</span><QuintileBadge quintile={r.quintile2027} /></div>
                    {r.quintile2027Live !== null && <div className="flex items-center gap-1 mt-1"><span className="text-[10px] text-purple-600">Live</span><QuintileBadge quintile={r.quintile2027Live} /></div>}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {r.ptsDelta !== null ? (
                      <span className={r.ptsDelta > 0 ? "text-green-600" : r.ptsDelta < 0 ? "text-red-600" : "text-slate-400"}>
                        {r.ptsDelta > 0 ? `+${r.ptsDelta}` : r.ptsDelta}
                      </span>
                    ) : "—"}
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

      <div className="mt-4 px-4 py-3 bg-stone-100 border border-stone-200 rounded-lg text-xs text-slate-500 leading-relaxed">
        {dataset.year} Score is out of 90. Current Score and Est. Quintile each show two rows — DOH ranks your entered numbers against the frozen {dataset.year} DOH cut points, Live ranks the same numbers against a live NY-wide benchmark instead (a directional second opinion, not a DOH-certified figure). Both exclude PAH, which can't be self-tracked (requires DOH's MDS→SPARCS match), so it isn't guessed at or carried forward from an old value. Pts Delta compares the {dataset.year} score to Current Score (DOH) specifically — it doesn't just subtract the two numbers (that would unfairly count PAH's missing points as a loss), it removes PAH's points from the {dataset.year} score first so both sides are measured on the same {TRACKABLE_MAX}-point basis. All projections are directional — actual placement depends on that year's statewide distribution.
      </div>
    </div>
  );
}
