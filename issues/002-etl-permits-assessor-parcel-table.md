## Parent PRD

`BRIEF.md`

## What to build

Python ETL scripts that ingest SF Open Data building permits (via API) and the SF Assessor parcel bulk export, normalize addresses across both sources, filter to HVAC and electrical permit types identified in Slice 1, and join them into a single clean parcel-level table. The output is a CSV (or Parquet) file used as the foundation for lead scoring in Slice 5.

Scope is limited to the 3–5 neighborhoods selected in Slice 1.

### Key fields to produce per parcel record

| Field | Source |
|---|---|
| `parcel_id` | Assessor |
| `address_normalized` | Shared join key |
| `owner_occupied` | Assessor |
| `assessed_value` | Assessor |
| `last_sale_date` | Assessor |
| `home_age_years` | Assessor (year built) |
| `last_hvac_permit_date` | SF Permits |
| `last_electrical_permit_date` | SF Permits |
| `has_open_permit` | SF Permits (exclusion flag) |
| `neighborhood` | Assessor / permit |

## Acceptance criteria

- [ ] Script pulls permits from SF Open Data API, filtered to permit types from `issues/data/permit-taxonomy.md`
- [ ] Script ingests Assessor parcel bulk export and parses relevant fields
- [ ] Address normalization applied to both sources (lowercase, strip unit/apt, expand abbreviations)
- [ ] Left join: parcel records are the spine; permits join onto parcels
- [ ] Records with open/unfinalized permits are flagged (not dropped — exclusion happens in scoring)
- [ ] Output file written to `data/parcel_permits.csv` (or `.parquet`) with row count logged
- [ ] Script is idempotent: re-running produces the same output
- [ ] Join quality logged: % of parcels with at least one matching permit

## Blocked by

- Blocked by `issues/001-data-exploration-permit-taxonomy.md`

## User stories addressed

- Data Sources & Pipeline — Address-Level datasets
- Lead Scoring Algorithm — permit age and open-permit exclusion signals
