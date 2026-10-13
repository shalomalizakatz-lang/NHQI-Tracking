import { Link } from "react-router-dom";
import { FOCUS_RING, cx } from "./classNames.js";

// Deliberately NOT the ARIA "tablist"/"tab" pattern: these items navigate
// (real URLs, back/forward work), which is a navigation list, not the
// show/hide-one-panel-in-place behavior that role="tablist" promises and
// that would need roving-tabindex arrow-key handling we don't implement.
export default function Tabs({ items, activeKey, label, className }) {
  return (
    <nav aria-label={label} className={cx("flex gap-x-1 border-b border-slate-200", className)}>
      {items.map(item => {
        const isActive = item.key === activeKey;
        return (
          <Link
            key={item.key}
            to={item.to}
            aria-current={isActive ? "page" : undefined}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              isActive ? "border-teal-700 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-900",
              FOCUS_RING
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
