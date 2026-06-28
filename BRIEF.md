# HouseholdIQ — Product Brief (Insurance)

## Overview

HouseholdIQ is a lead intelligence tool for homeowners insurance agents in San Francisco. It combines public assessor data and Census demographics to identify homeowners who are likely carrying significantly less coverage than their home would cost to rebuild — and ranks them by how urgently and receptively they will respond to an insurance review conversation.

The core insight: California Prop 13 caps assessed value growth at 2%/yr, but construction costs rise ~5%/yr and carriers typically nudge coverage only ~3.5%/yr. A homeowner who bought in the 1980s or 1990s and has never reviewed their policy can easily be $200–400k underinsured without knowing it. That gap is computable entirely from public data.

---

## Target User

**Independent homeowners insurance agents** operating in San Francisco — specifically those looking to grow their book of business through proactive outreach rather than waiting for inbound referrals or renewal-season shopping.

These agents currently rely on purchased lead lists (often stale, untargeted) or word of mouth. HouseholdIQ gives them a data-backed, geographically scoped list of homeowners with a quantified coverage gap and a behavioural profile that tells them how to open the conversation.

---

## Core Value Proposition

> Know which doors to knock on, what the gap is in dollars, and how to frame the conversation before you dial.

1. **Ranked leads with quantified gaps** — addresses filtered to SFR owner-occupied parcels and scored by estimated coverage shortfall, timing signals (recent purchase, renewal proximity, long tenure), and Census-derived receptivity
2. **Behavioural archetypes** — each lead is assigned to one of five archetypes (`wealthy_inert`, `active_optimizer`, `new_to_wealth`, `disengaged_owner`, `price_first_shopper`) based on block-group Census demographics, determining the conversation framing
3. **Direct outbound** — one-click access to contact enrichment for leads that clear the outreach threshold

---

## Data Sources & Pipeline

### Address-Level (parcel precision)

| Dataset | Source | Key Signals |
|---|---|---|
| Assessor secured roll | SF Assessor via DataSF (`wv5m-vpq2`) | Year built, sqft, owner-occupied flag, last sale date, assessed values |
| Building / electrical / plumbing permits | SF Open Data | Used in the original pipeline; not the primary insurance signal |

### Block-Group Level (Census)

| Dataset | Source | Key Signals |
|---|---|---|
| ACS 5-year estimates | Census Bureau (`api.census.gov`) | Income, education, age, housing tenure, mortgage status, home value, occupation |

---

## Lead Scoring

### Primary Signal — Replacement-Cost Gap

Coverage A (dwelling coverage) is set approximately equal to replacement cost at purchase and nudged by the carrier ~3.5%/yr. True rebuild cost rises ~5%/yr (construction inflation). The gap compounds with years held:

```
gap_pct = 1 − (carrier_inflation / construction_inflation) ^ years_owned
```

A homeowner who bought in 1990 and hasn't reviewed coverage is likely 30–40% underinsured in dollar terms. On a $900k home, that is a $270–360k uninsured exposure.

### Secondary Signal — Timing

- **Renewal proximity**: peaks ~45 days before the sale-date anniversary (when the policy typically renews)
- **Recent purchase trigger**: new buyers are setting coverage for the first time — high receptivity
- **Long tenure**: 7–15 year tenure is the underinsurance sweet spot; extreme long-tenure (20+ years) also high

### ACS Behavioural Layer

Three normalized dimensions computed at block-group level:

| Dimension | What it predicts |
|---|---|
| Financial sophistication (education + occupation + income) | Active coverage reviewer vs. set-and-forget auto-renewer |
| Inertia (age + tenure + free-and-clear rate) | Underinsurance accumulation probability |
| Coverage stakes (home value + ownership rate) | Dollar magnitude of the problem if underinsured |

### Composite Score

```
composite = need × 0.45 + timing × 0.30 + acs_receptivity × 0.25
```

`worth_outreach` (composite ≥ 0.70): ~8% of SFR owner-occupied parcels — roughly 1,600 high-priority leads across the 5 target neighborhoods.

---

## Behavioural Archetypes

| Archetype | Profile | Agent opening |
|---|---|---|
| `wealthy_inert` | Long-tenure, high-value home, hasn't reviewed coverage in years | Lead with the dollar gap: "Your home has doubled in value; your coverage probably hasn't." |
| `active_optimizer` | Financially engaged, likely shops at renewal | Data-first: specific gap numbers, competitive framing |
| `new_to_wealth` | Recent purchase or income rise, first policy review | Educational: what replacement cost means and why it diverges |
| `disengaged_owner` | Minimal financial engagement, may hold bare minimum | Simple and concrete: focus on what's at risk, not coverage mechanics |
| `price_first_shopper` | Rate-sensitive, comparison shopper | Lead with premium comparison; coverage conversation second |

---

## Target Neighborhoods

Five SF neighborhoods selected by average replacement-cost gap (SFR owner-occupied, assessor 2025 roll):

1. **Portola** — highest avg gap
2. **Outer Richmond**
3. **West of Twin Peaks**
4. **Sunset/Parkside**
5. **Inner Sunset**

~1,989 SFR owner-occupied parcels across these neighborhoods. ~8% (~160 leads) clear the `worth_outreach` threshold.

---

## Technical Architecture

```
SF Assessor (DataSF SODA)     Census ACS (api.census.gov)
          │                              │
          └──────────────────────────────┘
                          │
                   explore/insurance.py
                   explore/acs.py
                   (Python, run offline)
                          │
              data/household_records_acs.json
              (2,000 scored leads, JSON)
                          │
              ┌───────────┴───────────┐
              │                       │
         Frontend UI           Contact enrichment
      (map + lead panel)      (Orange Slice or similar)
```

---

## Tech Stack

| Layer | Tool |
|---|---|
| ETL / scoring | Python (`explore/insurance.py`, `explore/acs.py`) |
| Data sources | SF DataSF SODA API, Census ACS API, Census Geocoder API |
| Output | JSON (`data/household_records_acs.json`) |
| Frontend | TBD (Next.js + Mapbox recommended) |
| Backend / DB | TBD (Convex recommended for real-time lead state) |
| Contact enrichment | Orange Slice or equivalent residential enrichment provider |

---

## Open Questions

- Does Orange Slice's enrichment work on residential addresses, or is it B2B-only?
- What is the right UI metaphor for surfacing the coverage gap to an agent quickly?
- Should the archetype conversation guide be surfaced as a static tooltip or a live chat interface?
