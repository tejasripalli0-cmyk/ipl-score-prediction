import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend as RLegend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, GRID, TOOLTIP_STYLE, shortSeason } from "../components/chartKit";
import { MultiSelect } from "../components/SearchSelect";
import { TeamBadge } from "../components/TeamBadge";
import { Card, ChartCard, DatasetGate, ErrorState, PageHeader, Spinner, StatCard, fmt, pct } from "../components/ui";
import { displayName } from "../data/teams";
import { useApp } from "../hooks/AppContext";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";

export default function SeasonTrends() {
  return (<div><PageHeader title="Season Trends" subtitle="How scoring, wickets and team success have changed across IPL seasons." /><DatasetGate><Body /></DatasetGate></div>);
}

function Body() {
  const { seasons } = useApp();
  const [sel, setSel] = useState<string[]>([]);
  const q = useAsync(() => api.seasonsSummary(sel), [sel.join("|")]);
  return (
    <div className="space-y-6">
      <div className="card card-pad max-w-2xl"><MultiSelect id="st-seasons" label="Seasons" values={sel} onChange={setSel} options={seasons.map((s) => ({ value: s, label: s }))} placeholder="All seasons" hint="Leave empty to include every season" /></div>
      {q.loading && <Spinner />}
      {q.error && <ErrorState error={q.error} onRetry={q.reload} />}
      {q.data && <Content d={q.data} />}
    </div>
  );
}

function Content({ d }: { d: NonNullable<Awaited<ReturnType<typeof api.seasonsSummary>>> }) {
  const a = d.aggregate;
  const rows = d.seasons.map((s) => ({ ...s, label: shortSeason(s.season) }));
  const top = a.teams.slice(0, 10).map((t) => ({ ...t, name: displayName(t.team) }));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Matches" value={a.matches.toLocaleString()} sub={`${d.seasons.length} season${d.seasons.length === 1 ? "" : "s"}`} />
        <StatCard label="Avg first innings" value={fmt(a.avg_first_innings)} accent="teal" />
        <StatCard label="Avg second innings" value={fmt(a.avg_second_innings)} accent="teal" />
        <StatCard label="Highest score" value={a.highest_score ?? "-"} />
        <StatCard label="Total runs" value={a.total_runs.toLocaleString()} />
        <StatCard label="Total wickets" value={a.total_wickets.toLocaleString()} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Average innings score by season" subtitle="Excluding rain-affected matches" empty={!rows.length}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{ left: 0, right: 12, bottom: 16 }}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis tick={AXIS} width={40} domain={["auto", "auto"]} label={{ value: "Runs", angle: -90, position: "insideLeft", ...AXIS }} /><Tooltip contentStyle={TOOLTIP_STYLE} /><RLegend verticalAlign="top" height={28} />
            <Line dataKey="avg_first_innings" name="First innings" stroke="#0F2A4A" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} /><Line dataKey="avg_second_innings" name="Second innings" stroke="#12908E" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} /></LineChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Highest score by season" empty={!rows.length}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ left: 0, right: 8, bottom: 16 }}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis tick={AXIS} width={40} domain={[0, "auto"]} /><Tooltip contentStyle={TOOLTIP_STYLE} /><Bar dataKey="highest_score" name="Highest score" fill="#D69E2E" radius={[3, 3, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Total runs and wickets" subtitle="Per season" empty={!rows.length}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ left: 0, right: 8, bottom: 16 }}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis yAxisId="r" tick={AXIS} width={48} /><YAxis yAxisId="w" orientation="right" tick={AXIS} width={40} /><Tooltip contentStyle={TOOLTIP_STYLE} /><RLegend verticalAlign="top" height={28} />
            <Bar yAxisId="r" dataKey="total_runs" name="Runs" fill="#0F2A4A" isAnimationActive={false} /><Bar yAxisId="w" dataKey="total_wickets" name="Wickets" fill="#B63D32" isAnimationActive={false} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Scoring rate by season" subtitle="Runs per over, all innings" empty={!rows.length}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{ left: 0, right: 12, bottom: 16 }}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis tick={AXIS} width={40} domain={["auto", "auto"]} /><Tooltip contentStyle={TOOLTIP_STYLE} /><Line dataKey="run_rate" name="Runs per over" stroke="#2F7D4F" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} /></LineChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Most successful teams" subtitle="Wins across the selected seasons" empty={!top.length} height={Math.max(300, top.length * 30 + 40)} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={top} layout="vertical" margin={{ left: 0, right: 30 }}><CartesianGrid stroke={GRID} horizontal={false} /><XAxis type="number" tick={AXIS} allowDecimals={false} /><YAxis type="category" dataKey="name" tick={AXIS} width={170} /><Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="wins" name="Wins" fill="#2F7D4F" radius={[0, 3, 3, 0]} isAnimationActive={false} label={{ position: "right", fontSize: 11, fill: "#16222F" }} /></BarChart></ResponsiveContainer>
        </ChartCard>
      </div>
      <Card pad={false}>
        <div className="px-5 pt-5"><h3 className="text-lg font-semibold">Team-wise performance</h3><p className="text-xs text-muted">Win % is wins divided by matches with a result.</p></div>
        <div className="mt-3 max-h-[420px] overflow-auto"><table className="w-full min-w-[560px] text-sm">
          <thead className="sticky top-0 bg-slate-50"><tr className="border-y border-line text-left">{["Team", "Matches", "Wins", "Losses", "Win %", "Avg score"].map((h) => <th key={h} scope="col" className="px-4 py-2 font-medium text-muted">{h}</th>)}</tr></thead>
          <tbody>{a.teams.map((t) => (<tr key={t.team} className="border-b border-line last:border-0"><th scope="row" className="px-4 py-2 text-left font-normal"><span className="inline-flex items-center gap-2"><TeamBadge name={t.team} size="xs" />{displayName(t.team)}</span></th>
            <td className="px-4 py-2">{t.matches}</td><td className="px-4 py-2">{t.wins}</td><td className="px-4 py-2">{t.losses}</td><td className="px-4 py-2">{pct(t.win_pct)}</td><td className="px-4 py-2">{fmt(t.avg_runs)}</td></tr>))}</tbody></table></div>
      </Card>
    </>
  );
}
