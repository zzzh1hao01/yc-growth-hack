## Parent PRD

`BRIEF.md`

## What to build

Convex action that generates a household persona for a specific lead, on demand (lazy — only generated when a contractor clicks a sprite). The action assembles context from three sources, calls GPT, and caches the result on the lead record so subsequent opens are instant.

### Context assembled for GPT

1. **Property data**: permit history, home age, assessed value, ownership duration (from `leads` table)
2. **Cluster behavioral traits**: the cluster's distributions for DIY rate, contractor-finding method, objections, channel preference (from `cluster_config.json`, embedded at build time or stored in Convex)
3. **Contractor service profile**: the contractor's extracted `service_profile` JSON (from `contractors` table)

### Persona output (stored on `leads.persona`)

```json
{
  "summary": "...",
  "likely_response_to_cold_approach": "...",
  "common_objections": ["...", "..."],
  "preferred_contractor_channel": "...",
  "conversion_hooks": "..."
}
```

This JSON also seeds the initial system prompt for the persona chat in Slice 9.

## Acceptance criteria

- [ ] Convex action `generatePersona(session_id, parcel_id)` assembles context, calls GPT, stores result in `leads.persona`
- [ ] If `leads.persona` is already populated, action returns cached value without calling GPT
- [ ] GPT prompt includes: property signals, cluster behavioral traits, contractor service profile
- [ ] Persona JSON matches the schema above and is parseable without error
- [ ] Action returns persona JSON to the caller synchronously
- [ ] If GPT call fails, action throws a typed error (no silent fallback to empty persona)

## Blocked by

- Blocked by `issues/004-behavioral-cluster-assignment.md`
- Blocked by `issues/006-convex-schema-bulk-lead-import.md`
- Blocked by `issues/007-contractor-onboarding-api.md`

## User stories addressed

- Persona Generation — Step 2 LLM Persona Narration
- Lead Interaction — side panel behavioral cluster summary
- Core Value Proposition — Household personas
