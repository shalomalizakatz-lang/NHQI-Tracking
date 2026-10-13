import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addFacility, removeFacility, restoreFacility } from "../lib/storage.js";
import usePortfolioRows from "../lib/usePortfolioRows.js";
import { CYCLE } from "../lib/nhqi/measures/2025.js";
import FacilitySearch from "../components/FacilitySearch.jsx";
import QuintileBadge from "../components/QuintileBadge.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { Toolbar, SearchInput, FilterChip } from "../components/ui/Toolbar.jsx";
import { Table, Th, TableRow } from "../components/ui/Table.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Number from "../components/ui/Number.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Dialog from "../components/ui/Dialog.jsx";
import { FOCUS_RING, cx } from "../components/ui/classNames.js";

const UNDO_WINDOW_MS = 8000;

function matchesQuery(row, query) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return row.name.toLowerCase().includes(q) || row.city.toLowerCase().includes(q) || row.county.toLowerCase().includes(q);
}

function matchesFilter(row, filter) {
  if (filter === "needsData") return row.needsData;
  if (filter === "invalidStale") return row.hasInvalidOrStale;
  if (filter === "opportunities") return row.topOpportunity !== null;
  return true;
}

function NextOpportunity({ row }) {
  if (row.topOpportunity) {
    const { row: measureRow, gain } = row.topOpportunity;
    return (
      <span className="text-sm text-slate-900">
        {measureRow.measure.displayName} <span className="font-medium text-green-700">+{gain} pts</span>
      </span>
    );
  }
  if (row.needsData) return <span className="text-sm text-amber-800">Missing inputs</span>;
  return <span className="text-sm text-slate-500">No real gains identified</span>;
}

function CompletenessText({ row }) {
  const { measuresKnown, measuresTotal } = row.coverage;
  const complete = measuresKnown === measuresTotal;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm tabular-nums text-slate-900">
        {measuresKnown}/{measuresTotal} measures
      </span>
      {!complete && <Badge tone="amber">{measuresTotal - measuresKnown} unresolved</Badge>}
    </div>
  );
}

function PortfolioFacilityCard({ row, onRemove }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/facility/${row.facilityId}`}
            className={cx("text-sm font-semibold text-slate-900 hover:text-teal-700", FOCUS_RING)}
          >
            {row.name}
          </Link>
          <div className="text-xs text-slate-500">
            {row.city}, {row.county}
            {row.closed ? " · closed" : ""}
          </div>
        </div>
        {row.jklDeficiency && <Badge tone="amber">JKL excluded</Badge>}
      </div>

      <div className="mt-3">
        <CompletenessText row={row} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <Number value={row.knownPoints} denominator={row.fullEligibleMax} basis={`Known points, cycle ${CYCLE}`} size="md" />
        <div className="text-right text-xs text-slate-500">
          2023 official: {row.score2023 ?? "—"}/100
          <div className="mt-0.5">
            <QuintileBadge quintile={row.quintile2023} />
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <NextOpportunity row={row} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Link
          to={`/facility/${row.facilityId}`}
          className={cx(
            "flex-1 rounded-[var(--radius-control)] bg-teal-700 px-3 py-2 text-center text-sm font-medium text-white hover:bg-teal-800",
            FOCUS_RING
          )}
        >
          Open
        </Link>
        <button
          type="button"
          onClick={() => onRemove(row)}
          aria-label={`Remove ${row.name} from portfolio`}
          className={cx("rounded-[var(--radius-control)] px-3 py-2 text-sm text-slate-500 hover:bg-slate-50", FOCUS_RING)}
        >
          Remove
        </button>
      </div>
    </Card>
  );
}

export default function Portfolio() {
  const { dataset, rows, refresh } = usePortfolioRows();
  const trackedIds = useMemo(() => new Set(rows.map(r => r.facilityId)), [rows]);

  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [undo, setUndo] = useState(null); // { removedEntry, removedInputs, name, timeoutId }

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });

  const counts = useMemo(
    () => ({
      all: rows.length,
      needsData: rows.filter(r => r.needsData).length,
      invalidStale: rows.filter(r => r.hasInvalidOrStale).length,
      opportunities: rows.filter(r => r.topOpportunity !== null).length,
    }),
    [rows]
  );

  const visibleRows = useMemo(() => {
    const filtered = rows.filter(r => matchesQuery(r, query) && matchesFilter(r, filter));
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = sort.key === "coverage" ? a.coverage.measuresKnown : sort.key === "topGain" ? a.topOpportunity?.gain ?? -1 : a[sort.key];
      const bv = sort.key === "coverage" ? b.coverage.measuresKnown : sort.key === "topGain" ? b.topOpportunity?.gain ?? -1 : b[sort.key];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
  }, [rows, query, filter, sort]);

  function toggleSort(key) {
    setSort(s => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function handleAdd(facilityId) {
    addFacility(facilityId);
    refresh();
    setAddOpen(false);
  }

  function handleConfirmRemove() {
    if (!removeTarget) return;
    if (undo?.timeoutId) clearTimeout(undo.timeoutId);
    const { removedEntry, removedInputs } = removeFacility(removeTarget.facilityId);
    refresh();
    const timeoutId = setTimeout(() => setUndo(null), UNDO_WINDOW_MS);
    setUndo({ removedEntry, removedInputs, name: removeTarget.name, timeoutId });
    setRemoveTarget(null);
  }

  function handleUndo() {
    if (!undo) return;
    clearTimeout(undo.timeoutId);
    restoreFacility(undo.removedEntry, undo.removedInputs);
    refresh();
    setUndo(null);
  }

  const needsDataCount = counts.needsData;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Portfolio"
        context={`Cycle ${CYCLE} · modeled against 2023 NY DOH cutpoints · ${rows.length} facilit${rows.length === 1 ? "y" : "ies"} tracked${
          needsDataCount > 0 ? ` · ${needsDataCount} need${needsDataCount === 1 ? "s" : ""} data` : ""
        }`}
        actions={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className={cx(
              "rounded-[var(--radius-control)] bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800",
              FOCUS_RING
            )}
          >
            Add facility
          </button>
        }
      />

      {rows.length > 0 && (
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search tracked facilities…" />
          <FilterChip active={filter === "all"} count={counts.all} onClick={() => setFilter("all")}>
            All
          </FilterChip>
          <FilterChip active={filter === "needsData"} count={counts.needsData} onClick={() => setFilter("needsData")}>
            Needs data
          </FilterChip>
          <FilterChip active={filter === "invalidStale"} count={counts.invalidStale} onClick={() => setFilter("invalidStale")}>
            Invalid/stale
          </FilterChip>
          <FilterChip active={filter === "opportunities"} count={counts.opportunities} onClick={() => setFilter("opportunities")}>
            Opportunities
          </FilterChip>
        </Toolbar>
      )}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="Track your first New York facility"
            description="Search DOH's 2023 NHQI dataset for a facility to start tracking its cycle 2025 inputs and points."
            action={
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className={cx("rounded-[var(--radius-control)] bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800", FOCUS_RING)}
              >
                Add a facility
              </button>
            }
          />
        </Card>
      ) : visibleRows.length === 0 ? (
        <Card>
          <EmptyState
            title={query.trim() ? `No facilities match "${query}"` : "No facilities match this filter"}
            description={query.trim() ? "Try a different name, city, or county." : "Try a different filter."}
            action={
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                className={cx("rounded-[var(--radius-control)] border border-slate-500/50 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50", FOCUS_RING)}
              >
                Clear filters
              </button>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <thead>
                <TableRow>
                  <Th sortKey="name" sort={sort} onSort={toggleSort} className="pl-4">
                    Facility
                  </Th>
                  <Th sortKey="coverage" sort={sort} onSort={toggleSort}>
                    Completeness
                  </Th>
                  <Th sortKey="knownPoints" sort={sort} onSort={toggleSort}>
                    Known points, cycle {CYCLE}
                  </Th>
                  <Th sortKey="topGain" sort={sort} onSort={toggleSort}>
                    Next opportunity
                  </Th>
                  <Th className="pr-4">
                    <span className="sr-only">Actions</span>
                  </Th>
                </TableRow>
              </thead>
              <tbody>
                {visibleRows.map(row => (
                  <TableRow key={row.facilityId}>
                    <td className="py-3 pl-4">
                      <Link to={`/facility/${row.facilityId}`} className={cx("font-medium text-slate-900 hover:text-teal-700", FOCUS_RING)}>
                        {row.name}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {row.city}, {row.county}
                        {row.closed ? " · closed" : ""}
                        {row.jklDeficiency && <span className="text-amber-700"> · JKL, excluded from ranking</span>}
                      </div>
                    </td>
                    <td className="py-3">
                      <CompletenessText row={row} />
                    </td>
                    <td className="py-3">
                      <span className="tabular-nums text-slate-900">
                        {row.knownPoints}/{row.fullEligibleMax}
                      </span>
                      {row.unresolvedMax > 0 && <div className="text-xs text-amber-700">{row.unresolvedMax} unresolved</div>}
                    </td>
                    <td className="py-3">
                      <NextOpportunity row={row} />
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(row)}
                        className={cx("rounded-[var(--radius-control)] px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 hover:text-red-800", FOCUS_RING)}
                      >
                        Remove
                      </button>
                    </td>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </Card>

          <div className="flex flex-col gap-3 md:hidden">
            {visibleRows.map(row => (
              <PortfolioFacilityCard key={row.facilityId} row={row} onRemove={setRemoveTarget} />
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-slate-500">
        Known points are modeled against 2023 NY DOH cutpoints under cycle {CYCLE} rules — directional planning estimates, not official DOH
        results. Overall quintile is not modeled for the current cycle. Full methodology is in Data &amp; settings.
      </p>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add a facility">
        <FacilitySearch dataset={dataset} onAdd={handleAdd} alreadyTrackedIds={trackedIds} autoFocus />
      </Dialog>

      <Dialog open={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Remove facility?">
        {removeTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-700">
              This removes <strong>{removeTarget.name}</strong> from your portfolio and deletes all of its saved cycle {CYCLE} inputs on this
              device. You can undo this for a few seconds right after removing it; after that it can't be recovered.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                className={cx("rounded-[var(--radius-control)] border border-slate-500/50 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50", FOCUS_RING)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                className={cx("rounded-[var(--radius-control)] bg-red-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-800", FOCUS_RING)}
              >
                Remove facility
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {undo && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-[var(--radius-control)] border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg"
        >
          <span>Removed {undo.name}.</span>
          <button type="button" onClick={handleUndo} className={cx("font-medium text-teal-300 hover:text-teal-200", FOCUS_RING)}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
