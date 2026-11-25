import type { ReactNode } from "react";

export const AXIS = { fontSize: 12, fill: "#5B6B7C" } as const;
export const GRID = "#E8EDF3";
export const TOOLTIP_STYLE = { borderRadius: 6, border: "1px solid #E2E8EF", boxShadow: "0 4px 12px rgba(15,42,74,0.1)", fontSize: 12 } as const;

export function shortSeason(s: string | number): string {
  const t = String(s);
  return t.includes("/") ? t.replace(/^20(\d\d)\/(\d\d)$/, "$1/$2").replace(/^(\d{4})\/(\d\d)$/, "$1/$2") : t;
}

export function Legend({ items }: { items: { label: string; color: string; icon?: ReactNode }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />{i.icon}{i.label}
        </li>
      ))}
    </ul>
  );
}
