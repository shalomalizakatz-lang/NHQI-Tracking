import { cx } from "./classNames.js";

export default function SectionHeading({ children, meta, action, className, as: As = "h2" }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-3", className)}>
      <As className="text-base font-semibold text-slate-900">{children}</As>
      <div className="flex items-center gap-3">
        {meta && <span className="text-xs text-slate-500">{meta}</span>}
        {action}
      </div>
    </div>
  );
}
