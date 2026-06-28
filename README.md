# HouseholdIQ — Bounty Board Demo

Cartoony quest board for home service contractors. Placeholder SF leads appear as animated pixel sprites on a Mapbox map — click one to open a property side panel.

## Quick local demo (~2 minutes)

1. **Get a Mapbox token** (free): [account.mapbox.com](https://account.mapbox.com/)

2. **Configure env:**
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` and set `NEXT_PUBLIC_MAPBOX_TOKEN` to your public token (`pk...`).

3. **Install and run:**
   ```bash
   npm install
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) — pan/zoom the map, click sprites, open the side panel.

No Convex account needed for this demo.

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
