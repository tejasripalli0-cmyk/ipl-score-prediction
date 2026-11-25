# Data folder

Place your Cricsheet ball-by-ball export here as **`ball_by_ball_dataset.csv`**, then restart the API.

* Required columns: `match_id, season, venue, innings_number, batting_team, bowling_team, cumulative_runs,
  cumulative_wickets, legal_balls_bowled, total_runs_this_ball, winner`
* Used when present: `date, over, ball_in_over, batter, bowler, batter_runs, extras_runs, wickets_this_ball,
  target_runs, target_overs, is_dls, wicket_kind, player_dismissed, extras_type`

Check a file first with `python scripts/inspect_dataset.py`.

Optional: `model_report.json` - extra material from your Colab notebook for the Model Insights page
(`model_comparison`, `shap`, `dataset_overview`). See `model_report.example.json`. Nothing is shown for these
sections unless you provide real values.
