import { useState, useMemo } from "react";
import { searchFacilities } from "../lib/dataset.js";

// Lives inside the "Add facility" Dialog (Portfolio.jsx) -- no card chrome of
// its own, so it doesn't nest a bordered box inside the dialog's surface.
export default function FacilitySearch({ dataset, onAdd, alreadyTrackedIds, autoFocus }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchFacilities(dataset, query), [dataset, query]);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search 571 NY facilities by name, city, or county…"
        aria-label="Search facilities"
        autoFocus={autoFocus}
        className="w-full rounded-[var(--radius-control)] border border-slate-500/50 px-3 py-2 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
      />
      {query.trim() !== "" && (
        <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
          {results.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-500">No facilities match "{query}"</div>
          )}
          {results.map(f => {
            const tracked = alreadyTrackedIds.has(f.id);
            return (
              <div key={f.id} className="flex items-center justify-between px-3 py-2 hover:bg-stone-50">
                <div>
                  <div className="text-sm text-slate-900">{f.name}</div>
                  <div className="text-xs text-slate-500">{f.city}, {f.county} · OPCERT {f.opcert}{f.closed ? " · closed" : ""}</div>
                </div>
                <button
                  disabled={tracked}
                  onClick={() => { onAdd(f.id); setQuery(""); }}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
                    tracked ? "bg-stone-100 text-slate-500 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700 text-white"
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
