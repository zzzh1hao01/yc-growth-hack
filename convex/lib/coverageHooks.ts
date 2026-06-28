export type CoverageLeadSignals = {
  replacementCostGapDollars?: number;
  replacementCostGapPct?: number;
  needScore?: number;
  timingScore?: number;
  compositeScore?: number;
};

export function formatGapDollars(dollars: number): string {
  if (dollars >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(1)}M`;
  }
  if (dollars >= 1_000) {
    return `$${Math.round(dollars / 1_000)}k`;
  }
  return `$${dollars}`;
}

export function coverageEmailHook(lead: CoverageLeadSignals): string {
  const gapDollars = lead.replacementCostGapDollars;
  const gapPct = lead.replacementCostGapPct;

  if (gapDollars != null && gapDollars > 0) {
    const pctPart =
      gapPct != null && gapPct > 0
        ? ` (~${Math.round(gapPct * 100)}% below estimated rebuild cost)`
        : "";
    return `Parcel data suggests Coverage A may lag rebuild cost by about ${formatGapDollars(gapDollars)}${pctPart}.`;
  }

  if (lead.timingScore != null && lead.timingScore >= 0.5) {
    return "Your timing signals suggest a good window for a coverage review before renewal.";
  }

  return "SF rebuild costs have risen — many homeowners find Coverage A hasn't kept pace.";
}

export function insuranceMatchScore(lead: CoverageLeadSignals): number {
  if (typeof lead.compositeScore === "number") {
    return Math.round(lead.compositeScore * 100);
  }
  if (typeof lead.needScore === "number") {
    return Math.round(lead.needScore * 100);
  }
  return 0;
}
