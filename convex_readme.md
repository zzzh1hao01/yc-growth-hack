# Convex Integration Guide — HouseholdIQ

> **Audience:** Coding agents and engineers joining this repo.  
> **Status:** Architecture spec — no Convex code exists yet. This document is the source of truth for how Convex should be wired into HouseholdIQ.  
> **Product context:** See [`BRIEF.md`](./BRIEF.md) for full product requirements.

---

## Table of Contents

1. [What Convex Does](#what-convex-does)
2. [Why Convex Fits This Architecture](#why-convex-fits-this-architecture)
3. [Recommended Schema](#recommended-schema)
4. [Recommended `convex/` Folder Structure](#recommended-convex-folder-structure)
5. [Queries the Frontend Will Need](#queries-the-frontend-will-need)
6. [Mutations & Actions the Backend Will Need](#mutations--actions-the-backend-will-need)
7. [Next.js ↔ Convex Integration](#nextjs--convex-integration)
8. [ETL Pipeline → Convex Data Insertion](#etl-pipeline--convex-data-insertion)
9. [OpenAI Persona Generation Flow](#openai-persona-generation-flow)
10. [Environment Variables & Secrets](#environment-variables--secrets)
11. [Agent Checklist (Implementation Order)](#agent-checklist-implementation-order)

---

## What Convex Does

[Convex](https://docs.convex.dev/) is a **reactive, serverless backend** that combines:

| Capability | What it means for HouseholdIQ |
|---|---|
| **Document database** | Stores households (leads), personas, chat history, and contractor sessions |
| **Queries** | Read-only, reactive functions — the map and chat UI auto-update when data changes |
| **Mutations** | Transactional writes — contractor onboarding, chat messages, lead status updates |
| **Actions** | Call external APIs (OpenAI, Orange Slice) — no direct DB access; use `ctx.runMutation` to persist results |
| **HTTP actions** | REST endpoints at `https://<deployment>.convex.site` — used by the Python ETL pipeline |
| **Scheduler** | `ctx.scheduler.runAfter(0, …)` — trigger async OpenAI persona generation after a mutation |
| **Real-time subscriptions** | `useQuery` on the client maintains a live WebSocket — map and chat update without polling |

For HouseholdIQ specifically, Convex is the **single source of truth** between:

```
Python ETL  ──►  Convex DB  ◄──►  Next.js UI (map + chat)
                      │
                      ├── OpenAI (persona narration + contractor profile extraction)
                      └── Orange Slice (contact enrichment — via Convex action)
```

---

## Why Convex Fits This Architecture

### 1. Real-time map updates

The bounty board map shows sprites at address coordinates, colored by match score. When a contractor pursues a lead or a persona finishes generating, the UI should reflect that instantly. Convex `useQuery` hooks maintain a live WebSocket subscription — no polling, no manual cache invalidation.

### 2. Chat is inherently reactive

Persona chat is a stream of messages between contractor and AI. Convex stores each message as a document; the chat panel subscribes to `listChatMessages` and appends new messages as they arrive (including assistant responses written by actions).

### 3. Clean separation of write paths

| Writer | Path |
|---|---|
| Python ETL (offline batch) | HTTP action → internal mutation (bulk upsert households) |
| Next.js UI (contractor) | Public mutation (onboarding, send message, pursue lead) |
| OpenAI / Orange Slice (async) | Action → internal mutation (store persona or contact info) |

Each path has a clear boundary. ETL never touches the frontend; the frontend never calls OpenAI directly (API keys stay in Convex env vars).

### 4. Hackathon-friendly, no infra

No Postgres provisioning, no Redis, no WebSocket server to maintain. `npx convex dev` gives local dev + cloud deployment. TypeScript types are generated from `schema.ts` into `convex/_generated/`.

### 5. MVP has no auth

The brief specifies no account required for MVP. Convex supports anonymous sessions via a client-generated `sessionId` stored in `localStorage` and passed to mutations. Auth (Clerk/Auth0) can be added later without changing the schema shape.

---

## Recommended Schema

Define in `convex/schema.ts`. All tables get `_id` and `_creationTime` automatically.

### Supporting table: `demographicClusters`

Pre-loaded by ETL. Referenced by households and personas. Not one of the four core tables but required for clustering.

```typescript
demographicClusters: defineTable({
  slug: v.string(),               // e.g. "long-time-high-income-owner"
  label: v.string(),              // display name
  description: v.string(),
  // Behavioral trait distributions from AHS/CEX/GSS/Pew (aggregate, not PII)
  traits: v.object({
    hireOutLikelihood: v.number(),       // 0–1
    diyRate: v.number(),
    trustInProviders: v.number(),
    referralPreference: v.number(),
    channelPreferences: v.object({
      yelp: v.number(),
      nextdoor: v.number(),
      google: v.number(),
      wordOfMouth: v.number(),
    }),
    delayRepairReasons: v.array(v.string()),
    maintenanceSpendBracket: v.string(), // e.g. "high", "medium", "low"
  }),
  personaTemplate: v.string(),    // base system prompt fragment for this cluster
}).index("by_slug", ["slug"]),
```

---

### `households`

One document per scored address/parcel. This is the core lead entity surfaced on the map.

```typescript
households: defineTable({
  // Identity & geo
  normalizedAddress: v.string(),  // canonical key for upserts from ETL
  streetAddress: v.string(),
  city: v.literal("San Francisco"),
  zipCode: v.string(),
  neighborhood: v.string(),
  lat: v.number(),
  lng: v.number(),
  parcelId: v.optional(v.string()),

  // Assessor signals
  ownerOccupied: v.boolean(),
  assessedValue: v.optional(v.number()),
  lastSaleDate: v.optional(v.string()),   // ISO date
  homeAgeYears: v.optional(v.number()),

  // Permit signals (HVAC + electrical verticals)
  permits: v.array(v.object({
    permitType: v.string(),         // raw SF taxonomy value
    vertical: v.union(v.literal("hvac"), v.literal("electrical")),
    datePulled: v.optional(v.string()),
    dateFinaled: v.optional(v.string()),
    isOpen: v.boolean(),            // unfinalized → exclusion flag
  })),
  lastHvacPermitAgeYears: v.optional(v.number()),
  lastElectricalPermitAgeYears: v.optional(v.number()),

  // Census / clustering
  censusBlockGroup: v.optional(v.string()),
  clusterId: v.id("demographicClusters"),

  // Lead scoring (computed offline in ETL, stored here)
  matchScore: v.number(),           // 0–100 composite
  proximityScore: v.optional(v.number()),
  urgencyFlag: v.boolean(),         // exclamation mark overlay
  scoringBreakdown: v.optional(v.object({
    permitAge: v.number(),
    ownerOccupied: v.number(),
    incomeFit: v.number(),
    behavioralFit: v.number(),
    homeAge: v.number(),
    proximity: v.number(),
  })),
  excluded: v.boolean(),            // true if open permit / failed filters
  exclusionReason: v.optional(v.string()),

  // Map sprite rendering
  spriteColor: v.union(v.literal("green"), v.literal("red")),
  spriteVariant: v.number(),        // 0–N for visual diversity

  // Contractor interaction state (per-household, updated at runtime)
  status: v.union(
    v.literal("available"),
    v.literal("viewed"),
    v.literal("pursued"),
    v.literal("skipped"),
  ),

  // Orange Slice enrichment (populated on "Get contact info")
  contactInfo: v.optional(v.object({
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    enrichedAt: v.number(),
  })),

  etlBatchId: v.optional(v.string()), // trace which ETL run loaded this row
})
  .index("by_normalizedAddress", ["normalizedAddress"])
  .index("by_neighborhood_score", ["neighborhood", "matchScore"])
  .index("by_cluster", ["clusterId"])
  .index("by_status", ["status"]),
```

**Design notes for agents:**

- `normalizedAddress` is the upsert key for ETL idempotency.
- `matchScore` + `neighborhood` index powers the map query ("top leads in Mission District").
- Proximity to a *specific contractor* is computed at query time (see [Queries](#queries-the-frontend-will-need)) using the contractor's lat/lng — it is not stored per-household because each contractor has a different location.
- `excluded: true` households are filtered out of map queries but kept for debugging.

---

### `personas`

AI-generated household profile. Created lazily when a contractor first opens a household, not during ETL.

```typescript
personas: defineTable({
  householdId: v.id("households"),
  clusterId: v.id("demographicClusters"),  // denormalized for prompt building

  // Generation lifecycle
  status: v.union(
    v.literal("pending"),    // mutation scheduled action
    v.literal("generating"), // action in flight
    v.literal("ready"),
    v.literal("error"),
  ),
  errorMessage: v.optional(v.string()),

  // GPT output
  narrative: v.optional(v.string()),       // full persona prose
  summary: v.optional(v.string()),         // short panel blurb
  likelyObjections: v.optional(v.array(v.string())),
  conversionTips: v.optional(v.array(v.string())),
  preferredChannels: v.optional(v.array(v.string())),

  // Prompt audit trail
  systemPrompt: v.optional(v.string()),      // assembled prompt sent to GPT
  model: v.optional(v.string()),             // e.g. "gpt-4o-mini"
  generatedAt: v.optional(v.number()),

  // Snapshot of inputs at generation time (immutable after ready)
  inputSnapshot: v.optional(v.object({
    permitSummary: v.string(),
    assessorSummary: v.string(),
    clusterTraits: v.string(),
    contractorProfileSummary: v.string(),
  })),
})
  .index("by_household", ["householdId"]),
```

**One persona per household** — enforce in `ensurePersona` mutation via index lookup before insert.

---

### `chatMessages`

Contractor ↔ AI persona conversation. Scoped to a household + contractor session.

```typescript
chatMessages: defineTable({
  householdId: v.id("households"),
  contractorId: v.id("contractors"),
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),

  // For assistant messages: link to generation metadata
  personaId: v.optional(v.id("personas")),
  model: v.optional(v.string()),
  tokenCount: v.optional(v.number()),
})
  .index("by_household_contractor", ["householdId", "contractorId"]),
```

Messages are append-only. The chat UI queries this index ordered by `_creationTime`.

---

### `contractors`

Created during onboarding. MVP uses client-generated session IDs — no login.

```typescript
contractors: defineTable({
  sessionId: v.string(),          // UUID from localStorage; MVP identity

  // Onboarding inputs
  businessDescription: v.string(),
  businessAddress: v.string(),
  lat: v.number(),
  lng: v.number(),
  googlePlaceId: v.optional(v.string()),

  // GPT-extracted structured profile (from onboarding)
  extractedProfile: v.optional(v.object({
    serviceTypes: v.array(v.string()),       // e.g. ["hvac", "electrical"]
    verticals: v.array(v.union(
      v.literal("hvac"),
      v.literal("electrical"),
    )),
    pricePoint: v.union(
      v.literal("budget"),
      v.literal("mid"),
      v.literal("premium"),
    ),
    targetHomeAge: v.optional(v.string()),
    targetNeighborhoods: v.optional(v.array(v.string())),
    customerPreferences: v.optional(v.string()),
  })),

  profileExtractionStatus: v.union(
    v.literal("pending"),
    v.literal("ready"),
    v.literal("error"),
  ),
})
  .index("by_sessionId", ["sessionId"]),
```

---

## Recommended `convex/` Folder Structure

```
convex/
├── schema.ts                  # All table definitions (above)
├── http.ts                    # HTTP router — ETL ingestion endpoints
│
├── households/
│   ├── queries.ts             # listForMap, getById, getPropertySummary
│   └── mutations.ts           # updateStatus, markViewed
│
├── contractors/
│   ├── queries.ts             # getBySession
│   └── mutations.ts           # create, updateExtractedProfile
│
├── personas/
│   ├── queries.ts             # getByHousehold
│   ├── mutations.ts           # ensurePersona (schedules action)
│   └── actions.ts             # generatePersonaNarrative (OpenAI)
│
├── chat/
│   ├── queries.ts             # listMessages
│   ├── mutations.ts           # sendMessage (schedules action)
│   └── actions.ts             # generatePersonaReply (OpenAI chat)
│
├── enrichment/
│   └── actions.ts             # fetchContactInfo (Orange Slice)
│
├── etl/
│   ├── mutations.ts           # internal: bulkUpsertHouseholds, upsertClusters
│   └── httpActions.ts         # POST /etl/households, POST /etl/clusters
│
├── lib/
│   ├── scoring.ts             # Shared proximity/score helpers (pure TS)
│   ├── prompts.ts             # Persona + extraction prompt templates
│   └── validators.ts          # Reusable v.object fragments
│
└── _generated/                # Auto-generated — do not edit
    ├── api.d.ts
    ├── api.js
    ├── dataModel.d.ts
    └── server.d.ts
```

**Conventions:**

- Public functions: `query`, `mutation`, `action` — callable from Next.js via `api.*`.
- Internal functions: `internalQuery`, `internalMutation`, `internalAction` — prefixed with `internal.*`; used by actions, HTTP handlers, and scheduler. Never exposed to the client.
- Group by domain, not by function type at the top level (the subfolder holds queries/mutations/actions together).

---

## Queries the Frontend Will Need

All consumed via `useQuery(api.<module>.<name>, args)` in client components.

### Map / Bounty Board

| Query | Args | Returns | Used by |
|---|---|---|---|
| `households.listForMap` | `{ contractorId, neighborhood?, minScore?, limit? }` | Array of `{ _id, lat, lng, spriteColor, spriteVariant, urgencyFlag, matchScore, normalizedAddress }` | Map sprite layer |
| `households.getById` | `{ householdId }` | Full household doc | Side panel property summary |
| `households.listNeighborhoods` | `{}` | `string[]` of neighborhoods with lead counts | Neighborhood filter dropdown |

**`listForMap` implementation notes:**

1. Load contractor lat/lng from `contractors` table.
2. Query households by neighborhood index (or all non-excluded).
3. Re-rank by proximity to contractor using haversine in `lib/scoring.ts` (optional composite re-score).
4. Return only fields needed for rendering — keep payload small.

### Contractor Session

| Query | Args | Returns | Used by |
|---|---|---|---|
| `contractors.getBySession` | `{ sessionId }` | Contractor doc or null | App init — restore session |
| `contractors.getExtractedProfile` | `{ contractorId }` | Extracted profile object | Confirm onboarding results |

### Persona Panel

| Query | Args | Returns | Used by |
|---|---|---|---|
| `personas.getByHousehold` | `{ householdId }` | Persona doc (includes `status`) | Side panel — show narrative or loading spinner |
| `demographicClusters.get` | `{ clusterId }` | Cluster traits summary | Property summary "behavioral cluster" line |

### Chat

| Query | Args | Returns | Used by |
|---|---|---|---|
| `chat.listMessages` | `{ householdId, contractorId }` | Ordered message array | Chat window |

The chat component should watch `personas.getByHousehold.status` — when `"ready"`, enable the input. When the last message is from `user` and no assistant reply exists yet, show typing indicator (action is in flight).

---

## Mutations & Actions the Backend Will Need

### Public Mutations (called from Next.js)

| Mutation | Args | Effect |
|---|---|---|
| `contractors.create` | `{ sessionId, businessDescription, businessAddress, lat, lng, googlePlaceId? }` | Insert contractor, schedule `extractContractorProfile` action |
| `households.markViewed` | `{ householdId, contractorId }` | Set status → `"viewed"` if currently `"available"` |
| `households.updateStatus` | `{ householdId, status }` | Set `"pursued"` or `"skipped"` |
| `personas.ensurePersona` | `{ householdId, contractorId }` | If no persona exists: insert `status: "pending"`, schedule `generatePersonaNarrative` action. If exists: no-op. |
| `chat.sendMessage` | `{ householdId, contractorId, content }` | Insert user message, schedule `generatePersonaReply` action |
| `enrichment.requestContactInfo` | `{ householdId, contractorId }` | Schedule Orange Slice enrichment action |

### Internal Mutations (called from actions / HTTP / scheduler)

| Mutation | Called by | Effect |
|---|---|---|
| `etl.bulkUpsertHouseholds` | ETL HTTP action | Upsert by `normalizedAddress`; batch of ≤100 per call |
| `etl.upsertClusters` | ETL HTTP action | Upsert demographic cluster lookup table |
| `contractors.saveExtractedProfile` | OpenAI action | Patch `extractedProfile`, set `profileExtractionStatus: "ready"` |
| `personas.markGenerating` | Persona action | Set `status: "generating"` |
| `personas.saveNarrative` | Persona action | Write GPT output fields, set `status: "ready"` |
| `personas.markError` | Any action on failure | Set `status: "error"` + message |
| `chat.saveAssistantMessage` | Chat action | Insert assistant `chatMessages` row |
| `households.saveContactInfo` | Enrichment action | Patch `contactInfo` on household |

### Actions (external API calls)

| Action | Trigger | External API | Persists via |
|---|---|---|---|
| `contractors.extractContractorProfile` | `contractors.create` scheduler | OpenAI structured output | `contractors.saveExtractedProfile` |
| `personas.generatePersonaNarrative` | `personas.ensurePersona` scheduler | OpenAI chat completion | `personas.saveNarrative` |
| `chat.generatePersonaReply` | `chat.sendMessage` scheduler | OpenAI chat completion (in-character) | `chat.saveAssistantMessage` |
| `enrichment.fetchContactInfo` | `enrichment.requestContactInfo` scheduler | Orange Slice API | `households.saveContactInfo` |

**Important pattern:** Mutations schedule actions; actions never get called directly from the client.

```typescript
// convex/personas/mutations.ts — canonical pattern
export const ensurePersona = mutation({
  args: { householdId: v.id("households"), contractorId: v.id("contractors") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("personas")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .unique();
    if (existing) return existing._id;

    const personaId = await ctx.db.insert("personas", {
      householdId: args.householdId,
      clusterId: (await ctx.db.get(args.householdId))!.clusterId,
      status: "pending",
    });

    await ctx.scheduler.runAfter(0, internal.personas.actions.generatePersonaNarrative, {
      personaId,
      contractorId: args.contractorId,
    });

    return personaId;
  },
});
```

---

## Next.js ↔ Convex Integration

### Setup (App Router)

```
app/
├── layout.tsx                 # Wrap children in ConvexClientProvider
├── ConvexClientProvider.tsx   # "use client" — ConvexProvider + ConvexReactClient
├── page.tsx                   # Landing / onboarding
└── map/
    └── page.tsx               # Bounty board (client component)
```

**1. Install**

```bash
npm install convex
npx convex dev   # creates convex/ folder, links deployment, starts sync
```

**2. Environment**

```env
# .env.local
NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
```

**3. Provider** (`app/ConvexClientProvider.tsx`)

```tsx
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

**4. Root layout** — wrap `{children}` with `<ConvexClientProvider>`.

### Hook usage by feature

| Feature | Hook | Example |
|---|---|---|
| Map sprites | `useQuery` | `const leads = useQuery(api.households.queries.listForMap, { contractorId })` |
| Side panel | `useQuery` | `const household = useQuery(api.households.queries.getById, { householdId })` |
| Persona narrative | `useQuery` | `const persona = useQuery(api.personas.queries.getByHousehold, { householdId })` |
| Chat history | `useQuery` | `const messages = useQuery(api.chat.queries.listMessages, { householdId, contractorId })` |
| Send chat | `useMutation` | `const send = useMutation(api.chat.mutations.sendMessage)` |
| Pursue lead | `useMutation` | `const update = useMutation(api.households.mutations.updateStatus)` |
| Onboarding | `useMutation` | `const create = useMutation(api.contractors.mutations.create)` |

All map/chat components must be `"use client"` — Convex reactive hooks require a browser WebSocket.

### Session identity (MVP, no auth)

```tsx
// lib/session.ts
export function getOrCreateSessionId(): string {
  const KEY = "householdiq_session";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
```

On app load: `useQuery(api.contractors.queries.getBySession, { sessionId })` — if null, show onboarding.

### Server Components (optional, non-reactive)

For SSR-only pages that don't need live updates:

```tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const neighborhoods = await fetchQuery(api.households.queries.listNeighborhoods, {});
```

Prefer client `useQuery` for the map and chat. Use `fetchQuery` / `preloadQuery` only for static landing content.

### Do NOT call actions from the client directly

Use mutations that schedule actions (see pattern above). The only exception is fire-and-forget utilities with no DB state — none exist in this app.

---

## ETL Pipeline → Convex Data Insertion

The Python ETL runs **offline** before deployment (see architecture diagram in `BRIEF.md`). It:

1. Pulls SF Open Data permits, Assessor parcels, Census ACS block groups
2. Joins and normalizes addresses
3. Assigns demographic clusters from pre-processed AHS/CEX/GSS/Pew lookup tables
4. Computes lead scores and sprite metadata
5. **Pushes results to Convex**

### Recommended ingestion path: HTTP action with shared secret

```
etl/
├── load_to_convex.py          # Calls Convex HTTP endpoints
├── output/
│   ├── households.jsonl       # one JSON object per line
│   └── clusters.json
└── ...
```

**Convex side** (`convex/http.ts`):

```typescript
http.route({
  path: "/etl/clusters",
  method: "POST",
  handler: upsertClustersHttp,   // validates ETL_SECRET header, calls internal mutation
});

http.route({
  path: "/etl/households",
  method: "POST",
  handler: bulkUpsertHouseholdsHttp,  // batch ≤100 records per request
});
```

**Python side** (`etl/load_to_convex.py`):

```python
import os, json, requests

CONVEX_SITE_URL = os.environ["CONVEX_SITE_URL"]  # https://<dep>.convex.site
ETL_SECRET = os.environ["ETL_SECRET"]

def upsert_households_batch(records: list[dict]):
    resp = requests.post(
        f"{CONVEX_SITE_URL}/etl/households",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {ETL_SECRET}",
        },
        json={"households": records, "batchId": "2025-06-28-run-1"},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()

# Stream JSONL in batches of 100
batch = []
with open("output/households.jsonl") as f:
    for line in f:
        batch.append(json.loads(line))
        if len(batch) == 100:
            upsert_households_batch(batch)
            batch = []
if batch:
    upsert_households_batch(batch)
```

### Alternative: Convex Python client

```python
from convex import ConvexClient
client = ConvexClient(os.environ["CONVEX_URL"])
client.mutation("etl/mutations:bulkUpsertHouseholds", {"households": records})
```

Use the HTTP path if you want auth middleware and request logging at the edge. Both are valid.

### Upsert semantics

`bulkUpsertHouseholds` internal mutation:

1. For each record, query `by_normalizedAddress` index.
2. If found → `ctx.db.patch` (update scores, permits, cluster — preserve `status` and `contactInfo` if already set).
3. If not found → `ctx.db.insert` with `status: "available"`.
4. Return `{ inserted, updated, errors }`.

Run cluster upsert **before** household upsert so `clusterId` foreign keys resolve. ETL should map cluster slugs → Convex IDs on first run, or embed cluster slug in household payload and resolve server-side.

### ETL payload shape (household)

```json
{
  "normalizedAddress": "123 MISSION ST|SF|94103",
  "streetAddress": "123 Mission St",
  "zipCode": "94103",
  "neighborhood": "Mission",
  "lat": 37.7749,
  "lng": -122.4194,
  "ownerOccupied": true,
  "assessedValue": 1250000,
  "homeAgeYears": 85,
  "permits": [{ "permitType": "HVAC REPLACEMENT", "vertical": "hvac", "datePulled": "2008-03-15", "dateFinaled": "2008-06-01", "isOpen": false }],
  "lastHvacPermitAgeYears": 17,
  "censusBlockGroup": "060750615021",
  "clusterSlug": "long-time-budget-conscious-owner",
  "matchScore": 82,
  "urgencyFlag": true,
  "spriteColor": "green",
  "spriteVariant": 2,
  "excluded": false
}
```

---

## OpenAI Persona Generation Flow

Two distinct OpenAI use cases — do not conflate them.

### A. Contractor profile extraction (onboarding)

```
Contractor submits form
        │
        ▼
contractors.create (mutation)
        │── insert contractor (profileExtractionStatus: "pending")
        │── scheduler → contractors.extractContractorProfile (action)
        ▼
Action calls OpenAI with structured output schema
        │
        ▼
contractors.saveExtractedProfile (internal mutation)
        │── patch extractedProfile, status → "ready"
        ▼
Frontend useQuery auto-updates → map loads with correct vertical filter
```

**Structured output fields:** `serviceTypes`, `verticals`, `pricePoint`, `targetHomeAge`, `targetNeighborhoods`, `customerPreferences`.

### B. Persona narration (first household open)

```
Contractor clicks sprite
        │
        ▼
households.markViewed (mutation)
personas.ensurePersona (mutation)
        │── insert persona (status: "pending") if absent
        │── scheduler → personas.generatePersonaNarrative (action)
        ▼
Action:
  1. runQuery → load household, cluster, contractor profile
  2. assemble systemPrompt from cluster.personaTemplate + property data
  3. call OpenAI → narrative, summary, objections, conversionTips
  4. runMutation → personas.saveNarrative
        ▼
Frontend useQuery(personas.getByHousehold) reacts:
  status "pending"/"generating" → skeleton loader
  status "ready" → render narrative in side panel
```

### C. Persona chat (ongoing)

```
Contractor sends message
        │
        ▼
chat.sendMessage (mutation)
        │── insert user chatMessage
        │── scheduler → chat.generatePersonaReply (action)
        ▼
Action:
  1. runQuery → persona (for system prompt), recent chatMessages, household
  2. call OpenAI chat with message history + in-character system prompt
  3. runMutation → chat.saveAssistantMessage
        ▼
Frontend useQuery(chat.listMessages) appends assistant bubble
```

### Prompt assembly (`convex/lib/prompts.ts`)

Keep all prompt templates in one file. Actions import from here — never hardcode prompts in action handlers.

```
buildPersonaSystemPrompt({ cluster, household, contractorProfile }) → string
buildPersonaNarrationPrompt({ cluster, household, contractorProfile }) → string
buildChatSystemPrompt({ persona, household, cluster }) → string
buildContractorExtractionPrompt({ businessDescription }) → string
```

Store the assembled `systemPrompt` on the persona document for debugging and reproducibility.

### OpenAI action runtime

Use `"use node"` at the top of action files that need the OpenAI npm SDK:

```typescript
"use node";
import OpenAI from "openai";
// ...
```

Set `OPENAI_API_KEY` in the Convex dashboard under Settings → Environment Variables.

---

## Environment Variables & Secrets

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Next.js `.env.local` | Client WebSocket + API |
| `OPENAI_API_KEY` | Convex dashboard | Persona + extraction actions |
| `ORANGE_SLICE_API_KEY` | Convex dashboard | Contact enrichment action |
| `ETL_SECRET` | Convex dashboard + ETL env | Authenticate HTTP ingestion |
| `CONVEX_SITE_URL` | ETL env | `https://<dep>.convex.site` for HTTP actions |
| `CONVEX_URL` | ETL env (optional) | For Python client alternative |

Never put `OPENAI_API_KEY` or `ETL_SECRET` in Next.js env — they would be exposed to the browser.

---

## Agent Checklist (Implementation Order)

Use this sequence to avoid blocked dependencies:

- [ ] **1. Scaffold** — `npx convex dev`, create `schema.ts` with all tables
- [ ] **2. ETL mutations** — `etl.bulkUpsertHouseholds`, `etl.upsertClusters` (internal)
- [ ] **3. ETL HTTP** — wire `convex/http.ts`, test with curl + sample JSON
- [ ] **4. Run Python ETL** — load clusters, then households for 3–5 neighborhoods
- [ ] **5. Household queries** — `listForMap`, `getById`, verify in Convex dashboard
- [ ] **6. Contractor mutations** — `create` + profile extraction action
- [ ] **7. Next.js provider** — `ConvexClientProvider`, onboarding flow
- [ ] **8. Map page** — `useQuery(listForMap)`, render sprites from Convex data
- [ ] **9. Persona flow** — `ensurePersona` + generation action + side panel
- [ ] **10. Chat flow** — `sendMessage` + reply action + chat UI
- [ ] **11. Enrichment** — Orange Slice action on "Get contact info"
- [ ] **12. Polish** — error states, loading skeletons, status transitions

---

## Quick Reference Links

- [Convex Next.js Quickstart](https://docs.convex.dev/quickstart/nextjs)
- [Convex Schema docs](https://docs.convex.dev/database/schemas)
- [Convex Actions](https://docs.convex.dev/functions/actions)
- [Convex HTTP Actions](https://docs.convex.dev/functions/http-actions)
- [Convex Python Client](https://docs.convex.dev/client/python)
- [Product Brief](./BRIEF.md)
