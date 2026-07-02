import { HashRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Portfolio from "./pages/Portfolio.jsx";
import FacilityTracker from "./pages/FacilityTracker.jsx";
import Settings from "./pages/Settings.jsx";

function NavLink({ to, children }) {
  const loc = useLocation();
  const active = loc.pathname === to;
  return (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </Link>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#020817] text-slate-100">
      <div className="border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 bg-blue-600 rounded" />
          <div>
            <div className="text-base font-bold">NHQI Multi-Facility Tracker</div>
            <div className="text-[10px] text-slate-500 font-mono tracking-widest">NY DOH NURSING HOME QUALITY INITIATIVE</div>
          </div>
        </div>
        <nav className="flex gap-1">
          <NavLink to="/">Portfolio</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </div>
      {children}
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Portfolio />} />
          <Route path="/facility/:facilityId" element={<FacilityTracker />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}
