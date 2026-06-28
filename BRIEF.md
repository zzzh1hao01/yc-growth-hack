# HouseholdIQ — Product Brief

## Overview

HouseholdIQ is a gamified lead qualification tool for individual home service contractors in San Francisco. It combines open permit data, parcel records, Census demographics, and behavioral survey data to build statistically-grounded household profiles, then surfaces them as interactive personas on a cartoony map of SF. Contractors discover warm leads, understand each household before knocking, and initiate outbound contact — all from one interface.

The core metaphor is a **bounty board**: a living map where every house with a plausible service need is represented by a sprite, ranked by match quality, and available to click into.

---

## Target User

**Individual home service contractors** operating in San Francisco — specifically:
- HVAC technicians / companies
- Electrical contractors (panel upgrades, EV charger installs)

These contractors currently rely on D2D canvassing, word of mouth, and generic lead gen platforms (Yelp, Angi). HouseholdIQ gives them a data-backed, geographically scoped lead list with homeowner context they don't currently have access to.

---

## Core Value Proposition

> Know which doors to knock on, and know who answers before you knock.

1. **Ranked warm leads** — addresses filtered and scored by service relevance, permit age, homeowner profile, and proximity to the contractor's location
2. **Household personas** — AI-generated profiles of each household based on demographic cluster and behavioral data, surfaced as a chat interface
3. **Direct outbound** — one-click access to contact info and outreach tooling via Orange Slice

---

## Data Sources & Pipeline

### Address-Level (precise)
| Dataset | Source | Key Signals |
|---|---|---|
| Building permits | [SF Open Data](https://data.sfgov.org/browse?category=Housing+and+Buildings) | Permit type, date pulled, date finaled, system age |
| Parcel / Assessor data | SF Assessor's Office (public) | Owner-occupied flag, assessed value, last sale date, home age |

### Block-Group Level (Census)
| Dataset | Source | Key Signals |
|---|---|---|
| ACS (American Community Survey) | Census Bureau | Income, household composition, education, ownership rate |

### Behavioral Survey Distributions (aggregate → cluster assignment)
| Dataset | Key Variables Used |
|---|---|
| American Housing Survey (AHS) | How homeowners found last contractor; reasons for delaying repairs; DIY vs hire-out rate by income + home age |
| Consumer Expenditure Survey (CEX) | $ spent on home maintenance by income bracket; discretionary vs emergency spend patterns |
| General Social Survey (GSS) | Trust in service providers by education; risk tolerance; community embeddedness (referral behavior) |
| Pew Research | Channel preference by age/income (Yelp vs Nextdoor vs Google vs word of mouth) |

### Enrichment (via Orange Slice)
- Homeowner contact info (phone, email where available)
- Additional signals via Orange Slice's 100+ enrichment sources
- Push to outreach tooling (Gmail, HeyReach, etc.) for outbound

---

## Lead Scoring Algorithm

Leads are scored at the **address/parcel level** using a rule-based weighted system. No satellite data is used.

### Scoring Signals

| Signal | Source | Weight |
|---|---|---|
| Age of last HVAC or electrical permit | SF permit data | High |
| No relevant permit in 15+ years | SF permit data | High |
| Owner-occupied (not renter) | Assessor / Census | High |
| Household income bracket (proxy: assessed value + Census) | Assessor + ACS | Medium |
| Behavioral cluster (likelihood to hire out vs DIY) | AHS/CEX cluster | Medium |
| Home age (older home = more likely to need work) | Assessor | Medium |
| Proximity to contractor's business location | Google Maps API | Medium |
| Open/unfinalized permits (exclude — active construction) | SF permit data | Exclusion |

### Proximity Ranking
The contractor provides their business address at onboarding via Google Maps API autocomplete. Proximity to that location is factored into the composite lead score — closer addresses rank higher, all else equal. This supports efficient canvassing routes.

### Match Score → Sprite Color
- **Green sprite**: high match score (strong need signal + behavioral fit + close proximity)
- **Red sprite**: low match score (weak signals or poor fit with contractor's stated services)
- **Exclamation mark overlay**: urgency flag — permit age exceeds replacement threshold for the vertical (e.g. HVAC permit 15+ years old)

---

## Persona Generation

### Step 1 — Demographic Clustering
Each address is assigned to a demographic cluster based on:
- Census block-group income bracket
- Home ownership status
- Home age cohort
- Behavioral traits from AHS/CEX/GSS/Pew distributions for that demographic segment

Target: **4–6 clusters** (e.g. long-time high-income owner, long-time budget-conscious owner, recent buyer, older retired homeowner, etc.)

### Step 2 — LLM Persona Narration (GPT API)
Each cluster maps to a persona template. When a contractor opens a household profile, the system passes:
- The address's permit history and assessor data
- The assigned cluster's behavioral trait distributions
- The contractor's service profile (extracted from their onboarding text)

GPT generates a natural-language persona: how this household is likely to respond to a cold approach, what their objections might be, how they prefer to find contractors, and what would convert them.

### Persona Chat
The contractor can chat directly with the AI persona as if speaking to the homeowner. This is not a pitch training tool — it is a **qualification interface** to help the contractor understand the household before initiating real outreach. The persona responds in character based on the cluster traits and property data.

---

## Product UX Flow

### Contractor Onboarding
1. Contractor lands on the website — no account required for MVP
2. Types a free-text description of their business (e.g. "I do HVAC installation and repair in the Mission, mostly residential, older homes")
3. Enters their business address via Google Maps API autocomplete
4. System extracts service type, price-point positioning, and customer preferences from the text via GPT structured extraction
5. Map loads

### Main Interface — The Bounty Board
- Cartoony stylized map of SF, zoomed to relevant neighborhoods
- Pixel-art sprite characters appear at address locations, scaled to available lead density
- Sprite color = match score (green → red)
- Exclamation mark badge = urgency flag
- Sprites vary by a small set of AI-generated variants (not demographic — purely visual diversity)

### Lead Interaction
1. Contractor clicks a sprite
2. Side panel opens: property summary (permit age, home age, assessed value, behavioral cluster summary)
3. Chat window opens below — contractor types to the AI persona of the household
4. Contractor decides: pursue or skip
5. If pursuing: clicks **"Get contact info"** → Orange Slice enriches the address with phone/email
6. Optional: push to outreach sequence via Orange Slice integrations (Gmail, HeyReach)

---

## Technical Architecture

```
SF Open Data API          Census API           Assessor Data (bulk)
       │                      │                        │
       └──────────────────────┴────────────────────────┘
                              │
                         ETL Pipeline
                    (Python scripts, run offline)
                              │
                    ┌─────────▼──────────┐
                    │  Lead Scoring &    │
                    │  Cluster Assignment│
                    └─────────┬──────────┘
                              │
                         Convex DB
                    (lead scores, personas,
                     chat history, sessions)
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         Next.js UI      GPT API         Orange Slice
      (map + sprites    (persona chat    (contact enrichment
       + chat panel)     narration)       + outbound)
              │
         Google Maps API
         (contractor location
          + proximity scoring)
```

---

## Tech Stack

| Layer | Tool | Rationale |
|---|---|---|
| Frontend | Next.js | TypeScript-first, clean Convex integration via React hooks |
| Map rendering | Mapbox GL JS (custom cartoon style) | Address-level pin placement, custom sprite overlays |
| Sprite rendering | CSS-positioned divs over Mapbox canvas | Hackathon-feasible, no game engine needed |
| Backend / DB | Convex | Real-time reactive queries, serverless functions, stores leads + personas + chat history |
| LLM (persona chat) | OpenAI GPT API (subsidized) | Persona narration + structured extraction of contractor profile |
| Lead enrichment | Orange Slice | Contact info lookup + outbound integration |
| Contractor location | Google Maps API (Places autocomplete) | Business address input + proximity calculation |
| ETL | Python (pandas) | Offline data processing before deployment |
| Behavioral data | AHS, CEX, GSS, Pew (static, pre-processed) | Cluster assignment offline, stored as lookup table in Convex |

---

## Neighborhoods & Data Scope

- **Geography**: San Francisco only
- **Neighborhoods**: TBD based on data availability and permit coverage density — to be determined after initial data analysis of the SF Open Data permit dataset
- **Verticals in scope**: HVAC, electrical (panel upgrades, EV charger installs)
- **Verticals explicitly out of scope**: Roofing, solar (require satellite/imagery data)

### Data Analysis Required Before Build
Before finalizing neighborhoods, the team must:
1. Pull and inspect SF permit data for HVAC and electrical permit coverage by neighborhood
2. Cross-reference with Assessor parcel data to assess join quality (address normalization)
3. Identify 3–5 neighborhoods with sufficient permit density for a meaningful lead map

---

## Sponsor Tool Integration

| Tool | Used? | How |
|---|---|---|
| Convex | Yes | Primary backend — stores all lead data, personas, sessions |
| Orange Slice | Yes | Contact enrichment + outbound tooling post-qualification |
| Lopus AI | Maybe | Lopus Beacon for social buying intent signals if SF coverage is sufficient |
| Fiber AI | Probably not | SF Open Data + Assessor + Census covers the data layer sufficiently |

---

## Open Questions

- Which 3–5 SF neighborhoods have the best permit data coverage? *(requires data analysis)*
- What is the permit taxonomy in the SF dataset for HVAC vs electrical? *(requires data inspection)*
- Does Orange Slice's enrichment work on residential addresses, or is it B2B-only? *(requires API check)*
- Does Lopus Beacon have meaningful SF social signal coverage for home repair intent? *(requires trial)*
- What AI-generated sprite variants will be used, and in what style? *(requires asset generation)*
