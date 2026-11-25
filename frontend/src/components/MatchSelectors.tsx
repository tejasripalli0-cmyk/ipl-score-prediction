import { useMemo } from "react";
import { useApp } from "../hooks/AppContext";
import { displayName } from "../data/teams";
import { SearchSelect, type Opt } from "./SearchSelect";
import { TeamBadge } from "./TeamBadge";

export function useTeamOptions(): Opt[] {
  const { teams } = useApp();
  return useMemo(() => teams.map((t) => ({
    value: t.name, label: displayName(t.name), sub: t.active === false ? "defunct" : undefined, icon: <TeamBadge name={t.name} size="xs" />,
  })), [teams]);
}

export function usePredictionTeamOptions(): Opt[] {
  const { options } = useApp();
  return useMemo(() => (options?.teams ?? []).map((t) => ({
    value: t.name, label: t.display_name, sub: t.active ? undefined : "defunct", icon: <TeamBadge name={t.name} size="xs" />,
  })), [options]);
}

export function usePredictionVenueOptions(): Opt[] {
  const { options } = useApp();
  return useMemo(() => {
    if (!options) return [];
    return [...options.venues.map((v) => ({ value: v.name, label: v.name })), { value: options.other_venue, label: "Other venue (not in training data)" }];
  }, [options]);
}

export function TeamSelect(props: { id: string; label: string; value: string; onChange: (v: string) => void; prediction?: boolean; exclude?: string; hint?: string }) {
  const all = useTeamOptions();
  const pred = usePredictionTeamOptions();
  const base = props.prediction ? pred : all;
  const opts = props.exclude ? base.filter((o) => o.value !== props.exclude) : base;
  return <SearchSelect id={props.id} label={props.label} value={props.value} onChange={props.onChange} options={opts} placeholder="Select a team" hint={props.hint} />;
}

export function PredictionVenueSelect(props: { id: string; label?: string; value: string; onChange: (v: string) => void }) {
  const opts = usePredictionVenueOptions();
  return <SearchSelect id={props.id} label={props.label ?? "Venue"} value={props.value} onChange={props.onChange} options={opts} placeholder="Select a venue" />;
}

/** Lets the user pick the exact venue spelling the saved models were trained on. */
export function VenueSpellingSelect({ venue, value, onChange }: { venue: string; value: string; onChange: (v: string) => void }) {
  const { options } = useApp();
  const entry = options?.venues.find((v) => v.name === venue);
  if (!entry || entry.variants.length < 2) return null;
  return (
    <details className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-navy">Advanced: venue spelling used by the model</summary>
      <p className="mt-2 text-xs text-muted">
        The saved models were trained on {entry.variants.length} different spellings of this ground and treat them as separate venues, so predictions can differ slightly between them. Automatic uses the most recent spelling.
      </p>
      <select aria-label="Venue spelling" className="input mt-2" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Automatic ({entry.model_variant})</option>
        {entry.variants.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </details>
  );
}
