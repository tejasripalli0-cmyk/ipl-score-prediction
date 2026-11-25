import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/api", async (orig) => {
  const real = await orig<typeof import("../services/api")>();
  return { ...real, api: new Proxy({}, { get: (_t, k) => (globalThis as any).__api[k] }) };
});

import App from "../App";
import { AppProvider } from "../hooks/AppContext";

const options = {
  teams: [{ name: "Mumbai Indians", display_name: "Mumbai Indians", short: "MI", active: true }, { name: "Chennai Super Kings", display_name: "Chennai Super Kings", short: "CSK", active: true }],
  venues: [{ name: "Wankhede Stadium, Mumbai", model_variant: "Wankhede Stadium, Mumbai", variants: ["Wankhede Stadium", "Wankhede Stadium, Mumbai"] }], other_venue: "__other__",
};
const team = { name: "Mumbai Indians", display_name: "Mumbai Indians", short: "MI", active: true };
const rec = { matches: 10, wins: 6, losses: 4, no_results: 0, win_pct: 60, bat_first_matches: 5, bat_first_wins: 3, bat_first_win_pct: 60, chase_matches: 5, chase_wins: 3, chase_win_pct: 60, super_over_or_tied: 0 };
const sc = { avg_runs: 160, avg_first_innings: 165, avg_second_innings: 155, avg_runs_conceded: 150, avg_wickets_taken: 7, avg_wickets_lost: 6, run_rate: 8, highest_score: { runs: 200, wickets: 3, against: "Chennai Super Kings", season: "2021" }, lowest_score: { runs: 110, wickets: 10, against: "Chennai Super Kings", season: "2009" } };

function mockApi(loaded: boolean) {
  const reject = () => Promise.reject({ isAxiosError: true, response: { status: 503, data: { detail: { message: "Dataset file not found.", code: "dataset_unavailable" } } } });
  (globalThis as any).__api = {
    options: async () => options, teams: async () => options.teams, status: async () => ({ dataset_loaded: loaded, error: loaded ? null : "Dataset file not found.", notes: [], missing_optional_columns: [], seasons: loaded ? ["2008", "2009"] : [], matches: 10 }),
    overview: loaded ? async () => ({ matches: 10, seasons: 2, first_season: "2008", last_season: "2009", teams: 2, venues: 1, total_runs: 1, total_wickets: 1, avg_first_innings: 160, avg_second_innings: 150, highest_score: { runs: 200, team: "Mumbai Indians", against: "Chennai Super Kings", season: "2008" }, bat_first_win_pct: 45, chase_win_pct: 55 }) : reject,
    team: async () => ({ team, season_filter: null, summary: { ...rec, ...sc }, seasons_played: ["2008", "2009"], by_season: [{ season: "2008", ...rec, avg_runs: 160, avg_first_innings: 165, avg_runs_conceded: 150, avg_wickets_taken: 7, run_rate: 8, highest_score: 200 }], vs_opponents: [{ opponent: "Chennai Super Kings", ...rec }], by_venue: [{ venue: "Wankhede Stadium, Mumbai", ...rec }], notes: [] }),
    venues: async () => [{ name: "Wankhede Stadium, Mumbai", matches: 4, last_season: "2009" }],
    venue: async () => ({ venue: "Wankhede Stadium, Mumbai", matches: 4, first_season: "2008", last_season: "2009", avg_first_innings: 150, avg_second_innings: 140, highest_score: 200, lowest_score: 100, bat_first_wins: 2, chase_wins: 1, no_results: 1, bat_first_win_pct: 66.7, chase_win_pct: 33.3, by_season: [{ season: "2008", matches: 2, avg_first_innings: 150, avg_second_innings: 140, highest_score: 200, bat_first_wins: 1, chase_wins: 1 }], team_performance: [{ team: "Mumbai Indians", matches: 4, wins: 3, losses: 1, win_pct: 75, avg_runs: 160, highest_score: 200 }], top_scores: [{ team: "Mumbai Indians", against: "Chennai Super Kings", season: "2008", runs: 200, wickets: 2 }], notes: [] }),
    compare: async () => ({ teams: [team, { ...team, name: "Chennai Super Kings", display_name: "Chennai Super Kings", short: "CSK" }], summaries: { "Mumbai Indians": { ...rec, ...sc }, "Chennai Super Kings": { ...rec, ...sc } }, head_to_head: [{ team_a: "Mumbai Indians", team_b: "Chennai Super Kings", matches: 3, a_wins: 2, b_wins: 1, no_results: 0 }], season_series: { win_pct: [{ season: "2008", "Mumbai Indians": 60, "Chennai Super Kings": 40 }], wins: [{ season: "2008", "Mumbai Indians": 6, "Chennai Super Kings": 4 }], matches: [], avg_runs: [{ season: "2008", "Mumbai Indians": 160, "Chennai Super Kings": 150 }] }, by_venue: [], radar: [{ metric: "Win %", "Mumbai Indians": 80, "Chennai Super Kings": 20 }], notes: [] }),
    seasonsSummary: async () => ({ seasons: [{ season: "2008", matches: 2, avg_first_innings: 150, avg_second_innings: 140, highest_score: 200, total_runs: 600, total_wickets: 30, run_rate: 8 }], all_seasons: ["2008"], aggregate: { matches: 2, avg_first_innings: 150, avg_second_innings: 140, highest_score: 200, total_runs: 600, total_wickets: 30, teams: [{ team: "Mumbai Indians", matches: 2, wins: 2, losses: 0, win_pct: 100, avg_runs: 160 }] } }),
    players: async () => [{ name: "V Kohli", balls_faced: 100, balls_bowled: 0 }],
    player: async () => ({ name: "V Kohli", season_filter: null, teams: ["Mumbai Indians"], notes: ["note"], batting: { innings: 2, runs: 100, balls_faced: 80, strike_rate: 125, highest_score: 60, fours: 5, sixes: 2, fifties: 1, hundreds: 0, average: null, dismissals: null }, bowling: null, by_season: [{ season: "2008", runs: 100, strike_rate: 125 }] }),
    modelInsights: async () => ({ metrics: { evaluation_season: "2025", note: "n", first_innings: { algorithm: "Random Forest Regressor", mae: 19.65, rmse: 26.77, r2: 0.414 }, second_innings: { algorithm: "Linear Regression", mae: 14.72, rmse: 19.23, r2: 0.636 }, win_probability: { algorithm: "Random Forest Classifier", accuracy: 0.811, roc_auc: 0.86 } },
      models: { first_innings: { info: { algorithm: "x", input_features: ["venue"], encoded_feature_count: 5, parameters: {} }, feature_importance: [{ feature: "venue", importance: 0.5 }] }, second_innings: { info: { algorithm: "x", input_features: ["a"], encoded_feature_count: 5, parameters: {} }, coefficients: [{ feature: "a", coefficient: 1 }] }, win_probability: { info: { algorithm: "x", input_features: ["a"], encoded_feature_count: 5, parameters: {} }, feature_importance: [{ feature: "a", importance: 0.5 }] } },
      model_comparison: null, shap: null, dataset_overview: null }),
  };
}

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppProvider><App /></AppProvider></MemoryRouter>);

describe("every route renders (mocked API)", () => {
  beforeEach(() => { localStorage.clear(); });
  const cases: [string, RegExp][] = [
    ["/", /AI-POWERED CRICKET ANALYTICS/], ["/score-predictor", /Score Predictor/], ["/win-probability", /Win Probability/],
    ["/team-analytics", /Team Analytics/], ["/team-comparison", /Team Comparison/], ["/player-analytics", /Player Analytics/],
    ["/venue-analytics", /Venue Analytics/], ["/season-trends", /Season Trends/], ["/model-insights", /Model Insights/], ["/about", /About the Project/],
  ];
  for (const [path, re] of cases) {
    it(`${path} (dataset loaded)`, async () => {
      mockApi(true);
      renderAt(path);
      await waitFor(() => expect(screen.getAllByText(re).length).toBeGreaterThan(0));
      await new Promise((r) => setTimeout(r, 50));
      expect(document.body.textContent).not.toMatch(/Unexpected|Cannot read/);
    });
  }
  for (const path of ["/team-analytics", "/team-comparison", "/player-analytics", "/venue-analytics", "/season-trends"]) {
    it(`${path} explains the missing dataset`, async () => {
      mockApi(false);
      renderAt(path);
      await waitFor(() => expect(screen.getByText(/Historical dataset needed/)).toBeInTheDocument());
    });
  }
  it("shows a clear message when the backend is unreachable", async () => {
    (globalThis as any).__api = { options: () => Promise.reject({ isAxiosError: true }), teams: async () => [], status: async () => ({}) };
    renderAt("/team-analytics");
    await waitFor(() => expect(screen.getAllByText(/Cannot reach the API/).length).toBeGreaterThan(0));
  });
  it("home shows the match configuration and navigation cards", async () => {
    mockApi(true);
    renderAt("/");
    expect(await screen.findByText("Match configuration")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Team Comparison/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Mumbai Indians badge/).length).toBeGreaterThan(0);
  });
});
