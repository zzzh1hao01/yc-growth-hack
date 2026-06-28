import { haversineMiles } from "./geo";

export type TimingConfidence = "high" | "low" | "none";

/** Insurance agent profile extracted at onboarding. */
export type AgentProfile = {
  lines_of_business: string[];
  price_point: string;
  customer_preferences: string;
};

/** @deprecated Alias for outreach pipeline compatibility. */
export type ServiceProfile = {
  service_types: string[];
  price_point: string;
  customer_preferences: string;
};

export type InsuranceLeadDoc = {
  _id: string;
  householdId: string;
  address: string;
  lat: number;
  lng: number;
  neighborhood: string;
  yearBuilt?: number;
  sqft: number;
  ownerOccupied: boolean;
  replacementCostToday: number;
  coverageAnchor: number;
  replacementCostGapDollars: number;
  replacementCostGapPct: number;
  needScore: number;
  timingScore: number;
  timingConfidence: TimingConfidence;
  compositeScore: number;
  worthOutreach: boolean;
  purchaseYear?: number;
  yearsOwned?: number;
  spriteVariant: number;
  ownerFullName?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerContactRole?: "owner" | "resident" | "unknown";
  recordedOwnerFullName?: string;
  assessorBlock?: string;
  assessorLot?: string;
  parcelNumber?: string;
};

export function homeAgeYears(yearBuilt?: number): number {
  if (!yearBuilt || yearBuilt <= 0) return 0;
  return new Date().getFullYear() - yearBuilt;
}

export function buildScoreReasons(doc: InsuranceLeadDoc): string[] {
  const reasons: string[] = [];
  const gapPct = Math.round(doc.replacementCostGapPct * 100);
  reasons.push(
    `${gapPct}% underinsured vs rebuild cost (${formatGapDollars(doc.replacementCostGapDollars)} gap)`,
  );
  if (doc.yearsOwned != null && doc.purchaseYear != null) {
    reasons.push(`Owned since ${doc.purchaseYear} (${doc.yearsOwned} years)`);
  } else if (doc.timingConfidence === "low") {
    reasons.push("Tenure estimated — no sale date on assessor record");
  }
  reasons.push(
    `Need ${Math.round(doc.needScore * 100)}/100 · Timing ${Math.round(doc.timingScore * 100)}/100`,
  );
  if (doc.worthOutreach) {
    reasons.push("High-priority outreach candidate");
  }
  return reasons;
}

function formatGapDollars(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function insuranceSegmentLabel(doc: InsuranceLeadDoc): string {
  if (doc.worthOutreach && doc.needScore >= 0.85) {
    return "Severely underinsured long-term owner";
  }
  if (
    doc.timingConfidence === "high" &&
    doc.yearsOwned != null &&
    doc.yearsOwned <= 5
  ) {
    return "Recent buyer — coverage set at purchase may lag rebuild cost";
  }
  if (doc.replacementCostGapPct >= 0.35) {
    return "Coverage drift — rebuild cost outpacing carrier inflation guard";
  }
  if (doc.timingScore >= 0.5) {
    return "Renewal window — timing signal elevated";
  }
  return "Moderate coverage gap — policy review candidate";
}

export function insuranceSegmentNarrative(doc: InsuranceLeadDoc): string {
  const gapPct = Math.round(doc.replacementCostGapPct * 100);
  if (doc.worthOutreach) {
    return `Likely carrying Coverage A well below today's ${formatGapDollars(doc.replacementCostToday)} rebuild estimate — a common pattern for long-held SF homes where construction inflation outpaces carrier inflation guards.`;
  }
  if (doc.timingConfidence === "high" && doc.yearsOwned != null && doc.yearsOwned <= 3) {
    return "Recently purchased — may still be on prior-owner coverage limits or a bundled policy that hasn't been stress-tested against SF rebuild costs.";
  }
  if (gapPct >= 25) {
    return `Estimated ${gapPct}% shortfall between likely Coverage A and replacement cost. May not realize the gap until a claim or renewal quote surfaces it.`;
  }
  return "Moderate underinsurance signals — may respond to a no-pressure coverage review framed around rebuild cost, not upselling.";
}

export function toLeadView(
  doc: InsuranceLeadDoc,
  agentLat?: number,
  agentLng?: number,
) {
  const matchScore = Math.round(doc.compositeScore * 100);
  let distanceMiles: number | undefined;

  if (agentLat != null && agentLng != null) {
    distanceMiles = haversineMiles(agentLat, agentLng, doc.lat, doc.lng);
  }

  return {
    id: doc.householdId,
    convexId: doc._id,
    address: doc.address,
    lat: doc.lat,
    lng: doc.lng,
    neighborhood: doc.neighborhood,
    matchScore,
    compositeScore: doc.compositeScore,
    needScore: doc.needScore,
    timingScore: doc.timingScore,
    timingConfidence: doc.timingConfidence,
    urgent: doc.worthOutreach,
    worthOutreach: doc.worthOutreach,
    spriteVariant: doc.spriteVariant as 0 | 1 | 2 | 3,
    homeAgeYears: homeAgeYears(doc.yearBuilt),
    ownerOccupied: doc.ownerOccupied,
    replacementCostToday: doc.replacementCostToday,
    coverageAnchor: doc.coverageAnchor,
    replacementCostGapDollars: doc.replacementCostGapDollars,
    replacementCostGapPct: doc.replacementCostGapPct,
    sqft: doc.sqft,
    purchaseYear: doc.purchaseYear,
    yearsOwned: doc.yearsOwned,
    yearBuilt: doc.yearBuilt,
    scoreReasons: buildScoreReasons(doc),
    cluster: insuranceSegmentLabel(doc),
    clusterNarrative: insuranceSegmentNarrative(doc),
    distanceMiles,
    dataSource: "etl" as const,
    ownerFullName: doc.ownerFullName,
    ownerFirstName: doc.ownerFirstName,
    ownerLastName: doc.ownerLastName,
    ownerContactRole: doc.ownerContactRole,
    recordedOwnerFullName: doc.recordedOwnerFullName,
    assessorBlock: doc.assessorBlock,
    assessorLot: doc.assessorLot,
    parcelNumber: doc.parcelNumber,
  };
}

export function rankInsuranceLeads<
  T extends InsuranceLeadDoc,
>(docs: T[], agentLat?: number, agentLng?: number) {
  return docs
    .map((doc) => toLeadView(doc, agentLat, agentLng))
    .sort((a, b) => {
      if (b.compositeScore! - a.compositeScore! !== 0) {
        return b.compositeScore! - a.compositeScore!;
      }
      if (b.needScore! - a.needScore! !== 0) {
        return b.needScore! - a.needScore!;
      }
      return b.timingScore! - a.timingScore!;
    });
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let state = seed || 1;
  const next = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Map board: ~400 pins, stratified by neighborhood + score tier (proportional, no forced thirds). */
export function demoSampleLeads<
  T extends {
    matchScore: number;
    id: string;
    neighborhood?: string;
  },
>(ranked: T[], sessionId: string, cap = 400): T[] {
  if (ranked.length <= cap) return ranked;

  const seed = hashString(sessionId || "demo");
  const byNeighborhood = new Map<string, T[]>();

  for (const lead of ranked) {
    const nb = lead.neighborhood ?? "Unknown";
    const bucket = byNeighborhood.get(nb);
    if (bucket) bucket.push(lead);
    else byNeighborhood.set(nb, [lead]);
  }

  const neighborhoods = [...byNeighborhood.keys()].sort();
  const baseQuota = Math.floor(cap / neighborhoods.length);
  let remainder = cap - baseQuota * neighborhoods.length;

  const used = new Set<string>();
  const sample: T[] = [];

  const takeFromPool = (pool: T[], n: number, salt: number) => {
    if (n <= 0) return;
    const available = pool.filter((l) => !used.has(l.id));
    const chosen = seededShuffle(available, seed + salt).slice(0, n);
    for (const lead of chosen) {
      used.add(lead.id);
      sample.push(lead);
    }
  };

  for (let i = 0; i < neighborhoods.length; i += 1) {
    const quota = baseQuota + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;

    const pool = byNeighborhood.get(neighborhoods[i])!;
    const before = sample.length;
    const hot = pool.filter((l) => l.matchScore >= 70);
    const warm = pool.filter((l) => l.matchScore >= 40 && l.matchScore < 70);
    const cold = pool.filter((l) => l.matchScore < 40);
    const total = pool.length;

    if (total === 0) continue;

    let nHot = Math.round((quota * hot.length) / total);
    let nWarm = Math.round((quota * warm.length) / total);
    let nCold = quota - nHot - nWarm;

    if (nCold < 0) {
      nWarm = Math.max(0, nWarm + nCold);
      nCold = 0;
    }
    if (nWarm < 0) {
      nHot = Math.max(0, nHot + nWarm);
      nWarm = 0;
    }

    takeFromPool(hot, nHot, i * 10 + 1);
    takeFromPool(warm, nWarm, i * 10 + 2);
    takeFromPool(cold, nCold, i * 10 + 3);

    const shortfall = quota - (sample.length - before);
    if (shortfall > 0) {
      takeFromPool(pool, shortfall, i * 10 + 9);
    }
  }

  if (sample.length < cap) {
    const rest = seededShuffle(
      ranked.filter((l) => !used.has(l.id)),
      seed + 999,
    );
    for (const lead of rest) {
      if (sample.length >= cap) break;
      used.add(lead.id);
      sample.push(lead);
    }
  }

  return sample.slice(0, cap);
}

/** @deprecated Outreach pipeline only — not used for insurance ranking. */
export function pickVertical(
  serviceProfile?: ServiceProfile | AgentProfile | null,
): "hvac" | "panel" | "ev" {
  const types =
    (serviceProfile as ServiceProfile | undefined)?.service_types ??
    (serviceProfile as AgentProfile | undefined)?.lines_of_business ??
    ["home"];
  const normalized = types.map((t) => t.toLowerCase());
  if (normalized.some((t) => t.includes("home"))) return "hvac";
  return "hvac";
}
