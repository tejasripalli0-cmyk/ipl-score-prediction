import { Activity, BarChart3, Info, LayoutDashboard, MapPin, Menu, Percent, Scale, Target, TrendingUp, User, X, BrainCircuit, RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useApp } from "../hooks/AppContext";

export const NAV = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/score-predictor", label: "Score Predictor", icon: Target },
  { to: "/win-probability", label: "Win Probability", icon: Percent },
  { to: "/team-analytics", label: "Team Analytics", icon: BarChart3 },
  { to: "/team-comparison", label: "Team Comparison", icon: Scale },
  { to: "/player-analytics", label: "Player Analytics", icon: User },
  { to: "/venue-analytics", label: "Venue Analytics", icon: MapPin },
  { to: "/season-trends", label: "Season Trends", icon: TrendingUp },
  { to: "/model-insights", label: "Model Insights", icon: BrainCircuit },
  { to: "/about", label: "About Project", icon: Info },
] as const;

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-navy text-white"><Activity className="h-5 w-5 text-teal-600" aria-hidden /></span>
      <span className="font-display text-2xl font-bold leading-none tracking-tight text-navy">IPL Insight</span>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon, ...rest }) => (
        <NavLink key={to} to={to} end={"end" in rest} onClick={onNavigate}
          className={({ isActive }) => `flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors ${isActive ? "border-teal bg-teal-50 text-navy" : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-ink"}`}>
          <Icon className="h-4 w-4 shrink-0" aria-hidden />{label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { error, retry, status } = useApp();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-white px-3 py-5 lg:flex">
        <div className="px-3 pb-6"><Brand /></div>
        <NavList />
        <div className="mt-auto px-3 pt-4 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${error ? "bg-brick" : "bg-pitch"}`} aria-hidden />
            {error ? "API offline" : "API connected"}
          </div>
          <div className="mt-1">{status?.dataset_loaded ? `${status.matches?.toLocaleString()} matches loaded` : "Historical dataset not loaded"}</div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <Brand />
          <button className="btn-secondary !px-2.5" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>
        {open && (
          <div className="fixed inset-x-0 top-[57px] z-30 max-h-[calc(100vh-57px)] overflow-auto border-b border-line bg-white p-3 shadow-pop lg:hidden">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        )}

        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {error?.network && (
            <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-brick/30 bg-brick-50 px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-ink"><WifiOff className="h-4 w-4 text-brick" aria-hidden />{error.message}</span>
              <button className="btn-secondary" onClick={retry}><RefreshCw className="h-4 w-4" aria-hidden /> Retry</button>
            </div>
          )}
          <Outlet />
        </main>
        <footer className="border-t border-line bg-white px-4 py-5 text-center text-xs text-muted">
          IPL Insight is an independent analytics project and is not affiliated with the IPL or any franchise. Predictions are model estimates, not guarantees.
        </footer>
      </div>
    </div>
  );
}
