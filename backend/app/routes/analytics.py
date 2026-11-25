from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query

from ..deps import prediction_service  # noqa: F401  (ensures singletons exist)
from ..services.data_service import DatasetUnavailable, NotFound, data_service as ds
from ..utils.teams import FRANCHISES

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _guard(fn, *a, **kw):
    try:
        return fn(*a, **kw)
    except DatasetUnavailable as exc:
        raise HTTPException(503, detail={"message": str(exc), "code": "dataset_unavailable"})
    except NotFound as exc:
        raise HTTPException(404, detail={"message": str(exc), "code": "not_found"})
    except ValueError as exc:
        raise HTTPException(422, detail={"message": str(exc), "code": "invalid_request"})


@router.get("/status")
def status():
    """Whether the historical dataset is loaded, plus data-handling notes."""
    return ds.status()


@router.get("/overview")
def overview():
    return _guard(ds.overview)


@router.get("/teams")
def teams():
    """All IPL franchises. Match counts are included when the dataset is loaded."""
    present = set(ds.team_names()) if ds.loaded else set()
    out = []
    for f in FRANCHISES:
        row = {**f, "in_dataset": f["name"] in present if ds.loaded else None}
        out.append(row)
    for extra in sorted(present - {f["name"] for f in FRANCHISES}):
        out.append({"name": extra, "display_name": extra, "short": extra[:3].upper(), "active": None, "in_dataset": True})
    return out


@router.get("/seasons")
def seasons():
    return ds.seasons if ds.loaded else []


@router.get("/seasons/summary")
def seasons_summary(seasons: Annotated[Optional[list[str]], Query()] = None):
    return _guard(ds.seasons_summary, seasons)


@router.get("/venues")
def venues():
    return _guard(ds.venue_list) if ds.loaded else []


@router.get("/team-comparison")
def team_comparison(teams: Annotated[list[str], Query()], season: Annotated[Optional[list[str]], Query()] = None,
                    venue: Optional[str] = None):
    return _guard(ds.compare, teams, season or None, venue)


@router.get("/team/{team_name}")
def team(team_name: str, season: Optional[str] = None):
    return _guard(ds.team, team_name, season)


@router.get("/players")
def players(q: str = "", limit: int = Query(20, ge=1, le=100)):
    return _guard(ds.player_search, q, limit)


@router.get("/player/{player_name}")
def player(player_name: str, season: Optional[str] = None):
    return _guard(ds.player, player_name, season)


@router.get("/venue/{venue_name:path}")
def venue(venue_name: str):
    return _guard(ds.venue, venue_name)


@router.get("/season/{season:path}")
def season(season: str):
    return _guard(ds.season, season)
