# Data Integration Guide (for agents & ETL)

This document describes **what data the bounty board needs**, where to put it, and how to wire it into the UI.

## Current state

| Layer | Status | Location |
|-------|--------|----------|
| UI map + sprites | **Live (demo)** | Reads `PLACEHOLDER_LEADS` in [`src/data/placeholderLeads.ts`](../src/data/placeholderLeads.ts) |
| Type contract | **Defined** | [`src/types/lead.ts`](../src/types/lead.ts) |
| Convex schema | **Ready for ingest** | [`convex/schema.ts`](../convex/schema.ts) |
| Convex queries/mutations | **Ready for ingest** | [`convex/leads.ts`](../convex/leads.ts) |
| UI ↔ Convex | **Not wired** | Swap mock import in [`QuestBoard.tsx`](../src/components/quest-board/QuestBoard.tsx) |

---

## What each lead must include

### Required for map pins (geolocation)

Every lead **must** have a geocoded point tied to a real address:

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `id` | string | ETL | Stable key: parcel ID or hash of normalized address |
| `address` | string | Assessor + normalization | Display string for side panel |
| `lat` | number | Geocoder / parcel centroid | WGS84 — sprite pin location |
| `lng` | number | Geocoder / parcel centroid | WGS84 — sprite pin location |

**Do not** use neighborhood centroids for pins. Sprites must sit on the actual parcel/rooftop geocode.

### Required for scoring & visuals

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `matchScore` | number 0–100 | ETL scoring job | Weighted signals in BRIEF.md |
| `urgent` | boolean | ETL | `true` when permit age > vertical threshold |
| `spriteVariant` | 0–3 | UI assign at ingest | Visual diversity only — round-robin or random |
| `permitAgeYears` | number | SF Open Data permits | Years since last HVAC/electrical permit |
| `homeAgeYears` | number | Assessor | Building age cohort |
| `cluster` | string | Cluster assignment | Human-readable label for side panel |

### Strongly recommended (side panel + future persona)

| Field | Type | Source |
|-------|------|--------|
| `neighborhood` | string | SF neighborhood lookup from lat/lng or parcel |
| `lastPermitType` | string | SF permit taxonomy |
| `lastPermitDate` | string (ISO) | SF Open Data |
| `hasOpenPermit` | boolean | SF Open Data — exclude if true |
| `ownerOccupied` | boolean | Assessor / Census proxy |
| `assessedValue` | number | Assessor |
| `lastSaleDate` | string (ISO) | Assessor |
| `clusterId` | string | Offline cluster table |
| `distanceMiles` | number | Haversine from contractor address |
| `vertical` | `"hvac"` \| `"electrical"` | Contractor profile / permit type |

---

## Where to insert data

### Step 1 — ETL output → JSON or CSV

Your Python ETL should emit one row per address with at least the required fields above.
Normalize addresses before geocoding (see BRIEF open questions on join quality).

Example row:

```json
{
  "id": "parcel-123456",
  "address": "2847 24th St, San Francisco, CA 94110",
  "lat": 37.7524,
  "lng": -122.4098,
  "neighborhood": "Mission",
  "matchScore": 92,
  "urgent": true,
  "spriteVariant": 0,
  "permitAgeYears": 18,
  "lastPermitType": "HVAC_REPLACEMENT",
  "lastPermitDate": "2007-04-12",
  "hasOpenPermit": false,
  "homeAgeYears": 74,
  "ownerOccupied": true,
  "assessedValue": 1250000,
  "clusterId": "cluster-budget-owner",
  "cluster": "Long-time owner, budget-conscious",
  "vertical": "hvac",
  "dataSource": "etl"
}
```

### Step 2 — Bulk load into Convex

Use the provided mutation in [`convex/leads.ts`](../convex/leads.ts):

```typescript
// From a seed script or Convex dashboard:
await ctx.runMutation(api.leads.bulkUpsertLeads, { leads: [...] });
```

Or call `upsertLead` for single records.

**Agent entry point:** implement or run a script that reads ETL JSON and calls `bulkUpsertLeads`.

### Step 3 — Wire UI to Convex

In [`src/components/quest-board/QuestBoard.tsx`](../src/components/quest-board/QuestBoard.tsx):

1. Add `ConvexProvider` to [`src/app/layout.tsx`](../src/app/layout.tsx) with `NEXT_PUBLIC_CONVEX_URL`
2. Replace `PLACEHOLDER_LEADS` with:

```typescript
const leads = useQuery(api.leads.listLeads) ?? [];
```

3. Map Convex documents to `Lead` type (fields align 1:1 with schema)

---

## Scoring reference (from BRIEF)

Composite `matchScore` weights:

- **High:** permit age, no permit 15+ years, owner-occupied
- **Medium:** income proxy, behavioral cluster, home age, proximity to contractor
- **Exclude:** open/unfinalized permits (`hasOpenPermit: true`)

Sprite color tiers (UI):

- Green (hot): score ≥ 70 — bob + waving arm
- Yellow (warm): 40–69 — bob only
- Red (cold): &lt; 40 — bob only
- `urgent: true` → pulsing `!` badge

---

## Files to touch (checklist for agents)

- [ ] `convex/schema.ts` — extend only if new fields needed
- [ ] `convex/leads.ts` — `bulkUpsertLeads` / `upsertLead` for ingest
- [ ] `src/types/lead.ts` — keep frontend type in sync with schema
- [ ] `src/data/placeholderLeads.ts` — delete or keep for offline demo fallback
- [ ] `src/components/quest-board/QuestBoard.tsx` — switch data source
- [ ] `src/components/quest-board/LeadSidePanel.tsx` — bind optional fields when present

---

## Placeholder vs real data in UI

Fields shown as **placeholder** in the demo side panel until ETL provides them:

- Owner status (hardcoded "Owner-occupied")
- Assessed value / last sale (hidden until present)
- Permit type / date (hidden until present)

Once real data is ingested, the side panel reads optional fields from the `Lead` object automatically.
