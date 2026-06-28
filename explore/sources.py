import time
import requests

SOCRATA_BASE = "https://data.sfgov.org/resource"

DATASETS = {
    "assessor": "wv5m-vpq2",  # SF Assessor Historical Secured Property Tax Roll
}


def _url(dataset_key: str) -> str:
    return f"{SOCRATA_BASE}/{DATASETS[dataset_key]}.json"


def fetch_all(
    dataset_key: str,
    select: str | None = None,
    where: str | None = None,
    page: int = 5000,
    max_rows: int = 200_000,
    order: str = ":id",
    group: str | None = None,
) -> list[dict]:
    """Paginated SODA fetch. Pages until exhausted or max_rows."""
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
        time.sleep(0.1)
    return rows


def normalize_block_lot(block: str, lot: str) -> tuple[str, str] | None:
    """Strip zero-padding and upper-case for consistent assessor/permit joins."""
    if not block or not lot:
        return None
    b = block.strip().lstrip("0") or "0"
    l = lot.strip().lstrip("0").upper() or "0"
    return (b, l)
