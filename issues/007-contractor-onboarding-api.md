## Parent PRD

`BRIEF.md`

## What to build

Convex backend for contractor onboarding — the sequence that runs when a contractor submits their business description and address. Three things happen in order:

1. **GPT extraction**: a Convex action calls GPT with the contractor's free-text description and returns a structured `service_profile` JSON (service type, price-point positioning, customer preferences)
2. **Google Maps geocode**: contractor's business address is geocoded to lat/lon via Google Maps Places API
3. **Proximity re-ranking**: each lead's `composite_score` is adjusted by a proximity multiplier based on distance from contractor lat/lon; the adjusted score is stored per-session (not overwriting the base score)

The contractor record is stored in the `contractors` table keyed by `session_id` (cookie or localStorage UUID — no auth).

### GPT extraction prompt output schema

```json
{
  "service_types": ["hvac", "electrical"],
  "price_point": "mid",
  "customer_preferences": "older homes, residential, mission district"
}
```

## Acceptance criteria

- [ ] Convex mutation `createContractor(session_id, business_description, business_address)` creates a contractor record
- [ ] Convex action `extractServiceProfile(session_id)` calls GPT with contractor's description and stores structured JSON in `contractors.service_profile`
- [ ] Google Maps Geocoding API call resolves business address to `(lat, lon)` stored on contractor record
- [ ] Convex action `rankLeadsForContractor(session_id)` computes distance from contractor lat/lon to each lead and returns leads sorted by proximity-adjusted score (base score × proximity multiplier)
- [ ] Proximity multiplier formula: `1 + (max_distance - distance) / max_distance` capped at 1.5×
- [ ] End-to-end: after onboarding, the frontend can call `rankLeadsForContractor` and receive a ranked list

## Blocked by

- Blocked by `issues/006-convex-schema-bulk-lead-import.md`

## User stories addressed

- Contractor Onboarding UX flow (steps 2–5)
- Lead Scoring Algorithm — Proximity Ranking
- Core Value Proposition — Ranked warm leads
