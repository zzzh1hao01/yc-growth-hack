## Parent PRD

`BRIEF.md`

## What to build

Define the Convex database schema and write an import script that loads `data/scored_leads.jsonl` into Convex. The `leads` table shape is locked to the household record contract in `householdiq_schema_spec.md` — this is the shared contract between the ETL pipeline (Person A) and the persona/clustering/chat layer (Person B).

**Person B can start slices 007–009 immediately against 10 mocked records in the contract shape** — real data does not need to be ready first. The import script swaps mocks for real records when the ETL pipeline is done.

### Table schemas

**`leads`** — one row per household, shape mirrors the household record contract:

```typescript
leads: defineTable({
  address_normalized: v.string(),
  lat: v.number(),
  lng: v.number(),
  assessor: v.object({
    year_built: v.number(),
    owner_occupied: v.boolean(),
    assessed_value: v.number(),
    last_sale_date: v.optional(v.string()),
    has_pool: v.boolean(),
  }),
  permits: v.array(v.object({
    type: v.string(),
    date_filed: v.string(),
    date_finaled: v.optional(v.string()),
    status: v.string(),
  })),
  census_block_group: v.object({
    block_group_id: v.string(),
    income_band: v.string(),
    ownership_rate: v.number(),
  }),
  cluster_id: v.number(),           // int 0–5
  vertical_scores: v.any(),         // { hvac: {score, urgency_flag, reasons}, ... }
  persona: v.optional(v.any()),     // populated lazily by slice 008
  contact_info: v.optional(v.any()), // populated on demand by slice 010
})
.index("by_lat_lng", ["lat", "lng"])
.index("by_hvac_score", ["vertical_scores.hvac.score"])
```

**`contractors`**:
```typescript
contractors: defineTable({
  session_id: v.string(),
  business_description: v.string(),
  business_address: v.string(),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  service_profile: v.optional(v.any()), // GPT extraction output
})
.index("by_session", ["session_id"])
```

**`chat_history`**:
```typescript
chat_history: defineTable({
  session_id: v.string(),
  lead_id: v.id("leads"),
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
})
.index("by_session_lead", ["session_id", "lead_id"])
```

No user auth for MVP — contractors identified by `session_id` (localStorage UUID).

### Mock records

Create `data/mock_leads.jsonl` with 10 records in the household contract shape covering a variety of cluster IDs, vertical score ranges, and urgency flags. Used by Person B to develop slices 007–009 before real data is ready.

### Import script

`etl/import_to_convex.py` — bulk-upserts rows from `data/scored_leads.jsonl` (or `mock_leads.jsonl`) into `leads` table via Convex HTTP API. Idempotent on `address_normalized`.

## Acceptance criteria

- [ ] `convex/schema.ts` defines `leads`, `contractors`, `chat_history` with the shapes above
- [ ] `leads` indexed on `by_lat_lng` and `by_hvac_score` (add `by_electrical_score` if needed)
- [ ] `chat_history` indexed on `by_session_lead`
- [ ] `data/mock_leads.jsonl` contains 10 valid records matching the household contract shape
- [ ] Mock records cover: varied cluster IDs (0–5), both urgency true/false for hvac and electrical, one pool vertical score
- [ ] Import script upserts mock records into Convex and logs row count
- [ ] Convex query `getLeadsByVertical(vertical, limit)` returns leads sorted by `vertical_scores[vertical].score` desc
- [ ] Convex query `getLead(leadId)` returns full household record
- [ ] Import script works for both `mock_leads.jsonl` and `scored_leads.jsonl` (same format)

## Blocked by

- Blocked by `issues/005-lead-scoring-engine.md`

## User stories addressed

- Technical Architecture — Convex DB
- Main Interface — Bounty Board (data layer for sprite rendering)
- Lead Interaction — side panel property summary
