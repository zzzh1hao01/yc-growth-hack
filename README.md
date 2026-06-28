# HouseholdIQ — Coverage Board (Insurance)

Cartoony coverage board for insurance agents. SF homeowner leads appear as animated pixel sprites on a Mapbox map — click one to open a side panel with coverage gap signals and persona chat.

## Quick local demo

1. **Get a Mapbox token** (free): [account.mapbox.com](https://account.mapbox.com/)

2. **Configure env:**
   ```bash
   cp .env.local.example .env.local
   ```
   Set `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, and `NEXT_PUBLIC_CONVEX_URL`.

3. **Install and run (two terminals):**
   ```bash
   npm install
   npm run convex:dev   # terminal 1
   npm run dev          # terminal 2
   ```

4. **Load insurance data:**
   ```bash
   ./scripts/import-insurance-leads.sh
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Dual deployments

This repo supports **two products** on separate branches and infrastructure:

| Branch | Product | Notes |
|--------|---------|-------|
| `feature/quest-board-ui` | Contractor bounty board | Keep existing Vercel + Convex `watchful-condor-23` live |
| **`feature/insurance-app`** | Insurance coverage board | **This branch** — new Vercel + new Convex deployment |

### New Vercel + Convex setup (insurance)

1. Create a **new Convex project** (e.g. `householdiq-insurance`) — do not reuse `watchful-condor-23`.
2. Push this branch: `git push -u origin feature/insurance-app`
3. [Import to Vercel](https://vercel.com/new) → set **Production Branch** to `feature/insurance-app`
4. Environment variables:
   - `NEXT_PUBLIC_MAPBOX_TOKEN`
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - `CONVEX_DEPLOY_KEY` — from the **new** Convex project
   - Convex dashboard: `OPENAI_API_KEY`, `GOOGLE_MAPS_API_KEY`, etc.
   - Keep Orange Slice / Fiber keys even if unused (outreach deferred)
5. Deploy — `vercel.json` runs `npx convex deploy --cmd 'npm run build'`
6. Load data: `./scripts/import-insurance-leads.sh` (against the new Convex deployment)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run convex:dev` | Convex dev sync |
| `./scripts/import-insurance-leads.sh` | Import ACS-enriched insurance leads from `origin/insurance` (default: `household_records_acs.json`, 2k) |
| `INSURANCE_DATA_SCOPE=merged ./scripts/import-insurance-leads.sh` | Merge all household JSON files, deduped (~5.5k) |

## Product brief

See [BRIEF.md](./BRIEF.md) and [INSURANCE_BUILD.md](./INSURANCE_BUILD.md).

## Real data (for agents)

1. Read `docs/DATA_INTEGRATION.md`
2. ETL lives on `origin/insurance` — `household_records.json`
3. Import via `scripts/import-insurance-leads.sh`
4. UI reads `useQuery(api.leads.listLeads)` in `QuestBoard.tsx`
