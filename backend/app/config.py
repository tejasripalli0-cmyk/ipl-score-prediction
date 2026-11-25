"""Application configuration, read from environment variables (and an optional .env file)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


def _resolve(value: str | None, default: Path) -> Path:
    if not value:
        return default
    p = Path(value)
    return p if p.is_absolute() else (BACKEND_DIR / p)


def _split(value: str | None, default: list[str]) -> list[str]:
    if not value:
        return default
    return [v.strip() for v in value.split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str
    version: str
    models_dir: Path
    dataset_path: Path
    data_dir: Path
    cors_origins: list[str]
    cors_origin_regex: str | None
    log_level: str


def get_settings() -> Settings:
    return Settings(
        app_name="IPL Insight API",
        version="1.0.0",
        models_dir=_resolve(os.getenv("MODELS_DIR"), BACKEND_DIR / "saved_models"),
        dataset_path=_resolve(os.getenv("DATASET_PATH"), BACKEND_DIR / "data" / "ball_by_ball_dataset.csv"),
        data_dir=BACKEND_DIR / "data",
        cors_origins=_split(
            os.getenv("CORS_ORIGINS"),
            ["http://localhost:5173", "http://127.0.0.1:5173"],
        ),
        cors_origin_regex=os.getenv("CORS_ORIGIN_REGEX") or None,
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
    )
