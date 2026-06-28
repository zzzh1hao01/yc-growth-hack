# HouseholdIQ — Insurance Intelligence Layer

Identifies SF homeowners who are likely underinsured and ranks them by outreach priority.
Product vision: `BRIEF.md`.

---

## Data backbone

All scoring runs on two freely available SF datasets joined on `block + lot`:

| Dataset | DataSF ID | Fields used |
|---|---|---|
| Assessor secured roll (2025) | `wv5m-vpq2` | `year_property_built`, `current_sales_date`, `homeowner_exemption_value`, `assessed_improvement_value`, `property_area`, `the_geom` |
| ACS 5-year estimates (2024) | `api.census.gov` | Income, education, age, housing tenure, mortgage status, home value, occupation — at block-group level |

Scope: **SFR + owner-occupied** (`homeowner_exemption_value > 0`) parcels with a valid lat/lng.
No paid data, no deed/transaction records. The assessor roll has no sale-price field — all signals are derived from publicly available fields.

Parcels are joined to Census block groups via a local point-in-polygon lookup against TIGER block group polygons (`data/sf_block_groups_tiger.json`). This replaces per-parcel Census Geocoder API calls — ~1s for 60k points vs 20+ minutes.

---

## Scoring metrics

Three layers combine into a single `composite_score` (0–1) per parcel.

### Layer 1 — Need score: how underinsured is this home?

Carrier inflation (~3.5%/yr) lags construction cost inflation (~5%/yr). When a homeowner buys, Coverage A is set ≈ rebuild cost. That gap compounds with every year held:

```
replacement_cost_today = sqft × $500/sqft
coverage_anchor        = replacement_cost_today × (3.5% / 5.0%) ^ years_owned
gap_pct                = 1 − (3.5% / 5.0%) ^ years_owned
need_score             = min(gap_pct / 0.40, 1.0)   ← 40% gap = maximum need
```

A 1987 purchase: $660k rebuild vs ~$382k assumed coverage = **$278k / 42% underinsured**.

Tenure is taken from `current_sales_date` where available (71% of parcels, `high` confidence). When absent, `year_property_built` is used as a fallback (26%, `low` confidence — overstates tenure, flagged). 3% of parcels have no date signal and are scored on need alone.

### Layer 2 — Timing score: when is the right moment to reach out?

| Component | Weight | Logic |
|---|---:|---|
| Renewal proximity | 0.20 | Peaks 45 days before the sale-date anniversary (when the policy renews) |
| Recent purchase | 0.50 | Full score if bought within the last year — new owner setting first policy |
| Tenure sweet spot | 0.30 | Ramps up to 1.0 at 7 yrs, holds to 15 yrs, then decays |

Timing score is halved for low-confidence tenure, zeroed when no date signal exists.

### Layer 3 — ACS receptivity: will they engage, and how?

Three dimensions computed from Census block-group demographics, each min-max normalised across all 681 SF block groups:

| Dimension | Variables | Weight |
|---|---|---:|
| Financial sophistication | % college-educated, % white-collar, median income | 0.35 |
| Inertia | Median age, % owned 25+ years, % free-and-clear | 0.40 |
| Coverage stakes | Median home value, owner-occupancy rate, % homes ≥$500k | 0.25 |

```
acs_receptivity = sophistication × 0.35 + inertia × 0.40 + stakes × 0.25
```

Each block group is assigned one of five archetypes that drives agent conversation framing:

| Archetype | Condition | Opening |
|---|---|---|
| `wealthy_inert` | High inertia + high stakes | Lead with the dollar gap amount |
| `active_optimizer` | High sophistication + low inertia + high stakes | Data-first, specific numbers |
| `new_to_wealth` | High sophistication + low inertia + low stakes | Educational, first policy review |
| `disengaged_owner` | Low sophistication + high inertia | Simple, concrete, loss-salient |
| `price_first_shopper` | Default | Lead with premium comparison |

### Composite

```
composite = need × 0.45 + timing × 0.30 + acs_receptivity × 0.25

worth_outreach = composite ≥ 0.67   (~top 10% of SFR owner-occupied parcels)
```

---

## Output

`data/household_records_acs_citywide.json` — 1,872 scored records across all 40 SF neighborhoods, 334 flagged `worth_outreach`.

```
household_id, address, lat, lng, neighborhood, year_built, sqft, owner_occupied,
replacement_cost_today, coverage_anchor, replacement_cost_gap_dollars, replacement_cost_gap_pct,
need_score, timing_score, timing_confidence, composite_score, worth_outreach,
purchase_year, years_owned, archetype, acs_receptivity_score,
financial_sophistication, inertia_score, coverage_stakes
```

---

## How to run

```bash
pip install -r requirements.txt
export CENSUS_API_KEY=your_key   # free: https://api.census.gov/data/key_signup.html

python3 - <<'EOF'
import json, os
from explore.insurance import InsuranceScoringConfig, assemble_full, latest_roll_year, CITYWIDE_NEIGHBORHOODS
from explore.acs import build_block_group_index

acs_index = build_block_group_index(os.environ["CENSUS_API_KEY"])
records = assemble_full(50, InsuranceScoringConfig(), int(latest_roll_year()),
                        acs_index=acs_index, neighborhoods=CITYWIDE_NEIGHBORHOODS)
json.dump(records[:2000], open("data/household_records_acs_citywide.json", "w"), indent=2)
EOF
```

---

## Files

| File | Purpose |
|---|---|
| `explore/sources.py` | SF Assessor SODA fetch layer |
| `explore/insurance.py` | Scoring engine — need, timing, composite |
| `explore/acs.py` | ACS block-group layer — dimensions, archetypes |
| `data/household_records_acs_citywide.json` | Canonical output — 1,872 scored leads, all 40 SF neighborhoods |
| `data/geocoder_cache.json` | Parcel → block group GEOID via local point-in-polygon |
| `data/sf_block_groups_tiger.json` | TIGER block group polygons |
| `tests/test_slice1_corrected.py` | Regression tests against live SF Open Data |
| `BRIEF.md` | Product vision |
| `.env` | `CENSUS_API_KEY` (gitignored) |
