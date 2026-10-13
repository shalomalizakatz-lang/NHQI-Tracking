import { qColor } from "../lib/colors.js";
import { getAllOpportunities, getMissingEvidence } from "../lib/opportunities.js";
import Card from "./ui/Card.jsx";
import Badge from "./ui/Badge.jsx";

// Consumes scorer.js's output (via the shared opportunities.js selection) directly -- no
// independent point math here. Two kinds of rows: real positive point gains (ranked by size),
// and missing-evidence tasks (measures where the input itself is unresolved, so there's
// nothing to score yet) — never disguised as the same thing, and never showing a 0-point
// "opportunity" dressed up as one.
export default function PriorityList({ scored }) {
  const opportunities = getAllOpportunities(scored);
  const missingEvidence = getMissingEvidence(scored);

  if (opportunities.length === 0 && missingEvidence.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">
        No real positive point gains identified from the current entries, and no missing inputs. Everything resolved is at its best tier for the selected benchmark.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {opportunities.length > 0 && (
        <div>
          <p className="mb-2.5 text-xs text-slate-500">Ranked by attainable point gain — only moves that actually earn points under the applicable 2025 rule for that measure.</p>
          <div className="flex flex-col gap-1.5">
            {opportunities.map((x, i) => {
              const { row, gain } = x;
              const m = row.measure;
              const label = m.higherIsBetter ? "↑" : "↓";
              return (
                <Card key={m.id} className="flex items-center gap-3 p-3">
                  {/* aria-hidden since the list's own DOM order already conveys rank to
                      assistive tech -- this restates it for sighted skimming only. That
                      doesn't exempt it from contrast rules, though: aria-hidden hides it from
                      screen readers, not from low-vision sighted users reading the screen, so
                      the color still has to clear 4.5:1 like any other visible text. */}
                  <div aria-hidden="true" className="w-6 shrink-0 text-right text-lg font-semibold tabular-nums text-slate-500">
                    #{i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="mb-0.5 text-sm font-semibold text-slate-900">{m.displayName}</div>
                    <div className="flex flex-wrap items-baseline gap-1.5 text-xs">
                      <span className="font-semibold" style={{ color: qColor(row.currentQuintile) }}>
                        Q{row.currentQuintile} → Q{row.currentQuintile - 1}
                      </span>
                      {row.gapInfo && (
                        <span className="text-amber-700">
                          {label} {row.gapInfo.gap.toFixed(1)}
                          {m.unit === "%" ? "%" : ` ${m.unit}`} needed · target {row.gapInfo.displayTarget}
                          {m.unit === "%" ? "%" : ` ${m.unit}`}
                        </span>
                      )}
                      {row.pointsBasis === "attainment_plus_improvement" && <span className="text-slate-500">(improvement-eligible, prior Q{row.priorQuintile})</span>}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-[var(--radius-control)] bg-green-50 px-3.5 py-1.5 text-center">
                    <div className="text-lg font-semibold tabular-nums text-green-700">+{gain}</div>
                    <div className="text-[10px] text-green-700">points</div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {missingEvidence.length > 0 && (
        <div>
          <p className="mb-2.5 text-xs text-slate-500">Missing evidence — entering these would resolve a currently-unresolved measure, not a guaranteed gain:</p>
          <div className="flex flex-col gap-1.5">
            {missingEvidence.map(r => (
              <div key={r.measure.id} className="rounded-[var(--radius-control)] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                <div className="flex items-center gap-2">
                  <strong className="font-semibold">{r.measure.displayName}</strong>
                  <Badge tone="amber">{r.observation.state === "invalid_input" ? "Invalid" : "Not entered"}</Badge>
                </div>
                <div className="mt-0.5 text-xs">
                  Up to {r.measure.maxPoints} pts at stake · period: {r.measure.measurementPeriod?.label ?? "unspecified"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
