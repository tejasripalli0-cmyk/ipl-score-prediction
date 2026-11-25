import { ArrowRight, BarChart3, Percent, Scale, Target } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PredictionVenueSelect, TeamSelect } from "../components/MatchSelectors";
import { SearchSelect } from "../components/SearchSelect";
import { TeamBadge } from "../components/TeamBadge";
import { Alert, Segmented, Spinner, StatCard, fmt } from "../components/ui";
import { displayName } from "../data/teams";
import { useApp } from "../hooks/AppContext";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";

const CARDS = [
  { to: "/score-predictor", title: "Score Prediction", text: "Project the final score of an innings from the current match situation.", icon: Target },
  { to: "/win-probability", title: "Win Probability", text: "See how likely the chasing side is to win at any point in the chase.", icon: Percent },
  { to: "/team-analytics", title: "Team Analytics", text: "Season-by-season record, opponents and venues for any franchise.", icon: BarChart3 },
  { to: "/team-comparison", title: "Team Comparison", text: "Put two or more teams side by side, with head-to-head results.", icon: Scale },
];

export default function Home() {
  const { config, setConfig, status, seasons, loading } = useApp();
  const nav = useNavigate();
  const loaded = !!status?.dataset_loaded;
  const overview = useAsync(() => api.overview(), [loaded], loaded);
  const seasonOpts = seasons.map((s) => ({ value: s, label: s }));
  const go = () => nav(config.inningsType === "first" ? "/score-predictor" : "/win-probability");

  return (
    <div className="space-y-10">
      <section aria-labelledby="hero">
        <h1 id="hero" className="font-display text-5xl font-bold leading-[0.95] sm:text-7xl">IPL INSIGHT</h1>
        <p className="mt-2 font-display text-xl font-semibold tracking-wide text-teal sm:text-2xl">AI-POWERED CRICKET ANALYTICS</p>
        <p className="mt-3 max-w-xl text-base text-slate-700">Predict scores, analyse team performance and explore the game through machine learning.</p>

        <div className="card mt-6 overflow-hidden">
          <div className="border-b border-line bg-navy px-4 py-4 text-white sm:px-6">
            <div className="text-sm text-navy-100">Match configuration</div>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
              <div className="flex min-w-0 items-center gap-3">
                <TeamBadge name={config.battingTeam} size="lg" className="ring-2 ring-white/30" />
                <div className="min-w-0"><div className="text-xs text-navy-100">Batting</div><div className="truncate font-display text-xl font-semibold sm:text-3xl">{displayName(config.battingTeam)}</div></div>
              </div>
              <div className="font-display text-lg font-semibold text-teal-100 sm:text-2xl">vs</div>
              <div className="flex min-w-0 flex-row-reverse items-center gap-3 text-right">
                <TeamBadge name={config.bowlingTeam} size="lg" className="ring-2 ring-white/30" />
                <div className="min-w-0"><div className="text-xs text-navy-100">Bowling</div><div className="truncate font-display text-xl font-semibold sm:text-3xl">{displayName(config.bowlingTeam)}</div></div>
              </div>
            </div>
            <div className="mt-3 truncate text-sm text-navy-100">{config.venue === "__other__" ? "Other venue" : config.venue}{config.season ? `, ${config.season}` : ""}</div>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            <SearchSelect id="h-season" label="Season" value={config.season} onChange={(v) => setConfig({ season: v })} options={seasonOpts} clearLabel="All seasons" disabled={!loaded}
              hint={loaded ? "Used to filter the analytics pages" : "Available once the dataset is loaded"} />
            <TeamSelect prediction id="h-bat" label="Batting team" value={config.battingTeam} exclude={config.bowlingTeam} onChange={(v) => setConfig({ battingTeam: v })} />
            <TeamSelect prediction id="h-bowl" label="Bowling team" value={config.bowlingTeam} exclude={config.battingTeam} onChange={(v) => setConfig({ bowlingTeam: v })} />
            <PredictionVenueSelect id="h-venue" value={config.venue} onChange={(v) => setConfig({ venue: v })} />
            <div>
              <span className="label">Innings type</span>
              <Segmented label="Innings type" value={config.inningsType} onChange={(v) => setConfig({ inningsType: v })} options={[{ value: "first", label: "First innings" }, { value: "second", label: "Second innings" }]} />
            </div>
            <div className="flex items-end"><button className="btn-primary w-full" onClick={go} disabled={loading}>{config.inningsType === "first" ? "Open score predictor" : "Open win probability"} <ArrowRight className="h-4 w-4" aria-hidden /></button></div>
          </div>
        </div>
      </section>

      <section aria-labelledby="stats">
        <h2 id="stats" className="section-title mb-3">IPL at a glance</h2>
        {!loaded ? (
          <Alert tone="info" title="Historical statistics will appear here">Add the ball-by-ball CSV to <code className="rounded bg-white px-1">backend/data/</code> and restart the API. Score and win-probability predictions work without it.</Alert>
        ) : overview.loading ? <Spinner /> : overview.data && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Matches" value={overview.data.matches.toLocaleString()} sub={`${overview.data.first_season} to ${overview.data.last_season}`} />
            <StatCard label="Average first innings" value={fmt(overview.data.avg_first_innings)} sub="Excludes rain-affected matches" accent="teal" />
            <StatCard label="Highest score" value={overview.data.highest_score?.runs ?? "-"} sub={overview.data.highest_score ? `${displayName(overview.data.highest_score.team)}, ${overview.data.highest_score.season}` : undefined} />
            <StatCard label="Chasing win rate" value={`${fmt(overview.data.chase_win_pct)}%`} sub={`Batting first ${fmt(overview.data.bat_first_win_pct)}%`} accent="pitch" />
          </div>
        )}
      </section>

      <section aria-labelledby="explore">
        <h2 id="explore" className="section-title mb-3">Explore</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map(({ to, title, text, icon: Icon }) => (
            <Link key={to} to={to} className="card card-pad group block transition-colors hover:border-teal">
              <Icon className="h-6 w-6 text-teal" aria-hidden />
              <div className="mt-3 font-display text-xl font-semibold text-navy">{title}</div>
              <p className="mt-1 text-sm text-muted">{text}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-teal">Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
