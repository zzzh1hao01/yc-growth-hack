# BountyHunters — 3-Minute Demo Script

**Target:** ~3 minutes spoken  
**Live app:** [householdiq-insurance.vercel.app](https://householdiq-insurance.vercel.app/)  
**Tip:** One sentence per line — read straight down.

---

## 1. The Problem (~0:45)

**[SHOW: blank screen, or a spreadsheet / exported property roll]**

If you're a property insurance agent in San Francisco, this is probably your week.

You get broad property lists.

You don't know which homes actually matter.

You open assessor sites.

You check permit portals.

You jump between spreadsheets.

Most of the time — you're searching blind.

- Lists give you volume, not signal.
- CRM exports don't flag coverage gaps.
- Territory planning is still mostly guesswork.

You don't know which properties may be underinsured.

You don't know which public records already show risk.

You don't know where to focus first.

So you waste hours on the wrong addresses.

That's the pain we built HouseholdIQ to fix.

---

## 2. The Product (~0:30)

**[SHOW: open the app — full Coverage Board / pixel map]**

This is **HouseholdIQ**.

We call it a **bounty board for properties**.

- Every little character on the map is a real SF address.
- Scored from public property data.
- Ranked by priority — not random lead order.

**Green** — higher-priority opportunity. Look here first.

**Yellow** — possible opportunity. Worth a review.

**Red** — lower priority for now.

**!** — stronger signal. This property fired something important.

It feels like a game board — but every sprite is real property intelligence.

---

## 3. The Demo (~1:00)

**[SHOW: pan the map — neighborhood signs, sprites, legend]**

Let me show you how it works.

**[SHOW: click a green sprite with a ! badge]**

I click a property.

Side panel opens.

- Address up top.
- Priority score — say **85 out of 100**.
- Short list of **risk signals** — why it ranked high.

**[SHOW: scroll to Coverage Signals]**

Coverage signals:
- Replacement cost today.
- Likely coverage gap — dollars and percent.
- Square footage and home age.
- Owner-occupied status.
- Tenure and timing confidence.

**[SHOW: scroll to permit / property fields if visible]**

Permit history where we have it.

Public record context — not a guess.

**[SHOW: AI property context / Persona Chat — type one question if live, or narrate]**

AI-generated **property context** at the bottom.

Not a behavioral homeowner profile.

Not "who lives there."

Ask: *"Why was this property flagged?"*

Or: *"What coverage concern should I lead with?"*

The AI summarizes the signals.

It helps you understand the property — before you reach out.

---

## 4. The Data & AI (~0:25)

**[SHOW: stay on side panel or cut back to map]**

Under the hood, it's structured.

- **SF Open Data** — assessor records, building permits.
- **Python scoring pipeline** — cleans messy records, builds risk signals.
- **OpenAI** — turns scores and fields into agent-readable context.

We combine replacement-cost estimates with timing and property signals.

The agent gets intelligence *before* cold outreach.

Not a phone number from a form.

Actual reasons this property surfaced.

---

## 5. Real-Time Backend (~0:15)

**[SHOW: map view — optional quick flash of Convex dashboard]**

Everything stays in sync through **Convex**.

- Properties load live on the map.
- Chat history persists per property.
- New scored data can appear without a refresh.

No manual exports.

No stale spreadsheets.

Thousands of addresses — one visual board.

---

## 6. Outreach (~0:05)

**[SHOW: "Reach out" button at bottom of panel]**

Once you've reviewed a property, one click starts outreach.

Contact enrichment can flow through our pipeline — so you're not starting from zero.

---

## 7. Close (~0:15)

**[SHOW: wide map shot — pan across sprites]**

Most tools give agents lists.

HouseholdIQ gives you a map.

**Know which properties to prioritize.**

**And know why — before you call.**

HouseholdIQ helps insurance professionals move from broad searching to data-driven property discovery.

Thank you.

---

## Quick Reference — What to Show When

| Moment | [SHOW] |
|--------|--------|
| Hook | Spreadsheet / property roll / scattered data tabs |
| Reveal | Full Coverage Board + legend |
| Demo | Click green + ! sprite → side panel → scroll |
| AI | One chat question about why property was flagged |
| Close | Wide map, multiple sprites |

## Pre-Record Checklist

- [ ] App loads at [householdiq-insurance.vercel.app](https://householdiq-insurance.vercel.app/)
- [ ] Complete **agent** setup if prompted (name + SF office address)
- [ ] Pick a green + ! sprite (Mission, Sunset, or Richmond work well)
- [ ] Browser zoom 100%, hide bookmarks bar
- [ ] Confirm panel shows address, priority score, coverage gap, AI context
- [ ] Test Escape closes the side panel
