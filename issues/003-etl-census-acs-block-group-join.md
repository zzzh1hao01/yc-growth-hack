## Parent PRD

`BRIEF.md`

## What to build

Python script that pulls American Community Survey (ACS) 5-year estimates for SF block groups via the Census Bureau API, then joins block-group-level signals onto the parcel table produced in Slice 2 using Census GEOID. The output enriches each parcel record with income, ownership rate, and household composition signals needed for lead scoring and cluster assignment.

### Key ACS variables to pull (block-group level)

| Variable | ACS Table |
|---|---|
| Median household income | B19013 |
| Owner-occupied housing units % | B25003 |
| Median age of householder | B25007 |
| Household size distribution | B25009 |
| Educational attainment (% bachelor's+) | B15003 |

## Acceptance criteria

- [ ] Script calls Census API for ACS 5-year estimates, SF county (FIPS 06075), block-group geography
- [ ] Each parcel in `data/parcel_permits.csv` is geocoded to a Census block group GEOID (via lat/lon reverse geocode or address-to-GEOID lookup)
- [ ] ACS variables joined onto parcel table; join coverage logged (% of parcels matched to a block group)
- [ ] Income bracket column derived: `income_bracket` ∈ {low, mid, high} using ACS median income thresholds
- [ ] Output written to `data/parcel_enriched.csv` (superset of `parcel_permits.csv` with ACS columns appended)
- [ ] Script is idempotent

## Blocked by

- Blocked by `issues/002-etl-permits-assessor-parcel-table.md`

## User stories addressed

- Data Sources & Pipeline — Block-Group Level (Census ACS)
- Lead Scoring Algorithm — household income bracket signal
- Persona Generation — demographic clustering inputs
