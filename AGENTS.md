<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# HouseholdIQ — Agent Notes

## Data integration (read first for backend/ETL work)

**[docs/DATA_INTEGRATION.md](docs/DATA_INTEGRATION.md)** — full guide for inserting real lead data.

Quick reference:

| Task | Where |
|------|-------|
| Type contract | `src/types/lead.ts` |
| Demo mocks | `src/data/placeholderLeads.ts` |
| Convex schema | `convex/schema.ts` |
| Ingest mutations | `convex/leads.ts` → `upsertLead`, `bulkUpsertLeads` |
| Example ETL row | `convex/seed.example.json` |
| Wire UI to backend | `QuestBoard.tsx` → `useQuery(api.leads.listLeads)` |

Every lead **must** have geocoded `lat`/`lng` tied to a real `address` — not neighborhood centroids.

## UI demo

Map uses Mapbox `streets-v12` + pastel cartoon overrides (`src/lib/map-cartoon-style.ts`).
Sprites are CSS overlays — see `src/components/quest-board/LeadSprite.tsx`.
