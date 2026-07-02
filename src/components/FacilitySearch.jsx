import { useState, useMemo } from "react";
import { searchFacilities } from "../lib/dataset.js";

export default function FacilitySearch({ dataset, onAdd, alreadyTrackedIds }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchFacilities(dataset, query), [dataset, query]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-sm font-semibold text-slate-900 mb-2">Add a facility</div>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search 571 NY facilities by name, city, or county…"
        className="w-full bg-stone-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500"
      />
      {query.trim() !== "" && (
        <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
          {results.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-400">No facilities match "{query}"</div>
          )}
          {results.map(f => {
            const tracked = alreadyTrackedIds.has(f.id);
            return (
              <div key={f.id} className="flex items-center justify-between px-3 py-2 hover:bg-stone-50">
                <div>
                  <div className="text-sm text-slate-900">{f.name}</div>
                  <div className="text-xs text-slate-400">{f.city}, {f.county} · OPCERT {f.opcert}{f.closed ? " · closed" : ""}</div>
                </div>
                <button
                  disabled={tracked}
                  onClick={() => { onAdd(f.id); setQuery(""); }}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
                    tracked ? "bg-stone-100 text-slate-400 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700 text-white"
                  }`}
                >
                  {tracked ? "Added" : "+ Add"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
