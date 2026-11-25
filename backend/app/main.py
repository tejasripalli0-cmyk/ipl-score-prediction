"""FastAPI application entry point."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .models.registry import registry
from .routes import analytics, health, meta, predict
from .services.data_service import data_service

settings = get_settings()
logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("ipl")


@asynccontextmanager
async def lifespan(_: FastAPI):
    registry.load(settings.models_dir)          # models are loaded once
    data_service.load(settings.dataset_path)    # dataset is processed once
    if not registry.all_loaded:
        log.error("Some models failed to load: %s", registry.errors)
    if not data_service.loaded:
        log.warning("Analytics unavailable: %s", data_service.load_error)
    yield


app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan,
              description="Score prediction, win probability and historical IPL analytics.")

app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origins, allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=False, allow_methods=["*"], allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    errs = exc.errors()
    first = errs[0] if errs else {}
    loc = [str(p) for p in first.get("loc", []) if p != "body"]
    field = loc[-1] if loc else None
    msg = first.get("msg", "Invalid input")
    return JSONResponse(status_code=422, content={"detail": {
        "message": f"{field}: {msg}" if field else msg, "field": field,
        "errors": [{"field": ".".join(str(p) for p in e.get("loc", []) if p != "body"), "message": e.get("msg")} for e in errs]}})


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"detail": {"message": "Unexpected server error."}})


app.include_router(health.router)
app.include_router(meta.router)
app.include_router(predict.router)
app.include_router(analytics.router)


@app.get("/", include_in_schema=False)
def root():
    return {"name": settings.app_name, "docs": "/docs", "health": "/health"}
