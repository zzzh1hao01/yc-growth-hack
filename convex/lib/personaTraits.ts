import {
  homeAgeYears,
  insuranceSegmentLabel,
  insuranceSegmentNarrative,
  type InsuranceLeadDoc,
  type TimingConfidence,
} from "./scoring";

export const PERSONA_TRAITS_VERSION = 6;

export type PersonaTraitProfile = {
  version: number;
  segmentLabel: string;
  segmentBaseline: string;
  tenure: "long_term" | "recent_mover" | "unknown";
  housing: "owner" | "renter";
  homeAgeYears: number;
  homeAgeBand: "historic" | "mid_age" | "newer";
  urgencyLevel: "high" | "medium" | "low";
  needScore: number;
  timingScore: number;
  timingConfidence: TimingConfidence;
  gapPct: number;
  gapDollars: number;
  rebuildCost: number;
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

function urgencyLevel(
  needScore: number,
  worthOutreach: boolean,
): PersonaTraitProfile["urgencyLevel"] {
  if (worthOutreach && needScore >= 0.85) return "high";
  if (needScore >= 0.6 || worthOutreach) return "medium";
  return "low";
}

function budgetPosture(
  gapPct: number,
  urgency: PersonaTraitProfile["urgencyLevel"],
): string {
  if (gapPct >= 0.4 && urgency === "high") {
    return "May be shocked by a gap this large — needs education before price talk.";
  }
  if (gapPct >= 0.25) {
    return "Aware something may be off but hasn't prioritized a review — responds to concrete dollar examples.";
  }
  return "Moderate gap — may assume carrier keeps them current unless shown rebuild math.";
}

function decisionStyle(
  tenure: PersonaTraitProfile["tenure"],
  timingScore: number,
): string {
  if (tenure === "recent_mover") {
    return "Still settling coverage after purchase — open to a second opinion if framed as protection, not sales.";
  }
  if (timingScore >= 0.5) {
    return "Renewal-minded — compares if you anchor to their anniversary or recent life change.";
  }
  if (tenure === "long_term") {
    return "Set-and-forget policy holder — needs proof their Coverage A hasn't kept up with SF rebuild costs.";
  }
  return "Cautious — wants documentation and references before changing carriers.";
}

function opennessToOutreach(
  worthOutreach: boolean,
  urgency: PersonaTraitProfile["urgencyLevel"],
  housing: PersonaTraitProfile["housing"],
): PersonaTraitProfile["opennessToOutreach"] {
  if (housing === "renter") return "low";
  if (worthOutreach || urgency === "high") return "high";
  if (urgency === "medium") return "medium";
  return "low";
}

const COMMUNICATION_STYLES = [
  "Direct — wants numbers and a clear gap explanation upfront.",
  "Skeptical of insurance sales — trusts third-party rebuild estimates.",
  "Relationship-oriented — prefers a local agent who explains options patiently.",
  "Busy professional — wants a 10-minute review call, not a long pitch.",
  "Detail-oriented — asks about ordinance/law, inflation guard, and endorsements.",
  "Price-sensitive — compares premiums but will pay if underinsurance risk is real.",
];

const CHANNELS = [
  "Email with a one-page coverage summary",
  "Phone call after a mailed letter",
  "Neighbor or Nextdoor referral introduction",
  "Annual renewal notice follow-up",
  "Post-renovation permit trigger outreach",
  "Financial advisor or mortgage broker referral",
];

const VARIATION_HINTS = [
  "Recently saw a neighbor's claim payout fall short of rebuild cost.",
  "Planning a major remodel — worried current Coverage A won't cover it.",
  "Has an older mortgage escrow bill — hasn't looked at declarations in years.",
  "Adult children urging a policy review after a regional wildfire scare.",
  "Bundled auto/home for a discount — hasn't stress-tested home limits.",
  "Retired on fixed income — fears premium hikes but hates surprise gaps.",
  "Just received a carrier non-renewal notice.",
  "Handy and DIY-minded — underestimates professional rebuild costs.",
];

export function buildPersonaTraits(lead: {
  householdId: string;
  ownerOccupied: boolean;
  yearBuilt?: number;
  yearsOwned?: number;
  purchaseYear?: number;
  needScore: number;
  timingScore: number;
  timingConfidence: TimingConfidence;
  replacementCostGapPct: number;
  replacementCostGapDollars: number;
  replacementCostToday: number;
  worthOutreach: boolean;
  ownerFullName?: string;
  ownerFirstName?: string;
  contactRole?: "owner" | "resident" | "unknown";
}): PersonaTraitProfile {
  const tenure: PersonaTraitProfile["tenure"] =
    lead.yearsOwned == null
      ? "unknown"
      : lead.yearsOwned <= 4
        ? "recent_mover"
        : "long_term";

  const age = homeAgeYears(lead.yearBuilt);
  const homeAgeBand: PersonaTraitProfile["homeAgeBand"] =
    age >= 50 ? "historic" : age >= 25 ? "mid_age" : "newer";

  const urgency = urgencyLevel(lead.needScore, lead.worthOutreach);
  const housing: PersonaTraitProfile["housing"] = lead.ownerOccupied
    ? "owner"
    : "renter";

  const doc = lead as InsuranceLeadDoc;
  const segmentLabel = insuranceSegmentLabel({
    ...doc,
    _id: "",
    householdId: lead.householdId,
    address: "",
    lat: 0,
    lng: 0,
    neighborhood: "",
    sqft: 0,
    spriteVariant: 0,
  });

  const topPropertySignals = [
    `${Math.round(lead.replacementCostGapPct * 100)}% estimated underinsurance`,
    `Rebuild ~$${lead.replacementCostToday.toLocaleString()} vs likely coverage anchor`,
    lead.yearsOwned != null && lead.purchaseYear
      ? `Owned since ${lead.purchaseYear}`
      : `Timing confidence: ${lead.timingConfidence}`,
    housing === "owner" ? "Owner-occupied SFR" : "Non-owner-occupied",
  ].slice(0, 5);

  return {
    version: PERSONA_TRAITS_VERSION,
    segmentLabel,
    segmentBaseline: insuranceSegmentNarrative({
      ...doc,
      _id: "",
      householdId: lead.householdId,
      address: "",
      lat: 0,
      lng: 0,
      neighborhood: "",
      sqft: 0,
      spriteVariant: 0,
    }),
    tenure,
    housing,
    homeAgeYears: age,
    homeAgeBand,
    urgencyLevel: urgency,
    needScore: lead.needScore,
    timingScore: lead.timingScore,
    timingConfidence: lead.timingConfidence,
    gapPct: lead.replacementCostGapPct,
    gapDollars: lead.replacementCostGapDollars,
    rebuildCost: lead.replacementCostToday,
    budgetPosture: budgetPosture(lead.replacementCostGapPct, urgency),
    decisionStyle: decisionStyle(tenure, lead.timingScore),
    communicationStyle: pickFrom(COMMUNICATION_STYLES, lead.householdId, 1),
    channelPreference: pickFrom(CHANNELS, lead.householdId, 2),
    opennessToOutreach: opennessToOutreach(
      lead.worthOutreach,
      urgency,
      housing,
    ),
    topPropertySignals,
    variationHint: pickFrom(VARIATION_HINTS, lead.householdId, 3),
    ownerFullName: lead.ownerFullName,
    ownerFirstName: lead.ownerFirstName,
    contactRole: lead.contactRole,
  };
}

export function traitsPromptBlock(traits: PersonaTraitProfile): string {
  const contactRole =
    traits.contactRole ?? (traits.housing === "renter" ? "resident" : "owner");
  const roleLabel =
    contactRole === "resident"
      ? "likely resident (may not be title holder)"
      : contactRole === "owner"
        ? "likely homeowner"
        : "contact at this address";
  const ownerLine = traits.ownerFullName
    ? `- Identified contact: ${traits.ownerFullName} (${roleLabel}; write the persona FOR this person)`
    : "- Contact name: not yet verified — use neutral voice, do not invent a full name";

  return `Derived household trait profile (insurance / underinsurance context):
${ownerLine}
- Segment: ${traits.segmentLabel} — ${traits.segmentBaseline}
- Housing: ${traits.housing} · Tenure: ${traits.tenure} · Home age: ${traits.homeAgeYears}y (${traits.homeAgeBand})
- Need score: ${traits.needScore.toFixed(2)} · Timing score: ${traits.timingScore.toFixed(2)} (${traits.timingConfidence} confidence)
- Coverage gap: ${Math.round(traits.gapPct * 100)}% (~$${traits.gapDollars.toLocaleString()}) vs ~$${traits.rebuildCost.toLocaleString()} rebuild
- Urgency: ${traits.urgencyLevel}
- Budget posture: ${traits.budgetPosture}
- Decision style: ${traits.decisionStyle}
- Communication: ${traits.communicationStyle}
- Likely channel: ${traits.channelPreference}
- Openness to coverage review outreach: ${traits.opennessToOutreach}
- Property signals: ${traits.topPropertySignals.join("; ")}
- Unique nuance (must reflect in persona): ${traits.variationHint}`;
}
