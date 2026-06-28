import requests

SOCRATA_BASE = "https://data.sfgov.org/resource"
PERMITS_DATASET = "i98e-djp9"

PERMIT_REQUIRED_FIELDS = [
    "permit_number",
    "permit_type",
    "permit_type_definition",
    "description",
    "status",
    "neighborhoods_analysis_boundaries",
    "filed_date",
    "street_number",
    "street_name",
]


def fetch_permit_sample(limit: int = 100, where: str | None = None, offset: int = 0) -> list[dict]:
    params: dict = {"$limit": limit, "$offset": offset}
    if where:
        params["$where"] = where
    resp = requests.get(f"{SOCRATA_BASE}/{PERMITS_DATASET}.json", params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


_ELECTRICAL_FILTERS = {
    "panel": (
        "upper(description) like '%PANEL%' OR upper(description) like '%SERVICE UPGRADE%' OR "
        "upper(description) like '%ELECTRICAL UPGRADE%' OR upper(description) like '%METER%' OR "
        "upper(description) like '%200 AMP%' OR upper(description) like '%400 AMP%'"
    ),
    "ev": (
        "upper(description) like '%EV%' OR upper(description) like '%ELECTRIC VEHICLE%' OR "
        "upper(description) like '%EV CHARGER%' OR upper(description) like '%CHARGING STATION%' OR "
        "upper(description) like '%EVSE%'"
    ),
}


def find_electrical_permit_types(vertical: str = "panel") -> list[str]:
    """Return distinct description values for electrical work by vertical ('panel' or 'ev')."""
    where = _ELECTRICAL_FILTERS.get(vertical)
    if not where:
        raise ValueError(f"Unknown vertical: {vertical!r}. Choose 'panel' or 'ev'.")
    where = f"({where})"
    records = fetch_permit_sample(limit=50000, where=where)
    seen: set[str] = set()
    for r in records:
        desc = r.get("description", "").strip()
        if desc:
            seen.add(desc)
    return sorted(seen)


def find_hvac_permit_types() -> list[str]:
    """Return distinct description values that mention HVAC-related work."""
    records = fetch_permit_sample(
        limit=50000,
        where="upper(description) like '%HVAC%' OR upper(description) like '%HEATING%' OR upper(description) like '%COOLING%' OR upper(description) like '%AIR CONDITION%' OR upper(description) like '%FURNACE%' OR upper(description) like '%BOILER%' OR upper(description) like '%HEAT PUMP%'",
    )
    seen: set[str] = set()
    for r in records:
        desc = r.get("description", "").strip()
        if desc:
            seen.add(desc)
    return sorted(seen)
