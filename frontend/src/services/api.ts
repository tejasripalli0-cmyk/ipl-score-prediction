import axios, { AxiosError } from "axios";
import type {
  ApiErrorInfo, Comparison, DataStatus, FirstInningsRequest, FirstInningsResult, Health, ModelInsights, Options, Overview,
  PlayerAnalytics, PlayerSearchRow, SecondInningsRequest, SecondInningsResult, SeasonsSummary, TeamAnalytics, TeamOption,
  VenueAnalytics, WinResult,
} from "../types";

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://127.0.0.1:8000";

const http = axios.create({ baseURL: API_URL, timeout: 30000 });

export function toApiError(e: unknown): ApiErrorInfo {
  const err = e as AxiosError<{ detail?: { message?: string; field?: string; code?: string } | string }>;
  if (err?.isAxiosError) {
    if (!err.response) {
      return { message: `Cannot reach the API at ${API_URL}. Make sure the backend is running.`, network: true };
    }
    const d = err.response.data?.detail;
    if (d && typeof d === "object") {
      return { message: d.message ?? "The request failed.", field: d.field, code: d.code, status: err.response.status };
    }
    if (typeof d === "string") return { message: d, status: err.response.status };
    return { message: `The server returned an error (${err.response.status}).`, status: err.response.status };
  }
  return { message: e instanceof Error ? e.message : "Something went wrong." };
}

const get = async <T,>(url: string, params?: Record<string, unknown>) =>
  (await http.get<T>(url, { params, paramsSerializer: { indexes: null } })).data;
const enc = encodeURIComponent;

export const api = {
  health: () => get<Health>("/health"),
  options: () => get<Options>("/meta/options"),
  modelInsights: () => get<ModelInsights>("/meta/model-insights"),
  status: () => get<DataStatus>("/analytics/status"),
  overview: () => get<Overview>("/analytics/overview"),
  teams: () => get<TeamOption[]>("/analytics/teams"),
  seasons: () => get<string[]>("/analytics/seasons"),
  venues: () => get<{ name: string; matches: number; last_season: string }[]>("/analytics/venues"),
  team: (name: string, season?: string) => get<TeamAnalytics>(`/analytics/team/${enc(name)}`, { season: season || undefined }),
  compare: (teams: string[], seasons: string[], venue?: string) =>
    get<Comparison>("/analytics/team-comparison", { teams, season: seasons.length ? seasons : undefined, venue: venue || undefined }),
  venue: (name: string) => get<VenueAnalytics>(`/analytics/venue/${enc(name)}`),
  seasonsSummary: (seasons: string[]) => get<SeasonsSummary>("/analytics/seasons/summary", { seasons: seasons.length ? seasons : undefined }),
  players: (q: string) => get<PlayerSearchRow[]>("/analytics/players", { q, limit: 25 }),
  player: (name: string) => get<PlayerAnalytics>(`/analytics/player/${enc(name)}`),
  predictFirst: async (b: FirstInningsRequest) => (await http.post<FirstInningsResult>("/predict/first-innings", b)).data,
  predictSecond: async (b: SecondInningsRequest) => (await http.post<SecondInningsResult>("/predict/second-innings", b)).data,
  predictWin: async (b: SecondInningsRequest) => (await http.post<WinResult>("/predict/win-probability", b)).data,
};
