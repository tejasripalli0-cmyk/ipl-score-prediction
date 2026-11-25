import { X } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, GRID, Legend, TOOLTIP_STYLE, shortSeason } from "../components/chartKit";
import { SearchSelect } from "../components/SearchSelect";
import { Alert, Card, ChartCard, DatasetGate, EmptyState, PageHeader, Spinner, StatCard, fmt } from "../components/ui";
import { chartColor } from "../data/teams";
import { useAsync } from "../hooks/useAsync";
import { useDebounced } from "../hooks/useDebounced";
import { api, toApiError } from "../services/api";
import type { PlayerAnalytics as PA } from "../types";

export default function PlayerAnalytics() {
  return (<div><PageHeader title="Player Analytics" subtitle="Search for players and compare their batting and bowling across seasons." /><DatasetGate><Body /></DatasetGate></div>);
}

function Body() {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const search = useAsync(() => api.players(dq), [dq]);
  const [chosen, setChosen] = useState<string[]>([]);
  const players = useAsync(async () => {
    const res = await Promise.allSettled(chosen.map((n) => api.player(n)));
    const ok: PA[] = [];
    const errs: string[] = [];
    res.forEach((r, i) => { if (r.status === "fulfilled") ok.push(r.value); else errs.push(`${chosen[i]}: ${toApiError(r.reason).message}`); });
    return { ok, errs };
  }, [chosen.join("|")], chosen.length > 0);

  const add = (name: string) => { if (name && !chosen.includes(name) && chosen.length < 4) setChosen([...chosen, name]); };
  const opts = (search.data ?? []).map((p) => ({ value: p.name, label: p.name, sub: [p.balls_faced ? `${p.balls_faced} balls faced` : "", p.balls_bowled ? `${p.balls_bowled} bowled` : ""].filter(Boolean).join(", ") }));

  return (
    <div className="space-y-6">
      <div className="card card-pad">
        <div className="grid gap-4 sm:grid-cols-2">
          <SearchSelect id="pl-search" label="Add a player" value="" onChange={add} options={opts} placeholder="Search by name, e.g. Kohli" onSearch={setQ} loading={search.loading} emptyText="No players match that search" hint="Names follow the dataset's format (initials and surname). Add up to 4 to compare." />
          <div>
            <span className="label">Selected</span>
            <div className="flex min-h-[40px] flex-wrap items-center gap-2">
              {chosen.length === 0 && <span className="text-sm text-muted">No players selected yet</span>}
              {chosen.map((n, i) => (<span key={n} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-slate-50 py-1 pl-2.5 pr-1.5 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ background: chartColor(i) }} aria-hidden />{n}
                <button aria-label={`Remove ${n}`} className="rounded-full p-0.5 hover:bg-slate-200" onClick={() => setChosen(chosen.filter((x) => x !== n))}><X className="h-3.5 w-3.5" /></button></span>))}
            </div>
          </div>
        </div>
      </div>
      {chosen.length === 0 && <EmptyState title="Pick a player to begin">Search above to see career totals, season-by-season trends and comparisons.</EmptyState>}
      {players.loading && <Spinner />}
      {players.data?.errs.map((e) => <Alert key={e} tone="error">{e}</Alert>)}
      {players.data && players.data.ok.length > 0 && <Content list={players.data.ok} />}
    </div>
  );
}

function Content({ list }: { list: PA[] }) {
  const first = list[0];
  const seasons = Array.from(new Set(list.flatMap((p) => p.by_season.map((s) => s.season)))).sort();
  const series = (key: "runs" | "strike_rate" | "wickets" | "economy") => seasons.map((s) => ({ label: shortSeason(s), ...Object.fromEntries(list.map((p) => [p.name, p.by_season.find((x) => x.season === s)?.[key] ?? null])) }));
  const has = (key: "runs" | "strike_rate" | "wickets" | "economy") => list.some((p) => p.by_season.some((s) => s[key] != null));
  const notes = Array.from(new Set(list.flatMap((p) => p.notes)));
  const legend = list.map((p, i) => ({ label: p.name, color: chartColor(i) }));
  const b = first.batting, w = first.bowling;
  return (
    <>
      <Card><h2 className="text-2xl font-semibold">{first.name}</h2><p className="text-sm text-muted">{first.teams.join(", ") || "Teams not available"}</p></Card>
      {b && (<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total runs" value={b.runs.toLocaleString()} sub={`${b.innings} innings`} /><StatCard label="Strike rate" value={fmt(b.strike_rate)} sub={`${b.balls_faced.toLocaleString()} balls faced`} accent="teal" />
        <StatCard label="Highest score" value={b.highest_score} sub={`${b.fifties} fifties, ${b.hundreds} hundreds`} /><StatCard label="Batting average" value={b.average != null ? fmt(b.average) : "Not available"} sub={b.dismissals != null ? `${b.dismissals} dismissals` : "Needs dismissal data"} />
        <StatCard label="Fours" value={b.fours} /><StatCard label="Sixes" value={b.sixes} /></div>)}
      {w && (<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Overs bowled" value={w.overs} sub={`${w.balls_bowled} balls`} /><StatCard label="Economy" value={fmt(w.economy, 2)} sub={`${w.runs_conceded} runs conceded`} accent="teal" />
        <StatCard label="Wickets" value={w.wickets ?? "Not available"} sub={w.wickets == null ? "Needs dismissal-type data" : undefined} /><StatCard label="Best bowling" value={w.best_figures ?? "-"} /></div>)}
      {!b && !w && <Alert tone="warn">No batting or bowling data is available for this player.</Alert>}

      {list.length > 1 && (<Card pad={false}><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><caption className="sr-only">Player comparison</caption>
        <thead><tr className="border-b border-line bg-slate-50 text-left"><th scope="col" className="px-4 py-3 font-medium text-muted">Player</th>{["Runs", "Innings", "Strike rate", "Highest", "Sixes", "Overs", "Economy", "Wickets"].map((h) => <th key={h} scope="col" className="px-3 py-3 font-medium text-muted">{h}</th>)}</tr></thead>
        <tbody>{list.map((p, i) => (<tr key={p.name} className="border-b border-line last:border-0"><th scope="row" className="px-4 py-2.5 text-left font-medium"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: chartColor(i) }} />{p.name}</th>
          <td className="px-3 py-2.5">{p.batting?.runs ?? "-"}</td><td className="px-3 py-2.5">{p.batting?.innings ?? "-"}</td><td className="px-3 py-2.5">{fmt(p.batting?.strike_rate)}</td><td className="px-3 py-2.5">{p.batting?.highest_score ?? "-"}</td><td className="px-3 py-2.5">{p.batting?.sixes ?? "-"}</td>
          <td className="px-3 py-2.5">{p.bowling?.overs ?? "-"}</td><td className="px-3 py-2.5">{fmt(p.bowling?.economy, 2)}</td><td className="px-3 py-2.5">{p.bowling?.wickets ?? "-"}</td></tr>))}</tbody></table></div></Card>)}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Runs by season" empty={!has("runs")}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={series("runs")} margin={{ left: 0, right: 8, bottom: 16 }}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis tick={AXIS} width={40} label={{ value: "Runs", angle: -90, position: "insideLeft", ...AXIS }} /><Tooltip contentStyle={TOOLTIP_STYLE} />
            {list.map((p, i) => <Bar key={p.name} dataKey={p.name} fill={chartColor(i)} isAnimationActive={false} />)}</BarChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Strike rate by season" empty={!has("strike_rate")}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={series("strike_rate")} margin={{ left: 0, right: 12, bottom: 16 }}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis tick={AXIS} width={40} domain={["auto", "auto"]} label={{ value: "Runs per 100 balls", angle: -90, position: "insideLeft", ...AXIS }} /><Tooltip contentStyle={TOOLTIP_STYLE} />
            {list.map((p, i) => <Line key={p.name} dataKey={p.name} stroke={chartColor(i)} strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />)}</LineChart></ResponsiveContainer></ChartCard>
        {has("wickets") && <ChartCard title="Wickets by season"><ResponsiveContainer width="100%" height="100%"><BarChart data={series("wickets")} margin={{ left: 0, right: 8, bottom: 16 }}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis tick={AXIS} allowDecimals={false} width={32} /><Tooltip contentStyle={TOOLTIP_STYLE} />
          {list.map((p, i) => <Bar key={p.name} dataKey={p.name} fill={chartColor(i)} isAnimationActive={false} />)}</BarChart></ResponsiveContainer></ChartCard>}
        {has("economy") && <ChartCard title="Bowling economy by season"><ResponsiveContainer width="100%" height="100%"><LineChart data={series("economy")} margin={{ left: 0, right: 12, bottom: 16 }}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={AXIS} label={{ value: "Season", position: "insideBottom", offset: -10, ...AXIS }} /><YAxis tick={AXIS} width={40} domain={["auto", "auto"]} label={{ value: "Runs per over", angle: -90, position: "insideLeft", ...AXIS }} /><Tooltip contentStyle={TOOLTIP_STYLE} />
          {list.map((p, i) => <Line key={p.name} dataKey={p.name} stroke={chartColor(i)} strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />)}</LineChart></ResponsiveContainer></ChartCard>}
      </div>
      {list.length > 1 && <Legend items={legend} />}
      {notes.length > 0 && <Alert tone="info" title="How these figures are calculated"><ul className="list-disc space-y-0.5 pl-4">{notes.map((n) => <li key={n}>{n}</li>)}</ul></Alert>}
    </>
  );
}
