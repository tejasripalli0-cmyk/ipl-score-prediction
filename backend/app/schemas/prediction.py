from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class _Base(BaseModel):
    batting_team: str = Field(..., examples=["Mumbai Indians"])
    bowling_team: str = Field(..., examples=["Chennai Super Kings"])
    venue: str = Field(..., examples=["Wankhede Stadium, Mumbai"],
                       description="Canonical venue name from /meta/options, or '__other__' for a venue the models have not seen.")
    venue_variant: Optional[str] = Field(None, description="Optional exact venue spelling (see /meta/options) - the saved models treat spellings of the same ground as different venues.")
    legal_balls_bowled: int = Field(..., ge=1, le=120, description="Legal deliveries bowled so far in this innings.")
    cumulative_runs: int = Field(..., ge=0, le=500, description="Runs scored so far in this innings.")
    cumulative_wickets: int = Field(..., ge=0, le=10)
    # Derived values - optional. If supplied they are validated against the primary inputs.
    over: Optional[int] = Field(None, ge=0, le=19, description="Over in progress, 0-indexed (dataset convention).")
    current_run_rate: Optional[float] = Field(None, ge=0)
    balls_remaining: Optional[int] = Field(None, ge=0, le=120)


class FirstInningsRequest(_Base):
    pass


class SecondInningsRequest(_Base):
    first_innings_score: int = Field(..., ge=1, le=500)
    target_runs: Optional[int] = Field(None, ge=1, le=600, description="Defaults to first_innings_score + 1.")
    target_overs: float = Field(20, gt=0, le=20)
    runs_required: Optional[int] = None
    required_run_rate: Optional[float] = Field(None, ge=0)


class RangeInfo(BaseModel):
    low: float
    high: float
    method: str
    description: str


class Factor(BaseModel):
    factor: str
    impact: float
    unit: str
    direction: str
    description: str


class ModelInfo(BaseModel):
    name: str
    algorithm: str
    test_season: str
    metrics: dict


class FirstInningsResponse(BaseModel):
    predicted_final_score: float
    raw_model_prediction: float
    adjusted_to_current_score: bool
    current_score: int
    current_wickets: int
    current_run_rate: float
    balls_remaining: int
    overs_bowled: str
    projected_at_current_rate: float
    range: RangeInfo
    derived_features: dict
    factors: list[Factor]
    summary: str
    warnings: list[str]
    model: ModelInfo


class SecondInningsResponse(BaseModel):
    predicted_final_score: float
    raw_model_prediction: float
    adjusted_to_current_score: bool
    target_runs: int
    first_innings_score: int
    current_score: int
    current_wickets: int
    current_run_rate: float
    required_run_rate: float
    runs_required: int
    balls_remaining: int
    overs_bowled: str
    projected_at_current_rate: float
    predicted_margin_vs_target: float
    range: RangeInfo
    derived_features: dict
    factors: list[Factor]
    summary: str
    warnings: list[str]
    model: ModelInfo


class WinProbabilityResponse(BaseModel):
    batting_team: str
    bowling_team: str
    batting_win_probability: float
    bowling_win_probability: float
    target_runs: int
    runs_required: int
    balls_remaining: int
    current_score: int
    current_wickets: int
    current_run_rate: float
    required_run_rate: float
    overs_bowled: str
    derived_features: dict
    factors: list[Factor]
    summary: str
    warnings: list[str]
    disclaimer: str
    model: ModelInfo
