import {
  clusterLabel,
  clusterNarrative,
  homeAgeYears,
  yearsSince,
  type ScoreVertical,
  type VerticalScoreEntry,
} from "./scoring";

export const PERSONA_TRAITS_VERSION = 5;

export type PersonaTraitProfile = {
  version: number;
  clusterId: number;
  clusterLabel: string;
  clusterBaseline: string;
  incomeBand: "high" | "mid" | "low";
  tenure: "long_term" | "recent_mover" | "unknown";
  housing: "owner" | "renter";
  homeAgeYears: number;
  homeAgeBand: "historic" | "mid_age" | "newer";
  urgencyLevel: "high" | "medium" | "low";
  primaryNeed: ScoreVertical;
  needScore: number;
  budgetPosture: string;
  decisionStyle: string;
  communicationStyle: string;
  channelPreference: string;
  opennessToOutreach: "low" | "medium" | "high";
  topPropertySignals: string[];
  variationHint: string;
  ownerFullName?: string;
  ownerFirstName?: string;
  contactRole?: "owner" | "resident" | "unknown";
};

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickFrom<T>(items: T[], seed: string, salt: number): T {
  return items[hashString(`${seed}:${salt}`) % items.length];
}

function incomeBand(assessedValue: number): PersonaTraitProfile["incomeBand"] {
  if (assessedValue >= 1_350_000) return "high";
  if (assessedValue >= 650_000) return "mid";
  return "low";
}

function urgencyLevel(
  verticalScores: Record<string, VerticalScoreEntry>,
  primary: ScoreVertical,
): PersonaTraitProfile["urgencyLevel"] {
  const vs = verticalScores[primary] ?? verticalScores.hvac;
  if (!vs) return "low";
  if (vs.urgency_flag && vs.score >= 0.75) return "high";
  if (vs.urgency_flag || vs.score >= 0.55) return "medium";
  return "low";
}

function primaryVertical(verticalScores: Record<string, VerticalScoreEntry>): {
  vertical: ScoreVertical;
  score: number;
} {
  const entries: ScoreVertical[] = ["hvac", "panel", "ev"];
  let best: ScoreVertical = "hvac";
  let bestScore = 0;
  for (const key of entries) {
    const score = verticalScores[key]?.score ?? 0;
    if (score > bestScore) {
      best = key;
      bestScore = score;
    }
  }
  return { vertical: best, score: bestScore };
}

function budgetPosture(
  clusterId: number,
  band: PersonaTraitProfile["incomeBand"],
  urgency: PersonaTraitProfile["urgencyLevel"],
): string {
  if (clusterId === 0 && band === "high") {
    return "Quality-first — will pay for reliability and clean work, less price-sensitive if scope is clear.";
  }
  if (clusterId === 2) {
    return "Upgrade-minded recent buyer — budget exists for fixes they did not plan for at purchase.";
  }
  if (clusterId === 3) {
    return "Fixed-income cautious — needs safety/comfort framing; dislikes feeling rushed or upsold.";
  }
  if (clusterId === 4 && urgency === "high") {
    return "Practical family budget — will spend when failure risk is real, not for nice-to-haves.";
  }
  if (band === "low" && urgency === "low") {
    return "Price-sensitive and deferring — pushes non-urgent work unless ROI is obvious.";
  }
  if (band === "mid" && urgency === "medium") {
    return "Value shopper — compares quotes, open to work with clear timeline and warranty.";
  }
  if (band === "high") {
    return "Premium-leaning — cares about credentials, reviews, and minimal disruption.";
  }
  return "Balanced — neither impulse buyer nor extreme penny-pincher; wants proof before committing.";
}

function decisionStyle(clusterId: number, tenure: PersonaTraitProfile["tenure"]): string {
  if (clusterId === 0) return "Decides quickly when trust is established; delegates details to a reputable contractor.";
  if (clusterId === 2 && tenure === "recent_mover") {
    return "Still learning the house — gathers multiple opinions before big spends.";
  }
  if (clusterId === 3) return "Slow and deliberate — prefers familiar vendors and written scope.";
  if (clusterId === 4) return "Joint decision with partner; schedules around work and school.";
  if (clusterId === 1) return "Skeptical of sales pressure — wants itemized quotes and references.";
  return "Varies by issue severity — urgent repairs fast, discretionary projects slow.";
}

function opennessToOutreach(
  clusterId: number,
  housing: PersonaTraitProfile["housing"],
  urgency: PersonaTraitProfile["urgencyLevel"],
): PersonaTraitProfile["opennessToOutreach"] {
  if (housing === "renter") return "low";
  if (urgency === "high") return "high";
  if (clusterId === 0 || clusterId === 2) return "medium";
  if (clusterId === 1 || clusterId === 3) return "low";
  return "medium";
}

const COMMUNICATION_STYLES = [
  "Direct and skeptical — asks hard questions upfront.",
  "Polite but guarded — listens, then verifies everything online.",
  "Warm and chatty — opens up if you mention neighbors or local references.",
  "Busy and impatient — wants the point in 30 seconds.",
  "Detail-oriented — wants specs, permits, and brand names.",
  "Relationship-driven — hires people who feel trustworthy over the lowest bid.",
];

const CHANNELS = [
  "Nextdoor neighbor recommendation",
  "Friend or family referral",
  "Google reviews with photos",
  "Yelp / Angi after comparing 3 quotes",
  "Repeat vendor they've used before",
  "Building permit history / known local contractor",
];

const VARIATION_HINTS = [
  "Recently had a bad contractor experience — extra skeptical.",
  "Planning a kitchen remodel soon — bundling trades is appealing.",
  "Has an elderly parent in the home — safety upgrades resonate.",
  "Works from home — cares about noise and scheduling windows.",
  "Environmentally motivated — interested in efficiency rebates.",
  "Landlord-occupied duplex — decisions tied to tenant complaints.",
  "Just got a high utility bill — receptive to efficiency pitch.",
  "Handy themselves on small fixes — needs proof for big jobs.",
];

export function buildPersonaTraits(lead: {
  householdId: string;
  clusterId: number;
  ownerOccupied: boolean;
  assessedValue: number;
  yearBuilt: number;
  lastSaleDate?: string;
  verticalScores: Record<string, VerticalScoreEntry>;
  ownerFullName?: string;
  ownerFirstName?: string;
  contactRole?: "owner" | "resident" | "unknown";
}): PersonaTraitProfile {
  const saleYears = yearsSince(lead.lastSaleDate);
  const tenure: PersonaTraitProfile["tenure"] =
    saleYears == null
      ? "unknown"
      : saleYears <= 4
        ? "recent_mover"
        : "long_term";

  const age = homeAgeYears(lead.yearBuilt);
  const homeAgeBand: PersonaTraitProfile["homeAgeBand"] =
    age >= 50 ? "historic" : age >= 25 ? "mid_age" : "newer";

  const band = incomeBand(lead.assessedValue);
  const { vertical, score } = primaryVertical(lead.verticalScores);
  const urgency = urgencyLevel(lead.verticalScores, vertical);
  const housing: PersonaTraitProfile["housing"] = lead.ownerOccupied
    ? "owner"
    : "renter";

  const vs = lead.verticalScores[vertical] ?? lead.verticalScores.hvac;
  const topPropertySignals = [
    ...(vs?.reasons?.slice(0, 3) ?? []),
    housing === "renter" ? "Non-owner-occupied — may not control upgrade spend" : "Owner-occupied",
    tenure === "recent_mover" ? `Moved in within ~${saleYears ?? "?"} years` : "Long-term tenure",
    `Assessed value band: ${band}`,
  ].slice(0, 5);

  return {
    version: PERSONA_TRAITS_VERSION,
    clusterId: lead.clusterId,
    clusterLabel: clusterLabel(lead.clusterId),
    clusterBaseline: clusterNarrative(lead.clusterId),
    incomeBand: band,
    tenure,
    housing,
    homeAgeYears: age,
    homeAgeBand,
    urgencyLevel: urgency,
    primaryNeed: vertical,
    needScore: score,
    budgetPosture: budgetPosture(lead.clusterId, band, urgency),
    decisionStyle: decisionStyle(lead.clusterId, tenure),
    communicationStyle: pickFrom(COMMUNICATION_STYLES, lead.householdId, 1),
    channelPreference: pickFrom(CHANNELS, lead.householdId, 2),
    opennessToOutreach: opennessToOutreach(lead.clusterId, housing, urgency),
    topPropertySignals,
    variationHint: pickFrom(VARIATION_HINTS, lead.householdId, 3),
    ownerFullName: lead.ownerFullName,
    ownerFirstName: lead.ownerFirstName,
    contactRole: lead.contactRole,
  };
}

export function traitsPromptBlock(traits: PersonaTraitProfile): string {
  const contactRole = traits.contactRole ?? (traits.housing === "renter" ? "resident" : "owner");
  const roleLabel =
    contactRole === "resident"
      ? "likely resident (may not be title holder)"
      : contactRole === "owner"
        ? "likely homeowner"
        : "contact at this address";
  const ownerLine = traits.ownerFullName
    ? `- Identified contact: ${traits.ownerFullName} (${roleLabel}; write the persona FOR this person; use their first name naturally; pronouns and narrative must match this name — never describe a different person)`
    : "- Contact name: not yet verified — use neutral voice, do not invent a full name";

  return `Derived household trait profile (use as ground truth — do NOT ignore):
${ownerLine}
- Cluster: ${traits.clusterLabel} — ${traits.clusterBaseline}
- Income band (assessed value proxy): ${traits.incomeBand}
- Housing: ${traits.housing} · Tenure: ${traits.tenure} · Home age: ${traits.homeAgeYears}y (${traits.homeAgeBand})
- Service need: ${traits.primaryNeed} (score ${traits.needScore.toFixed(2)}, urgency ${traits.urgencyLevel})
- Budget posture: ${traits.budgetPosture}
- Decision style: ${traits.decisionStyle}
- Communication: ${traits.communicationStyle}
- Likely channel: ${traits.channelPreference}
- Openness to cold outreach: ${traits.opennessToOutreach}
- Property signals: ${traits.topPropertySignals.join("; ")}
- Unique nuance (must reflect in persona): ${traits.variationHint}`;
}
