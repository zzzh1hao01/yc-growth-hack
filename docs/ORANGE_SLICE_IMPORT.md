# Orange Slice import setup (API + Webhook)

**Full sheet template (columns + enrichment + Gmail):** [ORANGE_SLICE_SHEET_TEMPLATE.md](./ORANGE_SLICE_SHEET_TEMPLATE.md)  
**Copy-paste chat prompt:** [ORANGE_SLICE_CHAT_PROMPT.txt](./ORANGE_SLICE_CHAT_PROMPT.txt)

Orange Slice only offers **Import from API** and **Import from webhook** for ingest — not custom action columns for import.

---

## Option A — Import from API (recommended to start)

Use this after clicking **Pursue** in HouseholdIQ (leads queue in Convex until imported).

| Field | Value |
|-------|-------|
| **URL** | `https://watchful-condor-23.convex.site/orangeslice/import?limit=25` |
| **Method** | GET |
| **Header** | `Authorization: Bearer YOUR_OUTREACH_WEBHOOK_SECRET` |
| **Rows JSON path** | `data` |

Get `OUTREACH_WEBHOOK_SECRET` from [Convex dashboard](https://dashboard.convex.dev) → Settings → Environment Variables.

Each import fetch returns flat rows and marks them synced (won't duplicate on next import).

**Test in terminal:**
```bash
curl -s "https://watchful-condor-23.convex.site/orangeslice/import?limit=5" \
  -H "Authorization: Bearer YOUR_SECRET"
```

Example response: [orangeslice-import-example.json](./orangeslice-import-example.json)

---

## Option B — Import from webhook (automatic push)

1. In Orange Slice → **Import from webhook** → copy the webhook URL they give you.
2. Set it in Convex env:
   ```bash
   npx convex env set ORANGE_SLICE_SHEET_WEBHOOK_URL "https://...."
   ```
3. Click **Pursue** in HouseholdIQ — rows POST to Orange Slice automatically. No manual import step.

---

## Column names (map 1:1 from API)

`household_id`, `convex_lead_id`, `session_id`, `address`, `city`, `state`, `owner_name`, `owner_first_name`, `owner_last_name`, `match_score`, `vertical`, `vertical_hook`, `persona_hook`, `contractor_name`, `contractor_business`, `email`, `phone`, `linkedin_url`, `playbook`, `channels`, `touch1_subject`, `touch1_body`, `touch2_subject`, `touch2_body`, `parcel_number`, `recorded_owner_source`, `status`, `campaign_slug`

After import, run enrichment columns (**Find contact**, **Find LinkedIn**) then **Send touch 1** — see chat prompt.

---

## Status sync back to HouseholdIQ

When Gmail columns run, POST:

- **URL:** `https://watchful-condor-23.convex.site/orangeslice/status`
- **Header:** same `Authorization: Bearer ...`
- **Body:** `{ "household_id": "7279-45", "status": "touch1_sent", "event": "gmail_touch1" }`

Valid statuses: `sheet_synced`, `touch1_sent`, `touch2_sent`, `replied`, `meeting`, `won`, `lost`, `d2d_planned`
