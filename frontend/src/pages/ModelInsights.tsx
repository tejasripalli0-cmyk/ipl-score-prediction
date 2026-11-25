import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, GRID, TOOLTIP_STYLE } from "../components/chartKit";
import { Alert, Card, ChartCard, ErrorState, PageHeader, Spinner } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import type { ModelInsights as MI } from "../types";

const META = {
  first_innings: { title: "First-innings score", blurb: "Predicts the final score of the team batting first, from the score, wickets and overs so far, plus teams and venue." },
  second_innings: { title: "Second-innings score", blurb: "Predicts the final score of the chasing team, using the target and the required rate on top of the first-innings inputs." },
  win_probability: { title: "Win probability", blurb: "Predicts the probability that the chasing team wins, from the same chase inputs." },
} as const;

export default function ModelInsights() {
  const q = useAsync(() => api.modelInsights(), []);
  return (
    <div className="space-y-8">
      <PageHeader title="Model Insights" subtitle="What the three saved models are, how they were evaluated, and what they pay attention to." />
      {q.loading && <Spinner />}
      {q.error && <ErrorState error={q.error} onRetry={q.reload} />}
      {q.data && <Content d={q.data} />}
    </div>
  );
}

function Metric({ label, value, help }: { label: string; value: string; help: string }) {
  return (<div className="rounded-md border border-line bg-slate-50 p-3"><div className="text-xs text-muted">{label}</div><div className="font-display text-2xl font-semibold text-navy">{value}</div><div className="mt-1 text-xs text-slate-600">{help}</div></div>);
}

function Content({ d }: { d: MI }) {
  const m = d.metrics;
  const keys = (["first_innings", "second_innings", "win_probability"] as const).filter((k) => d.models[k]);
  const fi = d.models.first_innings?.feature_importance?.slice(0, 10);
  const wi = d.models.win_probability?.feature_importance?.slice(0, 10);
  const coef = d.models.second_innings?.coefficients;
  const venueShare = d.models.first_innings?.feature_importance?.find((f) => f.feature === "venue")?.importance;
  return (
    <>
      <Card>
        <h2 className="section-title">The approach</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700">
          The models were built in Google Colab from Cricsheet ball-by-ball IPL data. Every delivery becomes a snapshot of a match situation (score, wickets, balls bowled, and for chases the target and required rate), labelled with what happened next. Three separate models were selected: a Random Forest for the first-innings score, a Linear Regression for the second-innings score, and a Random Forest classifier for the chasing team's win probability.
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700">
          The data was split <b>chronologically</b>: earlier seasons for training and validation, and the <b>2025 season held out as the final test</b>. This mimics real use, predicting a season the model has never seen, and avoids the optimism of randomly mixing seasons.
        </p>
        {d.dataset_overview && <pre className="mt-3 overflow-auto rounded-md bg-slate-50 p-3 text-xs">{JSON.stringify(d.dataset_overview, null, 2)}</pre>}
      </Card>

      <section aria-labelledby="mp"><h2 id="mp" className="section-title mb-3">Model performance on the 2025 test season</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {keys.map((k) => { const mm = m[k]; return (
            <Card key={k}>
              <div className="text-sm text-muted">{META[k].title}</div>
              <h3 className="text-xl font-semibold">{mm.algorithm}</h3>
              <p className="mt-1 text-xs text-slate-600">{META[k].blurb}</p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {k !== "win_probability" ? (<>
                  <Metric label="MAE" value={`${mm.mae} runs`} help="Average size of the miss, in runs." />
                  <Metric label="RMSE" value={`${mm.rmse} runs`} help="Like MAE but penalises big misses more." />
                  <Metric label="R²" value={String(mm.r2)} help="Share of score variation explained (1 = perfect, 0 = no better than the average)." />
                </>) : (<>
                  <Metric label="Accuracy" value={`${(mm.accuracy * 100).toFixed(1)}%`} help="How often the more-likely side, at the 50% line, won." />
                  <Metric label="ROC-AUC" value={String(mm.roc_auc)} help="How well it ranks winners above losers (0.5 = chance, 1 = perfect)." />
                </>)}
              </div>
              <p className="mt-3 text-xs text-muted">{d.models[k].info.encoded_feature_count} encoded inputs from {d.models[k].info.input_features.length} features.</p>
            </Card>); })}
        </div>
        <p className="mt-3 text-xs text-muted">{m.note} A first-innings R² of {m.first_innings?.r2} means the early-innings forecast is genuinely uncertain: much of the final score depends on what has not been bowled yet.</p>
      </section>

      <section aria-labelledby="fe"><h2 id="fe" className="section-title mb-3">Inputs the models use</h2>
        <Card pad={false}><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b border-line bg-slate-50 text-left"><th scope="col" className="px-4 py-2 font-medium text-muted">Model</th><th scope="col" className="px-4 py-2 font-medium text-muted">Input features (exact order the saved model expects)</th></tr></thead>
          <tbody>{keys.map((k) => (<tr key={k} className="border-b border-line last:border-0 align-top"><th scope="row" className="px-4 py-3 text-left font-medium">{META[k].title}</th><td className="px-4 py-3"><code className="text-xs leading-6">{d.models[k].info.input_features.join(", ")}</code></td></tr>))}</tbody></table></div></Card>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Alert tone="info" title="Engineered features">Run rate = runs × 6 ÷ legal balls bowled. Balls remaining = total balls − legal balls bowled. Runs required = target − runs. Required run rate = runs required × 6 ÷ balls remaining. Categorical inputs (teams, venue) are one-hot encoded and numbers are standardised by the saved preprocessing pipeline.</Alert>
          <Alert tone="info" title="No target leakage">Neither the final score nor the match winner is an input to any model; the app checks this every time the models load.</Alert>
        </div>
      </section>

      <section aria-labelledby="fi"><h2 id="fi" className="section-title mb-3">Feature importance</h2>
        <p className="mb-3 max-w-3xl text-sm text-slate-700">Read directly from the loaded Random Forests (impurity-based importance, summed back to the original feature). Importance shows what the forest split on most, not cause and effect. Correlated inputs such as balls bowled and balls remaining share credit.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {fi && <ImportanceChart title="First innings (Random Forest)" rows={fi} />}
          {wi && <ImportanceChart title="Win probability (Random Forest)" rows={wi} />}
        </div>
        {coef && coef.length > 0 && (
          <ChartCard title="Second innings (Linear Regression): numeric coefficients" subtitle="Change in predicted final score per one standard deviation of each input, other inputs fixed. Inputs such as target, runs required and runs scored overlap heavily, so individual coefficients should not be read in isolation." height={300} className="mt-4">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={coef} layout="vertical" margin={{ left: 0, right: 24 }}><CartesianGrid stroke={GRID} horizontal={false} /><XAxis type="number" tick={AXIS} /><YAxis type="category" dataKey="feature" tick={AXIS} width={150} /><ReferenceLine x={0} stroke="#94A3B8" /><Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => v.toFixed(2)} />
              <Bar dataKey="coefficient" name="Coefficient" isAnimationActive={false}>{coef.map((c) => <Cell key={c.feature} fill={c.coefficient >= 0 ? "#0F7C82" : "#B63D32"} />)}</Bar></BarChart></ResponsiveContainer>
          </ChartCard>)}
        {venueShare != null && (
          <Alert tone="warn" title="A note on venues" >
            Venue carries {(venueShare * 100).toFixed(0)}% of the first-innings forest's importance. The same ground appears under several spellings in the training data (for example "Wankhede Stadium" and "Wankhede Stadium, Mumbai"), and the models treat each spelling as a different venue. In testing, the predicted score for the same match situation differed by up to about 28 runs between spellings of one ground, which suggests some of the venue effect reflects which seasons a spelling appeared in. This is why the predictor lets you choose the spelling.
          </Alert>)}
      </section>

      <section aria-labelledby="shap"><h2 id="shap" className="section-title mb-3">Explainability (SHAP)</h2>
        {d.shap ? (
          <div className="grid gap-4 lg:grid-cols-2">{Object.entries(d.shap).map(([k, rows]) => (<ImportanceChart key={k} title={`${k.replace("_", " ")} - mean |SHAP|`} rows={rows.map((r) => ({ feature: r.feature, importance: r.mean_abs_shap }))} raw />))}</div>
        ) : (
          <Alert tone="info" title="SHAP values were not part of the supplied files">The model ZIP contains the trained models only, so no SHAP plots or values are shown rather than inventing them. To add yours, export the mean absolute SHAP values from Colab into <code className="rounded bg-white px-1">backend/data/model_report.json</code> (see <code className="rounded bg-white px-1">model_report.example.json</code>) and they will appear here. On each prediction page, a what-if sensitivity chart explains that single prediction instead.</Alert>)}
      </section>

      <section aria-labelledby="mc"><h2 id="mc" className="section-title mb-3">Models experimented with</h2>
        {d.model_comparison?.length ? (
          <Card pad={false}><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead><tr className="border-b border-line bg-slate-50 text-left">{Object.keys(d.model_comparison[0]).map((h) => <th key={h} scope="col" className="px-4 py-2 font-medium text-muted">{h.replace("_", " ")}</th>)}</tr></thead>
            <tbody>{d.model_comparison.map((r, i) => (<tr key={i} className="border-b border-line last:border-0">{Object.values(r).map((v, j) => <td key={j} className="px-4 py-2">{String(v)}</td>)}</tr>))}</tbody></table></div></Card>
        ) : (
          <Alert tone="info" title="Detailed comparison table not supplied">Per-model comparison numbers were not included with the model files, so none are shown. They can be added the same way as SHAP, through <code className="rounded bg-white px-1">model_report.json</code>.</Alert>)}
      </section>

      <section aria-labelledby="ml"><h2 id="ml" className="section-title mb-3">Traditional machine learning vs deep learning</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card><h3 className="text-lg font-semibold">Traditional ML (selected)</h3><p className="mt-1 text-sm text-slate-700">Random Forests and Linear Regression learn from engineered, tabular inputs. They train quickly, work well on structured data of this size, are easier to inspect, and run cheaply in a web service. All three final models are scikit-learn models.</p></Card>
          <Card><h3 className="text-lg font-semibold">Deep learning (explored, not selected)</h3><p className="mt-1 text-sm text-slate-700">TensorFlow neural networks were experimented with during the project. They were not chosen as the final prediction models because the selected traditional models performed better on the held-out test data. For this kind of tabular problem that is a common outcome. TensorFlow is therefore not used in this application.</p></Card>
        </div>
      </section>
    </>
  );
}

function ImportanceChart({ title, rows, raw }: { title: string; rows: { feature: string; importance: number }[]; raw?: boolean }) {
  const data = rows.map((r) => ({ name: r.feature, v: raw ? r.importance : Math.round(r.importance * 1000) / 10 }));
  return (
    <ChartCard title={title} subtitle={raw ? undefined : "Share of total importance (%)"} height={Math.max(260, data.length * 30 + 40)}>
      <ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ left: 0, right: 30 }}><CartesianGrid stroke={GRID} horizontal={false} /><XAxis type="number" tick={AXIS} /><YAxis type="category" dataKey="name" tick={AXIS} width={140} /><Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => (raw ? v : `${v}%`)} />
        <Bar dataKey="v" name="Importance" fill="#0F2A4A" radius={[0, 3, 3, 0]} isAnimationActive={false} label={{ position: "right", fontSize: 11, fill: "#16222F" }} /></BarChart></ResponsiveContainer>
    </ChartCard>
  );
}
