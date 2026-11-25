import { Bar, BarChart, CartesianGrid, Legend as RLegend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { AXIS, GRID, TOOLTIP_STYLE, shortSeason } from "../components/chartKit";
import { SearchSelect } from "../components/SearchSelect";
import { TeamBadge } from "../components/TeamBadge";
import { useTeamOptions } from "../components/MatchSelectors";
import { Alert, ChartCard, DatasetGate, ErrorState, PageHeader, Spinner, StatCard, fmt, pct } from "../components/ui";
import { displayName } from "../data/teams";
import { useApp } from "../hooks/AppContext";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";

export default function TeamAnalytics() {
  return (<div><PageHeader title="Team Analytics" subtitle="Record, scoring and opposition for any IPL franchise, season by season." /><DatasetGate><Body /></DatasetGate></div>);
}

function Body() {
  const { config, setConfig, teams, seasons } = useApp();
  const all = useTeamOptions();
  const inData = useMemo(() => all.filter((o) => teams.find((t) => t.name === o.value)?.in_dataset !== false), [all, teams]);
  const [team, setTeam] = useState(config.battingTeam);
  const [season, setSeason] = useState(config.season);
  useEffect(() => { if (inData.length && !inData.some((o) => o.value === team)) setTeam(inData[0].value); }, [inData, team]);
  useEffect(() => { setConfig({ season }); }, [season]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = useAsync(() => api.team(team, season || undefined), [team, season], !!team);

  return (
    <div className="space-y-6">
      <div className="card card-pad grid gap-4 sm:grid-cols-2">
        <SearchSelect id="ta-team" label="Franchise" value={team} onChange={setTeam} options={inData} />
        <SearchSelect id="ta-season" label="Season" value={season} onChange={setSeason} options={seasons.map((s) => ({ value: s, label: s }))} clearLabel="All seasons" hint="Filters the summary, opponents and venues. Season charts always show every season." />
      </div>
      {q.loading && <Spinner />}
      {q.error && <ErrorState error={q.error} onRetry={q.reload} />}
      {q.data && <Content d={q.data} />}
    </div>
  );
}

function Content({ d }: { d: NonNullable<ReturnType<typeof useAsync<Awaited<ReturnType<typeof api.team>>>>["data"]> }) {
  const s = d.summary;
  const bySeason = d.by_season.map((r) => ({ ...r, label: shortSeason(r.season) }));
  const opp = d.vs_opponents.map((o) => ({ name: displayName(o.opponent), win_pct: o.win_pct ?? 0, matches: o.matches, wins: o.wins, losses: o.losses }));
  const ven = d.by_venue.slice(0, 12).map((v) => ({ name: v.venue, win_pct: v.win_pct ?? 0, matches: v.matches, wins: v.wins }));
  const none = d.by_season.length === 0;
  return (
    <>
      <div className="card card-pad flex flex-wrap items-center gap-4">
        <TeamBadge name={d.team.name} size="xl" />
        <div className="min-w-0">
          <h2 className="text-3xl font-semibold">{d.team.display_name}</h2>
          <p className="text-sm text-muted">{d.seasons_played.length ? `Played ${d.seasons_played.length} season${d.seasons_played.length > 1 ? "s" : ""}: ${d.seasons_played[0]} to ${d.seasons_played[d.seasons_played.length - 1]}` : "No matches in the dataset"}
            {d.team.active === false ? " (no longer in the league)" : ""}{d.season_filter ? `. Showing ${d.season_filter}.` : "."}</p>
        </div>
      </div>
      {s.matches === 0 && <Alert tone="warn">No matches found for this team in the selected season.</Alert>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Matches" value={s.matches} sub={s.no_results ? `${s.no_results} no result` : undefined} />
        <StatCard label="Wins" value={s.wins} accent="pitch" />
        <StatCard label="Losses" value={s.losses} accent="brick" />
        <StatCard label="Win percentage" value={pct(s.win_pct)} accent="teal" sub="Of matches with a result" />
        <StatCard label="Average runs scored" value={fmt(s.avg_runs)} sub="Per innings" />
        <StatCard label="Average first innings" value={fmt(s.avg_first_innings)} />
        <StatCard label="Highest score" value={s.highest_score?.runs ?? "-"} sub={s.highest_score ? `v ${displayName(s.highest_score.against)}, ${s.highest_score.season}` : undefined} />
        <StatCard label="Lowest score" value={s.lowest_score?.runs ?? "-"} sub={s.lowest_score ? `v ${displayName(s.lowest_score.against)}, ${s.lowest_score.season}` : "Completed innings only"} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Batting first" value={`${s.bat_first_wins}/${s.bat_first_matches}`} sub={`${pct(s.bat_first_win_pct)} won`} />
        <StatCard label="Chasing" value={`${s.chase_wins}/${s.chase_matches}`} sub={`${pct(s.chase_win_pct)} won`} />
        <StatCard label="Avg runs conceded" value={fmt(s.avg_runs_conceded)} sub="Bowling, per innings" />
        <StatCard label="Avg wickets taken" value={fmt(s.avg_wickets_taken)} sub="Per innings bowled" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Wins and losses by season" empty={none}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={bySeason} margin={{ left: 0, right: 8, bottom: 16 }}>
            <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis tick={AXIS} allowDecimals={false} width={32} label={{ value: "Matches", angle: -90, position: "insideLeft", ...AXIS }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} /><RLegend verticalAlign="top" height={28} />
            <Bar dataKey="wins" name="Wins" stackId="a" fill="#2F7D4F" isAnimationActive={false} /><Bar dataKey="losses" name="Losses" stackId="a" fill="#B63D32" isAnimationActive={false} />
          </BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Win percentage over the years" subtitle="Share of matches with a result that the team won" empty={none}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={bySeason} margin={{ left: 0, right: 12, bottom: 16 }}>
            <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis domain={[0, 100]} tick={AXIS} width={40} unit="%" />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, "Win %"]} />
            <Line dataKey="win_pct" name="Win %" stroke="#0F7C82" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Average runs scored by season" subtitle="Per innings, excluding rain-affected matches" empty={none}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={bySeason} margin={{ left: 0, right: 8, bottom: 16 }}>
            <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis tick={AXIS} width={40} domain={[0, "auto"]} label={{ value: "Runs", angle: -90, position: "insideLeft", ...AXIS }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} /><Bar dataKey="avg_runs" name="Average runs" fill="#0F2A4A" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Highest score in each season" empty={none}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={bySeason} margin={{ left: 0, right: 8, bottom: 16 }}>
            <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis tick={AXIS} width={40} domain={[0, "auto"]} label={{ value: "Runs", angle: -90, position: "insideLeft", ...AXIS }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} /><Bar dataKey="highest_score" name="Highest score" fill="#D69E2E" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Batting and bowling trend" subtitle="Average runs scored vs conceded per innings" empty={none}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={bySeason} margin={{ left: 0, right: 12, bottom: 16 }}>
            <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis tick={AXIS} width={40} domain={["auto", "auto"]} label={{ value: "Runs", angle: -90, position: "insideLeft", ...AXIS }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} /><RLegend verticalAlign="top" height={28} />
            <Line dataKey="avg_runs" name="Scored" stroke="#0F2A4A" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
            <Line dataKey="avg_runs_conceded" name="Conceded" stroke="#B63D32" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Performance against opponents" subtitle="Win percentage; hover for the match count" empty={!opp.length} height={Math.max(300, opp.length * 28 + 40)}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={opp} layout="vertical" margin={{ left: 0, right: 24 }}>
            <CartesianGrid stroke={GRID} horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={AXIS} unit="%" /><YAxis type="category" dataKey="name" tick={AXIS} width={150} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, _n, p) => [`${v}% (${p.payload.wins} wins from ${p.payload.matches})`, "Win %"]} />
            <Bar dataKey="win_pct" name="Win %" fill="#12908E" radius={[0, 3, 3, 0]} isAnimationActive={false} />
          </BarChart></ResponsiveContainer>
        </ChartCard>
      </div>
      <ChartCard title="Venue-wise win percentage" subtitle="The 12 venues with the most matches" empty={!ven.length} height={Math.max(300, ven.length * 30 + 40)}>
        <ResponsiveContainer width="100%" height="100%"><BarChart data={ven} layout="vertical" margin={{ left: 0, right: 24 }}>
          <CartesianGrid stroke={GRID} horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={AXIS} unit="%" /><YAxis type="category" dataKey="name" tick={AXIS} width={230} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, _n, p) => [`${v}% (${p.payload.wins} wins from ${p.payload.matches})`, "Win %"]} />
          <Bar dataKey="win_pct" name="Win %" fill="#0F2A4A" radius={[0, 3, 3, 0]} isAnimationActive={false} />
        </BarChart></ResponsiveContainer>
      </ChartCard>
      <p className="text-xs text-muted">{d.notes.join(" ")}</p>
    </>
  );
}
