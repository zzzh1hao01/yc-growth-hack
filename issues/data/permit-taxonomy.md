# SF Building Permit Taxonomy — HVAC & Electrical

## Dataset

**Source:** SF Open Data — Building Permits (`i98e-djp9`)
**Record count:** ~540,000 permits (1983–2026)
**Date range:** 1983 to present (digital filings start ~2007; bulk of HVAC/electrical permits from 2008+)
**Access:** Socrata API at `https://data.sfgov.org/resource/i98e-djp9.json`

---

## How SF Categorizes Permits

SF does **not** have a dedicated "HVAC" or "Electrical" permit type. All mechanical and electrical work is filed under two general `permit_type_definition` values:

| `permit_type_definition` | Description |
|---|---|
| `otc alterations permit` | Over-the-counter (same-day approval); most residential HVAC/electrical upgrades |
| `additions alterations or repairs` | Jobs requiring plan review; larger installs |

HVAC and electrical work is identified **only** through the free-text `description` field. The `existing_use` field is essential for filtering to residential properties.

---

## HVAC Permit Codes

### Identification Strategy

Filter `description` (case-insensitive) on any of:

| Keyword | Specificity | Notes |
|---|---|---|
| `HVAC` | High | Explicit HVAC work |
| `HEAT PUMP` | High | Includes mini-splits and ground-source |
| `FURNACE` | High | Gas/electric furnace replacement |
| `DUCTLESS` | High | Ductless mini-split systems |
| `SPLIT SYSTEM` | High | Central split HVAC |
| `CONDENSING UNIT` | High | Outdoor AC compressor |
| `HEATING` | Medium | Broad; includes radiant, baseboard — review needed |
| `COOLING` | Medium | Broad; includes commercial refrigeration |
| `AIR CONDITION` | Medium | Matches "air conditioning" and "air conditioner" |
| `BOILER` | Low | Mixed residential/commercial; many are plumbing |

### Recommended Filter for Pipeline

```sql
upper(description) like '%HVAC%'
OR upper(description) like '%HEAT PUMP%'
OR upper(description) like '%FURNACE%'
OR upper(description) like '%DUCTLESS%'
OR upper(description) like '%SPLIT SYSTEM%'
OR upper(description) like '%CONDENSING UNIT%'
```

**With residential constraint (required for lead gen):**
```sql
AND (existing_use like '%family dwelling%'
     OR existing_use = 'apartments'
     OR existing_use = 'residential hotel')
```

### Record Counts (residential, all years)

| Filter | Records |
|---|---|
| HVAC (high-specificity keywords above) | ~13,100 |
| + residential `existing_use` filter | ~7,200 combined HVAC + electrical |

---

## Electrical Permit Codes

### Panel Upgrades

Filter `description` on any of:

| Keyword | Specificity | Example description snippet |
|---|---|---|
| `PANEL UPGRADE` | High | "200 amp panel upgrade" |
| `SERVICE UPGRADE` | High | "upgrade electrical service to 200A" |
| `ELECTRICAL SERVICE UPGRADE` | High | — |
| `UPGRADE ELECTRICAL SERVICE` | High | — |
| `200 AMP` | Medium | Matches 200A service upgrades (may include non-panel work) |
| `400 AMP` | Medium | Larger service upgrades |
| `MAIN PANEL` + `UPGRADE` | High | Two-term match; very specific |

**Record count (panel upgrade, all use types):** ~473 explicit panel upgrade permits

### EV Charger Installs

| Keyword | Specificity | Example |
|---|---|---|
| `EV CHARGER` | High | "install level 2 ev charger" |
| `EV CHARGING` | High | "new ev charging station" |
| `ELECTRIC VEHICLE CHARGER` | High | Full phrase |
| `EVSE` | High | Industry acronym for charger hardware |
| `LEVEL 2 CHARGING` | High | L2 EVSE installs |

**Record count (EV charger, all use types):** ~135 explicit EV charger permits
**Note:** EV charger installs accelerated post-2020; dataset likely undercounts as many early installs lack explicit keyword.

### Recommended Filter for Pipeline

```sql
upper(description) like '%PANEL UPGRADE%'
OR upper(description) like '%SERVICE UPGRADE%'
OR (upper(description) like '%MAIN PANEL%' AND upper(description) like '%UPGRADE%')
OR upper(description) like '%EV CHARGER%'
OR upper(description) like '%EVSE%'
OR upper(description) like '%ELECTRIC VEHICLE CHARGER%'
```

---

## Key Fields for Pipeline

| Field | Use |
|---|---|
| `permit_number` | Join key; unique permit ID |
| `description` | Keyword filter for work type |
| `existing_use` | Filter to residential (`%family dwelling%`, `apartments`) |
| `permit_type_definition` | Coarse bucket (`otc alterations permit` vs plan review) |
| `filed_date` | Permit age signal (lead scoring) |
| `issued_date` | More reliable than filed for actual work date |
| `completed_date` / `finaled_date` | Work completion; open permits (no finaled) → active construction exclusion |
| `street_number` + `street_name` | Address for parcel join |
| `neighborhoods_analysis_boundaries` | Neighborhood label for geographic filtering |
| `block` + `lot` | Parcel identifier for joining to Assessor data |

---

## Assessor Data — Pool Flag

**Finding: `has_pool` does not exist in the SF Assessor Historical Secured Property Tax Roll (`wv5m-vpq2`).**

The Assessor dataset fields cover: `year_property_built`, `current_sales_date`, `homeowner_exemption_value`, `use_definition`, `property_class_code`, `number_of_bathrooms`, `number_of_bedrooms`, `number_of_rooms`, `lot_area`.

No pool indicator is available. **Recommendation: use `current_sales_date` (recent-mover vertical) as the primary behavioral signal instead.** Homeowners who purchased within the last 3 years are statistically more likely to invest in home upgrades — this is a cleaner and more data-rich signal than pool ownership.
