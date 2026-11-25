import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import { Spinner } from "./components/ui";
import Home from "./pages/Home";

const ScorePredictor = lazy(() => import("./pages/ScorePredictor"));
const WinProbability = lazy(() => import("./pages/WinProbability"));
const TeamAnalytics = lazy(() => import("./pages/TeamAnalytics"));
const TeamComparison = lazy(() => import("./pages/TeamComparison"));
const PlayerAnalytics = lazy(() => import("./pages/PlayerAnalytics"));
const VenueAnalytics = lazy(() => import("./pages/VenueAnalytics"));
const SeasonTrends = lazy(() => import("./pages/SeasonTrends"));
const ModelInsights = lazy(() => import("./pages/ModelInsights"));
const About = lazy(() => import("./pages/About"));

function NotFound() {
  return <div className="py-20 text-center"><h1 className="text-4xl font-semibold">Page not found</h1><p className="mt-2 text-muted">That page does not exist. Use the menu to get back on track.</p></div>;
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="score-predictor" element={<ScorePredictor />} />
          <Route path="win-probability" element={<WinProbability />} />
          <Route path="team-analytics" element={<TeamAnalytics />} />
          <Route path="team-comparison" element={<TeamComparison />} />
          <Route path="player-analytics" element={<PlayerAnalytics />} />
          <Route path="venue-analytics" element={<VenueAnalytics />} />
          <Route path="season-trends" element={<SeasonTrends />} />
          <Route path="model-insights" element={<ModelInsights />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
