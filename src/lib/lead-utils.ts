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
