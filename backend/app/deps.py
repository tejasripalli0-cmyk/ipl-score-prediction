"""Shared singletons (created once at start-up)."""
from __future__ import annotations

from .models.registry import registry
from .services.data_service import data_service
from .services.prediction_service import PredictionService

prediction_service = PredictionService(registry, data_service)
