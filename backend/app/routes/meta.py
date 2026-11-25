import json

from fastapi import APIRouter, HTTPException

from ..config import get_settings
from ..deps import prediction_service as svc
from ..models.registry import registry

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/options")
def options() -> dict:
    """Teams and venues the prediction models understand."""
    try:
        return svc.options()
    except RuntimeError as exc:
        raise HTTPException(503, detail={"message": f"Models unavailable: {exc}"})


def _optional_report() -> dict:
    p = get_settings().data_dir / "model_report.json"
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


@router.get("/model-insights")
def model_insights() -> dict:
    """Metrics (from the Colab evaluation), plus feature importance read directly from the loaded models."""
    report = _optional_report()
    out: dict = {"metrics": registry.metrics, "models": {}, "model_comparison": report.get("model_comparison"),
                 "shap": report.get("shap"), "dataset_overview": report.get("dataset_overview")}
    for key in ("first_innings", "second_innings", "win_probability"):
        if key not in registry.models:
            continue
        entry = {"info": registry.describe(key)}
        if key == "second_innings":
            entry["coefficients"] = registry.numeric_coefficients(key)
        else:
            entry["feature_importance"] = registry.feature_importance(key)
        out["models"][key] = entry
    return out
