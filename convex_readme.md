# Convex Build Guide — HouseholdIQ

> **Audience:** frontend + backend teammates  
> **UI branch:** `feature/quest-board-ui`  
> **Rule:** Frontend imports only from `api.*` public queries/mutations — never `internal.*`

---

## Priority queue — build in this order

| Pri | Function | File | Owner | Blocks |
|-----|----------|------|-------|--------|
| **P0** | `leads.listLeads` | `convex/leads.ts` | — | ✅ done |
| **P0** | `leads.bulkUpsertLeads` | `convex/leads.ts` | ETL | ✅ done |
| **P0** | Fix map loading gate | `QuestBoard.tsx` | FE | Vercel demo |
| **P1** | `leads.getByExternalId` | `convex/leads.ts` | BE | Side panel live refresh |
| **P1** | `leads.markViewed` | `convex/leads.ts` | BE | Lead state |
| **P1** | `leads.updateStatus` | `convex/leads.ts` | BE | Pursue / skip buttons |
| **P2** | `contractors.getBySession` | `convex/contractors.ts` | BE | Onboarding gate |
| **P2** | `contractors.create` | `convex/contractors.ts` | BE | Onboarding form |
| **P3** | `personas.getByLead` | `convex/personas.ts` | BE | Persona panel |
| **P3** | `personas.ensurePersona` | `convex/personas.ts` | BE | Persona generation |
| **P4** | `chat.listMessages` | `convex/chat.ts` | BE | Chat UI |
| **P4** | `chat.sendMessage` | `convex/chat.ts` | BE | Chat UI |
| **P5** | `enrichment.requestContactInfo` | `convex/enrichment.ts` | BE | Contact button |
| **P6** | `POST /etl/leads` | `convex/http.ts` | BE | Python auto-ingest |

Internal only (never call from UI): `extractProfile`, `generate`, `generateReply`, `fetchContact`, all `save*` / `mark*` internals.

---

## Frontend API contract

Copy these types into `src/types/api.ts`. Backend return shapes **must match exactly**.

### Shared types

```typescript
// src/types/api.ts — frontend contract (keep in sync with convex handlers)

export type LeadStatus = "available" | "viewed" | "pursued" | "skipped";
export type PersonaStatus = "pending" | "generating" | "ready" | "error";
export type ProfileStatus = "pending" | "ready" | "error";
export type ChatRole = "user" | "assistant";

/** Map + side panel — matches src/types/lead.ts Lead */
export type LeadDTO = {
  id: string;                    // === Convex externalId
  address: string;
  lat: number;
  lng: number;
  neighborhood?: string;
  matchScore: number;            // 0–100
  urgent: boolean;
  spriteVariant: 0 | 1 | 2 | 3;
  permitAgeYears: number;
  lastPermitType?: string;
  lastPermitDate?: string;
  hasOpenPermit?: boolean;
  homeAgeYears: number;
  ownerOccupied?: boolean;
  assessedValue?: number;
  lastSaleDate?: string;
  clusterId?: string;
  cluster: string;
  distanceMiles?: number;
  vertical?: "hvac" | "electrical";
  dataSource?: "placeholder" | "etl";
  // P1 additions:
  status?: LeadStatus;
  contactPhone?: string;
  contactEmail?: string;
};

export type ContractorDTO = {
  _id: string;
  sessionId: string;
  businessDescription: string;
  businessAddress: string;
  lat: number;
  lng: number;
  profileStatus: ProfileStatus;
  extractedProfile?: {
    verticals: ("hvac" | "electrical")[];
    pricePoint: "budget" | "mid" | "premium";
    serviceTypes: string[];
    targetNeighborhoods?: string[];
  };
};

export type PersonaDTO = {
  _id: string;
  leadExternalId: string;
  status: PersonaStatus;
  narrative?: string;
  summary?: string;
  errorMessage?: string;
};

export type ChatMessageDTO = {
  _id: string;
  leadExternalId: string;
  contractorId: string;
  role: ChatRole;
  content: string;
  _creationTime: number;
};
```

---

## P0 — Shipped + unblock demo

### `leads.listLeads` ✅

```typescript
// convex/leads.ts
export const listLeads = query({
  args: {},
  returns: v.array(/* LeadDTO fields — see handler map below */),
  handler: async (ctx) => LeadDTO[],
});
```

**Frontend hook:**
```typescript
const leads = useQuery(api.leads.listLeads, {});
// undefined = loading | LeadDTO[] = ready
```

**Response:** `LeadDTO[]`, sorted by `matchScore` desc. Excludes `hasOpenPermit === true`.

**Maps `externalId` → `id` in handler.** Already implemented.

---

### `leads.bulkUpsertLeads` ✅ (ETL only — not called from UI)

```typescript
export const bulkUpsertLeads = mutation({
  args: { leads: v.array(v.object({ externalId: v.string(), /* ...leadFields */ })) },
  returns: v.object({ inserted: v.number(), updated: v.number(), total: v.number() }),
});
```

---

### P0 frontend fix (no Convex)

`QuestBoard.tsx` — always render `<QuestMap leads={leads} />`. Remove Convex loading gate.

---

## P1 — Lead detail + interaction

**Schema add (3 fields on `leads`):** `status?`, `contactPhone?`, `contactEmail?`

### `leads.getByExternalId`

```typescript
export const getByExternalId = query({
  args: { externalId: v.string() },
  returns: v.union(v.null(), /* LeadDTO validator */),
  handler: async (ctx, { externalId }) => LeadDTO | null,
});
```

**Frontend:**
```typescript
const lead = useQuery(api.leads.getByExternalId, { externalId: selectedId });
```

**Response:** full `LeadDTO` or `null`.

---

### `leads.markViewed`

```typescript
export const markViewed = mutation({
  args: { externalId: v.string() },
  returns: v.null(),
  handler: async (ctx, { externalId }) => {
    // patch status → "viewed" only if unset or "available"
  },
});
```

**Frontend:** call in `QuestBoard.handleSelectLead` on sprite click.

---

### `leads.updateStatus`

```typescript
export const updateStatus = mutation({
  args: {
    externalId: v.string(),
    status: v.union(v.literal("pursued"), v.literal("skipped")),
  },
  returns: v.null(),
});
```

**Frontend:** `LeadSidePanel` Pursue / Skip buttons.

```typescript
const updateStatus = useMutation(api.leads.updateStatus);
await updateStatus({ externalId: lead.id, status: "pursued" });
```

---

## P2 — Contractor session

**New table:** `contractors` · index `by_sessionId`

### `contractors.getBySession`

```typescript
export const getBySession = query({
  args: { sessionId: v.string() },
  returns: v.union(v.null(), /* ContractorDTO */),
  handler: async (ctx, { sessionId }) => ContractorDTO | null,
});
```

**Frontend:**
```typescript
const sessionId = getOrCreateSessionId(); // src/lib/session.ts
const contractor = useQuery(api.contractors.getBySession, { sessionId });
// null → show OnboardingForm
// profileStatus === "pending" → show spinner on map
// profileStatus === "ready" → show QuestBoard
```

---

### `contractors.create`

```typescript
export const create = mutation({
  args: {
    sessionId: v.string(),
    businessDescription: v.string(),
    businessAddress: v.string(),
    lat: v.number(),
    lng: v.number(),
    googlePlaceId: v.optional(v.string()),
  },
  returns: v.id("contractors"),
  handler: async (ctx, args) => {
    // insert profileStatus: "pending"
    // ctx.scheduler.runAfter(0, internal.contractors.extractProfile, { contractorId })
    return contractorId;
  },
});
```

**Frontend:**
```typescript
const create = useMutation(api.contractors.create);
const id = await create({ sessionId, businessDescription, businessAddress, lat, lng });
```

**Side effect:** schedules OpenAI profile extraction → `profileStatus` becomes `"ready"`. UI reacts via `getBySession` subscription.

---

## P3 — Persona

**New table:** `personas` · index `by_lead` on `leadExternalId`

### `personas.getByLead`

```typescript
export const getByLead = query({
  args: { leadExternalId: v.string() },
  returns: v.union(v.null(), /* PersonaDTO */),
});
```

**Frontend (`LeadSidePanel`):**
```typescript
const persona = useQuery(api.personas.getByLead, { leadExternalId: lead.id });
// null → not started
// status pending|generating → <Spinner />
// status ready → render persona.narrative
// status error → render persona.errorMessage
```

---

### `personas.ensurePersona`

```typescript
export const ensurePersona = mutation({
  args: {
    leadExternalId: v.string(),
    contractorId: v.id("contractors"),
  },
  returns: v.id("personas"),
  handler: async (ctx, args) => {
    // idempotent: return existing _id if found
    // else insert { status: "pending" }, schedule internal.personas.generate
  },
});
```

**Frontend:** call alongside `markViewed` on sprite click.

```typescript
await ensurePersona({ leadExternalId: lead.id, contractorId: contractor._id });
```

---

## P4 — Chat

**New table:** `chatMessages` · index `by_lead_contractor` on `[leadExternalId, contractorId]`

### `chat.listMessages`

```typescript
export const listMessages = query({
  args: {
    leadExternalId: v.string(),
    contractorId: v.id("contractors"),
  },
  returns: v.array(/* ChatMessageDTO */),
  // ordered ascending by _creationTime
});
```

**Frontend (`PersonaChat.tsx`):**
```typescript
const messages = useQuery(api.chat.listMessages, { leadExternalId, contractorId });
```

---

### `chat.sendMessage`

```typescript
export const sendMessage = mutation({
  args: {
    leadExternalId: v.string(),
    contractorId: v.id("contractors"),
    content: v.string(),
  },
  returns: v.id("chatMessages"),
  handler: async (ctx, args) => {
    // insert { role: "user", content }
    // schedule internal.chat.generateReply
    return messageId;
  },
});
```

**Frontend:**
```typescript
const send = useMutation(api.chat.sendMessage);
await send({ leadExternalId, contractorId, content: input });
// assistant reply appears via listMessages subscription when action completes
```

**UX:** show typing indicator while last message is `user` and no newer `assistant` message exists.

---

## P5 — Enrichment

### `enrichment.requestContactInfo`

```typescript
export const requestContactInfo = mutation({
  args: {
    externalId: v.string(),
    contractorId: v.id("contractors"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // schedule internal.enrichment.fetchContact
    // action patches lead.contactPhone / contactEmail
  },
});
```

**Frontend:** enable button when `lead.status === "pursued"`.

```typescript
const enrich = useMutation(api.enrichment.requestContactInfo);
await enrich({ externalId: lead.id, contractorId });
// re-fetch via getByExternalId or listLeads subscription
```

**Response fields on lead:** `contactPhone?`, `contactEmail?`

---

## P6 — ETL HTTP (backend-only)

```typescript
// convex/http.ts — POST /etl/leads
// Request:  { leads: LeadIngestRow[] }
// Response: { inserted: number, updated: number, total: number }
// Auth:     Authorization: Bearer ${ETL_SECRET}
```

Python calls this; frontend never touches it.

---

## UI wiring map

| Screen | Queries | Mutations |
|--------|---------|-----------|
| `QuestBoard.tsx` | `listLeads`, `getBySession` | — |
| `OnboardingForm.tsx` | — | `create` |
| `QuestMap.tsx` / `LeadSprite.tsx` | (props from parent) | — |
| `QuestBoard` on sprite click | — | `markViewed`, `ensurePersona` |
| `LeadSidePanel.tsx` | `getByExternalId`, `getByLead` | `updateStatus`, `requestContactInfo` |
| `PersonaChat.tsx` | `listMessages` | `sendMessage` |

---

## Schema decisions (short)

Don't re-litigate these — just implement.

| Decision | Choice | Why |
|----------|--------|-----|
| Lead primary key for UI | `externalId` → exposed as `id` | ETL idempotency; UI already uses `lead.id` |
| One leads table (not `households`) | `leads` | Already shipped on UI branch |
| Contractor identity (MVP) | `sessionId` in localStorage | No auth in BRIEF |
| Persona keyed by | `leadExternalId` string | Avoid cross-table `_id` lookups from UI |
| Chat scoped to | `leadExternalId` + `contractorId` | Per-contractor conversations |
| Open permits | filter in `listLeads` | Don't show active construction |
| Proximity | `distanceMiles` on lead doc | Computed at ETL time per contractor OR batch |
| Async external APIs | mutation → scheduler → internalAction | Convex pattern; keys stay server-side |

**Full validators:** mirror `leadFields` in `convex/leads.ts` + `src/types/lead.ts`. Add new tables only when implementing P2+.

---

## Internal functions (backend reference)

Not part of frontend contract. Signatures for implementers:

```typescript
// convex/contractorsActions.ts ("use node")
internal.contractors.extractProfile({ contractorId: Id<"contractors"> }): void
internal.contractors.saveProfile({ contractorId, extractedProfile }): void

// convex/personasActions.ts
internal.personas.generate({ personaId: Id<"personas">, contractorId: Id<"contractors"> }): void
internal.personas.markGenerating({ personaId }): void
internal.personas.saveNarrative({ personaId, narrative, summary }): void
internal.personas.markError({ personaId, errorMessage }): void

// convex/chatActions.ts
internal.chat.generateReply({ leadExternalId, contractorId, userContent }): void
internal.chat.saveAssistantMessage({ leadExternalId, contractorId, content }): void

// convex/enrichmentActions.ts
internal.enrichment.fetchContact({ externalId }): void
internal.enrichment.saveContactInfo({ externalId, contactPhone?, contactEmail? }): void
```

---

## Env vars

| Var | Where | Pri |
|-----|-------|-----|
| `NEXT_PUBLIC_CONVEX_URL` | Vercel / `.env.local` | P0 |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Vercel / `.env.local` | P0 |
| `OPENAI_API_KEY` | Convex dashboard | P2–P4 |
| `ORANGE_SLICE_API_KEY` | Convex dashboard | P5 |
| `ETL_SECRET` | Convex + Python | P6 |

---

## References

- [`BRIEF.md`](./BRIEF.md) — scoring rules
- `docs/DATA_INTEGRATION.md` on `feature/quest-board-ui` — ETL field list
- `convex/seed.example.json` — sample `bulkUpsertLeads` payload
