import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, toApiError } from "../services/api";
import type { ApiErrorInfo, DataStatus, Options, TeamOption } from "../types";

export type InningsType = "first" | "second";
export interface MatchConfig { season: string; battingTeam: string; bowlingTeam: string; venue: string; inningsType: InningsType }

interface Ctx {
  options: Options | null; teams: TeamOption[]; status: DataStatus | null; seasons: string[];
  loading: boolean; error: ApiErrorInfo | null; retry: () => void;
  config: MatchConfig; setConfig: (p: Partial<MatchConfig>) => void;
}

const DEFAULT: MatchConfig = {
  season: "", battingTeam: "Mumbai Indians", bowlingTeam: "Chennai Super Kings",
  venue: "Wankhede Stadium, Mumbai", inningsType: "first",
};
const KEY = "ipl-insight:match-config";

function loadConfig(): MatchConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch { /* storage unavailable - fall back to defaults */ }
  return DEFAULT;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<Options | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [config, setCfg] = useState<MatchConfig>(loadConfig);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    Promise.all([api.options(), api.teams(), api.status()])
      .then(([o, t, s]) => { if (live) { setOptions(o); setTeams(t); setStatus(s); } })
      .catch((e) => { if (live) setError(toApiError(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [nonce]);

  const setConfig = useCallback((p: Partial<MatchConfig>) => {
    setCfg((c) => {
      const next = { ...c, ...p };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(() => ({
    options, teams, status, seasons: status?.seasons ?? [], loading, error, retry: () => setNonce((n) => n + 1), config, setConfig,
  }), [options, teams, status, loading, error, config, setConfig]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}
