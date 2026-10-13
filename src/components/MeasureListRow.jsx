import { useEffect, useState } from "react";
import { toneForObservationState } from "./ui/Badge.jsx";
import Badge from "./ui/Badge.jsx";
import { FOCUS_RING, CONTROL_BORDER, cx } from "./ui/classNames.js";
import { STATE_LABEL } from "./measureStateLabels.js";
import { getNextTierGain } from "../lib/nhqi/scorer.js";

// Local draft, committed on Enter or blur -- not on every keystroke. Escape
// discards the in-progress edit back to the last committed value. This is a
// UX layer only: an invalid or empty draft still commits (the scorer already
// handles that honestly via observation.state), it just avoids re-saving to
// storage on every single keypress.
function useDraftValue(committed, onCommit) {
  const [draft, setDraft] = useState(committed);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(committed);
  }, [committed, editing]);

  function commit() {
    if (draft !== committed) onCommit(draft);
  }

  return {
    value: draft,
    onChange: e => setDraft(e.target.value),
    onFocus: () => setEditing(true),
    onBlur: () => {
      setEditing(false);
      commit();
    },
    onKeyDown: e => {
      if (e.key === "Enter") {
        commit();
        e.target.blur();
      } else if (e.key === "Escape") {
        setDraft(committed);
        setEditing(false);
        e.target.blur();
      }
    },
  };
}

function InlineEditor({ m, val, starVal, binaryVal, onValChange, onStarChange, onBinaryChange }) {
  const numDraft = useDraftValue(val ?? "", onValChange);

  if (m.scoringRule === "quintile" || m.scoringRule === "threshold") {
    return (
      <div className="flex items-center gap-1.5">
        <input
          {...numDraft}
          type="number"
          step="0.1"
          placeholder="—"
          aria-label={`${m.displayName} value, ${m.unit}`}
          className={cx("w-20 rounded-[var(--radius-control)] px-2 py-1 text-sm tabular-nums", CONTROL_BORDER, FOCUS_RING)}
        />
        <span className="text-xs text-slate-500">{m.unit}</span>
      </div>
    );
  }
  if (m.scoringRule === "star_map") {
    return (
      <select
        value={starVal ?? ""}
        onChange={e => onStarChange(e.target.value)}
        aria-label={`${m.displayName} star rating`}
        className={cx("rounded-[var(--radius-control)] px-2 py-1 text-sm", CONTROL_BORDER, FOCUS_RING)}
      >
        <option value="">—</option>
        {[1, 2, 3, 4, 5].map(s => (
          <option key={s} value={s}>
            {s} star{s === 1 ? "" : "s"}
          </option>
        ))}
      </select>
    );
  }
  if (m.scoringRule === "binary") {
    return (
      <select
        value={binaryVal ?? ""}
        onChange={e => onBinaryChange(e.target.value)}
        aria-label={`${m.displayName}`}
        className={cx("rounded-[var(--radius-control)] px-2 py-1 text-sm", CONTROL_BORDER, FOCUS_RING)}
      >
        <option value="">Unknown</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }
  return null;
}

export default function MeasureListRow({
  m,
  scored,
  val,
  starVal,
  binaryVal,
  isAutofilled,
  onValChange,
  onStarChange,
  onBinaryChange,
  onOpenDetail,
}) {
  const observation = scored?.observation;
  const points = scored?.points ?? null;
  const tone = observation ? toneForObservationState(observation.state) : null;
  const gain = m.scoringRule === "quintile" ? getNextTierGain(scored) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 py-2.5 last:border-0">
      <div className="min-w-[180px] flex-1">
        <button
          type="button"
          onClick={() => onOpenDetail(m.id)}
          className={cx("text-left text-sm font-medium text-slate-900 hover:text-teal-700", FOCUS_RING)}
        >
          {m.displayName}
          {isAutofilled && (
            <span className="ml-1 text-teal-700" title="Pre-filled from CMS Care Compare — verify and edit to override">
              *
            </span>
          )}
        </button>
        <div className="text-xs text-slate-500">{m.measurementPeriod?.label ?? "unspecified"}</div>
      </div>

      {m.id === "pah" ? (
        <div className="text-sm text-slate-500">
          {scored?.scenario === "official" ? "Using official result" : scored?.scenario !== null && scored?.scenario !== undefined ? `Scenario: ${scored.scenario} pts` : "Not self-trackable"}
        </div>
      ) : (
        <InlineEditor m={m} val={val} starVal={starVal} binaryVal={binaryVal} onValChange={onValChange} onStarChange={onStarChange} onBinaryChange={onBinaryChange} />
      )}

      <div className="w-36 shrink-0">
        {tone ? (
          <Badge tone={tone}>{STATE_LABEL[observation.state]}</Badge>
        ) : points !== null ? (
          <span className="text-sm tabular-nums text-teal-700">
            {points}/{m.maxPoints} pts
          </span>
        ) : (
          <Badge tone="amber">Unresolved</Badge>
        )}
      </div>

      <div className="w-44 shrink-0 text-xs text-slate-500">
        {gain !== null && gain > 0 && scored?.gapInfo && (
          <span>
            {m.higherIsBetter ? "↑" : "↓"} {scored.gapInfo.gap.toFixed(1)}
            {m.unit === "%" ? "%" : ` ${m.unit}`} to Q{scored.currentQuintile - 1} (+{gain} pts)
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onOpenDetail(m.id)}
        className={cx("shrink-0 rounded-[var(--radius-control)] px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50", FOCUS_RING)}
      >
        Details
      </button>
    </div>
  );
}
