# Convex Build Guide — HouseholdIQ

> **For:** teammates picking up backend / integration work  
> **Branch with live UI:** `feature/quest-board-ui`  
> **Product context:** [`BRIEF.md`](./BRIEF.md)

This doc is a **build list**, not an architecture essay. Each section = exact functions to implement, where they live, and where the frontend calls them.

---

## What's already done

| Function | File | Status |
|----------|------|--------|
| `listLeads` | `convex/leads.ts` | ✅ Shipped |
| `upsertLead` | `convex/leads.ts` | ✅ Shipped |
| `bulkUpsertLeads` | `convex/leads.ts` | ✅ Shipped |
| `clearAllLeads` | `convex/leads.ts` | ✅ Shipped |
| `leads` table | `convex/schema.ts` | ✅ Shipped |
| UI reads Convex | `QuestBoard.tsx` → `useQuery(api.leads.listLeads)` | ✅ Shipped (blocks map while loading — see fix below) |

**Not built yet:** contractors, personas, chat, enrichment, ETL HTTP, onboarding UI.

---

## Build order (do in this sequence)

```
1. Fix map loading gate          ← unblocks Vercel demo
2. Seed / ETL → bulkUpsertLeads  ← real pins on map
3. contractors.create + getBySession
4. leads.getByExternalId + markViewed + updateStatus
5. personas.ensurePersona + getByLead
6. chat.listMessages + sendMessage
7. enrichment.requestContactInfo
8. http.ts ETL routes            ← Python team calls these
```

---

## Slice 1 — Unblock live demo (frontend + 0 new Convex functions)

**Problem:** [yc-growth-hack.vercel.app](https://yc-growth-hack.vercel.app/) stuck on "Loading leads from Convex…"

**Fix in `src/components/quest-board/QuestBoard.tsx`:**

Show `QuestMap` immediately with `PLACEHOLDER_LEADS` while `convexLeads === undefined`. Only swap to Convex data when the query resolves.

```tsx
// Remove this gate:
{convexLeads === undefined && process.env.NEXT_PUBLIC_CONVEX_URL ? (
  <div>Loading leads from Convex…</div>
) : (
  <QuestMap ... />
)}

// Always render QuestMap; leads memo already handles fallback
<QuestMap leads={leads} ... />
```

**Owner:** frontend · **No new Convex functions**

---

## Slice 2 — Load real leads (ETL → existing functions)

**Use what's shipped.** ETL does not need new Convex code until HTTP routes are added.

### Call from Python / seed script

```ts
// convex/leads.ts — already exists
api.leads.bulkUpsertLeads({ leads: [...] })
```

Each row must match `leadFields` in `convex/leads.ts`. Minimum fields:

| Field | Type | Notes |
|-------|------|-------|
| `externalId` | string | Stable key — parcel id or address hash. Maps to UI `id`. |
| `address` | string | Side panel title |
| `lat`, `lng` | number | Map pin — rooftop geocode, not neighborhood centroid |
| `matchScore` | number | 0–100 |
| `urgent` | boolean | Drives `!` badge on `LeadSprite` |
| `spriteVariant` | number | 0–3 |
| `permitAgeYears` | number | |
| `homeAgeYears` | number | |
| `cluster` | string | Side panel "Household Cluster" |
| `dataSource` | `"etl"` | |

Optional but fill when available: `neighborhood`, `lastPermitType`, `ownerOccupied`, `assessedValue`, `distanceMiles`, `vertical`, `clusterId`.

**Example payload:** `convex/seed.example.json` on `feature/quest-board-ui`

**Test locally:**

```bash
npx convex run leads:bulkUpsertLeads --args "$(cat convex/seed.example.json)"
```

**Owner:** ETL / data · **Functions: none new — use `bulkUpsertLeads`**

---

## Slice 3 — Contractor onboarding

### 3a. Add table to `convex/schema.ts`

```ts
contractors: defineTable({
  sessionId: v.string(),
  businessDescription: v.string(),
  businessAddress: v.string(),
  lat: v.number(),
  lng: v.number(),
  googlePlaceId: v.optional(v.string()),
  extractedProfile: v.optional(v.object({
    verticals: v.array(v.union(v.literal("hvac"), v.literal("electrical"))),
    pricePoint: v.union(v.literal("budget"), v.literal("mid"), v.literal("premium")),
    serviceTypes: v.array(v.string()),
    targetNeighborhoods: v.optional(v.array(v.string())),
  })),
  profileStatus: v.union(v.literal("pending"), v.literal("ready"), v.literal("error")),
}).index("by_sessionId", ["sessionId"]),
```

### 3b. Create `convex/contractors.ts`

| Function | Type | Args | Returns | Do this |
|----------|------|------|---------|---------|
| `getBySession` | `query` | `{ sessionId: v.string() }` | contractor doc or `null` | Lookup by `by_sessionId` index |
| `create` | `mutation` | `{ sessionId, businessDescription, businessAddress, lat, lng, googlePlaceId? }` | `Id<"contractors">` | Insert with `profileStatus: "pending"`. Schedule `internal.contractors.extractProfile` via `ctx.scheduler.runAfter(0, ...)` |

### 3c. Create `convex/contractorsActions.ts` (`"use node"`)

| Function | Type | Args | Do this |
|----------|------|------|---------|
| `extractProfile` | `internalAction` | `{ contractorId }` | Call OpenAI structured output on `businessDescription`. `ctx.runMutation(internal.contractors.saveProfile, { contractorId, extractedProfile })` |
| `saveProfile` | `internalMutation` | `{ contractorId, extractedProfile }` | Patch contractor, set `profileStatus: "ready"` |

### 3d. Wire frontend

| UI file | Hook |
|---------|------|
| New `src/components/onboarding/OnboardingForm.tsx` | `useMutation(api.contractors.create)` |
| `QuestBoard.tsx` header | Replace hardcoded "Mission HVAC Co." with `useQuery(api.contractors.getBySession, { sessionId })` |
| `src/lib/session.ts` | `getOrCreateSessionId()` in localStorage |

**Env:** `OPENAI_API_KEY` in Convex dashboard

---

## Slice 4 — Lead interaction state

Add to `leads` table in `convex/schema.ts`:

```ts
status: v.optional(v.union(
  v.literal("available"),
  v.literal("viewed"),
  v.literal("pursued"),
  v.literal("skipped"),
)),
contactPhone: v.optional(v.string()),
contactEmail: v.optional(v.string()),
```

### Add to `convex/leads.ts`

| Function | Type | Args | Do this |
|----------|------|------|---------|
| `getByExternalId` | `query` | `{ externalId: v.string() }` | Single lead for side panel refresh |
| `markViewed` | `mutation` | `{ externalId: v.string() }` | Patch `status → "viewed"` if currently `"available"` or unset |
| `updateStatus` | `mutation` | `{ externalId, status: "pursued" \| "skipped" }` | Patch status |

### Wire frontend

| UI file | When |
|---------|------|
| `QuestBoard.tsx` → `handleSelectLead` | Call `markViewed` on sprite click |
| `LeadSidePanel.tsx` | Add Pursue / Skip buttons → `updateStatus` |
| `LeadSidePanel.tsx` | Enable "Get contact info" after pursue (Slice 7) |

---

## Slice 5 — Persona generation

### 5a. Add table to `convex/schema.ts`

```ts
personas: defineTable({
  leadExternalId: v.string(),       // matches leads.externalId
  status: v.union(v.literal("pending"), v.literal("generating"), v.literal("ready"), v.literal("error")),
  narrative: v.optional(v.string()),
  summary: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
}).index("by_lead", ["leadExternalId"]),
```

### 5b. Create `convex/personas.ts`

| Function | Type | Args | Do this |
|----------|------|------|---------|
| `getByLead` | `query` | `{ leadExternalId: v.string() }` | Return persona doc for side panel |
| `ensurePersona` | `mutation` | `{ leadExternalId, contractorId }` | If persona exists → return id. Else insert `{ status: "pending" }`, schedule `internal.personas.generate` |
| `markGenerating` | `internalMutation` | `{ personaId }` | Patch status |
| `saveNarrative` | `internalMutation` | `{ personaId, narrative, summary }` | Patch, set `status: "ready"` |
| `markError` | `internalMutation` | `{ personaId, errorMessage }` | Patch, set `status: "error"` |

### 5c. Create `convex/personasActions.ts` (`"use node"`)

| Function | Type | Args | Do this |
|----------|------|------|---------|
| `generate` | `internalAction` | `{ personaId, contractorId }` | 1) `runQuery` lead + contractor 2) OpenAI chat with permit/cluster/property context 3) `runMutation saveNarrative` |

**Prompt inputs (from existing lead fields):** `address`, `permitAgeYears`, `lastPermitType`, `homeAgeYears`, `cluster`, `ownerOccupied`, contractor `extractedProfile`.

### 5d. Wire frontend

| UI file | Hook |
|---------|------|
| `QuestBoard.tsx` → `handleSelectLead` | Also call `ensurePersona` |
| `LeadSidePanel.tsx` | Replace "Persona chat coming soon" stub with `useQuery:Query(api.personas.getByLead, { leadExternalId: lead.id })` — show `narrative` when `status === "ready"`, spinner when pending |

---

## Slice 6 — Persona chat

### 6a. Add table to `convex/schema.ts`

```ts
chatMessages: defineTable({
  leadExternalId: v.string(),
  contractorId: v.id("contractors"),
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
}).index("by_lead_contractor", ["leadExternalId", "contractorId"]),
```

### 6b. Create `convex/chat.ts`

| Function | Type | Args | Do this |
|----------|------|------|---------|
| `listMessages` | `query` | `{ leadExternalId, contractorId }` | Index lookup, return ordered by `_creationTime` |
| `sendMessage` | `mutation` | `{ leadExternalId, contractorId, content }` | Insert user message. Schedule `internal.chat.generateReply` |
| `saveAssistantMessage` | `internalMutation` | `{ leadExternalId, contractorId, content }` | Insert assistant message |

### 6c. Create `convex/chatActions.ts` (`"use node"`)

| Function | Type | Args | Do this |
|----------|------|------|---------|
| `generateReply` | `internalAction` | `{ leadExternalId, contractorId, userContent }` | Load persona + last 10 messages + lead. OpenAI in-character reply. `saveAssistantMessage` |

### 6d. Wire frontend

| UI file | Component |
|---------|-----------|
| New `src/components/quest-board/PersonaChat.tsx` | `useQuery(api.chat.listMessages)` + `useMutation(api.chat.sendMessage)` |
| `LeadSidePanel.tsx` | Render `<PersonaChat />` below cluster section |

---

## Slice 7 — Contact enrichment (Orange Slice)

### Add to `convex/leads.ts` or new `convex/enrichment.ts`

| Function | Type | Args | Do this |
|----------|------|------|---------|
| `requestContactInfo` | `mutation` | `{ externalId, contractorId }` | Schedule `internal.enrichment.fetchContact` |
| `saveContactInfo` | `internalMutation` | `{ externalId, contactPhone?, contactEmail? }` | Patch lead |
| `fetchContact` | `internalAction` | `{ externalId }` | Call Orange Slice API with address. `runMutation saveContactInfo` |

### Wire frontend

| UI file | Change |
|---------|--------|
| `LeadSidePanel.tsx` | Remove `disabled` from "Get contact info" button → `useMutation(api.enrichment.requestContactInfo)` |
| `LeadSidePanel.tsx` | Display `contactPhone` / `contactEmail` from lead query when present |

**Env:** `ORANGE_SLICE_API_KEY` in Convex dashboard

---

## Slice 8 — ETL HTTP routes (optional — for automated Python ingest)

Only needed if Python can't call `bulkUpsertLeads` via Convex client.

### Create `convex/http.ts`

| Route | Method | Handler | Do this |
|-------|--------|---------|---------|
| `/etl/leads` | POST | `bulkUpsertLeadsHttp` | Verify `Authorization: Bearer ${ETL_SECRET}`. Parse `{ leads: [...] }`. `ctx.runMutation(api.leads.bulkUpsertLeads, ...)` |

### Python caller

```python
requests.post(
    f"{CONVEX_SITE_URL}/etl/leads",
    headers={"Authorization": f"Bearer {ETL_SECRET}"},
    json={"leads": batch},
)
```

**Env:** `ETL_SECRET` in Convex dashboard + Python env

---

## Function → UI cheat sheet

| User action | Convex function(s) | UI file |
|-------------|-------------------|---------|
| App loads | `contractors.getBySession`, `leads.listLeads` | `QuestBoard.tsx` |
| Submit onboarding | `contractors.create` | `OnboardingForm.tsx` (new) |
| See map sprites | `leads.listLeads` | `QuestMap.tsx` ← data from `QuestBoard` |
| Click sprite | `leads.markViewed`, `personas.ensurePersona` | `QuestBoard.tsx` |
| View property details | `leads.getByExternalId` | `LeadSidePanel.tsx` |
| Read persona | `personas.getByLead` | `LeadSidePanel.tsx` |
| Send chat message | `chat.sendMessage` | `PersonaChat.tsx` (new) |
| Pursue / skip | `leads.updateStatus` | `LeadSidePanel.tsx` |
| Get contact info | `enrichment.requestContactInfo` | `LeadSidePanel.tsx` |
| ETL batch load | `leads.bulkUpsertLeads` | Python / seed script |

---

## Rules (don't skip)

1. **Client never calls actions directly.** Mutation writes + `ctx.scheduler.runAfter(0, internalAction, ...)`.
2. **OpenAI / Orange Slice keys stay in Convex env**, not Next.js.
3. **Keep `Lead` type in sync** — update `src/types/lead.ts` and `leadFields` in `convex/leads.ts` together.
4. **Use `externalId` as the stable key** — UI `lead.id` === Convex `externalId`.
5. **Internal functions** = prefix `internal.` — not callable from browser.

---

## Env vars checklist

| Variable | Where | Needed for |
|----------|-------|------------|
| `NEXT_PUBLIC_CONVEX_URL` | Vercel / `.env.local` | All UI queries |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Vercel / `.env.local` | Map |
| `OPENAI_API_KEY` | Convex dashboard | Slices 3, 5, 6 |
| `ORANGE_SLICE_API_KEY` | Convex dashboard | Slice 7 |
| `ETL_SECRET` | Convex + Python | Slice 8 |
| `CONVEX_DEPLOY_KEY` | Vercel | Production deploy |

---

## Who builds what

| Teammate | Pick up |
|----------|---------|
| **Frontend** | Slice 1 (loading fix), onboarding form, `PersonaChat`, wire mutations in `LeadSidePanel` |
| **Convex / full-stack** | Slices 3–7 function files |
| **ETL / data** | Slice 2 — call `bulkUpsertLeads` with scored SF addresses from `backend/issues` pipeline |
| **Anyone blocked** | Seed demo with `convex/seed.example.json` + `bulkUpsertLeads` |

---

## References

- Live UI branch: `feature/quest-board-ui`
- Data field guide: `docs/DATA_INTEGRATION.md` (on UI branch)
- ETL issues: `backend/issues` branch
- Product scoring rules: `BRIEF.md`
