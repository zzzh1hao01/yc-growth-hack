# SF Neighborhood Selection — HVAC & Electrical Permit Density

## Methodology

- **Dataset:** SF Building Permits (`i98e-djp9`) via SF Open Data API
- **Filter:** Residential HVAC + electrical permits (see `permit-taxonomy.md` for keyword logic)
- **Residential constraint:** `existing_use` matches `%family dwelling%`, `apartments`, or `residential hotel`
- **All years included** (1983–2026) to capture system age signal for lead scoring

---

## Top 10 Neighborhoods by Permit Count (Residential)

| Rank | Neighborhood | HVAC/Elec Permits | Residential Parcels* | Permits per 1k Parcels |
|---|---|---|---|---|
| 1 | Sunset/Parkside | 784 | ~6,400 | 122 |
| 2 | Bayview Hunters Point | 550 | ~1,200† | 458 |
| 3 | West of Twin Peaks | 544 | ~3,760 | 145 |
| 4 | Mission | 529 | ~2,300 | 230 |
| 5 | Outer Richmond | 450 | ~2,940 | 153 |
| 6 | Noe Valley | 328 | ~1,980 | 165 |
| 7 | Castro/Upper Market | 321 | ~1,770 | 181 |
| 8 | Bernal Heights | 302 | ~1,100† | 274 |
| 9 | Marina | 271 | ~1,850 | 146 |
| 10 | Inner Sunset | 256 | ~2,060 | 124 |

*Parcel counts from 50k-record Assessor sample (2023 roll); proportional estimates.
†Bayview and Bernal Heights parcel counts are partial estimates; actual densities may differ.

---

## Recommended 5 Target Neighborhoods

### Selection Criteria
1. **High absolute permit count** — ensures enough leads to populate the map
2. **Primarily single-family / 2-family residential** — matches contractor target (individual homeowners)
3. **Geographic spread** — avoids concentrating all leads in one quadrant

### Final Selection

| Priority | Neighborhood | Rationale |
|---|---|---|
| 1 | **Sunset/Parkside** | Highest absolute count (784); overwhelmingly single-family (>80% of permits are `1 family` or `2 family`); large area with dense residential stock; geographically accessible from Outer Sunset to Inner Parkside |
| 2 | **West of Twin Peaks** | 544 permits; very high single-family density; covers Forest Hill, St. Francis Wood, Miraloma Park, West Portal — affluent homeowners with older stock |
| 3 | **Outer Richmond** | 450 permits; strong mix of single-family and 2-family; long-established neighborhood with older HVAC systems; accessible from Geary corridor |
| 4 | **Noe Valley** | 328 permits but highest income + homeownership rate among selections; ideal for panel upgrade + EV charger vertical; small geography = efficient canvassing |
| 5 | **Bernal Heights** | 302 permits; high permit-per-parcel density (274/1k); rising-income neighborhood; good fit for EV charger installs |

### Excluded
- **Financial District/South Beach**: 3,008 raw permits but ~86% commercial/office — irrelevant to residential contractors
- **Mission**: 529 permits but high renter proportion reduces homeowner lead quality
- **Bayview Hunters Point**: High raw count but income/homeownership profile is a weaker fit for the $8k–15k HVAC job ticket

---

## Address Join Quality Assessment

**Method:** Normalized street address from permit records (`street_number` + `street_name`) matched against parcel `property_location` field from Assessor dataset.

**Finding:** The Assessor `property_location` field uses a non-standard format (`0000 0749 FILBERT ST0000`) that requires custom parsing. A 500-permit × 5,000-parcel spot check yielded a 3.2% match rate — this understates true join quality because the parcel sample is ~2.7% of all SF residential parcels.

**Recommendation for Slice 2:** Join on `block` + `lot` instead of address string. Both the permits dataset (`block`, `lot`) and Assessor dataset (`block`, `lot`) carry these fields, making a clean equi-join possible without address normalization. Address matching should be a fallback only for records missing `block`/`lot`.

---

## Recent-Mover Signal (Replaces Pool Flag)

The SF Assessor dataset does not include a `has_pool` flag. The `current_sales_date` field is available and provides a strong substitute signal:

- Homeowners who purchased in the last 1–3 years are statistically more likely to invest in HVAC and electrical upgrades (new-home inspection findings, desire to modernize)
- Filter: `current_sales_date >= '2021-01-01'` for recent-mover segment

This vertical should be modeled as a secondary boost signal in the lead score (see `005-lead-scoring-engine.md`) rather than a primary filter.
