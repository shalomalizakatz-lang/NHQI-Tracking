import { HashRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import Portfolio from "./pages/Portfolio.jsx";
import FacilityTracker from "./pages/FacilityTracker.jsx";
import Settings from "./pages/Settings.jsx";
import AppShell from "./components/ui/AppShell.jsx";

// A bare /facility/:facilityId (an old bookmark/share link, or a link with no
// tab segment) redirects to its Overview tab so existing links keep working.
// Built explicit with useParams rather than a relative <Navigate to="overview">
// to avoid depending on route-relative resolution semantics.
function RedirectToOverview() {
  const { facilityId } = useParams();
  return <Navigate to={`/facility/${facilityId}/overview`} replace />;
}

export default function App() {
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Portfolio />} />
          <Route path="/facility/:facilityId" element={<RedirectToOverview />} />
          <Route path="/facility/:facilityId/:tab" element={<FacilityTracker />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </AppShell>
    </HashRouter>
  );
}
