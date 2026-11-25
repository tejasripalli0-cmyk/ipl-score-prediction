"""Analytics tests on the synthetic fixture, with answers computed by hand from fixture_data.MATCHES."""
import pytest

from app.services.data_service import data_service as ds


def test_status_and_cleaning(frame):
    s = ds.status()
    assert s["matches"] == 7 and s["seasons"] == ["2008", "2009", "2020/21", "2021"]
    assert any("duplicate" in n for n in s["notes"])
    assert any("super-over" in n for n in s["notes"])
    assert set(ds.team_names()) >= {"Delhi Capitals", "Punjab Kings"}  # historical names normalised
    assert not ({"Delhi Daredevils", "Kings XI Punjab"} & set(ds.team_names()))


def test_deduplication_does_not_change_totals(frame):
    inn = ds.inn[(ds.inn.match_id == "m1") & (ds.inn.innings_number == 1)].iloc[0]
    assert inn.runs == 160 and inn.balls == 120 and inn.wickets == 5


def test_super_over_ignored(frame):
    m5 = ds.matches[ds.matches.match_id == "m5"].iloc[0]
    assert (m5.score1, m5.score2) == (150, 150)
    assert bool(m5.tied)


def test_team_records_use_correct_definitions(frame):
    mi, csk = ds._record(ds.matches, "Mumbai Indians"), ds._record(ds.matches, "Chennai Super Kings")
    assert (mi["matches"], mi["wins"], mi["losses"], mi["no_results"], mi["win_pct"]) == (5, 4, 0, 1, 100.0)
    assert (csk["matches"], csk["wins"], csk["losses"], csk["win_pct"]) == (4, 1, 3, 25.0)  # DLS win still a win
    dc = ds._record(ds.matches, "Delhi Capitals")
    assert (dc["matches"], dc["wins"], dc["losses"], dc["no_results"], dc["super_over_or_tied"]) == (3, 1, 1, 1, 1)
    pk = ds._record(ds.matches, "Punjab Kings")
    assert (pk["wins"], pk["losses"]) == (0, 2)


def test_no_result_is_not_a_loss(frame):
    m4 = ds.matches[ds.matches.match_id == "m4"].iloc[0]
    assert m4.result == "no_result"


def test_batting_first_vs_chasing(frame):
    mi = ds._record(ds.matches, "Mumbai Indians")
    assert (mi["bat_first_matches"], mi["bat_first_wins"]) == (2, 2)   # m1, m7 (m4 no result)
    assert (mi["chase_matches"], mi["chase_wins"]) == (2, 2)           # m2, m3


def test_score_stats_exclude_dls_and_incomplete_chases(frame):
    sc = ds._scores(ds.inn, "Mumbai Indians")
    assert sc["highest_score"]["runs"] == 200
    assert sc["lowest_score"]["runs"] == 160          # 171/141/50 innings did not run their course
    csk = ds._scores(ds.inn, "Chennai Super Kings")
    assert csk["highest_score"]["runs"] == 190        # the 180 in the DLS match is excluded
    assert ds._scores(ds.inn, "Delhi Capitals")["lowest_score"]["runs"] == 140


def test_venue_variants_merge(frame):
    names = {v["name"]: v["matches"] for v in ds.venue_list()}
    assert names["Wankhede Stadium, Mumbai"] == 4          # m1, m2, m4, m7
    assert names["Arun Jaitley Stadium, Delhi"] == 3       # m3 (Feroz Shah Kotla), m5, m6


def test_venue_endpoint(frame, client):
    j = client.get("/analytics/venue/Wankhede Stadium, Mumbai").json()
    assert j["matches"] == 4 and (j["bat_first_wins"], j["chase_wins"]) == (2, 1)
    assert j["bat_first_win_pct"] == 66.7 and j["chase_win_pct"] == 33.3
    assert j["avg_first_innings"] == 145.0 and j["avg_second_innings"] == pytest.approx(170.33)
    assert j["highest_score"] == 200 and j["no_results"] == 1
    assert client.get("/analytics/venue/Wankhede Stadium").json()["matches"] == 4   # raw spelling resolves too
    assert client.get("/analytics/venue/Nowhere").status_code == 404


def test_team_endpoint(frame, client):
    j = client.get("/analytics/team/Mumbai Indians").json()
    assert j["summary"]["wins"] == 4 and len(j["by_season"]) == 3
    s2008 = next(r for r in j["by_season"] if r["season"] == "2008")
    assert (s2008["matches"], s2008["wins"]) == (2, 2)
    assert {r["opponent"] for r in j["vs_opponents"]} == {"Chennai Super Kings", "Delhi Capitals"}
    assert client.get("/analytics/team/Delhi Daredevils").status_code == 200   # old name resolves
    assert client.get("/analytics/team/Mumbai Indians", params={"season": "2021"}).json()["summary"]["matches"] == 1
    assert client.get("/analytics/team/Nobody").status_code == 404


def test_team_comparison(frame, client):
    r = client.get("/analytics/team-comparison", params={"teams": ["Mumbai Indians", "Chennai Super Kings"]})
    j = r.json()
    h = j["head_to_head"][0]
    assert (h["matches"], h["a_wins"], h["b_wins"]) == (3, 3, 0)
    assert len(j["radar"]) == 6 and "season_series" in j
    f = client.get("/analytics/team-comparison", params={"teams": ["Mumbai Indians", "Chennai Super Kings"], "venue": "Wankhede Stadium", "season": ["2008"]}).json()
    assert f["head_to_head"][0]["matches"] == 2
    assert client.get("/analytics/team-comparison", params={"teams": ["Mumbai Indians"]}).status_code == 422


def test_season_endpoints(frame, client):
    s = client.get("/analytics/season/2020/21").json()      # season names contain a slash
    assert s["matches"] == 2 and s["total_runs"] == 580
    assert s["total_wickets"] == 5 + 6 + 3 + 2
    assert s["avg_first_innings"] == 150.0               # DLS match excluded from averages
    summ = client.get("/analytics/seasons/summary", params={"seasons": ["2008", "2021"]}).json()
    assert [r["season"] for r in summ["seasons"]] == ["2008", "2021"]
    assert client.get("/analytics/season/1999").status_code == 404


def test_player_stats(frame, client):
    d = frame[(frame.innings_number.isin([1, 2]))]
    kohli = d[d.batter == "V Kohli"]
    j = client.get("/analytics/player/V Kohli").json()
    assert j["batting"]["runs"] == int(kohli.batter_runs.sum())
    legal = (kohli.extras_runs == 0).sum()   # wide rows (extras_runs=1) are not legal balls faced
    assert j["batting"]["balls_faced"] == int(legal)
    assert j["batting"]["strike_rate"] == pytest.approx(round(kohli.batter_runs.sum() * 100 / legal, 2))
    assert j["batting"]["dismissals"] == int((kohli.player_dismissed == "V Kohli").sum())
    # run-outs are not credited to the bowler
    bum = d[d.bowler == "J Bumrah"]
    expected = int(((bum.wickets_this_ball > 0) & (bum.wicket_kind != "run out")).sum())
    jb = client.get("/analytics/player/J Bumrah").json()
    assert jb["bowling"]["wickets"] == expected
    assert client.get("/analytics/player/Nobody").status_code == 404
    assert any(p["name"] == "V Kohli" for p in client.get("/analytics/players", params={"q": "koh"}).json())


def test_missing_columns_reported(tmp_path):
    from app.services.data_service import DataService
    p = tmp_path / "bad.csv"
    p.write_text("match_id,season\n1,2020\n")
    svc = DataService()
    svc.load(p)
    assert not svc.loaded and "missing required column" in svc.load_error


def test_prediction_uses_latest_venue_spelling_from_dataset(frame):
    from app.deps import prediction_service as svc
    # In the fixture "Wankhede Stadium" last appears in 2009 and "Wankhede Stadium, Mumbai" in 2021.
    assert svc.model_venue("Wankhede Stadium, Mumbai") == "Wankhede Stadium, Mumbai"
    assert ds.latest_raw_variant(["Wankhede Stadium", "Wankhede Stadium, Mumbai"]) == "Wankhede Stadium, Mumbai"
    assert ds.latest_raw_variant(["Feroz Shah Kotla", "Arun Jaitley Stadium, Delhi"]) == "Arun Jaitley Stadium, Delhi"
