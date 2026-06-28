## Parent PRD

`BRIEF.md`

## What to build

Convex action that triggers Orange Slice contact enrichment for a specific address when a contractor clicks "Get contact info". Stores the enriched phone/email on the lead record and returns it to the caller.

**Important:** As of writing, it is unconfirmed whether Orange Slice's enrichment API supports residential addresses (the brief flags this as an open question). Build this slice with a **stub implementation** that returns mock contact data so the frontend can integrate immediately. Swap in the real API call once residential support is confirmed.

The stub is clearly marked — do not ship the stub to production.

### Real implementation (when unblocked)

1. Call Orange Slice enrichment API with normalized address
2. Parse response for phone, email, name
3. Upsert into `leads.contact_info`
4. Optionally push to outreach sequence (Gmail / HeyReach) via Orange Slice integrations — out of scope for this slice, tracked separately

### Stub implementation

```typescript
// TODO: replace with real Orange Slice API call once residential support confirmed
return { phone: "415-555-0100", email: "stub@example.com", name: "Jane Homeowner" };
```

## Acceptance criteria

- [ ] Convex action `enrichContact(session_id, parcel_id)` exists and is callable from the frontend
- [ ] Stub returns typed mock contact data matching the real response schema
- [ ] When real API is integrated: Orange Slice API key loaded from Convex environment variable (not hardcoded)
- [ ] Enriched contact info stored in `leads.contact_info` as `{ phone, email, name }`
- [ ] If `leads.contact_info` already populated, action returns cached value without re-calling the API
- [ ] Stub vs real implementation toggled via `ORANGE_SLICE_ENABLED` environment variable

## Blocked by

- Blocked by `issues/006-convex-schema-bulk-lead-import.md`
- Pending: Orange Slice residential API confirmation (open question in BRIEF.md)

## User stories addressed

- Lead Interaction — "Get contact info" button
- Core Value Proposition — Direct outbound via Orange Slice
- Sponsor Tool Integration — Orange Slice
