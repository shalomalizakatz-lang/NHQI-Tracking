import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadActiveDataset, findFacilityById } from "../lib/dataset.js";
import { getPortfolio, addFacility, removeFacility, getAllInputs, ensureSeedPortfolio } from "../lib/storage.js";
import { computeFacilitySummary, TRACKABLE_MAX } from "../lib/scoring.js";
import FacilitySearch from "../components/FacilitySearch.jsx";
import QuintileBadge from "../components/QuintileBadge.jsx";

const COLUMNS = [
  { key: "name", label: "Facility" },
  { key: "score2023", label: "2023 Score" },
  { key: "quintile2023", label: "2023 Quintile" },
  { key: "score2025", label: `2025 Score (of ${TRACKABLE_MAX})` },
  { key: "quintile2027", label: "Est. 2027 Quintile" },
  { key: "ptsDelta", label: "Pts Delta" },
];

export default function Portfolio() {
  const navigate = useNavigate();
  const [dataset] = useState(() => loadActiveDataset());
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
        const summary = computeFacilitySummary(dataset, facility, inputsAll[entry.facilityId]);
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
    if (!window.confirm("Remove this facility from your tracked portfolio? Its entered 2025 data will be deleted.")) return;
    removeFacility(facilityId);
    setPortfolio(getPortfolio());
  }

  const trackedIds = useMemo(() => new Set(portfolio.map(p => p.facilityId)), [portfolio]);

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <FacilitySearch dataset={dataset} onAdd={handleAdd} alreadyTrackedIds={trackedIds} />

      <div className="mt-6 bg-[#0a1628] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 text-[10px] text-slate-500 font-mono tracking-widest">
          PORTFOLIO — {sortedRows.length} FACILIT{sortedRows.length === 1 ? "Y" : "IES"} TRACKED
        </div>
        {sortedRows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            No facilities tracked yet. Search above to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                {COLUMNS.map(c => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className="px-4 py-2 text-[10px] font-mono tracking-widest text-slate-500 cursor-pointer select-none hover:text-slate-300"
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
                  className="border-b border-slate-900 hover:bg-slate-900/40 cursor-pointer"
                  onClick={() => navigate(`/facility/${r.facilityId}`)}
                >
                  <td className="px-4 py-3">
                    <div className="text-slate-100 font-medium">{r.name}</div>
                    <div className="text-[11px] text-slate-500">{r.city}, {r.county}{r.closed ? " · CLOSED" : ""}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">{r.score2023}/90</td>
                  <td className="px-4 py-3"><QuintileBadge quintile={r.quintile2023} /></td>
                  <td className="px-4 py-3 font-mono text-slate-300">{r.score2025 !== null ? `${r.score2025}/${TRACKABLE_MAX}` : "—"}</td>
                  <td className="px-4 py-3"><QuintileBadge quintile={r.quintile2027} /></td>
                  <td className="px-4 py-3 font-mono">
                    {r.ptsDelta !== null ? (
                      <span className={r.ptsDelta > 0 ? "text-green-400" : r.ptsDelta < 0 ? "text-red-400" : "text-slate-400"}>
                        {r.ptsDelta > 0 ? `+${r.ptsDelta}` : r.ptsDelta}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleRemove(r.facilityId)}
                      className="text-[11px] text-slate-500 hover:text-red-400"
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

      <div className="mt-4 px-4 py-2 bg-[#0a1628] border border-slate-800 rounded-md text-[11px] text-slate-500 font-mono">
        ℹ 2023 Score is out of 90. 2025 Score is out of {TRACKABLE_MAX} — it excludes PAH, which can't be self-tracked (requires DOH's MDS→SPARCS match), so it isn't guessed at or carried forward from an old value. Est. 2027 quintile is directional — actual placement depends on that year's statewide distribution.
      </div>
    </div>
  );
}
