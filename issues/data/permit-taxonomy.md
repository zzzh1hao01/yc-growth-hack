# SF Building Permit Taxonomy — HVAC & Electrical (CORRECTED)

> **Slice 1 correction.** The original version of this doc queried **only** the
> Building Permits dataset (`i98e-djp9`) and undercounted the electrical vertical
> by ~195× (it reported 366 panel permits; the real number is ~82k). SF files
> electrical and mechanical work in **separate datasets**. This version pulls each
> vertical's signal from the dataset it actually lives in. All counts below were
> regenerated live against SF Open Data.

## Datasets — one per signal

| Vertical | Dataset | ID | Why |
|---|---|---|---|
| Panel upgrades, EV chargers | **Electrical Permits** | `ftty-kx6y` | All electrical work; the lead signal for electricians |
| HVAC / furnace / mechanical | **Plumbing Permits** | `a6aw-rudh` | SF files mechanical/HVAC as "plumbing", `work category: 1m` |
| Large remodels w/ HVAC scope | Building Permits | `i98e-djp9` | Secondary; bigger jobs only, noisier (catches commercial TIs) |
| ~~Boiler~~ | ~~Boiler Permits~~ | ~~`5dp4-gtxk`~~ | **Excluded** — "Permit To Operate Boiler" is a recurring *operational* permit (mostly commercial), not an install/replace lead |

All join on `block` + `lot` — confirmed present in all permit datasets **and** the
assessor roll (`wv5m-vpq2` has separate `block` and `lot` columns). See
`neighborhood-selection.md` for the validated join rate.

---

## Electrical vertical — `ftty-kx6y` (the big correction)

Dataset total: **349,773** electrical permits.

### Panel upgrades

```sql
upper(description) like '%PANEL%'
OR upper(description) like '%SERVICE UPGRADE%'
OR upper(description) like '%200A%'
OR upper(description) like '%400A%'
```

| Filter | Count |
|---|---|
| `%PANEL%` alone | **71,619** |
| Recommended filter (above) | **82,420** |
| ~~Old building-permits-only count~~ | ~~366~~ ❌ |

**Example passing the filter:** *"replace 4000amp main breaker in basement electric panel room"* — a real panel/service signal, not a minor line item.

### EV charger installs

```sql
upper(description) like '%EV CHARGER%'
OR upper(description) like '%ELECTRIC VEHICLE%'
OR upper(description) like '%EVSE%'
OR upper(description) like '%CHARGING STATION%'
```

| Filter | Count |
|---|---|
| Recommended filter (above) | **3,151** |
| ~~Old building-permits-only count~~ | ~~135~~ ❌ |

**Example passing the filter:** *"(01) enphase iq 50 ev charger"* — specific EV install.
Volume is modest but trending up post-2020; high-intent.

---

## HVAC vertical — `a6aw-rudh` (filed as "plumbing")

Dataset total: **518,886** plumbing/mechanical permits.

```sql
upper(description) like '%WORK CATEGORY: 1M%'   -- SF mechanical code
OR upper(description) like '%FURNACE%'
OR upper(description) like '%HEAT PUMP%'
```

| Filter | Count |
|---|---|
| `work category: 1m` (clean mechanical code) | **20,631** |
| `%FURNACE%` (catches legacy pre-code records) | **50,749** |
| Recommended union (above) | **64,248** |

**Example passing the filter:** *"replace two furnace units in kind."* — clean install/replace lead.

### Secondary HVAC source — building permits (`i98e-djp9`)

```sql
upper(description) like '%HVAC%' OR '%FURNACE%' OR '%HEAT PUMP%' OR '%AIR CONDITION%'
```
Count: **13,132**. Use only as a supplement — example passing the filter is a
commercial tenant-improvement (*"8th floor t.i. ..."*), so this source is
**noisier** and should be residential-filtered hard before use.

---

## Residential filtering — important caveat

The **electrical and plumbing datasets have no `existing_use` / use-type field**
(only building permits does). To restrict to residential leads you **must join
block/lot → assessor** and filter on the assessor's `use_definition` /
`property_class_code`. This makes the assessor join load-bearing, not optional.

---

## Key fields for the pipeline

| Field | Dataset(s) | Use |
|---|---|---|
| `block` + `lot` | all | **Join key** to assessor — the clean equi-join |
| `description` | all | Keyword filter for work type |
| `filed_date` / `issued_date` | all | Permit-age signal for lead scoring |
| `completed_date` | electrical, building | Open (no completed) → active construction exclusion |
| `existing_use` | building only | Residential filter (electrical/plumbing need assessor join) |
| `street_number` + `street_name` | all | Display + fallback join only |

> **Pagination note:** the original `fetch_permit_sample(limit=50000)` silently
> capped results. All counts in this doc come from server-side `count(*)`
> (`explore/sources.count_records`), which is never truncated.

---

## Assessor data — no pool flag (unchanged finding)

`wv5m-vpq2` has **no `has_pool` field**. Use **recent-mover** (`current_sales_date`
within ~3 years) as the substitute behavioral signal — a cleaner, data-rich
proxy. Modeled as a secondary boost in the lead score, not a primary filter.
