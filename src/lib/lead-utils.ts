export type MatchTier = "hot" | "warm" | "cold";

/** Match score = risk (45) + timing (30) + fit (25) → 100 total. */
export const RISK_SCORE_MAX = 45;
export const TIMING_SCORE_MAX = 30;
export const FIT_SCORE_MAX = 25;
export const MATCH_SCORE_MAX = RISK_SCORE_MAX + TIMING_SCORE_MAX + FIT_SCORE_MAX;

export type LeadScoreBreakdown = {
  riskPoints: number;
  timingPoints: number;
  fitPoints: number;
  total: number;
  hasComponents: boolean;
  hasFitData: boolean;
};

export function getFitScore(lead: {
  fitScore?: number;
  acsReceptivityScore?: number;
}): number {
  return lead.fitScore ?? lead.acsReceptivityScore ?? 0;
}

export function computeMatchScore(
  needScore: number,
  timingScore: number,
  fitScore = 0,
): number {
  return Math.min(
    MATCH_SCORE_MAX,
    Math.round(
      needScore * RISK_SCORE_MAX +
        timingScore * TIMING_SCORE_MAX +
        fitScore * FIT_SCORE_MAX,
    ),
  );
}

export function getLeadScoreBreakdown(lead: {
  needScore?: number;
  timingScore?: number;
  fitScore?: number;
  acsReceptivityScore?: number;
}): LeadScoreBreakdown {
  const hasNeed = lead.needScore != null;
  const hasTiming = lead.timingScore != null;
  const hasFitData = lead.fitScore != null || lead.acsReceptivityScore != null;

  if (!hasNeed && !hasTiming) {
    return {
      riskPoints: 0,
      timingPoints: 0,
      fitPoints: 0,
      total: 0,
      hasComponents: false,
      hasFitData,
    };
  }

  const need = lead.needScore ?? 0;
  const timing = lead.timingScore ?? 0;
  const fit = getFitScore(lead);

  const riskPoints = Math.round(need * RISK_SCORE_MAX);
  const timingPoints = Math.round(timing * TIMING_SCORE_MAX);
  const fitPoints = Math.round(fit * FIT_SCORE_MAX);
  const total = Math.min(MATCH_SCORE_MAX, riskPoints + timingPoints + fitPoints);

  return {
    riskPoints,
    timingPoints,
    fitPoints,
    total,
    hasComponents: true,
    hasFitData,
  };
}

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
