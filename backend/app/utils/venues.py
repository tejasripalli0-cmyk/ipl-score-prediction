"""Venue-name canonicalisation.

Cricsheet has used several spellings for the same ground over the years (with and
without a city suffix, renamed stadiums, ...). The saved models were trained on the
RAW spellings (49 of them), so we group the variants for analytics and keep the
mapping back to the raw string the model understands.
"""
from __future__ import annotations

# canonical display name -> raw spellings seen in the models' encoders
VENUE_GROUPS: dict[str, list[str]] = {
    "Arun Jaitley Stadium, Delhi": ["Arun Jaitley Stadium", "Arun Jaitley Stadium, Delhi", "Feroz Shah Kotla"],
    "Wankhede Stadium, Mumbai": ["Wankhede Stadium", "Wankhede Stadium, Mumbai"],
    "Eden Gardens, Kolkata": ["Eden Gardens", "Eden Gardens, Kolkata"],
    "MA Chidambaram Stadium, Chennai": [
        "MA Chidambaram Stadium", "MA Chidambaram Stadium, Chepauk", "MA Chidambaram Stadium, Chepauk, Chennai"],
    "M Chinnaswamy Stadium, Bengaluru": ["M Chinnaswamy Stadium", "M.Chinnaswamy Stadium"],
    "Brabourne Stadium, Mumbai": ["Brabourne Stadium", "Brabourne Stadium, Mumbai"],
    "Dr DY Patil Sports Academy, Mumbai": ["Dr DY Patil Sports Academy", "Dr DY Patil Sports Academy, Mumbai"],
    "Maharashtra Cricket Association Stadium, Pune": [
        "Maharashtra Cricket Association Stadium", "Maharashtra Cricket Association Stadium, Pune"],
    "Punjab Cricket Association IS Bindra Stadium, Mohali": [
        "Punjab Cricket Association IS Bindra Stadium", "Punjab Cricket Association IS Bindra Stadium, Mohali",
        "Punjab Cricket Association Stadium, Mohali"],
    "Rajiv Gandhi International Stadium, Hyderabad": [
        "Rajiv Gandhi International Stadium", "Rajiv Gandhi International Stadium, Uppal"],
    "Narendra Modi Stadium, Ahmedabad": ["Narendra Modi Stadium, Ahmedabad", "Sardar Patel Stadium, Motera"],
    "Sheikh Zayed Stadium, Abu Dhabi": ["Sheikh Zayed Stadium", "Zayed Cricket Stadium, Abu Dhabi"],
}

_RAW_TO_CANON: dict[str, str] = {}
for _canon, _raws in VENUE_GROUPS.items():
    _RAW_TO_CANON[_canon.lower()] = _canon
    for _r in _raws:
        _RAW_TO_CANON[_r.lower()] = _canon

OTHER_VENUE = "__other__"
OTHER_VENUE_LABEL = "Other venue (not in the model's training data)"


def canonical_venue(raw: object) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.lower() in {"nan", "none", "null"}:
        return None
    return _RAW_TO_CANON.get(s.lower(), s)


def raw_variants(canonical: str, available: list[str]) -> list[str]:
    """Raw spellings of `canonical` that exist in `available` (the model's categories)."""
    cands = VENUE_GROUPS.get(canonical, [canonical])
    out = [c for c in cands if c in available]
    if not out and canonical in available:
        out = [canonical]
    return out
