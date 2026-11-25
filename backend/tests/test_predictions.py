"""Integration tests against the REAL supplied model files."""
import numpy as np
import pandas as pd
import pytest

from app.models.registry import MODEL_FILES, registry

BASE = dict(batting_team="Mumbai Indians", bowling_team="Chennai Super Kings", venue="Wankhede Stadium, Mumbai",
            legal_balls_bowled=60, cumulative_runs=80, cumulative_wickets=2)
SECOND = dict(BASE, first_innings_score=170, cumulative_runs=79)


def test_model_files_present(client):
    from app.config import get_settings
    for f in MODEL_FILES.values():
        assert (get_settings().models_dir / f).exists()


def test_all_models_load_with_expected_types(client):
    assert registry.all_loaded, registry.errors
    assert registry.get("first_innings").algorithm == "RandomForestRegressor"
    assert registry.get("second_innings").algorithm == "LinearRegression"
    assert registry.get("win_probability").algorithm == "RandomForestClassifier"


def test_feature_names_and_no_leakage(client):
    first = registry.get("first_innings").features
    assert first == ["batting_team", "bowling_team", "venue", "over", "cumulative_runs", "cumulative_wickets",
                     "legal_balls_bowled", "current_run_rate", "balls_remaining"]
    for k in ("second_innings", "win_probability"):
        f = registry.get(k).features
        assert f[-5:] == ["first_innings_score", "target_runs", "target_overs", "runs_required", "required_run_rate"]
        assert not {"final_score", "winner"} & set(f)


def test_health(client):
    j = client.get("/health").json()
    assert j["status"] == "ok" and all(j["models"].values())


def test_first_innings_uses_first_innings_model(client):
    j = client.post("/predict/first-innings", json=BASE).json()
    lm = registry.get("first_innings")
    row = pd.DataFrame([dict(j["derived_features"])])[lm.features]
    direct = float(lm.model.predict(lm.preprocessor.transform(row))[0])
    assert j["raw_model_prediction"] == pytest.approx(direct, abs=0.01)
    assert j["predicted_final_score"] >= j["current_score"]
    assert j["range"]["low"] <= j["predicted_final_score"] <= j["range"]["high"] + 1e-6
    assert j["model"]["algorithm"].startswith("Random Forest")


def test_second_innings_uses_linear_model(client):
    j = client.post("/predict/second-innings", json=SECOND).json()
    lm = registry.get("second_innings")
    row = pd.DataFrame([dict(j["derived_features"])])[lm.features]
    direct = float(lm.model.predict(lm.preprocessor.transform(row))[0])
    assert j["raw_model_prediction"] == pytest.approx(direct, abs=0.01)
    assert j["runs_required"] == 92 and j["target_runs"] == 171
    assert j["required_run_rate"] == pytest.approx(9.2)


def test_win_probability_sums_to_100_and_uses_classifier(client):
    j = client.post("/predict/win-probability", json=SECOND).json()
    assert j["batting_win_probability"] + j["bowling_win_probability"] == pytest.approx(100.0)
    lm = registry.get("win_probability")
    row = pd.DataFrame([dict(j["derived_features"])])[lm.features]
    p = lm.model.predict_proba(lm.preprocessor.transform(row))[0][list(lm.model.classes_).index(1)]
    assert j["batting_win_probability"] == pytest.approx(p * 100, abs=0.06)


def test_win_probability_is_directionally_sensible(client):
    easy = client.post("/predict/win-probability", json=dict(SECOND, cumulative_runs=150, cumulative_wickets=2, legal_balls_bowled=100)).json()
    hard = client.post("/predict/win-probability", json=dict(SECOND, cumulative_runs=60, cumulative_wickets=8, legal_balls_bowled=100)).json()
    assert easy["batting_win_probability"] > 80 > 30 > hard["batting_win_probability"]


@pytest.mark.parametrize("patch,field", [
    (dict(cumulative_wickets=10), "cumulative_wickets"),
    (dict(legal_balls_bowled=120), "legal_balls_bowled"),
    (dict(bowling_team="Mumbai Indians"), "bowling_team"),
    (dict(batting_team="Not A Team"), "batting_team"),
    (dict(venue="Nowhere Park"), "venue"),
    (dict(cumulative_runs=400, legal_balls_bowled=12), "cumulative_runs"),
    (dict(current_run_rate=3.0), "current_run_rate"),
    (dict(balls_remaining=10), "balls_remaining"),
    (dict(over=15), "over"),
])
def test_first_innings_rejects_impossible_input(client, patch, field):
    r = client.post("/predict/first-innings", json=dict(BASE, **patch))
    assert r.status_code == 422
    assert r.json()["detail"]["field"] == field
    assert r.json()["detail"]["message"]


@pytest.mark.parametrize("patch,field", [
    (dict(cumulative_runs=171), "cumulative_runs"),            # target already reached
    (dict(cumulative_wickets=10), "cumulative_wickets"),       # all out
    (dict(legal_balls_bowled=120), "legal_balls_bowled"),      # overs finished
    (dict(runs_required=5), "runs_required"),
    (dict(required_run_rate=2.0), "required_run_rate"),
])
def test_second_innings_and_win_reject_impossible_input(client, patch, field):
    for url in ("/predict/second-innings", "/predict/win-probability"):
        r = client.post(url, json=dict(SECOND, **patch))
        assert r.status_code == 422, (url, r.json())
        assert r.json()["detail"]["field"] == field


def test_historical_team_names_are_accepted(client):
    j = client.post("/predict/first-innings", json=dict(BASE, bowling_team="Pune Warriors India")).json()
    assert j["derived_features"]["bowling_team"] == "Pune Warriors"


def test_venue_variant_choice(client):
    a = client.post("/predict/first-innings", json=dict(BASE, venue_variant="Wankhede Stadium")).json()
    b = client.post("/predict/first-innings", json=BASE).json()
    assert a["derived_features"]["venue"] == "Wankhede Stadium"
    assert a["warnings"] == [] and any("spellings" in w for w in b["warnings"])


def test_unseen_venue_option(client):
    r = client.post("/predict/first-innings", json=dict(BASE, venue="__other__"))
    assert r.status_code == 200 and any("not in the model" in w for w in r.json()["warnings"])


def test_options_and_insights(client):
    o = client.get("/meta/options").json()
    assert len(o["teams"]) == 15 and any(v["name"] == "Wankhede Stadium, Mumbai" for v in o["venues"])
    ins = client.get("/meta/model-insights").json()
    assert ins["metrics"]["first_innings"]["mae"] == 19.65
    assert abs(sum(r["importance"] for r in ins["models"]["first_innings"]["feature_importance"]) - 1) < 1e-6
    assert ins["shap"] is None  # never invented


def test_analytics_report_dataset_missing_cleanly(client):
    from app.services.data_service import data_service
    data_service.loaded, data_service.load_error = False, "Dataset file not found."
    r = client.get("/analytics/team/Mumbai Indians")
    assert r.status_code == 503 and r.json()["detail"]["code"] == "dataset_unavailable"
    assert client.get("/analytics/seasons").json() == []
