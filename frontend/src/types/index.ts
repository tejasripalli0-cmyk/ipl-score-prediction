export interface TeamOption { name: string; display_name: string; short: string; active: boolean | null; in_dataset?: boolean | null }
export interface VenueOption { name: string; model_variant: string; variants: string[] }
export interface Options { teams: TeamOption[]; venues: VenueOption[]; other_venue: string }

export interface ApiErrorInfo { message: string; field?: string | null; code?: string; network?: boolean; status?: number }

export interface DataStatus {
  dataset_loaded: boolean; error: string | null; notes: string[]; missing_optional_columns: string[];
  rows?: number; matches?: number; seasons?: string[]; teams?: number; venues?: number;
}
export interface Health { status: string; models: Record<string, boolean>; model_errors: Record<string, string>; dataset_loaded: boolean }

export interface Factor { factor: string; impact: number; unit: string; direction: "up" | "down" | "neutral"; description: string }
export interface RangeInfo { low: number; high: number; method: string; description: string }
export interface ModelInfo { name: string; algorithm: string; test_season: string; metrics: Record<string, number> }

export interface FirstInningsRequest {
  batting_team: string; bowling_team: string; venue: string; venue_variant?: string | null;
  legal_balls_bowled: number; cumulative_runs: number; cumulative_wickets: number;
}
export interface SecondInningsRequest extends FirstInningsRequest {
  first_innings_score: number; target_runs: number; target_overs: number;
}
export interface FirstInningsResult {
  predicted_final_score: number; raw_model_prediction: number; adjusted_to_current_score: boolean;
  current_score: number; current_wickets: number; current_run_rate: number; balls_remaining: number; overs_bowled: string;
  projected_at_current_rate: number; range: RangeInfo; derived_features: Record<string, string | number>;
  factors: Factor[]; summary: string; warnings: string[]; model: ModelInfo;
}
export interface SecondInningsResult {
  predicted_final_score: number; raw_model_prediction: number; adjusted_to_current_score: boolean;
  target_runs: number; first_innings_score: number; current_score: number; current_wickets: number;
  current_run_rate: number; required_run_rate: number; runs_required: number; balls_remaining: number; overs_bowled: string;
  projected_at_current_rate: number; predicted_margin_vs_target: number; range: RangeInfo;
  derived_features: Record<string, string | number>; factors: Factor[]; summary: string; warnings: string[]; model: ModelInfo;
}
export interface WinResult {
  batting_team: string; bowling_team: string; batting_win_probability: number; bowling_win_probability: number;
  target_runs: number; runs_required: number; balls_remaining: number; current_score: number; current_wickets: number;
  current_run_rate: number; required_run_rate: number; overs_bowled: string;
  derived_features: Record<string, string | number>; factors: Factor[]; summary: string; warnings: string[];
  disclaimer: string; model: ModelInfo;
}

export interface Extreme { runs: number; wickets: number; against: string; season: string }
export interface Record_ {
  matches: number; wins: number; losses: number; no_results: number; win_pct: number | null;
  bat_first_matches: number; bat_first_wins: number; bat_first_win_pct: number | null;
  chase_matches: number; chase_wins: number; chase_win_pct: number | null; super_over_or_tied: number;
}
export interface Scores {
  avg_runs: number | null; avg_first_innings: number | null; avg_second_innings: number | null;
  avg_runs_conceded: number | null; avg_wickets_taken: number | null; avg_wickets_lost: number | null; run_rate: number | null;
  highest_score: Extreme | null; lowest_score: Extreme | null;
}
export type TeamSummary = Record_ & Scores;
export interface TeamMeta { name: string; display_name: string; short: string; active: boolean | null }
export interface TeamAnalytics {
  team: TeamMeta; season_filter: string | null; summary: TeamSummary; seasons_played: string[];
  by_season: (Record_ & { season: string; avg_runs: number | null; avg_first_innings: number | null; avg_runs_conceded: number | null;
    avg_wickets_taken: number | null; run_rate: number | null; highest_score: number | null })[];
  vs_opponents: (Record_ & { opponent: string })[];
  by_venue: (Record_ & { venue: string })[]; notes: string[];
}
export interface Comparison {
  teams: TeamMeta[]; summaries: Record<string, TeamSummary>;
  head_to_head: { team_a: string; team_b: string; matches: number; a_wins: number; b_wins: number; no_results: number }[];
  season_series: Record<"win_pct" | "wins" | "matches" | "avg_runs", Record<string, string | number | null>[]>;
  by_venue: Record<string, unknown>[]; radar: Record<string, string | number | null>[]; notes: string[];
}
export interface VenueAnalytics {
  venue: string; matches: number; first_season: string; last_season: string; avg_first_innings: number | null;
  avg_second_innings: number | null; highest_score: number | null; lowest_score: number | null;
  bat_first_wins: number; chase_wins: number; no_results: number; bat_first_win_pct: number | null; chase_win_pct: number | null;
  by_season: { season: string; matches: number; avg_first_innings: number | null; avg_second_innings: number | null;
    highest_score: number | null; bat_first_wins: number; chase_wins: number }[];
  team_performance: { team: string; matches: number; wins: number; losses: number; win_pct: number | null; avg_runs: number | null; highest_score: number | null }[];
  top_scores: { team: string; against: string; season: string; runs: number; wickets: number }[]; notes: string[];
}
export interface SeasonRow {
  season: string; matches: number; avg_first_innings: number | null; avg_second_innings: number | null;
  highest_score: number | null; total_runs: number; total_wickets: number; run_rate: number | null;
}
export interface SeasonsSummary {
  seasons: SeasonRow[]; all_seasons: string[];
  aggregate: { matches: number; avg_first_innings: number | null; avg_second_innings: number | null; highest_score: number | null;
    total_runs: number; total_wickets: number;
    teams: { team: string; matches: number; wins: number; losses: number; win_pct: number | null; avg_runs: number | null }[] };
}
export interface Overview {
  matches: number; seasons: number; first_season: string; last_season: string; teams: number; venues: number;
  total_runs: number; total_wickets: number; avg_first_innings: number | null; avg_second_innings: number | null;
  highest_score: { runs: number; team: string; against: string; season: string } | null;
  bat_first_win_pct: number | null; chase_win_pct: number | null;
}
export interface PlayerSearchRow { name: string; balls_faced: number; balls_bowled: number }
export interface PlayerAnalytics {
  name: string; season_filter: string | null; teams: string[]; notes: string[];
  batting: { innings: number; runs: number; balls_faced: number; strike_rate: number | null; highest_score: number; fours: number; sixes: number;
    fifties: number; hundreds: number; average: number | null; dismissals: number | null } | null;
  bowling: { balls_bowled: number; overs: string; runs_conceded: number; economy: number | null; wickets: number | null;
    best_figures: string | null; average: number | null; strike_rate: number | null } | null;
  by_season: { season: string; runs?: number; innings?: number; balls_faced?: number; strike_rate?: number | null; fours?: number; sixes?: number;
    highest_score?: number; average?: number | null; wickets?: number | null; economy?: number | null; balls_bowled?: number }[];
}
export interface ModelInsights {
  metrics: Record<string, any>;
  models: Record<string, { info: { algorithm: string; input_features: string[]; encoded_feature_count: number; parameters: Record<string, unknown> };
    feature_importance?: { feature: string; importance: number }[]; coefficients?: { feature: string; coefficient: number }[] }>;
  model_comparison: Record<string, any>[] | null; shap: Record<string, { feature: string; mean_abs_shap: number }[]> | null;
  dataset_overview: Record<string, any> | null;
}
