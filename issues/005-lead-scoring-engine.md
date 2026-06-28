## Parent PRD

`BRIEF.md`

## What to build

Config-driven Python scoring engine that reads `data/vertical_config.json` and the enriched parcel table, then emits a `vertical_scores` map for every active vertical on every household record. Adding a new vertical requires only a new config entry — no pipeline code changes.

The output household records match the contract defined in `householdiq_schema_spec.md`.

### Vertical config (`data/vertical_config.json`)

```json
[
  {
    "id": "hvac",
    "driver": "permit",
    "relevant_permit_types": ["mechanical", "hvac", "furnace", "air conditioning"],
    "replacement_interval_years": 15,
    "urgency_threshold_years": 15,
    "required_signals": ["permit_age", "owner_occupied", "home_age"]
  },
  {
    "id": "electrical",
    "driver": "permit",
    "relevant_permit_types": ["electrical", "panel", "service upgrade"],
    "replacement_interval_years": 30,
    "urgency_threshold_years": 30,
    "required_signals": ["permit_age", "owner_occupied", "home_age"]
  },
  {
    "id": "pool",
    "driver": "assessor_flag",
    "trigger_field": "assessor.has_pool",
    "recurring": true,
    "required_signals": ["has_pool", "owner_occupied"]
  }
]
```

Pool vertical is conditional — only activate if SF assessor flags pools with sufficient density (validated in Slice 1). If SF pool density is too thin, replace with a `trigger` driver keyed on `assessor.last_sale_date` (recent-mover vertical).

### Driver logic

- **`permit` driver**: score from age of most recent matching permit. Older / missing = higher score. `urgency_flag = true` when permit age > `urgency_threshold_years`.
- **`assessor_flag` driver**: score = 1.0 if trigger field is true and owner-occupied. Recurring service.

### Score traceability

Every `vertical_scores` entry must include a `reasons[]` list of the actual data points behind the score (e.g. `["home built 1963", "no HVAC permit on record", "owner-occupied"]`). No ungrounded scores.

### Shared signal weights (applied per vertical where relevant)

| Signal | Weight |
|---|---|
| Age of last relevant permit | High |
| No relevant permit in interval+ years | High |
| Owner-occupied | High |
| Income proxy (assessed value + census income band) | Medium |
| Behavioral cluster hire-out likelihood | Medium |
| Home age | Medium |
| Open/unfinalized permit | EXCLUDE |

Proximity to contractor is **not** scored here — dynamic per contractor, applied in Slice 7.

### Output record shape

Matches the household record contract in `householdiq_schema_spec.md`:

```json
{
  "address_normalized": "...",
  "lat": 0.0,
  "lng": 0.0,
  "assessor": { ... },
  "permits": [ ... ],
  "census_block_group": { ... },
  "cluster_id": 2,
  "vertical_scores": {
    "hvac":       { "score": 0.82, "urgency_flag": true,  "reasons": ["..."] },
    "electrical": { "score": 0.45, "urgency_flag": false, "reasons": ["..."] }
  }
}
```

## Acceptance criteria

- [ ] `etl/score.py` implements `score_leads(records, vertical_config) -> records` — config is injected, not imported
- [ ] Engine iterates over all active verticals in config; each household gets a `vertical_scores` entry per vertical
- [ ] All scores are 0.0–1.0; `reasons[]` is non-empty for every score
- [ ] Renters (`owner_occupied = false`) produce score 0.0 with reason `"renter-occupied"` for all verticals
- [ ] Households with open/unfinalized permits are excluded from output entirely
- [ ] `urgency_flag` follows `urgency_threshold_years` from config — not hardcoded
- [ ] Output written to `data/scored_leads.jsonl` (one JSON record per line matching the contract shape)
- [ ] Score distribution logged per vertical (min, max, mean, % urgent)
- [ ] Unit tests cover: renter exclusion, open-permit exclusion, urgency threshold, `permit` driver, `assessor_flag` driver, thin-data confidence (census only, no permits)

## Blocked by

- Blocked by `issues/002-etl-permits-assessor-parcel-table.md`
- Blocked by `issues/003-etl-census-acs-block-group-join.md`
- Blocked by `issues/004-behavioral-cluster-assignment.md`

## User stories addressed

- Lead Scoring Algorithm (all signals)
- Match Score → Sprite Color mapping
- Ranked warm leads (Core Value Proposition)
