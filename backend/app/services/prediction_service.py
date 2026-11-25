"""Builds model inputs, validates match situations and runs the saved models."""
from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

from ..models.registry import ModelRegistry
from ..utils.teams import CANONICAL_TEAMS, franchise_info, normalize_team
from ..utils.venues import OTHER_VENUE, canonical_venue, raw_variants

UNKNOWN = "__unseen__"  # all-zero one-hot (the saved encoders use handle_unknown='ignore')
MAX_BALLS = 120


class PredictionInputError(ValueError):
    def __init__(self, message: str, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.field = field


def _overs_text(balls: int) -> str:
    return f"{balls // 6}.{balls % 6}"


# Feature groups used for the what-if (occlusion) explanation.
GROUPS_FIRST = {
    "Teams": ["batting_team", "bowling_team"],
    "Venue": ["venue"],
    "Runs scored so far": ["cumulative_runs"],
    "Scoring pace": ["current_run_rate"],
    "Wickets lost": ["cumulative_wickets"],
    "Overs bowled / remaining": ["over", "legal_balls_bowled", "balls_remaining"],
}
GROUPS_SECOND = {
    "Teams": ["batting_team", "bowling_team"],
    "Venue": ["venue"],
    "Target set": ["first_innings_score", "target_runs", "target_overs"],
    "Runs scored so far": ["cumulative_runs"],
    "Runs still required": ["runs_required"],
    "Scoring pace": ["current_run_rate"],
    "Required rate": ["required_run_rate"],
    "Wickets lost": ["cumulative_wickets"],
    "Overs bowled / remaining": ["over", "legal_balls_bowled", "balls_remaining"],
}


class PredictionService:
    def __init__(self, registry: ModelRegistry, data_service=None):
        self.reg = registry
        self.data = data_service

    # ------------------------------------------------------------------ options
    def options(self) -> dict:
        cats = self.reg.categories("win_probability")
        teams = []
        for name in CANONICAL_TEAMS:
            if name in cats["batting_team"]:
                info = franchise_info(name) or {}
                teams.append({"name": name, "display_name": info.get("display_name", name),
                              "short": info.get("short", name[:3].upper()), "active": info.get("active", False)})
        raw = cats["venue"]
        seen: dict[str, list[str]] = {}
        for r in raw:
            seen.setdefault(canonical_venue(r) or r, []).append(r)
        venues = [{"name": c, "model_variant": self.model_venue(c), "variants": v} for c, v in sorted(seen.items())]
        return {"teams": teams, "venues": venues, "other_venue": OTHER_VENUE}

    def model_venue(self, canonical: str) -> str:
        """Raw spelling to feed the model for a canonical venue."""
        available = self.reg.categories("win_probability")["venue"]
        variants = raw_variants(canonical, available)
        if not variants:
            return UNKNOWN
        if len(variants) == 1:
            return variants[0]
        if self.data is not None and self.data.loaded:
            latest = self.data.latest_raw_variant(variants)
            if latest:
                return latest
        return max(variants, key=len)  # newest Cricsheet spelling carries the city suffix

    # --------------------------------------------------------------- validation
    def _teams_and_venue(self, bat: str, bowl: str, venue: str, variant: str | None = None) -> tuple[str, str, str, list[str]]:
        warnings: list[str] = []
        cats = self.reg.categories("win_probability")
        b, w = normalize_team(bat), normalize_team(bowl)
        for fld, val in (("batting_team", b), ("bowling_team", w)):
            if val not in cats["batting_team"]:
                raise PredictionInputError(f"'{val}' is not a franchise the models were trained on.", fld)
        if b == w:
            raise PredictionInputError("Batting and bowling team must be different.", "bowling_team")
        raw_cats = cats["venue"]
        if venue == OTHER_VENUE:
            warnings.append("Venue not in the model's training data: the venue is treated as unknown, so venue effects are ignored.")
            raw_v = UNKNOWN
        elif variant:
            if variant not in raw_cats:
                raise PredictionInputError(f"'{variant}' is not a venue spelling the models know.", "venue_variant")
            if canonical_venue(variant) != canonical_venue(venue):
                raise PredictionInputError("venue_variant does not belong to the selected venue.", "venue_variant")
            raw_v = variant  # an exact model spelling was chosen explicitly
        elif venue in raw_cats and venue != canonical_venue(venue):
            raw_v = venue  # a non-canonical raw spelling was passed directly
        else:
            canon = canonical_venue(venue)
            raw_v = self.model_venue(canon) if canon else UNKNOWN
            if raw_v == UNKNOWN:
                raise PredictionInputError(
                    f"Venue '{venue}' is not known to the models. Pick one from /meta/options or use '{OTHER_VENUE}'.", "venue")
            n = len(raw_variants(canon, raw_cats))
            if n > 1:
                warnings.append(
                    f"This ground appears under {n} different spellings in the training data and the models treat them as separate venues, "
                    f"which can shift predictions. The spelling '{raw_v}' was used; you can choose another in the venue spelling option.")
        return b, w, raw_v, warnings

    def _base_state(self, req) -> tuple[dict, list[str]]:
        balls, runs, wkts = req.legal_balls_bowled, req.cumulative_runs, req.cumulative_wickets
        warnings: list[str] = []
        if runs > 8 * balls:
            raise PredictionInputError(
                f"{runs} runs from {balls} legal balls is not realistic (more than 8 per ball).", "cumulative_runs")
        derived_over = (balls - 1) // 6
        over = derived_over
        if req.over is not None:
            if abs(req.over - derived_over) > 1:
                raise PredictionInputError(
                    f"Over {req.over} is inconsistent with {balls} legal balls (expected about {derived_over}).", "over")
            over = req.over
        crr = runs * 6 / balls
        if req.current_run_rate is not None and abs(req.current_run_rate - crr) > 0.06:
            raise PredictionInputError(
                f"Current run rate {req.current_run_rate} does not match {runs} runs from {balls} balls ({crr:.2f}).",
                "current_run_rate")
        return {"over": over, "cumulative_runs": runs, "cumulative_wickets": wkts,
                "legal_balls_bowled": balls, "current_run_rate": crr}, warnings

    def _early_warning(self, balls: int, warnings: list[str]) -> None:
        if balls < 12:
            warnings.append("Fewer than two overs have been bowled, so there is little evidence to project from; expect a wide margin of error.")

    # ----------------------------------------------------------- explanations
    def _occlusion(self, key: str, row: dict, groups: dict, scale: float, unit: str, class_idx: int | None = None) -> list[dict]:
        lm = self.reg.get(key)
        base = self._predict_raw(key, row, class_idx)
        out = []
        for label, cols in groups.items():
            alt = dict(row)
            for c in cols:
                alt[c] = UNKNOWN if c in lm.cat_cols else lm.num_means[c]
            impact = (base - self._predict_raw(key, alt, class_idx)) * scale
            out.append((label, impact))
        out.sort(key=lambda t: -abs(t[1]))
        res = []
        for label, imp in out[:6]:
            res.append({
                "factor": label, "impact": round(float(imp), 2), "unit": unit,
                "direction": "up" if imp > 0.05 else "down" if imp < -0.05 else "neutral",
                "description": (f"Compared with an average value for '{label.lower()}', the model's output is "
                                f"{abs(imp):.1f} {unit} {'higher' if imp > 0 else 'lower'}."
                                if abs(imp) > 0.05 else f"'{label}' has almost no effect relative to an average situation."),
            })
        return res

    def _frame(self, key: str, row: dict) -> pd.DataFrame:
        lm = self.reg.get(key)
        return pd.DataFrame([{f: row[f] for f in lm.features}])

    def _predict_raw(self, key: str, row: dict, class_idx: int | None = None) -> float:
        lm = self.reg.get(key)
        Xt = self.reg.transform(key, self._frame(key, row))
        if class_idx is not None:
            return float(lm.model.predict_proba(Xt)[0][class_idx])
        return float(lm.model.predict(Xt)[0])

    def _model_info(self, key: str) -> dict:
        lm = self.reg.get(key)
        mt = self.reg.metrics.get(key, {})
        return {"name": mt.get("label", key), "algorithm": mt.get("algorithm", lm.algorithm),
                "test_season": self.reg.metrics.get("evaluation_season", "2025"),
                "metrics": {k: v for k, v in mt.items() if k in {"mae", "rmse", "r2", "accuracy", "roc_auc"}}}

    # -------------------------------------------------------------- first innings
    def predict_first(self, req) -> dict:
        bat, bowl, venue, warnings = self._teams_and_venue(req.batting_team, req.bowling_team, req.venue, req.venue_variant)
        balls, wkts = req.legal_balls_bowled, req.cumulative_wickets
        if wkts >= 10:
            raise PredictionInputError("All 10 wickets have fallen - the innings is over, so there is nothing to predict.", "cumulative_wickets")
        if balls >= MAX_BALLS:
            raise PredictionInputError("All 20 overs have been bowled - the innings is already complete.", "legal_balls_bowled")
        state, w2 = self._base_state(req)
        warnings += w2
        remaining = MAX_BALLS - balls
        if req.balls_remaining is not None and req.balls_remaining != remaining:
            raise PredictionInputError(f"Balls remaining should be {remaining} for {balls} balls bowled.", "balls_remaining")
        self._early_warning(balls, warnings)
        row = {"batting_team": bat, "bowling_team": bowl, "venue": venue, **state, "balls_remaining": remaining}

        lm = self.reg.get("first_innings")
        Xt = self.reg.transform("first_innings", self._frame("first_innings", row))
        raw = float(lm.model.predict(Xt)[0])
        trees = np.array([t.predict(Xt.astype(np.float32))[0] for t in lm.model.estimators_])
        lo, hi = float(np.percentile(trees, 10)), float(np.percentile(trees, 90))
        runs = req.cumulative_runs
        final = max(raw, runs)
        adjusted = raw < runs
        lo, hi = max(lo, runs), max(hi, runs)
        crr = state["current_run_rate"]
        projected = runs + crr * remaining / 6
        if crr > 14:
            warnings.append("The scoring rate is far above anything sustainable over a full innings; treat the projection with caution.")
        factors = self._occlusion("first_innings", row, GROUPS_FIRST, 1.0, "runs")
        rmse = self.reg.metrics.get("first_innings", {}).get("rmse")
        summary = (f"At {runs}/{wkts} after {_overs_text(balls)} overs ({crr:.2f} an over), the Random Forest model projects "
                   f"{bat} to finish on about {final:.0f}. Simply continuing at the current rate would give {projected:.0f}.")
        return {
            "predicted_final_score": round(final, 1), "raw_model_prediction": round(raw, 2),
            "adjusted_to_current_score": adjusted, "current_score": runs, "current_wickets": wkts,
            "current_run_rate": round(crr, 2), "balls_remaining": remaining, "overs_bowled": _overs_text(balls),
            "projected_at_current_rate": round(projected, 1),
            "range": {"low": round(lo, 1), "high": round(hi, 1), "method": "forest_spread",
                      "description": ("Middle 80% of the 200 individual trees' predictions. This shows how much the trees disagree; "
                                      f"it is not a guaranteed interval. Typical 2025 test error was about {rmse} runs (RMSE).")},
            "derived_features": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in row.items()},
            "factors": factors, "summary": summary, "warnings": warnings, "model": self._model_info("first_innings"),
        }

    # ------------------------------------------------------------ second innings
    def _second_state(self, req) -> tuple[dict, list[str]]:
        bat, bowl, venue, warnings = self._teams_and_venue(req.batting_team, req.bowling_team, req.venue, req.venue_variant)
        state, w2 = self._base_state(req)
        warnings += w2
        balls, runs, wkts = req.legal_balls_bowled, req.cumulative_runs, req.cumulative_wickets
        total_balls = round(req.target_overs * 6)
        if total_balls < 6:
            raise PredictionInputError("Target overs must be at least 1.", "target_overs")
        target = req.target_runs if req.target_runs is not None else req.first_innings_score + 1
        if target != req.first_innings_score + 1:
            warnings.append("Target differs from first-innings score + 1 (for example a DLS-revised target); the models only see the numbers you supply.")
        if balls >= total_balls:
            raise PredictionInputError("The chasing team's overs are exhausted - the innings is complete.", "legal_balls_bowled")
        remaining = total_balls - balls
        if req.balls_remaining is not None and req.balls_remaining != remaining:
            raise PredictionInputError(f"Balls remaining should be {remaining}.", "balls_remaining")
        required = target - runs
        if req.runs_required is not None and req.runs_required != required:
            raise PredictionInputError(f"Runs required should be {required} (target {target} minus {runs} scored).", "runs_required")
        if required <= 0:
            raise PredictionInputError(f"The target of {target} has already been reached - {bat} have won.", "cumulative_runs")
        if wkts >= 10:
            raise PredictionInputError(f"All out - {bowl} have won, so there is nothing left to predict.", "cumulative_wickets")
        rrr = required * 6 / remaining
        if req.required_run_rate is not None and abs(req.required_run_rate - rrr) > 0.06:
            raise PredictionInputError(f"Required run rate should be {rrr:.2f}.", "required_run_rate")
        if rrr > 36:
            warnings.append("The required rate is extremely high; the models have very little precedent for situations like this.")
        self._early_warning(balls, warnings)
        row = {"batting_team": bat, "bowling_team": bowl, "venue": venue, **state,
               "balls_remaining": remaining, "first_innings_score": req.first_innings_score,
               "target_runs": target, "target_overs": float(req.target_overs),
               "runs_required": required, "required_run_rate": rrr}
        return row, warnings

    def predict_second(self, req) -> dict:
        row, warnings = self._second_state(req)
        raw = self._predict_raw("second_innings", row)
        runs, target = row["cumulative_runs"], row["target_runs"]
        final = max(raw, runs)
        crr, remaining = row["current_run_rate"], row["balls_remaining"]
        projected = runs + crr * remaining / 6
        rmse = self.reg.metrics.get("second_innings", {}).get("rmse", 19.23)
        factors = self._occlusion("second_innings", row, GROUPS_SECOND, 1.0, "runs")
        margin = final - target
        verdict = (f"on course to reach the target by about {margin:.0f} runs" if margin >= 0
                   else f"expected to fall about {abs(margin):.0f} runs short of the target")
        summary = (f"{row['batting_team']} need {row['runs_required']} from {remaining} balls "
                   f"(required rate {row['required_run_rate']:.2f}). The linear model predicts a final score of about {final:.0f}, "
                   f"{verdict} of {target}.")
        return {
            "predicted_final_score": round(final, 1), "raw_model_prediction": round(raw, 2),
            "adjusted_to_current_score": raw < runs, "target_runs": target, "first_innings_score": row["first_innings_score"],
            "current_score": runs, "current_wickets": row["cumulative_wickets"], "current_run_rate": round(crr, 2),
            "required_run_rate": round(row["required_run_rate"], 2), "runs_required": row["runs_required"],
            "balls_remaining": remaining, "overs_bowled": _overs_text(row["legal_balls_bowled"]),
            "projected_at_current_rate": round(projected, 1), "predicted_margin_vs_target": round(margin, 1),
            "range": {"low": round(max(final - rmse, runs), 1), "high": round(final + rmse, 1), "method": "historical_rmse",
                      "description": f"The model's predicted score plus or minus its typical 2025 test error (RMSE {rmse} runs). This is an indicative band, not a guaranteed interval."},
            "derived_features": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in row.items()},
            "factors": factors, "summary": summary, "warnings": warnings, "model": self._model_info("second_innings"),
        }

    # ------------------------------------------------------------- win probability
    def predict_win(self, req) -> dict:
        row, warnings = self._second_state(req)
        lm = self.reg.get("win_probability")
        classes = list(lm.model.classes_)
        idx = classes.index(1)  # class 1 = chasing (batting) team wins
        p_bat = self._predict_raw("win_probability", row, idx)
        bat_pct = round(p_bat * 100, 1)
        bowl_pct = round(100 - bat_pct, 1)
        factors = self._occlusion("win_probability", row, GROUPS_SECOND, 100.0, "percentage points", idx)
        leader = row["batting_team"] if bat_pct >= 50 else row["bowling_team"]
        summary = (f"{row['batting_team']} need {row['runs_required']} from {row['balls_remaining']} balls with "
                   f"{10 - row['cumulative_wickets']} wickets in hand (required rate {row['required_run_rate']:.2f}). "
                   f"The model gives {leader} the edge: {row['batting_team']} {bat_pct}% vs {row['bowling_team']} {bowl_pct}%.")
        return {
            "batting_team": row["batting_team"], "bowling_team": row["bowling_team"],
            "batting_win_probability": bat_pct, "bowling_win_probability": bowl_pct,
            "target_runs": row["target_runs"], "runs_required": row["runs_required"], "balls_remaining": row["balls_remaining"],
            "current_score": row["cumulative_runs"], "current_wickets": row["cumulative_wickets"],
            "current_run_rate": round(row["current_run_rate"], 2), "required_run_rate": round(row["required_run_rate"], 2),
            "overs_bowled": _overs_text(row["legal_balls_bowled"]),
            "derived_features": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in row.items()},
            "factors": factors, "summary": summary, "warnings": warnings,
            "disclaimer": "This is a statistical estimate from a model trained on past IPL matches. It is not a guarantee and does not know about injuries, dew, pitch changes or individual batters.",
            "model": self._model_info("win_probability"),
        }
