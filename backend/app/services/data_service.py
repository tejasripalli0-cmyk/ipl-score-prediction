"""Historical analytics computed from the Cricsheet-style ball-by-ball CSV.

Definitions (also surfaced to the UI through `notes`):
* Only innings 1 and 2 are analysed; super-over innings (3+) are ignored.
* A match "has a result" when the `winner` column names one of the two teams. Matches with a
  blank / "no result" / "tie" winner are counted as played but are NOT losses for anyone, and are
  excluded from win percentages. Win % = wins / (wins + losses).
* Matches level tables are built from innings level data (one row per innings), never by
  summing delivery rows twice.
* DLS / rain-affected matches (is_dls) still count towards wins and losses but are excluded from
  scoring statistics (averages, highest, lowest) because their innings are truncated.
* "Lowest score" only considers completed innings (all out, or all overs faced), so a chase that
  ended early with the target reached is not reported as a low total.
"""
from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import pandas as pd

from ..utils.teams import CANONICAL_TEAMS, franchise_info, normalize_team
from ..utils.venues import canonical_venue

log = logging.getLogger("ipl.data")

REQUIRED_COLUMNS = [
    "match_id", "season", "venue", "innings_number", "batting_team", "bowling_team",
    "cumulative_runs", "cumulative_wickets", "legal_balls_bowled", "total_runs_this_ball", "winner",
]
OPTIONAL_COLUMNS = [
    "date", "over", "ball_in_over", "batter", "bowler", "non_striker", "batter_runs", "extras_runs",
    "wickets_this_ball", "first_innings_score", "target_runs", "target_overs", "final_score", "is_dls",
    "wicket_kind", "dismissal_kind", "player_dismissed", "extras_type",
]
NO_WINNER = {"", "nan", "none", "null", "no result", "no_result", "tie", "tied", "n/a", "na", "abandoned", "draw"}
NOT_BOWLER_WICKETS = {"run out", "retired hurt", "retired out", "obstructing the field", "retired"}


class DatasetUnavailable(Exception):
    pass


class NotFound(Exception):
    pass


def clean(obj: Any) -> Any:
    """Make numpy/pandas values JSON-safe (NaN -> None)."""
    if isinstance(obj, dict):
        return {str(k): clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [clean(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        f = float(obj)
        return None if (math.isnan(f) or math.isinf(f)) else f
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if obj is pd.NA or obj is pd.NaT:
        return None
    return obj


def _r(x: float | None, nd: int = 2) -> float | None:
    if x is None:
        return None
    try:
        if math.isnan(x):
            return None
    except TypeError:
        return None
    return round(float(x), nd)


def _pct(a: float, b: float) -> float | None:
    return round(100.0 * a / b, 1) if b else None


def _season_key(s: str) -> int:
    try:
        return int(str(s)[:4])
    except ValueError:
        return 0


def _truthy(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip().str.lower().isin({"true", "1", "1.0", "yes", "y", "t"})


class DataService:
    def __init__(self) -> None:
        self.loaded = False
        self.load_error: str | None = None
        self.notes: list[str] = []
        self.missing_optional: list[str] = []
        self.rows = 0
        self.balls: pd.DataFrame = pd.DataFrame()
        self.inn: pd.DataFrame = pd.DataFrame()
        self.matches: pd.DataFrame = pd.DataFrame()
        self.seasons: list[str] = []
        self._venue_raw_last: dict[str, int] = {}

    # ------------------------------------------------------------------ loading
    def load(self, path: Path) -> None:
        self.loaded = False
        self.notes, self.missing_optional = [], []
        if not path.exists():
            self.load_error = "Dataset file not found. Place ball_by_ball_dataset.csv in backend/data/ and restart the API."
            return
        try:
            self._build(path)
            self.loaded = True
            self.load_error = None
            log.info("Dataset loaded: %d rows, %d matches", self.rows, len(self.matches))
        except Exception as exc:
            self.loaded = False
            self.load_error = f"Dataset could not be processed: {exc}"
            log.exception("Dataset load failed")

    def _build(self, path: Path) -> None:
        header = pd.read_csv(path, nrows=0).columns.tolist()
        missing = [c for c in REQUIRED_COLUMNS if c not in header]
        if missing:
            raise ValueError(f"missing required column(s): {', '.join(missing)}")
        self.missing_optional = [c for c in OPTIONAL_COLUMNS if c not in header]
        use = [c for c in REQUIRED_COLUMNS + OPTIONAL_COLUMNS if c in header]
        df = pd.read_csv(path, usecols=use, dtype={"season": str, "match_id": str}, low_memory=False)
        n0 = len(df)
        df = df.drop_duplicates()
        if n0 - len(df):
            self.notes.append(f"Removed {n0 - len(df):,} exact duplicate delivery rows.")
        for c in ("innings_number", "cumulative_runs", "cumulative_wickets", "legal_balls_bowled", "total_runs_this_ball"):
            df[c] = pd.to_numeric(df[c], errors="coerce")
        n1 = len(df)
        df = df.dropna(subset=["match_id", "season", "innings_number", "cumulative_runs", "cumulative_wickets", "legal_balls_bowled"])
        if n1 - len(df):
            self.notes.append(f"Dropped {n1 - len(df):,} rows with missing key values.")
        df["total_runs_this_ball"] = df["total_runs_this_ball"].fillna(0)
        for c in ("batter_runs", "extras_runs", "wickets_this_ball", "target_overs"):
            if c in df.columns:
                df[c] = pd.to_numeric(df[c], errors="coerce")
        df["innings_number"] = df["innings_number"].astype(int)
        df["season"] = df["season"].astype(str).str.strip()
        for c in ("batting_team", "bowling_team"):
            df[c] = df[c].map(normalize_team)
        win = df["winner"].astype("string").str.strip()
        win = win.where(~win.str.lower().isin(NO_WINNER), pd.NA)
        df["winner"] = win.map(lambda v: normalize_team(v) if pd.notna(v) else None)
        raw_venue = df["venue"].astype(str).str.strip()
        df["venue_raw"] = raw_venue
        df["venue"] = raw_venue.map(canonical_venue)
        df["is_dls"] = _truthy(df["is_dls"]) if "is_dls" in df.columns else False
        so = df[df["innings_number"] > 2]
        if len(so):
            self.notes.append(f"Ignored {so['match_id'].nunique()} super-over innings groups (innings 3+).")
        df = df[df["innings_number"].isin([1, 2])].copy()
        # legal delivery flag: legal_balls_bowled increased on this row
        df["_legal"] = df.groupby(["match_id", "innings_number"])["legal_balls_bowled"].diff().fillna(df["legal_balls_bowled"]) > 0
        self.rows = len(df)
        self.balls = df
        self._venue_raw_last = (
            df.assign(_sk=df["season"].map(_season_key)).groupby("venue_raw")["_sk"].max().to_dict())
        self._build_innings_and_matches()
        if self.missing_optional:
            self.notes.append("Optional columns not present: " + ", ".join(self.missing_optional) + ". Statistics needing them are hidden or flagged.")

    def _build_innings_and_matches(self) -> None:
        df = self.balls
        g = df.groupby(["match_id", "innings_number"], sort=False)
        inn = g.agg(season=("season", "first"), venue=("venue", "first"), venue_raw=("venue_raw", "first"),
                    team=("batting_team", "first"), opp=("bowling_team", "first"),
                    runs=("cumulative_runs", "max"), wickets=("cumulative_wickets", "max"),
                    balls=("legal_balls_bowled", "max"), winner=("winner", "first"), is_dls=("is_dls", "max")).reset_index()
        if "date" in df.columns:
            inn["date"] = g["date"].first().values
        dls = inn.groupby("match_id")["is_dls"].transform("max")
        inn["is_dls"] = dls.astype(bool)
        inn["completed"] = (inn["wickets"] >= 10) | (inn["balls"] >= 120)
        inn["runs"] = inn["runs"].astype(int)
        inn["wickets"] = inn["wickets"].astype(int)
        inn["balls"] = inn["balls"].astype(int)
        self.inn = inn
        i1 = inn[inn["innings_number"] == 1].set_index("match_id")
        i2 = inn[inn["innings_number"] == 2].set_index("match_id")
        m = pd.DataFrame(index=i1.index)
        m["season"] = i1["season"]
        m["venue"] = i1["venue"]
        m["date"] = i1["date"] if "date" in i1 else None
        m["team1"], m["team2"] = i1["team"], i1["opp"]
        m["score1"], m["wkts1"] = i1["runs"], i1["wickets"]
        m["score2"] = i2["runs"].reindex(m.index)
        m["wkts2"] = i2["wickets"].reindex(m.index)
        m["is_dls"] = i1["is_dls"]
        w = i1["winner"].combine_first(i2["winner"].reindex(m.index))
        m["winner"] = w
        has2 = m["score2"].notna()
        res = np.where(~has2, "no_result", np.where(m["winner"] == m["team1"], "bat_first",
                       np.where(m["winner"] == m["team2"], "chase", "no_result")))
        m["result"] = res
        m["tied"] = has2 & (m["score1"] == m["score2"]) & ~m["is_dls"]
        self.matches = m.reset_index()
        self.seasons = sorted(self.matches["season"].unique(), key=_season_key)

    # --------------------------------------------------------------- guards
    def require(self) -> None:
        if not self.loaded:
            raise DatasetUnavailable(self.load_error or "Dataset not loaded.")

    def latest_raw_variant(self, variants: list[str]) -> str | None:
        best = [(self._venue_raw_last.get(v, -1), v) for v in variants]
        best = [b for b in best if b[0] >= 0]
        return max(best)[1] if best else None

    def status(self) -> dict:
        base = {"dataset_loaded": self.loaded, "error": self.load_error, "notes": self.notes,
                "missing_optional_columns": self.missing_optional}
        if self.loaded:
            base.update({"rows": self.rows, "matches": int(len(self.matches)), "seasons": self.seasons,
                         "teams": len(self.team_names()), "venues": int(self.matches["venue"].nunique())})
        return base

    # ----------------------------------------------------------- filtering
    def _filter_matches(self, season: str | list[str] | None = None, venue: str | None = None) -> pd.DataFrame:
        m = self.matches
        if season:
            seasons = [season] if isinstance(season, str) else season
            m = m[m["season"].isin(seasons)]
        if venue:
            m = m[m["venue"] == (canonical_venue(venue) or venue)]
        return m

    def _filter_inn(self, season=None, venue=None) -> pd.DataFrame:
        i = self.inn
        if season:
            seasons = [season] if isinstance(season, str) else season
            i = i[i["season"].isin(seasons)]
        if venue:
            i = i[i["venue"] == (canonical_venue(venue) or venue)]
        return i

    def team_names(self) -> list[str]:
        names = set(self.matches["team1"]).union(self.matches["team2"]) if self.loaded else set()
        ordered = [t for t in CANONICAL_TEAMS if t in names] + sorted(n for n in names if n not in CANONICAL_TEAMS)
        return ordered

    def resolve_team(self, raw: str) -> str:
        self.require()
        t = normalize_team(raw)
        if t not in set(self.team_names()):
            raise NotFound(f"Team '{raw}' not found in the dataset.")
        return t

    # ------------------------------------------------------ record helpers
    @staticmethod
    def _record(m: pd.DataFrame, team: str) -> dict:
        tm = m[(m["team1"] == team) | (m["team2"] == team)]
        decided = tm[tm["result"] != "no_result"]
        wins = int((decided["winner"] == team).sum())
        losses = len(decided) - wins
        bf = tm[tm["team1"] == team]
        ch = tm[tm["team2"] == team]
        bf_dec, ch_dec = bf[bf["result"] != "no_result"], ch[ch["result"] != "no_result"]
        bf_w, ch_w = int((bf_dec["winner"] == team).sum()), int((ch_dec["winner"] == team).sum())
        return {
            "matches": int(len(tm)), "wins": wins, "losses": int(losses),
            "no_results": int((tm["result"] == "no_result").sum()),
            "win_pct": _pct(wins, wins + losses),
            "bat_first_matches": int(len(bf_dec)), "bat_first_wins": bf_w, "bat_first_win_pct": _pct(bf_w, len(bf_dec)),
            "chase_matches": int(len(ch_dec)), "chase_wins": ch_w, "chase_win_pct": _pct(ch_w, len(ch_dec)),
            "super_over_or_tied": int(tm["tied"].sum()),
        }

    @staticmethod
    def _scores(i: pd.DataFrame, team: str) -> dict:
        own = i[(i["team"] == team) & (~i["is_dls"])]
        conc = i[(i["opp"] == team) & (~i["is_dls"])]
        out: dict[str, Any] = {
            "avg_runs": _r(own["runs"].mean()), "avg_first_innings": _r(own[own["innings_number"] == 1]["runs"].mean()),
            "avg_second_innings": _r(own[own["innings_number"] == 2]["runs"].mean()),
            "avg_runs_conceded": _r(conc["runs"].mean()),
            "avg_wickets_taken": _r(conc["wickets"].mean()), "avg_wickets_lost": _r(own["wickets"].mean()),
            "run_rate": _r(own["runs"].sum() * 6 / own["balls"].sum()) if own["balls"].sum() else None,
            "highest_score": None, "lowest_score": None,
        }
        if len(own):
            hi = own.loc[own["runs"].idxmax()]
            out["highest_score"] = {"runs": int(hi["runs"]), "wickets": int(hi["wickets"]), "against": hi["opp"], "season": hi["season"]}
        comp = own[own["completed"]]
        if len(comp):
            lo = comp.loc[comp["runs"].idxmin()]
            out["lowest_score"] = {"runs": int(lo["runs"]), "wickets": int(lo["wickets"]), "against": lo["opp"], "season": lo["season"]}
        return out

    def _team_summary(self, team: str, season=None, venue=None) -> dict:
        m, i = self._filter_matches(season, venue), self._filter_inn(season, venue)
        return {**self._record(m, team), **self._scores(i, team)}

    @staticmethod
    def _team_meta(team: str) -> dict:
        info = franchise_info(team) or {}
        return {"name": team, "display_name": info.get("display_name", team), "short": info.get("short", team[:3].upper()),
                "active": info.get("active")}

    # ------------------------------------------------------------ overview
    def overview(self) -> dict:
        self.require()
        m, i = self.matches, self.inn
        nd = i[~i["is_dls"]]
        hi = nd.loc[nd["runs"].idxmax()] if len(nd) else None
        decided = m[m["result"] != "no_result"]
        return clean({
            "matches": len(m), "seasons": len(self.seasons), "first_season": self.seasons[0] if self.seasons else None,
            "last_season": self.seasons[-1] if self.seasons else None, "teams": len(self.team_names()),
            "venues": int(m["venue"].nunique()), "total_runs": int(i["runs"].sum()), "total_wickets": int(i["wickets"].sum()),
            "avg_first_innings": _r(nd[nd["innings_number"] == 1]["runs"].mean()),
            "avg_second_innings": _r(nd[nd["innings_number"] == 2]["runs"].mean()),
            "highest_score": ({"runs": int(hi["runs"]), "team": hi["team"], "against": hi["opp"], "season": hi["season"]}
                              if hi is not None else None),
            "bat_first_win_pct": _pct(int((decided["result"] == "bat_first").sum()), len(decided)),
            "chase_win_pct": _pct(int((decided["result"] == "chase").sum()), len(decided)),
        })

    # -------------------------------------------------------------- team
    def team(self, team_name: str, season: str | None = None) -> dict:
        t = self.resolve_team(team_name)
        m_all, i_all = self.matches, self.inn
        summary = self._team_summary(t, season)
        m, i = self._filter_matches(season), self._filter_inn(season)
        team_seasons = sorted(set(m_all[(m_all.team1 == t) | (m_all.team2 == t)]["season"]), key=_season_key)
        by_season = []
        for s in team_seasons:
            rec = self._record(m_all[m_all["season"] == s], t)
            sc = self._scores(i_all[i_all["season"] == s], t)
            by_season.append({"season": s, **rec, "avg_runs": sc["avg_runs"], "avg_first_innings": sc["avg_first_innings"],
                              "avg_runs_conceded": sc["avg_runs_conceded"], "avg_wickets_taken": sc["avg_wickets_taken"],
                              "run_rate": sc["run_rate"],
                              "highest_score": sc["highest_score"]["runs"] if sc["highest_score"] else None})
        tm = m[(m.team1 == t) | (m.team2 == t)]
        opps = sorted(set(tm.team1).union(tm.team2) - {t})
        vs = [{"opponent": o, **self._record(m[((m.team1 == t) & (m.team2 == o)) | ((m.team1 == o) & (m.team2 == t))], t)} for o in opps]
        vs.sort(key=lambda r: -r["matches"])
        venues = []
        for v, sub in tm.groupby("venue"):
            venues.append({"venue": v, **self._record(sub, t)})
        venues.sort(key=lambda r: -r["matches"])
        return clean({"team": self._team_meta(t), "season_filter": season, "summary": summary, "by_season": by_season,
                      "vs_opponents": vs, "by_venue": venues, "seasons_played": team_seasons,
                      "notes": ["Win % excludes no-result matches. Scoring statistics exclude DLS-affected matches."]})

    # ---------------------------------------------------------- comparison
    def compare(self, teams: list[str], season: str | list[str] | None = None, venue: str | None = None) -> dict:
        self.require()
        ts = []
        for raw in teams:
            t = self.resolve_team(raw)
            if t not in ts:
                ts.append(t)
        if len(ts) < 2:
            raise ValueError("Select at least two different teams to compare.")
        seasons = [season] if isinstance(season, str) else season
        m, i = self._filter_matches(seasons, venue), self._filter_inn(seasons, venue)
        summaries = {t: {**self._record(m, t), **self._scores(i, t)} for t in ts}
        h2h = []
        for a_idx, a in enumerate(ts):
            for b in ts[a_idx + 1:]:
                sub = m[((m.team1 == a) & (m.team2 == b)) | ((m.team1 == b) & (m.team2 == a))]
                dec = sub[sub["result"] != "no_result"]
                aw, bw = int((dec["winner"] == a).sum()), int((dec["winner"] == b).sum())
                h2h.append({"team_a": a, "team_b": b, "matches": int(len(sub)), "a_wins": aw, "b_wins": bw,
                            "no_results": int(len(sub) - len(dec))})
        all_seasons = sorted(set(m["season"]), key=_season_key)
        series: dict[str, list[dict]] = {k: [] for k in ("win_pct", "wins", "matches", "avg_runs")}
        for s in all_seasons:
            rows = {k: {"season": s} for k in series}
            for t in ts:
                rec = self._record(m[m["season"] == s], t)
                sc = self._scores(i[i["season"] == s], t)
                if rec["matches"]:
                    rows["win_pct"][t], rows["wins"][t], rows["matches"][t], rows["avg_runs"][t] = (
                        rec["win_pct"], rec["wins"], rec["matches"], sc["avg_runs"])
            for k in series:
                series[k].append(rows[k])
        venue_rows = []
        for v in sorted(m["venue"].dropna().unique()):
            row = {"venue": v}
            has = False
            for t in ts:
                rec = self._record(m[m["venue"] == v], t)
                if rec["matches"]:
                    has = True
                    row[t] = {"matches": rec["matches"], "wins": rec["wins"], "win_pct": rec["win_pct"]}
            if has:
                row["total"] = sum(row[t]["matches"] for t in ts if t in row)
                venue_rows.append(row)
        venue_rows.sort(key=lambda r: -r["total"])
        # radar: league-wide min-max for the same filters
        league = {t: {**self._record(m, t), **self._scores(i, t)} for t in self.team_names()}
        league = {t: v for t, v in league.items() if v["matches"] > 0}
        metrics = [("win_pct", "Win %"), ("avg_runs", "Avg score"), ("avg_first_innings", "Batting-first avg"),
                   ("bat_first_win_pct", "Defending win %"), ("chase_win_pct", "Chasing win %"),
                   ("run_rate", "Run rate")]
        radar = []
        for key, label in metrics:
            vals = [v[key] for v in league.values() if v.get(key) is not None]
            lo, hi = (min(vals), max(vals)) if vals else (0, 0)
            row = {"metric": label, "key": key}
            for t in ts:
                v = summaries[t].get(key)
                row[t] = None if v is None else (50.0 if hi == lo else round(100 * (v - lo) / (hi - lo), 1))
                row[f"{t}__raw"] = v
            radar.append(row)
        return clean({"teams": [self._team_meta(t) for t in ts], "season_filter": seasons, "venue_filter": venue,
                      "summaries": summaries, "head_to_head": h2h, "season_series": series, "by_venue": venue_rows,
                      "radar": radar,
                      "notes": ["Radar axes are scaled 0-100 against all franchises under the same filters (min-max), so they show relative strength, not absolute values."]})

    # --------------------------------------------------------------- venues
    def venue_list(self) -> list[dict]:
        self.require()
        g = self.matches.groupby("venue").agg(matches=("match_id", "count"), last=("season", lambda s: max(s, key=_season_key)))
        return clean([{"name": v, "matches": int(r.matches), "last_season": r["last"]} for v, r in g.sort_values("matches", ascending=False).iterrows()])

    def venue(self, name: str) -> dict:
        self.require()
        canon = canonical_venue(name)
        m = self.matches[self.matches["venue"] == canon]
        if m.empty:
            raise NotFound(f"Venue '{name}' not found in the dataset.")
        i = self.inn[(self.inn["venue"] == canon) & (~self.inn["is_dls"])]
        dec = m[m["result"] != "no_result"]
        bf, ch = int((dec["result"] == "bat_first").sum()), int((dec["result"] == "chase").sum())
        i1, i2 = i[i["innings_number"] == 1], i[i["innings_number"] == 2]
        comp = i[i["completed"]]
        by_season = []
        for s in sorted(set(m["season"]), key=_season_key):
            si = i[i["season"] == s]
            sd = dec[dec["season"] == s]
            by_season.append({"season": s, "matches": int((m["season"] == s).sum()),
                              "avg_first_innings": _r(si[si.innings_number == 1]["runs"].mean()),
                              "avg_second_innings": _r(si[si.innings_number == 2]["runs"].mean()),
                              "highest_score": int(si["runs"].max()) if len(si) else None,
                              "bat_first_wins": int((sd["result"] == "bat_first").sum()),
                              "chase_wins": int((sd["result"] == "chase").sum())})
        teams = []
        for t in sorted(set(m.team1).union(m.team2)):
            rec = self._record(m, t)
            sc = self._scores(i, t)
            teams.append({"team": t, "matches": rec["matches"], "wins": rec["wins"], "losses": rec["losses"],
                          "win_pct": rec["win_pct"], "avg_runs": sc["avg_runs"],
                          "highest_score": sc["highest_score"]["runs"] if sc["highest_score"] else None})
        teams.sort(key=lambda r: -r["matches"])
        top = i.sort_values("runs", ascending=False).head(10)
        return clean({
            "venue": canon, "matches": int(len(m)), "first_season": min(m["season"], key=_season_key),
            "last_season": max(m["season"], key=_season_key),
            "avg_first_innings": _r(i1["runs"].mean()), "avg_second_innings": _r(i2["runs"].mean()),
            "highest_score": int(i["runs"].max()) if len(i) else None,
            "lowest_score": int(comp["runs"].min()) if len(comp) else None,
            "bat_first_wins": bf, "chase_wins": ch, "no_results": int(len(m) - len(dec)),
            "bat_first_win_pct": _pct(bf, bf + ch), "chase_win_pct": _pct(ch, bf + ch),
            "by_season": by_season, "team_performance": teams,
            "top_scores": [{"team": r.team, "against": r.opp, "season": r.season, "runs": int(r.runs), "wickets": int(r.wickets)} for r in top.itertuples()],
            "notes": ["Score statistics exclude DLS-affected matches; win percentages exclude no-result matches."]})

    # --------------------------------------------------------------- seasons
    def _season_row(self, s: str) -> dict:
        m, i = self.matches[self.matches["season"] == s], self.inn[self.inn["season"] == s]
        nd = i[~i["is_dls"]]
        return {"season": s, "matches": int(len(m)), "avg_first_innings": _r(nd[nd.innings_number == 1]["runs"].mean()),
                "avg_second_innings": _r(nd[nd.innings_number == 2]["runs"].mean()),
                "highest_score": int(nd["runs"].max()) if len(nd) else None, "total_runs": int(i["runs"].sum()),
                "total_wickets": int(i["wickets"].sum()),
                "run_rate": _r(i["runs"].sum() * 6 / i["balls"].sum()) if i["balls"].sum() else None}

    def seasons_summary(self, seasons: list[str] | None = None) -> dict:
        self.require()
        sel = [s for s in self.seasons if not seasons or s in seasons]
        m, i = self.matches[self.matches["season"].isin(sel)], self.inn[self.inn["season"].isin(sel)]
        nd = i[~i["is_dls"]]
        teams = []
        for t in sorted(set(m.team1).union(m.team2)):
            rec, sc = self._record(m, t), self._scores(i, t)
            teams.append({"team": t, "matches": rec["matches"], "wins": rec["wins"], "losses": rec["losses"],
                          "win_pct": rec["win_pct"], "avg_runs": sc["avg_runs"]})
        teams.sort(key=lambda r: (-r["wins"], -(r["win_pct"] or 0)))
        aggregate = {"matches": int(len(m)), "avg_first_innings": _r(nd[nd.innings_number == 1]["runs"].mean()),
                     "avg_second_innings": _r(nd[nd.innings_number == 2]["runs"].mean()),
                     "highest_score": int(nd["runs"].max()) if len(nd) else None, "total_runs": int(i["runs"].sum()),
                     "total_wickets": int(i["wickets"].sum()), "teams": teams}
        return clean({"seasons": [self._season_row(s) for s in sel], "all_seasons": self.seasons, "aggregate": aggregate})

    def season(self, s: str) -> dict:
        self.require()
        if s not in self.seasons:
            raise NotFound(f"Season '{s}' not found in the dataset.")
        m, i = self.matches[self.matches["season"] == s], self.inn[self.inn["season"] == s]
        rows = []
        for t in sorted(set(m.team1).union(m.team2)):
            rec, sc = self._record(m, t), self._scores(i, t)
            rows.append({"team": t, "matches": rec["matches"], "wins": rec["wins"], "losses": rec["losses"],
                         "no_results": rec["no_results"], "win_pct": rec["win_pct"], "avg_runs": sc["avg_runs"],
                         "highest_score": sc["highest_score"]["runs"] if sc["highest_score"] else None})
        rows.sort(key=lambda r: (-r["wins"], -(r["win_pct"] or 0)))
        return clean({**self._season_row(s), "teams": rows, "most_successful": rows[:3],
                      "notes": ["'Most successful' ranks teams by wins in the season; the dataset has no playoff/final stage column."]})

    # --------------------------------------------------------------- players
    def _batting(self, df: pd.DataFrame) -> pd.DataFrame:
        return df[df["batter"].notna()]

    def player_search(self, q: str, limit: int = 20) -> list[dict]:
        self.require()
        if "batter" not in self.balls.columns:
            return []
        b = self.balls
        bat = b.groupby("batter")["_legal"].sum()
        out: dict[str, dict] = {n: {"name": n, "balls_faced": int(v), "balls_bowled": 0} for n, v in bat.items()}
        if "bowler" in b.columns:
            for n, v in b.groupby("bowler")["_legal"].sum().items():
                out.setdefault(n, {"name": n, "balls_faced": 0, "balls_bowled": 0})["balls_bowled"] = int(v)
        rows = list(out.values())
        ql = q.strip().lower()
        if ql:
            rows = [r for r in rows if ql in r["name"].lower()]
        rows.sort(key=lambda r: -(r["balls_faced"] + r["balls_bowled"]))
        return clean(rows[:limit])

    def player(self, name: str, season: str | None = None) -> dict:
        self.require()
        b = self.balls
        if "batter" not in b.columns:
            raise DatasetUnavailable("Player analytics need the 'batter' column, which is not in the dataset.")
        exact = b["batter"] == name
        has_bowl = "bowler" in b.columns
        bowl_mask = (b["bowler"] == name) if has_bowl else pd.Series(False, index=b.index)
        if not exact.any() and not bowl_mask.any():
            raise NotFound(f"Player '{name}' not found in the dataset.")
        notes: list[str] = ["Balls faced / bowled count legal deliveries only (derived from legal_balls_bowled)."]
        bat_all, bowl_all = b[exact], b[bowl_mask]
        if season:
            bat_all, bowl_all = bat_all[bat_all["season"] == season], bowl_all[bowl_all["season"] == season]
        has_runs = "batter_runs" in b.columns
        out: dict[str, Any] = {"name": name, "season_filter": season, "batting": None, "bowling": None, "by_season": [], "notes": notes}
        dismissals_col = "player_dismissed" if "player_dismissed" in b.columns else None
        kind_col = "wicket_kind" if "wicket_kind" in b.columns else ("dismissal_kind" if "dismissal_kind" in b.columns else None)

        def batting_stats(d: pd.DataFrame, full: pd.DataFrame) -> dict | None:
            if d.empty or not has_runs:
                return None
            per = d.groupby(["match_id", "innings_number"]).agg(runs=("batter_runs", "sum"), balls=("_legal", "sum"))
            runs, balls = int(d["batter_runs"].sum()), int(d["_legal"].sum())
            res = {"innings": int(len(per)), "runs": runs, "balls_faced": balls, "strike_rate": _r(runs * 100 / balls) if balls else None,
                   "highest_score": int(per["runs"].max()), "fours": int((d["batter_runs"] == 4).sum()),
                   "sixes": int((d["batter_runs"] == 6).sum()), "fifties": int(((per["runs"] >= 50) & (per["runs"] < 100)).sum()),
                   "hundreds": int((per["runs"] >= 100).sum()), "average": None, "dismissals": None}
            if dismissals_col:
                dis = int((full[dismissals_col].astype("string").str.strip() == name).sum())
                res["dismissals"] = dis
                res["average"] = _r(runs / dis) if dis else None
            return res

        def bowling_stats(d: pd.DataFrame) -> dict | None:
            if d.empty or not has_bowl:
                return None
            balls = int(d["_legal"].sum())
            conceded = float(d["total_runs_this_ball"].sum())
            res = {"balls_bowled": balls, "overs": f"{balls // 6}.{balls % 6}", "runs_conceded": int(conceded),
                   "economy": _r(conceded * 6 / balls) if balls else None, "wickets": None, "best_figures": None, "average": None, "strike_rate": None}
            if kind_col and "wickets_this_ball" in d.columns:
                kinds = d[kind_col].astype("string").str.strip().str.lower()
                w = d[(d["wickets_this_ball"] > 0) & (~kinds.isin(NOT_BOWLER_WICKETS))]
                res["wickets"] = int(len(w))
                if len(w):
                    per = d.assign(_w=((d["wickets_this_ball"] > 0) & (~kinds.isin(NOT_BOWLER_WICKETS))).astype(int)).groupby(["match_id", "innings_number"]).agg(
                        w=("_w", "sum"), r=("total_runs_this_ball", "sum"))
                    best = per.sort_values(["w", "r"], ascending=[False, True]).iloc[0]
                    res["best_figures"] = f"{int(best['w'])}/{int(best['r'])}"
                    res["average"] = _r(conceded / len(w))
                    res["strike_rate"] = _r(balls / len(w))
            return res

        out["batting"] = batting_stats(bat_all, b[b["match_id"].isin(bat_all["match_id"])] if dismissals_col else bat_all)
        out["bowling"] = bowling_stats(bowl_all)
        if dismissals_col is None:
            notes.append("Batting average is hidden: the dataset has no 'player_dismissed' column, so dismissals cannot be attributed to the right batter.")
        if out["bowling"] and out["bowling"]["wickets"] is None:
            notes.append("Bowling wickets are hidden: the dataset has no dismissal-type column, so run-outs cannot be separated from bowler wickets.")
        if out["bowling"]:
            notes.append("Bowling economy uses total runs per delivery, which includes byes and leg-byes unless the dataset marks extras types, so it can be slightly high.")
        bat_s_all = b[exact]
        bowl_s_all = b[bowl_mask]
        seasons = sorted(set(bat_s_all["season"]).union(bowl_s_all["season"]), key=_season_key)
        for s in seasons:
            row: dict[str, Any] = {"season": s}
            bs = batting_stats(bat_s_all[bat_s_all["season"] == s], b[(b["season"] == s)] if dismissals_col else bat_s_all[bat_s_all["season"] == s])
            if bs:
                row.update({"runs": bs["runs"], "innings": bs["innings"], "balls_faced": bs["balls_faced"], "strike_rate": bs["strike_rate"],
                            "fours": bs["fours"], "sixes": bs["sixes"], "highest_score": bs["highest_score"], "average": bs["average"]})
            ws = bowling_stats(bowl_s_all[bowl_s_all["season"] == s])
            if ws:
                row.update({"wickets": ws["wickets"], "economy": ws["economy"], "balls_bowled": ws["balls_bowled"]})
            out["by_season"].append(row)
        teams = sorted(set(bat_s_all["batting_team"]).union(bowl_s_all["bowling_team"]))
        out["teams"] = teams
        return clean(out)


data_service = DataService()
