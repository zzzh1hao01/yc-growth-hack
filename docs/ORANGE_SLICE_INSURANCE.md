# Orange Slice — Insurance outbound setup

Insurance deployment Convex site: `https://compassionate-ptarmigan-622.convex.site`

**Chat prompt:** [ORANGE_SLICE_INSURANCE_CHAT_PROMPT.txt](./ORANGE_SLICE_INSURANCE_CHAT_PROMPT.txt)

---

## Quick start

### 1. Create a new Orange Slice spreadsheet

Create a fresh spreadsheet for insurance (do not reuse the contractor demo sheet).

### 2. Paste the insurance chat prompt

Open Orange Slice → chat → paste [ORANGE_SLICE_INSURANCE_CHAT_PROMPT.txt](./ORANGE_SLICE_INSURANCE_CHAT_PROMPT.txt).

Replace `YOUR_OUTREACH_WEBHOOK_SECRET` with the value from Convex dashboard → Environment Variables.

### 3. Configure Convex (global or per-org)

**Option A — Convex env (single org demo):**

```bash
NEXT_PUBLIC_CONVEX_SITE_URL=https://compassionate-ptarmigan-622.convex.site \
  ./scripts/configure-orangeslice-sheet.sh "https://www.orangeslice.ai/spreadsheets/YOUR_INSURANCE_SHEET_ID/edit"
```

Then register the Import-from-webhook URL:

```bash
NEXT_PUBLIC_CONVEX_SITE_URL=https://compassionate-ptarmigan-622.convex.site \
  ./scripts/configure-orangeslice-autopush.sh "https://YOUR_ORANGE_SLICE_WEBHOOK_URL"
```

**Option B — Per-org in app (multi-tenant):**

After signing in, go to **Settings** → paste Orange Slice sheet URL + import webhook URL.

### 4. Pursue a lead

1. Open the coverage board → click a household → **Pursue lead**
2. Row auto-pushes to Orange Slice (if webhook configured)
3. Run **Find contact** → **Send touch 1** in the sheet
4. Status syncs back to HouseholdIQ **Pipeline**

---

## Endpoints (insurance deployment)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/orangeslice/import?limit=25` | GET | Pull queued leads (fallback) |
| `/orangeslice/status` | POST | Sheet status sync |
| `/orangeslice/configure-webhook` | POST | Register webhook URL |

Header: `Authorization: Bearer <OUTREACH_WEBHOOK_SECRET>`

Test import:

```bash
curl -s "https://compassionate-ptarmigan-622.convex.site/orangeslice/import?limit=5" \
  -H "Authorization: Bearer YOUR_SECRET"
```

Example row: [orangeslice-import-example.json](./orangeslice-import-example.json)

---

## Insurance column mapping

| Column | Source |
|--------|--------|
| `household_id` | Assessor block-lot |
| `agent_name`, `agency_name` | Onboarded insurance agent |
| `gap_dollars`, `gap_pct`, `need_score`, `timing_score` | Insurance lead scoring |
| `coverage_hook` | Replacement-cost gap copy |
| `touch1_subject`, `touch1_body` | Pre-written coverage review email |
| `contractor_name`, `contractor_business` | Aliases of agent/agency (compat) |

---

## Status lifecycle

`queued` → `sheet_synced` → `touch1_sent` → `touch2_sent` → `replied` / `meeting` / `won` / `lost`

Gmail OAuth connects **inside Orange Slice** when setting up the Send touch 1 column.
