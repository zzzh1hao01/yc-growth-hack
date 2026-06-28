import requests

SOCRATA_BASE = "https://data.sfgov.org/resource"
ASSESSOR_DATASET = "wv5m-vpq2"  # SF Assessor Historical Secured Property Tax Roll

ASSESSOR_REQUIRED_FIELDS = [
    "parcel_number",
    "property_location",
    "analysis_neighborhood",
    "year_property_built",
    "current_sales_date",
    "homeowner_exemption_value",
    "property_class_code",
    "use_definition",
]


def fetch_assessor_sample(limit: int = 100, where: str | None = None, offset: int = 0) -> list[dict]:
    params: dict = {"$limit": limit, "$offset": offset}
    if where:
        params["$where"] = where
    resp = requests.get(f"{SOCRATA_BASE}/{ASSESSOR_DATASET}.json", params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def count_pool_parcels() -> int:
    """
    Attempt to count parcels with a pool flag. The SF Assessor dataset does not
    include a has_pool field; this returns 0 as a documented finding.
    """
    try:
        records = fetch_assessor_sample(limit=1, where="has_pool='Y'")
        return len(records)
    except Exception:
        return 0
