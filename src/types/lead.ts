/**
 * Canonical lead shape for the bounty board.
 *
 * DEMO: UI reads from `src/data/placeholderLeads.ts` (static mocks).
 * PROD: Replace with `useQuery(api.leads.listLeads)` once ETL data is in Convex.
 *
 * Agent integration guide: docs/DATA_INTEGRATION.md
 */

export type SpriteVariant = 0 | 1 | 2 | 3;

export type ServiceVertical = "hvac" | "electrical";

export type LeadDataSource = "placeholder" | "etl";

/**
 * Full lead record — map pin + side panel + future persona chat context.
 */
export type Lead = {
  /** Stable id. ETL: use parcel id or normalized address hash. */
  id: string;

  // ── Geolocation (required for map sprites) ──────────────────────────────
  /** Normalized street address, e.g. "2847 24th St, San Francisco, CA" */
  address: string;
  /** WGS84 latitude from geocoded parcel centroid or rooftop geocode */
  lat: number;
  /** WGS84 longitude from geocoded parcel centroid or rooftop geocode */
  lng: number;
  /** SF neighborhood label for filtering / zoom (optional until ETL) */
  neighborhood?: string;

  // ── Scoring (computed by ETL pipeline — see BRIEF.md) ───────────────────
  /** Composite match score 0–100. Drives sprite color tier. */
  matchScore: number;
  /** True when permit age exceeds replacement threshold for the vertical. */
  urgent: boolean;

  // ── Visual only (not demographic — random/round-robin at ingest) ──────
  spriteVariant: SpriteVariant;

  // ── Permit signals (SF Open Data) ───────────────────────────────────────
  /** Years since last relevant HVAC/electrical permit. */
  permitAgeYears: number;
  /** Permit taxonomy label, e.g. "HVAC_REPLACEMENT", "ELECTRICAL_PANEL" */
  lastPermitType?: string;
  /** ISO date of last relevant permit (YYYY-MM-DD) */
  lastPermitDate?: string;
  /** Exclude from board when true (active construction) */
  hasOpenPermit?: boolean;

  // ── Assessor / parcel ───────────────────────────────────────────────────
  homeAgeYears: number;
  ownerOccupied?: boolean;
  assessedValue?: number;
  lastSaleDate?: string;

  // ── Behavioral cluster (offline AHS/CEX/GSS/Pew assignment) ───────────
  clusterId?: string;
  /** Human-readable cluster name shown in side panel */
  cluster: string;

  // ── Proximity (from contractor business address at session time) ────────
  distanceMiles?: number;

  // ── Metadata ────────────────────────────────────────────────────────────
  vertical?: ServiceVertical;
  dataSource?: LeadDataSource;
};

/** Fields agents must populate when ingesting real addresses. */
export type LeadIngestRequired = Pick<
  Lead,
  | "id"
  | "address"
  | "lat"
  | "lng"
  | "matchScore"
  | "urgent"
  | "spriteVariant"
  | "permitAgeYears"
  | "homeAgeYears"
  | "cluster"
>;

/** Optional enrichments agents should add when available from ETL. */
export type LeadIngestOptional = Omit<Lead, keyof LeadIngestRequired>;

export type LeadIngestInput = LeadIngestRequired & Partial<LeadIngestOptional>;
