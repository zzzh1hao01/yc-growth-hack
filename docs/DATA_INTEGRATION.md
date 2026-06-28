# Data Integration Guide (Insurance)

This document describes **what data the coverage board needs**, where to put it, and how to wire it into the UI.

## Current state

| Layer | Status | Location |
|-------|--------|----------|
| UI map + sprites | **Live** | [`QuestBoard.tsx`](../src/components/quest-board/QuestBoard.tsx) → `useQuery(api.leads.listLeads)` |
| Type contract | **Defined** | [`src/types/lead.ts`](../src/types/lead.ts) |
| Convex schema | **Insurance fields** | [`convex/schema.ts`](../convex/schema.ts) |
| Ingest | **Ready** | [`convex/leads.ts`](../convex/leads.ts) → `bulkUpsertHouseholds` |
| ETL source | **`origin/insurance`** | `household_records.json` (2,000 records) |

---

## Import insurance data

From repo root, with Convex linked to your **insurance** deployment:

```bash
./scripts/import-insurance-leads.sh
```

This fetches `origin/insurance:household_records.json`, transforms to JSONL, and runs `npx convex import --table leads --replace`.

To regenerate ETL data from scratch (Python, offline):

```bash
pip install -r requirements.txt   # on insurance branch ETL files
python -m explore.insurance --full --cap 2000 --out household_records.json
```

See [INSURANCE_BUILD.md](../INSURANCE_BUILD.md) for scoring parameters.

---

## Required fields (Convex `leads` table)

| Field | Type | Source |
|-------|------|--------|
| `householdId` | string | ETL `household_id` (block-lot) |
| `address` | string | Assessor |
| `lat`, `lng` | number | Assessor geometry |
| `neighborhood` | string | Assessor |
| `sqft` | number | Assessor `property_area` |
| `ownerOccupied` | boolean | Homeowner exemption |
| `replacementCostToday` | number | ETL |
| `coverageAnchor` | number | ETL |
| `replacementCostGapDollars` | number | ETL |
| `replacementCostGapPct` | number | ETL (0–1) |
| `needScore` | number | ETL (0–1) |
| `timingScore` | number | ETL (0–1) |
| `timingConfidence` | `"high"` \| `"low"` \| `"none"` | ETL |
| `compositeScore` | number | ETL (0–1) |
| `worthOutreach` | boolean | ETL |
| `spriteVariant` | 0–3 | Assign at import (`i % 4`) |

Optional: `yearBuilt`, `purchaseYear`, `yearsOwned`, owner enrichment fields.

Every lead **must** have geocoded `lat`/`lng` tied to a real address — not neighborhood centroids.

---

## Ranking (runtime)

[`listLeads`](../convex/leads.ts) sorts by:

1. `compositeScore` descending
2. `needScore` descending
3. `timingScore` descending

Returns up to **100** pins per session (balanced hot/warm/cold sample). Proximity is **not** used for ranking.

---

## Files to touch (checklist)

| Task | File |
|------|------|
| Schema | `convex/schema.ts` |
| Ingest mutation | `convex/leads.ts` |
| Import script | `scripts/import-insurance-leads.sh` |
| UI types | `src/types/lead.ts` |
| Side panel | `src/components/quest-board/LeadSidePanel.tsx` |
| ETL | `explore/insurance.py` (from `origin/insurance`) |
