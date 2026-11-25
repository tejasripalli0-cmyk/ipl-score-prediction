"""Franchise metadata and historical-name normalisation.

Canonical names are the ones used inside the saved models' OneHotEncoders
(note: the models use "Pune Warriors", displayed as "Pune Warriors India").
"""
from __future__ import annotations

FRANCHISES: list[dict] = [
    {"name": "Chennai Super Kings", "display_name": "Chennai Super Kings", "short": "CSK", "active": True},
    {"name": "Mumbai Indians", "display_name": "Mumbai Indians", "short": "MI", "active": True},
    {"name": "Royal Challengers Bengaluru", "display_name": "Royal Challengers Bengaluru", "short": "RCB", "active": True,
     "formerly": "Royal Challengers Bangalore"},
    {"name": "Kolkata Knight Riders", "display_name": "Kolkata Knight Riders", "short": "KKR", "active": True},
    {"name": "Rajasthan Royals", "display_name": "Rajasthan Royals", "short": "RR", "active": True},
    {"name": "Sunrisers Hyderabad", "display_name": "Sunrisers Hyderabad", "short": "SRH", "active": True},
    {"name": "Delhi Capitals", "display_name": "Delhi Capitals", "short": "DC", "active": True,
     "formerly": "Delhi Daredevils"},
    {"name": "Punjab Kings", "display_name": "Punjab Kings", "short": "PBKS", "active": True,
     "formerly": "Kings XI Punjab"},
    {"name": "Gujarat Titans", "display_name": "Gujarat Titans", "short": "GT", "active": True},
    {"name": "Lucknow Super Giants", "display_name": "Lucknow Super Giants", "short": "LSG", "active": True},
    {"name": "Deccan Chargers", "display_name": "Deccan Chargers", "short": "DCH", "active": False},
    {"name": "Kochi Tuskers Kerala", "display_name": "Kochi Tuskers Kerala", "short": "KTK", "active": False},
    {"name": "Pune Warriors", "display_name": "Pune Warriors India", "short": "PWI", "active": False},
    {"name": "Rising Pune Supergiant", "display_name": "Rising Pune Supergiant", "short": "RPS", "active": False},
    {"name": "Gujarat Lions", "display_name": "Gujarat Lions", "short": "GL", "active": False},
]

_ALIASES: dict[str, str] = {
    "delhi daredevils": "Delhi Capitals",
    "kings xi punjab": "Punjab Kings",
    "royal challengers bangalore": "Royal Challengers Bengaluru",
    "pune warriors india": "Pune Warriors",
    "rising pune supergiants": "Rising Pune Supergiant",
}
for _f in FRANCHISES:
    _ALIASES[_f["name"].lower()] = _f["name"]
    _ALIASES[_f["display_name"].lower()] = _f["name"]

CANONICAL_TEAMS: list[str] = [f["name"] for f in FRANCHISES]
_BY_NAME = {f["name"]: f for f in FRANCHISES}


def normalize_team(raw: object) -> str | None:
    """Map any historical/alternative franchise name to the canonical (model) name.

    Unknown names are returned stripped but otherwise unchanged so they stay visible
    in analytics rather than being silently dropped.
    """
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.lower() in {"nan", "none", "null"}:
        return None
    return _ALIASES.get(s.lower(), s)


def franchise_info(name: str) -> dict | None:
    return _BY_NAME.get(name)
