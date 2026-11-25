import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { ChaseFields, FirstInningsFields, useChaseForm, useFirstInningsForm } from "../components/forms";
import { ComparisonBars, FactorsChart, ModelNote, ProjectionChart, Warnings } from "../components/PredictionParts";
import { Alert, Card, PageHeader, Segmented, StatCard, ErrorState } from "../components/ui";
import { useApp } from "../hooks/AppContext";
import { api, toApiError } from "../services/api";
import type { ApiErrorInfo, FirstInningsResult, SecondInningsResult } from "../types";

export default function ScorePredictor() {
  const { config, setConfig, loading: appLoading } = useApp();
  const mode = config.inningsType;
  const ff = useFirstInningsForm();
  const cf = useChaseForm();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiErrorInfo | null>(null);
  const [r1, setR1] = useState<FirstInningsResult | null>(null);
  const [r2, setR2] = useState<SecondInningsResult | null>(null);

  const valid = mode === "first" ? ff.valid : cf.valid;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      if (mode === "first") setR1(await api.predictFirst(ff.request()));
      else setR2(await api.predictSecond(cf.request()));
    } catch (x) { setErr(toApiError(x)); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Score Predictor" subtitle="Estimate the final score of an innings from the match situation, using your trained models."
        actions={<Segmented label="Innings" value={mode} onChange={(v) => { setConfig({ inningsType: v }); setErr(null); }} options={[{ value: "first", label: "First innings" }, { value: "second", label: "Second innings" }]} />} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Card>
          <form onSubmit={submit} className="space-y-5" aria-label={`${mode} innings inputs`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="section-title">{mode === "first" ? "First-innings situation" : "Second-innings situation"}</h2>
                <p className="text-xs text-muted">{mode === "first" ? "Random Forest regression model" : "Linear regression model"}</p>
              </div>
              <button type="button" className="btn-ghost !px-2 text-xs" onClick={mode === "first" ? ff.fill : cf.fill}>Try an example</button>
            </div>
            {mode === "first" ? <FirstInningsFields f={ff} /> : <ChaseFields f={cf} />}
            <button className="btn-primary w-full" type="submit" disabled={!valid || busy || appLoading}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />} Predict final score
            </button>
            {!valid && <p className="text-xs text-muted">Fix the highlighted fields to enable the prediction.</p>}
          </form>
        </Card>

        <div className="space-y-4" aria-live="polite">
          {err && <ErrorState error={err} />}
          {!err && mode === "first" && !r1 && <Placeholder />}
          {!err && mode === "second" && !r2 && <Placeholder />}
          {mode === "first" && r1 && <FirstResult r={r1} />}
          {mode === "second" && r2 && <SecondResult r={r2} />}
        </div>
      </div>
    </div>
  );
}

function Placeholder() {
  return <Card><div className="py-10 text-center text-sm text-muted">Enter the match situation and choose <b>Predict final score</b>. Results, a projection chart and an explanation appear here.</div></Card>;
}

function Headline({ label, value, team, range, rangeText }: { label: string; value: number; team: string; range: { low: number; high: number }; rangeText: string }) {
  return (
    <Card>
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-display text-6xl font-bold leading-none text-teal">{Math.round(value)}</span>
        <span className="text-sm text-slate-700">for {team}</span>
      </div>
      <div className="mt-2 text-sm text-slate-700">Likely range <b>{Math.round(range.low)} - {Math.round(range.high)}</b></div>
      <p className="mt-1 text-xs text-muted">{rangeText}</p>
    </Card>
  );
}

function FirstResult({ r }: { r: FirstInningsResult }) {
  return (
    <>
      <Headline label="Predicted final score" value={r.predicted_final_score} team={String(r.derived_features.batting_team)} range={r.range} rangeText={r.range.description} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Current score" value={`${r.current_score}/${r.current_wickets}`} sub={`${r.overs_bowled} overs`} />
        <StatCard label="Current run rate" value={r.current_run_rate.toFixed(2)} />
        <StatCard label="Wickets lost" value={r.current_wickets} />
        <StatCard label="At current rate" value={Math.round(r.projected_at_current_rate)} sub="Simple projection" accent="teal" />
      </div>
      <Card><h3 className="text-lg font-semibold">Where the innings is heading</h3>
        <div className="mt-2"><ProjectionChart curOvers={Number(r.overs_bowled.split(".")[0]) + Number(r.overs_bowled.split(".")[1]) / 6} runs={r.current_score} predicted={r.predicted_final_score} projected={r.projected_at_current_rate} low={r.range.low} high={r.range.high} /></div></Card>
      <Card><h3 className="text-lg font-semibold">In plain words</h3><p className="mt-1 text-sm text-slate-700">{r.summary}</p>
        {r.adjusted_to_current_score && <p className="mt-2 text-xs text-muted">The raw model output was below the current score, so the current score is shown as the minimum possible final score.</p>}</Card>
      <Warnings items={r.warnings} />
      <FactorsChart factors={r.factors} unit="runs" />
      <ModelNote model={r.model} />
    </>
  );
}

function SecondResult({ r }: { r: SecondInningsResult }) {
  const reaches = r.predicted_margin_vs_target >= 0;
  const [o, b] = r.overs_bowled.split(".").map(Number);
  return (
    <>
      <Headline label="Predicted final score" value={r.predicted_final_score} team={String(r.derived_features.batting_team)} range={r.range} rangeText={r.range.description} />
      <Alert tone={reaches ? "ok" : "warn"} title={reaches ? "Predicted to reach the target" : "Predicted to fall short of the target"}>
        Predicted {Math.round(r.predicted_final_score)} against a target of {r.target_runs}: {Math.abs(Math.round(r.predicted_margin_vs_target))} runs {reaches ? "above" : "below"}.
      </Alert>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Target" value={r.target_runs} sub={`First innings ${r.first_innings_score}`} accent="brick" />
        <StatCard label="Runs required" value={r.runs_required} sub={`${r.balls_remaining} balls left`} />
        <StatCard label="Current run rate" value={r.current_run_rate.toFixed(2)} sub={`${r.current_score}/${r.current_wickets}, ${r.overs_bowled} ov`} />
        <StatCard label="Required run rate" value={r.required_run_rate.toFixed(2)} accent={r.required_run_rate > r.current_run_rate ? "amber" : "pitch"} />
        <StatCard label="Projected at current rate" value={Math.round(r.projected_at_current_rate)} sub="Simple projection" accent="teal" />
        <StatCard label="Model prediction" value={Math.round(r.predicted_final_score)} accent="teal" />
      </div>
      <Card><h3 className="text-lg font-semibold">Predicted score against the target</h3>
        <ComparisonBars items={[
          { name: "Target", value: r.target_runs, color: "#B63D32" }, { name: "Model prediction", value: Math.round(r.predicted_final_score), color: "#0F7C82" },
          { name: "At current run rate", value: Math.round(r.projected_at_current_rate), color: "#64748B" }, { name: "Current score", value: r.current_score, color: "#0F2A4A" }]} /></Card>
      <Card><h3 className="text-lg font-semibold">Where the chase is heading</h3>
        <div className="mt-2"><ProjectionChart total={Math.round((r.balls_remaining + o * 6 + b) / 6)} curOvers={o + b / 6} runs={r.current_score} predicted={r.predicted_final_score} projected={r.projected_at_current_rate} low={r.range.low} high={r.range.high} target={r.target_runs} /></div></Card>
      <Card><h3 className="text-lg font-semibold">In plain words</h3><p className="mt-1 text-sm text-slate-700">{r.summary}</p></Card>
      <Warnings items={r.warnings} />
      <FactorsChart factors={r.factors} unit="runs" />
      <ModelNote model={r.model} />
    </>
  );
}

