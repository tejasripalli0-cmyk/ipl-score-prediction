import platform

import sklearn
from fastapi import APIRouter

from ..models.registry import MODEL_FILES, registry
from ..services.data_service import data_service

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok" if registry.all_loaded else "degraded",
        "models": {k: (k in registry.models) for k in MODEL_FILES},
        "model_errors": registry.errors,
        "dataset_loaded": data_service.loaded,
        "versions": {"python": platform.python_version(), "scikit_learn": sklearn.__version__},
    }
