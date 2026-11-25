"""Print a quick report on a ball-by-ball CSV before using it in the app.

    python scripts/inspect_dataset.py [path-to-csv]
"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.data_service import OPTIONAL_COLUMNS, REQUIRED_COLUMNS  # noqa: E402
from app.utils.teams import CANONICAL_TEAMS, normalize_team  # noqa: E402
from app.utils.venues import canonical_venue  # noqa: E402

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "data" / "ball_by_ball_dataset.csv"
if not path.exists():
    sys.exit(f"File not found: {path}")
df = pd.read_csv(path, low_memory=False)
print(f"{path.name}: {len(df):,} rows x {df.shape[1]} columns\n")
print("Required columns missing:", [c for c in REQUIRED_COLUMNS if c not in df.columns] or "none")
print("Optional columns missing:", [c for c in OPTIONAL_COLUMNS if c not in df.columns] or "none")
print("Unrecognised extra columns:", [c for c in df.columns if c not in REQUIRED_COLUMNS + OPTIONAL_COLUMNS] or "none")
if "season" in df:
    print("\nSeasons:", sorted(df["season"].astype(str).unique()))
if "match_id" in df:
    print("Matches:", df["match_id"].nunique())
if "batting_team" in df:
    raw = sorted(set(df["batting_team"].dropna()) | set(df.get("bowling_team", pd.Series(dtype=str)).dropna()))
    print("\nTeam names (raw -> canonical):")
    for t in raw:
        c = normalize_team(t)
        print(f"  {t!r:40} -> {c}{'' if c in CANONICAL_TEAMS else '   <-- not a known franchise'}")
if "venue" in df:
    raw_v = sorted(df["venue"].dropna().astype(str).unique())
    print(f"\nVenues: {len(raw_v)} raw -> {len({canonical_venue(v) for v in raw_v})} after grouping")
if "winner" in df and "match_id" in df:
    w = df.groupby("match_id")["winner"].first()
    print(f"\nMatches without a winner (treated as no result): {int(w.isna().sum())}")
if "innings_number" in df:
    print("Innings numbers present:", sorted(df["innings_number"].dropna().unique().tolist()))
