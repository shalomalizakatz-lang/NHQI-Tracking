import { cx } from "./classNames.js";

// Label/value/qualifier block, kept as one visually atomic unit -- this is
// how a benchmark label, measurement period, or verification status stays
// next to the number it qualifies instead of drifting into a footer.
export default function SourceDetail({ label, value, qualifier, className }) {
  return (
    <div className={cx("flex flex-col gap-0.5", className)}>
      {label && <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>}
      {value && <span className="text-sm text-slate-900">{value}</span>}
      {qualifier && <span className="text-xs text-slate-500">{qualifier}</span>}
    </div>
  );
}
