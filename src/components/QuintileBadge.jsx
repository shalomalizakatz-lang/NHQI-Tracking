import { qColor } from "../lib/colors.js";

export default function QuintileBadge({ quintile, label }) {
  if (quintile === null || quintile === undefined) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const c = qColor(quintile);
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full border"
      style={{ color: c, borderColor: c + "40", background: c + "14" }}
    >
      {label ?? `Q${quintile}`}
    </span>
  );
}
