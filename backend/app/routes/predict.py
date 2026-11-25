from fastapi import APIRouter, HTTPException

from ..deps import prediction_service as svc
from ..schemas.prediction import (FirstInningsRequest, FirstInningsResponse, SecondInningsRequest,
                                  SecondInningsResponse, WinProbabilityResponse)
from ..services.prediction_service import PredictionInputError

router = APIRouter(prefix="/predict", tags=["prediction"])


def _run(fn, req):
    try:
        return fn(req)
    except PredictionInputError as exc:
        raise HTTPException(status_code=422, detail={"message": exc.message, "field": exc.field})
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail={"message": f"Model unavailable: {exc}", "field": None})


@router.post("/first-innings", response_model=FirstInningsResponse)
def first_innings(req: FirstInningsRequest):
    """Final first-innings score from the saved Random Forest regressor."""
    return _run(svc.predict_first, req)


@router.post("/second-innings", response_model=SecondInningsResponse)
def second_innings(req: SecondInningsRequest):
    """Final second-innings score from the saved Linear Regression model."""
    return _run(svc.predict_second, req)


@router.post("/win-probability", response_model=WinProbabilityResponse)
def win_probability(req: SecondInningsRequest):
    """Chasing team's win probability from the saved Random Forest classifier."""
    return _run(svc.predict_win, req)
