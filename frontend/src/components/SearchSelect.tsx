import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface Opt { value: string; label: string; sub?: string; icon?: ReactNode }

function useOutside(ref: React.RefObject<HTMLElement>, close: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, close]);
}

interface BaseProps {
  options: Opt[]; label: string; id: string; placeholder?: string; disabled?: boolean; hint?: string;
  /** Server-side search: options are used as given and typing calls this. */
  onSearch?: (q: string) => void; emptyText?: string; loading?: boolean;
}

export function SearchSelect({ options, value, onChange, label, id, placeholder = "Select...", disabled, hint, clearLabel, onSearch, emptyText = "No matches", loading }:
  BaseProps & { value: string; onChange: (v: string) => void; clearLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useOutside(ref, () => setOpen(false));

  const list = useMemo(() => {
    const base = clearLabel ? [{ value: "", label: clearLabel }, ...options] : options;
    if (onSearch || !q.trim()) return base;
    const s = q.toLowerCase();
    return base.filter((o) => o.value === "" ? false : o.label.toLowerCase().includes(s) || (o.sub ?? "").toLowerCase().includes(s));
  }, [options, q, clearLabel, onSearch]);
  const selected = options.find((o) => o.value === value);

  useEffect(() => { setHi(0); }, [q, open]);
  useEffect(() => { if (open) inputRef.current?.focus(); else setQ(""); }, [open]);

  const choose = (v: string) => { onChange(v); setOpen(false); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (list[hi]) choose(list[hi].value); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <label htmlFor={id} className="label">{label}</label>
      <button id={id} type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between gap-2 text-left">
        <span className="flex min-w-0 items-center gap-2">
          {selected?.icon}
          <span className={`truncate ${selected ? "" : "text-slate-400"}`}>{selected?.label ?? (value === "" && clearLabel ? clearLabel : placeholder)}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>
      {hint && <div className="hint">{hint}</div>}
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[240px] rounded-md border border-line bg-white shadow-pop">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" aria-hidden />
            <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); onSearch?.(e.target.value); }} onKeyDown={onKey}
              placeholder="Search..." aria-label={`Search ${label}`} className="w-full bg-transparent text-sm outline-none" />
          </div>
          <ul role="listbox" aria-label={label} className="max-h-64 overflow-auto py-1">
            {loading && <li className="px-3 py-2 text-sm text-muted">Searching...</li>}
            {!loading && list.length === 0 && <li className="px-3 py-2 text-sm text-muted">{emptyText}</li>}
            {list.map((o, i) => (
              <li key={o.value || "__clear"} role="option" aria-selected={o.value === value}
                onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); choose(o.value); }}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${i === hi ? "bg-navy-50" : ""}`}>
                <span className="flex min-w-0 items-center gap-2">{o.icon}<span className="truncate">{o.label}</span></span>
                <span className="flex shrink-0 items-center gap-2">
                  {o.sub && <span className="text-xs text-muted">{o.sub}</span>}
                  {o.value === value && o.value !== "" && <Check className="h-4 w-4 text-teal" aria-hidden />}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function MultiSelect({ options, values, onChange, label, id, placeholder = "Select...", max, hint, emptyText = "No matches", onSearch, loading }:
  BaseProps & { values: string[]; onChange: (v: string[]) => void; max?: number }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const list = useMemo(() => {
    if (onSearch || !q.trim()) return options;
    const s = q.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, q, onSearch]);
  const labelOf = (v: string) => options.find((o) => o.value === v);
  const toggle = (v: string) => {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else if (!max || values.length < max) onChange([...values, v]);
  };
  return (
    <div ref={ref} className="relative">
      <label htmlFor={id} className="label">{label}</label>
      <div className="input flex min-h-[40px] flex-wrap items-center gap-1.5 !py-1.5" onClick={() => setOpen(true)}>
        {values.map((v) => {
          const o = labelOf(v);
          return (
            <span key={v} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-slate-50 py-0.5 pl-1.5 pr-1 text-xs">
              {o?.icon}{o?.label ?? v}
              <button type="button" aria-label={`Remove ${o?.label ?? v}`} onClick={(e) => { e.stopPropagation(); toggle(v); }} className="rounded-full p-0.5 hover:bg-slate-200"><X className="h-3 w-3" /></button>
            </span>
          );
        })}
        <input id={id} value={q} onChange={(e) => { setQ(e.target.value); onSearch?.(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder={values.length ? "" : placeholder} className="min-w-[80px] flex-1 bg-transparent text-sm outline-none" />
      </div>
      {hint && <div className="hint">{hint}</div>}
      {open && (
        <ul role="listbox" aria-multiselectable aria-label={label} className="absolute z-30 mt-1 max-h-64 w-full min-w-[240px] overflow-auto rounded-md border border-line bg-white py-1 shadow-pop">
          {loading && <li className="px-3 py-2 text-sm text-muted">Searching...</li>}
          {!loading && list.length === 0 && <li className="px-3 py-2 text-sm text-muted">{emptyText}</li>}
          {list.map((o) => {
            const on = values.includes(o.value);
            const blocked = !on && !!max && values.length >= max;
            return (
              <li key={o.value} role="option" aria-selected={on} aria-disabled={blocked}
                onMouseDown={(e) => { e.preventDefault(); if (!blocked) toggle(o.value); }}
                className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${blocked ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-navy-50"}`}>
                <span className="flex min-w-0 items-center gap-2">{o.icon}<span className="truncate">{o.label}</span></span>
                <span className="flex items-center gap-2">{o.sub && <span className="text-xs text-muted">{o.sub}</span>}{on && <Check className="h-4 w-4 text-teal" aria-hidden />}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
