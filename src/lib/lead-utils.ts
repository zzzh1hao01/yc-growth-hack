export type MatchTier = "hot" | "warm" | "cold";

export function getMatchTier(score: number): MatchTier {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export function getTierColor(tier: MatchTier): string {
  switch (tier) {
    case "hot":
      return "#4ade80";
    case "warm":
      return "#fbbf24";
    case "cold":
      return "#f87171";
  }
}

export function getTierLabel(tier: MatchTier): string {
  switch (tier) {
    case "hot":
      return "Hot lead";
    case "warm":
      return "Warm lead";
    case "cold":
      return "Cold lead";
  }
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
