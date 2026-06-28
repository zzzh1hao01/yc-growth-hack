# HouseholdIQ — 3-Minute Demo Script

**Target:** ~3 minutes spoken  
**Live app:** [yc-growth-hack.vercel.app](https://householdiq-insurance.vercel.app/)  
**Tip:** One sentence per line — read straight down.

---

## 1. The Problem (~0:45)

**[SHOW: blank screen, or quick b-roll of door knocking / driving a route]**

If you're a home service contractor in San Francisco, this is probably your week.

You knock doors.

You hope someone answers.

Most of the time — nothing.

- Yelp and Angi give you random leads.
- Word of mouth is slow.
- Door-to-door is a guess.

You don't know which homes actually need work.

You don't know who lives there.

You don't know if they'll hire someone out — or DIY it themselves.

So you waste hours on the wrong streets.

That's the pain we built HouseholdIQ to fix.

---

## 2. The Product (~0:30)

**[SHOW: open the app — full map view]**

This is **HouseholdIQ**.

We call it a **bounty board for homes**.

- Every little character on the map is a real SF address.
- Scored by public data.
- Ranked by how good the lead is.

**Green** — hot lead. Go now.

**Yellow** — worth a look.

**Red** — probably skip.

**!** — urgent. This home likely needs work *right now*.

It feels like a game board — but every sprite is a real opportunity.

---

## 3. The Demo (~1:00)

**[SHOW: zoom into the Mission — multiple sprites visible]**

Let me show you how it works.

**[SHOW: click a green sprite with a ! badge]**

I click a house.

Side panel opens.

- Address up top.
- Match score — say **92 out of 100**.
- Urgent flag — old permit, aging systems.

**[SHOW: scroll to Property Signals]**

Property signals:
- How old the home is.
- When the last permit was pulled.
- Whether it's owner-occupied.

**[SHOW: scroll to Household Profile / cluster]**

And a behavioral profile — what kind of homeowner this probably is.

Before you knock, you already know *why* this door might be worth it.

**[SHOW: Persona Chat section — type and send if live, or narrate]**

You can even chat with an AI persona of the household.

Ask: *"Would they respond to a cold knock?"*

* "What objections might they have?"

It's not pitch training.

It's qualification — so you don't waste the trip.

---

## 4. The Data & AI (~0:25)

**[SHOW: stay on side panel or cut back to map]**

Under the hood, it's simple.

- We pull public SF data — permits, property records, census signals.
- Python pipelines turn raw records into scores.
- OpenAI generates a persona from those signals.

The contractor gets context *before* they spend time knocking.

Not a phone number from a form.

Actual intelligence about the home and the household.

---

## 5. Real-Time Backend (~0:15)

**[SHOW: map view — optional quick flash of Convex dashboard]**

Everything stays in sync through **Convex**.

- Leads load live.
- Chat history persists.
- New data can hit the map without a refresh.

No manual exports. No stale spreadsheets.

---

## 6. Outreach (~0:05)

**[SHOW: "Get contact info" button at bottom of panel]**

Once you've qualified a lead, one click can pull contact info through **Orange Slice** — so you're not guessing at the door *or* at the phone.

---

## 7. Close (~0:15)

**[SHOW: wide map shot — pan across sprites]**

Yelp sells you leads.

HouseholdIQ gives you context.

**Know which doors to knock on.**

**And know who answers before you knock.**

That's HouseholdIQ. Thank you.

---

## Quick Reference — What to Show When

| Moment | [SHOW] |
|--------|--------|
| Hook | Blank / door-knock b-roll |
| Reveal | Full map + legend |
| Demo | Click sprite → side panel → scroll |
| Chat | Type one message if live |
| Close | Wide map, multiple sprites |

## Pre-Record Checklist

- [ ] App loads at [yc-growth-hack.vercel.app](https://yc-growth-hack.vercel.app)
- [ ] Complete contractor setup if prompted
- [ ] Pick a green + ! sprite in the Mission
- [ ] Browser zoom 100%, hide bookmarks bar
- [ ] Test Escape closes the side panel
