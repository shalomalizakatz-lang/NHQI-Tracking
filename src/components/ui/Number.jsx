import { cx } from "./classNames.js";

// A figure with its unit/denominator kept visually atomic, and its basis
// qualifier (what it's modeled/measured against) directly underneath --
// uncertainty stays adjacent to the number, never buried in a footer.
export default function Number({ value, unit, denominator, basis, size = "lg", className }) {
  const sizeClass = size === "lg" ? "text-2xl" : size === "md" ? "text-xl" : "text-base";
  return (
    <div className={cx("flex flex-col", className)}>
      <div className={cx("flex items-baseline gap-1 font-semibold tabular-nums text-slate-900", sizeClass)}>
        <span>{value === null || value === undefined ? "—" : value}</span>
        {unit && <span className="text-sm font-normal text-slate-500">{unit}</span>}
        {denominator && <span className="text-sm font-normal text-slate-500">/{denominator}</span>}
      </div>
      {basis && <p className="mt-0.5 text-xs text-slate-500">{basis}</p>}
    </div>
  );
}
