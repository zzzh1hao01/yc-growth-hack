# HouseholdIQ — Insurance Intelligence Layer: Build Log

Single running doc for the insurance pivot. Reference: `core_property_layer.md`.
Reuses the existing assessor (`wv5m-vpq2`) + permit block/lot pipeline in `explore/`.
All scoring/signal code lives in `explore/insurance.py`.

---

## Step 1 — Backbone confirmed + deed access tested

### Backbone (assessor + permit join) — INTACT ✅
Verified live against DataSF SODA (2026-06-28):

| Dataset | ID | Live check | Join fields present |
|---|---|---|---|
| Assessor secured roll | `wv5m-vpq2` | 3.93M rows; latest roll **2025** (~211k parcels/yr) | `block`, `lot`, `the_geom`, `assessed_land_value`, `assessed_improvement_value`, `current_sales_date`, `homeowner_exemption_value`, `property_area`, `year_property_built` |
| Building permits | `i98e-djp9` | 1,291,206 rows | `block`, `lot`, `estimated_cost`, `status`, `filed_date` |
| Electrical | `ftty-kx6y` | (in pipeline) | `block`, `lot` |
| Plumbing/mechanical | `a6aw-rudh` | (in pipeline) | `block`, `lot` |

The validated block+lot equi-join (`normalize_block_lot`, ~86–92% hit rate) is reused
unchanged. **Not rebuilt.**

> ⚠️ **The assessor roll has NO sale-price field** (date only). A true purchase-price gap
> would need deed/transfer-tax data → tested below.

### Deed / transaction bulk access — tested (accessible? how? volume?)
- **No DataSF deed/sales/transaction dataset exists.** Catalog scan + web search for
  deed/sale/transfer/recorder/ownership → nothing but `wv5m-vpq2` itself and sales-*tax* data.
- **recorder.sfgov.org has an API but it is not a bulk feed.** It's the Avenu/GovOS **GRM**
  recorder portal ("Easy Access," launched Nov/Dec 2024) — an AngularJS SPA over a per-query
  JSON API gated by a disclaimer + login, built around a shopping-cart (search/view free;
  copies ~$3/page). 7M+ docs (1990→present). No public bulk-download endpoint.
- **Volume:** manual/per-query only, ~50 parcels/day ceiling. Not scalable to the ~2,000 target.
- **Bulk paths are paid:** ATTOM (~$95–500/mo), BatchData ($0.01/call), or negotiated office
  purchase (`assessor@sfgov.org`).

**Conclusion:** transaction/deed data is **not freely bulk-accessible**. Free = per-document
search only.

---

## Step 2 — Appreciation gap (assessor-only) — explored, then SUPERSEDED

Code: `appreciation_gap()` in `explore/insurance.py`. Re-baselined onto the **2025** roll
(auto-detect added via `latest_roll_year()` so it can't silently go stale; the Prop-13
inversion is anchored to the roll year). Noe Valley sample (400 parcels → 278 gaps), median
$342,916.

**Verdict — dropped as the need signal.** Because Prop 13 caps assessed growth at 2%/yr, the
gap collapses to `gap_pct = 1.02^years_owned − 1` — purely a tenure restatement, not market
appreciation. Real, zero-cost, but too weak to anchor the product. Kept in code as the
documented, rejected proxy.

---

## Step 3 — Primary-signal decision + data resolution

### Data resolution (done before deciding)
1. **Re-baseline to 2025 roll** — only the new module was stale; `assemble.py` already
   auto-detected. Fixed.
2. **`current_sales_date` sanity-check — trustworthy.** Range 1969-02-28 → 2025-06-02; no
   placeholder flood (0 dates before 1900, 61 before 1970); no sentinel date (max same-day =
   234, legit condo/subdivision transfers).
3. **Null fallback (don't drop).** Of 191,389 residential parcels (2025 roll): 71.1% have a
   real sale date (high confidence); 25.9% fall back to year-built tenure (low confidence,
   flagged — owner-since-built overstates tenure); 3.1% have no signal. **96.9% covered** vs
   71.1% if nulls were dropped. Implemented as `timing_origin()`.

### Decisions
- **Need-first architecture.** Primary signal = **replacement-cost gap** (free, assessor-only,
  insurance-relevant). `current_sales_date` (+ year-built fallback) demoted to a secondary
  **timing** layer ("when to call"), not the backbone.
- **No paid data.** Sale price / deeds never enter; appreciation gap stays a (rejected) proxy.
- Construction cost default **$500/sqft** (tunable; range $400–600).

### Need signal — replacement-cost gap
Code: `replacement_cost_gap()`.

**v1 (assessed-improvement anchor) — REVISED in Step 5.** First version used
`coverage_anchor = assessed_improvement_value`. It validated directionally (gap rose with
tenure) BUT overstated badly: SF assessments are land-heavy (land >> improvement), so the
anchor understated structure value and gaps ran 80–95%, with some *recent* buyers flagged
high. Replaced — see below.

**v2 (coverage-inflation-lag anchor) — current.**
```
replacement_cost_today = sqft × construction_psf                              (REAL rebuild cost)
coverage_anchor        = replacement_cost_today × (carrier_infl / constr_infl) ^ drift_years
gap_dollars            = replacement_cost_today − coverage_anchor
gap_pct                = 1 − (carrier_infl / constr_infl) ^ drift_years       (% underinsured)
```
Mechanism: Coverage A is set ≈ replacement cost at purchase and nudged ~`carrier_infl`/yr
(3.5%), but true rebuild cost rises ~`constr_infl`/yr (5%, faster); the shortfall compounds with
years held. Dollar amount stays grounded in real rebuild cost. Produces defensible gaps
(15–44%, e.g. a 1987-purchase Portola home: $660k rebuild vs $382k coverage = $278k / 42%).
`drift_years` = real tenure for high-confidence parcels (capped 40), else a flat assumed 20yr
(unknown tenure — using year-built age would overstate/cluster old buildings).

Assembly filters to **SFR + owner-occupied** (the biggest raw gaps were large multi-unit
buildings; SF codes condos under "Single Family Residential").

---

## Step 4 — Insurance scoring

Code: `InsuranceScoringConfig` + `score_parcel()` in `explore/insurance.py`. Parameterized so
it runs **without deed/price data** and so extra need-components switch on via a non-zero weight.

### Final weights used

**need_score** (weighted sum ÷ active weights → 0–1):

| component | weight | source |
|---|---:|---|
| replacement-cost gap | **1.00** | `replacement_cost_gap` |
| permit coverage-gap | 0.00 | (in pipeline; enable later) |
| home-age risk | 0.00 | (enable later) |
| flood flag | 0.00 | (FEMA not wired) |

**timing_score** (reference doc, normalized to sum 1.0; attenuated by tenure-source confidence):

| component | weight | notes |
|---|---:|---|
| renewal proximity (X-date) | 0.20 | peaks ~45d before sale-date anniversary; 0 when no real date |
| recent-trigger | 0.50 | bought within `recent_trigger_years` (=1) |
| ownership tenure | 0.30 | peaks 7–15 yrs |

Confidence handling: `high` = full timing; `low` (year-built fallback) × **0.5**; `none` = 0.
`need_score` normalizes the gap so a **40% shortfall = max need** (`need_gap_full_scale = 0.40`).

**composite = need × 0.70 + timing × 0.30**  (need-first, vs the reference doc's 0.60/0.40).

Key params: `construction_psf = 500`, `carrier_inflation = 1.035`, `construction_inflation = 1.05`,
`max_coverage_drift_years = 40`, `assumed_tenure_unknown = 20`, `need_gap_full_scale = 0.40`,
**`enrichment_threshold = 0.70`** (recalibrated from 0.65 after the v2 anchor — see below).

### Validation (5 target neighborhoods, roll 2025, n=1,989)
Composite spans 0.18–0.78 (median 0.45, p90 0.70). Top leads are long-held high-confidence homes
(40%+ gap → need 1.0); recent buyers and unknown-tenure parcels sit mid-pack. `worth_outreach
(≥0.70)` selects **~8%** — in line with the reference doc's 5–10% enrichment target (0.65 would
select 17%, too loose for the v2 scale).

---

## Step 5 — Assembly (review sample)

Code: `assemble_sample()` + `insurance_record()` in `explore/insurance.py`.
Output: **`household_sample.json`** — 30 records (sample only; no full file, no DB yet).

- **Scope = insurance-optimized 5 neighborhoods** (data-driven, ranked by avg replacement-cost
  gap, SFR only): **Portola, Outer Richmond, West of Twin Peaks, Sunset/Parkside, Inner Sunset.**
  Change vs the old contractor set: −Noe Valley (avg gap $262k), +Portola (#1, $925k raw).
- **Filter:** SFR + owner-occupied (`homeowner_exemption_value > 0`, 57% of SFR) + has lat/lng.
- **Sample = a spread** across the composite range, 6 per neighborhood, so the reviewer sees
  variety (not just top leads).
- **JSON shape (approved):** `household_id, address, lat, lng, neighborhood, year_built, sqft,
  owner_occupied, replacement_cost_today, coverage_anchor, replacement_cost_gap_dollars,
  replacement_cost_gap_pct, need_score, timing_score, timing_confidence, composite_score,
  worth_outreach, purchase_year, years_owned`. (`years_owned`/`purchase_year` are null for
  non-high-confidence parcels — the year-built fallback isn't real tenure.)

Coverage-anchor revision applied here (v1 → v2 above) at user request; threshold recalibrated.

---

## Step 6 — STOP: review the 30-record sample, then run the full ~2,000.

### How to run the full ~2,000 (run elsewhere)
From the repo root (`yc-growth-hack/`), with deps installed (`pip install -r requirements.txt`):

```bash
# Full run: top ~400 leads per neighborhood (~2,000 total) across the 5 neighborhoods
python -m explore.insurance --full --cap 2000 --out household_records.json
```

What it does:
- Auto-detects the latest assessor roll (2025); `$500/sqft` default (override `--psf 550`).
- Fetches **all SFR + owner-occupied** parcels in the 5 insurance-optimized neighborhoods
  (~48k rows via SODA pagination, ~0.1s politeness sleep between pages → a few minutes total).
- Scores every parcel (`score_parcel`), keeps the **top `cap/5` per neighborhood** by composite,
  globally sorts desc, caps at `--cap`.
- Writes `household_records.json` (same JSON shape as `household_sample.json`). **No DB writes.**

Tuning: `--psf <n>` (construction $/sqft), `--cap <n>` (total records), `--out <path>`.
All scoring knobs live in `InsuranceScoringConfig` (`explore/insurance.py`) — see Step 4 params.

For reference, the 30-record review sample (a spread, not the top) is:
```bash
python -m explore.insurance --assemble --sample 30 --out household_sample.json
```

> Note: the original plan named only `household_sample.json`; the full run writes a separate
> `household_records.json` so the review sample is preserved. Change `--out` if you prefer.
