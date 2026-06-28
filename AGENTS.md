<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# HouseholdIQ — Agent Notes

## Insurance product (`feature/insurance-app`)

**Branch:** `feature/insurance-app` — full-stack insurance app (this is the active product branch).

**Data source:** `origin/insurance` branch — NOT contractor permit data.

| Task | Where |
|------|-------|
| Type contract | `src/types/lead.ts` |
| Demo mocks | `src/data/placeholderLeads.ts` |
| Convex schema | `convex/schema.ts` (insurance fields) |
| Ingest | `convex/leads.ts` → `bulkUpsertHouseholds` |
| Import script | `scripts/import-insurance-leads.sh` |
| ETL reference | `explore/insurance.py`, `INSURANCE_BUILD.md` |
| Wire UI | `QuestBoard.tsx` → `useQuery(api.leads.listLeads)` |

Every lead **must** have geocoded `lat`/`lng` tied to a real `address`.

**Ranking:** need score + timing score (precomputed in ETL). Proximity is display-only.

**Outreach:** Orange Slice backend preserved; UI hidden (`OUTREACH_ENABLED = false` in `src/types/lead.ts`).

## Contractor demo (legacy)

Branch `feature/quest-board-ui` + Convex `watchful-condor-23` — kept live separately. Do not mix data.

## UI demo

Map uses Mapbox `streets-v12` + pastel cartoon overrides (`src/lib/map-cartoon-style.ts`).
Sprites are CSS overlays — see `src/components/quest-board/LeadSprite.tsx`.
