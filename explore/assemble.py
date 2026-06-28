"""
Record-assembly pipeline for HouseholdIQ.

Assembles one household record per residential parcel across the 5 target
neighborhoods, joining assessor + permits (electrical/plumbing/building) on
block+lot (the validated equi-join, ~86-92% hit rate). Emits the EXACT JSON
shape the frontend depends on. Does NOT write to any database.

Scores trace only to real data points (year built, permit dates, ownership,
assessed value) — no invented signals. `reasons` lists the data each score came
from.

Usage:
    python -m explore.assemble --sample 30 --out household_sample.json
    python -m explore.assemble --cap 2000 --out household_records.json
"""
import argparse
import datetime
import json

import requests

from explore.sources import (
    DATASETS,
    SOCRATA_BASE,
    VERTICAL_FILTERS,
    fetch_all,
    fetch_by_in,
    normalize_block_lot,
)

TARGET_NEIGHBORHOODS = [
    "Sunset/Parkside",
    "West of Twin Peaks",
    "Outer Richmond",
    "Noe Valley",
    "Inner Sunset",
]

# Replacement-threshold (years) past which a vertical is flagged urgent.
# EV is an opportunity vertical, not age-based -> no urgency threshold.
URGENCY_YEARS = {"hvac": 15, "panel": 25, "ev": None}

# Which datasets each vertical's permit history is pulled from.
# HVAC also checks building permits (large remodels w/ HVAC scope).
VERTICAL_PERMIT_SOURCES = {
    "hvac": [("plumbing", VERTICAL_FILTERS["hvac"]["where"]),
             ("building", VERTICAL_FILTERS["hvac_building"]["where"])],
    "panel": [("electrical", VERTICAL_FILTERS["panel"]["where"])],
    "ev": [("electrical", VERTICAL_FILTERS["ev"]["where"])],
}

# Residential filter for the assessor roll (electrical/plumbing have no use field).
_RESIDENTIAL = (
    "(upper(use_definition) like '%RESIDENTIAL%' "
    "OR upper(use_definition) like '%DWELLING%' "
    "OR upper(use_definition) like '%FLAT%' "
    "OR upper(use_definition) like '%APARTMENT%')"
)

THIS_YEAR = datetime.date.today().year


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _latest_roll_year() -> str:
    # aggregate query needs no $order (fetch_all forces $order=:id, which 400s here)
    resp = requests.get(
        f"{SOCRATA_BASE}/{DATASETS['assessor']}.json",
        params={"$select": "max(closed_roll_year) as y"},
        timeout=60,
    )
    resp.raise_for_status()
    rows = resp.json()
    return rows[0]["y"] if rows and rows[0].get("y") else "2023"


def _f(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _i(v) -> int | None:
    f = _f(v)
    return int(f) if f is not None else None


def _date(v) -> str | None:
    """SF datetime '2021-11-19T00:00:00.000' -> '2021-11-19'."""
    if not v:
        return None
    return str(v)[:10]


def clean_address(raw: str) -> str:
    """'0000 4367 21ST                ST0000' -> '4367 21st St'."""
    if not raw:
        return ""
    toks = raw.split()
    if len(toks) < 3:
        return raw.strip().title()
    num = toks[1].lstrip("0") or toks[1]
    suffix = toks[-1].rstrip("0").strip() or ""
    name = " ".join(toks[2:-1]) if len(toks) > 3 else toks[2].rstrip("0")
    return f"{num} {name} {suffix}".title().strip()


def _latlng(rec: dict) -> tuple[float | None, float | None]:
    geom = rec.get("the_geom")
    if isinstance(geom, dict) and geom.get("coordinates"):
        lng, lat = geom["coordinates"][0], geom["coordinates"][1]
        return float(lat), float(lng)
    return None, None


def _years_since(date_str: str | None) -> int | None:
    if not date_str:
        return None
    try:
        y = int(date_str[:4])
        return THIS_YEAR - y
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# permit history per vertical (block+lot join)
# ---------------------------------------------------------------------------
def latest_permit_dates(blocks: list[str]) -> dict[str, dict[tuple, str]]:
    """
    For the given parcel blocks, return {vertical: {(block,lot): latest_date}}.
    Latest date = max(issued_date or filed_date) for permits matching the
    vertical filter, joined on normalized (block, lot).
    """
    out: dict[str, dict[tuple, str]] = {"hvac": {}, "panel": {}, "ev": {}}
    for vertical, sources in VERTICAL_PERMIT_SOURCES.items():
        for dataset, where in sources:
            rows = fetch_by_in(
                dataset,
                column="block",
                values=blocks,
                select="block,lot,filed_date,issued_date",
                extra_where=where,
            )
            for r in rows:
                key = normalize_block_lot(r.get("block", ""), r.get("lot", ""))
                if not key:
                    continue
                d = _date(r.get("issued_date")) or _date(r.get("filed_date"))
                if not d:
                    continue
                cur = out[vertical].get(key)
                if cur is None or d > cur:
                    out[vertical][key] = d
    return out


# ---------------------------------------------------------------------------
# scoring (0-1, transparent, data-traceable)
# ---------------------------------------------------------------------------
def _score_replacement(vertical, last_date, home_age, owner, threshold) -> dict:
    reasons: list[str] = []
    age = _years_since(last_date)
    if last_date is None:
        base = 0.7
        reasons.append(f"no {vertical} permit on record")
    else:
        base = min(age / threshold, 1.0) * 0.6
        reasons.append(f"last {vertical} permit {last_date[:4]} ({age} yrs ago)")

    home_factor = 0.0
    if home_age is not None:
        home_factor = min(home_age / 80.0, 1.0) * 0.3
        reasons.append(f"home built {THIS_YEAR - home_age} ({home_age} yrs old)")

    owner_factor = 0.0
    if owner:
        owner_factor = 0.1
        reasons.append("owner-occupied")

    score = round(min(base + home_factor + owner_factor, 1.0), 2)
    urgent = (age is not None and age >= threshold) or (
        last_date is None and home_age is not None and home_age >= threshold
    )
    if urgent and last_date is None:
        reasons.append(f"no permit + home age {home_age}y exceeds {threshold}y threshold")
    return {
        "score": score,
        "urgency_flag": bool(urgent),
        "last_relevant_permit_date": last_date,
        "reasons": reasons,
    }


def _score_ev(last_date, owner, assessed_value, last_sale_date) -> dict:
    reasons: list[str] = []
    if last_date is not None:
        reasons.append(f"EV charger permit already on record ({last_date[:4]})")
        return {
            "score": 0.1,
            "urgency_flag": False,
            "last_relevant_permit_date": last_date,
            "reasons": reasons,
        }
    score = 0.3
    reasons.append("no EV charger permit on record")
    if assessed_value and assessed_value > 2_000_000:
        score += 0.3
        reasons.append(f"high assessed value ${assessed_value:,.0f}")
    elif assessed_value and assessed_value > 1_200_000:
        score += 0.15
        reasons.append(f"assessed value ${assessed_value:,.0f}")
    if owner:
        score += 0.1
        reasons.append("owner-occupied")
    if (_years_since(last_sale_date) or 99) <= 3:
        score += 0.2
        reasons.append(f"recent mover (purchased {last_sale_date[:4]})")
    return {
        "score": round(min(score, 1.0), 2),
        "urgency_flag": False,
        "last_relevant_permit_date": last_date,
        "reasons": reasons,
    }


def assign_cluster(owner, assessed_value, home_age, last_sale_date) -> int:
    """
    Rule-based segment (0-5) from assessor signals. (Census block-group income
    is not in the assessor roll; can be layered later via lat/lng -> block group.)
      0 long-tenure affluent owner   3 mid-market established owner
      1 aging-in-place budget owner  4 investor / non-owner-occupied
      2 recent buyer / renovator     5 unclassified
    """
    recent = (_years_since(last_sale_date) or 99) <= 3
    if not owner:
        return 4
    if recent:
        return 2
    if assessed_value and assessed_value > 2_000_000:
        return 0
    if assessed_value and assessed_value < 1_200_000 and (home_age or 0) >= 60:
        return 1
    if assessed_value:
        return 3
    return 5


# ---------------------------------------------------------------------------
# assembly
# ---------------------------------------------------------------------------
def _build_record(rec: dict, permit_dates: dict) -> dict | None:
    key = normalize_block_lot(rec.get("block", ""), rec.get("lot", ""))
    if not key:
        return None
    lat, lng = _latlng(rec)
    if lat is None:
        return None  # cannot place on the map -> no usable signal

    land = _f(rec.get("assessed_land_value")) or 0.0
    impr = _f(rec.get("assessed_improvement_value")) or 0.0
    assessed_value = int(land + impr) if (land + impr) > 0 else None

    yb = _i(rec.get("year_property_built"))
    year_built = yb if (yb and yb > 1900) else None  # 1900 is SF's unknown placeholder
    home_age = (THIS_YEAR - year_built) if year_built else None

    owner = (_f(rec.get("homeowner_exemption_value")) or 0.0) > 0
    last_sale = _date(rec.get("current_sales_date"))

    hvac = _score_replacement("hvac", permit_dates["hvac"].get(key), home_age, owner, URGENCY_YEARS["hvac"])
    panel = _score_replacement("panel", permit_dates["panel"].get(key), home_age, owner, URGENCY_YEARS["panel"])
    ev = _score_ev(permit_dates["ev"].get(key), owner, assessed_value, last_sale)

    return {
        "household_id": f"{key[0]}-{key[1]}",
        "address": clean_address(rec.get("property_location", "")),
        "lat": lat,
        "lng": lng,
        "year_built": year_built,
        "owner_occupied": owner,
        "assessed_value": assessed_value,
        "last_sale_date": last_sale,
        "cluster_id": assign_cluster(owner, assessed_value, home_age, last_sale),
        "vertical_scores": {"hvac": hvac, "panel": panel, "ev": ev},
    }


def fetch_parcels(neighborhood: str, year: str, limit: int) -> list[dict]:
    return fetch_all(
        "assessor",
        select=(
            "block,lot,property_location,year_property_built,current_sales_date,"
            "homeowner_exemption_value,assessed_land_value,assessed_improvement_value,"
            "the_geom,use_definition,analysis_neighborhood"
        ),
        where=(
            f"analysis_neighborhood='{neighborhood}' AND closed_roll_year='{year}' "
            f"AND {_RESIDENTIAL}"
        ),
        page=min(limit, 5000),
        max_rows=limit,
        order="block,lot",
    )


def assemble(per_neighborhood_cap: int) -> list[dict]:
    year = _latest_roll_year()
    records: list[dict] = []
    seen: set[str] = set()
    for nb in TARGET_NEIGHBORHOODS:
        parcels = fetch_parcels(nb, year, per_neighborhood_cap)
        # dedupe parcels to one row per (block,lot)
        uniq: dict[tuple, dict] = {}
        for p in parcels:
            k = normalize_block_lot(p.get("block", ""), p.get("lot", ""))
            if k and k not in uniq:
                uniq[k] = p
        blocks = sorted({p.get("block", "").strip() for p in uniq.values() if p.get("block")})
        permit_dates = latest_permit_dates(blocks)
        n_before = len(records)
        for p in uniq.values():
            r = _build_record(p, permit_dates)
            if r and r["household_id"] not in seen:
                seen.add(r["household_id"])
                records.append(r)
        print(f"  {nb}: {len(uniq)} parcels -> {len(records) - n_before} records")
    return records


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", type=int, default=0, help="emit only N records (review mode)")
    ap.add_argument("--cap", type=int, default=2000, help="total record cap across neighborhoods")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    # per-neighborhood cap so the 5 neighborhoods sum to ~cap (sample larger ones down)
    target_total = args.sample if args.sample else args.cap
    per_nb = max(8, (target_total // len(TARGET_NEIGHBORHOODS)) + 5)
    print(f"Assembling (per-neighborhood fetch cap={per_nb}, latest roll year)...")
    records = assemble(per_nb)

    if args.sample:
        # take a spread: round-robin across clusters so the sample shows variety
        records = sorted(records, key=lambda r: (r["cluster_id"], -max(
            v["score"] for v in r["vertical_scores"].values())))
        step = max(1, len(records) // args.sample)
        records = records[::step][: args.sample]

    elif len(records) > args.cap:
        records = records[: args.cap]

    with open(args.out, "w") as f:
        json.dump(records, f, indent=2)
    print(f"Wrote {len(records)} records to {args.out}")


if __name__ == "__main__":
    main()
