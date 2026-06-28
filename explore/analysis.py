import re
from collections import Counter
from explore.permits import fetch_permit_sample
from explore.assessor import fetch_assessor_sample

_HVAC_WHERE = (
    "upper(description) like '%HVAC%' OR upper(description) like '%HEATING%' OR "
    "upper(description) like '%COOLING%' OR upper(description) like '%AIR CONDITION%' OR "
    "upper(description) like '%FURNACE%' OR upper(description) like '%BOILER%' OR "
    "upper(description) like '%HEAT PUMP%' OR upper(description) like '%PANEL%' OR "
    "upper(description) like '%SERVICE UPGRADE%' OR upper(description) like '%EV%' OR "
    "upper(description) like '%ELECTRIC VEHICLE%' OR upper(description) like '%EVSE%'"
)


def _normalize_permit_address(num: str, name: str) -> str:
    """'536', 'Page' -> '536 PAGE'"""
    return f"{num.lstrip('0').strip()} {name.strip().upper()}"


def _normalize_parcel_address(raw: str) -> str:
    """
    '0000 0749 FILBERT             ST0000' -> '749 FILBERT'
    Format: <prefix> <zero-padded-num> <name> <suffix+unit>
    """
    parts = raw.split()
    if len(parts) < 3:
        return raw.strip().upper()
    # parts[0] is a leading zero block, parts[1] is the street number, rest is name + suffix
    num = parts[1].lstrip("0") or "0"
    name = parts[2]
    return f"{num} {name}"


def compute_join_rate(sample_size: int = 200) -> float:
    """
    Estimate what fraction of HVAC/electrical permit addresses match a parcel record.
    Matches on normalized '<number> <street_name>' key.
    """
    permits = fetch_permit_sample(limit=sample_size, where=_HVAC_WHERE)
    if not permits:
        return 0.0

    permit_addresses = set()
    for p in permits:
        num = p.get("street_number", "").strip()
        name = p.get("street_name", "").strip()
        if num and name:
            permit_addresses.add(_normalize_permit_address(num, name))

    if not permit_addresses:
        return 0.0

    parcels = fetch_assessor_sample(
        limit=min(sample_size * 10, 10000),
        where=f"closed_roll_year='{_latest_roll_year()}'",
    )
    parcel_addresses = set()
    for parcel in parcels:
        loc = parcel.get("property_location", "")
        if loc:
            parcel_addresses.add(_normalize_parcel_address(loc))

    matched = sum(1 for addr in permit_addresses if addr in parcel_addresses)
    return matched / len(permit_addresses)


def _latest_roll_year() -> str:
    records = fetch_assessor_sample(limit=1, where="closed_roll_year is not null")
    if records:
        return records[0].get("closed_roll_year", "2023")
    return "2023"


def rank_neighborhoods_by_permit_density(top_n: int = 5) -> list[dict]:
    """
    Return top-N SF neighborhoods ranked by HVAC + electrical permit count.
    """
    records = fetch_permit_sample(limit=50000, where=_HVAC_WHERE)
    counts: Counter = Counter()
    for r in records:
        hood = r.get("neighborhoods_analysis_boundaries", "").strip()
        if hood:
            counts[hood] += 1

    ranked = [
        {"neighborhood": name, "permit_count": count}
        for name, count in counts.most_common(top_n)
    ]
    return ranked
