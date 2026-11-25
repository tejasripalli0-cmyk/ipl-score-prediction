import { Loader2, Percent } from "lucide-react";
import { useState } from "react";
import { ChaseFields, useChaseForm } from "../components/forms";
import { FactorsChart, ModelNote, ProbabilityBar, Warnings } from "../components/PredictionParts";
import { Alert, Card, ErrorState, PageHeader, StatCard } from "../components/ui";
import { useApp } from "../hooks/AppContext";
import { api, toApiError } from "../services/api";
import type { ApiErrorInfo, WinResult } from "../types";

export default function WinProbability() {
  const { setConfig, loading: appLoading } = useApp();
  const cf = useChaseForm();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiErrorInfo | null>(null);
  const [res, setRes] = useState<WinResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { setConfig({ inningsType: "second" }); setRes(await api.predictWin(cf.request())); }
    catch (x) { setErr(toApiError(x)); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Win Probability" subtitle="How likely is the chasing team to win from this position? Uses your trained Random Forest classifier." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Card>
          <form onSubmit={submit} className="space-y-5" aria-label="Win probability inputs">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="section-title">Chase situation</h2><p className="text-xs text-muted">Batting team is the side chasing</p></div>
              <button type="button" className="btn-ghost !px-2 text-xs" onClick={cf.fill}>Try an example</button>
            </div>
            <ChaseFields f={cf} />
            <button className="btn-primary w-full" type="submit" disabled={!cf.valid || busy || appLoading}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Percent className="h-4 w-4" aria-hidden />} Calculate win probability
            </button>
            {!cf.valid && <p className="text-xs text-muted">Fix the highlighted fields to enable the calculation.</p>}
          </form>
        </Card>

        <div className="space-y-4" aria-live="polite">
          {err && <ErrorState error={err} />}
          {!err && !res && <Card><div className="py-10 text-center text-sm text-muted">Enter the chase situation and choose <b>Calculate win probability</b>.</div></Card>}
          {res && (
            <>
              <Card><ProbabilityBar batting={res.batting_team} bowling={res.bowling_team} batPct={res.batting_win_probability} /></Card>
              <Alert tone="info" title="A model estimate, not a guarantee">{res.disclaimer}</Alert>
              <Card><h3 className="text-lg font-semibold">Match situation</h3><p className="mt-1 text-sm text-slate-700">{res.summary}</p></Card>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard label="Target" value={res.target_runs} accent="brick" />
                <StatCard label="Score" value={`${res.current_score}/${res.current_wickets}`} sub={`${res.overs_bowled} overs`} />
                <StatCard label="Runs required" value={res.runs_required} sub={`${res.balls_remaining} balls left`} />
                <StatCard label="Current rate" value={res.current_run_rate.toFixed(2)} />
                <StatCard label="Required rate" value={res.required_run_rate.toFixed(2)} accent={res.required_run_rate > res.current_run_rate ? "amber" : "pitch"} />
                <StatCard label="Wickets in hand" value={10 - res.current_wickets} />
              </div>
              <Warnings items={res.warnings} />
              <FactorsChart factors={res.factors} unit="percentage points" />
              <ModelNote model={res.model} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
