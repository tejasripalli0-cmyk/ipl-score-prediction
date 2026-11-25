import { useMemo, useState } from "react";
import { NumberField } from "./ui";
import { PredictionVenueSelect, TeamSelect, VenueSpellingSelect } from "./MatchSelectors";
import { useApp } from "../hooks/AppContext";
import type { FirstInningsRequest, SecondInningsRequest } from "../types";

const toNum = (v: number | "") => (v === "" ? NaN : v);
export const oversText = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

/** Team + venue selectors bound to the shared match configuration. */
export function MatchFields() {
  const { config, setConfig } = useApp();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TeamSelect prediction id="bat" label="Batting team" value={config.battingTeam} exclude={config.bowlingTeam} onChange={(v) => setConfig({ battingTeam: v })} />
      <TeamSelect prediction id="bowl" label="Bowling team" value={config.bowlingTeam} exclude={config.battingTeam} onChange={(v) => setConfig({ bowlingTeam: v })} />
      <div className="sm:col-span-2"><PredictionVenueSelect id="venue" value={config.venue} onChange={(v) => setConfig({ venue: v })} /></div>
    </div>
  );
}

/** Overs completed + balls in the current over => legal balls bowled (what the model uses). */
export function useFirstInningsForm() {
  const { config } = useApp();
  const [overs, setOvers] = useState<number | "">(10);
  const [balls, setBalls] = useState<number | "">(0);
  const [runs, setRuns] = useState<number | "">(80);
  const [wkts, setWkts] = useState<number | "">(2);
  const [variant, setVariant] = useState("");

  const d = useMemo(() => {
    const legal = toNum(overs) * 6 + toNum(balls);
    const r = toNum(runs), w = toNum(wkts);
    return { legal, over: legal > 0 ? Math.floor((legal - 1) / 6) : 0, crr: legal > 0 ? (r * 6) / legal : NaN, remaining: 120 - legal, r, w };
  }, [overs, balls, runs, wkts]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (Number.isNaN(d.legal)) e.overs = "Enter the overs bowled.";
    else if (toNum(overs) < 0 || toNum(overs) > 19) e.overs = "Overs completed must be 0 to 19.";
    else if (toNum(balls) < 0 || toNum(balls) > 5) e.balls = "Balls in the over must be 0 to 5.";
    else if (d.legal < 1) e.overs = "At least one legal ball must have been bowled.";
    else if (d.legal >= 120) e.overs = "The innings is already complete.";
    if (Number.isNaN(d.r) || d.r < 0) e.runs = "Enter the runs scored so far.";
    else if (d.legal >= 1 && d.r > 8 * d.legal) e.runs = `${d.r} runs from ${d.legal} balls is not realistic.`;
    if (Number.isNaN(d.w) || d.w < 0 || d.w > 9) e.wkts = d.w >= 10 ? "All out - the innings is over." : "Wickets must be 0 to 9.";
    return e;
  }, [d, overs, balls]);

  const request = (): FirstInningsRequest => ({
    batting_team: config.battingTeam, bowling_team: config.bowlingTeam, venue: config.venue, venue_variant: variant || null,
    legal_balls_bowled: d.legal, cumulative_runs: d.r, cumulative_wickets: d.w,
  });
  const fill = () => { setOvers(12); setBalls(3); setRuns(104); setWkts(3); };
  return { overs, setOvers, balls, setBalls, runs, setRuns, wkts, setWkts, variant, setVariant, d, errors, valid: Object.keys(errors).length === 0, request, fill };
}

export function FirstInningsFields({ f }: { f: ReturnType<typeof useFirstInningsForm> }) {
  const { config } = useApp();
  return (
    <div className="space-y-5">
      <MatchFields />
      <VenueSpellingSelect venue={config.venue} value={f.variant} onChange={f.setVariant} />
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField id="f-overs" label="Overs completed" value={f.overs} onChange={f.setOvers} min={0} max={19} error={f.errors.overs} hint="Full overs finished so far" />
        <NumberField id="f-balls" label="Balls in current over" value={f.balls} onChange={f.setBalls} min={0} max={5} error={f.errors.balls} hint="Legal balls only (0-5)" />
        <NumberField id="f-runs" label="Current cumulative runs" value={f.runs} onChange={f.setRuns} min={0} error={f.errors.runs} />
        <NumberField id="f-wkts" label="Current wickets" value={f.wkts} onChange={f.setWkts} min={0} max={9} error={f.errors.wkts} />
      </div>
      <Derived items={[
        ["Legal balls bowled", Number.isNaN(f.d.legal) ? "-" : f.d.legal],
        ["Current over (0-indexed)", Number.isNaN(f.d.legal) ? "-" : f.d.over],
        ["Current run rate", Number.isNaN(f.d.crr) ? "-" : f.d.crr.toFixed(2)],
        ["Balls remaining", Number.isNaN(f.d.legal) ? "-" : f.d.remaining],
      ]} />
    </div>
  );
}

export function Derived({ items }: { items: [string, string | number][] }) {
  return (
    <div className="rounded-md border border-line bg-slate-50 p-3">
      <div className="mb-2 text-xs font-medium text-muted">Calculated automatically from your inputs and sent to the model</div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {items.map(([k, v]) => (<div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-display text-lg font-semibold text-navy">{v}</dd></div>))}
      </dl>
    </div>
  );
}

export function useChaseForm() {
  const { config } = useApp();
  const [first, setFirst] = useState<number | "">(170);
  const [customTarget, setCustomTarget] = useState(false);
  const [targetIn, setTargetIn] = useState<number | "">(171);
  const [tOvers, setTOvers] = useState<number | "">(20);
  const [overs, setOvers] = useState<number | "">(10);
  const [balls, setBalls] = useState<number | "">(0);
  const [runs, setRuns] = useState<number | "">(79);
  const [wkts, setWkts] = useState<number | "">(2);
  const [variant, setVariant] = useState("");

  const d = useMemo(() => {
    const f = toNum(first), to = toNum(tOvers);
    const target = customTarget ? toNum(targetIn) : f + 1;
    const total = Math.round(to * 6);
    const legal = toNum(overs) * 6 + toNum(balls);
    const r = toNum(runs), w = toNum(wkts);
    const remaining = total - legal;
    const required = target - r;
    return { f, to, target, total, legal, r, w, remaining, required, over: legal > 0 ? Math.floor((legal - 1) / 6) : 0,
      crr: legal > 0 ? (r * 6) / legal : NaN, rrr: remaining > 0 ? (required * 6) / remaining : NaN };
  }, [first, customTarget, targetIn, tOvers, overs, balls, runs, wkts]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (Number.isNaN(d.f) || d.f < 1) e.first = "Enter the first-innings score.";
    if (Number.isNaN(d.to) || d.to < 1 || d.to > 20) e.tOvers = "Target overs must be between 1 and 20.";
    if (customTarget && (Number.isNaN(d.target) || d.target < 1)) e.target = "Enter a target of at least 1.";
    if (Number.isNaN(d.legal)) e.overs = "Enter the overs bowled.";
    else if (toNum(balls) < 0 || toNum(balls) > 5) e.balls = "Balls in the over must be 0 to 5.";
    else if (d.legal < 1) e.overs = "At least one legal ball must have been bowled.";
    else if (!Number.isNaN(d.total) && d.legal >= d.total) e.overs = "The chasing team's overs are finished.";
    if (Number.isNaN(d.r) || d.r < 0) e.runs = "Enter the runs scored so far.";
    else if (d.legal >= 1 && d.r > 8 * d.legal) e.runs = `${d.r} runs from ${d.legal} balls is not realistic.`;
    else if (!Number.isNaN(d.required) && d.required <= 0) e.runs = `The target of ${d.target} has already been reached.`;
    if (Number.isNaN(d.w) || d.w < 0 || d.w > 9) e.wkts = d.w >= 10 ? "All out - the chase is over." : "Wickets must be 0 to 9.";
    return e;
  }, [d, customTarget, balls]);

  const request = (): SecondInningsRequest => ({
    batting_team: config.battingTeam, bowling_team: config.bowlingTeam, venue: config.venue, venue_variant: variant || null,
    legal_balls_bowled: d.legal, cumulative_runs: d.r, cumulative_wickets: d.w, first_innings_score: d.f, target_runs: d.target, target_overs: d.to,
  });
  const fill = () => { setFirst(176); setCustomTarget(false); setTOvers(20); setOvers(14); setBalls(0); setRuns(121); setWkts(4); };
  return { first, setFirst, customTarget, setCustomTarget, targetIn, setTargetIn, tOvers, setTOvers, overs, setOvers, balls, setBalls, runs, setRuns, wkts, setWkts,
    variant, setVariant, d, errors, valid: Object.keys(errors).length === 0, request, fill };
}

export function ChaseFields({ f }: { f: ReturnType<typeof useChaseForm> }) {
  const { config } = useApp();
  const nan = (x: number, digits = 0) => (Number.isNaN(x) || !Number.isFinite(x) ? "-" : digits ? x.toFixed(digits) : x);
  return (
    <div className="space-y-5">
      <MatchFields />
      <VenueSpellingSelect venue={config.venue} value={f.variant} onChange={f.setVariant} />
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField id="c-first" label="First-innings score" value={f.first} onChange={f.setFirst} min={1} error={f.errors.first} />
        <NumberField id="c-tovers" label="Target overs" value={f.tOvers} onChange={f.setTOvers} min={1} max={20} step={1} error={f.errors.tOvers} hint="20 unless the chase was shortened (e.g. rain)" />
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.customTarget} onChange={(e) => f.setCustomTarget(e.target.checked)} className="h-4 w-4 accent-teal" /> Use a revised target (e.g. DLS) instead of first-innings score + 1</label>
        </div>
        <NumberField id="c-target" label="Target runs" value={f.customTarget ? f.targetIn : Number.isNaN(f.d.target) ? "" : f.d.target} onChange={f.setTargetIn} readOnly={!f.customTarget} min={1} error={f.errors.target} />
        <NumberField id="c-runs" label="Current cumulative runs" value={f.runs} onChange={f.setRuns} min={0} error={f.errors.runs} />
        <NumberField id="c-overs" label="Overs completed" value={f.overs} onChange={f.setOvers} min={0} max={19} error={f.errors.overs} />
        <NumberField id="c-balls" label="Balls in current over" value={f.balls} onChange={f.setBalls} min={0} max={5} error={f.errors.balls} hint="Legal balls only (0-5)" />
        <NumberField id="c-wkts" label="Current wickets" value={f.wkts} onChange={f.setWkts} min={0} max={9} error={f.errors.wkts} />
      </div>
      <Derived items={[
        ["Legal balls bowled", nan(f.d.legal)], ["Current over (0-indexed)", nan(f.d.over)], ["Balls remaining", nan(f.d.remaining)],
        ["Current run rate", nan(f.d.crr, 2)], ["Runs required", nan(f.d.required)], ["Required run rate", nan(f.d.rrr, 2)],
      ]} />
    </div>
  );
}
