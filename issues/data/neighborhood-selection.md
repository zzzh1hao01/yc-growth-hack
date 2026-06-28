# SF Neighborhood Selection — HVAC & Electrical Permit Density (CORRECTED)

> **Slice 1 correction.** The original ranking was computed on building-permits-only
> data (wrong dataset) and on the `neighborhoods_analysis_boundaries` field. This
> version ranks on the **corrected, all-three-dataset** counts (electrical
> `ftty-kx6y` + plumbing/mechanical `a6aw-rudh` + building `i98e-djp9`). Because
> the electrical and plumbing datasets have **no neighborhood field**, neighborhood
> is derived by joining each permit's `block` to the assessor's
> `analysis_neighborhood` (`build_block_neighborhood_map`).

## Methodology

- **Verticals:** panel + EV (electrical) + HVAC (plumbing), recommended filters from `permit-taxonomy.md`
- **Window:** permits filed since **2016-01-01** (recent demand; keeps the fetch bounded)
- **Neighborhood:** derived via assessor `block → analysis_neighborhood` map
- **Caveat:** no per-parcel residential filter applied here (electrical/plumbing
  lack `existing_use`); residential refinement is a Slice 2 step via the assessor
  join. Density is good enough to pick neighborhoods, not a residential census.

---

## Address join quality — RESOLVED

Slice 1 reported a **3.2%** address-string match rate, which was an artifact of
parsing the assessor's non-standard `property_location` field on a tiny sample.
The recommended **block + lot equi-join** has now been validated on real samples:

| Vertical | Permit parcels sampled | Matched an assessor parcel | **Join rate** |
|---|---|---|---|
| Panel | 1,509 | 1,354 | **89.7%** |
| EV | 1,902 | 1,631 | **85.8%** |
| HVAC | 1,683 | 1,507 | **89.5%** |

**~86–90% of permits land on a real assessor parcel** (records with both permit
history and property data — the usable ones). The block/lot join is sound; the
3.2% number should be discarded.

---

## Corrected Ranking — Top 10 (panel + EV + HVAC, since 2016)

| Rank | Neighborhood | Permits | Δ vs old ranking |
|---|---|---|---|
| 1 | **Sunset/Parkside** | 6,241 | = (was #1) |
| 2 | **West of Twin Peaks** | 5,266 | ↑ (was #3) |
| 3 | **Mission** | 4,520 | ↑ (was excluded) |
| 4 | **Outer Richmond** | 3,724 | ↑ (was #5) |
| 5 | **Noe Valley** | 3,481 | ↑ (was #6) |
| 6 | Castro/Upper Market | 3,121 | ↑ (was #7) |
| 7 | Inner Sunset | 3,065 | ↑ (was #10) |
| 8 | Marina | 2,829 | ↑ (was #9) |
| 9 | Bernal Heights | 2,754 | ↓ (was #8) |
| 10 | Pacific Heights | 2,708 | new |

The shape is broadly similar to the old ranking (Sunset/Parkside still dominates),
but **Mission jumps to #3** on corrected counts — it was *excluded* in the old doc.
Bernal Heights drops from #5 to #9.

---

## Recommended 5 Target Neighborhoods

Criteria: high corrected density + primarily owner-occupied residential (contractor
target is individual homeowners) + geographic spread.

| Priority | Neighborhood | Rationale |
|---|---|---|
| 1 | **Sunset/Parkside** | Highest density (6,241); overwhelmingly single-family; large residential stock |
| 2 | **West of Twin Peaks** | 5,266; very high single-family density; older affluent stock (Forest Hill, St. Francis Wood, West Portal) |
| 3 | **Outer Richmond** | 3,724; established single/2-family; older HVAC systems |
| 4 | **Noe Valley** | 3,481; highest income + ownership rate; ideal for panel + EV; compact = efficient canvassing |
| 5 | **Inner Sunset** | 3,065; homeowner-heavy, residential; geographic complement to Sunset/Parkside |

### On Mission (#3 by density)
Mission has the 3rd-highest raw density but a **high renter proportion**, which
dilutes homeowner lead quality for an $8k–15k job ticket. It's a strong candidate
to **swap in for Inner Sunset once the residential (owner-occupied) filter is
applied in Slice 2** — revisit after the assessor join tags use-type and the
homeowner exemption. Listed as the top alternate.

### Alternates
Mission (pending residential filter), Bernal Heights, Castro/Upper Market.

---

## Recent-Mover Signal (unchanged from prior finding)

No `has_pool` field exists. Use `current_sales_date >= '2021-01-01'` (recent-mover)
as a secondary boost signal in the lead score — homeowners who bought in the last
~3 years are more likely to invest in HVAC/electrical upgrades.
