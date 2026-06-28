# HouseholdIQ — Bounty Board Demo

Cartoony quest board for home service contractors. Placeholder SF leads appear as animated pixel sprites on a Mapbox map — click one to open a property side panel.

## Quick local demo (~2 minutes)

1. **Get a Mapbox token** (free): [account.mapbox.com](https://account.mapbox.com/)

2. **Configure env:**
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` and set:
   - `NEXT_PUBLIC_MAPBOX_TOKEN` (your `pk...` token)
   - `NEXT_PUBLIC_CONVEX_URL` (from [Convex dashboard](https://dashboard.convex.dev/t/saahith-veeramaneni/householdiq) or `npx convex dev --once`)

3. **Install and run (two terminals):**
   ```bash
   npm install
   npm run convex:dev   # terminal 1 — sync backend
   npm run dev          # terminal 2 — Next.js UI
   ```

4. Open [http://localhost:3000](http://localhost:3000) — pan/zoom the map, click sprites, open the side panel.

When Convex has no leads yet, the UI falls back to placeholder sprites automatically.

## Convex (connected)

| Resource | URL |
|----------|-----|
| Project | [householdiq](https://dashboard.convex.dev/t/saahith-veeramaneni/householdiq) |
| Dev deployment | [watchful-condor-23](https://dashboard.convex.dev/d/watchful-condor-23) |
| Client URL | `https://watchful-condor-23.convex.cloud` |

Backend functions: `listLeads`, `upsertLead`, `bulkUpsertLeads` — see [docs/DATA_INTEGRATION.md](docs/DATA_INTEGRATION.md).

## Public hosting (Vercel)

1. Push branch `feature/quest-board-ui` to GitHub.
2. [Import to Vercel](https://vercel.com/new) → select the repo.
3. Set environment variables:
   - `NEXT_PUBLIC_MAPBOX_TOKEN`
   - `CONVEX_DEPLOY_KEY` — production/preview deploy key from Convex dashboard
4. Vercel runs `npx convex deploy --cmd 'npm run build'` via [`vercel.json`](vercel.json).

After deploy, Vercel sets `NEXT_PUBLIC_CONVEX_URL` automatically during the Convex deploy step.

## Production preview

```bash
npm run build
npm start
```

## What's included

- **Map** — Mapbox `streets-v12` with pastel cartoon styling (soft greens, warm land, storybook fog)
- **Sprites** — smaller pixel characters; hot leads (70+) wave + bob; urgent leads show a pulsing `!`
- **Side panel** — match score bar, property fields (placeholder labels where ETL data is missing)
- **Convex backend stub** — schema + ingest mutations ready; see **[docs/DATA_INTEGRATION.md](docs/DATA_INTEGRATION.md)**

## Real data (for agents)

Demo uses static mocks. To load real geocoded addresses:

1. Read `docs/DATA_INTEGRATION.md`
2. Run ETL → JSON with required fields (`lat`, `lng`, `address`, `matchScore`, etc.)
3. Call `bulkUpsertLeads` in `convex/leads.ts`
4. Wire `QuestBoard.tsx` to `useQuery(api.leads.listLeads)`

Example payload: `convex/seed.example.json`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server (primary demo command) |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run convex:dev` | Start Convex dev (optional, not needed for demo) |

## Product brief

See [BRIEF.md](./BRIEF.md) for full product context, data sources, and roadmap.
