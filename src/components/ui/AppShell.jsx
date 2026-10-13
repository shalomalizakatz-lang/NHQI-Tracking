import { NavLink } from "react-router-dom";
import { FOCUS_RING, cx } from "./classNames.js";

// Compact top shell, not a sidebar rail -- with only two top-level
// destinations (Portfolio, Data & settings), a rail would be the "enormous
// empty sidebar" the redesign brief explicitly warns against. On mobile the
// brand line stays short ("NHQI Tracker") rather than the full program name,
// which lives in quiet persistent product info text elsewhere instead.
const NAV_ITEMS = [
  { to: "/", label: "Portfolio", end: true },
  { to: "/settings", label: "Data & settings", end: true },
];

export default function AppShell({ children, breadcrumb }) {
  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-teal-700 focus:shadow"
      >
        Skip to main content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-5 w-1.5 shrink-0 rounded-full bg-teal-600" aria-hidden="true" />
            <span className="truncate text-base font-semibold text-slate-900">NHQI Tracker</span>
            {breadcrumb}
          </div>
          <nav aria-label="Main" className="flex shrink-0 items-center gap-1">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    "rounded-[var(--radius-control)] px-2.5 py-1.5 text-sm font-medium",
                    isActive ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50",
                    FOCUS_RING
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-xs text-slate-500 sm:px-6">
        NHQI Multi-Facility Tracker · Independent planning tool. Not affiliated with NY DOH.
      </footer>
    </div>
  );
}
