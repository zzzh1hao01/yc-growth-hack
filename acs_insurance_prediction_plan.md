# ACS data extraction plan — P&C insurance lead prediction model

This document defines which ACS variables to extract at the block group level, what each one reveals about insurance-relevant risk attitudes, and how to combine them into a predictive signal for homeowners insurance coverage behaviour.

---

## Context and scope

The American Community Survey (ACS) does not contain direct insurance behavioural data at the individual household level. What it does contain — at block group resolution, covering 300–800 households in SF — is a set of demographic and housing variables that serve as validated proxies for the underlying attitudes and behaviours that drive insurance decisions.

The variables below are drawn from the **2020–2024 ACS 5-year estimates**, available free via `api.census.gov`. All are available at block group level for San Francisco County (FIPS state: `06`, county: `075`). A free Census API key is required.

Base API endpoint:
```
https://api.census.gov/data/2024/acs/acs5
  ?get={VARIABLES}
  &for=block+group:*
  &in=state:06+county:075
  &key=YOUR_KEY
```

Each parcel in the property layer is joined to a block group via its Census GEOID, derived by passing the parcel's lat/lng through the Census Geocoder API (free).

---

## Part 1 — Variables to extract

### 1.1 Income

| Variable | Table | Description |
|---|---|---|
| `B19013_001E` | Median household income | Median income across all households in the block group |
| `B19001_002E` through `B19001_011E` | Income distribution | Count of households in each income bracket ($10k increments up to $100k) |
| `B19001_012E` through `B19001_017E` | Income distribution (upper) | Count of households earning $100k–$200k+ |

**Why income distribution matters more than the median:** Two block groups can have the same median income but very different coverage behaviour if one is bimodal (many low-income + many high-income) versus one that is uniformly middle-income. The full distribution lets you compute the share of households above key thresholds ($100k, $150k) that correlate with coverage maximiser vs. price-shopper behaviour.

---

### 1.2 Educational attainment

| Variable | Table | Description |
|---|---|---|
| `B15003_001E` | Total population 25+ | Denominator for all education percentages |
| `B15003_022E` | Bachelor's degree holders | Count with bachelor's degree |
| `B15003_023E` | Master's degree holders | Count with master's degree |
| `B15003_024E` | Professional degree holders | Count with professional degree (JD, MD, etc.) |
| `B15003_025E` | Doctoral degree holders | Count with doctoral degree |

**Derived field:**
```
pct_college_educated = (B15003_022E + B15003_023E + B15003_024E + B15003_025E) / B15003_001E
```

---

### 1.3 Age structure

| Variable | Table | Description |
|---|---|---|
| `B01002_001E` | Median age | Median age of all residents |
| `B01001_020E` through `B01001_025E` | Males 55–75+ | Age bracket counts (male) |
| `B01001_044E` through `B01001_049E` | Females 55–75+ | Age bracket counts (female) |
| `B01001_007E` through `B01001_012E` | Males 25–44 | Working-age bracket (male) |
| `B01001_031E` through `B01001_036E` | Females 25–44 | Working-age bracket (female) |

**Derived fields:**
```
pct_over_55 = sum(B01001_020E:025E + B01001_044E:049E) / B01001_001E
pct_25_to_44 = sum(B01001_007E:012E + B01001_031E:036E) / B01001_001E
```

---

### 1.4 Housing tenure and ownership

| Variable | Table | Description |
|---|---|---|
| `B25001_001E` | Total housing units | Denominator |
| `B25003_001E` | Occupied housing units | Total occupied |
| `B25003_002E` | Owner-occupied units | Count of owner-occupied households |
| `B25003_003E` | Renter-occupied units | Count of renter-occupied households |
| `B25026_001E` | Total population in occupied units | Denominator for tenure |
| `B25026_002E` through `B25026_010E` | Householder moved in: owner by year | Distribution of owner move-in years (pre-1979, 1980–89, 1990–99, 2000–09, 2010–14, 2015–17, 2018–19, 2020–21, 2022 or later) |

**Derived fields:**
```
owner_occupancy_rate = B25003_002E / B25003_001E
pct_long_tenure_owners = (B25026_002E + B25026_003E + B25026_004E) / B25003_002E
  (owners who moved in before 2000 — 25+ year tenure)
```

---

### 1.5 Mortgage status

| Variable | Table | Description |
|---|---|---|
| `B25087_001E` | Owner-occupied units with a mortgage | Total mortgaged |
| `B25087_002E` | Units with mortgage: first mortgage only | Primary mortgage holders |
| `B25081_001E` | Owner-occupied housing units | Total owner-occupied denominator |
| `B25081_002E` | With a mortgage | Count carrying any mortgage |
| `B25081_008E` | Free and clear (no mortgage) | Count with no mortgage |

**Derived field:**
```
pct_mortgaged = B25081_002E / B25081_001E
pct_free_and_clear = B25081_008E / B25081_001E
```

---

### 1.6 Home value

| Variable | Table | Description |
|---|---|---|
| `B25077_001E` | Median home value (owner-occupied) | Median self-reported home value |
| `B25075_001E` | Total owner-occupied units | Denominator |
| `B25075_020E` through `B25075_027E` | Units valued $500k–$2M+ | Count of high-value properties by bracket |

**Derived field:**
```
pct_high_value_homes = sum(B25075_020E:027E) / B25075_001E
  (homes valued $500k or above)
```

---

### 1.7 Monthly housing costs

| Variable | Table | Description |
|---|---|---|
| `B25094_001E` | Selected monthly owner costs (with mortgage) | Median monthly costs including mortgage, taxes, insurance, utilities |
| `B25104_001E` | Monthly housing costs as % of income (with mortgage) | Median cost burden ratio |
| `B25093_001E` | Monthly owner costs without mortgage | Median costs for free-and-clear owners |

This is the closest ACS comes to insurance spend — owner costs with mortgage include insurance as a component, so elevated costs relative to income indicate households where insurance is a meaningful budget line item.

---

### 1.8 Occupation and industry

| Variable | Table | Description |
|---|---|---|
| `C24010_001E` | Civilian employed population 16+ | Denominator |
| `C24010_003E` | Male: management, business, science, arts | White-collar male count |
| `C24010_039E` | Female: management, business, science, arts | White-collar female count |
| `C24010_019E` | Male: service occupations | Service sector male |
| `C24010_055E` | Female: service occupations | Service sector female |

**Derived field:**
```
pct_white_collar = (C24010_003E + C24010_039E) / C24010_001E
```

---

### 1.9 Household composition

| Variable | Table | Description |
|---|---|---|
| `B11001_001E` | Total households | Denominator |
| `B11001_002E` | Family households | Count of family (married/single parent) households |
| `B11001_007E` | Non-family households | Count of non-family (single person, unrelated) households |
| `B11003_003E` | Married-couple families with children | Count with children under 18 |
| `B09021_001E` | Population 18+ in households | Adults in households |

**Derived field:**
```
pct_family_households = B11001_002E / B11001_001E
pct_with_children = B11003_003E / B11001_002E
```

---

### 1.10 Vehicles available

| Variable | Table | Description |
|---|---|---|
| `B08201_001E` | Total households | Denominator |
| `B08201_002E` | No vehicles available | Car-free households |
| `B08201_003E` | 1 vehicle | Single-car households |
| `B08201_004E` | 2 vehicles | Two-car households |
| `B08201_005E` | 3+ vehicles | Multi-car households |

**Derived field:**
```
pct_multi_vehicle = (B08201_004E + B08201_005E) / B08201_001E
avg_vehicles = (0×B08201_002E + 1×B08201_003E + 2×B08201_004E + 3×B08201_005E) / B08201_001E
```

Multi-vehicle ownership is a bundle signal — households with 2+ vehicles are strong candidates for combined home and auto policy conversations.

---

## Part 2 — What each variable indicates about risk aversion

Risk aversion, in the insurance context, means the household's tendency to pay to eliminate uncertainty — specifically the risk of a large, low-probability financial loss. The ACS variables do not measure this directly. Instead they serve as validated proxies for the underlying dispositions: financial sophistication, loss salience, inertia, and engagement propensity.

---

### 2.1 Income → price sensitivity vs. coverage orientation

**What it indicates:** Income is the primary determinant of which conversation an agent should have. The relationship between income and insurance behaviour is not linear:

- **Below $75k:** Price is the dominant decision variable. Households in this bracket are more likely to hold lender-minimum coverage, have lapsed or let coverage drift, and respond primarily to savings arguments. Risk aversion is high in the abstract but financially constrained in practice — they cannot afford to be as risk-averse as they would like to be.

- **$75k–$150k:** Mixed profile. These households have enough financial headroom to optimise coverage but may not have engaged with it. They are the most likely to have set coverage at purchase and not revisited it. Coverage gap conversations land here.

- **Above $150k:** Coverage quality becomes more important than price. These households respond to gap and adequacy arguments, bundle conversations, and umbrella policy discussions. They are more likely to have engaged with their insurance periodically, but may still be underinsured if home value has appreciated significantly.

**Research basis:** The Consumer Expenditure Survey confirms that insurance spending as a percentage of income is highest in middle-income brackets — high-income households spend more in absolute terms but are not more comprehensively insured relative to asset value. The SCF (Survey of Consumer Finances) documents that higher income and wealth correlate positively with risk aversion in financial domains, including insurance demand.

**Prediction use:** Use income bracket to assign conversation framing. Do not use income alone as a lead quality filter — a moderate-income household with a $900k home and 12-year tenure is a higher-value lead than a high-income household who purchased two years ago at full market coverage.

---

### 2.2 Education → active shopping propensity

**What it indicates:** Educational attainment is the strongest single proxy for financial literacy, which drives whether a household actively reviews and updates financial products versus allowing them to auto-renew indefinitely.

- **College-educated households** are more likely to comparison-shop at renewal, more likely to respond to coverage gap arguments (because they can process the underlying logic), and more likely to understand the difference between ACV and replacement cost coverage. They are the most receptive to consultative agent conversations.

- **Non-college households** are more likely to hold whatever policy their lender required, less likely to have updated it since origination, and more likely to respond to simple, concrete arguments ("your home is worth twice what it was when you set your coverage").

**Research basis:** Dohmen et al. (2011) find that education is strongly positively correlated with willingness to take financial risks. Separately, insurance demand research consistently finds that financial literacy reduces the prevalence of underinsurance — but the mechanism is active engagement rather than risk aversion per se. The SCF documents that more educated households are more likely to hold a variety of financial products and update them regularly.

**Prediction use:** High-education block groups should receive more sophisticated outreach materials (coverage gap calculations, specific dollar estimates of underinsurance). Lower-education block groups should receive simpler, more concrete framing with a single clear message.

---

### 2.3 Age → loyalty vs. switching tendency

**What it indicates:** Age is a dual signal — it predicts both insurance engagement style and inertia level.

- **Households aged 55+** are the classic set-and-forget profile. They are less likely to switch carriers, more likely to have held the same policy for 10+ years, less price-sensitive, but also most likely to be significantly underinsured (policy set when the home was worth less and hasn't been revisited). Loss aversion research (Dohmen et al. 2011, SCF analysis) consistently shows that older households score higher on financial risk aversion but lower on active financial management — they want protection but don't seek it out.

- **Households aged 35–54** are the active optimisers. They are more likely to shop at renewal, more likely to switch carriers when given a compelling reason, and more likely to have updated their coverage after major life events (marriage, children, renovation).

- **Households aged 25–34** are the new entrants — recent buyers, potentially on their first homeowners policy, more price-sensitive, and most receptive to educational framing about what coverage actually means.

**Prediction use:** Age cluster determines timing and message. Older block groups (median age 55+) are the underinsurance opportunity — long-tenure, appreciating assets, set-and-forget. Younger block groups are the switching opportunity — price-motivated, active shoppers. The lead score weights these differently depending on which signal is the primary trigger (event-based vs. inertia-based).

---

### 2.4 Housing tenure → auto-renewal inertia

**What it indicates:** This is the most direct proxy available in public data for the set-and-forget disposition. A homeowner who has lived in the same property for 15+ years has auto-renewed their insurance policy approximately 15 times with minimal review. Research on financial inertia (Status quo bias, Samuelson & Zeckhauser 1988) documents that default persistence is strongest in low-visibility, low-engagement financial products — precisely the profile of homeowners insurance.

Long tenure combined with high home value appreciation creates the highest underinsurance probability of any variable combination in the ACS. The dwelling coverage set in 2009 at $550k is probably still in the $650k range after carrier adjustments — while the home is now worth $1.3m and would cost $1.1m to rebuild.

**Research basis:** The LexisNexis 2024 Home Insurance Consumer Insights study explicitly identified the "Set It & Forget It" customer segment as the highest underinsurance risk cohort. The SCF documents that long-tenure homeowners have the largest gap between self-reported home value and estimated replacement cost coverage.

**Prediction use:** `pct_long_tenure_owners` (moved in before 2000) is a primary feature in the lead scoring model. Block groups with >40% long-tenure owner-occupants are the target zone for underinsurance outreach.

---

### 2.5 Mortgage status → compelled vs. optional insurance holders

**What it indicates:** This is the clearest binary available for whether a household is *required* to hold insurance.

- **Mortgaged households** must carry homeowners insurance as a condition of the loan. They hold insurance, but their coverage level may be at lender minimum only, and they may not have updated it since origination.

- **Free-and-clear households** (no mortgage) are not required to carry insurance. Research from the Federal Reserve's Survey of Household Economics and Decisionmaking (SHED) confirms that a meaningful share of unencumbered homeowners carry no coverage at all, with cost cited as the primary reason.

**Risk aversion implication:** The absence of a mortgage removes the externally imposed floor on insurance engagement. Free-and-clear status combined with long tenure and high appreciation creates a distinct high-risk segment: a homeowner with $800k of equity and no lender enforcing coverage who may be partially or entirely uninsured.

**Prediction use:** `pct_free_and_clear` should flag block groups for a different outreach message — not "you might be underinsured" but "you might not have any coverage at all." The dollar-amount-at-risk framing is more powerful here than coverage gap math.

---

### 2.6 Home value → coverage expectation and loss salience

**What it indicates:** Median home value directly determines the stakes of the coverage conversation and the plausibility of the loss-salience argument.

- High-value homes ($800k+) make the underinsurance gap immediately tangible. A $200k coverage gap on an $800k home is a credible, frightening number that makes the agent's conversation worth having.

- Lower-value homes have smaller absolute gaps. The conversation is still valid but the urgency argument is weaker.

**Risk aversion implication:** Loss aversion theory (Kahneman & Tversky 1979) predicts that the psychological weight of a potential loss scales non-linearly with its magnitude. A household at risk of a $400k uninsured loss after a catastrophic event will respond more strongly to loss-framing than one at risk of a $50k gap. High home value amplifies the loss salience of the coverage gap argument.

**Prediction use:** `B25077_001E` (median home value) is a multiplier on need score. A household with a 30% appreciation gap on a $400k home has a lower absolute gap than one with a 15% gap on a $1.2m home. The coverage gap dollar amount — computable from assessor + ACS home value — should be the primary metric in the lead score, not the percentage gap alone.

---

### 2.7 Occupation (white-collar share) → financial engagement and insurance literacy

**What it indicates:** Occupation type is the best available proxy for financial engagement behaviours that are not directly captured by income or education alone. Management, professional, and business occupations correlate with:

- Regular engagement with financial products as part of work context
- Higher likelihood of employer-provided financial advice (401k, benefits counsellors)
- Greater familiarity with risk transfer concepts from professional experience
- Higher likelihood of being a comparison shopper

**Research basis:** The ACS white-collar occupational grouping (management, business, science, arts) has been validated in health and financial research as a reliable proxy for financial sophistication and proactive financial behaviour. The Cubit Planning analysis of ACS table C24010 demonstrates its utility for estimating financially-engaged household concentrations at small geographic levels.

**Prediction use:** High white-collar concentration block groups are more likely to respond to data-driven outreach (specific dollar gap amounts, market comparisons) and less likely to respond to fear-based framing. They are also more likely to be comparison shopping already — meaning the agent needs to arrive with a competitive reason, not just a coverage conversation.

---

### 2.8 Household composition → bundle propensity and coverage complexity

**What it indicates:** Family households with children have more complex insurance needs (personal property, liability, potential umbrella coverage) and more reasons to care about comprehensive coverage. They also have more to lose from underinsurance — not just the home value but the disruption to a family's living situation during a claim.

Multi-vehicle households are bundle candidates — agents can open a combined home and auto conversation that often produces a lower combined premium and a stronger relationship.

**Prediction use:** `pct_family_households` and `pct_with_children` modify the bundle signal. Block groups with high family concentration and multi-vehicle ownership are candidates for a "one conversation, two policies" outreach strategy.

---

### 2.9 Monthly housing costs (as % of income) → financial stress flag

**What it indicates:** High housing cost burden (>30% of income toward housing) is a negative indicator for insurance engagement. Households spending a large share of income on housing have limited financial headroom, are more likely to choose the lowest available coverage to minimize premium, and are more likely to lapse during financial pressure.

**Prediction use:** Block groups with high cost burden ratios should be deprioritised in the need-and-ability-to-pay scoring. The coverage gap may be real, but the ability to act on it is constrained. These households are better candidates for a cost-neutral coverage rebalancing conversation (same premium, better allocation) than a straightforward upsell.

---

## Part 3 — Using ACS data to predict insurance coverage

### 3.1 The three-question framework

Every lead the model generates must answer three questions. ACS data contributes to all three, but at different confidence levels:

| Question | ACS contribution | Confidence |
|---|---|---|
| Does this household have a real coverage problem? | Indirect — home value + tenure as underinsurance proxies | Medium |
| Is this household the type that will engage? | Direct — education, occupation, age, mortgage status | Higher |
| What conversation will land? | Direct — income, education, age, composition | High |

The property layer (assessor + recorder + permits) answers the first question with higher confidence than ACS. ACS's primary contribution is to the second and third questions.

---

### 3.2 The three composite dimensions

Compute these at block group level. Each parcel inherits its block group's dimension scores, which are then combined with the parcel-level property signals.

**Dimension A — Financial sophistication score**

Predicts whether the household is an active manager of financial products or a passive auto-renewer.

```
financial_sophistication =
    normalize(pct_college_educated)    × 0.35
  + normalize(pct_white_collar)         × 0.35
  + normalize(median_income / 100000)   × 0.30
```

High score → active optimiser or coverage maximiser persona. Responds to data-driven gap arguments.
Low score → set-and-forget persona. Responds to simple, concrete, loss-salient framing.

**Dimension B — Inertia / set-and-forget score**

Predicts auto-renewal probability and therefore underinsurance accumulation.

```
inertia_score =
    normalize(median_age / 80)              × 0.35
  + normalize(pct_long_tenure_owners)       × 0.40
  + normalize(pct_free_and_clear)           × 0.25
```

High score → strong underinsurance candidate. Long tenure + older + no mortgage pressure = maximum policy drift.
Low score → recent buyer or active financial manager. Underinsurance less likely but switching more possible.

**Dimension C — Coverage stakes score**

Predicts the magnitude of the insurance problem if one exists.

```
coverage_stakes =
    normalize(median_home_value / 1000000)  × 0.50
  + normalize(owner_occupancy_rate)          × 0.25
  + normalize(pct_high_value_homes)          × 0.25
```

High score → large absolute dollar gap if underinsured. Strong loss-salience argument available.
Low score → gap may be real but dollar amount is smaller. Conversation needs different hook.

---

### 3.3 The five behavioural archetypes

Assign each block group to one of five archetypes based on its dimension scores. These archetypes determine outreach message, not lead priority — lead priority comes from the property signals.

| Archetype | Dim A | Dim B | Dim C | Insurance behaviour | Agent conversation |
|---|---|---|---|---|---|
| **Active optimizer** | High | Low | High | Shops at renewal, knows their coverage, may already be adequately covered | Lead with competitive pricing or specific gap you've identified. Data-first. |
| **Wealthy inert** | Med-high | High | High | Long-tenure, high-value home, hasn't reviewed coverage in years — highest underinsurance probability | Lead with appreciation gap dollar amount. "Your home has doubled in value; your coverage probably hasn't." |
| **Price-first shopper** | Medium | Low | Medium | Triggers on rate increases, shops on price, switches for savings | Lead with premium comparison. Coverage conversation comes second. |
| **Disengaged owner** | Low | High | Low | Minimal insurance engagement, may hold bare minimum or lapsed coverage | Simple, concrete messaging. Focus on what's at risk, not on coverage sophistication. |
| **New-to-wealth** | High | Low | Medium | Recent purchase or income rise, may have set coverage below current asset value | Educational framing. First policy review conversation. |

---

### 3.4 Combining ACS signals with property signals in the lead score

ACS behavioural dimensions are **modifiers**, not primary scores. The property signals from the core layer determine need and timing; ACS signals determine receptivity and message.

```
lead_score =
    property_need_score     × 0.45   (appreciation gap, permits, home age, flood)
  + property_timing_score   × 0.30   (days to renewal, trigger event, tenure)
  + acs_receptivity_score   × 0.25   (financial sophistication, inertia, stakes)

acs_receptivity_score =
    financial_sophistication × 0.35
  + inertia_score            × 0.40
  + coverage_stakes          × 0.25
```

The weights above are initialised by domain reasoning. Once first-party outcome data accumulates (6+ months of structured outreach logging), replace the weights with a gradient-boosted model trained on actual conversion outcomes. The ACS features will either be confirmed as predictive or their weights will be adjusted based on what actually drives conversion in the SF market.

---

### 3.5 What ACS data cannot predict — and what fills those gaps

| Gap | Why ACS can't fill it | What can |
|---|---|---|
| Whether a specific household is currently insured | ACS only asks about mortgage costs, which bundle insurance with taxes and utilities | Licensed vendor flags; absence of forced-placed insurance notice |
| Current carrier or policy type | Private data — not in any public source | Asking the homeowner; licensed CLUE data (carrier access only) |
| Actual premium paid | Private — not collectible without consent | ACS PUMS `PROPINSR` at PUMA level for population calibration only |
| Individual risk attitude | ACS is block-group level; individual variation within a block group can be substantial | First-party intake data after contact; behavioral proxies from property records |
| Shopping intent | Not observable until the homeowner initiates contact | LexisNexis insurance demand signals; carrier non-renewal filings at CDI |

The honest position: ACS data narrows the population of households worth contacting and calibrates what to say. It cannot tell you with certainty that any individual household is underinsured or ready to engage. The property signals give you the stronger near-individual signal. ACS gives you the neighbourhood-level prior that makes the targeting more efficient before you spend money on contact enrichment.

---

### 3.6 Maintenance and refresh schedule

| Data source | Release cadence | Recommended refresh |
|---|---|---|
| ACS 5-year estimates | Annual (December) | Refresh block group features each January after new release |
| Block group GEOID assignments | Every 10 years (decennial census) | Stable until 2030 |
| Parcel-to-GEOID spatial join | One-time, re-run if ACS boundaries change | Stable; re-run only after 2030 Census |
| Dimension scores and archetype assignments | Computed from ACS data | Recompute annually with ACS refresh |
| Lead score model weights | Trained on first-party data | Retrain quarterly once 500+ labeled outcomes available |

---

## Appendix — Full variable list for API query

```
B19013_001E,
B19001_002E,B19001_003E,B19001_004E,B19001_005E,B19001_006E,
B19001_007E,B19001_008E,B19001_009E,B19001_010E,B19001_011E,
B19001_012E,B19001_013E,B19001_014E,B19001_015E,B19001_016E,B19001_017E,
B15003_001E,B15003_022E,B15003_023E,B15003_024E,B15003_025E,
B01002_001E,B01001_001E,
B01001_020E,B01001_021E,B01001_022E,B01001_023E,B01001_024E,B01001_025E,
B01001_044E,B01001_045E,B01001_046E,B01001_047E,B01001_048E,B01001_049E,
B01001_007E,B01001_008E,B01001_009E,B01001_010E,B01001_011E,B01001_012E,
B01001_031E,B01001_032E,B01001_033E,B01001_034E,B01001_035E,B01001_036E,
B25001_001E,B25003_001E,B25003_002E,B25003_003E,
B25026_001E,B25026_002E,B25026_003E,B25026_004E,B25026_005E,
B25026_006E,B25026_007E,B25026_008E,B25026_009E,B25026_010E,
B25087_001E,B25087_002E,B25081_001E,B25081_002E,B25081_008E,
B25077_001E,B25075_001E,
B25075_020E,B25075_021E,B25075_022E,B25075_023E,
B25075_024E,B25075_025E,B25075_026E,B25075_027E,
B25094_001E,B25104_001E,B25093_001E,
C24010_001E,C24010_003E,C24010_039E,C24010_019E,C24010_055E,
B11001_001E,B11001_002E,B11001_007E,B11003_003E,B09021_001E,
B08201_001E,B08201_002E,B08201_003E,B08201_004E,B08201_005E
```

Sample API call (replace `YOUR_KEY`):
```
https://api.census.gov/data/2024/acs/acs5
  ?get=B19013_001E,B15003_001E,B15003_022E,B01002_001E,
       B25003_002E,B25026_002E,B25081_002E,B25081_008E,
       B25077_001E,C24010_003E,C24010_039E,C24010_001E,
       B08201_004E,B08201_005E,B08201_001E
  &for=block+group:*
  &in=state:06+county:075
  &key=YOUR_KEY
```
