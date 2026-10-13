import { OBSERVATION_STATE_COLOR } from "../../lib/designTokens.js";
import { cx } from "./classNames.js";

// Status pill. Always pairs its color with the text passed as children --
// never relies on color alone to carry meaning.
const TONE_CLASSES = {
  accent: "bg-teal-50 text-teal-700 border-teal-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  red: "bg-red-50 text-red-800 border-red-200",
  green: "bg-green-50 text-green-700 border-green-200",
  neutral: "bg-slate-50 text-slate-600 border-slate-200",
};

export default function Badge({ tone = "neutral", children, className }) {
  const toneClass = TONE_CLASSES[tone] ?? TONE_CLASSES.neutral;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClass,
        className
      )}
    >
      {children}
    </span>
  );
}

// Which Badge tone a typed observation state should render with -- the one
// source of truth for this mapping, shared with the contrast checker via
// designTokens.js. `valid` maps to an explicit `null` (plain data gets no
// status badge) -- using `in` rather than `??` matters here, since `null ??
// "neutral"` would treat that explicit null as "missing" and wrongly fall
// back to "neutral" instead of "no badge."
export function toneForObservationState(state) {
  return state in OBSERVATION_STATE_COLOR ? OBSERVATION_STATE_COLOR[state] : "neutral";
}
