import { useState, useMemo } from "react";
import { searchFacilities } from "../lib/dataset.js";

export default function FacilitySearch({ dataset, onAdd, alreadyTrackedIds }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchFacilities(dataset, query), [dataset, query]);

  return (
    <div className="bg-[#0a1628] border border-slate-800 rounded-lg p-4">
      <div className="text-[10px] text-slate-500 font-mono tracking-widest mb-2">ADD A FACILITY</div>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search 571 NY facilities by name, city, or county..."
        className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
      />
      {query.trim() !== "" && (
        <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-md">
          {results.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-500">No facilities match "{query}"</div>
          )}
          {results.map(f => {
            const tracked = alreadyTrackedIds.has(f.id);
            return (
              <div key={f.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-900/60">
                <div>
                  <div className="text-sm text-slate-200">{f.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{f.city}, {f.county} · OPCERT {f.opcert}{f.closed ? " · CLOSED" : ""}</div>
                </div>
                <button
                  disabled={tracked}
                  onClick={() => { onAdd(f.id); setQuery(""); }}
                  className={`text-xs font-medium px-3 py-1.5 rounded-md ${
                    tracked ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white"
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
