import { useRef, useState } from "react";
import { loadActiveDataset, saveCustomDataset, clearCustomDataset, hasCustomDataset } from "../lib/dataset.js";
import { parseNhqiCsv } from "../lib/csvImport.js";
import { cmsAutofillMeta } from "../lib/cmsAutofill.js";

const REFRESH_WORKFLOW_URL = "https://github.com/shalomalizakatz-lang/NHQI-Tracking/actions/workflows/refresh-cms-data.yml";

export default function Settings() {
  const fileRef = useRef(null);
  const [dataset, setDataset] = useState(() => loadActiveDataset());
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const refreshedDate = cmsAutofillMeta.generatedAt
    ? new Date(cmsAutofillMeta.generatedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;

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
      setStatus({ type: "success", msg: `Loaded ${parsed.facilities.length} facilities for ${parsed.year} — cut points updated. Existing current-year inputs are unaffected.` });
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
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="text-sm font-semibold text-slate-900 mb-2">Active dataset</div>
        <div className="text-sm text-slate-500">
          {dataset.year} — {dataset.facilities.length} facilities · {dataset.source}
        </div>
        {hasCustomDataset() && (
          <button onClick={handleRevert} className="mt-3 text-xs text-slate-400 hover:text-red-600 underline">
            Revert to bundled 2023 dataset
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="text-sm font-semibold text-slate-900 mb-2">Refresh cut points</div>
        <p className="text-sm text-slate-500 mb-4 leading-relaxed">
          DOH recalculates NHQI cut points annually. Upload a new export in the same long-format CSV structure
          (one row per facility × measure, with First–Fifth Quintile columns) to refresh the benchmarks used
          across the portfolio. Facilities are matched by DOH Facility ID; your tracked portfolio and entered
          current numbers are preserved.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          disabled={busy}
          className="text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-teal-600 file:text-white file:text-sm hover:file:bg-teal-700 file:cursor-pointer"
        />
        {busy && <div className="mt-2 text-xs text-amber-600">Parsing…</div>}
        {status && (
          <div className={`mt-3 text-xs px-3 py-2 rounded-lg border ${status.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            {status.msg}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="text-sm font-semibold text-slate-900 mb-2">CMS auto-fill &amp; live benchmark</div>
        <p className="text-sm text-slate-500 mb-1 leading-relaxed">
          Pre-filled current-year values and the Live NY-wide quintile benchmark are pulled from CMS Care Compare
          by a GitHub Actions workflow — scheduled monthly, or run manually any time.
        </p>
        <p className="text-xs text-slate-400 mb-4">
          {refreshedDate ? `Last refreshed ${refreshedDate}.` : "Not yet refreshed."}
        </p>
        <a
          href={REFRESH_WORKFLOW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-1.5"
        >
          Refresh on GitHub →
        </a>
      </div>

      <div className="bg-stone-100 border border-stone-200 rounded-xl p-5 text-xs text-slate-500 leading-relaxed">
        PAH (Potentially Avoidable Hospitalizations) can't be self-tracked in real time — it requires DOH's
        MDS→SPARCS claims match, which is only available once DOH publishes the next NHQI dataset. It's excluded
        entirely from every facility's current projection rather than estimated.
      </div>
    </div>
  );
}
