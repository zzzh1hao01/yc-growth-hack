import re
from collections import Counter
from explore.permits import fetch_permit_sample
from explore.assessor import fetch_assessor_sample
from explore.sources import (
    VERTICAL_FILTERS,
    count_records,
    fetch_all,
    fetch_by_in,
    first_example,
    normalize_block_lot,
)

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


# ===========================================================================
# CORRECTED ANALYSIS (Slice 1 fix) — pulls from all three datasets.
# The functions above query only building permits and undercount electrical
# ~195x. The functions below are the authoritative ones for taxonomy,
# join validation, and neighborhood ranking.
# ===========================================================================


def vertical_counts() -> dict[str, dict]:
    """
    Task 1+2: For each vertical, report which dataset it comes from, the dataset
    total, the lead-relevant filtered count, and one example description so a
    human can confirm the filter captures a real lead signal (not an overcount).
    """
    out: dict[str, dict] = {}
    for vertical, cfg in VERTICAL_FILTERS.items():
        ds = cfg["dataset"]
        where = cfg["where"]
        out[vertical] = {
            "dataset": ds,
            "dataset_total": count_records(ds),
            "filtered": count_records(ds, where),
            "example": first_example(ds, where),
        }
    return out


def validate_block_lot_join(vertical: str = "panel", permit_sample: int = 2000) -> dict:
    """
    Task 3: Validate the block+lot equi-join on a real sample (the make-or-break).
    Joins lead-relevant permits to the assessor roll on normalized (block, lot)
    and reports the real join rate + how many usable (permit + assessor) records.
    """
    cfg = VERTICAL_FILTERS[vertical]
    permits = fetch_all(
        cfg["dataset"],
        select="block,lot",
        where=cfg["where"],
        page=1000,
        max_rows=permit_sample,
    )
    permit_keys: set[tuple[str, str]] = set()
    blocks: set[str] = set()
    for p in permits:
        key = normalize_block_lot(p.get("block", ""), p.get("lot", ""))
        if key:
            permit_keys.add(key)
            # collect both padded + stripped block forms so the assessor IN-clause
            # matches regardless of zero-padding convention
            raw = p.get("block", "").strip()
            blocks.add(raw)
            blocks.add(raw.lstrip("0") or "0")

    if not permit_keys:
        return {"vertical": vertical, "permit_parcels": 0, "join_rate": 0.0, "matched": 0}

    # Pull assessor parcels only for the blocks in our sample (chunked IN to
    # avoid a 414 URI-too-large error from one giant IN clause).
    parcels = fetch_by_in(
        "assessor",
        column="block",
        values=sorted(b for b in blocks if b),
        select="block,lot",
    )
    assessor_keys = {
        k for pc in parcels
        if (k := normalize_block_lot(pc.get("block", ""), pc.get("lot", "")))
    }

    matched = sum(1 for k in permit_keys if k in assessor_keys)
    return {
        "vertical": vertical,
        "permit_parcels": len(permit_keys),
        "assessor_parcels_on_those_blocks": len(assessor_keys),
        "matched": matched,
        "join_rate": matched / len(permit_keys),
    }


def build_block_neighborhood_map(latest_year: str | None = None) -> dict[str, str]:
    """
    Build {normalized_block -> analysis_neighborhood} from the assessor roll.
    Electrical/plumbing permits have no neighborhood field, so neighborhood is
    derived from the parcel block. Uses server-side grouping to keep volume low.
    """
    year = latest_year or _latest_roll_year()
    rows = fetch_all(
        "assessor",
        select="block, analysis_neighborhood, count(1) as n",
        where=f"closed_roll_year='{year}' AND analysis_neighborhood IS NOT NULL",
        group="block, analysis_neighborhood",
        page=5000,
        max_rows=100_000,
        order="block",
    )
    # block may span >1 neighborhood (rare); keep the highest-count assignment.
    best: dict[str, tuple[str, int]] = {}
    for r in rows:
        raw = r.get("block", "")
        nb = (r.get("analysis_neighborhood") or "").strip()
        if not raw or not nb:
            continue
        block = raw.strip().lstrip("0") or "0"
        cnt = int(r.get("n") or 0)
        if block not in best or cnt > best[block][1]:
            best[block] = (nb, cnt)
    return {b: v[0] for b, v in best.items()}


def rank_neighborhoods_corrected(
    top_n: int = 10,
    since: str = "2016-01-01",
    per_vertical_cap: int = 80_000,
) -> list[dict]:
    """
    Task 5: Rank neighborhoods by corrected, all-three-dataset permit density.
    Neighborhood is derived via the assessor block->neighborhood map. Restricted
    to recent permits (since) so density reflects current demand and the fetch
    stays bounded.
    """
    bn = build_block_neighborhood_map()
    counts: Counter = Counter()
    for vertical in ("panel", "ev", "hvac"):
        cfg = VERTICAL_FILTERS[vertical]
        where = f"({cfg['where']}) AND filed_date > '{since}'"
        rows = fetch_all(
            cfg["dataset"],
            select="block",
            where=where,
            page=5000,
            max_rows=per_vertical_cap,
        )
        for r in rows:
            raw = r.get("block", "")
            block = raw.strip().lstrip("0") or "0" if raw else ""
            nb = bn.get(block)
            if nb:
                counts[nb] += 1
    return [
        {"neighborhood": nb, "permit_count": c}
        for nb, c in counts.most_common(top_n)
    ]
