import { useRef, useState } from "react";
import { loadActiveDataset, saveCustomDataset, clearCustomDataset, hasCustomDataset } from "../lib/dataset.js";
import { parseNhqiCsv } from "../lib/csvImport.js";

export default function Settings() {
  const fileRef = useRef(null);
  const [dataset, setDataset] = useState(() => loadActiveDataset());
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const text = await file.text();
      const parsed = parseNhqiCsv(text);
      saveCustomDataset(parsed);
      setDataset(parsed);
      setStatus({ type: "success", msg: `Loaded ${parsed.facilities.length} facilities for ${parsed.year} — cut points updated. Existing 2025 inputs are unaffected.` });
    } catch (err) {
      setStatus({ type: "error", msg: err.message || "Could not parse that file." });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleRevert() {
    if (!window.confirm("Revert to the bundled 2023 dataset? Your uploaded cut points will be discarded.")) return;
    clearCustomDataset();
    setDataset(loadActiveDataset());
    setStatus({ type: "success", msg: "Reverted to the bundled 2023 dataset." });
  }

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto space-y-6">
      <div className="bg-[#0a1628] border border-slate-800 rounded-lg p-5">
        <div className="text-[10px] text-slate-500 font-mono tracking-widest mb-2">ACTIVE DATASET</div>
        <div className="text-sm text-slate-200">
          {dataset.year} — {dataset.facilities.length} facilities · {dataset.source}
        </div>
        {hasCustomDataset() && (
          <button onClick={handleRevert} className="mt-3 text-xs text-slate-400 hover:text-red-400 underline">
            Revert to bundled 2023 dataset
          </button>
        )}
      </div>

      <div className="bg-[#0a1628] border border-slate-800 rounded-lg p-5">
        <div className="text-[10px] text-slate-500 font-mono tracking-widest mb-2">REFRESH CUT POINTS</div>
        <p className="text-sm text-slate-400 mb-4">
          DOH recalculates NHQI cut points annually. Upload a new export in the same long-format CSV structure
          (one row per facility × measure, with First–Fifth Quintile columns) to refresh the benchmarks used
          across the portfolio. Facilities are matched by DOH Facility ID; your tracked portfolio and entered
          2025 numbers are preserved.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          disabled={busy}
          className="text-sm text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-blue-600 file:text-white file:text-sm hover:file:bg-blue-500 file:cursor-pointer"
        />
        {busy && <div className="mt-2 text-xs text-amber-400">Parsing…</div>}
        {status && (
          <div className={`mt-3 text-xs px-3 py-2 rounded-md border ${status.type === "success" ? "border-green-800 bg-green-950 text-green-300" : "border-red-800 bg-red-950 text-red-300"}`}>
            {status.msg}
          </div>
        )}
      </div>

      <div className="bg-[#0a1628] border border-slate-800 rounded-lg p-5 text-xs text-slate-500 font-mono leading-relaxed">
        ℹ PAH (Potentially Avoidable Hospitalizations) cannot be self-tracked in real time — it requires DOH's
        MDS→SPARCS claims match, which is only available once DOH publishes the next NHQI dataset. Treat any
        entered PAH value as a directional estimate.
      </div>
    </div>
  );
}
