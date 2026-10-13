import { useMemo, useState } from "react";
import { MEASURES_2025, SECTION_MAX_2025 } from "../lib/nhqi/measures/2025.js";
import { cmsAutofillMeta } from "../lib/cmsAutofill.js";
import MeasureListRow from "./MeasureListRow.jsx";
import MeasureDetail from "./MeasureDetail.jsx";
import { Toolbar, SearchInput, FilterChip } from "./ui/Toolbar.jsx";
import Dialog from "./ui/Dialog.jsx";
import { FOCUS_RING, cx } from "./ui/classNames.js";

const SECTIONS = [
  { key: "quality", label: "Quality Measures" },
  { key: "compliance", label: "Compliance" },
  { key: "efficiency", label: "Efficiency — PAH" },
];

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null;
}

function matchesQuery(m, query) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return m.displayName.toLowerCase().includes(q) || m.officialName.toLowerCase().includes(q);
}

function matchesFilter(row, filter) {
  if (!row) return filter === "all";
  if (filter === "missing") return row.observation.state === "missing_input";
  if (filter === "invalidStale") return row.observation.state === "invalid_input" || row.observation.state === "stale_noncomparable";
  if (filter === "resolved") return row.points !== null;
  return true;
}

export default function MeasuresPanel({
  dataset,
  facility,
  vals,
  starVals,
  binaryVals,
  autoFilled,
  scored,
  benchmark,
  pahScenario,
  setPah,
  setVal,
  setStar,
  setBinary,
  onReset,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const byId = useMemo(() => Object.fromEntries(scored.perMeasure.map(r => [r.measure.id, r])), [scored]);
  const refreshedDate = fmtDate(cmsAutofillMeta.generatedAt);

  const counts = useMemo(() => {
    const rows = scored.perMeasure;
    return {
      all: rows.length,
      missing: rows.filter(r => matchesFilter(r, "missing")).length,
      invalidStale: rows.filter(r => matchesFilter(r, "invalidStale")).length,
      resolved: rows.filter(r => matchesFilter(r, "resolved")).length,
    };
  }, [scored]);

  const visibleBySection = useMemo(() => {
    const map = {};
    for (const sec of SECTIONS) {
      map[sec.key] = MEASURES_2025.filter(m => m.section === sec.key && matchesQuery(m, query) && matchesFilter(byId[m.id], filter));
    }
    return map;
  }, [query, filter, byId]);

  const orderedVisible = SECTIONS.flatMap(sec => visibleBySection[sec.key]);
  const expandedIndex = orderedVisible.findIndex(m => m.id === expandedId);
  const expandedMeasure = expandedIndex >= 0 ? orderedVisible[expandedIndex] : null;

  function openDetail(id) {
    setExpandedId(id);
  }

  function goPrev() {
    if (expandedIndex > 0) setExpandedId(orderedVisible[expandedIndex - 1].id);
  }
  function goNext() {
    if (expandedIndex >= 0 && expandedIndex < orderedVisible.length - 1) setExpandedId(orderedVisible[expandedIndex + 1].id);
  }

  const noResults = orderedVisible.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-sm text-teal-900">
        <span>Benchmark: {scored.benchmark?.label}.</span>
        <button type="button" onClick={onReset} className={cx("shrink-0 rounded-[var(--radius-control)] border border-teal-200 bg-white px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50", FOCUS_RING)}>
          Reset
        </button>
      </div>

      {autoFilled.size > 0 && (
        <p className="text-xs text-teal-700">
          * = pre-filled from CMS Care Compare (data.cms.gov), not NY DOH's figures — verify and edit to override.
          {refreshedDate && ` Last CMS pull: ${refreshedDate}.`}
        </p>
      )}

      <Toolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search measures…" />
        <FilterChip active={filter === "all"} count={counts.all} onClick={() => setFilter("all")}>
          All
        </FilterChip>
        <FilterChip active={filter === "missing"} count={counts.missing} onClick={() => setFilter("missing")}>
          Missing
        </FilterChip>
        <FilterChip active={filter === "invalidStale"} count={counts.invalidStale} onClick={() => setFilter("invalidStale")}>
          Invalid/stale
        </FilterChip>
        <FilterChip active={filter === "resolved"} count={counts.resolved} onClick={() => setFilter("resolved")}>
          Resolved
        </FilterChip>
      </Toolbar>

      {noResults ? (
        <div className="rounded-[var(--radius-control)] border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          {query.trim() ? `No measures match "${query}".` : "No measures match this filter."}{" "}
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
            className={cx("font-medium text-teal-700 underline-offset-2 hover:underline", FOCUS_RING)}
          >
            Clear filters
          </button>
        </div>
      ) : (
        SECTIONS.map(sec =>
          visibleBySection[sec.key].length === 0 ? null : (
            <div key={sec.key}>
              <div className="mb-1.5 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>{sec.label}</span>
                <span className="tabular-nums">{SECTION_MAX_2025[sec.key]} pts max</span>
              </div>
              <div className="rounded-[var(--radius-control)] border border-slate-200 bg-white px-3.5">
                {visibleBySection[sec.key].map(m => (
                  <MeasureListRow
                    key={m.id}
                    m={m}
                    scored={byId[m.id]}
                    val={vals[m.id] ?? ""}
                    starVal={starVals[m.id] ?? ""}
                    binaryVal={binaryVals[m.id] ?? ""}
                    isAutofilled={autoFilled.has(m.id)}
                    onValChange={v => setVal(m.id, v)}
                    onStarChange={v => setStar(m.id, v)}
                    onBinaryChange={v => setBinary(m.id, v)}
                    onOpenDetail={openDetail}
                  />
                ))}
              </div>
            </div>
          )
        )
      )}

      <Dialog open={!!expandedMeasure} onClose={() => setExpandedId(null)} title={expandedMeasure?.displayName} placement="right">
        {expandedMeasure && (
          <MeasureDetail
            m={expandedMeasure}
            actual={facility.actuals[expandedMeasure.id]}
            scored={byId[expandedMeasure.id]}
            benchmark={benchmark}
            year={dataset.year}
            val={vals[expandedMeasure.id] ?? ""}
            starVal={starVals[expandedMeasure.id] ?? ""}
            binaryVal={binaryVals[expandedMeasure.id] ?? ""}
            onValChange={v => setVal(expandedMeasure.id, v)}
            onStarChange={v => setStar(expandedMeasure.id, v)}
            onBinaryChange={v => setBinary(expandedMeasure.id, v)}
            pahScenario={pahScenario}
            setPah={setPah}
            onPrev={goPrev}
            onNext={goNext}
            hasPrev={expandedIndex > 0}
            hasNext={expandedIndex >= 0 && expandedIndex < orderedVisible.length - 1}
          />
        )}
      </Dialog>
    </div>
  );
}
