export type MatchTier = "hot" | "warm" | "cold";

export function getMatchTier(score: number): MatchTier {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export function getTierColor(tier: MatchTier): string {
  switch (tier) {
    case "hot":
      return "#22c55e";
    case "warm":
      return "#eab308";
    case "cold":
      return "#ef4444";
  }
}

export function getTierLabel(tier: MatchTier): string {
  switch (tier) {
    case "hot":
      return "Good";
    case "warm":
      return "Moderate";
    case "cold":
      return "Bad";
  }
}

export type QualityTier = MatchTier;

export type TierVisibility = {
  good: boolean;
  moderate: boolean;
  bad: boolean;
};

export const DEFAULT_TIER_VISIBILITY: TierVisibility = {
  good: true,
  moderate: true,
  bad: true,
};

export function countLeadsByTier<T extends { matchScore: number }>(leads: T[]) {
  let good = 0;
  let moderate = 0;
  let bad = 0;
  for (const lead of leads) {
    const tier = getMatchTier(lead.matchScore);
    if (tier === "hot") good++;
    else if (tier === "warm") moderate++;
    else bad++;
  }
  return { good, moderate, bad };
}

export function filterLeadsByTierVisibility<T extends { matchScore: number }>(
  leads: T[],
  visibility: TierVisibility,
): T[] {
  return leads.filter((lead) => {
    const tier = getMatchTier(lead.matchScore);
    if (tier === "hot") return visibility.good;
    if (tier === "warm") return visibility.moderate;
    return visibility.bad;
  });
}

export function getScoreBarColor(score: number): string {
  return getTierColor(getMatchTier(score));
}

/** Cold tier ceiling — leads below this are "low importance" on the map. */
export const COLD_SCORE_CEILING = 40;

export type LeadImportanceFilter = {
  minScore: number;
};

/**
 * Drop leads below `minScore`, lowest composite scores first as the threshold rises.
 * At 0 everything shows; at 40+ cold pins are gone.
 */
export function filterLeadsByImportance<T extends { matchScore: number }>(
  leads: T[],
  { minScore }: LeadImportanceFilter,
): T[] {
  if (minScore <= 0) return leads;
  return leads.filter((lead) => lead.matchScore >= minScore);
}

export function describeImportanceFilter(minScore: number): string {
  if (minScore <= 0) return "All leads";
  if (minScore < COLD_SCORE_CEILING) return `Hiding coldest (below ${minScore})`;
  if (minScore === COLD_SCORE_CEILING) return "Warm & hot only";
  if (minScore < 70) return `Warm+ (score ${minScore}+)`;
  return "Hot leads only";
}
