"""SYNTHETIC TEST FIXTURE - NOT CRICKET DATA.

Builds a tiny ball-by-ball CSV with hand-picked innings totals so analytics code can be tested
against known answers. It is only used by the test-suite and is never loaded by the application.
"""
from __future__ import annotations

import pandas as pd

# (id, season, raw venue, team1, team2, runs1, wkts1, balls1, runs2, wkts2, balls2, winner, dls, tie_super_over)
MATCHES = [
    ("m1", "2008", "Wankhede Stadium", "Mumbai Indians", "Chennai Super Kings", 160, 5, 120, 150, 8, 120, "Mumbai Indians", False, False),
    ("m2", "2008", "Wankhede Stadium, Mumbai", "Chennai Super Kings", "Mumbai Indians", 170, 4, 120, 171, 3, 100, "Mumbai Indians", False, False),
    ("m3", "2009", "Feroz Shah Kotla", "Delhi Daredevils", "Mumbai Indians", 140, 10, 110, 141, 2, 90, "Mumbai Indians", False, False),
    ("m4", "2009", "Wankhede Stadium", "Mumbai Indians", "Delhi Daredevils", 50, 1, 40, None, None, None, None, False, False),
    ("m5", "2020/21", "Arun Jaitley Stadium, Delhi", "Delhi Capitals", "Kings XI Punjab", 150, 5, 120, 150, 6, 120, "Delhi Capitals", False, True),
    ("m6", "2020/21", "Arun Jaitley Stadium, Delhi", "Chennai Super Kings", "Kings XI Punjab", 180, 3, 120, 100, 2, 60, "Chennai Super Kings", True, False),
    ("m7", "2021", "Wankhede Stadium, Mumbai", "Mumbai Indians", "Chennai Super Kings", 200, 2, 120, 190, 9, 120, "Mumbai Indians", False, False),
]


def _innings(mid, season, venue, innings, bat, bowl, runs, wkts, balls, winner, dls):
    rows, cum, cw = [], 0, 0
    wide_extra = 1 if balls >= 100 and runs >= 2 else 0
    base_total = runs - wide_extra
    base, extra = divmod(base_total, balls)
    wide_at = balls // 2
    for i in range(balls):
        r = base + (1 if i < extra else 0)
        w = 1 if i < wkts else 0
        if wide_extra and i == wide_at:  # an extra (wide) delivery that is NOT a legal ball
            cum += 1
            rows.append(dict(match_id=mid, season=season, date="2020-01-01", venue=venue, innings_number=innings,
                             batting_team=bat, bowling_team=bowl, over=i // 6, ball_in_over=i % 6 + 1,
                             batter="V Kohli" if i % 2 == 0 else "R Sharma", bowler="J Bumrah" if (i // 6) % 2 == 0 else "R Ashwin",
                             batter_runs=0, extras_runs=1, total_runs_this_ball=1, wickets_this_ball=0,
                             cumulative_runs=cum, cumulative_wickets=cw, legal_balls_bowled=i,
                             winner=winner, is_dls=dls, wicket_kind=None, player_dismissed=None))
        cum += r
        cw += w
        kind = None
        if w:
            kind = "caught" if cw % 2 == 1 else "run out"
        rows.append(dict(match_id=mid, season=season, date="2020-01-01", venue=venue, innings_number=innings,
                         batting_team=bat, bowling_team=bowl, over=i // 6, ball_in_over=i % 6 + 1,
                         batter="V Kohli" if i % 2 == 0 else "R Sharma", bowler="J Bumrah" if (i // 6) % 2 == 0 else "R Ashwin",
                         batter_runs=r, extras_runs=0, total_runs_this_ball=r, wickets_this_ball=w,
                         cumulative_runs=cum, cumulative_wickets=cw, legal_balls_bowled=i + 1,
                         winner=winner, is_dls=dls, wicket_kind=kind,
                         player_dismissed=("V Kohli" if i % 2 == 0 else "R Sharma") if w else None))
    return rows


def build_frame() -> pd.DataFrame:
    rows = []
    for (mid, season, venue, t1, t2, r1, w1, b1, r2, w2, b2, winner, dls, tie) in MATCHES:
        rows += _innings(mid, season, venue, 1, t1, t2, r1, w1, b1, winner, dls)
        if r2 is not None:
            rows += _innings(mid, season, venue, 2, t2, t1, r2, w2, b2, winner, dls)
        if tie:  # super over (innings 3) must be ignored
            rows += _innings(mid, season, venue, 3, t1, t2, 12, 0, 6, winner, dls)
    df = pd.DataFrame(rows)
    df["first_innings_score"] = None
    return df


def write_csv(path) -> pd.DataFrame:
    df = build_frame()
    dup = df[df["match_id"] == "m1"].head(3)  # exact duplicate rows must be removed
    out = pd.concat([df, dup], ignore_index=True)
    out.to_csv(path, index=False)
    return df
