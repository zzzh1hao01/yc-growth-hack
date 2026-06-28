## Parent PRD

`BRIEF.md`

## What to build

Pull the SF Open Data building permit dataset and the Assessor parcel export, then produce two concrete outputs that unblock all downstream slices:

1. A markdown mapping doc listing the permit type codes (and subtypes) that correspond to HVAC and electrical work (panel upgrades, EV charger installs)
2. A ranked list of 3–5 SF neighborhoods by HVAC + electrical permit density, with a note on join quality between permit addresses and Assessor parcel records

This is a human-in-the-loop slice because the neighborhood selection and permit taxonomy decisions are judgment calls that gate the entire pipeline — they need to be reviewed and signed off before Slice 2 begins filtering data.

## Acceptance criteria

- [ ] SF Open Data permit dataset downloaded or API-accessible; record count and date range confirmed
- [ ] Assessor parcel export obtained; address field format documented
- [ ] HVAC permit type codes identified and listed (e.g. `description LIKE '%HVAC%'` candidates enumerated)
- [ ] Electrical permit type codes identified for panel upgrades and EV charger installs
- [ ] Address join quality assessed: % of permit records that match a parcel record after normalization
- [ ] 3–5 neighborhoods selected based on permit density, documented with row counts
- [ ] SF Assessor data checked for `has_pool` flag: confirm it exists and count residential parcels with pools in target neighborhoods — if pool density is too thin to be a meaningful vertical, document that and recommend the recent-mover vertical (keyed on `last_sale_date`) as the replacement
- [ ] Output committed as `issues/data/permit-taxonomy.md` and `issues/data/neighborhood-selection.md`

## Blocked by

None — can start immediately.

## User stories addressed

- Data Analysis Required Before Build (§ Neighborhoods & Data Scope in BRIEF.md)
- Data Sources & Pipeline — Address-Level datasets
