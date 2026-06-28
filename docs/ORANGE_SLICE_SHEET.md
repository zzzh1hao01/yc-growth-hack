# Orange Slice sheet setup (HouseholdIQ pipeline)

**Start here:** [ORANGE_SLICE_SHEET_TEMPLATE.md](./ORANGE_SLICE_SHEET_TEMPLATE.md) — full Pursue → import → contact → Gmail flow.

**Chat prompt to paste in Orange Slice:** [ORANGE_SLICE_CHAT_PROMPT.txt](./ORANGE_SLICE_CHAT_PROMPT.txt)

**Import API reference:** [ORANGE_SLICE_IMPORT.md](./ORANGE_SLICE_IMPORT.md)

## Convex env

```bash
./scripts/configure-orangeslice-sheet.sh "https://www.orangeslice.ai/spreadsheets/abcba217-93c9-4843-9d66-ee5e7fce40f3/edit"
```

| Variable | Purpose |
|----------|---------|
| `OUTREACH_WEBHOOK_SECRET` | Auth for all `/orangeslice/*` endpoints |
| `ORANGE_SLICE_SHEET_URL` | Link in the bounty board UI |
| `ORANGE_SLICE_SHEET_WEBHOOK_URL` | Optional — auto-push rows on Pursue |

Your sheet: https://www.orangeslice.ai/spreadsheets/abcba217-93c9-4843-9d66-ee5e7fce40f3/edit

## Endpoints

- **Import:** `GET https://watchful-condor-23.convex.site/orangeslice/import?limit=25` (rows path `data`)
- **Status:** `POST https://watchful-condor-23.convex.site/orangeslice/status`

Header: `Authorization: Bearer <OUTREACH_WEBHOOK_SECRET>`
