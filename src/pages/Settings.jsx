import { useRef, useState } from "react";
import { loadActiveDataset, saveCustomDataset, clearCustomDataset, hasCustomDataset } from "../lib/dataset.js";
import { exportBackup, importBackup } from "../lib/storage.js";
import { parseNhqiCsv } from "../lib/csvImport.js";
import { cmsAutofillMeta } from "../lib/cmsAutofill.js";
import { CYCLE } from "../lib/nhqi/measures/2025.js";
import PageHeader from "../components/ui/PageHeader.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Card from "../components/ui/Card.jsx";
import { FOCUS_RING, cx } from "../components/ui/classNames.js";

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
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader title="Data & settings" context={`Cycle ${CYCLE} rules · benchmark cutpoints, source data, and local backup`} />

      <Card className="p-5">
        <SectionHeading className="mb-2">Active benchmark dataset</SectionHeading>
        <p className="text-sm text-slate-600">
          {dataset.year} — {dataset.facilities.length} facilities · {dataset.source}
        </p>
        {hasCustomDataset() && (
          <button type="button" onClick={handleRevert} className={cx("mt-3 text-xs text-slate-500 underline hover:text-red-700", FOCUS_RING)}>
            Revert to bundled 2023 dataset
          </button>
        )}
      </Card>

      <Card className="p-5">
        <SectionHeading className="mb-2">Refresh cutpoints from a new DOH export</SectionHeading>
        <p className="mb-4 text-sm leading-relaxed text-slate-600">
          DOH recalculates NHQI cutpoints annually. Upload a new export in the same long-format CSV (one row per facility × measure, with First–Fifth
          Quintile columns) to refresh the benchmarks used across the portfolio. Facilities are matched by their DOH Facility ID; your tracked portfolio
          and entered current-cycle numbers are preserved either way. Nothing is activated until you review the preview below and confirm.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          disabled={busy}
          aria-label="Upload a new DOH NHQI CSV export"
          className="text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-[var(--radius-control)] file:border-0 file:bg-teal-700 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-teal-800"
        />
        {busy && <p className="mt-2 text-xs text-amber-700">Parsing…</p>}

        {pendingImport && (
          <Card className="mt-4 bg-[#fafaf9] p-4">
            <p className="mb-2 text-sm font-semibold text-slate-900">Preview — not yet activated</p>
            <div className="mb-3 space-y-1 text-xs text-slate-600">
              <div>
                Measurement year: <strong>{pendingImport.parsed.year}</strong>
              </div>
              <div>
                Facilities: <strong>{pendingImport.parsed.validation.facilityCount}</strong> ({pendingImport.parsed.validation.dataRowCount} data rows)
              </div>
              <div>
                Measures recognized: <strong>{pendingImport.parsed.validation.measuresRecognized}/{pendingImport.parsed.validation.measuresTotalDefined}</strong>
              </div>
            </div>
            {pendingImport.parsed.validation.warnings.length > 0 ? (
              <ul className="mb-3 list-inside list-disc space-y-1 rounded-[var(--radius-control)] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {pendingImport.parsed.validation.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-xs text-green-700">No validation warnings.</p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={handleActivateImport} className={cx("rounded-[var(--radius-control)] bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800", FOCUS_RING)}>
                Activate this dataset
              </button>
              <button type="button" onClick={handleCancelImport} className={cx("rounded-[var(--radius-control)] border border-slate-500/50 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50", FOCUS_RING)}>
                Cancel
              </button>
            </div>
          </Card>
        )}

        {status && (
          <div className={cx("mt-3 rounded-[var(--radius-control)] border px-3 py-2 text-xs", status.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-800")}>
            {status.msg}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <SectionHeading className="mb-2">CMS auto-fill &amp; live benchmark</SectionHeading>
        <p className="mb-1 text-sm leading-relaxed text-slate-600">
          Pre-filled current-cycle values and the Live NY-wide quintile benchmark are pulled from CMS Care Compare by a scheduled job — this app only reads
          its output, it doesn't run it.
        </p>
        <p className="mb-4 text-xs text-slate-500">{refreshedDate ? `Last refreshed ${refreshedDate}.` : "Not yet refreshed."}</p>
        <a
          href={REFRESH_WORKFLOW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cx("inline-block rounded-[var(--radius-control)] bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200", FOCUS_RING)}
        >
          Run or inspect the refresh job on GitHub ↗
        </a>
      </Card>

      <Card className="p-5">
        <SectionHeading className="mb-2">Backup &amp; restore</SectionHeading>
        <p className="mb-4 text-sm leading-relaxed text-slate-600">
          Your tracked portfolio and entered current-cycle numbers are saved only on this device (browser local storage) — there's no account or server
          copy. Export a backup periodically, or before clearing browser data.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleExportBackup} className={cx("rounded-[var(--radius-control)] border border-slate-500/50 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50", FOCUS_RING)}>
            Export backup
          </button>
          <input
            ref={backupFileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportBackup}
            aria-label="Restore from backup file"
            className="text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-[var(--radius-control)] file:border file:border-slate-500/50 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-slate-50"
          />
        </div>
      </Card>

      <Card className="p-5">
        <SectionHeading className="mb-2">Methodology notes</SectionHeading>
        <ul className="list-inside list-disc space-y-1.5 text-xs leading-relaxed text-slate-500">
          <li>Official result: DOH's published 0–100 score and ranked quintile for {dataset.year} (points ÷ max attainable, reduced only for DOH's own small-sample-size exclusions).</li>
          <li>Known points (cycle {CYCLE}): modeled against the selected benchmark's cutpoints using the 2025 attainment + improvement rules, out of a 90-point maximum. Unresolved points come from missing or unscoreable inputs, not from a reduced denominator.</li>
          <li>Overall quintile is not modeled for the current cycle anywhere in this app — NY's statewide peer cohort and tie-break method aren't sourced in this environment.</li>
          <li>PAH (Potentially Avoidable Hospitalizations) can't be self-tracked in real time — it requires DOH's MDS→SPARCS claims match, only available once DOH publishes the next NHQI dataset. It's excluded from every facility's current-cycle projection rather than estimated.</li>
          <li>All current-cycle figures are directional planning estimates, not official DOH results. Independent planning tool. Not affiliated with NY DOH.</li>
        </ul>
      </Card>
    </div>
  );
}
