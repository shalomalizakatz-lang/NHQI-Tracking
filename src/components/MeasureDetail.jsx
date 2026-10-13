import { qColor, deltaColor, deltaArrow } from "../lib/colors.js";
import { toneForObservationState } from "./ui/Badge.jsx";
import Badge from "./ui/Badge.jsx";
import SourceDetail from "./ui/SourceDetail.jsx";
import { FOCUS_RING, CONTROL_BORDER, cx } from "./ui/classNames.js";
import { STATE_LABEL } from "./measureStateLabels.js";

function cutpointLabel(qi, cutpoints, higherIsBetter, unit) {
  const label = higherIsBetter
    ? qi === 1
      ? `>${cutpoints[0]}`
      : qi === 5
        ? `≤${cutpoints[3]}`
        : `${cutpoints[qi - 1]}–${cutpoints[qi - 2]}`
    : qi === 1
      ? `≤${cutpoints[0]}`
      : qi === 5
        ? `>${cutpoints[3]}`
        : `${cutpoints[qi - 2]}–${cutpoints[qi - 1]}`;
  return `${label}${unit}`;
}

function OfficialBox({ year, actual, m }) {
  const a = actual || { value: null, quintile: null, points: 0 };
  const aQuintileNum = typeof a.quintile === "string" ? parseInt(a.quintile) : a.quintile;
  const hasQuintile = typeof aQuintileNum === "number" && !isNaN(aQuintileNum);
  return (
    <div className="rounded-[var(--radius-control)] bg-[#fafaf9] p-3">
      <SourceDetail label={`Official ${year} result`} />
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-600">
        {typeof a.value === "number" ? a.value : (a.value ?? "—")}
        <span className="ml-0.5 text-sm font-normal text-slate-500">{m.unit}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        {hasQuintile && <Badge tone="neutral">Q{aQuintileNum}</Badge>}
        <span className="text-xs text-slate-500">
          {a.points}/{m.maxPoints} pts
        </span>
      </div>
    </div>
  );
}

function SourceMeta({ m }) {
  return (
    <div className="flex flex-col gap-1 text-xs text-slate-500">
      <span>Measurement period: {m.measurementPeriod?.label ?? "unspecified"}</span>
      {m.measurementPeriod?.source?.startsWith("gov_unreachable") && <span>Source not independently verified (health.ny.gov unreachable).</span>}
      <span>Adjustment basis: {m.adjustmentBasis}</span>
      <span>Scoring rule: {m.scoringRule}</span>
      {m.note && <span>{m.note}</span>}
    </div>
  );
}

function QuintileDetail({ m, actual, scored, benchmark, year, val, onValChange }) {
  const observation = scored?.observation;
  const currentQuintile = scored?.currentQuintile ?? null;
  const points = scored?.points ?? null;
  const cutpoints = benchmark?.getCutpoints?.(m.id);
  const hasVal = val !== "" && val !== null && val !== undefined;
  const a = actual || { value: null, quintile: null, points: 0 };
  const numVal = hasVal ? parseFloat(val) : null;
  const delta = numVal !== null && typeof a.value === "number" ? numVal - a.value : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <OfficialBox year={year} actual={actual} m={m} />
        <div className="rounded-[var(--radius-control)] bg-teal-50 p-3">
          <span className="text-xs font-medium uppercase tracking-wide text-teal-700">Current entry</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              value={val ?? ""}
              onChange={e => onValChange(e.target.value)}
              aria-label={`${m.displayName} value, ${m.unit}`}
              className={cx("w-24 rounded-[var(--radius-control)] bg-white px-2 py-1 text-lg font-semibold tabular-nums", CONTROL_BORDER, FOCUS_RING)}
            />
            <span className="text-sm text-slate-600">{m.unit}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            {observation && observation.state !== "valid" ? (
              <Badge tone={toneForObservationState(observation.state)}>{STATE_LABEL[observation.state]}</Badge>
            ) : currentQuintile ? (
              <>
                <Badge tone="neutral">Q{currentQuintile}</Badge>
                <span className="text-xs text-teal-700">
                  {points !== null ? `${points}/${m.maxPoints} pts${scored?.pointsBasis === "attainment_plus_improvement" ? " (incl. improvement)" : ""}` : `Unresolved${scored?.unresolvedReason ? `: ${scored.unresolvedReason}` : ""}`}
                </span>
              </>
            ) : null}
          </div>
          {delta !== null && (
            <div className="mt-1 text-xs" style={{ color: deltaColor(delta, m.higherIsBetter) }}>
              {deltaArrow(delta, m.higherIsBetter)} {Math.abs(delta).toFixed(1)} vs official {year}
            </div>
          )}
        </div>
      </div>

      {cutpoints && cutpoints.length >= 4 && (
        <div>
          <p className="mb-1.5 text-xs text-slate-500">Cutpoints — {benchmark.label}:</p>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map(qi => {
              const isActiveCurrent = currentQuintile === qi;
              const c = qColor(qi);
              return (
                <span
                  key={qi}
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    background: isActiveCurrent ? c + "1c" : "#fafaf9",
                    border: `1px solid ${isActiveCurrent ? c + "60" : "#f0efed"}`,
                    color: isActiveCurrent ? c : "#94a3b8",
                    fontWeight: isActiveCurrent ? 600 : 400,
                  }}
                >
                  Q{qi}: {cutpointLabel(qi, cutpoints, m.higherIsBetter, m.unit)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {hasVal && currentQuintile && currentQuintile > 1 && scored?.gapInfo && (
        <div className="rounded-[var(--radius-control)] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Gap to Q{currentQuintile - 1}: {m.higherIsBetter ? "↑" : "↓"} {scored.gapInfo.gap.toFixed(1)}
          {m.unit === "%" ? "%" : ` ${m.unit}`} needed · target {scored.gapInfo.displayTarget}
          {m.unit === "%" ? "%" : ` ${m.unit}`}
        </div>
      )}
      {hasVal && currentQuintile === 1 && <div className="text-sm font-medium text-green-700">Top quintile, {benchmark?.label ?? "selected benchmark"}</div>}

      {scored?.unresolvedReason?.includes("prior-year") && (
        <div className="text-xs text-amber-800">
          This measure earns improvement credit in the 2025 methodology, but the prior-year quintile needed to resolve it isn't known
          {scored.priorQuintile === null ? " for this facility." : "."}
        </div>
      )}

      <SourceMeta m={m} />
    </div>
  );
}

function ThresholdDetail({ m, actual, scored, year, val, onValChange }) {
  const points = scored?.points ?? null;
  const observation = scored?.observation;
  const hasVal = val !== "" && val !== null && val !== undefined;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <OfficialBox year={year} actual={actual} m={m} />
        <div className="rounded-[var(--radius-control)] bg-teal-50 p-3">
          <span className="text-xs font-medium uppercase tracking-wide text-teal-700">Current entry</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              value={val ?? ""}
              onChange={e => onValChange(e.target.value)}
              aria-label={`${m.displayName} value, ${m.unit}`}
              className={cx("w-24 rounded-[var(--radius-control)] bg-white px-2 py-1 text-lg font-semibold tabular-nums", CONTROL_BORDER, FOCUS_RING)}
            />
            <span className="text-sm text-slate-600">{m.unit}</span>
          </div>
          {observation && observation.state !== "valid" && (
            <div className="mt-1.5">
              <Badge tone={toneForObservationState(observation.state)}>{STATE_LABEL[observation.state]}</Badge>
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Threshold rule: {m.thresholdDir === "lte" ? "≤" : "<"}
        {m.threshold}
        {m.unit} earns {m.maxPoints} pts, otherwise 0.
      </p>
      {hasVal && points !== null && (
        <div className={cx("rounded-[var(--radius-control)] px-3 py-2 text-sm", points > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-800")}>
          {points > 0 ? `Threshold met — ${points} pts` : `Threshold missed — 0 pts`}
        </div>
      )}
      <SourceMeta m={m} />
    </div>
  );
}

function StarMapDetail({ m, actual, scored, year, starVal, onStarChange }) {
  const points = scored?.points ?? null;
  const currentStars = starVal ? Number(starVal) : null;
  return (
    <div className="flex flex-col gap-4">
      <OfficialBox year={year} actual={actual} m={m} />
      <div>
        <p className="mb-1.5 text-sm text-slate-600">NY-adjusted inspection star rating:</p>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => onStarChange(String(s))}
              aria-pressed={currentStars === s}
              className={cx(
                "rounded-[var(--radius-control)] border px-3 py-1.5 text-sm",
                currentStars === s ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                FOCUS_RING
              )}
            >
              {s}★
            </button>
          ))}
        </div>
      </div>
      {m.starMap && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-1">Stars</th>
              <th className="py-1">Points</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(m.starMap)
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(([stars, pts]) => (
                <tr key={stars} className={cx("border-t border-slate-100", currentStars === Number(stars) && "font-semibold text-teal-700")}>
                  <td className="py-1 tabular-nums">{stars}★</td>
                  <td className="py-1 tabular-nums">{pts} pts</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
      {currentStars && points !== null && <p className="text-sm text-teal-700">{points}/{m.maxPoints} pts</p>}
      <SourceMeta m={m} />
    </div>
  );
}

function BinaryDetail({ m, actual, scored, year, binaryVal, onBinaryChange }) {
  const points = scored?.points ?? null;
  return (
    <div className="flex flex-col gap-4">
      <OfficialBox year={year} actual={actual} m={m} />
      <div>
        <p className="mb-1.5 text-sm text-slate-600">On-time flu data filing:</p>
        <div className="flex gap-1.5">
          {[
            { value: "yes", label: "Yes, on time" },
            { value: "no", label: "No, late" },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onBinaryChange(opt.value)}
              aria-pressed={binaryVal === opt.value}
              className={cx(
                "rounded-[var(--radius-control)] border px-3 py-1.5 text-sm",
                binaryVal === opt.value ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                FOCUS_RING
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {!binaryVal && <p className="mt-1.5 text-xs text-slate-500">Not entered — stays unknown, never scored as "no".</p>}
      </div>
      {binaryVal && points !== null && <p className="text-sm text-teal-700">{points}/{m.maxPoints} pts</p>}
      <SourceMeta m={m} />
    </div>
  );
}

function PahDetail({ m, actual, scored, year, pahScenario, setPah }) {
  return (
    <div className="flex flex-col gap-4">
      <OfficialBox year={year} actual={actual} m={m} />
      <div className="rounded-[var(--radius-control)] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{m.applicability?.note}</div>
      <div>
        <p className="mb-1.5 text-sm text-slate-600">Scenario for cycle planning:</p>
        <div className="flex flex-wrap gap-1.5">
          {[null, "official", 0, 2, 6, 8, 10].map(opt => (
            <button
              key={String(opt)}
              type="button"
              onClick={() => setPah(opt)}
              aria-pressed={pahScenario === opt}
              className={cx(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                pahScenario === opt ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                FOCUS_RING
              )}
            >
              {opt === null ? "Unresolved" : opt === "official" ? `Use official ${year}` : `${opt} pts`}
            </button>
          ))}
        </div>
      </div>
      {scored?.points !== null && scored?.points !== undefined && <p className="text-sm text-teal-700">{scored.points}/{m.maxPoints} pts</p>}
      <SourceMeta m={m} />
    </div>
  );
}

export default function MeasureDetail(props) {
  const { m, onPrev, onNext, hasPrev, hasNext } = props;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm text-slate-500">{m.officialName}</h3>
        <div className="flex gap-1">
          <button type="button" disabled={!hasPrev} onClick={onPrev} className={cx("rounded-[var(--radius-control)] px-2 py-1 text-xs font-medium text-slate-600 enabled:hover:bg-slate-50 disabled:opacity-30", FOCUS_RING)}>
            ← Previous
          </button>
          <button type="button" disabled={!hasNext} onClick={onNext} className={cx("rounded-[var(--radius-control)] px-2 py-1 text-xs font-medium text-slate-600 enabled:hover:bg-slate-50 disabled:opacity-30", FOCUS_RING)}>
            Next →
          </button>
        </div>
      </div>
      {m.id === "pah" ? (
        <PahDetail {...props} />
      ) : m.scoringRule === "quintile" ? (
        <QuintileDetail {...props} />
      ) : m.scoringRule === "threshold" ? (
        <ThresholdDetail {...props} />
      ) : m.scoringRule === "star_map" ? (
        <StarMapDetail {...props} />
      ) : m.scoringRule === "binary" ? (
        <BinaryDetail {...props} />
      ) : null}
    </div>
  );
}
