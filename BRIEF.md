# HouseholdIQ — Insurance Product Brief

## Overview

HouseholdIQ is a gamified lead qualification tool for **insurance agents and advisors** in San Francisco. It combines SF Assessor parcel data with a replacement-cost gap model to identify owner-occupied households likely underinsured, then surfaces them as interactive personas on a cartoony map. Agents discover high-need leads, understand each household before outreach, and qualify via AI persona chat — all from one interface.

The core metaphor is a **coverage board**: a living map where every house with a plausible coverage gap is represented by a sprite, ranked by **need score + timing score**, and available to click into.

---

## Target User

**Independent insurance agents / advisors** operating in San Francisco — specifically those selling home (Coverage A) policies to owner-occupied single-family residences.

These agents currently rely on referrals, renewals, and generic lead lists. HouseholdIQ gives them a data-backed lead list with underinsurance context they don't currently have at the parcel level.

---

## Core Value Proposition

> Know which homeowners likely need a coverage review, and know how they'll respond before you call.

1. **Ranked warm leads** — addresses scored by replacement-cost gap (need) and renewal/timing signals
2. **Household personas** — AI-generated profiles based on gap severity, tenure, and timing confidence
3. **Direct outbound** — deferred (Orange Slice integration preserved but hidden in UI)

---

## Data Sources & Pipeline

| Dataset | Source | Key Signals |
|---|---|---|
| Assessor secured roll | [SF Open Data](https://data.sfgov.org/) `wv5m-vpq2` | Owner-occupied, sqft, year built, sale date, lat/lng |
| Replacement-cost model | `explore/insurance.py` | Rebuild cost vs coverage anchor, gap $ and % |
| Timing layer | Assessor sale date + heuristics | Renewal proximity, recent buyer, tenure |

See `INSURANCE_BUILD.md` on branch `feature/insurance-app` for scoring rationale.

---

## Lead Scoring Algorithm

Leads are pre-scored in ETL (`origin/insurance` branch → `household_records.json`):

**composite = need × 0.70 + timing × 0.30**

| Signal | Weight (need) | Notes |
|---|---|---|
| Replacement-cost gap | 1.00 | Primary need signal |
| Permit / flood / home-age | 0.00 | Reserved for future ETL |

| Signal | Weight (timing) | Notes |
|---|---|---|
| Renewal proximity | 0.20 | Peaks ~45d before sale-date anniversary |
| Recent buyer | 0.50 | Purchased within 1 year |
| Ownership tenure | 0.30 | Peaks 7–15 years |

**Proximity to agent office is NOT a ranking factor** — only used for map centering and optional display.

### Match Score → Sprite Color

- **Green**: composite ≥ 70 (high need + timing)
- **Yellow**: 40–69
- **Red**: < 40
- **! badge**: `worth_outreach` flag from ETL

---

## Geography

Five insurance-optimized neighborhoods (2025 roll, SFR + owner-occupied):

- Portola
- Outer Richmond
- West of Twin Peaks
- Sunset/Parkside
- Inner Sunset

~2,000 top-scored records in `household_records.json` on the `insurance` branch.

---

## Technical Architecture

```
SF Assessor (DataSF SODA)
        │
 explore/insurance.py  (offline ETL)
        │
 household_records.json
        │
 scripts/import-insurance-leads.sh
        │
 Convex DB (insurance deployment)
        │
 Next.js UI (feature/insurance-app)
        │
 OpenAI GPT (persona chat)
```

---

## Deployments

| Branch | Product | Convex | Vercel |
|---|---|---|---|
| `feature/quest-board-ui` | Contractor demo (legacy) | `watchful-condor-23` | Existing project |
| `feature/insurance-app` | Insurance product | **New deployment** | **New project** |

See [README.md](./README.md) for setup steps.
