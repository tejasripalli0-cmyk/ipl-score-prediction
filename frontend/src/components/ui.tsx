import { AlertTriangle, DatabaseZap, Info, Loader2, RefreshCw, WifiOff, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useApp } from "../hooks/AppContext";
import type { ApiErrorInfo } from "../types";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted sm:text-base">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ children, className = "", pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <section className={`card ${pad ? "card-pad" : ""} ${className}`}>{children}</section>;
}

export function StatCard({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: "teal" | "navy" | "pitch" | "amber" | "brick" }) {
  const colour = { teal: "text-teal", navy: "text-navy", pitch: "text-pitch", amber: "text-amber", brick: "text-brick" }[accent ?? "navy"];
  return (
    <div className="card card-pad">
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-1.5 font-display text-3xl font-semibold leading-none ${colour}`}>{value}</div>
      {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}...
    </div>
  );
}

const TONES = {
  info: { box: "border-navy-100 bg-navy-50 text-navy", icon: Info },
  warn: { box: "border-amber/30 bg-amber-50 text-amber", icon: AlertTriangle },
  error: { box: "border-brick/30 bg-brick-50 text-brick", icon: XCircle },
  ok: { box: "border-pitch/30 bg-pitch-50 text-pitch", icon: Info },
} as const;

export function Alert({ tone = "info", title, children, className = "" }: { tone?: keyof typeof TONES; title?: string; children?: ReactNode; className?: string }) {
  const T = TONES[tone];
  return (
    <div role={tone === "error" ? "alert" : "note"} className={`flex gap-3 rounded-md border px-3.5 py-3 text-sm ${T.box} ${className}`}>
      <T.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 text-ink">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={title ? "mt-0.5 text-slate-700" : ""}>{children}</div>}
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiErrorInfo; onRetry?: () => void }) {
  if (error.code === "dataset_unavailable") return <DatasetRequired message={error.message} />;
  return (
    <div className="card card-pad flex flex-col items-start gap-3">
      <div className="flex items-start gap-3">
        {error.network ? <WifiOff className="mt-0.5 h-5 w-5 text-brick" aria-hidden /> : <XCircle className="mt-0.5 h-5 w-5 text-brick" aria-hidden />}
        <div>
          <div className="font-semibold text-ink">{error.network ? "The API is not reachable" : "That didn't work"}</div>
          <p className="mt-0.5 text-sm text-slate-700">{error.message}</p>
        </div>
      </div>
      {onRetry && <button className="btn-secondary" onClick={onRetry}><RefreshCw className="h-4 w-4" aria-hidden /> Try again</button>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/60 px-4 py-10 text-center">
      <div className="font-medium text-ink">{title}</div>
      {children && <p className="mt-1 max-w-md text-sm text-muted">{children}</p>}
    </div>
  );
}

export function DatasetRequired({ message }: { message?: string }) {
  return (
    <div className="card card-pad">
      <div className="flex items-start gap-3">
        <DatabaseZap className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Historical dataset needed</h2>
          <p className="mt-1 text-sm text-slate-700">
            {message ?? "This page is built from the IPL ball-by-ball dataset, which has not been loaded."} Predictions still work without it.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>Copy <code className="rounded bg-slate-100 px-1">ball_by_ball_dataset.csv</code> into <code className="rounded bg-slate-100 px-1">backend/data/</code></li>
            <li>Restart the backend (<code className="rounded bg-slate-100 px-1">start-backend.ps1</code>)</li>
            <li>Reload this page</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

/** Wraps pages that need the CSV. Shows a clear explanation instead of empty charts. */
export function DatasetGate({ children }: { children: ReactNode }) {
  const { status, loading, error, retry } = useApp();
  if (loading) return <Spinner label="Connecting to the API" />;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!status?.dataset_loaded) return <DatasetRequired message={status?.error ?? undefined} />;
  return <>{children}</>;
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`rounded px-3.5 py-1.5 text-sm font-medium transition-colors ${value === o.value ? "bg-navy text-white" : "text-slate-700 hover:bg-slate-100"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function NumberField({ id, label, value, onChange, min, max, step = 1, hint, error, readOnly, suffix }: {
  id: string; label: string; value: number | ""; onChange?: (v: number | "") => void; min?: number; max?: number; step?: number;
  hint?: string; error?: string | null; readOnly?: boolean; suffix?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <input id={id} type="number" inputMode="decimal" className={`input ${error ? "input-error" : ""} ${readOnly ? "bg-slate-50 text-slate-600" : ""}`}
          value={value} min={min} max={max} step={step} readOnly={readOnly} aria-invalid={!!error} aria-describedby={`${id}-d`}
          onChange={(e) => onChange?.(e.target.value === "" ? "" : Number(e.target.value))} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span>}
      </div>
      <div id={`${id}-d`} className={error ? "mt-1 text-xs text-brick" : "hint"}>{error || hint}</div>
    </div>
  );
}

export function ChartCard({ title, subtitle, children, empty, height = 300, className = "" }: { title: string; subtitle?: string; children: ReactNode; empty?: boolean; height?: number; className?: string }) {
  return (
    <Card className={className}>
      <h3 className="text-lg font-semibold">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-3" style={{ height: empty ? undefined : height }}>
        {empty ? <EmptyState title="Nothing to chart yet">There is no data for this selection. Try a different season or filter.</EmptyState> : children}
      </div>
    </Card>
  );
}

export const fmt = (v: number | null | undefined, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? "-" : v.toFixed(d));
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "-" : `${v.toFixed(1)}%`);
