import { FOCUS_RING, cx } from "./classNames.js";

export function Table({ children, className, ...rest }) {
  return (
    <table className={cx("w-full border-collapse text-sm", className)} {...rest}>
      {children}
    </table>
  );
}

// A sortable column header is a real <button>, not an onClick on the <th> --
// the old pattern had no keyboard focus or activation. `sortKey` identifies
// the column in `sort`/`onSort`; omit it for a plain, non-sortable header.
export function Th({ children, sortKey, sort, onSort, align = "left", className }) {
  const isSorted = sortKey && sort?.key === sortKey;
  const ariaSort = isSorted ? (sort.dir === "asc" ? "ascending" : "descending") : sortKey ? "none" : undefined;
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th scope="col" aria-sort={ariaSort} className={cx("border-b border-slate-200 py-2", alignClass, className)}>
      {sortKey ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={cx(
            "inline-flex items-center gap-1 rounded-sm text-xs font-medium uppercase tracking-wide text-slate-500 hover:text-slate-900",
            FOCUS_RING
          )}
        >
          {children}
          {isSorted && <span aria-hidden="true">{sort.dir === "asc" ? "▲" : "▼"}</span>}
        </button>
      ) : (
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{children}</span>
      )}
    </th>
  );
}

export function TableRow({ children, className, ...rest }) {
  return (
    <tr className={cx("border-b border-slate-100 last:border-0 hover:bg-slate-50", className)} {...rest}>
      {children}
    </tr>
  );
}
