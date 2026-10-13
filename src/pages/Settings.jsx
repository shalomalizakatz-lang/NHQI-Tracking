import { useRef, useState } from "react";
import { loadActiveDataset, saveCustomDataset, clearCustomDataset, hasCustomDataset } from "../lib/dataset.js";
import { exportBackup, importBackup } from "../lib/storage.js";
import { parseNhqiCsv } from "../lib/csvImport.js";
import { cmsAutofillMeta } from "../lib/cmsAutofill.js";

const REFRESH_WORKFLOW_URL = "https://github.com/shalomalizakatz-lang/NHQI-Tracking/actions/workflows/refresh-cms-data.yml";

export default function Settings() {
  const fileRef = useRef(null);
  const backupFileRef = useRef(null);
  const [dataset, setDataset] = useState(() => loadActiveDataset());
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState(null); // { parsed } awaiting Activate/Cancel
  const refreshedDate = cmsAutofillMeta.generatedAt
    ? new Date(cmsAutofillMeta.generatedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
    setPendingImport(null);
    try {
      const text = await file.text();
      const parsed = parseNhqiCsv(text);
      setPendingImport({ parsed });
    } catch (err) {
      setStatus({ type: "error", msg: err.message || "Could not parse that file." });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleActivateImport() {
    if (!pendingImport) return;
    const { parsed } = pendingImport;
    saveCustomDataset(parsed);
    setDataset(parsed);
    setStatus({ type: "success", msg: `Activated ${parsed.facilities.length} facilities for ${parsed.year} — cut points updated. Existing current-cycle inputs are unaffected.` });
    setPendingImport(null);
  }

  function handleCancelImport() {
    setPendingImport(null);
    setStatus(null);
  }

  function handleRevert() {
    if (!window.confirm("Revert to the bundled 2023 dataset? Your uploaded cut points will be discarded.")) return;
    clearCustomDataset();
    setDataset(loadActiveDataset());
    setStatus({ type: "success", msg: "Reverted to the bundled 2023 dataset." });
  }

  function handleExportBackup() {
    const backup = exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nhqi_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImportBackup(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!window.confirm("Restore this backup? It will replace your current portfolio and current-cycle entries on this device.")) return;
      importBackup(backup);
      setStatus({ type: "success", msg: `Restored backup from ${backup.exportedAt ?? "unknown date"}.` });
    } catch (err) {
      setStatus({ type: "error", msg: err.message || "Could not read that backup file." });
    } finally {
      if (backupFileRef.current) backupFileRef.current.value = "";
    }
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
          current-cycle numbers are preserved. Nothing is activated until you review the preview below and confirm.
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

        {pendingImport && (
          <div className="mt-4 border border-slate-200 rounded-lg p-4 bg-stone-50">
            <div className="text-sm font-semibold text-slate-900 mb-2">Preview — not yet activated</div>
            <div className="text-xs text-slate-600 space-y-1 mb-3">
              <div>Measurement year: <strong>{pendingImport.parsed.year}</strong></div>
              <div>Facilities: <strong>{pendingImport.parsed.validation.facilityCount}</strong> ({pendingImport.parsed.validation.dataRowCount} data rows)</div>
              <div>Measures recognized: <strong>{pendingImport.parsed.validation.measuresRecognized}/{pendingImport.parsed.validation.measuresTotalDefined}</strong></div>
            </div>
            {pendingImport.parsed.validation.warnings.length > 0 && (
              <ul className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 mb-3 space-y-1 list-disc list-inside">
                {pendingImport.parsed.validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
            {pendingImport.parsed.validation.warnings.length === 0 && (
              <div className="text-xs text-green-700 mb-3">No validation warnings.</div>
            )}
            <div className="flex gap-2">
              <button onClick={handleActivateImport} className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-1.5">
                Activate this dataset
              </button>
              <button onClick={handleCancelImport} className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5">
                Cancel
              </button>
            </div>
          </div>
        )}

        {status && (
          <div className={`mt-3 text-xs px-3 py-2 rounded-lg border ${status.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            {status.msg}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="text-sm font-semibold text-slate-900 mb-2">CMS auto-fill &amp; live benchmark</div>
        <p className="text-sm text-slate-500 mb-1 leading-relaxed">
          Pre-filled current-cycle values and the Live NY-wide quintile benchmark are pulled from CMS Care Compare
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

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="text-sm font-semibold text-slate-900 mb-2">Backup &amp; restore</div>
        <p className="text-sm text-slate-500 mb-4 leading-relaxed">
          Your tracked portfolio and entered current-cycle numbers are saved only on this device (browser local
          storage) — there's no account or server copy. Export a backup periodically, or before clearing browser
          data.
        </p>
        <div className="flex gap-2 items-center flex-wrap">
          <button onClick={handleExportBackup} className="text-sm bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg px-3 py-1.5">
            Export backup
          </button>
          <input ref={backupFileRef} type="file" accept=".json,application/json" onChange={handleImportBackup}
            className="text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white file:border file:border-slate-200 file:text-slate-700 file:text-sm hover:file:border-slate-300 file:cursor-pointer" />
        </div>
      </div>

      <div className="bg-stone-100 border border-stone-200 rounded-xl p-5 text-xs text-slate-500 leading-relaxed">
        PAH (Potentially Avoidable Hospitalizations) can't be self-tracked in real time — it requires DOH's
        MDS→SPARCS claims match, which is only available once DOH publishes the next NHQI dataset. It's excluded
        entirely from every facility's current-cycle projection rather than estimated.
      </div>
    </div>
  );
}
