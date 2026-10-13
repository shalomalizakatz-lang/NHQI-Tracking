import { FOCUS_RING, CONTROL_BORDER, cx } from "./classNames.js";

// Search + counted filter chips + a trailing slot (e.g. the selected
// benchmark). Each filter chip shows its own count so "All"/"Needs data"/etc
// are never guessed at -- the count comes from whatever the caller passes.
export function Toolbar({ children, className }) {
  return <div className={cx("flex flex-wrap items-center gap-3", className)}>{children}</div>;
}

export function SearchInput({ value, onChange, placeholder, "aria-label": ariaLabel }) {
  return (
    <input
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel || placeholder}
      className={cx(
        "rounded-[var(--radius-control)] px-3 py-1.5 text-sm",
        CONTROL_BORDER,
        FOCUS_RING
      )}
    />
  );
}

export function FilterChip({ active, count, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "rounded-full border px-3 py-1 text-xs font-medium",
        active ? "border-teal-700 bg-teal-50 text-teal-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
        FOCUS_RING
      )}
    >
      {children}
      {count !== undefined && <span className="ml-1 tabular-nums text-slate-500">{count}</span>}
    </button>
  );
}
