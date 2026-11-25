import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend as RLegend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, GRID, TOOLTIP_STYLE, shortSeason } from "../components/chartKit";
import { SearchSelect } from "../components/SearchSelect";
import { Card, ChartCard, DatasetGate, ErrorState, PageHeader, Spinner, StatCard, fmt, pct } from "../components/ui";
import { displayName } from "../data/teams";
import { useApp } from "../hooks/AppContext";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";

export default function VenueAnalytics() {
  return (<div><PageHeader title="Venue Analytics" subtitle="Scoring, toss-independent batting-first vs chasing results and team records at each ground." /><DatasetGate><Body /></DatasetGate></div>);
}

function Body() {
  const { config } = useApp();
  const venues = useAsync(() => api.venues(), []);
  const [venue, setVenue] = useState("");
  useEffect(() => {
    if (venue || !venues.data?.length) return;
    setVenue(venues.data.find((v) => v.name === config.venue)?.name ?? venues.data[0].name);
  }, [venues.data, venue, config.venue]);
  const q = useAsync(() => api.venue(venue), [venue], !!venue);

  return (
    <div className="space-y-6">
      <div className="card card-pad max-w-xl">
        <SearchSelect id="va-venue" label="Venue" value={venue} onChange={setVenue} options={(venues.data ?? []).map((v) => ({ value: v.name, label: v.name, sub: `${v.matches} matches` }))} placeholder="Select a venue" hint="Different spellings of the same ground are combined." />
      </div>
      {(venues.loading || q.loading) && <Spinner />}
      {venues.error && <ErrorState error={venues.error} onRetry={venues.reload} />}
      {q.error && <ErrorState error={q.error} onRetry={q.reload} />}
      {q.data && <Content d={q.data} />}
    </div>
  );
}

function Content({ d }: { d: NonNullable<Awaited<ReturnType<typeof api.venue>>> }) {
  const seasons = d.by_season.map((s) => ({ ...s, label: shortSeason(s.season) }));
  const donut = [{ name: "Batting first", value: d.bat_first_wins, fill: "#0F2A4A" }, { name: "Chasing", value: d.chase_wins, fill: "#12908E" }];
  const teams = d.team_performance.slice(0, 12).map((t) => ({ ...t, name: displayName(t.team), win_pct: t.win_pct ?? 0 }));
  const top = d.top_scores.map((t) => ({ name: `${displayName(t.team)} (${shortSeason(t.season)})`, runs: t.runs }));
  return (
    <>
      <Card><h2 className="text-2xl font-semibold">{d.venue}</h2><p className="text-sm text-muted">IPL matches from {d.first_season} to {d.last_season}</p></Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total matches" value={d.matches} sub={d.no_results ? `${d.no_results} without a result` : undefined} />
        <StatCard label="Average first innings" value={fmt(d.avg_first_innings)} accent="teal" />
        <StatCard label="Average second innings" value={fmt(d.avg_second_innings)} accent="teal" />
        <StatCard label="Highest score" value={d.highest_score ?? "-"} sub={`Lowest completed: ${d.lowest_score ?? "-"}`} />
        <StatCard label="Batting-first wins" value={pct(d.bat_first_win_pct)} sub={`${d.bat_first_wins} matches`} />
        <StatCard label="Chasing wins" value={pct(d.chase_win_pct)} sub={`${d.chase_wins} matches`} accent="pitch" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Average scores by season" subtitle="First and second innings, excluding rain-affected matches">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={seasons} margin={{ left: 0, right: 12, bottom: 16 }}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis tick={AXIS} width={40} domain={["auto", "auto"]} label={{ value: "Runs", angle: -90, position: "insideLeft", ...AXIS }} /><Tooltip contentStyle={TOOLTIP_STYLE} /><RLegend verticalAlign="top" height={28} />
            <Line dataKey="avg_first_innings" name="First innings" stroke="#0F2A4A" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} /><Line dataKey="avg_second_innings" name="Second innings" stroke="#12908E" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} /></LineChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Highest scores at this venue" subtitle="Top 10 innings totals" empty={!top.length} height={Math.max(300, top.length * 30 + 40)}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={top} layout="vertical" margin={{ left: 0, right: 30 }}><CartesianGrid stroke={GRID} horizontal={false} /><XAxis type="number" tick={AXIS} domain={[0, "auto"]} /><YAxis type="category" dataKey="name" tick={AXIS} width={190} /><Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="runs" name="Runs" fill="#D69E2E" radius={[0, 3, 3, 0]} isAnimationActive={false} label={{ position: "right", fontSize: 11, fill: "#16222F" }} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Batting first vs chasing" subtitle="Share of matches with a result" empty={d.bat_first_wins + d.chase_wins === 0}>
          <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={donut} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} isAnimationActive={false} label={({ name, value }) => `${name}: ${value}`}>
            {donut.map((s) => <Cell key={s.name} fill={s.fill} />)}</Pie><Tooltip contentStyle={TOOLTIP_STYLE} /></PieChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Wins by season" subtitle="Batting first vs chasing">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={seasons} margin={{ left: 0, right: 8, bottom: 16 }}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis tick={AXIS} allowDecimals={false} width={32} /><Tooltip contentStyle={TOOLTIP_STYLE} /><RLegend verticalAlign="top" height={28} />
            <Bar dataKey="bat_first_wins" name="Batting first" stackId="w" fill="#0F2A4A" isAnimationActive={false} /><Bar dataKey="chase_wins" name="Chasing" stackId="w" fill="#12908E" isAnimationActive={false} /></BarChart></ResponsiveContainer>
        </ChartCard>
      </div>
      <ChartCard title="Team-wise performance here" subtitle="Win percentage; hover for matches played" empty={!teams.length} height={Math.max(300, teams.length * 30 + 40)}>
        <ResponsiveContainer width="100%" height="100%"><BarChart data={teams} layout="vertical" margin={{ left: 0, right: 24 }}><CartesianGrid stroke={GRID} horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={AXIS} unit="%" /><YAxis type="category" dataKey="name" tick={AXIS} width={160} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, _n, p) => [`${v}% (${p.payload.wins} wins from ${p.payload.matches})`, "Win %"]} /><Bar dataKey="win_pct" name="Win %" fill="#0F7C82" radius={[0, 3, 3, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer>
      </ChartCard>
      <p className="text-xs text-muted">{d.notes.join(" ")}</p>
    </>
  );
}
