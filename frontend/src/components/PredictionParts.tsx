import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, Card } from "./ui";
import { AXIS, GRID, Legend, TOOLTIP_STYLE } from "./chartKit";
import { TeamBadge } from "./TeamBadge";
import { displayName } from "../data/teams";
import type { Factor, ModelInfo } from "../types";

export function Warnings({ items }: { items: string[] }) {
  if (!items.length) return null;
  return <div className="space-y-2">{items.map((w) => <Alert key={w} tone="warn">{w}</Alert>)}</div>;
}

export function ModelNote({ model }: { model: ModelInfo }) {
  const m = model.metrics;
  const bits = [m.mae != null && `MAE ${m.mae}`, m.rmse != null && `RMSE ${m.rmse}`, m.r2 != null && `R² ${m.r2}`, m.accuracy != null && `accuracy ${(m.accuracy * 100).toFixed(1)}%`, m.roc_auc != null && `ROC-AUC ${m.roc_auc}`].filter(Boolean);
  return (
    <p className="text-xs text-muted">
      Model: {model.algorithm}. Historical {model.test_season} test results: {bits.join(", ")}. These describe average accuracy across many matches, not the accuracy of this single estimate.
    </p>
  );
}

export function ProjectionChart({ total = 20, curOvers, runs, predicted, projected, low, high, target }: {
  total?: number; curOvers: number; runs: number; predicted: number; projected: number; low: number; high: number; target?: number;
}) {
  const data = [
    { x: 0, actual: 0 },
    { x: curOvers, actual: runs, predicted: runs, projected: runs, band: [runs, runs] as [number, number] },
    { x: total, predicted, projected, band: [low, high] as [number, number] },
  ];
  const top = Math.max(predicted, projected, high, target ?? 0) * 1.1;
  return (
    <div>
      <div className="h-[280px]" role="img" aria-label={`Projection from ${runs} runs at ${curOvers.toFixed(1)} overs to a predicted ${Math.round(predicted)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 18, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis type="number" dataKey="x" domain={[0, total]} ticks={[0, 5, 10, 15, 20].filter((t) => t <= total)} tick={AXIS} label={{ value: "Overs", position: "insideBottom", offset: -10, ...AXIS }} />
            <YAxis domain={[0, Math.ceil(top / 10) * 10]} tick={AXIS} width={42} label={{ value: "Runs", angle: -90, position: "insideLeft", ...AXIS }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown, n: string) => [Array.isArray(v) ? `${Math.round(v[0] as number)} - ${Math.round(v[1] as number)}` : Math.round(v as number), n]} labelFormatter={(l) => `Over ${Number(l).toFixed(1)}`} />
            <Area dataKey="band" name="Likely range" stroke="none" fill="#12908E" fillOpacity={0.14} connectNulls isAnimationActive={false} />
            {target != null && <ReferenceLine y={target} stroke="#B63D32" strokeDasharray="5 4" label={{ value: `Target ${target}`, position: "insideTopLeft", fill: "#B63D32", fontSize: 12 }} />}
            <Line dataKey="actual" name="Current position" stroke="#0F2A4A" strokeWidth={3} dot={{ r: 4 }} connectNulls isAnimationActive={false} />
            <Line dataKey="projected" name="At current run rate" stroke="#64748B" strokeDasharray="6 4" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            <Line dataKey="predicted" name="Model prediction" stroke="#0F7C82" strokeWidth={2.5} dot={{ r: 4 }} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend items={[{ label: "Current position", color: "#0F2A4A" }, { label: "Model prediction", color: "#0F7C82" }, { label: "At current run rate", color: "#64748B" }, { label: "Likely range", color: "#BFE3E1" }]} />
      <p className="mt-2 text-xs text-muted">Illustrative: straight lines join today's position to the projected end of the innings. They show where the innings is heading, not a forecast for each over.</p>
    </div>
  );
}

export function ComparisonBars({ items }: { items: { name: string; value: number; color: string }[] }) {
  return (
    <div className="h-[220px]" role="img" aria-label="Comparison of predicted score and target">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={items} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={AXIS} domain={[0, (m: number) => Math.ceil((m * 1.1) / 10) * 10]} label={{ value: "Runs", position: "insideBottomRight", offset: -2, ...AXIS }} />
          <YAxis type="category" dataKey="name" tick={AXIS} width={150} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" name="Runs" radius={[0, 3, 3, 0]} isAnimationActive={false} label={{ position: "right", fontSize: 12, fill: "#16222F" }}>
            {items.map((i) => <Cell key={i.name} fill={i.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FactorsChart({ factors, unit }: { factors: Factor[]; unit: string }) {
  if (!factors.length) return null;
  const data = factors.map((f) => ({ name: f.factor, impact: f.impact }));
  return (
    <Card>
      <h3 className="text-lg font-semibold">What is driving this estimate</h3>
      <p className="mt-0.5 text-xs text-muted">
        Each bar shows how much the output changes compared with an average value for that factor ({unit}). This is a what-if sensitivity check on the saved model, not a SHAP analysis, and factors overlap, so treat it as a guide.
      </p>
      <div className="mt-3" style={{ height: Math.max(180, data.length * 38) }} role="img" aria-label="Factor impacts">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={AXIS} />
            <YAxis type="category" dataKey="name" tick={AXIS} width={160} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v > 0 ? "+" : ""}${v}`, unit]} />
            <ReferenceLine x={0} stroke="#94A3B8" />
            <Bar dataKey="impact" name={unit} radius={2} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.name} fill={d.impact >= 0 ? "#0F7C82" : "#B63D32"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-1 text-sm text-slate-700">{factors.slice(0, 3).map((f) => <li key={f.factor}>{f.description}</li>)}</ul>
    </Card>
  );
}

export function ProbabilityBar({ batting, bowling, batPct }: { batting: string; bowling: string; batPct: number }) {
  const bowlPct = Math.round((100 - batPct) * 10) / 10;
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3"><TeamBadge name={batting} size="lg" />
          <div className="min-w-0"><div className="truncate text-sm text-muted">Chasing: {displayName(batting)}</div><div className="font-display text-5xl font-bold leading-none text-teal">{batPct.toFixed(1)}%</div></div></div>
        <div className="flex min-w-0 flex-row-reverse items-center gap-3 text-right"><TeamBadge name={bowling} size="lg" />
          <div className="min-w-0"><div className="truncate text-sm text-muted">Defending: {displayName(bowling)}</div><div className="font-display text-5xl font-bold leading-none text-navy">{bowlPct.toFixed(1)}%</div></div></div>
      </div>
      <div className="mt-4 flex h-5 overflow-hidden rounded-full bg-slate-200" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={batPct} aria-label={`${displayName(batting)} win probability`}>
        <div className="h-full bg-teal transition-[width] duration-500" style={{ width: `${batPct}%` }} />
        <div className="h-full bg-navy transition-[width] duration-500" style={{ width: `${bowlPct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted"><span>Total {(batPct + bowlPct).toFixed(1)}%</span><span>50% line</span></div>
    </div>
  );
}
