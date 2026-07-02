import { qColor } from "../lib/colors.js";

export default function QuintileBadge({ quintile, label }) {
  if (quintile === null || quintile === undefined) {
    return <span className="text-xs text-slate-600 font-mono">—</span>;
  }
  const c = qColor(quintile);
  return (
    <span
      className="text-xs font-mono font-bold px-2 py-0.5 rounded border"
      style={{ color: c, borderColor: c, background: c + "22" }}
    >
      {label ?? `Q${quintile}`}
    </span>
  );
}
