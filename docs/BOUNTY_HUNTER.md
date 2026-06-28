# Bounty Hunter — Project Guide

**Bounty Hunter** is a wild-west themed insurance lead board for San Francisco property agents. Tagline: *Customer acquisition on the frontier.*

Agents explore a Mapbox map of ranked homeowner leads, review coverage gaps, chat with AI personas, and **Pursue** leads into an Orange Slice outbound pipeline. Slack alerts fire when enrichment completes or Orange Slice finds contact info.

> **Hosting note:** GitHub `main` is **source code only**. Production is deployed manually from a developer machine (`npx vercel --prod`). Do not rely on Git-connected auto-deploy unless you explicitly configure it yourself.

---

## Table of contents

1. [Architecture](#architecture)
2. [Match scoring (45 / 30 / 25)](#match-scoring-45--30--25)
3. [Local development](#local-development)
4. [Deploy from local (Vercel + Convex)](#deploy-from-local-vercel--convex)
5. [Data pipeline](#data-pipeline)
6. [Key features](#key-features)
7. [Environment variables](#environment-variables)
8. [Orange Slice & Slack](#orange-slice--slack)
9. [Repository layout](#repository-layout)
10. [Related docs](#related-docs)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js app (src/)                                         │
│  QuestBoard · QuestMap · LeadSidePanel · Pipeline · Settings│
└──────────────────────────┬──────────────────────────────────┘
                           │ useQuery / useAction
┌──────────────────────────▼──────────────────────────────────┐
│  Convex (convex/)                                           │
│  leads · persona · enrichment · outreach · organizations    │
└──────────────────────────┬──────────────────────────────────┘
                           │
     ┌─────────────────────┼─────────────────────┐
     ▼                     ▼                     ▼
 Mapbox GL           OpenAI / Exa          Orange Slice sheet
 (map tiles)         (persona + contact)   (outbound + webhooks)
```

**Offline scoring** (Python, `scoring/`) produces household JSON from SF Assessor + ACS census data. Import scripts load records into Convex `leads`.

---

## Match scoring (45 / 30 / 25)

Every lead gets a **match score out of 100** shown in the side panel bar graph:

| Component | Max pts | Source field | Meaning |
|-----------|---------|--------------|---------|
| **Risk** | 45 | `needScore` (0–1) | How underinsured vs rebuild cost |
| **Timing** | 30 | `timingScore` (0–1) | Renewal window, tenure, recent purchase |
| **Fit** | 25 | `acsReceptivityScore` (0–1) | Census household receptivity — will they engage? |

**Formula:**

```
matchScore = round(needScore × 45 + timingScore × 30 + fitScore × 25)
```

Implementation: `convex/lib/matchScore.ts`, `src/lib/lead-utils.ts`, UI in `LeadSidePanel.tsx`.

**Tier colors on the map:**

| Score | Tier | Color |
|-------|------|-------|
| ≥ 70 | Hot | Green |
| 40–69 | Warm | Amber |
| < 40 | Cold | Red |

If a lead has no ACS census profile, **Fit shows 0/25** — the bar still sums correctly.

---

## Local development

### Prerequisites

- Node.js 20+
- [Mapbox token](https://account.mapbox.com/)
- Google Maps API key (Places + Geocoding for onboarding)
- Convex project linked to this repo

### Setup

```bash
cp .env.local.example .env.local
# Fill NEXT_PUBLIC_MAPBOX_TOKEN, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, NEXT_PUBLIC_CONVEX_URL

npm install
npm run convex:dev   # terminal 1
npm run dev          # terminal 2 → http://localhost:3000
```

### Load leads

```bash
./scripts/import-insurance-leads.sh
```

Default imports ACS-enriched records. See [DATA_INTEGRATION.md](./DATA_INTEGRATION.md).

### Optional auth

Add Clerk keys to `.env.local` for sign-in, orgs, Settings, and Pipeline pages.

---

## Deploy from local (Vercel + Convex)

**Do this from your machine**, not via GitHub Actions (unless you set that up yourself).

```bash
# 1. Backend
npx convex deploy -y

# 2. Frontend (uses vercel.json buildCommand which runs convex deploy + next build)
npx vercel --prod
```

**Current production URLs** (as of last manual deploy):

- App: https://householdiq-insurance.vercel.app
- Convex: https://compassionate-ptarmigan-622.convex.cloud

Convex env vars (OpenAI, Exa, Orange Slice, Slack) are set in the **Convex dashboard**, not committed to git.

---

## Data pipeline

### Python scoring (`scoring/`)

| File | Purpose |
|------|---------|
| `scoring/insurance.py` | Need, timing, composite scoring |
| `scoring/acs.py` | Census block-group receptivity + archetypes |
| `scoring/sources.py` | SF Assessor SODA fetch |
| `scoring/SCORING.md` | Full scoring spec |

Output: `data/household_records_acs_citywide.json` (~1,872 SF households).

### Import to Convex

```bash
./scripts/import-insurance-leads.sh
```

| `INSURANCE_DATA_SCOPE` | Records |
|------------------------|---------|
| `acs` (default) | ~4k ACS-enriched |
| `merged` | ~5.5k deduped |
| `citywide` | ~2k demo spread |

Every lead must have geocoded `lat`/`lng` tied to a real address — not neighborhood centroids.

---

## Key features

### Map & sprites

- Mapbox `streets-v12` with western paint overrides (`src/lib/map-cartoon-style.ts`)
- Pixel cowboy sprites colored by tier (`LeadSprite.tsx`, `sprites.css`)
- ~150 citywide map pins via stratified grid sampling (`citywideMapSample`)

### Pursue + lasso animation

Click **Pursue** on a lead → lasso drags the sprite toward your agency pin while enrichment runs → **Captured · in CRM** when contact data returns.

### Side panel

- Match score breakdown (Risk / Timing / Fit)
- Coverage signals (rebuild cost, gap, tenure)
- Household profile + AI persona
- Pursue → Orange Slice pipeline

### Pipeline & Settings

- `/pipeline` — outreach funnel table
- `/settings` — org invite code, Orange Slice sheet URL, Slack channel

---

## Environment variables

See `.env.local.example` for the full list.

**Client (`.env.local`):**

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Yes | Map tiles |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Address autocomplete |
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Backend |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Optional | Auth |
| `CLERK_SECRET_KEY` | Optional | Auth |

**Convex dashboard (server-side):**

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Persona + owner extraction |
| `EXA_API_KEY` | Contact search |
| `ORANGE_SLICE_API_KEY` | Sheet sync + SERP |
| `OUTREACH_WEBHOOK_SECRET` | Validates Orange Slice webhooks |
| `SLACK_ORANGE_SLICE_CHANNEL_ID` | Alert channel (e.g. `C0BDR1CDBQS`) |

---

## Orange Slice & Slack

Orange Slice sheet pushes status updates to Convex HTTP endpoints. HouseholdIQ posts formatted alerts to Slack via the **HouseholdIQ bot** (not the Orange Slice Slack app).

Setup:

1. Settings → Connect Slack → paste channel ID
2. Invite HouseholdIQ bot to that channel
3. Paste chat prompt from `docs/ORANGE_SLICE_INSURANCE_CHAT_PROMPT.txt` into your Orange Slice sheet

Details: [ORANGE_SLICE_INSURANCE.md](./ORANGE_SLICE_INSURANCE.md)

---

## Repository layout

```
├── src/                    # Next.js frontend
│   ├── app/                # Pages + API routes
│   ├── components/quest-board/   # Map UI
│   ├── components/pipeline/
│   ├── components/settings/
│   └── lib/lead-utils.ts   # Match score breakdown
├── convex/                 # Backend
│   ├── leads.ts
│   ├── enrichment.ts
│   ├── outreachActions.ts
│   ├── lib/matchScore.ts
│   └── lib/scoring.ts
├── scoring/                # Python ETL
├── data/                   # Scored household JSON
├── scripts/                # Import + Orange Slice setup
├── docs/                   # This file + integration guides
└── BRIEF.md                # Product vision
```

---

## Related docs

| Doc | Contents |
|-----|----------|
| [BRIEF.md](../BRIEF.md) | Product vision & scoring rationale |
| [DATA_INTEGRATION.md](./DATA_INTEGRATION.md) | Lead type contract & import |
| [ORANGE_SLICE_INSURANCE.md](./ORANGE_SLICE_INSURANCE.md) | Sheet + webhook setup |
| [scoring/SCORING.md](../scoring/SCORING.md) | Python scoring pipeline |
| [AGENTS.md](../AGENTS.md) | Cursor agent notes |

---

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | Canonical source — insurance app + Python scoring |
| `feature/insurance-app` | Active development (merged into main) |
| `feature/quest-board-ui` | Legacy contractor board |
