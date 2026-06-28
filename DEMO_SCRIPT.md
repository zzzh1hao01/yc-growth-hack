# HouseholdIQ Demo Script

**Target length:** ~4–5 minutes spoken (generous — cut freely)  
**Branch reference:** `feature/quest-board-ui`  
**Recording tip:** Run `npm run convex:dev` + `npm run dev`, set `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`. Demo works with `PLACEHOLDER_LEADS` even if Convex is empty.

---

## 0:00 – 0:30 · Hook (the problem)

**[Screen: blank or a quick cut of random door-knocking / a generic lead-gen site]**

> If you're a home service contractor in San Francisco — HVAC, electrical, whatever — this is probably your week. You drive a route, knock doors, hope someone answers, and mostly get "we're not interested."
>
> There's no data behind it. You don't know which homes actually need work. You don't know if the owner is even the type to hire someone out versus DIY. You're guessing — block by block, door by door.
>
> That's the problem we're solving.

---

## 0:30 – 1:00 · Product introduction

**[Screen: load `http://localhost:3000` — the `QuestBoard` loads]**

> This is **HouseholdIQ**. We call it a **bounty board for homes**.
>
> **[Point to header]** You can see the title up here — "Bounty Board" — and we're scoped to San Francisco. Each little character on the map is a **lead**: a real address, scored by public data, waiting to be clicked.
>
> Think of it like a video game quest map — except every sprite is a household that might actually need your services.

---

## 1:00 – 1:45 · Onboarding (planned — narrate, don't click)

**[Screen: stay on QuestBoard header — do NOT invent a form that isn't there]**

> In the full product, a contractor lands here with no account. They type a free-text description of their business — something like *"I do HVAC in the Mission, mostly older homes"* — and enter their business address through Google Places autocomplete.
>
> GPT extracts their service profile — HVAC versus electrical, price point, target neighborhoods — and that feeds into proximity scoring.
>
> **[Point to badge: "Mission HVAC Co. · Demo placeholders"]**
>
> For this demo recording, we've skipped onboarding and dropped you straight onto the board as **Mission HVAC Co.** The badge here tells you where data is coming from — right now it says **"Demo placeholders"** because we're showing sample leads from `src/data/placeholderLeads.ts`. When Convex has real ETL data loaded, that flips to **"Convex · householdiq"** via `useQuery(api.leads.listLeads)` in `QuestBoard.tsx`.

---

## 1:45 – 2:30 · Map + sprites + scoring

**[Screen: pan and zoom `QuestMap` — Mission / Castro area]**

> **[Zoom in on the map]** This is our Mapbox layer — `QuestMap.tsx`. We use a custom cartoon style from `map-cartoon-style.ts` so it feels like a game board, not a corporate GIS tool.
>
> **[Point at sprites]** Each pin is a `LeadSprite` — a CSS-positioned div over the Mapbox canvas, not a native Mapbox symbol. Inside is a pixel-character SVG. The body color tells you match quality:
>
> **[Point to `BoardLegend` in the header]**
> - **Green** — hot lead, score 70 plus  
> - **Yellow** — warm, 40 to 69  
> - **Red** — cold, under 40  
>
> That score is a weighted composite from our ETL pipeline — permit age, owner-occupied status, home age, behavioral cluster fit, and proximity to the contractor. All defined in `BRIEF.md`.
>
> **[Point at a sprite with the red `!` badge]**
> And this exclamation mark — that's the **urgency flag**. It means the last HVAC or electrical permit is past the replacement threshold — like 15-plus years. That's a house that probably needs work *now*, not eventually.
>
> Hot leads also **wave** — little animation on the sprite arm. You'll notice the green ones feel alive.

---

## 2:30 – 3:30 · Click a sprite → side panel

**[Screen: click a high-score urgent lead — e.g. "2847 24th St, Mission"]**

> **[Click sprite]** Now I click a sprite — let's grab this one in the Mission.
>
> **[`LeadSidePanel` slides in from the right]**
> The side panel opens. Address up top, neighborhood underneath.
>
> **[Scroll to Match Score section]**
> Match score bar — 92 out of 100, labeled **Hot lead**. Distance from your business shows here when ETL computes it.
>
> **[Point to urgent line]**
> And there's our urgency callout again — "permit exceeds replacement threshold."
>
> **[Scroll to Property Signals]**
> Property signals: last permit age, home age, owner status, assessed value. Some fields show **"ETL: Assessor parcel"** placeholders — that's honest demo labeling. Real values populate when the Python pipeline ingests SF Assessor and permit data through `api.leads.bulkUpsertLeads`.
>
> **[Scroll to Household Cluster]**
> Behavioral cluster — like *"Long-time owner, budget-conscious"* — assigned offline from Census block groups plus AHS, CEX, GSS, and Pew survey distributions. This is how we know *what kind of homeowner* you're dealing with before you knock.

---

## 3:30 – 4:00 · AI persona chat (stub — narrate the vision)

**[Screen: point to "Persona chat coming soon" text in `LeadSidePanel`]**

> **[Read the stub text on screen]**
> So right now the panel says **"Persona chat coming soon"** — that's a placeholder. The architecture is wired in our Convex spec: when you open a household, `personas.ensurePersona` schedules a GPT action that writes a narrative based on permit history, assessor data, and the cluster traits.
>
> **[Gesture as if typing]**
> In the finished flow, you'd type here — *"Would this homeowner respond to a cold knock, or do they prefer Yelp?"* — and the AI persona answers in character. It's not pitch training. It's **qualification** — understand the household before you spend a trip.
>
> For the recording: we're showing the property intelligence layer today; chat lands on the next sprint via `convex/personas/` actions in our integration guide.

---

## 4:00 – 4:30 · Action moment — contact enrichment

**[Screen: scroll to bottom of `LeadSidePanel`]**

> **[Point to disabled button]**
> Once you've qualified a lead, you hit **"Get contact info."** In the demo this button is disabled — Orange Slice enrichment isn't wired yet — but the flow is: `enrichment.requestContactInfo` mutation schedules an action, Orange Slice returns phone and email, and you can push to outreach through Gmail or HeyReach.
>
> **[Click Pursue mentally / narrate]**
> The contractor decides: pursue or skip. Pursued leads update status in Convex so the map reflects what you've already worked.

---

## 4:30 – 5:15 · Technical credibility

**[Screen: optional quick cut — Convex dashboard showing `leads` table, or terminal with `npx convex dev`]**

> Quick architecture pass — because this isn't just a pretty map.
>
> **[Optional: show `convex/leads.ts` or dashboard]**
> **Convex** is our backend. `listLeads` powers the board reactively — `useQuery` in `QuestBoard.tsx` subscribes over WebSocket, so when ETL bulk-loads new addresses, sprites appear without a refresh. Schema is in `convex/schema.ts`; ingest is `bulkUpsertLeads`.
>
> **Mapbox** handles the basemap and geolocation. Sprites are React components projected with `map.project()` — hackathon-feasible, no game engine.
>
> **Python ETL** — on the `backend/issues` branch — pulls SF Open Data permits, Assessor parcels, Census ACS, runs cluster assignment and scoring, then pushes JSON into Convex. Public data in, ranked leads out.

---

## 5:15 – 5:45 · Closing

**[Screen: back to full map view, pan across sprites]**

> Yelp and Angi sell you **leads** — random homeowners who filled out a form somewhere. HouseholdIQ sells you **context**: which doors, why now, and who answers.
>
> It's **data-driven door knocking** for SF contractors. Know which homes need work. Know who lives there. Then decide if it's worth the knock.
>
> That's HouseholdIQ. Thanks for watching.

---

## Speaker Notes (visual emphasis)

| Moment | Emphasize on screen |
|--------|---------------------|
| Hook | Keep it faceless or b-roll — don't show the app yet |
| Map reveal | Full-width `QuestMap`, cartoon green tint, multiple sprites visible |
| Legend | Pause on `BoardLegend` — green / yellow / red / `!` |
| Urgent sprite | Click one with `urgent: true` — red badge + green body is striking |
| Side panel | Slow scroll: score bar → property signals → cluster |
| Placeholder honesty | Briefly show italic "ETL: Assessor parcel" — judges appreciate transparency |
| Stub sections | Don't linger on disabled chat/button — narrate confidently, move on |
| Close | Wide map shot with 5+ sprites — feels alive |

### Pre-recording checklist

- [ ] `.env.local` has valid `NEXT_PUBLIC_MAPBOX_TOKEN`
- [ ] `npm run dev` running; optional `npm run convex:dev`
- [ ] Browser zoom 100%; hide bookmarks bar
- [ ] Pick a lead with `matchScore: 92` and `urgent: true` for the click demo (`lead-001`)
- [ ] Test Escape key closes `LeadSidePanel`
- [ ] If Convex has seeded leads, confirm header badge says "Convex · householdiq"

---

## Demo Gaps / Risks

| Gap | Impact on recording | Mitigation |
|-----|----------------------|------------|
| **No onboarding UI** | Section B/C requires narration, not clicks | Narrate planned flow; point at "Mission HVAC Co." header badge |
| **Placeholder data only** (default) | Property fields partially stubbed | Click leads with full placeholder data; acknowledge "demo data" chip in panel |
| **No persona chat UI** | Can't demo live GPT conversation | Narrate from `LeadSidePanel` stub text + `convex_readme.md` architecture |
| **"Get contact info" disabled** | Can't show real enrichment | Narrate Orange Slice flow; show disabled button briefly |
| **Convex may be empty** | Falls back to `PLACEHOLDER_LEADS` automatically | Works fine — badge shows "Demo placeholders" |
| **No contractor proximity re-rank in UI** | `distanceMiles` often null on placeholders | Mention scoring conceptually; don't claim live proximity unless ETL loaded |
| **Onboarding GPT extraction not built** | Can't demo profile parsing | Reference `contractors.create` from `convex_readme.md` as planned |
| **ETL pipeline not merged to UI branch** | Backend data on separate branch | Mention `backend/issues` + `bulkUpsertLeads`; optional Convex dashboard B-roll |
| **Mapbox token missing** | `QuestMap` shows error state instead of map | Verify token before recording |
| **`convex_readme.md` vs live schema** | Spec describes future `households` table; UI uses `leads` | Demo the running app (`leads`); spec doc is forward-looking |
