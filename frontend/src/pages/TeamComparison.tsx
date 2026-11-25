import { Bar, BarChart, CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { AXIS, GRID, Legend, TOOLTIP_STYLE, shortSeason } from "../components/chartKit";
import { SearchSelect, MultiSelect } from "../components/SearchSelect";
import { TeamBadge } from "../components/TeamBadge";
import { useTeamOptions } from "../components/MatchSelectors";
import { Alert, Card, ChartCard, DatasetGate, ErrorState, PageHeader, Spinner, fmt, pct } from "../components/ui";
import { chartColor, displayName } from "../data/teams";
import { useApp } from "../hooks/AppContext";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import type { Comparison, TeamSummary } from "../types";

export default function TeamComparison() {
  return (<div><PageHeader title="Team Comparison" subtitle="Compare two or more franchises on record, scoring and head-to-head results." /><DatasetGate><Body /></DatasetGate></div>);
}

function Body() {
  const { config, seasons } = useApp();
  const teamOpts = useTeamOptions();
  const venues = useAsync(() => api.venues(), []);
  const [teams, setTeams] = useState<string[]>([config.battingTeam, config.bowlingTeam]);
  const [sel, setSel] = useState<string[]>([]);
  const [venue, setVenue] = useState("");
  const ready = teams.length >= 2;
  const q = useAsync(() => api.compare(teams, sel, venue || undefined), [teams.join("|"), sel.join("|"), venue], ready);

  return (
    <div className="space-y-6">
      <div className="card card-pad grid gap-4 lg:grid-cols-3">
        <MultiSelect id="tc-teams" label="Teams (2 to 6)" values={teams} onChange={setTeams} options={teamOpts} max={6} placeholder="Add a team" />
        <MultiSelect id="tc-seasons" label="Seasons" values={sel} onChange={setSel} options={seasons.map((s) => ({ value: s, label: s }))} placeholder="All seasons" hint="Leave empty for every season" />
        <SearchSelect id="tc-venue" label="Venue" value={venue} onChange={setVenue} clearLabel="All venues" options={(venues.data ?? []).map((v) => ({ value: v.name, label: v.name, sub: `${v.matches}` }))} />
      </div>
      {!ready && <Alert tone="info">Select at least two teams to compare.</Alert>}
      {ready && q.loading && <Spinner />}
      {ready && q.error && <ErrorState error={q.error} onRetry={q.reload} />}
      {ready && q.data && <Results d={q.data} />}
    </div>
  );
}

const ROWS: { label: string; get: (s: TeamSummary) => string; num: (s: TeamSummary) => number | null; best?: "max" | "min" }[] = [
  { label: "Total matches", get: (s) => String(s.matches), num: (s) => s.matches },
  { label: "Total wins", get: (s) => String(s.wins), num: (s) => s.wins, best: "max" },
  { label: "Win percentage", get: (s) => pct(s.win_pct), num: (s) => s.win_pct, best: "max" },
  { label: "Average score", get: (s) => fmt(s.avg_runs), num: (s) => s.avg_runs, best: "max" },
  { label: "Average first-innings score", get: (s) => fmt(s.avg_first_innings), num: (s) => s.avg_first_innings, best: "max" },
  { label: "Highest score", get: (s) => String(s.highest_score?.runs ?? "-"), num: (s) => s.highest_score?.runs ?? null, best: "max" },
  { label: "Lowest score (completed innings)", get: (s) => String(s.lowest_score?.runs ?? "-"), num: (s) => s.lowest_score?.runs ?? null, best: "max" },
  { label: "Win % batting first", get: (s) => pct(s.bat_first_win_pct), num: (s) => s.bat_first_win_pct, best: "max" },
  { label: "Win % chasing", get: (s) => pct(s.chase_win_pct), num: (s) => s.chase_win_pct, best: "max" },
];

function Results({ d }: { d: Comparison }) {
  const names = d.teams.map((t) => t.name);
  const col = (n: string) => chartColor(names.indexOf(n));
  const legend = names.map((n) => ({ label: displayName(n), color: col(n), icon: <TeamBadge name={n} size="xs" /> }));
  const grouped = (keys: { k: keyof TeamSummary; label: string }[]) => keys.map(({ k, label }) => ({ metric: label, ...Object.fromEntries(names.map((n) => [n, (d.summaries[n][k] as number | null) ?? 0])) }));
  const seasonRows = (m: keyof Comparison["season_series"]) => d.season_series[m].map((r) => ({ ...r, label: shortSeason(String(r.season)) }));
  const empty = names.every((n) => d.summaries[n].matches === 0);

  return (
    <>
      {empty && <Alert tone="warn">No matches found for these teams with the current season and venue filters.</Alert>}
      <div className={`grid gap-3 ${names.length > 3 ? "sm:grid-cols-2 lg:grid-cols-4" : names.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {d.teams.map((t) => {
          const s = d.summaries[t.name];
          return (
            <div key={t.name} className="card card-pad" style={{ borderTop: `3px solid ${col(t.name)}` }}>
              <div className="flex items-center gap-3"><TeamBadge name={t.name} size="md" /><div className="min-w-0 font-display text-xl font-semibold text-navy">{t.display_name}</div></div>
              <div className="mt-3 flex items-baseline gap-2"><span className="stat-num">{pct(s.win_pct)}</span><span className="text-xs text-muted">win rate</span></div>
              <div className="mt-1 text-sm text-slate-700">{s.wins}W {s.losses}L from {s.matches} matches</div>
            </div>
          );
        })}
      </div>

      <Card pad={false}>
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">Team comparison</caption>
          <thead><tr className="border-b border-line bg-slate-50 text-left">
            <th scope="col" className="px-4 py-3 font-medium text-muted">Measure</th>
            {d.teams.map((t) => <th key={t.name} scope="col" className="px-4 py-3"><span className="inline-flex items-center gap-2"><TeamBadge name={t.name} size="xs" />{t.short}</span></th>)}
          </tr></thead>
          <tbody>{ROWS.map((r) => {
            const vals = names.map((n) => r.num(d.summaries[n]));
            const valid = vals.filter((v): v is number => v !== null);
            const best = r.best && valid.length > 1 ? Math.max(...valid) : null;
            return (<tr key={r.label} className="border-b border-line last:border-0">
              <th scope="row" className="px-4 py-2.5 text-left font-normal text-slate-700">{r.label}</th>
              {names.map((n, i) => <td key={n} className={`px-4 py-2.5 tabular-nums ${best !== null && vals[i] === best ? "font-semibold text-teal" : ""}`}>{r.get(d.summaries[n])}</td>)}
            </tr>);
          })}</tbody>
        </table></div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Win rates" subtitle="Overall, batting first and chasing (%)" empty={empty}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={grouped([{ k: "win_pct", label: "Overall" }, { k: "bat_first_win_pct", label: "Batting first" }, { k: "chase_win_pct", label: "Chasing" }])} margin={{ left: 0, right: 8 }}>
            <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="metric" tick={AXIS} /><YAxis domain={[0, 100]} tick={AXIS} width={40} unit="%" /><Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
            {names.map((n) => <Bar key={n} dataKey={n} name={displayName(n)} fill={col(n)} radius={[3, 3, 0, 0]} isAnimationActive={false} />)}
          </BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Scoring" subtitle="Average score, average first innings and highest score" empty={empty}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={grouped([{ k: "avg_runs", label: "Average" }, { k: "avg_first_innings", label: "Avg first innings" }]).map((r) => r)} margin={{ left: 0, right: 8 }}>
            <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="metric" tick={AXIS} /><YAxis tick={AXIS} width={40} domain={[0, "auto"]} label={{ value: "Runs", angle: -90, position: "insideLeft", ...AXIS }} /><Tooltip contentStyle={TOOLTIP_STYLE} />
            {names.map((n) => <Bar key={n} dataKey={n} name={displayName(n)} fill={col(n)} radius={[3, 3, 0, 0]} isAnimationActive={false} />)}
          </BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Win percentage by season" empty={empty}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={seasonRows("win_pct")} margin={{ left: 0, right: 12, bottom: 16 }}>
            <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis domain={[0, 100]} tick={AXIS} width={40} unit="%" /><Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
            {names.map((n) => <Line key={n} dataKey={n} name={displayName(n)} stroke={col(n)} strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />)}
          </LineChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Wins by season" empty={empty}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={seasonRows("wins")} margin={{ left: 0, right: 8, bottom: 16 }}>
            <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis tick={AXIS} allowDecimals={false} width={32} /><Tooltip contentStyle={TOOLTIP_STYLE} />
            {names.map((n) => <Bar key={n} dataKey={n} name={displayName(n)} fill={col(n)} isAnimationActive={false} />)}
          </BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Average score by season" empty={empty}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={seasonRows("avg_runs")} margin={{ left: 0, right: 12, bottom: 16 }}>
            <CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis tick={AXIS} width={40} domain={["auto", "auto"]} label={{ value: "Runs", angle: -90, position: "insideLeft", ...AXIS }} /><Tooltip contentStyle={TOOLTIP_STYLE} />
            {names.map((n) => <Line key={n} dataKey={n} name={displayName(n)} stroke={col(n)} strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />)}
          </LineChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Relative strength radar" subtitle="0 = weakest franchise, 100 = strongest franchise, under the same filters" empty={empty}>
          <ResponsiveContainer width="100%" height="100%"><RadarChart data={d.radar} outerRadius="72%">
            <PolarGrid stroke={GRID} /><PolarAngleAxis dataKey="metric" tick={{ ...AXIS, fontSize: 11 }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Tooltip contentStyle={TOOLTIP_STYLE} />
            {names.map((n) => <Radar key={n} dataKey={n} name={displayName(n)} stroke={col(n)} fill={col(n)} fillOpacity={0.12} isAnimationActive={false} />)}
          </RadarChart></ResponsiveContainer>
        </ChartCard>
      </div>
      <Legend items={legend} />

      <Card>
        <h3 className="text-lg font-semibold">Head-to-head</h3>
        <p className="text-xs text-muted">Results between each pair under the current filters. No-result matches are not counted as wins.</p>
        <ul className="mt-3 divide-y divide-line">
          {d.head_to_head.map((h) => {
            const dec = h.a_wins + h.b_wins;
            return (<li key={h.team_a + h.team_b} className="py-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="inline-flex min-w-0 items-center gap-2"><TeamBadge name={h.team_a} size="sm" /><span className="truncate font-medium">{displayName(h.team_a)}</span></span>
                <span className="font-display text-xl font-semibold text-navy">{h.a_wins} - {h.b_wins}</span>
                <span className="inline-flex min-w-0 flex-row-reverse items-center gap-2"><TeamBadge name={h.team_b} size="sm" /><span className="truncate font-medium">{displayName(h.team_b)}</span></span>
              </div>
              <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-200" aria-hidden>
                {dec > 0 && <><div style={{ width: `${(100 * h.a_wins) / dec}%`, background: col(h.team_a) }} /><div style={{ width: `${(100 * h.b_wins) / dec}%`, background: col(h.team_b) }} /></>}
              </div>
              <div className="mt-1 text-xs text-muted">{h.matches} matches{h.no_results ? `, ${h.no_results} without a result` : ""}</div>
            </li>);
          })}
        </ul>
      </Card>

      <Card pad={false}>
        <div className="px-5 pt-5"><h3 className="text-lg font-semibold">Venue-wise record</h3><p className="text-xs text-muted">Wins from matches played, for venues where at least one of these teams played.</p></div>
        <div className="mt-3 max-h-96 overflow-auto"><table className="w-full min-w-[520px] text-sm">
          <thead className="sticky top-0 bg-slate-50"><tr className="border-y border-line text-left"><th scope="col" className="px-4 py-2 font-medium text-muted">Venue</th>{d.teams.map((t) => <th key={t.name} scope="col" className="px-4 py-2">{t.short}</th>)}</tr></thead>
          <tbody>{d.by_venue.slice(0, 40).map((v) => (<tr key={String(v.venue)} className="border-b border-line last:border-0"><th scope="row" className="px-4 py-2 text-left font-normal">{String(v.venue)}</th>
            {names.map((n) => { const c = v[n] as { matches: number; wins: number; win_pct: number | null } | undefined; return <td key={n} className="px-4 py-2 tabular-nums">{c ? `${c.wins}/${c.matches} (${pct(c.win_pct)})` : "-"}</td>; })}</tr>))}</tbody>
        </table></div>
      </Card>
      <p className="text-xs text-muted">{d.notes.join(" ")}</p>
    </>
  );
}
