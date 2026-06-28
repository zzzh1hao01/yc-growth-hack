"""
Insurance Intelligence Layer — scores SF homeowner parcels by underinsurance likelihood.

All scoring runs on the SF Assessor secured roll (wv5m-vpq2) with no paid or deed data.
Outputs are JSON records consumed by the frontend. ACS enrichment is optional but
recommended — activate by setting CENSUS_API_KEY before calling assemble_full().

---
SCORING SYSTEM
---

Layer 1 — Need score  (how underinsured is this home?)

    When a homeowner buys, Coverage A is set ≈ rebuild cost. Two inflation rates then
    diverge: the carrier adjusts coverage ~3.5%/yr; true construction costs rise ~5%/yr.
    The shortfall compounds with every year held:

        gap_pct = 1 − (carrier_inflation / construction_inflation) ^ years_owned

    A 1987 purchase has ~42% underinsurance. A 2020 purchase has ~7%.
    need_score normalises so 40% gap = 1.0 (maximum need).

Layer 2 — Timing score  (when is the right moment to reach out?)

    Three components, weighted to sum 1.0:
      - Renewal proximity (0.20): peaks 45 days before the policy anniversary
      - Recent purchase   (0.50): full score if bought within the last year
      - Tenure sweet spot (0.30): peaks at 7–15 years owned

    Attenuated by 0.5 when tenure is estimated from year-built (no real sale date).
    Zero when no date signal is available at all (~3% of parcels).

Layer 3 — ACS receptivity  (will they engage, and how?)

    Block-group Census demographics, three normalised dimensions:
      - Financial sophistication (education + occupation + income): active reviewer vs. auto-renewer
      - Inertia (age + long tenure + free-and-clear rate): policy drift accumulation probability
      - Coverage stakes (home value + ownership rate): dollar magnitude of the problem

    acs_receptivity = sophistication × 0.35 + inertia × 0.40 + stakes × 0.25

Composite:

    Without ACS:  composite = need × 0.70 + timing × 0.30
    With ACS:     composite = need × 0.45 + timing × 0.30 + acs_receptivity × 0.25

    worth_outreach = composite ≥ 0.67  (~top 10% of SFR owner-occupied parcels)
"""
import argparse
import datetime
import os
from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional

import requests

from scoring.sources import DATASETS, SOCRATA_BASE, fetch_all, normalize_block_lot

if TYPE_CHECKING:
    from scoring.acs import ACSBlockGroup

PROP13_ANNUAL_CAP = 1.02  # CA Prop 13 max assessed-value growth per year
THIS_YEAR = datetime.date.today().year

# SF residential reconstruction cost ($/sqft). Documented range ~$400-600; $500
# is a conservative mid-point. Parameterized at the call site (--psf) so it can be
# tuned without touching code. This is the ONLY assumption in the replacement-cost
# gap — everything else is real assessor data.
CONSTRUCTION_PSF_DEFAULT = 500.0


def latest_roll_year() -> str:
    """Most recent closed_roll_year present in the assessor dataset (auto-detect,
    so this never silently runs on a stale roll)."""
    resp = requests.get(
        f"{SOCRATA_BASE}/{DATASETS['assessor']}.json",
        params={"$select": "max(closed_roll_year) as y"},
        timeout=60,
    )
    resp.raise_for_status()
    rows = resp.json()
    return rows[0]["y"] if rows and rows[0].get("y") else "2025"

_RESIDENTIAL = (
    "(upper(use_definition) like '%RESIDENTIAL%' "
    "OR upper(use_definition) like '%DWELLING%' "
    "OR upper(use_definition) like '%FLAT%' "
    "OR upper(use_definition) like '%APARTMENT%')"
)

_SELECT = (
    "block,lot,property_location,analysis_neighborhood,use_definition,"
    "year_property_built,current_sales_date,homeowner_exemption_value,"
    "assessed_land_value,assessed_improvement_value,property_area"
)


def _f(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _year_of(date_str: str | None) -> int | None:
    if not date_str:
        return None
    try:
        return int(str(date_str)[:4])
    except ValueError:
        return None


def _clean_address(raw: str) -> str:
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


def appreciation_gap(rec: dict, roll_year: int) -> dict | None:
    """
    Per-parcel appreciation gap from assessor fields only. Returns None when the
    inputs needed for the Prop 13 inversion are missing/degenerate.

    The Prop 13 factor un-escalates from the roll's lien date (roll_year), NOT
    today: the assessed value reflects 2%/yr growth only up to the roll it came
    from, so years_owned is measured against roll_year.
    """
    key = normalize_block_lot(rec.get("block", ""), rec.get("lot", ""))
    if not key:
        return None

    land = _f(rec.get("assessed_land_value")) or 0.0
    impr = _f(rec.get("assessed_improvement_value")) or 0.0
    current_assessed = land + impr
    if current_assessed <= 0:
        return None  # no assessed value -> cannot anchor

    sale_year = _year_of(rec.get("current_sales_date"))
    if sale_year is None:
        return None  # no reassessment date -> cannot date the base year
    years_owned = max(roll_year - sale_year, 0)

    factor = PROP13_ANNUAL_CAP ** years_owned
    purchase_price_proxy = current_assessed / factor
    gap_dollars = current_assessed - purchase_price_proxy
    gap_pct = (current_assessed / purchase_price_proxy) - 1 if purchase_price_proxy else 0.0

    return {
        "household_id": f"{key[0]}-{key[1]}",
        "address": _clean_address(rec.get("property_location", "")),
        "neighborhood": rec.get("analysis_neighborhood"),
        "owner_occupied": (_f(rec.get("homeowner_exemption_value")) or 0.0) > 0,
        "purchase_year": sale_year,
        "years_owned": years_owned,
        "current_assessed_value": round(current_assessed),
        "purchase_price_proxy": round(purchase_price_proxy),
        "appreciation_gap_dollars": round(gap_dollars),
        "appreciation_gap_pct": round(gap_pct, 4),
    }


def replacement_cost_gap(rec: dict, config: "InsuranceScoringConfig", drift_years: float) -> dict | None:
    """
    Insurance NEED signal — underinsurance from the carrier's inflation guard lagging
    construction-cost inflation (the real mechanism). Free, assessor-only. Returns
    None when sqft is missing.

        replacement_cost_today = property_area_sqft * construction_psf   (REAL rebuild cost)
        coverage_anchor        = replacement_cost_today
                                 * (carrier_inflation / construction_inflation) ^ drift_years
        gap_dollars            = replacement_cost_today - coverage_anchor
        gap_pct                = 1 - (carrier_inflation / construction_inflation) ^ drift_years

    Rationale: a homeowner sets Coverage A ~= replacement cost AT PURCHASE, the carrier
    nudges it ~carrier_inflation/yr, but true rebuild cost rises ~construction_inflation/yr
    (faster). The shortfall compounds with years held. This REPLACES the earlier
    assessed_improvement_value anchor, which understated the gap in SF because
    assessments are land-heavy (land >> improvement), inflating the gap to 80-95%.

    `drift_years` is supplied by the caller (see coverage_drift_years): real tenure for
    high-confidence parcels, a capped year-built proxy otherwise — so this never claims
    a century of coverage drift. The dollar amount stays grounded in real rebuild cost.
    """
    key = normalize_block_lot(rec.get("block", ""), rec.get("lot", ""))
    if not key:
        return None

    sqft = _f(rec.get("property_area")) or 0.0
    if sqft < 100:
        return None  # no usable structure area -> cannot estimate rebuild cost

    replacement_cost = sqft * config.construction_psf
    drift = (config.carrier_inflation / config.construction_inflation) ** max(drift_years, 0.0)
    coverage_anchor = replacement_cost * drift
    gap_dollars = replacement_cost - coverage_anchor
    gap_pct = 1.0 - drift

    return {
        "household_id": f"{key[0]}-{key[1]}",
        "address": _clean_address(rec.get("property_location", "")),
        "neighborhood": rec.get("analysis_neighborhood"),
        "owner_occupied": (_f(rec.get("homeowner_exemption_value")) or 0.0) > 0,
        "sqft": round(sqft),
        "construction_psf": config.construction_psf,
        "drift_years": round(drift_years, 1),
        "replacement_cost_today": round(replacement_cost),
        "coverage_anchor": round(coverage_anchor),
        "replacement_cost_gap_dollars": round(gap_dollars),
        "replacement_cost_gap_pct": round(gap_pct, 4),
    }


def coverage_drift_years(timing: dict, config: "InsuranceScoringConfig") -> float:
    """
    Years of coverage drift to use in the replacement-cost gap, by tenure confidence:
      high : real tenure (sale date), capped at max_coverage_drift_years
      low/none : a flat assumed tenure (we don't know when they bought; using the
                 year-built age here would overstate and cluster old buildings)
    """
    conf, y = timing["timing_confidence"], timing["years_owned"]
    if conf == "high" and y is not None:
        return float(min(y, config.max_coverage_drift_years))
    return float(config.assumed_tenure_unknown)


def timing_origin(rec: dict, roll_year: int) -> dict:
    """
    Resolve the ownership-tenure origin used for the timing signal, with a
    confidence flag instead of dropping parcels that lack a sale date.

      high : real current_sales_date present -> origin = sale year
      low  : no sale date, but a usable year_property_built (>1900, SF's "unknown"
             placeholder) -> origin = year built (assumes owner-since-built; this
             OVERSTATES tenure, hence flagged low-confidence, never silently used)
      none : neither available -> no timing signal (~3% of residential parcels)

    NOTE: this is data-prep only (it picks the tenure clock + confidence). It does
    NOT compute any score — scoring is a later step.
    """
    sale_year = _year_of(rec.get("current_sales_date"))
    if sale_year is not None:
        return {
            "timing_confidence": "high",
            "timing_source": "current_sales_date",
            "origin_year": sale_year,
            "years_owned": max(roll_year - sale_year, 0),
        }

    yb = _year_of(rec.get("year_property_built"))
    if yb is not None and yb > 1900:
        return {
            "timing_confidence": "low",
            "timing_source": "year_property_built",
            "origin_year": yb,
            "years_owned": max(roll_year - yb, 0),
        }

    return {
        "timing_confidence": "none",
        "timing_source": None,
        "origin_year": None,
        "years_owned": None,
    }


# ---------------------------------------------------------------------------
# Insurance scoring (Step 4)
# ---------------------------------------------------------------------------
@dataclass
class InsuranceScoringConfig:
    """
    Insurance lead scoring config. Parameterized so it works WITHOUT deed/price
    data (our case: no paid data) and so extra need-components can be switched on
    later by giving them a non-zero weight.

    Per the 2026-06-28 decision: NEED is replacement-cost-gap-first; the permit,
    home-age, and flood components exist but are weighted 0 until wired in. Composite
    is need-first (0.70/0.30), not the reference doc's 0.60/0.40.
    """
    # need_score component weights (only replacement-cost gap active now)
    w_replacement_gap: float = 1.00
    w_permit_gap: float = 0.0     # permits are in the pipeline; enable later
    w_home_age: float = 0.0       # year-built risk; enable later
    w_flood: float = 0.0          # FEMA not wired; enable later
    # timing_score component weights (reference doc, normalized to sum 1.0)
    w_renewal_proximity: float = 0.20
    w_recent_trigger: float = 0.50
    w_tenure: float = 0.30
    # composite (need-first)
    w_need: float = 0.70
    w_timing: float = 0.30
    # behavior
    construction_psf: float = CONSTRUCTION_PSF_DEFAULT
    carrier_inflation: float = 1.035     # carrier's annual coverage bump (inflation guard, ~3-4%)
    construction_inflation: float = 1.05  # construction cost index growth (~4-6%, outpaces carrier)
    max_coverage_drift_years: int = 40   # cap tenure used in the gap (sanity ceiling)
    assumed_tenure_unknown: int = 20     # tenure assumed when no real sale date (low/none conf)
    need_gap_full_scale: float = 0.40    # gap% that maps to maximum need (0-1 normalization)
    include_deed: bool = False           # no paid deed/price feed
    recent_trigger_years: int = 1        # "recent mover" window (annual roll -> 1yr, not 60d)
    low_conf_timing_factor: float = 0.5  # attenuate timing when tenure is year-built fallback
    enrichment_threshold: float = 0.67   # composite above this -> worth outreach.
                                         # Recalibrated from 0.70 for the 3-component ACS formula
                                         # (need×0.45 + timing×0.30 + acs×0.25 compresses the
                                         # distribution; p90≈0.68, so 0.67 targets ~top 10%).
    # ACS modifier weights (applied when ACS block group data is available)
    # Replaces w_need/w_timing when ACS is present per the plan's 3-component formula.
    w_need_with_acs: float = 0.45
    w_timing_with_acs: float = 0.30
    w_acs: float = 0.25


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _replacement_gap_score(gap_pct: float, full_scale: float) -> float:
    """% underinsured -> 0-1 need. `full_scale` is the gap that counts as maximum
    need (e.g. 0.40 -> a 40% rebuild-cost shortfall maxes the score)."""
    return _clamp01(gap_pct / full_scale) if full_scale else 0.0


def _renewal_proximity_score(sale_date_str: str | None, today: datetime.date | None = None) -> float:
    """
    X-date proximity: peaks (1.0) ~45 days before the policy anniversary (the sale
    date's month/day), decaying to 0 by ~135 days out. Only meaningful with a real
    sale date; returns 0 when absent/unparseable.
    """
    if not sale_date_str:
        return 0.0
    today = today or datetime.date.today()
    try:
        d = datetime.date.fromisoformat(str(sale_date_str)[:10])
    except ValueError:
        return 0.0
    try:
        anniv = d.replace(year=today.year)
    except ValueError:               # Feb 29 -> Mar 1
        anniv = datetime.date(today.year, 3, 1)
    if anniv < today:
        anniv = anniv.replace(year=today.year + 1)
    days_to = (anniv - today).days
    return _clamp01(1.0 - abs(days_to - 45) / 90.0)


def _recent_trigger_score(years_owned: int | None, window: int) -> float:
    """1.0 if bought within `window` years (mandatory-coverage / new-mover trigger)."""
    return 1.0 if (years_owned is not None and years_owned <= window) else 0.0


def _tenure_score(years_owned: int | None) -> float:
    """Peaks at 7-15 yrs owned (long enough for coverage to drift, not stale)."""
    if years_owned is None:
        return 0.0
    if years_owned < 7:
        return years_owned / 7.0
    if years_owned <= 15:
        return 1.0
    return max(0.3, 1.0 - (years_owned - 15) / 30.0)


def score_parcel(
    rec: dict,
    roll_year: int,
    config: InsuranceScoringConfig,
    acs_bg: "Optional[ACSBlockGroup]" = None,
) -> dict | None:
    """
    Composite insurance lead score (0-1).

    Without ACS data (default):
        composite = need×0.70 + timing×0.30

    With ACS block group data (when acs_bg is provided):
        composite = need×0.45 + timing×0.30 + acs_receptivity×0.25

    Returns None when the need signal can't be computed (no usable sqft).
    """
    t = timing_origin(rec, roll_year)
    rcg = replacement_cost_gap(rec, config, coverage_drift_years(t, config))
    if rcg is None:
        return None

    # --- need (weighted sum over active components; only replacement gap now) ---
    need_parts = {"replacement_gap": (config.w_replacement_gap,
                                      _replacement_gap_score(rcg["replacement_cost_gap_pct"],
                                                             config.need_gap_full_scale))}
    active_w = sum(w for w, _ in need_parts.values()) or 1.0
    need_score = sum(w * s for w, s in need_parts.values()) / active_w

    # --- timing (per reference doc, attenuated by tenure-source confidence) ---
    conf, years = t["timing_confidence"], t["years_owned"]
    prox = _renewal_proximity_score(rec.get("current_sales_date")) if conf == "high" else 0.0
    recent = _recent_trigger_score(years, config.recent_trigger_years)
    tenure = _tenure_score(years)
    timing_score = (config.w_renewal_proximity * prox
                    + config.w_recent_trigger * recent
                    + config.w_tenure * tenure)
    if conf == "low":
        timing_score *= config.low_conf_timing_factor
    elif conf == "none":
        timing_score = 0.0

    # --- composite: 2-component (property-only) or 3-component (with ACS) ---
    if acs_bg is not None:
        composite = (config.w_need_with_acs * need_score
                     + config.w_timing_with_acs * timing_score
                     + config.w_acs * acs_bg.acs_receptivity)
    else:
        composite = config.w_need * need_score + config.w_timing * timing_score

    result = {
        "household_id": rcg["household_id"],
        "address": rcg["address"],
        "neighborhood": rcg["neighborhood"],
        "owner_occupied": rcg["owner_occupied"],
        "replacement_cost_gap_dollars": rcg["replacement_cost_gap_dollars"],
        "replacement_cost_gap_pct": rcg["replacement_cost_gap_pct"],
        "need_score": round(need_score, 3),
        "timing_score": round(timing_score, 3),
        "timing_confidence": conf,
        "composite_score": round(composite, 3),
        "worth_outreach": composite >= config.enrichment_threshold,
    }
    if acs_bg is not None:
        result["archetype"] = acs_bg.archetype
        result["acs_receptivity_score"] = acs_bg.acs_receptivity
        result["financial_sophistication"] = acs_bg.financial_sophistication
        result["inertia_score"] = acs_bg.inertia_score
        result["coverage_stakes"] = acs_bg.coverage_stakes
    return result


# ---------------------------------------------------------------------------
# Assembly (Step 5) — insurance household records
# ---------------------------------------------------------------------------
# Insurance-optimized target set (data-driven, ranked by avg replacement-cost gap,
# SFR only, 2025 roll). Swap vs the old contractor set: -Noe Valley, +Portola (#1).
TARGET_NEIGHBORHOODS = [
    "Portola",
    "Outer Richmond",
    "West of Twin Peaks",
    "Sunset/Parkside",
    "Inner Sunset",
]

CITYWIDE_NEIGHBORHOODS = [
    "Bayview Hunters Point", "Bernal Heights", "Castro/Upper Market", "Chinatown",
    "Excelsior", "Financial District/South Beach", "Glen Park", "Haight Ashbury",
    "Hayes Valley", "Inner Richmond", "Inner Sunset", "Japantown", "Lakeshore",
    "Lincoln Park", "Lone Mountain/USF", "Marina", "McLaren Park", "Mission",
    "Mission Bay", "Nob Hill", "Noe Valley", "North Beach",
    "Oceanview/Merced/Ingleside", "Outer Mission", "Outer Richmond",
    "Pacific Heights", "Portola", "Potrero Hill", "Presidio", "Presidio Heights",
    "Russian Hill", "Seacliff", "South of Market", "Sunset/Parkside", "Tenderloin",
    "Treasure Island", "Twin Peaks", "Visitacion Valley", "West of Twin Peaks",
    "Western Addition",
]


def _latlng(rec: dict) -> tuple[float | None, float | None]:
    geom = rec.get("the_geom")
    if isinstance(geom, dict) and geom.get("coordinates"):
        return float(geom["coordinates"][1]), float(geom["coordinates"][0])
    return None, None


def insurance_record(
    rec: dict,
    roll_year: int,
    config: InsuranceScoringConfig,
    acs_bg: "Optional[ACSBlockGroup]" = None,
) -> dict | None:
    """One assembled household record in the approved Step-5 JSON shape."""
    s = score_parcel(rec, roll_year, config, acs_bg=acs_bg)
    if s is None:
        return None
    lat, lng = _latlng(rec)
    if lat is None:
        return None  # cannot place on the map -> not a usable lead

    t = timing_origin(rec, roll_year)
    rcg = replacement_cost_gap(rec, config, coverage_drift_years(t, config))
    yb = _year_of(rec.get("year_property_built"))
    sale_year = _year_of(rec.get("current_sales_date"))

    out = {
        "household_id": s["household_id"],
        "address": s["address"],
        "lat": lat,
        "lng": lng,
        "neighborhood": s["neighborhood"],
        "year_built": yb if (yb and yb > 1900) else None,
        "sqft": rcg["sqft"],
        "owner_occupied": s["owner_occupied"],
        "replacement_cost_today": rcg["replacement_cost_today"],
        "coverage_anchor": rcg["coverage_anchor"],
        "replacement_cost_gap_dollars": rcg["replacement_cost_gap_dollars"],
        "replacement_cost_gap_pct": rcg["replacement_cost_gap_pct"],
        "need_score": s["need_score"],
        "timing_score": s["timing_score"],
        "timing_confidence": s["timing_confidence"],
        "composite_score": s["composite_score"],
        "worth_outreach": s["worth_outreach"],
        # only publish tenure when it's a REAL sale date; for the year-built fallback
        # t["years_owned"] is building age, not ownership tenure -> don't expose it.
        "purchase_year": sale_year,
        "years_owned": t["years_owned"] if t["timing_confidence"] == "high" else None,
    }
    # ACS fields — only present when ACS block group data was available
    if acs_bg is not None:
        out["archetype"] = s["archetype"]
        out["acs_receptivity_score"] = s["acs_receptivity_score"]
        out["financial_sophistication"] = s["financial_sophistication"]
        out["inertia_score"] = s["inertia_score"]
        out["coverage_stakes"] = s["coverage_stakes"]
    return out


def fetch_assemble_parcels(neighborhood: str, year: str, limit: int) -> list[dict]:
    """SFR + owner-occupied parcels for assembly, with geometry for the map."""
    return fetch_all(
        "assessor",
        select=_SELECT + ",the_geom",
        where=(
            f"analysis_neighborhood='{neighborhood}' AND closed_roll_year='{year}' "
            f"AND use_definition='Single Family Residential' "
            f"AND homeowner_exemption_value > 0"
        ),
        page=min(limit, 5000),
        max_rows=limit,
        order="block,lot",
    )


def _acs_lookup_fn(acs_index, geoid_map):
    """Return a function that maps a parcel (lat, lng) to its ACSBlockGroup or None."""
    if acs_index is None or geoid_map is None:
        return lambda lat, lng: None
    def _lookup(lat, lng):
        geoid = geoid_map.get((lat, lng))
        return acs_index.get(geoid) if geoid else None
    return _lookup


def _build_acs_geoid_map(parcels, acs_index, geocoder_cache):
    """Geocode all parcels' lat/lngs and return a (lat, lng) → GEOID map."""
    from scoring.acs import batch_geocode
    lat_lngs = []
    for p in parcels:
        lat, lng = _latlng(p)
        if lat is not None:
            lat_lngs.append((lat, lng))
    return batch_geocode(lat_lngs, cache_path=geocoder_cache)


def assemble_sample(
    per_nb_fetch: int,
    sample_per_nb: int,
    config: InsuranceScoringConfig,
    roll_year: int,
    acs_index=None,
    geocoder_cache: str = "data/geocoder_cache.json",
    neighborhoods: list[str] | None = None,
) -> list[dict]:
    """
    Assemble a REVIEW sample: per neighborhood, spread `sample_per_nb` records across
    the composite-score range so the reviewer sees variety (not just the top leads).

    Pass `acs_index` (from scoring.acs.build_block_group_index) to incorporate ACS
    behavioural dimensions into the composite score.
    """
    nbs = neighborhoods or TARGET_NEIGHBORHOODS
    # Fetch all parcels first so we can geocode in one batch pass
    all_parcels: dict[str, list[dict]] = {}
    for nb in nbs:
        all_parcels[nb] = fetch_assemble_parcels(nb, str(roll_year), per_nb_fetch)

    geoid_map = None
    if acs_index is not None:
        flat = [p for ps in all_parcels.values() for p in ps]
        geoid_map = _build_acs_geoid_map(flat, acs_index, geocoder_cache)

    lookup = _acs_lookup_fn(acs_index, geoid_map)
    out: list[dict] = []
    seen: set[str] = set()
    for nb in nbs:
        parcels = all_parcels[nb]
        recs = []
        for p in parcels:
            lat, lng = _latlng(p)
            acs_bg = lookup(lat, lng) if lat is not None else None
            r = insurance_record(p, roll_year, config, acs_bg=acs_bg)
            if r and r["household_id"] not in seen:
                seen.add(r["household_id"])
                recs.append(r)
        recs.sort(key=lambda r: r["composite_score"], reverse=True)
        step = max(1, len(recs) // sample_per_nb)
        picked = recs[::step][:sample_per_nb]
        out.extend(picked)
        print(f"  {nb}: {len(parcels)} SFR/owner-occ -> {len(recs)} scored -> {len(picked)} sampled")
    return out


def assemble_full(
    per_nb_keep: int,
    config: InsuranceScoringConfig,
    roll_year: int,
    fetch_cap: int = 30000,
    acs_index=None,
    geocoder_cache: str = "data/geocoder_cache.json",
    neighborhoods: list[str] | None = None,
) -> list[dict]:
    """
    Full run: per neighborhood, fetch all SFR/owner-occ parcels, score, and keep the
    TOP `per_nb_keep` by composite score (not a spread). Sums to ~`per_nb_keep` × 5.

    Pass `acs_index` (from scoring.acs.build_block_group_index) to incorporate ACS
    behavioural dimensions into the composite score.
    """
    nbs = neighborhoods or TARGET_NEIGHBORHOODS
    all_parcels: dict[str, list[dict]] = {}
    for nb in nbs:
        all_parcels[nb] = fetch_assemble_parcels(nb, str(roll_year), fetch_cap)

    geoid_map = None
    if acs_index is not None:
        flat = [p for ps in all_parcels.values() for p in ps]
        geoid_map = _build_acs_geoid_map(flat, acs_index, geocoder_cache)

    lookup = _acs_lookup_fn(acs_index, geoid_map)
    out: list[dict] = []
    seen: set[str] = set()
    for nb in nbs:
        parcels = all_parcels[nb]
        recs = []
        for p in parcels:
            lat, lng = _latlng(p)
            acs_bg = lookup(lat, lng) if lat is not None else None
            r = insurance_record(p, roll_year, config, acs_bg=acs_bg)
            if r and r["household_id"] not in seen:
                seen.add(r["household_id"])
                recs.append(r)
        recs.sort(key=lambda r: r["composite_score"], reverse=True)
        kept = recs[:per_nb_keep]
        out.extend(kept)
        print(f"  {nb}: {len(parcels)} fetched -> {len(recs)} scored -> kept top {len(kept)}")
    out.sort(key=lambda r: r["composite_score"], reverse=True)
    return out


def fetch_parcels(neighborhood: str, year: str, limit: int) -> list[dict]:
    return fetch_all(
        "assessor",
        select=_SELECT,
        where=(
            f"analysis_neighborhood='{neighborhood}' AND closed_roll_year='{year}' "
            f"AND {_RESIDENTIAL}"
        ),
        page=min(limit, 5000),
        max_rows=limit,
        order="block,lot",
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--neighborhood", default="Noe Valley")
    ap.add_argument("--limit", type=int, default=400)
    ap.add_argument("--roll-year", default=None, help="assessor roll year (default: auto-detect latest)")
    ap.add_argument("--psf", type=float, default=CONSTRUCTION_PSF_DEFAULT, help="SF construction $/sqft")
    ap.add_argument("--assemble", action="store_true", help="assemble a 30-record review sample")
    ap.add_argument("--full", action="store_true", help="full run: top ~cap leads across the 5 neighborhoods")
    ap.add_argument("--sample", type=int, default=30, help="(assemble) total review records to emit")
    ap.add_argument("--cap", type=int, default=2000, help="(full) total record cap across neighborhoods")
    ap.add_argument("--out", default=None, help="output JSON path")
    ap.add_argument("--no-acs", action="store_true",
                    help="skip ACS layer even if CENSUS_API_KEY is set")
    args = ap.parse_args()

    roll_year = int(args.roll_year or latest_roll_year())

    if args.assemble or args.full:
        import json
        config = InsuranceScoringConfig(construction_psf=args.psf)

        # ACS layer — opt-in via CENSUS_API_KEY env var (--no-acs to force skip)
        acs_index = None
        if not args.no_acs:
            api_key = os.environ.get("CENSUS_API_KEY", "")
            if api_key:
                from scoring.acs import build_block_group_index
                acs_index = build_block_group_index(api_key)
            else:
                print("(ACS layer skipped: set CENSUS_API_KEY env var to enable)")

        if args.full:
            out = args.out or "household_records.json"
            per_nb_keep = max(1, args.cap // len(TARGET_NEIGHBORHOODS))
            mode = "ACS-augmented" if acs_index else "property-only"
            print(f"FULL run ({mode}, roll {roll_year}, ${args.psf:.0f}/sqft, top {per_nb_keep}/neighborhood):")
            records = assemble_full(per_nb_keep, config, roll_year, acs_index=acs_index, neighborhoods=TARGET_NEIGHBORHOODS)
            records = records[: args.cap]
        else:
            out = args.out or "household_sample.json"
            sample_per_nb = max(1, args.sample // len(TARGET_NEIGHBORHOODS))
            mode = "ACS-augmented" if acs_index else "property-only"
            print(f"Review sample ({mode}, roll {roll_year}, ${args.psf:.0f}/sqft, {sample_per_nb}/neighborhood):")
            records = assemble_sample(400, sample_per_nb, config, roll_year, acs_index=acs_index)
        with open(out, "w") as f:
            json.dump(records, f, indent=2)
        worth = sum(1 for r in records if r["worth_outreach"])
        print(f"\nWrote {len(records)} records to {out}  ({worth} worth_outreach)")
        return

    parcels = fetch_parcels(args.neighborhood, str(roll_year), args.limit)

    demo_cfg = InsuranceScoringConfig(construction_psf=args.psf)
    rows = []
    for p in parcels:
        t = timing_origin(p, roll_year)
        g = replacement_cost_gap(p, demo_cfg, coverage_drift_years(t, demo_cfg))
        if not g:
            continue
        g.update(t)  # attach tenure context
        rows.append(g)
    rows.sort(key=lambda g: g["replacement_cost_gap_dollars"], reverse=True)

    print(f"\n{args.neighborhood} (roll {roll_year}, ${args.psf:.0f}/sqft): "
          f"{len(parcels)} parcels -> {len(rows)} with computable replacement-cost gap\n")
    print("5-row sample (most underinsured):\n")
    hdr = f"{'household_id':<12} {'addr':<22} {'yrs':>4} {'sqft':>6} {'rebuild_cost':>13} {'coverage':>12} {'gap_$':>12} {'gap_%':>7}"
    print(hdr)
    print("-" * len(hdr))
    for g in rows[:5]:
        yrs = g["years_owned"] if g["years_owned"] is not None else "?"
        print(
            f"{g['household_id']:<12} {g['address'][:22]:<22} {str(yrs):>4} {g['sqft']:>6,} "
            f"${g['replacement_cost_today']:>12,} ${g['coverage_anchor']:>11,} "
            f"${g['replacement_cost_gap_dollars']:>11,} {g['replacement_cost_gap_pct']*100:>6.1f}%"
        )

    if rows:
        import statistics
        med = statistics.median(g["replacement_cost_gap_dollars"] for g in rows)
        pos = sum(1 for g in rows if g["replacement_cost_gap_dollars"] > 0)
        print(f"\nmedian gap: ${med:,.0f}   |   underinsured (gap>0): {pos}/{len(rows)} "
              f"({pos/len(rows)*100:.0f}%)")
        # sanity: gap should rise with tenure
        def avg_gap(lo, hi):
            sub = [g["replacement_cost_gap_dollars"] for g in rows
                   if g["years_owned"] is not None and lo <= g["years_owned"] < hi]
            return (sum(sub) / len(sub), len(sub)) if sub else (0, 0)
        print("\nmean gap by tenure (validates recent=insured, long-held=underinsured):")
        for label, lo, hi in [("0-5 yrs", 0, 5), ("5-15 yrs", 5, 15), ("15-30 yrs", 15, 30), ("30+ yrs", 30, 200)]:
            m, n = avg_gap(lo, hi)
            print(f"  {label:<10} n={n:>3}  mean gap ${m:>12,.0f}")


if __name__ == "__main__":
    main()
