# Convex backend

The bounty board demo uses **static mocks** in `src/data/placeholderLeads.ts`.

## Agent entry points (real data)

| Action | File | Function |
|--------|------|----------|
| Define schema | `schema.ts` | `leads` table |
| List for UI | `leads.ts` | `listLeads` query |
| Insert one | `leads.ts` | `upsertLead` mutation |
| Bulk ETL load | `leads.ts` | `bulkUpsertLeads` mutation |
| Full reload | `leads.ts` | `clearAllLeads` then `bulkUpsertLeads` |

Example payload shape: `convex/seed.example.json`

Full integration guide: **[docs/DATA_INTEGRATION.md](../docs/DATA_INTEGRATION.md)**

## Setup (when wiring UI)

```bash
npx convex dev
```

Set `NEXT_PUBLIC_CONVEX_URL` in `.env.local`, add `ConvexProvider` to layout, swap mock data in `QuestBoard.tsx` for `useQuery(api.leads.listLeads)`.
