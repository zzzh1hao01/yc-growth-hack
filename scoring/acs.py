"""
ACS block-group layer — behavioural modifier for the insurance lead score.

Fetches 2024 ACS 5-year estimates for all SF County block groups and computes
three dimensions that predict whether a homeowner will engage with an insurance
review conversation, and what framing will land.

---
DIMENSIONS
---

A — Financial sophistication  (predicts active reviewer vs. set-and-forget auto-renewer)
    = college_pct × 0.35 + white_collar × 0.35 + median_income × 0.30

B — Inertia  (predicts policy drift and underinsurance accumulation probability)
    = median_age × 0.35 + pct_long_tenure_owners × 0.40 + pct_free_and_clear × 0.25

C — Coverage stakes  (predicts dollar magnitude of the problem if underinsured)
    = median_home_value × 0.50 + owner_occupancy_rate × 0.25 + pct_high_value × 0.25

acs_receptivity = A × 0.35 + B × 0.40 + C × 0.25

---
ARCHETYPES
---

Each block group is assigned one of five archetypes based on percentile thresholds
(self-calibrated to the SF distribution):

    wealthy_inert       high B + high C, not top-30% A  →  lead with dollar gap amount
    active_optimizer    top-30% A + below-median B + high C  →  data-first, specific numbers
    new_to_wealth       top-30% A + below-median B + low C  →  educational, first policy review
    disengaged_owner    bottom-35% A + top-25% B  →  simple, concrete, loss-salient
    price_first_shopper everything else  →  lead with premium comparison

---
USAGE
---

    Census API key (free): https://api.census.gov/data/key_signup.html

    from scoring.acs import build_block_group_index, batch_geocode

    bg_index  = build_block_group_index(api_key)   # {geoid_12: ACSBlockGroup}
    geoid_map = batch_geocode([(lat, lng), ...])    # {(lat, lng): geoid_12 | None}
    bg        = bg_index.get(geoid_map.get((lat, lng)))
"""
import json
import os
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import requests

CENSUS_ACS_URL = "https://api.census.gov/data/2024/acs/acs5"
SF_STATE = "06"
SF_COUNTY = "075"

# Variable chunks — max ~45 vars per Census API call (+ geo fields the API adds)
_CHUNKS: List[List[str]] = [
    # Income + education + age base
    [
        "B19013_001E",
        "B19001_002E", "B19001_003E", "B19001_004E", "B19001_005E",
        "B19001_006E", "B19001_007E", "B19001_008E", "B19001_009E",
        "B19001_010E", "B19001_011E", "B19001_012E", "B19001_013E",
        "B19001_014E", "B19001_015E", "B19001_016E", "B19001_017E",
        "B15003_001E", "B15003_022E", "B15003_023E", "B15003_024E", "B15003_025E",
        "B01002_001E", "B01001_001E",
    ],
    # Age brackets 55+ and 25-44
    [
        "B01001_020E", "B01001_021E", "B01001_022E", "B01001_023E", "B01001_024E", "B01001_025E",
        "B01001_044E", "B01001_045E", "B01001_046E", "B01001_047E", "B01001_048E", "B01001_049E",
        "B01001_007E", "B01001_008E", "B01001_009E", "B01001_010E", "B01001_011E", "B01001_012E",
        "B01001_031E", "B01001_032E", "B01001_033E", "B01001_034E", "B01001_035E", "B01001_036E",
    ],
    # Housing tenure + mortgage status
    # B25038 (housing units by year moved in) replaces B25026 (population by year moved in).
    # B25026_007E/_008E are suppressed at block group level for all SF; B25038 is not.
    # B25038_002E = owner-occupied total, _007E = 1990-1999, _008E = 1989 or earlier.
    [
        "B25001_001E", "B25003_001E", "B25003_002E", "B25003_003E",
        "B25038_002E", "B25038_007E", "B25038_008E",
        "B25087_001E", "B25087_002E",
        "B25081_001E", "B25081_002E", "B25081_008E",
    ],
    # Home value + monthly costs + occupation + household + vehicles
    [
        "B25077_001E", "B25075_001E",
        "B25075_020E", "B25075_021E", "B25075_022E", "B25075_023E",
        "B25075_024E", "B25075_025E", "B25075_026E", "B25075_027E",
        "B25094_001E", "B25104_001E", "B25093_001E",
        "C24010_001E", "C24010_003E", "C24010_039E", "C24010_019E", "C24010_055E",
        "B11001_001E", "B11001_002E", "B11001_007E", "B11003_003E", "B09021_001E",
        "B08201_001E", "B08201_002E", "B08201_003E", "B08201_004E", "B08201_005E",
    ],
]


def _f(v) -> Optional[float]:
    """Safe float; treats Census null sentinels (< -99999) as None."""
    try:
        x = float(v)
        return None if x < -99999 else x
    except (TypeError, ValueError):
        return None


def _ratio(num, denom, default: float = 0.0) -> float:
    n, d = _f(num), _f(denom)
    if d is not None and d > 0 and n is not None:
        return max(0.0, n / d)
    return default


# ---------------------------------------------------------------------------
# ACS fetch
# ---------------------------------------------------------------------------

def _fetch_chunk(variables: List[str], api_key: str) -> List[dict]:
    resp = requests.get(
        CENSUS_ACS_URL,
        params={
            "get": ",".join(variables),
            "for": "block group:*",
            "in": f"state:{SF_STATE} county:{SF_COUNTY}",
            "key": api_key,
        },
        timeout=60,
    )
    resp.raise_for_status()
    if resp.text.lstrip().startswith("<"):
        # Census returns HTML (not JSON) for invalid/unactivated keys
        if "Invalid Key" in resp.text or "Missing Key" in resp.text:
            raise RuntimeError(
                "Census API key rejected. If you just signed up, check your email "
                "for an activation link from census.data@census.gov and click it "
                "before running again."
            )
        raise RuntimeError(f"Census API returned unexpected HTML: {resp.text[:200]}")
    data = resp.json()
    headers = data[0]
    return [dict(zip(headers, row)) for row in data[1:]]


def _geoid(row: dict) -> str:
    return f"{row['state']}{row['county']}{row['tract']}{row['block group']}"


def fetch_sf_acs(api_key: str) -> Dict[str, dict]:
    """
    Fetch all variable chunks for SF block groups and merge by GEOID.
    Makes one Census API call per chunk (~4 calls). Returns {geoid: merged_row}.
    """
    merged: Dict[str, dict] = {}
    for i, chunk in enumerate(_CHUNKS):
        rows = _fetch_chunk(chunk, api_key)
        for row in rows:
            gid = _geoid(row)
            merged.setdefault(gid, {}).update(row)
        if i < len(_CHUNKS) - 1:
            time.sleep(0.3)
    return merged


# ---------------------------------------------------------------------------
# Derived fields and dimension scoring
# ---------------------------------------------------------------------------

@dataclass
class ACSBlockGroup:
    geoid: str
    # Raw derived ratios (0–1 or dollar amounts)
    median_income: float
    pct_above_100k: float
    pct_college_educated: float
    median_age: float
    pct_over_55: float
    owner_occupancy_rate: float
    pct_long_tenure_owners: float
    pct_mortgaged: float
    pct_free_and_clear: float
    median_home_value: float
    pct_high_value_homes: float
    pct_white_collar: float
    pct_family_households: float
    pct_multi_vehicle: float
    housing_cost_burden: float
    # Normalized dimension scores (0–1, min-max across all SF block groups)
    financial_sophistication: float = 0.0
    inertia_score: float = 0.0
    coverage_stakes: float = 0.0
    acs_receptivity: float = 0.0
    archetype: str = "unknown"


def _derived(row: dict) -> Optional[ACSBlockGroup]:
    """Compute derived fields for one block group row. Returns None on missing core data."""
    gid = _geoid(row)

    # Income — pct above $100k uses brackets B19001_012E:017E (upper income)
    all_brackets = sum(_f(row.get(f"B19001_{str(i).zfill(3)}E")) or 0.0 for i in range(2, 18))
    above_100k = sum(_f(row.get(f"B19001_{str(i).zfill(3)}E")) or 0.0 for i in range(12, 18))
    pct_above_100k = above_100k / all_brackets if all_brackets > 0 else 0.0
    median_income = _f(row.get("B19013_001E")) or 0.0

    # Education
    edu_denom = _f(row.get("B15003_001E")) or 0.0
    college = sum(_f(row.get(v)) or 0.0 for v in
                  ["B15003_022E", "B15003_023E", "B15003_024E", "B15003_025E"])
    pct_college = college / edu_denom if edu_denom > 0 else 0.0

    # Age
    median_age = _f(row.get("B01002_001E")) or 0.0
    total_pop = _f(row.get("B01001_001E")) or 1.0
    over55 = sum(_f(row.get(v)) or 0.0 for v in [
        "B01001_020E", "B01001_021E", "B01001_022E", "B01001_023E", "B01001_024E", "B01001_025E",
        "B01001_044E", "B01001_045E", "B01001_046E", "B01001_047E", "B01001_048E", "B01001_049E",
    ])
    pct_over55 = over55 / total_pop if total_pop > 0 else 0.0

    # Housing tenure
    # B25038_002E = owner-occupied units total (denominator)
    # B25038_007E = moved in 1990-1999 (25-34 years ago)
    # B25038_008E = moved in 1989 or earlier (35+ years ago)
    # B25026_007E/_008E are suppressed for all SF block groups; B25038 is not.
    occ_units = _f(row.get("B25003_001E")) or 1.0
    owner_occ = _f(row.get("B25003_002E")) or 0.0
    owner_occupancy_rate = owner_occ / occ_units if occ_units > 0 else 0.0
    owner_occ_units = _f(row.get("B25038_002E")) or 0.0
    long_tenure_units = sum(_f(row.get(v)) or 0.0 for v in ["B25038_007E", "B25038_008E"])
    pct_long_tenure = long_tenure_units / owner_occ_units if owner_occ_units > 0 else 0.0

    # Mortgage status
    owner_total = _f(row.get("B25081_001E")) or 1.0
    pct_mortgaged = _ratio(row.get("B25081_002E"), owner_total)
    pct_free_clear = _ratio(row.get("B25081_008E"), owner_total)

    # Home value
    median_home_value = _f(row.get("B25077_001E")) or 0.0
    hv_total = _f(row.get("B25075_001E")) or 1.0
    high_value = sum(_f(row.get(f"B25075_{str(i).zfill(3)}E")) or 0.0 for i in range(20, 28))
    pct_high_value = high_value / hv_total if hv_total > 0 else 0.0

    # Monthly housing cost burden (% of income toward housing, with mortgage)
    housing_cost_burden = _f(row.get("B25104_001E")) or 0.0

    # Occupation — white collar = management/business/science/arts
    emp_total = _f(row.get("C24010_001E")) or 1.0
    white_collar = sum(_f(row.get(v)) or 0.0 for v in ["C24010_003E", "C24010_039E"])
    pct_wc = white_collar / emp_total if emp_total > 0 else 0.0

    # Household composition
    hh_total = _f(row.get("B11001_001E")) or 1.0
    family_hh = _f(row.get("B11001_002E")) or 0.0
    pct_family = family_hh / hh_total if hh_total > 0 else 0.0

    # Vehicles (multi-vehicle = 2+ → bundle signal)
    veh_total = _f(row.get("B08201_001E")) or 1.0
    multi_veh = sum(_f(row.get(v)) or 0.0 for v in ["B08201_004E", "B08201_005E"])
    pct_multi_veh = multi_veh / veh_total if veh_total > 0 else 0.0

    return ACSBlockGroup(
        geoid=gid,
        median_income=median_income,
        pct_above_100k=pct_above_100k,
        pct_college_educated=pct_college,
        median_age=median_age,
        pct_over_55=pct_over55,
        owner_occupancy_rate=owner_occupancy_rate,
        pct_long_tenure_owners=min(pct_long_tenure, 1.0),
        pct_mortgaged=pct_mortgaged,
        pct_free_and_clear=pct_free_clear,
        median_home_value=median_home_value,
        pct_high_value_homes=pct_high_value,
        pct_white_collar=pct_wc,
        pct_family_households=pct_family,
        pct_multi_vehicle=pct_multi_veh,
        housing_cost_burden=housing_cost_burden,
    )


def _mnorm(vals: List[float]) -> List[float]:
    """Min-max normalize. Returns 0.5 for all when all values are identical."""
    mn, mx = min(vals), max(vals)
    if mx == mn:
        return [0.5] * len(vals)
    span = mx - mn
    return [(v - mn) / span for v in vals]


def _assign_archetype(
    dim_a: float, dim_b: float, dim_c: float,
    a_high: float, a_low: float,
    b_high: float, b_low: float,
    c_high: float,
) -> str:
    """
    Assign one of five behavioural archetypes using percentile-based thresholds
    computed from the actual SF distribution (passed in from _normalize_and_score).

    Thresholds: a_high=p70, a_low=p35, b_high=p75, b_low=p50, c_high=p50.
    These self-calibrate so wealthy_inert always captures ~top-quartile inertia
    block groups regardless of how compressed the raw dimension range is.

    active_optimizer:   top-30% sophistication AND below-median inertia (checked first)
    wealthy_inert:      top-25% inertia AND above-median stakes AND NOT top-30% sophisticated
                        (the A upper bound prevents high-A/high-B luxury blocks from misclassifying)
    disengaged_owner:   bottom-35% sophistication AND top-25% inertia
    new_to_wealth:      top-30% sophistication AND above-median inertia (didn't match above)
    price_first_shopper: everyone else
    """
    # Check active_optimizer first — high A + low B overrides everything else
    if dim_a >= a_high and dim_b <= b_low:
        return "active_optimizer" if dim_c >= c_high else "new_to_wealth"
    # wealthy_inert: high inertia + high stakes, but NOT ultra-sophisticated
    # (A < a_high excludes Pacific Heights condos where B is driven by age, not tenure)
    if dim_b >= b_high and dim_c >= c_high and dim_a < a_high:
        return "wealthy_inert"
    if dim_a <= a_low and dim_b >= b_high:
        return "disengaged_owner"
    return "price_first_shopper"


def _normalize_and_score(bgs: List[ACSBlockGroup]) -> None:
    """
    In-place: compute normalized dimension scores and acs_receptivity for every
    block group. Normalization is min-max across the full SF block group distribution.

    Dimension A — Financial sophistication: predicts active vs. passive insurance management.
      = college_pct×0.35 + white_collar×0.35 + income×0.30

    Dimension B — Inertia / set-and-forget: predicts underinsurance accumulation.
      = median_age×0.35 + long_tenure×0.40 + free_and_clear×0.25

    Dimension C — Coverage stakes: predicts dollar magnitude of the insurance problem.
      = median_home_value×0.50 + owner_occupancy_rate×0.25 + pct_high_value×0.25

    ACS receptivity = A×0.35 + B×0.40 + C×0.25

    Archetype thresholds are percentile-based so they self-calibrate to the loaded
    distribution. SF's inertia dimension is naturally compressed (B max ≈ 0.60) because
    no single block group dominates all three inertia components simultaneously.
    """
    def _col(attr): return [getattr(bg, attr) for bg in bgs]

    college_n  = _mnorm(_col("pct_college_educated"))
    wc_n       = _mnorm(_col("pct_white_collar"))
    income_n   = _mnorm([bg.median_income / 100_000 for bg in bgs])

    age_n      = _mnorm([bg.median_age / 80 for bg in bgs])
    tenure_n   = _mnorm(_col("pct_long_tenure_owners"))
    free_n     = _mnorm(_col("pct_free_and_clear"))

    hv_n       = _mnorm([bg.median_home_value / 1_000_000 for bg in bgs])
    oo_n       = _mnorm(_col("owner_occupancy_rate"))
    hvpct_n    = _mnorm(_col("pct_high_value_homes"))

    for i, bg in enumerate(bgs):
        fin_soph = college_n[i] * 0.35 + wc_n[i] * 0.35 + income_n[i] * 0.30
        inertia  = age_n[i]    * 0.35 + tenure_n[i] * 0.40 + free_n[i] * 0.25
        stakes   = hv_n[i]     * 0.50 + oo_n[i]     * 0.25 + hvpct_n[i] * 0.25

        bg.financial_sophistication = round(fin_soph, 3)
        bg.inertia_score            = round(inertia, 3)
        bg.coverage_stakes          = round(stakes, 3)
        bg.acs_receptivity          = round(fin_soph * 0.35 + inertia * 0.40 + stakes * 0.25, 3)

    # Compute percentile thresholds after all scores are set, then assign archetypes
    def _pct(attr: str, p: float) -> float:
        vals = sorted(getattr(bg, attr) for bg in bgs)
        return vals[int(len(vals) * p)]

    a_high = _pct("financial_sophistication", 0.70)  # top 30%
    a_low  = _pct("financial_sophistication", 0.35)  # bottom 35%
    b_high = _pct("inertia_score",            0.75)  # top 25%
    b_low  = _pct("inertia_score",            0.50)  # bottom 50%
    c_high = _pct("coverage_stakes",          0.50)  # above median

    for bg in bgs:
        bg.archetype = _assign_archetype(
            bg.financial_sophistication, bg.inertia_score, bg.coverage_stakes,
            a_high=a_high, a_low=a_low, b_high=b_high, b_low=b_low, c_high=c_high,
        )


def build_block_group_index(api_key: str) -> Dict[str, ACSBlockGroup]:
    """
    Fetch ACS data for all SF block groups, compute normalized dimension scores,
    and return a lookup dict {geoid_12: ACSBlockGroup}.

    Makes ~4 Census API calls. Typical runtime: 5–15 seconds.
    """
    if not api_key:
        raise RuntimeError("CENSUS_API_KEY is required for ACS block group data.")
    print("Fetching ACS block group data for SF County...")
    raw = fetch_sf_acs(api_key)
    bgs = [bg for row in raw.values() if (bg := _derived(row)) is not None]
    _normalize_and_score(bgs)
    print(f"  {len(bgs)} block groups loaded and scored.")
    return {bg.geoid: bg for bg in bgs}


# ---------------------------------------------------------------------------
# Local point-in-polygon geocoder — no HTTP calls per parcel
# ---------------------------------------------------------------------------
# Downloads SF block group polygons from TIGER REST API once and caches them.
# All subsequent lookups are pure Python geometry — ~1-2s for 25k points vs
# 20+ minutes of per-parcel Census Geocoder API calls.

TIGER_URL = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/"
    "TIGERweb/tigerWMS_ACS2024/MapServer/10/query"
)
TIGER_CACHE_PATH = "data/sf_block_groups_tiger.json"


def _fetch_tiger_polygons(cache_path: str = TIGER_CACHE_PATH) -> List[dict]:
    """
    Fetch SF block group polygons from TIGER REST API. Returns list of
    {geoid, rings} dicts. Cached to disk after first fetch (~1s).
    """
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            return json.load(f)

    print("  Fetching SF block group polygons from TIGER API...")
    features = []
    offset = 0
    while True:
        resp = requests.get(
            TIGER_URL,
            params={
                "where": "STATE='06' AND COUNTY='075'",
                "outFields": "GEOID",
                "returnGeometry": "true",
                "geometryPrecision": 5,
                "outSR": "4326",
                "resultRecordCount": 1000,
                "resultOffset": offset,
                "f": "json",
            },
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        batch = data.get("features", [])
        for f in batch:
            features.append({
                "geoid": f["attributes"]["GEOID"][:12],
                "rings": f["geometry"]["rings"],
            })
        if not data.get("exceededTransferLimit") or not batch:
            break
        offset += len(batch)

    os.makedirs(os.path.dirname(os.path.abspath(cache_path)), exist_ok=True)
    with open(cache_path, "w") as fp:
        json.dump(features, fp)
    print(f"  Cached {len(features)} block group polygons → {cache_path}")
    return features


def _bbox(rings: List[List[List[float]]]) -> Tuple[float, float, float, float]:
    xs = [p[0] for ring in rings for p in ring]
    ys = [p[1] for ring in rings for p in ring]
    return min(xs), min(ys), max(xs), max(ys)


def _point_in_rings(lng: float, lat: float, rings: List[List[List[float]]]) -> bool:
    """Ray-casting point-in-polygon. Handles multi-ring polygons (holes)."""
    inside = False
    for ring in rings:
        n = len(ring)
        j = n - 1
        for i in range(n):
            xi, yi = ring[i]
            xj, yj = ring[j]
            if ((yi > lat) != (yj > lat)) and (
                lng < (xj - xi) * (lat - yi) / (yj - yi) + xi
            ):
                inside = not inside
            j = i
    return inside


class LocalGeocoder:
    """
    Instant point-in-polygon lookup against pre-fetched TIGER block group polygons.
    Bounding-box pre-filter reduces candidates from ~600 to ~5-15 per point.
    """

    def __init__(self, features: List[dict]):
        self._polys: List[Tuple[str, List, Tuple]] = [
            (f["geoid"], f["rings"], _bbox(f["rings"])) for f in features
        ]

    def lookup(self, lat: float, lng: float) -> Optional[str]:
        for geoid, rings, (x0, y0, x1, y1) in self._polys:
            if x0 <= lng <= x1 and y0 <= lat <= y1:
                if _point_in_rings(lng, lat, rings):
                    return geoid
        return None


def build_local_geocoder(cache_path: str = TIGER_CACHE_PATH) -> "LocalGeocoder":
    """Load (or fetch-and-cache) TIGER polygons and return a LocalGeocoder."""
    return LocalGeocoder(_fetch_tiger_polygons(cache_path))


def batch_geocode(
    lat_lngs: List[Tuple[float, float]],
    cache_path: str = TIGER_CACHE_PATH,  # ignored; kept for call-site compatibility
    workers: int = 8,                    # ignored; PiP is local, no threads needed
) -> Dict[Tuple[float, float], Optional[str]]:
    """
    Map (lat, lng) pairs to block group GEOIDs using local point-in-polygon
    against TIGER block group polygons (no per-point HTTP calls).

    First call: ~3s to fetch+cache 681 polygons, then ~1s to classify all points.
    Subsequent calls: instant (polygon cache on disk at TIGER_CACHE_PATH).

    Returns {(lat, lng): geoid_12 | None}.
    """
    geocoder = build_local_geocoder()   # always uses TIGER_CACHE_PATH
    unique = list({pair for pair in lat_lngs})
    print(f"  Classifying {len(unique)} coordinates via local PiP...")
    result = {pair: geocoder.lookup(pair[0], pair[1]) for pair in unique}
    resolved = sum(1 for v in result.values() if v)
    print(f"  Done. {resolved}/{len(unique)} resolved.")
    return {pair: result[pair] for pair in lat_lngs}
