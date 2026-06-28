## Parent PRD

`BRIEF.md`

## What to build

Pre-process the static behavioral survey datasets (AHS, CEX, GSS, Pew) to extract relevant distribution parameters, define 5 demographic clusters, and write a cluster assignment function that maps a parcel's attributes to a cluster ID. Store the cluster definitions as a config file and the per-parcel assignments in `data/parcel_enriched.csv`.

Cluster definitions are checked into a config so they can be revised without rewriting code.

### Default 5-cluster schema (starting point — adjust based on data)

| ID | Name | Key traits |
|---|---|---|
| A | Long-time high-income owner | High income, owned 10+ yrs, high assessed value, low DIY rate |
| B | Long-time budget-conscious owner | Mid/low income, owned 10+ yrs, moderate DIY rate, delay-prone |
| C | Recent buyer | Owned < 5 yrs, mid-high income, willing to invest post-purchase |
| D | Older retired homeowner | 65+, fixed income, high trust in referrals, low channel diversity |
| E | Mid-income working family | Mid income, 2+ persons, time-constrained, prefers convenience |

### Behavioral traits to extract per cluster

From AHS: contractor-finding method, repair delay reason, DIY vs hire rate by income + home age
From CEX: maintenance spend $ by income bracket
From GSS: trust in service providers by education; referral behavior
From Pew: channel preference (Yelp/Nextdoor/Google/word of mouth) by age + income

## Acceptance criteria

- [ ] Static survey datasets (AHS, CEX, GSS, Pew) downloaded and placed in `data/raw/`
- [ ] Relevant distribution parameters extracted and stored in `data/cluster_config.json`
- [ ] 5 clusters defined in `data/cluster_config.json` with threshold rules for assignment (income bracket, home age, ownership duration)
- [ ] `assign_cluster(parcel_row) -> cluster_id` function implemented in `etl/cluster.py`
- [ ] Cluster assignment applied to all rows in `data/parcel_enriched.csv`; distribution of cluster assignments logged
- [ ] Cluster definitions are data-driven (changing `cluster_config.json` changes assignments without code changes)

## Blocked by

- Blocked by `issues/001-data-exploration-permit-taxonomy.md` (for domain context on SF homeowner demographics)

## User stories addressed

- Persona Generation — Step 1 Demographic Clustering
- Data Sources & Pipeline — Behavioral Survey Distributions
- Lead Scoring Algorithm — behavioral cluster signal
