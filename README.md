# HouseholdIQ

Gamified lead qualification for San Francisco homeowners. Insurance agents explore a Mapbox coverage board — animated pixel-house sprites mark ranked households. Click a lead to review coverage gaps, chat with an AI persona of the homeowner, and **Pursue** to push the lead into an Orange Slice outbound pipeline (email, phone, LinkedIn, door knock).

This repo ships **two products** on separate branches and Convex deployments:

| Branch | Product | Convex deployment |
|--------|---------|-------------------|
| **`feature/insurance-app`** | **Coverage Board** (insurance) | `compassionate-ptarmigan-622` |
| `feature/quest-board-ui` | Contractor bounty board (legacy) | `watchful-condor-23` |

**Production (insurance):** https://householdiq-insurance.vercel.app

---

## Table of contents

1. [Quick start](#quick-start)
2. [Architecture overview](#architecture-overview)
3. [Tech stack](#tech-stack)
4. [Repository layout](#repository-layout)
5. [Data pipeline](#data-pipeline)
6. [Scoring & ranking](#scoring--ranking)
7. [UI & map](#ui--map)
8. [Persona & chat](#persona--chat)
9. [Contact enrichment](#contact-enrichment)
10. [Outbound & Orange Slice](#outbound--orange-slice)
11. [Auth, orgs & CRM](#auth-orgs--crm)
12. [Pipeline & Slack](#pipeline--slack)
13. [Convex backend](#convex-backend)
14. [Environment variables](#environment-variables)
15. [Scripts & deployment](#scripts--deployment)
16. [Documentation index](#documentation-index)

---

## Quick start

### Prerequisites

- Node.js 20+
- Mapbox token ([account.mapbox.com](https://account.mapbox.com/))
- Google Maps API key (Places + Geocoding)
- Convex project linked to this repo

### Local development (two terminals)

```bash
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_MAPBOX_TOKEN, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, NEXT_PUBLIC_CONVEX_URL

npm install
npm run convex:dev   # terminal 1 — syncs Convex functions
npm run dev          # terminal 2 — http://localhost:3000
```

### Load household data

```bash
./scripts/import-insurance-leads.sh
```

Default scope imports ~4k ACS-enriched records from `origin/insurance`. See [Data pipeline](#data-pipeline).

### Optional: Clerk auth locally

Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env.local` to enable sign-in, orgs, Settings, and Pipeline pages.

---

## Architecture overview

```mermaid
flowchart TD
  subgraph ETL["Offline ETL (origin/insurance)"]
    A[SF Assessor + ACS] --> B[explore/insurance.py]
    B --> C[household_records*.json]
  end

  subgraph Import["Import"]
    C --> D[import-insurance-leads.sh]
    D --> E[(Convex leads)]
  end

  subgraph App["Next.js app"]
    F[Clerk auth + OrgGate] --> G[QuestBoard map]
    G --> H[LeadSidePanel]
    H --> I[Persona / Chat]
    H --> J[Pursue lead]
  end

  subgraph Enrich["Contact enrichment"]
    J --> K[Owner resolution]
    K --> L[Orange Slice contact waterfall]
    L --> M[(lead.contactInfo)]
  end

  subgraph Outbound["Orange Slice E2E"]
    J --> N[Webhook push → sheet]
    N --> O[Find contact / LinkedIn / Gmail]
    O --> P[POST /orangeslice/status]
    P --> Q[(outreach_records)]
    Q --> R[/pipeline dashboard]
  end

  E --> G
  M --> N
```

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Convex (queries, mutations, actions, HTTP routes) |
| Auth | Clerk (`@clerk/nextjs`) — optional locally |
| Map | Mapbox GL (`streets-v12` + pastel cartoon overrides) |
| Geocoding | Google Maps API |
| AI | OpenAI (`gpt-4o-mini`) — persona, chat, onboarding, playbook |
| Outbound CRM | Orange Slice (SERP, LinkedIn find, contact waterfall, Gmail in sheet) |
| Research | Exa (optional owner discovery), Fiber AI (agency intel only) |
| Notifications | Slack OAuth (optional per-org) |
| ETL | Python on `origin/insurance` branch |
| Deploy | Vercel + Convex (`vercel.json` runs `convex deploy --cmd 'npm run build'`) |

---

## Repository layout

```
├── src/
│   ├── app/                    # Pages: /, /pipeline, /settings, /sign-in, /sign-up
│   │   └── api/slack/          # Slack OAuth routes
│   ├── components/
│   │   ├── quest-board/        # Map UI (QuestBoard, QuestMap, LeadSprite, LeadSidePanel)
│   │   ├── pipeline/           # Outreach funnel table
│   │   ├── settings/           # Orange Slice + Slack + invite code
│   │   └── auth/               # OrgGate (create/join org)
│   ├── types/lead.ts           # Canonical UI + enrichment types
│   ├── data/placeholderLeads.ts
│   └── lib/                    # session, lead-utils, map style, google-places
│
├── convex/
│   ├── schema.ts               # leads, organizations, agents, outreach_records, …
│   ├── leads.ts                # listLeads, bulkUpsert, owner/contact patches
│   ├── persona.ts              # generatePersona, sendChatMessage
│   ├── enrichment.ts           # Owner + contact resolution pipeline
│   ├── outreach.ts             # outreach_records, pipeline queries
│   ├── outreachActions.ts      # startOutreach (Pursue), campaigns
│   ├── onboarding.ts           # Agent setup + company enrichment
│   ├── organizations.ts        # Org CRUD, integrations
│   ├── agents.ts               # Auth-scoped agent profiles
│   ├── contractors.ts          # Session-scoped profiles (legacy / anonymous)
│   ├── http.ts                 # Orange Slice HTTP endpoints
│   └── lib/                    # scoring, orangeslice, campaigns, auth, …
│
├── scripts/
│   ├── import-insurance-leads.sh       # Primary data import
│   ├── join_assessor_owners.py         # Join private assessor roll owner names
│   ├── configure-orangeslice-*.sh      # Webhook / sheet URL setup
│   └── enrich-owners.sh
│
├── docs/                       # Integration guides (see Documentation index)
├── explore/insurance.py        # Offline ETL (full module on origin/insurance)
├── BRIEF.md                    # Product brief
└── INSURANCE_BUILD.md          # ETL build log
```

---

## Data pipeline

### Source

San Francisco Assessor secured roll + ACS enrichment, processed offline on branch `origin/insurance`:

- `household_records.json` — top ~2k by composite score
- `household_records_acs.json` — ACS-enriched citywide (~4k)
- `household_demo_citywide.json` — demo spread

Each record includes geocoded `lat`/`lng` tied to a **real parcel address** (not neighborhood centroids).

### Import

```bash
./scripts/import-insurance-leads.sh
```

| `INSURANCE_DATA_SCOPE` | Records |
|------------------------|---------|
| `acs` (default) | ~4k ACS-enriched |
| `merged` | ~5.5k deduped across all files |
| `full` | ~2k top composite |
| `citywide` | ~2k demo spread |
| `file` | Single file via `INSURANCE_DATA_FILE` |

Rows dedupe by `household_id` (highest `composite_score` wins). Uses `convex import --table leads --replace`.

### Owner names (critical for contact enrichment)

Public DataSF APIs **do not include owner names** (CA privacy). To improve email/phone discovery:

1. Obtain SF Assessor secured roll with owner columns ([sf.gov resource](https://www.sf.gov/resource--secured-property-tax-data))
2. Join onto household JSON:

```bash
python scripts/join_assessor_owners.py \
  --households .cache/insurance-import/household_records_acs.json \
  --assessor data/assessor_owners.csv \
  --output .cache/insurance-import/household_records_acs_with_owners.json

INSURANCE_DATA_SCOPE=file \
INSURANCE_DATA_FILE=.cache/insurance-import/household_records_acs_with_owners.json \
./scripts/import-insurance-leads.sh
```

The import script maps `recorded_owner_full_name`, `owner_full_name`, and parcel fields when present.

See [docs/DATA_INTEGRATION.md](./docs/DATA_INTEGRATION.md).

---

## Scoring & ranking

From [BRIEF.md](./BRIEF.md):

```
composite = need × 0.70 + timing × 0.30
```

| Signal | Meaning |
|--------|---------|
| **Need** | Replacement-cost gap (Coverage A underinsurance) |
| **Timing** | Tenure, purchase year, homeowner exemption, ACS receptivity |

`listLeads` sorts by composite → need → timing, then samples up to **150** map pins with hot/warm/cold balance. Agent office proximity is **display-only**, not a ranking factor.

Sprite colors: green (high), yellow (medium), red (low composite).

---

## UI & map

| Component | Role |
|-----------|------|
| `QuestBoard.tsx` | Main shell — onboarding gate, lead query, header |
| `QuestMap.tsx` | Mapbox map with business pin + lead sprites |
| `LeadSprite.tsx` | CSS pixel-house overlays |
| `LeadSidePanel.tsx` | Coverage gap, persona, chat, Pursue button |
| `OnboardingPanel.tsx` | Agent name, agency description, office address |
| `ContractorContextPanel.tsx` | Agency intel card (legacy naming) |
| `BoardLegend` / `LeadFocusFilter` | Score legend and minimum-score filter |

Map style: `src/lib/map-cartoon-style.ts` — pastel cartoon overrides on Mapbox `streets-v12`.

---

## Persona & chat

When an agent selects a lead:

1. **`generatePersona`** — deterministic traits from gap/tenure + GPT summary
2. **`sendChatMessage`** — multi-turn homeowner simulation (GPT, in-character)

Chat history persists in Convex `chatHistory` (keyed by `sessionId` + `leadId`).

Persona resets when owner identity changes (after enrichment).

---

## Contact enrichment

Finding emails, phones, and LinkedIn profiles is a **two-stage pipeline** in `convex/enrichment.ts`.

### Stage 1 — Owner identity

`resolveOwnerWithAssessor` (`convex/lib/ownerResolution.ts`):

1. `recordedOwnerFullName` from ingest (assessor roll join — **best signal**)
2. DataSF parcel metadata (block/lot, exemption — **no names**)
3. Exa web search (optional, `EXA_API_KEY`)
4. Orange Slice SERP (`/execute/serp-batch`)
5. GPT extraction from combined evidence
6. LinkedIn profile find (`/execute/linkedin-find-profile-url`)

Placeholder names like `"Property Owner"` are rejected and force re-resolution.

### Stage 2 — Contact discovery (Exa-first, Orange Slice optional)

Household contacts are resolved **in-app at Pursue time** — no Orange Slice sheet reconfiguration needed.

1. **Exa people search** (primary when `EXA_API_KEY` is set) — searches TruePeopleSearch, Whitepages, FastPeopleSearch, etc. for the owner name + address; extracts phone/email via regex + GPT.
2. **Orange Slice contact waterfall** (optional fallback) — runs if configured; failures are ignored when Exa succeeds.

Results merge (best emails + phones + LinkedIn). Weak empty results are not cached.

### Required Convex env for enrichment

```
EXA_API_KEY=...              # Primary contact finder (already on your deployment)
ORANGE_SLICE_API_KEY=...     # Optional fallback + LinkedIn find
ORANGE_SLICE_ENABLED=true
OPENAI_API_KEY=...           # GPT extraction from people-search snippets
```

---

## Outbound & Orange Slice

### Pursue flow

1. Agent clicks **Pursue lead** → `outreachActions.startOutreach`
2. Contact enrichment runs (or uses cache)
3. Insurance campaign templates rendered (`coverage_review`, `renewal_window`)
4. Row pushed to Orange Slice sheet webhook
5. `outreach_records` row created with status `queued` or `sheet_synced`

### Sheet payload fields

`household_id`, `convex_lead_id`, `address`, `owner_name`, `match_score`, `gap_dollars`, `coverage_hook`, `agent_name`, `agency_name`, `email`, `phone`, `email_2`, `phone_2`, `emails_json`, `phones_json`, `linkedin_url`, `playbook`, `touch1_subject`, `touch1_body`, `touch2_*`, `parcel_number`, `status`, …

Legacy aliases `contractor_name` / `contractor_business` kept for sheet compatibility.

### Orange Slice sheet workflow

Documented in [docs/ORANGE_SLICE_INSURANCE.md](./docs/ORANGE_SLICE_INSURANCE.md):

1. Import row from webhook
2. Enrichment columns: Find contact, Find LinkedIn (if empty)
3. Gmail columns: send touch 1 / touch 2
4. POST status back to HouseholdIQ

### Configure webhook

**Settings UI** (signed-in org admin): paste Orange Slice **Import from webhook** URL.

Or via script:

```bash
./scripts/configure-orangeslice-autopush.sh
```

### Convex HTTP endpoints

Base: `https://<deployment>.convex.site` — all require `Authorization: Bearer <OUTREACH_WEBHOOK_SECRET>`.

| Path | Method | Purpose |
|------|--------|---------|
| `/orangeslice/import` | GET | Pull queued leads |
| `/orangeslice/leads` | GET | Raw pending leads |
| `/orangeslice/ack` | POST | Acknowledge sheet sync |
| `/orangeslice/status` | POST | Status + contact updates from sheet |
| `/orangeslice/configure-webhook` | POST | Register webhook URL |

---

## Auth, orgs & CRM

### Clerk authentication

- Sign in / sign up via Clerk modals
- `OrgGate` wraps the main app — user must create or join an org
- One org per user; roles: `admin` | `member`
- Invite codes for joining

### Agent profiles

| Table | Scope | When used |
|-------|-------|-----------|
| `agents` | Per `userId` + `orgId` | Signed-in users |
| `contractors` | Per `sessionId` | Anonymous / legacy fallback |

`resolveAgentProfile` checks agents → contractors in that order.

Onboarding writes both tables when authenticated.

### Settings (`/settings`)

- Orange Slice sheet URL + webhook URL (per org)
- Slack OAuth connect
- Org invite code (admin)

---

## Pipeline & Slack

### Pipeline (`/pipeline`)

Table of org `outreach_records`: address, gap, match score, agent name, funnel status.

Statuses: `queued` → `sheet_synced` → `touch1_ready` → `touch1_sent` → `touch2_sent` → `replied` → `meeting` → `won` / `lost` / `d2d_planned`

### Slack notifications

Optional per-org Slack channel. Notifications fire on pursue and status updates when Slack is connected in Settings.

OAuth routes: `/api/slack/oauth`, `/api/slack/callback`

---

## Convex backend

### Schema tables

| Table | Purpose |
|-------|---------|
| `leads` | Household records + scores + persona + contactInfo |
| `organizations` | Agency name, invite code, Orange Slice + Slack config |
| `memberships` | User ↔ org with role |
| `agents` | Auth-scoped agent onboarding profile |
| `contractors` | Session-scoped profile (legacy) |
| `chatHistory` | Persona chat turns |
| `outreach_records` | Pursue pipeline state + activity log |
| `pipeline_config` | Global sheet webhook URL fallback |

### Key functions

| Module | Exports |
|--------|---------|
| `leads.ts` | `listLeads`, `getLead`, `bulkUpsertHouseholds` |
| `persona.ts` | `generatePersona`, `sendChatMessage` |
| `enrichment.ts` | `resolveContactAndOutreach`, `enrichContactFromLead`, `lookupOwnerName` |
| `outreachActions.ts` | `startOutreach`, `listCampaigns`, `logTouchSent` |
| `outreach.ts` | `getOutreachForLead`, `listOrgOutreach`, `getOutreachConfig` |
| `onboarding.ts` | `completeOnboarding`, `refreshCompanyContext` |
| `organizations.ts` | `createOrganization`, `joinOrganization`, `getOrgSettings` |
| `agents.ts` | `getAgent`, `clearAgent`, `listOrgAgents` |

---

## Environment variables

### Client (`.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Yes | Map |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Address autocomplete |
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Convex client |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Prod | Clerk auth |
| `NEXT_PUBLIC_APP_URL` | Slack | OAuth redirect base |
| `NEXT_PUBLIC_ORANGE_SLICE_SHEET_URL` | Optional | Sheet link in UI |

### Server — Next.js / Vercel

| Variable | Purpose |
|----------|---------|
| `CLERK_SECRET_KEY` | Clerk server |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | Slack OAuth |
| `CONVEX_DEPLOY_KEY` | Vercel build deploys Convex |

### Convex dashboard

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Persona, chat, onboarding, playbook |
| `GOOGLE_MAPS_API_KEY` | Server geocoding |
| `ORANGE_SLICE_API_KEY` | Contact enrichment + SERP |
| `ORANGE_SLICE_ENABLED` | Must be `true` |
| `ORANGE_SLICE_SHEET_URL` | Global sheet link |
| `ORANGE_SLICE_SHEET_WEBHOOK_URL` | Auto-push on Pursue |
| `OUTREACH_WEBHOOK_SECRET` | Auth for HTTP routes |
| `EXA_API_KEY` | Optional owner web search |
| `FIBER_AI_API_KEY` | Optional agency intel |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk ↔ Convex JWT (optional) |

Per-org overrides in Settings: `sheetUrl`, `sheetWebhookUrl`.

Copy template: `.env.local.example`

---

## Scripts & deployment

### npm scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run convex:dev` | Convex dev sync |
| `npm run lint` | ESLint |

### Shell scripts

| Script | Description |
|--------|-------------|
| `import-insurance-leads.sh` | Fetch `origin/insurance` JSON → Convex import |
| `join_assessor_owners.py` | Join private assessor owner names onto household JSON |
| `configure-orangeslice-sheet.sh` | Set global Orange Slice sheet URL |
| `configure-orangeslice-autopush.sh` | Register webhook URL + secret |
| `import-sunset-leads.sh` | Legacy contractor import |
| `enrich-owners.sh` | Batch owner enrichment |

### Deploy to production

```bash
npx convex deploy -y
npx vercel --prod --yes
```

Vercel automatically runs `convex deploy` during build via `vercel.json`.

**Do not mix Convex deployments** — insurance and contractor data live on separate projects.

---

## Documentation index

| Doc | Contents |
|-----|----------|
| [BRIEF.md](./BRIEF.md) | Product overview, scoring, geography |
| [INSURANCE_BUILD.md](./INSURANCE_BUILD.md) | ETL build log |
| [AGENTS.md](./AGENTS.md) | Agent/coding conventions |
| [docs/DATA_INTEGRATION.md](./docs/DATA_INTEGRATION.md) | Field mapping, import checklist |
| [docs/ORANGE_SLICE_INSURANCE.md](./docs/ORANGE_SLICE_INSURANCE.md) | Insurance outbound setup |
| [docs/ORANGE_SLICE_INSURANCE_CHAT_PROMPT.txt](./docs/ORANGE_SLICE_INSURANCE_CHAT_PROMPT.txt) | Paste into Orange Slice sheet chat |
| [docs/ORANGE_SLICE_SHEET_TEMPLATE.md](./docs/ORANGE_SLICE_SHEET_TEMPLATE.md) | Full Pursue → Gmail flow |
| [docs/ORANGE_SLICE_IMPORT.md](./docs/ORANGE_SLICE_IMPORT.md) | Import API + webhook |
| [docs/orangeslice-import-example.json](./docs/orangeslice-import-example.json) | Sample import response |

---

## License

Private / YC growth hack project.
