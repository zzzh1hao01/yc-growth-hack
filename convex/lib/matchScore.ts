/** Match score weights — risk + timing + fit = 100. */
export const RISK_SCORE_MAX = 45;
export const TIMING_SCORE_MAX = 30;
export const FIT_SCORE_MAX = 25;
export const MATCH_SCORE_MAX = RISK_SCORE_MAX + TIMING_SCORE_MAX + FIT_SCORE_MAX;

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

export function getScoreBreakdown(
  needScore: number,
  timingScore: number,
  fitScore = 0,
) {
  const riskPoints = Math.round(needScore * RISK_SCORE_MAX);
  const timingPoints = Math.round(timingScore * TIMING_SCORE_MAX);
  const fitPoints = Math.round(fitScore * FIT_SCORE_MAX);
  const total = Math.min(
    MATCH_SCORE_MAX,
    riskPoints + timingPoints + fitPoints,
  );

  return { riskPoints, timingPoints, fitPoints, total };
}
