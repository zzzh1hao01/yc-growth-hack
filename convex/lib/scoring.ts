import { haversineMiles, proximityMultiplier } from "./geo";

export type ScoreVertical = "hvac" | "panel" | "ev";

export type VerticalScoreEntry = {
  score: number;
  urgency_flag: boolean;
  last_relevant_permit_date?: string | null;
  reasons: string[];
};

export type ServiceProfile = {
  service_types: string[];
  price_point: string;
  customer_preferences: string;
};

const CLUSTER_LABELS = [
  "Long-time high-income owner",
  "Long-time budget-conscious owner",
  "Recent buyer",
  "Older retired homeowner",
  "Mid-income working family",
  "Mixed / unclassified",
];

const CLUSTER_NARRATIVES: Record<number, string> = {
  0: "Established homeowner with strong equity and likely capacity for premium upgrades. They tend to value quality workmanship and may prefer referrals over cold outreach.",
  1: "Cost-conscious long-term owner who weighs price carefully but still invests when systems fail. Clear ROI and financing options often matter more than brand prestige.",
  2: "Recently purchased and still settling in — often open to upgrades they inherited from the prior owner, especially HVAC, panel, or EV readiness.",
  3: "Older retired household that may defer non-urgent work but responds to safety, comfort, and reliability framing rather than upsell pressure.",
  4: "Working-family household balancing household budget with practical repairs. They respond to transparent pricing and scheduling flexibility.",
  5: "Mixed signals from available data — treat as a general residential lead and qualify budget and urgency in the first conversation.",
};

/** Fixed canvassing radius (mi) — avoids inflating scores when all leads are far away. */
const SERVICE_RADIUS_MILES = 2.5;

export function clusterLabel(clusterId: number): string {
  return CLUSTER_LABELS[clusterId] ?? CLUSTER_LABELS[5];
}

export function clusterNarrative(clusterId: number): string {
  return CLUSTER_NARRATIVES[clusterId] ?? CLUSTER_NARRATIVES[5];
}

export function pickVertical(serviceProfile?: ServiceProfile | null): ScoreVertical {
  const types = serviceProfile?.service_types ?? ["hvac"];
  const normalized = types.map((t) => t.toLowerCase());
  if (normalized.some((t) => t.includes("hvac") || t.includes("mechanical"))) {
    return "hvac";
  }
  if (normalized.some((t) => t.includes("ev") || t.includes("charger"))) {
    return "ev";
  }
  if (
    normalized.some(
      (t) => t.includes("electrical") || t.includes("panel") || t.includes("electric"),
    )
  ) {
    return "panel";
  }
  return "hvac";
}

export function yearsSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const year = parseInt(dateStr.slice(0, 4), 10);
  if (Number.isNaN(year)) return null;
  return new Date().getFullYear() - year;
}

export function homeAgeYears(yearBuilt: number): number {
  if (!yearBuilt || yearBuilt <= 0) return 0;
  return new Date().getFullYear() - yearBuilt;
}

function priceTierFitMultiplier(
  assessedValue: number,
  pricePoint?: string,
): number {
  if (!pricePoint) return 1;
  if (pricePoint === "high" && assessedValue >= 1_400_000) return 1.08;
  if (pricePoint === "mid" && assessedValue >= 700_000 && assessedValue < 1_800_000) {
    return 1.05;
  }
  if (pricePoint === "low" && assessedValue < 900_000) return 1.05;
  if (pricePoint === "high" && assessedValue < 700_000) return 0.92;
  return 1;
}

/**
 * Revised composite score vs. prior system:
 * - Fixed 2.5mi proximity (was dataset-relative max distance → compressed scores)
 * - Owner-occupied boost / renter penalty
 * - Urgency, recent mover, old-home, and price-tier fit multipliers
 */
export function computeCompositeScore(
  baseScore: number,
  vs: VerticalScoreEntry | undefined,
  doc: {
    ownerOccupied: boolean;
    assessedValue: number;
    lastSaleDate?: string;
    yearBuilt: number;
  },
  distanceMiles: number | undefined,
  serviceProfile?: ServiceProfile | null,
): number {
  let score = baseScore;

  if (doc.ownerOccupied) score *= 1.18;
  else score *= 0.55;

  if (vs?.urgency_flag) score *= 1.15;

  const saleYears = yearsSince(doc.lastSaleDate);
  if (saleYears != null && saleYears <= 4) score *= 1.1;

  const age = homeAgeYears(doc.yearBuilt);
  if (age >= 45) score *= 1.06;

  score *= priceTierFitMultiplier(doc.assessedValue, serviceProfile?.price_point);

  if (distanceMiles != null) {
    score *= proximityMultiplier(distanceMiles, SERVICE_RADIUS_MILES);
  }

  return Math.min(1, Math.max(0, score));
}

export function toLeadView(
  doc: {
    _id: string;
    householdId: string;
    address: string;
    lat: number;
    lng: number;
    yearBuilt: number;
    ownerOccupied: boolean;
    assessedValue: number;
    lastSaleDate?: string;
    clusterId: number;
    verticalScores: Record<string, VerticalScoreEntry>;
    spriteVariant: number;
  },
  vertical: ScoreVertical,
  contractorLat?: number,
  contractorLng?: number,
  serviceProfile?: ServiceProfile | null,
  neighborhood?: string,
) {
  const vs = doc.verticalScores[vertical] ?? doc.verticalScores.hvac;
  const baseScore = vs?.score ?? 0;
  let distanceMiles: number | undefined;

  if (contractorLat != null && contractorLng != null) {
    distanceMiles = haversineMiles(contractorLat, contractorLng, doc.lat, doc.lng);
  }

  const compositeScore = computeCompositeScore(
    baseScore,
    vs,
    doc,
    distanceMiles,
    serviceProfile,
  );

  const matchScore = Math.round(compositeScore * 100);

  return {
    id: doc.householdId,
    convexId: doc._id,
    address: doc.address,
    lat: doc.lat,
    lng: doc.lng,
    neighborhood,
    matchScore,
    baseScore,
    compositeScore,
    urgent: vs?.urgency_flag ?? false,
    spriteVariant: doc.spriteVariant as 0 | 1 | 2 | 3,
    permitAgeYears: yearsSince(vs?.last_relevant_permit_date) ?? 99,
    lastPermitDate: vs?.last_relevant_permit_date ?? undefined,
    homeAgeYears: homeAgeYears(doc.yearBuilt),
    ownerOccupied: doc.ownerOccupied,
    assessedValue: doc.assessedValue,
    lastSaleDate: doc.lastSaleDate,
    clusterId: String(doc.clusterId),
    cluster: clusterLabel(doc.clusterId),
    clusterNarrative: clusterNarrative(doc.clusterId),
    vertical,
    verticalScores: doc.verticalScores,
    scoreReasons: vs?.reasons ?? [],
    distanceMiles,
    yearBuilt: doc.yearBuilt,
    dataSource: "etl" as const,
    ownerFullName: (doc as { ownerFullName?: string }).ownerFullName,
    ownerFirstName: (doc as { ownerFirstName?: string }).ownerFirstName,
    ownerLastName: (doc as { ownerLastName?: string }).ownerLastName,
    ownerContactRole: (doc as { ownerContactRole?: "owner" | "resident" | "unknown" })
      .ownerContactRole,
  };
}

export function rankLeads<
  T extends {
    lat: number;
    lng: number;
    verticalScores: Record<string, VerticalScoreEntry>;
    householdId: string;
    address: string;
    yearBuilt: number;
    ownerOccupied: boolean;
    assessedValue: number;
    lastSaleDate?: string;
    clusterId: number;
    spriteVariant: number;
    _id: string;
  },
>(
  docs: T[],
  vertical: ScoreVertical,
  contractorLat?: number,
  contractorLng?: number,
  serviceProfile?: ServiceProfile | null,
  neighborhoodFor?: (doc: T) => string | undefined,
) {
  return docs
    .map((doc) =>
      toLeadView(
        doc,
        vertical,
        contractorLat,
        contractorLng,
        serviceProfile,
        neighborhoodFor?.(doc),
      ),
    )
    .sort((a, b) => b.compositeScore - a.compositeScore);
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

/** Demo board: balanced hot / warm / cold sample, max 30 pins. */
export function demoSampleLeads<
  T extends { matchScore: number; id: string },
>(ranked: T[], sessionId: string, cap = 30): T[] {
  const hot = ranked.filter((l) => l.matchScore >= 70);
  const warm = ranked.filter((l) => l.matchScore >= 40 && l.matchScore < 70);
  const cold = ranked.filter((l) => l.matchScore < 40);

  const perTier = Math.floor(cap / 3);
  const seed = hashString(sessionId || "demo");

  const pick = (pool: T[], n: number, offset: number) =>
    seededShuffle(pool, seed + offset).slice(0, n);

  const used = new Set<string>();
  const take = (pool: T[], n: number, offset: number) => {
    const chosen = pick(
      pool.filter((l) => !used.has(l.id)),
      n,
      offset,
    );
    for (const lead of chosen) used.add(lead.id);
    return chosen;
  };

  let sample = [
    ...take(hot, perTier, 0),
    ...take(warm, perTier, 1),
    ...take(cold, perTier, 2),
  ];

  if (sample.length < cap) {
    const rest = seededShuffle(
      ranked.filter((l) => !used.has(l.id)),
      seed + 4,
    );
    sample = [...sample, ...rest.slice(0, cap - sample.length)];
  }

  return sample.slice(0, cap);
}
