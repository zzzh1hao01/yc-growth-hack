# HouseholdIQ — 60-Second Demo Flow

Shoot this against the live app: **[yc-growth-hack.vercel.app](https://householdiq-insurance.vercel.app/)**  
(Code lives on branch `feature/quest-board-ui`.)

For the full spoken script with timestamps, see **[DEMO_SCRIPT.md](./DEMO_SCRIPT.md)**.

---

## Before you record

- Browser at 100% zoom, bookmarks bar hidden
- Use Chrome or Safari full-screen
- If the map shows "Loading…", record from **localhost** on `feature/quest-board-ui` instead (see README on that branch)
- Pick a lead with a green sprite + `!` badge in the Mission

---

## Step 1 — Open the map (0:00–0:10)

1. Open **https://householdiq-insurance.vercel.app/**
2. **Say:** *"This is HouseholdIQ — a bounty board of scored SF households for home service contractors."*
3. **Point out:** **Bounty Board** header · San Francisco
4. **Point out:** Color legend — green = hot, yellow = warm, red = cold · `!` = urgent

**Show:** Cartoon Mapbox map with pixel sprites across neighborhoods.

---

## Step 2 — Click a household (0:10–0:25)

1. **Zoom** into the Mission
2. **Click** a **green sprite with a `!` badge**
3. **Say:** *"Each sprite is an address. Color is match score. The exclamation mark means an old permit — likely needs HVAC or electrical work."*

**Show:** Side panel slides in — address, neighborhood, match score.

---

## Step 3 — Score + property intel (0:25–0:40)

1. **Point to** Match Score bar (e.g. **92/100 · Hot lead**)
2. **Point to** Urgent line if visible
3. **Scroll** to Property Signals — permit age, home age
4. **Scroll** to Household Cluster label

**Say:** *"Before knocking, the contractor sees permit age, home age, and a behavioral profile — not just an address."*

---

## Step 4 — Persona chat (0:40–0:55) — narrate if stubbed

1. **Scroll** to the chat / persona section
2. If chat is live: type *"Would this homeowner hire out HVAC work?"* and send
3. If stubbed: **narrate** — *"Next, they chat with an AI persona to qualify the lead before outreach."*

**Say:** *"It's qualification, not pitch training — understand the household before you knock."*

---

## Step 5 — Close (0:55–1:00)

1. Press **Escape** to close panel
2. **Pan** map to show multiple sprites
3. **Say:** *"Data-driven door knocking. Know which homes need work — and who lives there — before you knock."*

---

## Taglines (pick one for intro or outro)

- *"Know which doors to knock on, and know who answers before you knock."*
- *"A bounty board for homes — not random leads from Yelp."*
- *"Data-driven door knocking for SF contractors."*

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Stuck on "Loading leads from Convex…" | Record from local `feature/quest-board-ui` with `.env.local` set, or wait for Convex to connect |
| No map / Mapbox error | App needs `NEXT_PUBLIC_MAPBOX_TOKEN` on Vercel |
| No sprites | Convex may be empty — app falls back to placeholder data when Convex returns empty |

---

## Related docs

| File | Purpose |
|------|---------|
| [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) | Full 3–5 min spoken script with timestamps |
| [convex_readme.md](./convex_readme.md) | Backend build guide for teammates |
| [BRIEF.md](./BRIEF.md) | Product brief |
