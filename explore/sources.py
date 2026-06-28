"""
SF Open Data sources for HouseholdIQ.

CRITICAL CORRECTION (Slice 1): SF splits permits across several datasets.
The original Slice 1 EDA queried ONLY building permits (i98e-djp9) and therefore
undercounted the electrical vertical by ~195x. Electrical work lives in its own
dataset (ftty-kx6y); mechanical/HVAC work is filed as "plumbing" (a6aw-rudh).

Each vertical's lead signal comes from a specific dataset:
  - panel upgrades, EV chargers -> ELECTRICAL (ftty-kx6y)
  - HVAC / furnace / mechanical  -> PLUMBING  (a6aw-rudh), work category 1m
  - large remodels w/ HVAC scope -> BUILDING  (i98e-djp9), secondary only

Boiler permits (5dp4-gtxk) are "Permit To Operate Boiler" — recurring
operational permits (mostly commercial buildings), NOT install/replace leads.
Deliberately excluded from the HVAC signal.
"""
import time
import requests

SOCRATA_BASE = "https://data.sfgov.org/resource"

DATASETS = {
    "building": "i98e-djp9",   # Building Permits — remodels, some HVAC scope
    "electrical": "ftty-kx6y",  # Electrical Permits — panel upgrades, EV chargers
    "plumbing": "a6aw-rudh",    # Plumbing/Mechanical Permits — HVAC (work category 1m)
    "boiler": "5dp4-gtxk",      # Boiler Permits — operate-permits, NOT leads (excluded)
    "assessor": "wv5m-vpq2",    # Assessor Historical Secured Property Tax Roll
}

# ---------------------------------------------------------------------------
# Lead-relevant filters, per vertical, scoped to the dataset the signal lives in.
# Kept tight on purpose: the goal is install/upgrade leads, not every line item.
# ---------------------------------------------------------------------------
VERTICAL_FILTERS = {
    # ELECTRICAL (ftty-kx6y)
    "panel": {
        "dataset": "electrical",
        "where": (
            "upper(description) like '%PANEL%' "
            "OR upper(description) like '%SERVICE UPGRADE%' "
            "OR upper(description) like '%200A%' "
            "OR upper(description) like '%400A%'"
        ),
    },
    "ev": {
        "dataset": "electrical",
        "where": (
            "upper(description) like '%EV CHARGER%' "
            "OR upper(description) like '%ELECTRIC VEHICLE%' "
            "OR upper(description) like '%EVSE%' "
            "OR upper(description) like '%CHARGING STATION%'"
        ),
    },
    # HVAC / MECHANICAL (a6aw-rudh). "work category: 1m" is SF's mechanical code;
    # furnace/heat pump keywords catch legacy records filed before the code existed.
    "hvac": {
        "dataset": "plumbing",
        "where": (
            "upper(description) like '%WORK CATEGORY: 1M%' "
            "OR upper(description) like '%FURNACE%' "
            "OR upper(description) like '%HEAT PUMP%'"
        ),
    },
    # Secondary HVAC source: big remodels in the building-permits table.
    "hvac_building": {
        "dataset": "building",
        "where": (
            "upper(description) like '%HVAC%' "
            "OR upper(description) like '%FURNACE%' "
            "OR upper(description) like '%HEAT PUMP%' "
            "OR upper(description) like '%AIR CONDITION%'"
        ),
    },
}


def _url(dataset_key: str) -> str:
    return f"{SOCRATA_BASE}/{DATASETS[dataset_key]}.json"


def count_records(dataset_key: str, where: str | None = None) -> int:
    """Server-side count(*) — exact, never truncated by a client-side limit."""
    params: dict = {"$select": "count(*)"}
    if where:
        params["$where"] = where
    resp = requests.get(_url(dataset_key), params=params, timeout=60)
    resp.raise_for_status()
    return int(resp.json()[0]["count"])


def fetch_all(
    dataset_key: str,
    select: str | None = None,
    where: str | None = None,
    page: int = 5000,
    max_rows: int = 200_000,
    order: str = ":id",
    group: str | None = None,
) -> list[dict]:
    """
    Paginated fetch. Unlike the original fetch_permit_sample(limit=50000), this
    does NOT silently cap results — it pages until exhausted or max_rows.
    `order` is fixed so pagination is stable.
    """
    rows: list[dict] = []
    offset = 0
    while offset < max_rows:
        params: dict = {"$limit": page, "$offset": offset, "$order": order}
        if select:
            params["$select"] = select
        if where:
            params["$where"] = where
        if group:
            params["$group"] = group
        resp = requests.get(_url(dataset_key), params=params, timeout=60)
        resp.raise_for_status()
        batch = resp.json()
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page
        time.sleep(0.1)  # be polite to the API
    return rows


def fetch_by_in(
    dataset_key: str,
    column: str,
    values: list[str],
    select: str | None = None,
    extra_where: str | None = None,
    chunk: int = 60,
) -> list[dict]:
    """
    Fetch rows where `column` is in `values`, chunking the IN-clause to stay
    under Socrata's URL length limit (a single big IN returns 414). An optional
    `extra_where` is AND-ed in (e.g. a vertical's description filter).
    """
    rows: list[dict] = []
    for i in range(0, len(values), chunk):
        batch = values[i : i + chunk]
        in_list = ",".join(f"'{v}'" for v in batch if v)
        if not in_list:
            continue
        where = f"{column} in ({in_list})"
        if extra_where:
            where = f"({where}) AND ({extra_where})"
        rows.extend(
            fetch_all(
                dataset_key,
                select=select,
                where=where,
                page=5000,
                max_rows=50_000,
                order=column,
            )
        )
    return rows


def first_example(dataset_key: str, where: str) -> str:
    """One example description that passed the filter, for human eyeballing."""
    resp = requests.get(
        _url(dataset_key),
        params={"$select": "description", "$where": where, "$limit": 1},
        timeout=60,
    )
    resp.raise_for_status()
    rows = resp.json()
    return rows[0].get("description", "") if rows else ""


def normalize_block_lot(block: str, lot: str) -> tuple[str, str] | None:
    """
    Normalize a (block, lot) pair into a comparable join key.
    Permits and the assessor roll both carry block+lot but with zero-padding
    differences; strip leading zeros and upper-case (lots can be alphanumeric,
    e.g. '004E').
    """
    if not block or not lot:
        return None
    b = block.strip().lstrip("0") or "0"
    l = lot.strip().lstrip("0").upper() or "0"
    return (b, l)
